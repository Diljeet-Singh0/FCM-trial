require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const cron = require('node-cron');

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioVerifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

let twilioClient = null;
if (twilioAccountSid && twilioAuthToken && twilioVerifyServiceSid &&
  twilioAccountSid !== 'your_twilio_account_sid' &&
  twilioAuthToken !== 'your_twilio_auth_token' &&
  twilioVerifyServiceSid !== 'your_twilio_verify_service_sid') {
  try {
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    console.log('[Twilio] Initialized successfully');
  } catch (error) {
    console.error('[Twilio] Failed to initialize Twilio client:', error.message);
  }
} else {
  console.warn('[Twilio] Missing or placeholder Twilio credentials. Verify SMS OTP will fail until correct env vars are configured.');
}

const otpRateLimiter = {}; // { phone: [timestamps] }

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

const ADMIN_PIN = process.env.ADMIN_PIN || 'GoZo_2026';
// Deterministic token so cached sessions survive server restarts
const crypto = require('crypto');
const ADMIN_TOKEN = 'gozo-admin-' + crypto.createHash('sha256').update(ADMIN_PIN + 'gozo-salt').digest('hex').slice(0, 16);

const requireAdmin = (req, res, next) => {
  if (req.headers['x-admin-token'] !== ADMIN_TOKEN) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

let serviceAccount;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString());
  } else {
    serviceAccount = require('./serviceAccountKey.json');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('[FCM] Initialized successfully');
} catch (error) {
  console.error('[FCM] Failed to initialize Firebase Admin:', error.message);
  // Continue without crashing for health endpoint to work
}

const tokenStore = {};
const driverStatusStore = {}; // { driverId: { online: bool, lastSeen: ts, latitude: num, longitude: num } }
const pendingCascades = {}; // { requestId: [timeoutId, ...] } — cascading notification timers
const VALID_ROLES = new Set(['owner', 'transporter']);
const BATCH_SIZE = 5; // notify 5 nearest drivers per wave
const BATCH_INTERVAL_MS = 20 * 1000; // 20 seconds between waves
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN || '';

// Haversine formula: distance in km between two lat/lng points
const haversineKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Geocode an address to [lat, lng] using Mapbox
const geocodeAddress = async (address) => {
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { latitude: lat, longitude: lng };
    }
  } catch (e) {
    console.warn('[GoZo] Geocode failed:', e.message);
  }
  return null;
};

// Cancel all pending cascade timers for a request
const cancelCascade = (requestId) => {
  if (pendingCascades[requestId]) {
    pendingCascades[requestId].forEach((tid) => clearTimeout(tid));
    delete pendingCascades[requestId];
  }
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

if (supabase) {
  console.log('[Supabase] Client initialized');
} else {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ success: false, error: 'Supabase not configured' });
    return false;
  }
  return true;
};

