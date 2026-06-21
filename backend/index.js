require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

// ─── Authentication System (Phone OTP) ───

// Step 1: Login / Request OTP
app.post('/gozo/auth/login', async (req, res) => {
  try {
    if (!ensureSupabase(res)) return;
    const { phone, expectedRole } = req.body;
    if (!phone) return res.status(400).json({ success: false, error: 'Phone number is required' });

    // Check if user exists
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, name')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;

    // In a real app, send OTP via Twilio/Firebase here.
    // We are currently hardcoding '123456' as OTP.

    if (user) {
      // Role mismatch: driver trying to log in to owner app or vice versa
      if (expectedRole && user.role !== expectedRole) {
        const appName = expectedRole === 'owner' ? 'GoZo Owner App' : 'GoZo Driver App';
        const correctApp = user.role === 'owner' ? 'GoZo Owner App' : 'GoZo Driver App';
        return res.status(403).json({
          success: false,
          error: `This number is registered as a ${user.role}. Please use the ${correctApp} instead.`
        });
      }
      res.json({ success: true, isNewUser: false, role: user.role });
    } else {
      res.json({ success: true, isNewUser: true });
    }
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

    // Hardcoded OTP validation
    if (otp !== '123456') {
      return res.status(401).json({ success: false, error: 'Invalid OTP' });
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
    const { phone, name, role, factory_name, factory_address, factory_lat, factory_lng, fcmToken } = req.body;
    
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
        factory_lng: factory_lng || null
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

  const basePrices = {
    furniture: 500,
    electronics: 800,
    food: 300,
    clothes: 250,
    books: 200,
    default: 400,
  };

  const goodsLower = goodsType.toLowerCase();
  let basePrice = basePrices['default'];

  for (const [key, price] of Object.entries(basePrices)) {
    if (goodsLower.includes(key)) {
      basePrice = price;
      break;
    }
  }

  const total = Math.round(basePrice + weightKg * 10);
  const serviceFee = Math.round(total * 0.2); // 20% service fee
  const estimatedFreight = total - serviceFee; // driver payout before cut
  const driverCut = Math.round(estimatedFreight * 0.9); // driver receives 90% of freight, 10% platform
  const rangeMin = Math.round(driverCut * 0.85);
  const rangeMax = Math.round(driverCut * 1.15);

  return {
    total,
    base: basePrice,
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

// ─── Transport Companies (static data) ───
const TRANSPORT_COMPANIES = [
  {
    id: 'tc-001', name: 'RapidCargo Express', location: 'Rajpura, Punjab',
    ratePerKg: 8, rating: 4.5, totalRatings: 328,
    routes: ['Rajpura → Chandigarh', 'Rajpura → Delhi', 'Rajpura → Ludhiana', 'Rajpura → Ambala'],
    depotAddress: 'RapidCargo Depot, GT Road, Rajpura, Punjab 140401',
    description: 'Fast and reliable cargo transport across Punjab and North India.',
    established: '2018', contactPhone: '9876500001'
  },
  {
    id: 'tc-002', name: 'Punjab Freight Lines', location: 'Patiala, Punjab',
    ratePerKg: 6, rating: 4.2, totalRatings: 215,
    routes: ['Patiala → Delhi', 'Patiala → Chandigarh', 'Patiala → Bathinda', 'Patiala → Jaipur'],
    depotAddress: 'Punjab Freight Depot, Sirhind Road, Patiala, Punjab 147001',
    description: 'Affordable freight solutions with extensive coverage across Punjab and Rajasthan.',
    established: '2015', contactPhone: '9876500002'
  },
  {
    id: 'tc-003', name: 'TruckWale Logistics', location: 'Ludhiana, Punjab',
    ratePerKg: 10, rating: 4.8, totalRatings: 512,
    routes: ['Ludhiana → Delhi', 'Ludhiana → Mumbai', 'Ludhiana → Chandigarh', 'Ludhiana → Amritsar'],
    depotAddress: 'TruckWale Hub, Focal Point, Ludhiana, Punjab 141010',
    description: 'Premium logistics partner with GPS-tracked fleet. All-India coverage.',
    established: '2012', contactPhone: '9876500003'
  },
  {
    id: 'tc-004', name: 'Gill Transport Co.', location: 'Amritsar, Punjab',
    ratePerKg: 5, rating: 3.9, totalRatings: 178,
    routes: ['Amritsar → Delhi', 'Amritsar → Jammu', 'Amritsar → Ludhiana', 'Amritsar → Pathankot'],
    depotAddress: 'Gill Transport Yard, Majitha Road, Amritsar, Punjab 143001',
    description: 'Budget-friendly transport with strong presence in North Punjab and Jammu region.',
    established: '1995', contactPhone: '9876500004'
  },
  {
    id: 'tc-005', name: 'SpeedLine Movers', location: 'Chandigarh',
    ratePerKg: 12, rating: 4.6, totalRatings: 402,
    routes: ['Chandigarh → Delhi', 'Chandigarh → Mumbai', 'Chandigarh → Shimla', 'Chandigarh → Dehradun'],
    depotAddress: 'SpeedLine Depot, Industrial Area Phase II, Chandigarh 160002',
    description: 'Express delivery specialist. Same-day and next-day delivery options.',
    established: '2016', contactPhone: '9876500005'
  },
  {
    id: 'tc-006', name: 'Khalsa Roadways', location: 'Bathinda, Punjab',
    ratePerKg: 4, rating: 4.0, totalRatings: 145,
    routes: ['Bathinda → Delhi', 'Bathinda → Chandigarh', 'Bathinda → Hisar', 'Bathinda → Patiala'],
    depotAddress: 'Khalsa Roadways Terminal, Goniana Road, Bathinda, Punjab 151001',
    description: 'Lowest rates in South Punjab. Specializing in agricultural products.',
    established: '2010', contactPhone: '9876500006'
  },
];

app.get('/gozo/transport-companies', (req, res) => {
  res.json({ success: true, companies: TRANSPORT_COMPANIES });
});

app.get('/gozo/company-images/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Missing companyId' });
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

    console.log(`[GoZo] Trip status updated: requestId=${requestId} status=${status}`);
    res.json({ success: true, status });
  } catch (error) {
    console.error('[GoZo] update-trip-status error:', error);
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


app.get('/health', (req, res) => {
  res.json({
    status: "ok",
    registeredUsers: Object.keys(tokenStore)
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