app.post('/register-token', (req, res) => {
  try {
    const { userId, fcmToken } = req.body;
    if (!userId || !fcmToken) {
      return res.status(400).json({ success: false, error: 'Missing userId or fcmToken' });
    }

    tokenStore[userId] = fcmToken;
    console.log(`[FCM] Registered token for ${userId}`);

    res.json({
      success: true,
      userId,
      tokenPreview: fcmToken.slice(0, 20) + '...'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/send-request', async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ success: false, error: 'Missing targetUserId' });
    }

    if (!admin.apps.length) {
      return res.status(500).json({ success: false, error: 'Firebase Admin not initialized' });
    }

    const token = tokenStore[targetUserId];

    if (!token) {
      return res.status(404).json({ success: false, error: 'User token not found' });
    }

    const payload = {
      token: token,
      notification: {
        title: "🚗 Ride Request",
        body: "A rider needs you! Tap to accept."
      },
      data: {
        rideId: "123",
        type: "RIDE_REQUEST",
        userId: "user-1"
      },
      android: {
        priority: "high",
        notification: { channelId: "ride_requests" }
      },
      apns: {
        headers: { "apns-priority": "10" },
        payload: { aps: { sound: "default" } }
      }
    };

    const response = await admin.messaging().send(payload);
    console.log(`[FCM] Successfully sent message:`, response);

    res.json({ success: true, messageId: response });
  } catch (error) {
    console.error(`[FCM] Error sending message to ${req.body.targetUserId}:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/gozo/register-user', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { name, phone, role, fcmToken } = req.body;
    if (!name || !phone || !role) {
      return res.status(400).json({ success: false, error: 'Missing name, phone, or role' });
    }
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role' });
    }

    const { data, error } = await supabase
      .from('users')
      .upsert(
        {
          name,
          phone,
          role,
          fcm_token: fcmToken ?? null
        },
        { onConflict: 'phone' }
      )
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    const userId = data.id;
    if (fcmToken) {
      tokenStore[userId] = fcmToken;
    }

    res.json({ success: true, userId });
  } catch (error) {
    console.error('[GoZo] register-user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: Format phone numbers to E.164 (India default is +91)
const formatE164 = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return `+${cleaned}`;
  }
  return `+${cleaned}`;
};

// ─── Authentication System (Phone OTP) ───

// Step 1: Login / Request OTP
app.post('/gozo/auth/login', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { phone, expectedRole } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required' });

    // Rate Limiting: Max 3 requests per 10 minutes
    const now = Date.now();
    if (!otpRateLimiter[phone]) {
      otpRateLimiter[phone] = [];
    }
    otpRateLimiter[phone] = otpRateLimiter[phone].filter(ts => now - ts < 10 * 60 * 1000);
    if (otpRateLimiter[phone].length >= 3) {
      const earliest = otpRateLimiter[phone][0];
      const remainingTimeMs = 10 * 60 * 1000 - (now - earliest);
      const remainingMinutes = Math.ceil(remainingTimeMs / (60 * 1000));
      return res.status(429).json({
        success: false,
        error: `Too many OTP requests. Please try again in ${remainingMinutes} minute(s).`
      });
    }

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, name')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;

    if (user) {
      // Role mismatch: driver trying to log in to owner app or vice versa
      if (expectedRole && user.role !== expectedRole) {
        const correctApp = user.role === 'owner' ? 'GoZo Owner App' : 'GoZo Driver App';
        return res.status(403).json({
          success: false,
          error: `This number is registered as a ${user.role}. Please use the ${correctApp} instead.`
        });
      }
    }

    // Trigger SMS OTP via Twilio Verify
    if (!twilioClient) {
      console.warn('[Twilio Verify] SMS bypassed due to missing config. Use 123456 to verify.');
    } else {
      const formattedPhone = formatE164(phone);
      console.log(`[Twilio Verify] Requesting OTP for ${formattedPhone}...`);

      // Fire and forget asynchronously to prevent blocking the HTTP response
      twilioClient.verify.v2
        .services(twilioVerifyServiceSid)
        .verifications.create({ to: formattedPhone, channel: 'sms' })
        .then(() => {
          console.log(`[Twilio Verify] SMS OTP sent successfully to ${formattedPhone}`);
        })
        .catch((err) => {
          console.warn('[Twilio Verify] SMS failed in background, bypassing. Use 123456 to verify. Error:', err.message);
        });
    }

    // Track successful OTP request for rate limiting
    otpRateLimiter[phone].push(now);

    res.json({
      success: true,
      isNewUser: !user,
      role: user ? user.role : null
    });
  } catch (error) {
    console.error('[GoZo] auth-login error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 2: Verify OTP
app.post('/gozo/auth/verify', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { phone, otp, expectedRole } = req.body;
    if (!phone || !otp) return res.status(400).json({ success: false, error: 'Phone and OTP are required' });

    if (otp === '123456') {
      console.log(`[Twilio Verify] BYPASS OTP for ${phone}`);
    } else {
      if (!twilioClient) {
        return res.status(500).json({
          success: false,
          error: 'Twilio SMS service is not configured on the server. Please configure the required environment variables.'
        });
      }

      const formattedPhone = formatE164(phone);
      console.log(`[Twilio Verify] Checking OTP for ${formattedPhone}...`);

      try {
        const check = await twilioClient.verify.v2
          .services(twilioVerifyServiceSid)
          .verificationChecks.create({ to: formattedPhone, code: otp });

        if (check.status !== 'approved') {
          return res.status(401).json({ success: false, error: 'Invalid verification code. Please try again.' });
        }
      } catch (err) {
        console.error('[Twilio Verify] Check error:', err);
        let errorMsg = 'Failed to verify OTP. Please try again.';
        if (err.code === 60202) {
          errorMsg = 'Too many incorrect attempts. Please request a new OTP.';
        } else if (err.code === 20404) {
          errorMsg = 'The verification code has expired. Please request a new OTP.';
        } else if (err.message) {
          errorMsg = err.message;
        }
        return res.status(400).json({ success: false, error: errorMsg });
      }
    }

    // Check if user exists to return their details
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, name')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;

    // Double-check role on verify step too (prevents bypassing login check)
    if (user && expectedRole && user.role !== expectedRole) {
      const correctApp = user.role === 'owner' ? 'GoZo Owner App' : 'GoZo Driver App';
      return res.status(403).json({
        success: false,
        error: `This number is registered as a ${user.role}. Please use the ${correctApp} instead.`
      });
    }

    res.json({ success: true, user: user || null });
  } catch (error) {
    console.error('[GoZo] auth-verify error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Step 3: Signup (New User Registration)
app.post('/gozo/auth/signup', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { phone, name, role, factory_name, factory_address, factory_lat, factory_lng, fcmToken, city } = req.body;

    if (!phone || !name || !role) {
      return res.status(400).json({ success: false, error: 'Phone, name, and role are required' });
    }
    if (!VALID_ROLES.has(role)) {
      return res.status(400).json({ success: false, error: 'Invalid role. Must be owner or transporter.' });
    }

    // Prevent signing up with a phone already registered under a DIFFERENT role
    const { data: existing } = await supabase
      .from('users')
      .select('id, role')
      .eq('phone', phone)
      .maybeSingle();

    if (existing) {
      if (existing.role !== role) {
        const correctApp = existing.role === 'owner' ? 'GoZo Owner App' : 'GoZo Driver App';
        return res.status(409).json({
          success: false,
          error: `This number is already registered as a ${existing.role}. Please use the ${correctApp} instead.`
        });
      }
      return res.status(409).json({ success: false, error: 'Phone number is already registered. Please log in.' });
    }

    // Auto-extract city if not provided
    let finalCity = city || null;
    if (!finalCity && factory_address) {
      const parts = factory_address.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        finalCity = parts[parts.length - 2].replace(/\d+/g, '').trim();
      }
    }

    // Insert user
    const { data, error } = await supabase
      .from('users')
      .insert({
        name,
        phone,
        role,
        fcm_token: fcmToken || null,
        factory_name: factory_name || null,
        factory_address: factory_address || null,
        factory_lat: factory_lat || null,
        factory_lng: factory_lng || null,
        city: finalCity
      })
      .select('id, name, role')
      .single();

    if (error) throw error;

    if (fcmToken) {
      tokenStore[data.id] = fcmToken;
    }

    res.json({ success: true, user: data });
  } catch (error) {
    console.error('[GoZo] auth-signup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const getPredefinedPrice = (rawGoodsType, weightKg, explicitDistance = null) => {
  let goodsType = rawGoodsType;
  let distanceKm = explicitDistance || 5;

  const distMatch = goodsType.match(/_dist_([\d.]+)/);
  if (distMatch) {
    distanceKm = parseFloat(distMatch[1]);
    goodsType = goodsType.replace(distMatch[0], '');
  }

  const isAuto = weightKg <= 500;

  if (isAuto) {
    const basePrice = Math.max(200, Math.round(distanceKm * 45));
    const rangeMin = basePrice;
    const rangeMax = basePrice + 50; // account for potential waiting charges

    return {
      total: basePrice,
      base: basePrice,
      serviceFee: 0,
      estimatedFreight: basePrice,
      driverCut: basePrice,
      rangeMin,
      rangeMax,
    };
  }

  // ─── Distance-based pricing for heavy goods (>500 kg) ───
  // Customer pays ₹50/km, driver receives ₹45/km (90%), platform keeps ₹5/km (10%)
  const RATE_PER_KM = 50;
  const DRIVER_RATE_PER_KM = 45;
  const MIN_FARE = 500;         // minimum customer fare
  const MIN_DRIVER_PAYOUT = 450; // minimum driver payout

  const total = Math.max(MIN_FARE, Math.round(distanceKm * RATE_PER_KM));
  const driverCut = Math.max(MIN_DRIVER_PAYOUT, Math.round(distanceKm * DRIVER_RATE_PER_KM));
  const serviceFee = total - driverCut; // platform commission (₹5/km = 10%)

  const estimatedFreight = driverCut;
  const rangeMin = Math.round(driverCut * 0.9);
  const rangeMax = Math.round(driverCut * 1.1);

  return {
    total,
    base: RATE_PER_KM,
    serviceFee,
    estimatedFreight,
    driverCut,
    rangeMin,
    rangeMax,
  };
};

app.post('/gozo/estimate-price', (req, res) => {
  try {
    const { goodsType, weightKg, distanceKm } = req.body;
    if (!goodsType || !weightKg) {
      return res.status(400).json({ success: false, error: 'Missing goodsType or weightKg' });
    }
    const priceInfo = getPredefinedPrice(goodsType, Number(weightKg), Number(distanceKm || 5));
    res.json({ success: true, estimate: priceInfo });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/gozo/price-preview', (req, res) => {
  try {
    const { weightKg, distanceKm } = req.body;
    const priceInfo = getPredefinedPrice('general', Number(weightKg || 0), Number(distanceKm || 5));
    res.json({
      success: true,
      rangeMin: priceInfo.rangeMin,
      rangeMax: priceInfo.rangeMax,
      driverCut: priceInfo.driverCut
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Driver Online/Offline Status + Location ───
app.post('/gozo/driver-status', async (req, res) => {
  try {
    const { driverId, online, latitude, longitude } = req.body;
    if (!driverId || typeof online !== 'boolean') {
      return res.status(400).json({ success: false, error: 'driverId and online (boolean) are required' });
    }
    const entry = { online, lastSeen: Date.now() };
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      entry.latitude = latitude;
      entry.longitude = longitude;
    } else if (driverStatusStore[driverId]) {
      // Preserve previous location if not sent this time
      entry.latitude = driverStatusStore[driverId].latitude;
      entry.longitude = driverStatusStore[driverId].longitude;
    }
    driverStatusStore[driverId] = entry;
    console.log(`[GoZo] Driver ${driverId} ${online ? 'ONLINE' : 'OFFLINE'} @ (${entry.latitude ?? '?'}, ${entry.longitude ?? '?'})`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: build FCM notification payload for a request
const buildRequestNotification = (transporter, requestRow, goodsType, predefinedPrice, priceInfo) => {
  return admin.messaging().send({
    token: transporter.fcm_token,
    notification: {
      title: '🚛 New GoZo Shipment Request',
      body: `${goodsType} · ${requestRow.weight_kg}kg · ₹${predefinedPrice} · ${requestRow.pickup_address} → ${requestRow.drop_address}`
    },
    data: {
      requestId: requestRow.id,
      type: 'NEW_REQUEST',
      ownerId: requestRow.owner_id,
      pickupAddress: requestRow.pickup_address,
      dropAddress: requestRow.drop_address,
      goodsType: goodsType,
      weightKg: String(requestRow.weight_kg),
      priceInr: String(predefinedPrice),
      basePrice: String(priceInfo.base),
      estimatedFreight: String(priceInfo.estimatedFreight),
      serviceFee: String(priceInfo.serviceFee),
      driverCut: String(priceInfo.driverCut),
      rangeMin: String(priceInfo.rangeMin),
      rangeMax: String(priceInfo.rangeMax)
    },
    android: { priority: 'high' }
  });
};

app.post('/gozo/create-request', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { ownerId, goodsType, weightKg, pickupAddress, dropAddress, distanceKm } = req.body;
    if (!ownerId || !goodsType || !weightKg || !pickupAddress || !dropAddress) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const priceInfo = getPredefinedPrice(goodsType, Number(weightKg), Number(distanceKm || 5));
    const predefinedPrice = priceInfo.total;

    // Encode distance into goods_type to avoid DB schema changes
    const storedGoodsType = distanceKm ? `${goodsType}_dist_${distanceKm}` : goodsType;

    const { data: requestRow, error: requestError } = await supabase
      .from('requests')
      .insert({
        owner_id: ownerId,
        goods_type: storedGoodsType,
        weight_kg: Number(weightKg),
        pickup_address: pickupAddress,
        drop_address: dropAddress
      })
      .select('id, owner_id, goods_type, weight_kg, pickup_address, drop_address')
      .single();

    if (requestError) {
      throw requestError;
    }

    // Send admin notification
    sendAdminFCM(
      '🚗 New Ride Request',
      `New Ride Request — ${pickupAddress} to ${dropAddress}`,
      { type: 'new_ride_request', requestId: requestRow.id }
    );

    const { data: transporters, error: transportersError } = await supabase
      .from('users')
      .select('id, fcm_token')
      .eq('role', 'transporter');

    if (transportersError) {
      throw transportersError;
    }

    const allDrivers = (transporters ?? []).filter((t) => t.fcm_token);

    // Split drivers into online (with location) and offline groups
    const onlineDrivers = allDrivers.filter((d) => {
      const status = driverStatusStore[d.id];
      return status && status.online;
    });
    const offlineDrivers = allDrivers.filter((d) => {
      const status = driverStatusStore[d.id];
      return !status || !status.online;
    });

    let notifiedCount = 0;

    if (admin.apps.length) {
      // ─── Geocode the pickup address to get coordinates ───
      let pickupCoords = null;
      try {
        pickupCoords = await geocodeAddress(pickupAddress);
      } catch (e) {
        console.warn('[GoZo] Could not geocode pickup address:', e.message);
      }

      if (onlineDrivers.length > 0 && pickupCoords) {
        // ─── Sort online drivers by distance to pickup ───
        const driversWithDist = onlineDrivers.map((d) => {
          const status = driverStatusStore[d.id];
          const dist = (status && typeof status.latitude === 'number' && typeof status.longitude === 'number')
            ? haversineKm(pickupCoords.latitude, pickupCoords.longitude, status.latitude, status.longitude)
            : Infinity; // no GPS → put at end
          return { ...d, distKm: dist };
        }).sort((a, b) => a.distKm - b.distKm);

        // ─── Split into batches of BATCH_SIZE ───
        const batches = [];
        for (let i = 0; i < driversWithDist.length; i += BATCH_SIZE) {
          batches.push(driversWithDist.slice(i, i + BATCH_SIZE));
        }

        console.log(`[GoZo] Request ${requestRow.id}: ${onlineDrivers.length} online drivers, ${batches.length} batch(es), ${offlineDrivers.length} offline`);

        // ─── Batch 0: notify immediately ───
        const firstBatch = batches[0];
        const firstResults = await Promise.allSettled(
          firstBatch.map((d) => buildRequestNotification(d, requestRow, goodsType, predefinedPrice, priceInfo))
        );
        notifiedCount = firstResults.filter((r) => r.status === 'fulfilled').length;
        console.log(`[GoZo] Batch 1/${batches.length}: Notified ${notifiedCount} nearest drivers (${firstBatch.map(d => d.distKm.toFixed(1) + 'km').join(', ')})`);

        // ─── Batches 1..N: cascade every BATCH_INTERVAL_MS ───
        pendingCascades[requestRow.id] = [];

        for (let bIdx = 1; bIdx < batches.length; bIdx++) {
          const batch = batches[bIdx];
          const delay = bIdx * BATCH_INTERVAL_MS;
          const tid = setTimeout(async () => {
            try {
              const { data: reqCheck } = await supabase
                .from('requests').select('status').eq('id', requestRow.id).single();
              if (reqCheck && reqCheck.status === 'pending') {
                const batchResults = await Promise.allSettled(
                  batch.map((d) => buildRequestNotification(d, requestRow, goodsType, predefinedPrice, priceInfo))
                );
                const sent = batchResults.filter((r) => r.status === 'fulfilled').length;
                console.log(`[GoZo] Batch ${bIdx + 1}/${batches.length}: Notified ${sent} drivers (${batch.map(d => d.distKm.toFixed(1) + 'km').join(', ')})`);
              } else {
                console.log(`[GoZo] Request ${requestRow.id} already accepted, skipping batch ${bIdx + 1}`);
              }
            } catch (e) {
              console.error(`[GoZo] Cascade batch ${bIdx + 1} error:`, e.message);
            }
          }, delay);
          pendingCascades[requestRow.id].push(tid);
        }

        // ─── Final fallback: offline drivers after all online batches exhausted ───
        if (offlineDrivers.length > 0) {
          const offlineDelay = batches.length * BATCH_INTERVAL_MS;
          const offlineTid = setTimeout(async () => {
            try {
              const { data: reqCheck } = await supabase
                .from('requests').select('status').eq('id', requestRow.id).single();
              if (reqCheck && reqCheck.status === 'pending') {
                const offlineResults = await Promise.allSettled(
                  offlineDrivers.map((d) => buildRequestNotification(d, requestRow, goodsType, predefinedPrice, priceInfo))
                );
                const sent = offlineResults.filter((r) => r.status === 'fulfilled').length;
                console.log(`[GoZo] Offline fallback: Notified ${sent} offline drivers for request ${requestRow.id}`);
              } else {
                console.log(`[GoZo] Request ${requestRow.id} already accepted, skipping offline fallback`);
              }
            } catch (e) {
              console.error(`[GoZo] Offline fallback error:`, e.message);
            } finally {
              cancelCascade(requestRow.id);
            }
          }, offlineDelay);
          pendingCascades[requestRow.id].push(offlineTid);
        }

      } else if (onlineDrivers.length > 0 && !pickupCoords) {
        // ─── Geocode failed — notify all online drivers immediately, then offline fallback ───
        console.log(`[GoZo] Geocode failed for "${pickupAddress}", notifying all ${onlineDrivers.length} online drivers`);
        const results = await Promise.allSettled(
          onlineDrivers.map((d) => buildRequestNotification(d, requestRow, goodsType, predefinedPrice, priceInfo))
        );
        notifiedCount = results.filter((r) => r.status === 'fulfilled').length;

        if (offlineDrivers.length > 0) {
          pendingCascades[requestRow.id] = [];
          const tid = setTimeout(async () => {
            try {
              const { data: reqCheck } = await supabase
                .from('requests').select('status').eq('id', requestRow.id).single();
              if (reqCheck && reqCheck.status === 'pending') {
                const offR = await Promise.allSettled(
                  offlineDrivers.map((d) => buildRequestNotification(d, requestRow, goodsType, predefinedPrice, priceInfo))
                );
                console.log(`[GoZo] Offline fallback (no geocode): Notified ${offR.filter(r => r.status === 'fulfilled').length} drivers`);
              }
            } catch (e) { console.error(e.message); }
            finally { cancelCascade(requestRow.id); }
          }, BATCH_INTERVAL_MS);
          pendingCascades[requestRow.id].push(tid);
        }

      } else {
        // ─── No online drivers — notify everyone immediately ───
        const results = await Promise.allSettled(
          allDrivers.map((d) => buildRequestNotification(d, requestRow, goodsType, predefinedPrice, priceInfo))
        );
        notifiedCount = results.filter((r) => r.status === 'fulfilled').length;
        console.log(`[GoZo] No online drivers — notified ALL ${notifiedCount} drivers for request ${requestRow.id}`);
      }
    }

    res.json({ success: true, requestId: requestRow.id, notifiedCount, priceInr: predefinedPrice });
  } catch (error) {
    console.error('[GoZo] create-request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/gozo/accept-request', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId, transporterId } = req.body;
    if (!requestId || !transporterId) {
      return res.status(400).json({ success: false, error: 'Missing requestId or transporterId' });
    }

    // Fetch the request to verify it exists and is still pending
    const { data: requestRow, error: requestLookupError } = await supabase
      .from('requests')
      .select('id, owner_id, goods_type, weight_kg, status')
      .eq('id', requestId)
      .single();

    if (requestLookupError) {
      throw requestLookupError;
    }

    if (requestRow.status !== 'pending') {
      return res.status(409).json({ success: false, error: 'Request is no longer available' });
    }

    // Calculate the predefined price for consistency
    const acceptedPrice = getPredefinedPrice(requestRow.goods_type, requestRow.weight_kg).total;

    // Fetch transporter details for driver info
    const { data: transporterRow, error: transporterError } = await supabase
      .from('users')
      .select('name, phone')
      .eq('id', transporterId)
      .single();

    if (transporterError) {
      console.warn('[GoZo] Could not fetch transporter details:', transporterError.message);
    }

    const driverName = transporterRow?.name ?? 'Driver';
    const driverPhone = transporterRow?.phone ?? '';
    const driverVehicle = 'PB-10-AB-1234'; // Placeholder vehicle number

    // Update the request: mark matched, assign transporter, price, and driver info
    const { error: updateError } = await supabase
      .from('requests')
      .update({
        status: 'matched',
        transporter_id: transporterId,
        accepted_price: acceptedPrice,
        driver_name: driverName,
        driver_phone: driverPhone,
        driver_vehicle: driverVehicle
      })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    // Cancel all pending cascade/offline timers for this request
    cancelCascade(requestId);

    // Notify the owner that a transporter accepted their shipment
    const { data: ownerRow, error: ownerError } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', requestRow.owner_id)
      .single();

    if (ownerError) {
      throw ownerError;
    }

    if (admin.apps.length && ownerRow?.fcm_token) {
      await admin.messaging().send({
        token: ownerRow.fcm_token,
        notification: {
          title: '✅ Shipment Accepted!',
          body: `${driverName} accepted your shipment at ₹${acceptedPrice}`
        },
        data: {
          requestId: requestRow.id,
          transporterId: transporterId,
          type: 'REQUEST_ACCEPTED',
          priceInr: String(acceptedPrice),
          driverName: driverName,
          driverPhone: driverPhone,
          driverVehicle: driverVehicle
        },
        android: { priority: 'high' }
      });
    }

    res.json({ success: true, acceptedPrice, driverName, driverPhone, driverVehicle });
  } catch (error) {
    console.error('[GoZo] accept-request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/gozo/decline-request', async (req, res) => {
  try {
    const { requestId, transporterId } = req.body;
    if (!requestId || !transporterId) {
      return res.status(400).json({ success: false, error: 'Missing requestId or transporterId' });
    }

    console.log(`[GoZo] Request declined. requestId=${requestId} transporterId=${transporterId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[GoZo] decline-request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/gozo/cancel-request', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'Missing requestId' });
    }

    const { data: requestRow, error: lookupError } = await supabase
      .from('requests')
      .select('status, transporter_id')
      .eq('id', requestId)
      .single();

    if (lookupError) {
      throw lookupError;
    }

    if (requestRow.status === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a completed trip' });
    }

    if (requestRow.status === 'cancelled') {
      return res.json({ success: true, message: 'Request already cancelled' });
    }

    const originalStatus = requestRow.status;

    const { error: updateError } = await supabase
      .from('requests')
      .update({ status: 'cancelled' })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    sendAdminFCM(
      '❌ Ride Unassigned',
      `Ride Unassigned — Ride was cancelled and needs a driver`,
      { type: 'ride_unassigned', requestId }
    );

    cancelCascade(requestId);

    if (originalStatus === 'matched' && requestRow.transporter_id) {
      const { data: driverRow } = await supabase
        .from('users')
        .select('fcm_token')
        .eq('id', requestRow.transporter_id)
        .single();

      if (driverRow?.fcm_token && admin.apps.length) {
        try {
          await admin.messaging().send({
            token: driverRow.fcm_token,
            notification: {
              title: '❌ Shipment Cancelled',
              body: `The shipment request has been cancelled by the customer.`
            },
            data: {
              requestId: requestId,
              type: 'REQUEST_CANCELLED'
            },
            android: { priority: 'high' }
          });
          console.log(`[GoZo] Sent REQUEST_CANCELLED FCM notification to driver ${requestRow.transporter_id}`);
        } catch (fcmErr) {
          console.error('[GoZo] Failed to send cancel notification to driver:', fcmErr.message);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[GoZo] cancel-request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fetch user profile details
app.get('/gozo/user/:userId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }
    const { userId } = req.params;
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, phone, role, factory_name, factory_address')
      .eq('id', userId)
      .single();

    if (error) {
      throw error;
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('[GoZo] fetch user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/gozo/requests/:ownerId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { ownerId } = req.params;

    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false });

    if (requestsError) {
      throw requestsError;
    }

    res.json({ success: true, requests: requests ?? [] });
  } catch (error) {
    console.error('[GoZo] get owner requests error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/gozo/active-requests', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { data, error } = await supabase
      .from('requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const requestsWithPrices = (data ?? []).map(request => {
      const priceInfo = getPredefinedPrice(request.goods_type, request.weight_kg);
      return {
        ...request,
        price_inr: priceInfo.total,
        base_price: priceInfo.base,
        estimated_freight: priceInfo.estimatedFreight,
        service_fee: priceInfo.serviceFee,
        driver_cut: priceInfo.driverCut,
        range_min: priceInfo.rangeMin,
        range_max: priceInfo.rangeMax,
      };
    });

    res.json({ success: true, requests: requestsWithPrices });
  } catch (error) {
    console.error('[GoZo] active-requests error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Transport Companies (from Supabase DB) ───
app.get('/gozo/transport-companies', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { owner_id } = req.query;
    let dbQuery = supabase.from('transport_companies').select('*');
    if (owner_id) {
      dbQuery = dbQuery.or(`owner_id.is.null,owner_id.eq.${owner_id}`);
    } else {
      dbQuery = dbQuery.is('owner_id', null);
    }
    const { data, error } = await dbQuery.order('created_at', { ascending: true });
    if (error) throw error;
    // Map DB snake_case to camelCase for app compatibility
    const companies = (data || []).map(c => ({
      id: c.id, name: c.name, location: c.location,
      ratePerKg: Number(c.rate_per_kg) || 0,
      rateDisplay: c.rate_display || '',
      rating: Number(c.rating) || 0,
      totalRatings: c.total_ratings || 0,
      routes: c.routes || [],
      depotAddress: c.depot_address || '',
      description: c.description || '',
      established: c.established || '',
      contactPhone: c.contact_phone || '',
      experience: c.experience || '',
      deliveryTime: c.delivery_time || '',
      additionalInfo: c.additional_info || '',
    }));
    res.json({ success: true, companies });
  } catch (error) {
    console.error('[GoZo] transport-companies error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Static Indian state to cities lookup ───
const STATE_CITY_MAP = {
  'West Bengal': ['Kolkata', 'Siliguri', 'Darjeeling', 'Cooch Behar', 'Jaigaon', 'Dinhata'],
  'Maharashtra': ['Mumbai', 'Pune', 'Nagpur'],
  'Karnataka': ['Bangalore', 'Mysore', 'Hubli'],
  'Punjab': [
    'Amritsar', 'Ajnala', 'Batala', 'Gurdaspur', 'Pathankot', 'Hoshiarpur',
    'Jalandhar', 'Phagwara', 'Nakodar', 'Kapurthala', 'Sultanpur Lodhi',
    'Nawanshahr', 'Balachaur', 'Ludhiana', 'Doraha', 'Khanna', 'Samrala',
    'Mandi Gobindgarh', 'Sirhind', 'Rajpura', 'Patiala', 'Nabha',
    'Malerkotla', 'Ahmedgarh', 'Barnala', 'Sangrur', 'Sunam', 'Lehragaga',
    'Dhuri', 'Raikot', 'Jagraon', 'Moga', 'Kotkapura', 'Faridkot',
    'Ferozepur', 'Fazilka', 'Zira', 'Jalalabad', 'Muktsar', 'Abohar',
    'Tarn Taran', 'Patti', 'Khemkaran', 'Dasuya', 'Mukerian'
  ],
  'Haryana': ['Ambala', 'Ambala City', 'Ambala Cantt', 'Shahbad', 'Kurukshetra', 'Karnal', 'Panipat', 'Sonipat'],
  'Jammu & Kashmir': ['Jammu', 'Kathua', 'Samba', 'Dori Brahmana', 'Vijaypur'],
  'Delhi': ['Delhi'],
  'Himachal Pradesh': ['Baddi', 'Damtal'],
  'Assam': ['Guwahati', 'Shillong', 'Jorhat', 'Dibrugarh', 'Tinsukia', 'Silchar', 'Karimganj', 'Agartala', 'Lalabazar', 'Aizawl', 'Hailakandi', 'Dharmanagar', 'Imphal', 'Dimapur', 'Nagaon', 'Lanka', 'Gola Ghat', 'Hojai'],
  'Bihar': ['Patna Jn', 'Patna City', 'Gaya', 'Siwan', 'Chapra', 'Muzaffarpur', 'Darbhanga', 'Sitamarhi', 'Samastipur', 'Raxaul', 'Purnea', 'Forbesganj', 'Katihar', 'Jogbani', 'Bhagalpur', 'Araria'],
  'Odisha': ['Cuttack', 'Bhubaneswar', 'Puri', 'Sambalpur', 'Rourkela', 'Berhampur', 'Jharsuguda'],
  'Jharkhand': ['Ranchi', 'Dhanbad', 'Jamshedpur', 'Tatanagar', 'Asansol', 'Chas', 'Giridih']
};

// ─── Levenshtein distance for fuzzy matching ───
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function cleanForFuzzy(s) {
  return s.toLowerCase().trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function isFuzzyMatch(str1, str2) {
  if (!str1 || !str2) return false;
  const s1 = cleanForFuzzy(str1);
  const s2 = cleanForFuzzy(str2);
  if (s1 === s2) return true;
  if (s1.includes(s2) || s2.includes(s1)) return true;
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen <= 3) return false;
  const dist = levenshteinDistance(s1, s2);
  const maxAllowed = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;
  return dist <= maxAllowed;
}

// ─── Static detailed routes (fallback when DB column missing) ───
const DETAILED_ROUTES_V2 = {
  'tc-001': [
    { state: 'West Bengal', cities: [{ name: 'Kolkata' }], price_min: 4, price_max: 8, delivery_days_min: 5, delivery_days_max: 7 },
  ],
  'tc-002': [
    { state: 'Maharashtra', cities: [{ name: 'Mumbai' }, { name: 'Pune' }, { name: 'Nagpur' }], price_min: 5, price_max: 7, delivery_days_min: 5, delivery_days_max: 6 },
    { state: 'Karnataka', cities: [{ name: 'Bangalore' }, { name: 'Mysore' }, { name: 'Hubli' }], price_min: 5, price_max: 7, delivery_days_min: 5, delivery_days_max: 6 },
  ],
  'tc-003': [
    {
      state: 'Punjab',
      cities: [
        { name: 'Amritsar', price_min: 2, price_max: 3, delivery_days_min: 1, delivery_days_max: 2 },
        { name: 'Ajnala' }, { name: 'Batala' }, { name: 'Gurdaspur' },
        { name: 'Pathankot', price_min: 2, price_max: 3 },
        { name: 'Hoshiarpur' }, { name: 'Jalandhar', price_min: 2, price_max: 3, delivery_days_min: 1, delivery_days_max: 1 },
        { name: 'Phagwara' }, { name: 'Nakodar' }, { name: 'Kapurthala' },
        { name: 'Sultanpur Lodhi' }, { name: 'Nawanshahr' }, { name: 'Balachaur' },
        { name: 'Ludhiana', price_min: 2, price_max: 2.5, delivery_days_min: 1, delivery_days_max: 1 },
        { name: 'Doraha' }, { name: 'Khanna' }, { name: 'Samrala' },
        { name: 'Mandi Gobindgarh' }, { name: 'Sirhind' }, { name: 'Rajpura' },
        { name: 'Patiala', price_min: 2, price_max: 3 },
        { name: 'Nabha' }, { name: 'Malerkotla' }, { name: 'Ahmedgarh' },
        { name: 'Barnala' }, { name: 'Sangrur' }, { name: 'Sunam' },
        { name: 'Lehragaga' }, { name: 'Dhuri' }, { name: 'Raikot' },
        { name: 'Jagraon' }, { name: 'Moga' }, { name: 'Kotkapura' },
        { name: 'Faridkot' }, { name: 'Ferozepur' }, { name: 'Fazilka' },
        { name: 'Zira' }, { name: 'Jalalabad' }, { name: 'Muktsar' },
        { name: 'Abohar' }, { name: 'Tarn Taran' }, { name: 'Patti' },
        { name: 'Khemkaran' }, { name: 'Dasuya' }, { name: 'Mukerian' },
      ],
      price_min: 2, price_max: 4, delivery_days_min: 1, delivery_days_max: 2,
    },
    { state: 'Haryana', cities: [{ name: 'Ambala' }, { name: 'Ambala City' }, { name: 'Ambala Cantt' }, { name: 'Shahbad' }, { name: 'Kurukshetra' }, { name: 'Karnal' }, { name: 'Panipat' }, { name: 'Sonipat' }], price_min: 2, price_max: 4, delivery_days_min: 1, delivery_days_max: 2 },
    { state: 'Jammu & Kashmir', cities: [{ name: 'Jammu' }, { name: 'Kathua' }, { name: 'Samba' }, { name: 'Dori Brahmana' }, { name: 'Vijaypur' }], price_min: 3, price_max: 4, delivery_days_min: 2, delivery_days_max: 3 },
    { state: 'Delhi', cities: [{ name: 'Delhi', price_min: 2.5, price_max: 3.5, delivery_days_min: 1, delivery_days_max: 2 }], price_min: 2.5, price_max: 3.5, delivery_days_min: 1, delivery_days_max: 2 },
    { state: 'Himachal Pradesh', cities: [{ name: 'Baddi' }, { name: 'Damtal' }], price_min: 3, price_max: 4, delivery_days_min: 2, delivery_days_max: 3 },
  ],
  'tc-004': [
    { state: 'Assam', cities: [{ name: 'Guwahati' }, { name: 'Shillong' }, { name: 'Jorhat' }, { name: 'Dibrugarh' }, { name: 'Tinsukia' }, { name: 'Silchar' }, { name: 'Karimganj' }, { name: 'Agartala' }, { name: 'Lalabazar' }, { name: 'Aizawl' }, { name: 'Hailakandi' }, { name: 'Dharmanagar' }, { name: 'Imphal' }, { name: 'Dimapur' }, { name: 'Nagaon' }, { name: 'Lanka' }, { name: 'Gola Ghat' }, { name: 'Hojai' }], price_min: 2, price_max: 3, delivery_days_min: 10, delivery_days_max: 20 },
    { state: 'Bihar', cities: [{ name: 'Patna Jn' }, { name: 'Patna City' }, { name: 'Gaya' }, { name: 'Siwan' }, { name: 'Chapra' }, { name: 'Muzaffarpur' }, { name: 'Darbhanga' }, { name: 'Sitamarhi' }, { name: 'Samastipur' }, { name: 'Raxaul' }, { name: 'Purnea' }, { name: 'Forbesganj' }, { name: 'Katihar' }, { name: 'Jogbani' }, { name: 'Bhagalpur' }, { name: 'Araria' }], price_min: 2, price_max: 3, delivery_days_min: 7, delivery_days_max: 14 },
    { state: 'West Bengal', cities: [{ name: 'Kolkata' }, { name: 'Siliguri' }, { name: 'Darjeeling' }, { name: 'Cooch Behar' }, { name: 'Jaigaon' }, { name: 'Dinhata' }], price_min: 2, price_max: 3, delivery_days_min: 7, delivery_days_max: 12 },
    { state: 'Odisha', cities: [{ name: 'Cuttack' }, { name: 'Bhubaneswar' }, { name: 'Puri' }, { name: 'Sambalpur' }, { name: 'Rourkela' }, { name: 'Berhampur' }, { name: 'Jharsuguda' }], price_min: 2, price_max: 3, delivery_days_min: 10, delivery_days_max: 15 },
    { state: 'Jharkhand', cities: [{ name: 'Ranchi' }, { name: 'Dhanbad' }, { name: 'Jamshedpur' }, { name: 'Tatanagar' }, { name: 'Asansol' }, { name: 'Chas' }, { name: 'Giridih' }], price_min: 2, price_max: 3, delivery_days_min: 7, delivery_days_max: 12 },
  ],
};

function cityToState(cityName) {
  if (!cityName) return null;
  const lowerCity = cityName.trim().toLowerCase();
  for (const [state, cities] of Object.entries(STATE_CITY_MAP)) {
    if (cities.some(c => c.toLowerCase() === lowerCity)) {
      return state;
    }
  }
  return null;
}

// Fuzzy version: also catches spelling mistakes
function cityToStateFuzzy(cityName) {
  if (!cityName) return null;
  for (const [state, cities] of Object.entries(STATE_CITY_MAP)) {
    if (cities.some(c => isFuzzyMatch(c, cityName))) {
      return state;
    }
  }
  return null;
}

// ─── Search Destinations Autocomplete ───
app.get('/gozo/transport-companies/destinations', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { data: companies, error } = await supabase
      .from('transport_companies')
      .select('routes_v2');

    if (error) throw error;

    const destinationsMap = new Map();

    // Populate from static map
    for (const [stateName, cities] of Object.entries(STATE_CITY_MAP)) {
      destinationsMap.set(`${stateName}_state`, { name: stateName, type: 'state', state: stateName });
      for (const cityName of cities) {
        destinationsMap.set(`${cityName}_city`, { name: cityName, type: 'city', state: stateName });
      }
    }

    // Populate dynamic entries from DB
    if (companies) {
      for (const c of companies) {
        const routes = c.routes_v2 || [];
        for (const r of routes) {
          if (r.state) {
            const stateName = r.state.trim();
            if (!destinationsMap.has(`${stateName}_state`)) {
              destinationsMap.set(`${stateName}_state`, { name: stateName, type: 'state', state: stateName });
            }
            if (r.cities) {
              for (const city of r.cities) {
                if (city.name) {
                  const cityName = city.name.trim();
                  if (!destinationsMap.has(`${cityName}_city`)) {
                    destinationsMap.set(`${cityName}_city`, { name: cityName, type: 'city', state: stateName });
                  }
                }
              }
            }
          }
        }
      }
    }

    const destinations = Array.from(destinationsMap.values());
    destinations.sort((a, b) => a.name.localeCompare(b.name));

    res.json({ success: true, destinations });
  } catch (error) {
    console.error('[GoZo] Destinations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Search Transport Companies ───
app.get('/gozo/transport-companies/search', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { destination, pickup_city, owner_id } = req.query;
    if (!destination) {
      return res.status(400).json({ success: false, error: 'Destination is required' });
    }

    const destTrimmed = destination.trim();

    let dbQuery = supabase.from('transport_companies').select('*');
    if (owner_id) {
      dbQuery = dbQuery.or(`owner_id.is.null,owner_id.eq.${owner_id}`);
    } else {
      dbQuery = dbQuery.is('owner_id', null);
    }
    const { data: rawCompanies, error } = await dbQuery.order('created_at', { ascending: true });

    if (error) throw error;

    // Resolve destination to state/city using fuzzy matching
    const matchedStateName = Object.keys(STATE_CITY_MAP).find(s => isFuzzyMatch(s, destTrimmed));
    let matchedCityName = null;
    let resolvedStateName = null;
    if (!matchedStateName) {
      for (const [state, cities] of Object.entries(STATE_CITY_MAP)) {
        const found = cities.find(c => isFuzzyMatch(c, destTrimmed));
        if (found) {
          matchedCityName = found;
          resolvedStateName = state;
          break;
        }
      }
    }

    const results = [];

    for (const c of rawCompanies) {
      // ── Filter by pickup_city if provided ──
      if (pickup_city) {
        const pickupLower = pickup_city.trim().toLowerCase();
        const locWords = c.location.toLowerCase().split(/[\s,]+/).filter(Boolean);
        const pickupWords = pickupLower.split(/[\s,]+/).filter(Boolean);
        const pickupMatches = locWords.some(lw => pickupWords.some(pw => isFuzzyMatch(lw, pw)));
        if (!pickupMatches) continue;
      }

      // ── Get routes: prefer DB column, fallback to static data ──
      const routesV2 = (c.routes_v2 && c.routes_v2.length > 0) ? c.routes_v2 : (DETAILED_ROUTES_V2[c.id] || []);
      let matchType = null;
      let matchedRoute = null;
      let matchedCity = null;

      if (matchedStateName) {
        // User searched for a state name (e.g. "Jammu & Kashmir", "jammu and kasmir")
        matchedRoute = routesV2.find(r => isFuzzyMatch(r.state, matchedStateName));
        if (matchedRoute) matchType = 'state';
      } else if (resolvedStateName && matchedCityName) {
        // User searched for a city name (e.g. "Jammu", "Kolkata")
        matchedRoute = routesV2.find(r => isFuzzyMatch(r.state, resolvedStateName));
        if (matchedRoute) {
          matchedCity = matchedRoute.cities?.find(ct => isFuzzyMatch(ct.name, matchedCityName));
          matchType = matchedCity ? 'city' : 'state';
        }
      } else {
        // Freeform search — fuzzy match against all routes and cities
        for (const r of routesV2) {
          if (isFuzzyMatch(r.state, destTrimmed)) {
            matchedRoute = r;
            matchType = 'state';
            break;
          }
          const cityHit = r.cities?.find(ct => isFuzzyMatch(ct.name, destTrimmed));
          if (cityHit) {
            matchedRoute = r;
            matchedCity = cityHit;
            matchType = 'city';
            break;
          }
        }
      }

      if (matchType) {
        const price_min = (matchedCity && matchedCity.price_min != null) ? matchedCity.price_min
                          : (matchedRoute && matchedRoute.price_min != null) ? matchedRoute.price_min
                          : Number(c.rate_per_kg) || 0;

        const price_max = (matchedCity && matchedCity.price_max != null) ? matchedCity.price_max
                          : (matchedRoute && matchedRoute.price_max != null) ? matchedRoute.price_max
                          : Number(c.rate_per_kg) || 0;

        let parsed_min = 1;
        let parsed_max = 7;
        if (c.delivery_time) {
          const matches = c.delivery_time.match(/\d+/g);
          if (matches && matches.length > 0) {
            const vals = matches.map(v => parseInt(v, 10));
            parsed_min = Math.min(...vals);
            parsed_max = Math.max(...vals);
          }
        }

        const delivery_days_min = (matchedCity && matchedCity.delivery_days_min != null) ? matchedCity.delivery_days_min
                                  : (matchedRoute && matchedRoute.delivery_days_min != null) ? matchedRoute.delivery_days_min
                                  : parsed_min;

        const delivery_days_max = (matchedCity && matchedCity.delivery_days_max != null) ? matchedCity.delivery_days_max
                                  : (matchedRoute && matchedRoute.delivery_days_max != null) ? matchedRoute.delivery_days_max
                                  : parsed_max;

        results.push({
          id: c.id,
          name: c.name,
          location: c.location,
          ratePerKg: Number(c.rate_per_kg) || 0,
          rating: Number(c.rating) || 0,
          totalRatings: c.total_ratings || 0,
          depotAddress: c.depot_address || '',
          description: c.description || '',
          established: c.established || '',
          contactPhone: c.contact_phone || '',
          experience: c.experience || '',
          additionalInfo: c.additional_info || '',
          deliveryTime: c.delivery_time || '',
          routes: c.routes || [],
          routes_v2: routesV2,
          images: c.images || [],
          matchType,
          priceMin: price_min,
          priceMax: price_max,
          deliveryDaysMin: delivery_days_min,
          deliveryDaysMax: delivery_days_max
        });
      }
    }

    // Sort: exact city matches first, then state matches, then alphabetical
    results.sort((a, b) => {
      if (a.matchType === b.matchType) {
        return a.name.localeCompare(b.name);
      }
      return a.matchType === 'city' ? -1 : 1;
    });

    res.json({ success: true, companies: results });
  } catch (error) {
    console.error('[GoZo] Search error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Add Custom/Private Transport Company ───
app.post('/gozo/transport-companies/custom', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { owner_id, name, depot_address, contact_phone, destination, delivery_time, rate_per_kg } = req.body;
    if (!owner_id || !name) {
      return res.status(400).json({ success: false, error: 'Owner ID and Name are required' });
    }

    const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    let routes = [];
    let routes_v2 = [];
    let location = '';

    if (destination) {
      const destTrimmed = destination.trim();
      routes = [destTrimmed];
      
      const matchedStateName = Object.keys(STATE_CITY_MAP).find(s => isFuzzyMatch(s, destTrimmed));
      let matchedCityName = null;
      let resolvedStateName = null;
      if (!matchedStateName) {
        for (const [state, cities] of Object.entries(STATE_CITY_MAP)) {
          const found = cities.find(c => isFuzzyMatch(c, destTrimmed));
          if (found) {
            matchedCityName = found;
            resolvedStateName = state;
            break;
          }
        }
      }

      if (matchedStateName) {
        routes_v2 = [{ state: matchedStateName, cities: [], price_min: rate_per_kg || 0, price_max: rate_per_kg || 0 }];
        location = matchedStateName;
      } else if (resolvedStateName && matchedCityName) {
        routes_v2 = [{
          state: resolvedStateName,
          cities: [{ name: matchedCityName, price_min: rate_per_kg || 0, price_max: rate_per_kg || 0 }],
          price_min: rate_per_kg || 0,
          price_max: rate_per_kg || 0
        }];
        location = `${resolvedStateName} (${matchedCityName})`;
      } else {
        routes_v2 = [{ state: destTrimmed, cities: [{ name: destTrimmed }], price_min: rate_per_kg || 0, price_max: rate_per_kg || 0 }];
        location = destTrimmed;
      }
    }

    const newCompany = {
      id,
      name,
      location: location || 'Custom Location',
      rate_per_kg: rate_per_kg || 0,
      rate_display: rate_per_kg ? `${rate_per_kg}` : '',
      rating: 5.0,
      total_ratings: 1,
      routes,
      routes_v2,
      depot_address: depot_address || '',
      description: 'Self-added custom transporter',
      established: new Date().getFullYear().toString(),
      contact_phone: contact_phone || '',
      experience: '1',
      delivery_time: delivery_time || '2-5 days',
      additional_info: 'Custom user-added transporter',
      owner_id
    };

    const { error } = await supabase.from('transport_companies').insert(newCompany);
    if (error) throw error;

    res.json({ success: true, company: newCompany });
  } catch (error) {
    console.error('[GoZo] Create custom company error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/gozo/company-images/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Missing companyId' });
    }

    // Check DB first
    try {
      const { data: dbComp } = await supabase
        .from('transport_companies')
        .select('images')
        .eq('id', companyId)
        .maybeSingle();

      if (dbComp && dbComp.images && dbComp.images.length > 0) {
        return res.json({ success: true, images: dbComp.images });
      }
    } catch (err) {
      console.warn('[GoZo] Failed to fetch company images from DB column:', err.message);
    }

    const fallbackImages = {
      'tc-001': [
        'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80'
      ],
      'tc-002': [
        'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1519003722824-192d992a6058?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
      ],
      'tc-003': [
        'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1519003722824-192d992a6058?auto=format&fit=crop&w=800&q=80'
      ],
      'tc-004': [
        'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80'
      ],
      'tc-005': [
        'https://images.unsplash.com/photo-1519003722824-192d992a6058?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80'
      ],
      'tc-006': [
        'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=800&q=80'
      ],
    };

    const defaults = fallbackImages[companyId] || [
      'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
    ];

    if (!supabase) {
      return res.json({ success: true, images: defaults });
    }

    const { data, error } = await supabase.storage
      .from('company-images')
      .list(companyId);

    if (error) {
      console.warn(`[Supabase Storage] Error listing folder ${companyId}:`, error.message);
      return res.json({ success: true, images: defaults });
    }

    if (!data || data.length === 0) {
      return res.json({ success: true, images: defaults });
    }

    const validFiles = data.filter(f => f.name !== '.emptyFolderPlaceholder' && !f.name.startsWith('.'));

    if (validFiles.length === 0) {
      return res.json({ success: true, images: defaults });
    }

    const imageUrls = validFiles.map(file => {
      const { data: urlData } = supabase.storage
        .from('company-images')
        .getPublicUrl(`${companyId}/${file.name}`);
      return urlData.publicUrl;
    });

    return res.json({ success: true, images: imageUrls });
  } catch (err) {
    console.error('Error fetching company images:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Goods Responsibility Certificate ───
const generateCertificateId = () => {
  const now = new Date();
  // Format date as YYYYMMDD in IST
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  // 6-char alphanumeric
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `GZC-${dateStr}-${code}`;
};

// Internal function to generate a goods certificate for a trip
const generateGoodsCertificate = async (tripId) => {
  if (!supabase) {
    console.warn('[GoZo Certificate] Supabase not configured, skipping certificate generation');
    return null;
  }

  // Check if certificate already exists
  const { data: existing } = await supabase
    .from('goods_certificates')
    .select('id, certificate_id')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (existing) {
    console.log(`[GoZo Certificate] Certificate already exists for trip ${tripId}: ${existing.certificate_id}`);
    return existing;
  }

  // Fetch request details
  const { data: requestRow, error: reqErr } = await supabase
    .from('requests')
    .select('id, owner_id, goods_type, weight_kg, pickup_address, drop_address, driver_name, driver_vehicle')
    .eq('id', tripId)
    .single();

  if (reqErr || !requestRow) {
    console.error('[GoZo Certificate] Failed to fetch request:', reqErr?.message);
    return null;
  }

  // Fetch owner details
  const { data: ownerRow, error: ownerErr } = await supabase
    .from('users')
    .select('name, factory_name, fcm_token')
    .eq('id', requestRow.owner_id)
    .single();

  if (ownerErr || !ownerRow) {
    console.error('[GoZo Certificate] Failed to fetch owner:', ownerErr?.message);
    return null;
  }

  // Clean up goods_type (strip encoded distance)
  let goodsDesc = requestRow.goods_type || 'General Goods';
  const distMatch = goodsDesc.match(/_dist_[\d.]+/);
  if (distMatch) goodsDesc = goodsDesc.replace(distMatch[0], '');

  const pickupTimestamp = new Date().toISOString();
  const certId = generateCertificateId();

  const certData = {
    certificate_id: certId,
    trip_id: tripId,
    factory_name: ownerRow.factory_name || ownerRow.name,
    factory_owner_name: ownerRow.name,
    driver_name: requestRow.driver_name || 'Driver',
    vehicle_number: requestRow.driver_vehicle || 'N/A',
    goods_description: `${goodsDesc} (${requestRow.weight_kg} kg)`,
    pickup_location: requestRow.pickup_address,
    drop_location: requestRow.drop_address,
    pickup_timestamp: pickupTimestamp,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('goods_certificates')
    .insert(certData)
    .select()
    .single();

  if (insertErr) {
    // Handle unique constraint violation (race condition)
    if (insertErr.code === '23505') {
      console.log(`[GoZo Certificate] Certificate already exists (race condition) for trip ${tripId}`);
      const { data: reFetch } = await supabase
        .from('goods_certificates')
        .select('*')
        .eq('trip_id', tripId)
        .single();
      return reFetch;
    }
    console.error('[GoZo Certificate] Insert error:', insertErr.message);
    return null;
  }

  console.log(`[GoZo Certificate] Generated ${certId} for trip ${tripId}`);

  // Send FCM notification to factory owner
  if (admin.apps.length && ownerRow.fcm_token) {
    try {
      await admin.messaging().send({
        token: ownerRow.fcm_token,
        notification: {
          title: '📋 Goods Certificate Issued',
          body: 'Your Goods Responsibility Certificate has been issued by GoZo. Tap to view.'
        },
        data: {
          type: 'CERTIFICATE_ISSUED',
          tripId: tripId,
          certificateId: certId
        },
        android: { priority: 'high' }
      });
      console.log(`[GoZo Certificate] FCM notification sent to owner for trip ${tripId}`);
    } catch (fcmErr) {
      console.error('[GoZo Certificate] FCM send error:', fcmErr.message);
    }
  }

  return inserted;
};

// ─── Trip Status Updates ───
const VALID_TRIP_STATUSES = ['picked_up', 'on_the_way', 'completed'];

app.post('/gozo/update-trip-status', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId, transporterId, status } = req.body;
    if (!requestId || !transporterId || !status) {
      return res.status(400).json({ success: false, error: 'Missing requestId, transporterId, or status' });
    }

    if (!VALID_TRIP_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_TRIP_STATUSES.join(', ')}` });
    }

    // Verify the request belongs to this transporter
    const { data: requestRow, error: requestLookupError } = await supabase
      .from('requests')
      .select('id, owner_id, transporter_id, status, goods_type, weight_kg')
      .eq('id', requestId)
      .single();

    if (requestLookupError) {
      throw requestLookupError;
    }

    if (requestRow.transporter_id !== transporterId) {
      return res.status(403).json({ success: false, error: 'This request is not assigned to you' });
    }

    // Update the status
    const { error: updateError } = await supabase
      .from('requests')
      .update({ status })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    // Build notification based on status
    const statusMessages = {
      picked_up: { title: '📦 Goods Picked Up', body: 'Driver has picked up your goods!' },
      on_the_way: { title: '🚛 On the Way', body: 'Your goods are on the way to the destination!' },
      completed: { title: '✅ Delivery Completed', body: 'Your goods have been delivered successfully!' },
    };

    const notifInfo = statusMessages[status];

    // Notify the owner
    const { data: ownerRow, error: ownerError } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', requestRow.owner_id)
      .single();

    if (!ownerError && admin.apps.length && ownerRow?.fcm_token) {
      await admin.messaging().send({
        token: ownerRow.fcm_token,
        notification: notifInfo,
        data: {
          requestId: requestRow.id,
          type: 'TRIP_STATUS_UPDATE',
          status: status
        },
        android: { priority: 'high' }
      });
    }

    // Auto-generate Goods Responsibility Certificate on pickup
    if (status === 'picked_up') {
      try {
        const cert = await generateGoodsCertificate(requestId);
        if (cert) {
          console.log(`[GoZo] Goods certificate auto-generated for trip ${requestId}: ${cert.certificate_id}`);
        }
      } catch (certErr) {
        console.error('[GoZo] Certificate generation failed (non-blocking):', certErr.message);
      }
    }

    console.log(`[GoZo] Trip status updated: requestId=${requestId} status=${status}`);
    res.json({ success: true, status });
  } catch (error) {
    console.error('[GoZo] update-trip-status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Certificate Endpoints ───
app.post('/gozo/trips/:tripId/generate-certificate', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ success: false, error: 'Missing tripId' });

    const cert = await generateGoodsCertificate(tripId);
    if (!cert) {
      return res.status(500).json({ success: false, error: 'Failed to generate certificate' });
    }
    res.json({ success: true, certificate: cert });
  } catch (error) {
    console.error('[GoZo] generate-certificate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/gozo/trips/:tripId/certificate', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { tripId } = req.params;
    if (!tripId) return res.status(400).json({ success: false, error: 'Missing tripId' });

    const { data: cert, error } = await supabase
      .from('goods_certificates')
      .select('*')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (error) throw error;
    if (!cert) return res.status(404).json({ success: false, error: 'No certificate found for this trip' });

    res.json({ success: true, certificate: cert });
  } catch (error) {
    console.error('[GoZo] fetch-certificate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Rate Trip ───
app.post('/gozo/rate-trip', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId, rating } = req.body;
    if (!requestId || !rating) {
      return res.status(400).json({ success: false, error: 'Missing requestId or rating' });
    }

    const ratingNum = Number(rating);
    if (ratingNum < 1 || ratingNum > 5 || !Number.isInteger(ratingNum)) {
      return res.status(400).json({ success: false, error: 'Rating must be an integer between 1 and 5' });
    }

    const { data: requestRow, error: requestLookupError } = await supabase
      .from('requests')
      .select('id, status')
      .eq('id', requestId)
      .single();

    if (requestLookupError) {
      throw requestLookupError;
    }

    if (requestRow.status !== 'completed') {
      return res.status(400).json({ success: false, error: 'Can only rate completed trips' });
    }

    const { error: updateError } = await supabase
      .from('requests')
      .update({ rating: ratingNum })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    console.log(`[GoZo] Trip rated: requestId=${requestId} rating=${ratingNum}`);
    res.json({ success: true, rating: ratingNum });
  } catch (error) {
    console.error('[GoZo] rate-trip error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Request Details (for tracking) ───
app.get('/gozo/request-details/:requestId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId } = req.params;

    const { data: requestRow, error: requestError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (requestError) {
      throw requestError;
    }

    res.json({ success: true, request: requestRow });
  } catch (error) {
    console.error('[GoZo] request-details error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Driver Live Location ───
app.post('/gozo/update-location', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId, transporterId, latitude, longitude, heading } = req.body;
    if (!requestId || !transporterId || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, error: 'Missing requestId, transporterId, latitude, or longitude' });
    }

    // Verify the request belongs to this transporter
    const { data: requestRow, error: requestLookupError } = await supabase
      .from('requests')
      .select('id, transporter_id, status')
      .eq('id', requestId)
      .single();

    if (requestLookupError) {
      throw requestLookupError;
    }

    if (requestRow.transporter_id !== transporterId) {
      return res.status(403).json({ success: false, error: 'This request is not assigned to you' });
    }

    // Update driver location
    const { error: updateError } = await supabase
      .from('requests')
      .update({
        driver_lat: Number(latitude),
        driver_lng: Number(longitude),
        driver_heading: Number(heading) || 0,
      })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[GoZo] update-location error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/gozo/driver-location/:requestId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId } = req.params;

    const { data: requestRow, error: requestError } = await supabase
      .from('requests')
      .select('driver_lat, driver_lng, driver_heading, status, pickup_address, drop_address')
      .eq('id', requestId)
      .single();

    if (requestError) {
      throw requestError;
    }

    res.json({
      success: true,
      location: {
        latitude: requestRow.driver_lat,
        longitude: requestRow.driver_lng,
        heading: requestRow.driver_heading || 0,
        status: requestRow.status,
        pickupAddress: requestRow.pickup_address,
        dropAddress: requestRow.drop_address,
      },
    });
  } catch (error) {
    console.error('[GoZo] driver-location error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Upload Builty & Complete Delivery ───
app.post('/gozo/upload-builty', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId, transporterId, builtyImage } = req.body;
    if (!requestId || !transporterId || !builtyImage) {
      return res.status(400).json({ success: false, error: 'Missing requestId, transporterId, or builtyImage' });
    }

    // Verify the request belongs to this transporter
    const { data: requestRow, error: requestLookupError } = await supabase
      .from('requests')
      .select('id, owner_id, transporter_id, status')
      .eq('id', requestId)
      .single();

    if (requestLookupError) {
      throw requestLookupError;
    }

    if (requestRow.transporter_id !== transporterId) {
      return res.status(403).json({ success: false, error: 'This request is not assigned to you' });
    }

    // Store builty image and mark as completed
    const { error: updateError } = await supabase
      .from('requests')
      .update({
        builty_image: builtyImage,
        status: 'completed'
      })
      .eq('id', requestId);

    if (updateError) {
      throw updateError;
    }

    // Notify the owner that delivery is completed with builty
    const { data: ownerRow, error: ownerError } = await supabase
      .from('users')
      .select('fcm_token')
      .eq('id', requestRow.owner_id)
      .single();

    if (!ownerError && admin.apps.length && ownerRow?.fcm_token) {
      await admin.messaging().send({
        token: ownerRow.fcm_token,
        notification: {
          title: '✅ Delivery Completed!',
          body: 'Your goods have been delivered. Builty photo is available.'
        },
        data: {
          requestId: requestRow.id,
          type: 'TRIP_STATUS_UPDATE',
          status: 'completed',
          builtyAvailable: 'true'
        },
        android: { priority: 'high' }
      });
    }

    console.log(`[GoZo] Builty uploaded and delivery completed: requestId=${requestId}`);
    res.json({ success: true, status: 'completed' });
  } catch (error) {
    console.error('[GoZo] upload-builty error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Download Builty Receipt ───
app.get('/gozo/download-builty/:requestId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { requestId } = req.params;
    if (!requestId) {
      return res.status(400).send('Missing requestId');
    }

    const { data: requestRow, error: requestLookupError } = await supabase
      .from('requests')
      .select('builty_image')
      .eq('id', requestId)
      .single();

    if (requestLookupError || !requestRow) {
      return res.status(404).send('Request not found');
    }

    if (!requestRow.builty_image) {
      return res.status(404).send('Builty receipt not uploaded yet');
    }

    // Strip base64 prefix if present
    let base64Data = requestRow.builty_image;
    if (base64Data.startsWith('data:')) {
      const parts = base64Data.split(',');
      if (parts.length > 1) {
        base64Data = parts[1];
      }
    }

    const imgBuffer = Buffer.from(base64Data, 'base64');

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `attachment; filename="builty_${requestId.slice(0, 7)}.jpg"`,
      'Content-Length': imgBuffer.length
    });

    res.end(imgBuffer);
  } catch (error) {
    console.error('[GoZo] download-builty error:', error);
    res.status(500).send('Error downloading file: ' + error.message);
  }
});

app.get('/gozo/health', async (req, res) => {
  let supabaseConnected = false;
  if (supabase) {
    const { error } = await supabase.from('users').select('id').limit(1);
    supabaseConnected = !error;
  }

  res.json({
    status: 'ok',
    firebase: admin.apps.length > 0,
    supabase: supabaseConnected,
    tokensInMemory: Object.keys(tokenStore).length
  });
});

// ─── Driver Trip History ───
app.get('/gozo/driver-history/:transporterId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { transporterId } = req.params;

    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('*')
      .eq('transporter_id', transporterId)
      .in('status', ['matched', 'picked_up', 'on_the_way', 'completed'])
      .order('created_at', { ascending: false });

    if (requestsError) {
      throw requestsError;
    }

    res.json({ success: true, requests: requests ?? [] });
  } catch (error) {
    console.error('[GoZo] driver-history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ─── Driver Stats (rating, trips, earnings from DB) ───
app.get('/gozo/driver-stats/:transporterId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) {
      return;
    }

    const { transporterId } = req.params;

    const { data: requests, error: requestsError } = await supabase
      .from('requests')
      .select('accepted_price, rating, status')
      .eq('transporter_id', transporterId)
      .in('status', ['matched', 'picked_up', 'on_the_way', 'completed']);

    if (requestsError) {
      throw requestsError;
    }

    const allTrips = requests ?? [];
    const completedTrips = allTrips.filter(r => r.status === 'completed');
    const totalTrips = allTrips.length;
    const totalEarned = completedTrips.reduce((sum, r) => sum + (Number(r.accepted_price) || 0), 0);
    const ratedTrips = completedTrips.filter(r => r.rating != null && r.rating > 0);
    const avgRating = ratedTrips.length > 0
      ? (ratedTrips.reduce((sum, r) => sum + Number(r.rating), 0) / ratedTrips.length).toFixed(1)
      : null;

    res.json({
      success: true,
      stats: {
        totalTrips,
        completedTrips: completedTrips.length,
        totalEarned,
        avgRating: avgRating ? parseFloat(avgRating) : null,
      },
    });
  } catch (error) {
    console.error('[GoZo] driver-stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper: send FCM to all admin tokens
const sendAdminFCM = async (title, body, dataPayload) => {
  if (!admin.apps.length || !supabase) return;
  try {
    const { data: adminTokens, error } = await supabase.from('admin_fcm_tokens').select('token');
    if (error) {
      console.error('[Admin FCM] Failed to fetch admin tokens:', error.message);
      return;
    }
    if (!adminTokens || adminTokens.length === 0) {
      console.log('[Admin FCM] No registered admin tokens found.');
      return;
    }
    
    console.log(`[Admin FCM] Sending "${dataPayload.type}" to ${adminTokens.length} admin(s)...`);
    
    for (const { token } of adminTokens) {
      try {
        await admin.messaging().send({
          token,
          notification: { title, body },
          data: dataPayload,
          android: { 
            priority: 'high',
            notification: { channelId: 'admin_notifications' }
          },
          apns: {
            headers: { "apns-priority": "10" },
            payload: { aps: { sound: "default" } }
          }
        });
      } catch (sendErr) {
        console.warn(`[Admin FCM] Send failed for token: ${token.slice(0, 15)}... Error:`, sendErr.message);
        // If token is invalid/not registered, clean it up from DB
        if (sendErr.code === 'messaging/invalid-registration-token' || 
            sendErr.code === 'messaging/registration-token-not-registered') {
          console.log(`[Admin FCM] Removing stale token: ${token.slice(0, 15)}...`);
          await supabase.from('admin_fcm_tokens').delete().eq('token', token);
        }
      }
    }
  } catch (err) {
    console.error('[Admin FCM] Unexpected error:', err.message);
  }
};

// ─── Driver Db Status Update ───
app.patch('/drivers/:driverId/status', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { driverId } = req.params;
    const { status } = req.body;
    
    if (!status || !['offline', 'available', 'in_ride'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status. Must be offline, available, or in_ride' });
    }
    
    const { error } = await supabase
      .from('users')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', driverId)
      .eq('role', 'transporter');
      
    if (error) throw error;
    
    // Also update in-memory driverStatusStore online flag to keep it in sync
    if (driverStatusStore[driverId]) {
      driverStatusStore[driverId].online = (status === 'available' || status === 'in_ride');
      driverStatusStore[driverId].lastSeen = Date.now();
    } else {
      driverStatusStore[driverId] = {
        online: (status === 'available' || status === 'in_ride'),
        lastSeen: Date.now()
      };
    }
    
    console.log(`[Driver DB Status] Driver ${driverId} set status to ${status}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Driver Status PATCH] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Admin App Endpoints ───

// GET /admin/drivers/status
app.get('/admin/drivers/status', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { data: drivers, error } = await supabase
      .from('users')
      .select('id, name, phone, vehicle_number, status')
      .eq('role', 'transporter')
      .order('name');
      
    if (error) throw error;
    
    const enriched = (drivers || []).map(d => ({
      ...d,
      vehicle_type: 'Truck', // Default vehicle type since column is missing in DB schema
      status: d.status || 'offline'
    }));
    
    res.json({ success: true, drivers: enriched });
  } catch (error) {
    console.error('[Admin Drivers Status GET] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /admin/test-fcm
app.post('/admin/test-fcm', requireAdmin, async (req, res) => {
  try {
    await sendAdminFCM(
      '🔔 Test Notification',
      'This is a test notification from the GoZo Admin Panel.',
      { type: 'test_notification', timestamp: String(Date.now()) }
    );
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin Test FCM] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /admin/fcm-token
app.post('/admin/fcm-token', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, error: 'Missing token' });
    
    const { error } = await supabase
      .from('admin_fcm_tokens')
      .upsert({ token, updated_at: new Date().toISOString() }, { onConflict: 'token' });
      
    if (error) throw error;
    console.log(`[Admin FCM] Registered token: ${token.slice(0, 20)}...`);
    res.json({ success: true });
  } catch (error) {
    console.error('[Admin FCM Register POST] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /admin/rides
app.get('/admin/rides', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { status, date } = req.query;
    
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    if (date) {
      const dayStart = new Date(date + 'T00:00:00Z').toISOString();
      const dayEnd = new Date(date + 'T23:59:59Z').toISOString();
      query = query.gte('created_at', dayStart).lte('created_at', dayEnd);
    }
    
    const { data: requests, error } = await query;
    if (error) throw error;
    
    const enriched = await Promise.all((requests || []).map(async (r) => {
      let userInfo = null;
      if (r.owner_id) {
        const { data: u } = await supabase.from('users').select('id, name, phone, factory_name, factory_address').eq('id', r.owner_id).maybeSingle();
        userInfo = u;
      }
      
      let driverInfo = null;
      if (r.transporter_id) {
        const { data: d } = await supabase.from('users').select('id, name, phone, vehicle_number, status').eq('id', r.transporter_id).maybeSingle();
        driverInfo = d ? { ...d, vehicle_type: 'Truck' } : null;
      }
      
      const priceInfo = getPredefinedPrice(r.goods_type, r.weight_kg);
      
      return {
        ...r,
        user: userInfo,
        driver: driverInfo,
        price_inr: r.accepted_price || priceInfo.total,
        priceInfo
      };
    }));
    
    res.json({ success: true, rides: enriched });
  } catch (error) {
    console.error('[Admin Rides GET] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /admin/rides/:requestId
app.get('/admin/rides/:requestId', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { requestId } = req.params;
    
    const { data: request, error } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();
      
    if (error) throw error;
    
    let userInfo = null;
    if (request.owner_id) {
      const { data: u } = await supabase.from('users').select('id, name, phone, factory_name, factory_address').eq('id', request.owner_id).maybeSingle();
      userInfo = u;
    }
    
    let driverInfo = null;
    if (request.transporter_id) {
      const { data: d } = await supabase.from('users').select('id, name, phone, vehicle_number, status').eq('id', request.transporter_id).maybeSingle();
      driverInfo = d ? { ...d, vehicle_type: 'Truck' } : null;
    }
    
    const priceInfo = getPredefinedPrice(request.goods_type, request.weight_kg);
    
    const timeline = [];
    const createdTime = request.created_at ? new Date(request.created_at).toLocaleString('en-IN') : 'N/A';
    timeline.push({ status: 'Booked', active: true, time: createdTime });
    
    const isAssigned = ['matched', 'picked_up', 'on_the_way', 'completed'].includes(request.status);
    timeline.push({ status: 'Assigned', active: isAssigned, time: isAssigned ? (request.updated_at ? new Date(request.updated_at).toLocaleString('en-IN') : createdTime) : '' });
    
    const isPickedUp = ['picked_up', 'on_the_way', 'completed'].includes(request.status);
    timeline.push({ status: 'Picked Up', active: isPickedUp, time: isPickedUp ? (request.updated_at ? new Date(request.updated_at).toLocaleString('en-IN') : '') : '' });
    
    const isDelivered = request.status === 'completed';
    timeline.push({ status: 'Delivered', active: isDelivered, time: isDelivered ? (request.updated_at ? new Date(request.updated_at).toLocaleString('en-IN') : '') : '' });
    
    res.json({
      success: true,
      ride: {
        ...request,
        user: userInfo,
        driver: driverInfo,
        price_inr: request.accepted_price || priceInfo.total,
        priceInfo,
        timeline
      }
    });
  } catch (error) {
    console.error('[Admin Ride Detail GET] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /admin/drivers/:driverId/rides
app.get('/admin/drivers/:driverId/rides', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { driverId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    
    const { data: rides, error } = await supabase
      .from('requests')
      .select('*')
      .eq('transporter_id', driverId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) throw error;
    
    const enriched = (rides || []).map(r => {
      const priceInfo = getPredefinedPrice(r.goods_type, r.weight_kg);
      return {
        ...r,
        price_inr: r.accepted_price || priceInfo.total
      };
    });
    
    res.json({ success: true, rides: enriched });
  } catch (error) {
    console.error('[Admin Driver Rides History GET] error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Admin Panel API ───
app.post('/admin/auth', (req, res) => {
  const { pin } = req.body;
  if (pin === ADMIN_PIN) {
    res.json({ success: true, token: ADMIN_TOKEN });
  } else {
    res.status(401).json({ success: false, error: 'Invalid PIN' });
  }
});

app.get('/admin/api/companies', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { data, error } = await supabase.from('transport_companies').select('*').order('created_at');
    if (error) throw error;
    res.json({ success: true, companies: data || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/admin/api/companies', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { id, name, location, rate_per_kg, rate_display, routes, routes_v2, images, depot_address, description, established, contact_phone, experience, delivery_time, additional_info } = req.body;
    if (!id || !name) return res.status(400).json({ success: false, error: 'ID and Name are required' });
    const { error } = await supabase.from('transport_companies').insert({ id, name, location, rate_per_kg: rate_per_kg || 0, rate_display, rating: 0, total_ratings: 0, routes: routes || [], routes_v2: routes_v2 || [], images: images || [], depot_address, description, established, contact_phone, experience, delivery_time, additional_info });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.put('/admin/api/companies/:id', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { id } = req.params;
    const { name, location, rate_per_kg, rate_display, routes, routes_v2, images, depot_address, description, established, contact_phone, experience, delivery_time, additional_info } = req.body;
    const { error } = await supabase.from('transport_companies').update({ name, location, rate_per_kg, rate_display, routes: routes || [], routes_v2: routes_v2 || [], images: images || [], depot_address, description, established, contact_phone, experience, delivery_time, additional_info, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/admin/api/companies/:id', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { error } = await supabase.from('transport_companies').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.get('/admin/api/drivers', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { data, error } = await supabase.from('users').select('id, name, phone, vehicle_number, created_at').eq('role', 'transporter').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ success: true, drivers: data || [] });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.post('/admin/api/drivers', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { name, phone } = req.body;
    if (!name || !phone) return res.status(400).json({ success: false, error: 'Name and phone are required' });
    const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existing) return res.status(409).json({ success: false, error: 'Phone number already registered' });
    const { error } = await supabase.from('users').insert({ name, phone, role: 'transporter' });
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

app.delete('/admin/api/drivers/:id', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const driverId = req.params.id;

    // 1. Set transporter_id to null for requests where this driver is the transporter
    await supabase.from('requests').update({ transporter_id: null }).eq('transporter_id', driverId);

    // 2. Delete requests where this driver was somehow registered as the owner (owner_id is NOT NULL)
    await supabase.from('requests').delete().eq('owner_id', driverId);

    // 3. Delete the user
    const { error } = await supabase.from('users').delete().eq('id', driverId).eq('role', 'transporter');
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
// ─── Scheduled Rides Feature ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// Helper: generate SCH-YYYYMMDD-XXXXXX booking ID
const generateScheduledBookingId = () => {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const d = String(ist.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SCH-${dateStr}-${code}`;
};

// Helper: send FCM for scheduled ride events
const sendScheduledRideFCM = async (userId, title, body, dataPayload) => {
  if (!admin.apps.length) return;
  // Try in-memory token first, then DB
  let token = tokenStore[userId];
  if (!token && supabase) {
    const { data: userRow } = await supabase.from('users').select('fcm_token').eq('id', userId).maybeSingle();
    token = userRow?.fcm_token;
  }
  if (!token) {
    console.warn(`[ScheduledRide FCM] No token for user ${userId}`);
    return;
  }
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data: dataPayload,
      android: { priority: 'high' }
    });
    console.log(`[ScheduledRide FCM] Sent "${dataPayload.type}" to ${userId}`);
  } catch (err) {
    console.error(`[ScheduledRide FCM] Failed for ${userId}:`, err.message);
  }
};

// POST /scheduled-rides — Create a new scheduled ride
app.post('/scheduled-rides', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { user_id, pickup_location, pickup_lat, pickup_lng, drop_location, drop_lat, drop_lng, goods_description, scheduled_time, company_id } = req.body;

    if (!user_id || !pickup_location || !drop_location || !scheduled_time) {
      return res.status(400).json({ success: false, error: 'Missing required fields: user_id, pickup_location, drop_location, scheduled_time' });
    }

    const schedDate = new Date(scheduled_time);
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (isNaN(schedDate.getTime())) {
      return res.status(400).json({ success: false, error: 'Invalid scheduled_time format' });
    }
    if (schedDate < twoHoursFromNow) {
      return res.status(400).json({ success: false, error: 'Scheduled time must be at least 2 hours from now' });
    }
    if (schedDate > sevenDaysFromNow) {
      return res.status(400).json({ success: false, error: 'Scheduled time must be within 7 days from now' });
    }

    const bookingId = generateScheduledBookingId();

    const { data: ride, error } = await supabase
      .from('scheduled_rides')
      .insert({
        booking_id: bookingId,
        user_id,
        pickup_location,
        pickup_lat: pickup_lat || null,
        pickup_lng: pickup_lng || null,
        drop_location,
        drop_lat: drop_lat || null,
        drop_lng: drop_lng || null,
        goods_description: goods_description || null,
        scheduled_time: schedDate.toISOString(),
        company_id: company_id || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Send confirmation FCM to user
    await sendScheduledRideFCM(user_id,
      '📅 Ride Scheduled!',
      `Your ride (${bookingId}) has been scheduled. We will assign a driver soon.`,
      { type: 'scheduled_ride_confirmed', rideId: ride.id, bookingId }
    );

    // Send admin notification
    sendAdminFCM(
      '📅 New Scheduled Ride',
      `New Scheduled Ride — ${scheduled_time} — ${pickup_location} to ${drop_location}`,
      { type: 'new_scheduled_ride', rideId: ride.id }
    );

    console.log(`[ScheduledRide] Created ${bookingId} for user ${user_id}`);
    res.json({ success: true, ride });
  } catch (error) {
    console.error('[ScheduledRide] create error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /scheduled-rides/user/:userId — User's scheduled rides
app.get('/scheduled-rides/user/:userId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { userId } = req.params;
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('user_id', userId)
      .order('scheduled_time', { ascending: true });
    if (error) throw error;

    const enriched = await Promise.all((data || []).map(async (ride) => {
      let companyInfo = null;
      if (ride.company_id) {
        const { data: c } = await supabase.from('transport_companies').select('id, name').eq('id', ride.company_id).maybeSingle();
        companyInfo = c;
      }
      return { ...ride, company: companyInfo };
    }));

    res.json({ success: true, rides: enriched });
  } catch (error) {
    console.error('[ScheduledRide] user rides error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /scheduled-rides/driver/:driverId — Driver's assigned rides
app.get('/scheduled-rides/driver/:driverId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { driverId } = req.params;
    const { data, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('driver_id', driverId)
      .eq('status', 'assigned')
      .order('scheduled_time', { ascending: true });
    if (error) throw error;
    res.json({ success: true, rides: data || [] });
  } catch (error) {
    console.error('[ScheduledRide] driver rides error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /scheduled-rides/:rideId — Single ride detail
app.get('/scheduled-rides/:rideId', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { rideId } = req.params;
    const { data: ride, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('id', rideId)
      .single();
    if (error) throw error;

    // Enrich with user info
    let userInfo = null;
    if (ride.user_id) {
      const { data: u } = await supabase.from('users').select('id, name, phone, factory_name, factory_address').eq('id', ride.user_id).maybeSingle();
      userInfo = u;
    }

    // Enrich with driver info
    let driverInfo = null;
    if (ride.driver_id) {
      const { data: d } = await supabase.from('users').select('id, name, phone, vehicle_number').eq('id', ride.driver_id).maybeSingle();
      driverInfo = d;
    }

    // Enrich with company info
    let companyInfo = null;
    if (ride.company_id) {
      const { data: c } = await supabase.from('transport_companies').select('id, name, location, contact_phone').eq('id', ride.company_id).maybeSingle();
      companyInfo = c;
    }

    res.json({ success: true, ride: { ...ride, user: userInfo, driver: driverInfo, company: companyInfo } });
  } catch (error) {
    console.error('[ScheduledRide] detail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /scheduled-rides/:rideId/cancel — Cancel a scheduled ride
app.patch('/scheduled-rides/:rideId/cancel', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { rideId } = req.params;
    const { cancelled_by, cancellation_reason } = req.body;

    if (!cancelled_by || !['user', 'driver', 'admin'].includes(cancelled_by)) {
      return res.status(400).json({ success: false, error: 'cancelled_by must be user, driver, or admin' });
    }

    const { data: ride, error: lookupError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('id', rideId)
      .single();
    if (lookupError) throw lookupError;

    // Validation
    if (ride.status === 'delivered') {
      return res.status(400).json({ success: false, error: 'Cannot cancel a delivered ride' });
    }
    if (ride.status === 'cancelled') {
      return res.status(400).json({ success: false, error: 'Ride is already cancelled' });
    }

    if (cancelled_by === 'driver') {
      const hoursUntil = (new Date(ride.scheduled_time).getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntil < 4) {
        return res.status(400).json({ success: false, error: 'Cannot cancel within 4 hours of scheduled time' });
      }
    }

    if (cancelled_by === 'user') {
      const activeStatuses = ['on_the_way', 'arrived', 'picked_up', 'delivered'];
      if (activeStatuses.includes(ride.status)) {
        return res.status(400).json({ success: false, error: 'Cannot cancel — ride is already in progress' });
      }
    }

    // Perform cancellation
    const { data: updated, error: updateError } = await supabase
      .from('scheduled_rides')
      .update({
        status: 'cancelled',
        cancelled_by,
        cancellation_reason: cancellation_reason || null,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .select()
      .single();
    if (updateError) throw updateError;

    // Send FCM notifications
    if (cancelled_by === 'driver' || cancelled_by === 'admin') {
      await sendScheduledRideFCM(ride.user_id,
        '❌ Scheduled Ride Cancelled',
        `Your scheduled ride (${ride.booking_id}) has been cancelled.`,
        { type: 'scheduled_ride_cancelled', rideId: ride.id, bookingId: ride.booking_id }
      );
    }
    if ((cancelled_by === 'user' || cancelled_by === 'admin') && ride.driver_id) {
      await sendScheduledRideFCM(ride.driver_id,
        '❌ Scheduled Ride Cancelled',
        `Scheduled ride (${ride.booking_id}) has been cancelled.`,
        { type: 'scheduled_ride_cancelled', rideId: ride.id, bookingId: ride.booking_id }
      );
    }

    console.log(`[ScheduledRide] Cancelled ${ride.booking_id} by ${cancelled_by}`);
    res.json({ success: true, ride: updated });
  } catch (error) {
    console.error('[ScheduledRide] cancel error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /scheduled-rides/:rideId/start — Driver starts the ride
app.patch('/scheduled-rides/:rideId/start', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { rideId } = req.params;
    const { driver_id } = req.body;

    const { data: ride, error: lookupError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('id', rideId)
      .single();
    if (lookupError) throw lookupError;

    if (ride.status !== 'assigned') {
      return res.status(400).json({ success: false, error: 'Ride must be in assigned status to start' });
    }
    if (ride.driver_id !== driver_id) {
      return res.status(403).json({ success: false, error: 'This ride is not assigned to you' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('scheduled_rides')
      .update({
        status: 'on_the_way',
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .select()
      .single();
    if (updateError) throw updateError;

    // Notify user
    await sendScheduledRideFCM(ride.user_id,
      '🚛 Your driver is on the way!',
      `Driver has started the ride for ${ride.booking_id}.`,
      { type: 'scheduled_ride_started', rideId: ride.id, bookingId: ride.booking_id }
    );

    console.log(`[ScheduledRide] Started ${ride.booking_id}`);
    res.json({ success: true, ride: updated });
  } catch (error) {
    console.error('[ScheduledRide] start error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /scheduled-rides/:rideId/status — Post-start status updates (arrived, picked_up, delivered)
const VALID_SCHEDULED_STATUSES = ['arrived', 'picked_up', 'delivered'];

app.patch('/scheduled-rides/:rideId/status', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { rideId } = req.params;
    const { driver_id, status } = req.body;

    if (!status || !VALID_SCHEDULED_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${VALID_SCHEDULED_STATUSES.join(', ')}` });
    }

    const { data: ride, error: lookupError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('id', rideId)
      .single();
    if (lookupError) throw lookupError;

    if (ride.driver_id !== driver_id) {
      return res.status(403).json({ success: false, error: 'This ride is not assigned to you' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('scheduled_rides')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .select()
      .single();
    if (updateError) throw updateError;

    // Notify user of status change
    const statusMessages = {
      arrived: { title: '📍 Driver Arrived', body: 'Your driver has arrived at the pickup location.' },
      picked_up: { title: '📦 Goods Picked Up', body: 'Your goods have been picked up!' },
      delivered: { title: '✅ Delivery Completed', body: 'Your goods have been delivered successfully!' },
    };
    const notif = statusMessages[status];
    if (notif) {
      await sendScheduledRideFCM(ride.user_id, notif.title, notif.body,
        { type: 'scheduled_ride_status_update', rideId: ride.id, bookingId: ride.booking_id, status }
      );
    }

    console.log(`[ScheduledRide] Status update ${ride.booking_id} → ${status}`);
    res.json({ success: true, ride: updated });
  } catch (error) {
    console.error('[ScheduledRide] status update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /admin/scheduled-rides — Admin list with optional filters
app.get('/admin/scheduled-rides', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { status, date } = req.query;

    let query = supabase.from('scheduled_rides').select('*').order('scheduled_time', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }
    if (date) {
      // Filter by date (YYYY-MM-DD)
      const dayStart = new Date(date + 'T00:00:00Z').toISOString();
      const dayEnd = new Date(date + 'T23:59:59Z').toISOString();
      query = query.gte('scheduled_time', dayStart).lte('scheduled_time', dayEnd);
    }

    const { data: rides, error } = await query;
    if (error) throw error;

    // Enrich with user, driver and company info
    const enriched = await Promise.all((rides || []).map(async (ride) => {
      let userInfo = null;
      let driverInfo = null;
      let companyInfo = null;
      if (ride.user_id) {
        const { data: u } = await supabase.from('users').select('id, name, phone, factory_name').eq('id', ride.user_id).maybeSingle();
        userInfo = u;
      }
      if (ride.driver_id) {
        const { data: d } = await supabase.from('users').select('id, name, phone, vehicle_number').eq('id', ride.driver_id).maybeSingle();
        driverInfo = d;
      }
      if (ride.company_id) {
        const { data: c } = await supabase.from('transport_companies').select('id, name').eq('id', ride.company_id).maybeSingle();
        companyInfo = c;
      }
      return { ...ride, user: userInfo, driver: driverInfo, company: companyInfo };
    }));

    res.json({ success: true, rides: enriched });
  } catch (error) {
    console.error('[ScheduledRide] admin list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /admin/scheduled-rides/:rideId/assign — Admin assigns a driver
app.patch('/admin/scheduled-rides/:rideId/assign', requireAdmin, async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { rideId } = req.params;
    const { driver_id } = req.body;

    if (!driver_id) {
      return res.status(400).json({ success: false, error: 'driver_id is required' });
    }

    // Verify ride is pending
    const { data: ride, error: lookupError } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('id', rideId)
      .single();
    if (lookupError) throw lookupError;

    if (ride.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Can only assign driver to pending rides' });
    }

    // Verify driver exists and is a transporter
    const { data: driverRow, error: driverError } = await supabase
      .from('users')
      .select('id, name, phone, vehicle_number')
      .eq('id', driver_id)
      .eq('role', 'transporter')
      .single();
    if (driverError || !driverRow) {
      return res.status(400).json({ success: false, error: 'Driver not found or not active' });
    }

    // Assign
    const { data: updated, error: updateError } = await supabase
      .from('scheduled_rides')
      .update({
        driver_id,
        status: 'assigned',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', rideId)
      .select()
      .single();
    if (updateError) throw updateError;

    // Format scheduled time for notification
    const schedDate = new Date(ride.scheduled_time);
    const dateStr = schedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
    const timeStr = schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    // Notify driver
    await sendScheduledRideFCM(driver_id,
      '📅 Scheduled Ride Assigned',
      `You have been assigned a scheduled ride on ${dateStr} at ${timeStr}. Tap to view details.`,
      { type: 'scheduled_ride_assigned', rideId: ride.id, bookingId: ride.booking_id }
    );

    // Notify user
    await sendScheduledRideFCM(ride.user_id,
      '✅ Driver Assigned!',
      `Your scheduled ride (${ride.booking_id}) has been confirmed. A driver has been assigned.`,
      { type: 'scheduled_ride_assigned', rideId: ride.id, bookingId: ride.booking_id }
    );

    console.log(`[ScheduledRide] Assigned driver ${driverRow.name} to ${ride.booking_id}`);
    res.json({ success: true, ride: { ...updated, driver: driverRow } });
  } catch (error) {
    console.error('[ScheduledRide] assign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Background Cron Job: Unassigned Ride Alerts (every 15 min) ───
cron.schedule('*/15 * * * *', async () => {
  if (!supabase) return;
  try {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    const { data: unassigned, error } = await supabase
      .from('scheduled_rides')
      .select('*')
      .eq('status', 'pending')
      .eq('unassigned_alert_sent', false)
      .lte('scheduled_time', twoHoursFromNow);

    if (error) {
      console.error('[Cron] Unassigned alert query error:', error.message);
      return;
    }

    for (const ride of (unassigned || [])) {
      const schedDate = new Date(ride.scheduled_time);
      const timeStr = schedDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

      await sendScheduledRideFCM(ride.user_id,
        '⚠️ Ride Not Yet Assigned',
        `Your scheduled ride at ${timeStr} has not been assigned a driver yet. We are working on it.`,
        { type: 'scheduled_ride_unassigned_alert', rideId: ride.id, bookingId: ride.booking_id }
      );

      await supabase.from('scheduled_rides')
        .update({ unassigned_alert_sent: true })
        .eq('id', ride.id);

      console.log(`[Cron] Sent unassigned alert for ${ride.booking_id}`);
    }
  } catch (err) {
    console.error('[Cron] Unassigned alert job error:', err.message);
  }
});
console.log('[Cron] Unassigned ride alert job scheduled (every 15 min)');

app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    registeredUsers: Object.keys(tokenStore)
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Backend listening on port ${PORT}`);
  // Run startup migration checks
  await runStartupMigration();
});

async function runStartupMigration() {
  if (!supabase) return;
  console.log('[Migration] Running startup check...');
  try {
    // 1. Create columns if they do not exist
    const { error: testRoutesV2 } = await supabase.from('transport_companies').select('routes_v2').limit(1);
    if (testRoutesV2 && testRoutesV2.message.includes('does not exist')) {
      console.log('[Migration] Column routes_v2 is missing. Running DDL...');
      await supabase.rpc('exec_sql', { sql: `ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS routes_v2 JSONB DEFAULT '[]'::jsonb;` }).maybeSingle();
    }
    
    const { error: testImages } = await supabase.from('transport_companies').select('images').limit(1);
    if (testImages && testImages.message.includes('does not exist')) {
      console.log('[Migration] Column images is missing. Running DDL...');
      await supabase.rpc('exec_sql', { sql: `ALTER TABLE transport_companies ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;` }).maybeSingle();
    }

    const { error: testUserCity } = await supabase.from('users').select('city').limit(1);
    if (testUserCity && testUserCity.message.includes('does not exist')) {
      console.log('[Migration] Column users.city is missing. Running DDL...');
      await supabase.rpc('exec_sql', { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS city TEXT;` }).maybeSingle();
    }

    const { error: testUserStatus } = await supabase.from('users').select('status').limit(1);
    if (testUserStatus && testUserStatus.message.includes('does not exist')) {
      console.log('[Migration] Column users.status is missing. Running DDL...');
      await supabase.rpc('exec_sql', { sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline';` }).maybeSingle();
    }

    const { error: testAdminTokens } = await supabase.from('admin_fcm_tokens').select('id').limit(1);
    if (testAdminTokens && (testAdminTokens.message.includes('does not exist') || testAdminTokens.code === '42P01')) {
      console.log('[Migration] Table admin_fcm_tokens is missing. Running DDL...');
      await supabase.rpc('exec_sql', { sql: `
        CREATE TABLE IF NOT EXISTS admin_fcm_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          token TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      ` }).maybeSingle();
    }

    // 2. Populate routes_v2
    const { data: companies } = await supabase.from('transport_companies').select('id, name, routes, routes_v2');
    if (companies) {
      const DETAILED_ROUTES_V2 = {
        'tc-001': [{ state: 'West Bengal', cities: [{ name: 'Kolkata' }], price_min: 4, price_max: 8, delivery_days_min: 5, delivery_days_max: 7 }],
        'tc-002': [
          { state: 'Maharashtra', cities: [{ name: 'Mumbai' }, { name: 'Pune' }, { name: 'Nagpur' }], price_min: 5, price_max: 7, delivery_days_min: 5, delivery_days_max: 6 },
          { state: 'Karnataka', cities: [{ name: 'Bangalore' }, { name: 'Mysore' }, { name: 'Hubli' }], price_min: 5, price_max: 7, delivery_days_min: 5, delivery_days_max: 6 }
        ],
        'tc-003': [
          {
            state: 'Punjab',
            cities: [
              { name: 'Amritsar', price_min: 2, price_max: 3, delivery_days_min: 1, delivery_days_max: 2 },
              { name: 'Ajnala' }, { name: 'Batala' }, { name: 'Gurdaspur' },
              { name: 'Pathankot', price_min: 2, price_max: 3 },
              { name: 'Hoshiarpur' }, { name: 'Jalandhar', price_min: 2, price_max: 3, delivery_days_min: 1, delivery_days_max: 1 },
              { name: 'Phagwara' }, { name: 'Nakodar' }, { name: 'Kapurthala' },
              { name: 'Sultanpur Lodhi' }, { name: 'Nawanshahr' }, { name: 'Balachaur' },
              { name: 'Ludhiana', price_min: 2, price_max: 2.5, delivery_days_min: 1, delivery_days_max: 1 },
              { name: 'Doraha' }, { name: 'Khanna' }, { name: 'Samrala' },
              { name: 'Mandi Gobindgarh' }, { name: 'Sirhind' }, { name: 'Rajpura' },
              { name: 'Patiala', price_min: 2, price_max: 3 },
              { name: 'Nabha' }, { name: 'Malerkotla' }, { name: 'Ahmedgarh' },
              { name: 'Barnala' }, { name: 'Sangrur' }, { name: 'Sunam' },
              { name: 'Lehragaga' }, { name: 'Dhuri' }, { name: 'Raikot' },
              { name: 'Jagraon' }, { name: 'Moga' }, { name: 'Kotkapura' },
              { name: 'Faridkot' }, { name: 'Ferozepur' }, { name: 'Fazilka' },
              { name: 'Zira' }, { name: 'Jalalabad' }, { name: 'Muktsar' },
              { name: 'Abohar' }, { name: 'Tarn Taran' }, { name: 'Patti' },
              { name: 'Khemkaran' }, { name: 'Dasuya' }, { name: 'Mukerian' }
            ],
            price_min: 2, price_max: 4, delivery_days_min: 1, delivery_days_max: 2
          },
          { state: 'Haryana', cities: [{ name: 'Ambala' }, { name: 'Ambala City' }, { name: 'Ambala Cantt' }, { name: 'Shahbad' }, { name: 'Kurukshetra' }, { name: 'Karnal' }, { name: 'Panipat' }, { name: 'Sonipat' }], price_min: 2, price_max: 4, delivery_days_min: 1, delivery_days_max: 2 },
          { state: 'Jammu & Kashmir', cities: [{ name: 'Jammu' }, { name: 'Kathua' }, { name: 'Samba' }, { name: 'Dori Brahmana' }, { name: 'Vijaypur' }], price_min: 3, price_max: 4, delivery_days_min: 2, delivery_days_max: 3 },
          { state: 'Delhi', cities: [{ name: 'Delhi', price_min: 2.5, price_max: 3.5, delivery_days_min: 1, delivery_days_max: 2 }], price_min: 2.5, price_max: 3.5, delivery_days_min: 1, delivery_days_max: 2 },
          { state: 'Himachal Pradesh', cities: [{ name: 'Baddi' }, { name: 'Damtal' }], price_min: 3, price_max: 4, delivery_days_min: 2, delivery_days_max: 3 }
        ],
        'tc-004': [
          { state: 'Assam', cities: [{ name: 'Guwahati' }, { name: 'Shillong' }, { name: 'Jorhat' }, { name: 'Dibrugarh' }, { name: 'Tinsukia' }, { name: 'Silchar' }, { name: 'Karimganj' }, { name: 'Agartala' }, { name: 'Lalabazar' }, { name: 'Aizawl' }, { name: 'Hailakandi' }, { name: 'Dharmanagar' }, { name: 'Imphal' }, { name: 'Dimapur' }, { name: 'Nagaon' }, { name: 'Lanka' }, { name: 'Gola Ghat' }, { name: 'Hojai' }], price_min: 2, price_max: 3, delivery_days_min: 10, delivery_days_max: 20 },
          { state: 'Bihar', cities: [{ name: 'Patna Jn' }, { name: 'Patna City' }, { name: 'Gaya' }, { name: 'Siwan' }, { name: 'Chapra' }, { name: 'Muzaffarpur' }, { name: 'Darbhanga' }, { name: 'Sitamarhi' }, { name: 'Samastipur' }, { name: 'Raxaul' }, { name: 'Purnea' }, { name: 'Forbesganj' }, { name: 'Katihar' }, { name: 'Jogbani' }, { name: 'Bhagalpur' }, { name: 'Araria' }], price_min: 2, price_max: 3, delivery_days_min: 7, delivery_days_max: 14 },
          { state: 'West Bengal', cities: [{ name: 'Kolkata' }, { name: 'Siliguri' }, { name: 'Darjeeling' }, { name: 'Cooch Behar' }, { name: 'Jaigaon' }, { name: 'Dinhata' }], price_min: 2, price_max: 3, delivery_days_min: 7, delivery_days_max: 12 },
          { state: 'Odisha', cities: [{ name: 'Cuttack' }, { name: 'Bhubaneswar' }, { name: 'Puri' }, { name: 'Sambalpur' }, { name: 'Rourkela' }, { name: 'Berhampur' }, { name: 'Jharsuguda' }], price_min: 2, price_max: 3, delivery_days_min: 10, delivery_days_max: 15 },
          { state: 'Jharkhand', cities: [{ name: 'Ranchi' }, { name: 'Dhanbad' }, { name: 'Jamshedpur' }, { name: 'Tatanagar' }, { name: 'Asansol' }, { name: 'Chas' }, { name: 'Giridih' }], price_min: 2, price_max: 3, delivery_days_min: 7, delivery_days_max: 12 }
        ]
      };

      for (const comp of companies) {
        if (!comp.routes_v2 || comp.routes_v2.length === 0) {
          const routesV2 = DETAILED_ROUTES_V2[comp.id] || [];
          if (routesV2.length > 0) {
            console.log(`[Migration] Migrating ${comp.id} routes_v2...`);
            await supabase.from('transport_companies').update({ routes_v2: routesV2 }).eq('id', comp.id);
          }
        }
      }
    }

    // 3. Populate user city from factory_address
    const { data: users } = await supabase.from('users').select('id, factory_address, city').is('city', null).not('factory_address', 'is', null);
    if (users) {
      for (const u of users) {
        const parts = u.factory_address.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          const city = parts[parts.length - 2].replace(/\d+/g, '').trim();
          if (city) {
            console.log(`[Migration] Extracting city "${city}" for user ${u.id}`);
            await supabase.from('users').update({ city }).eq('id', u.id);
          }
        }
      }
    }
    console.log('[Migration] Startup migration checks done.');
  } catch (err) {
    console.error('[Migration] Error during startup migration:', err.message);
  }
}
