import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchDriverLocation } from '../api';

type Props = {
  requestId: string;
  driverName: string;
  driverPhone: string;
  pickupAddress: string;
  dropAddress: string;
  tripStatus: string;
  onBack: () => void;
};

import { MAPBOX_ACCESS_TOKEN as MAPBOX_TOKEN } from '../secrets';

const STATUS_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  matched: { label: 'Heading to Pickup', icon: '🚛', color: '#10B981' },
  picked_up: { label: 'Goods Picked Up', icon: '📦', color: '#10B981' },
  on_the_way: { label: 'On the Way', icon: '🚛', color: '#10B981' },
  completed: { label: 'Delivered!', icon: '🎉', color: '#10B981' },
};

const LiveTrackingScreen = ({
  requestId,
  driverName,
  driverPhone,
  pickupAddress: pickupProp,
  dropAddress: dropProp,
  tripStatus: initialTripStatus,
  onBack,
}: Props) => {
  const webViewRef = useRef<WebView>(null);
  const [currentStatus, setCurrentStatus] = useState(initialTripStatus);
  const [hasLocation, setHasLocation] = useState(false);
  const [eta, setEta] = useState('Calculating...');
  const [displayPickup, setDisplayPickup] = useState(pickupProp);
  const [displayDrop, setDisplayDrop] = useState(dropProp);
  const addressesInjected = useRef(false);

  // Poll driver location every 3 seconds
  useEffect(() => {
    let active = true;

    const poll = async () => {
      if (!active) return;
      const res = await fetchDriverLocation(requestId);
      if (res.success && res.location) {
        // Update addresses from API if we don't have them from props
        if (res.location.pickupAddress && !displayPickup) {
          setDisplayPickup(res.location.pickupAddress);
        }
        if (res.location.dropAddress && !displayDrop) {
          setDisplayDrop(res.location.dropAddress);
        }

        // Inject addresses into WebView if not done yet
        if (!addressesInjected.current && res.location.pickupAddress && res.location.dropAddress) {
          addressesInjected.current = true;
          const addrJs = `
            if (typeof setAddresses === 'function') {
              setAddresses('${(res.location.pickupAddress || '').replace(/'/g, "\\'")}', '${(res.location.dropAddress || '').replace(/'/g, "\\'")}');
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(addrJs);
        }

        const lat = Number(res.location.latitude);
        const lng = Number(res.location.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
          setHasLocation(true);
          setCurrentStatus(res.location.status || currentStatus);

          // Send location to WebView
          const js = `
            if (typeof updateDriverLocation === 'function') {
              updateDriverLocation(
                ${lat},
                ${lng},
                ${res.location.heading || 0},
                '${res.location.status || 'matched'}'
              );
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(js);
        }
      }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [requestId]);

  const statusInfo = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.matched;

  // The Mapbox GL JS HTML for the WebView
  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 100vw; height: 100vh; overflow: hidden; }
  #map { width: 100%; height: 100%; }

  /* Driver marker style - perfectly centered without wobble */
  .driver-marker-wrap {
    position: relative;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .driver-marker-bg {
    position: absolute;
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0) 70%);
    animation: driverPulse 2.5s ease-out infinite;
  }

  .driver-marker-icon {
    width: 42px;
    height: 42px;
    background: linear-gradient(135deg, #059669, #10B981);
    border-radius: 50%;
    border: 3.5px solid #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(16, 185, 129, 0.5);
    z-index: 2;
  }

  .driver-marker-icon svg {
    width: 24px;
    height: 24px;
  }

  .driver-label {
    position: absolute;
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #059669, #10B981);
    color: #FFFFFF;
    font-size: 10px;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 12px;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    letter-spacing: 0.5px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    z-index: 3;
  }

  @keyframes driverPulse {
    0% { transform: scale(0.6); opacity: 0.9; }
    70% { transform: scale(1.8); opacity: 0; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  /* Teardrop Pins pointing exactly down */
  .pin-marker {
    position: relative;
    width: 32px;
    height: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pin-head {
    width: 32px;
    height: 32px;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 10px rgba(0,0,0,0.25);
  }
  .pin-head-inner {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #FFFFFF;
    transform: rotate(45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
  }
  .pickup-pin .pin-head {
    background: #10B981;
  }
  .drop-pin .pin-head {
    background: #EF4444;
  }

  .marker-label {
    position: absolute;
    top: -26px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.9);
    color: #FFFFFF;
    font-size: 9px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 8px;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const logToRN = (type, args) => {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'log',
      level: type,
      message: Array.from(args).map(x => typeof x === 'object' ? JSON.stringify(x) : x).join(' ')
    }));
  };
  console.log = (...args) => logToRN('log', args);
  console.error = (...args) => logToRN('error', args);
  console.warn = (...args) => logToRN('warn', args);

  mapboxgl.accessToken = '${MAPBOX_TOKEN}';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/navigation-night-v1',
    center: [75.78, 30.78],
    zoom: 12,
    pitch: 45,
    attributionControl: false,
  });

  let driverMarker = null;
  let pickupMarker = null;
  let dropMarker = null;
  let currentDriverCoords = null;
  let pickupCoords = null;
  let dropCoords = null;
  let isFirstUpdate = true;
  let lastRouteFetchTime = 0;
  let updateCount = 0;
  let userHasInteracted = false;
  let currentDriverStatus = 'matched';

  map.on('dragstart', function() { userHasInteracted = true; });
  map.on('dblclick', function() { userHasInteracted = false; });

  const truckSVG = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 4h11v9H3V4z" fill="#FFFFFF"/><path d="M14 7h3l3 4v4h-6V7z" fill="#E0E7FF"/><circle cx="7" cy="15.5" r="1.8" fill="#FFFFFF" stroke="#1E40AF" stroke-width="1"/><circle cx="17" cy="15.5" r="1.8" fill="#FFFFFF" stroke="#1E40AF" stroke-width="1"/><path d="M1 15.5h4M10.6 15.5h4.6" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/><path d="M20.8 15.5H22" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/></svg>';

  // Geocode address, parsing coordinates first if available
  async function geocode(address) {
    if (!address) return null;
    
    // Check if it's already a lat/lng string
    const parts = address.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lng, lat]; // Mapbox format: [longitude, latitude]
      }
    }
    
    try {
      const res = await fetch(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        encodeURIComponent(address) +
        '.json?access_token=' + mapboxgl.accessToken + '&limit=1'
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].center;
      }
    } catch (e) {
      console.error('Geocode error:', e);
    }
    return null;
  }

  // Fetch and draw route (rate-limited)
  async function fetchRoute(from, to) {
    try {
      const res = await fetch(
        'https://api.mapbox.com/directions/v5/mapbox/driving/' +
        from[0] + ',' + from[1] + ';' + to[0] + ',' + to[1] +
        '?geometries=geojson&overview=full&access_token=' + mapboxgl.accessToken
      );
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];

        const durationMin = Math.round(route.duration / 60);
        const distKm = (route.distance / 1000).toFixed(1);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'eta',
          duration: durationMin,
          distance: distKm,
        }));

        const geojson = {
          type: 'Feature',
          properties: {},
          geometry: route.geometry,
        };

        if (map.getSource('route')) {
          map.getSource('route').setData(geojson);
        } else {
          map.addLayer({
            id: 'route-glow',
            type: 'line',
            source: { type: 'geojson', data: geojson },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#10B981',
              'line-width': 12,
              'line-opacity': 0.25,
              'line-blur': 5,
            },
          });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: { type: 'geojson', data: geojson },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#34D399',
              'line-width': 5,
              'line-opacity': 0.9,
            },
          });
        }
        lastRouteFetchTime = Date.now();
      }
    } catch (e) {
      console.error('Route error:', e);
    }
  }

  // Initialize pickup and drop markers
  map.on('load', async function() {
    const pickupAddr = '${(pickupProp || '').replace(/'/g, "\\'")}';
    const dropAddr = '${(dropProp || '').replace(/'/g, "\\'")}';
    if (pickupAddr) {
      const pickup = await geocode(pickupAddr);
      if (pickup) addPickupMarker(pickup);
    }
    if (dropAddr) {
      const drop = await geocode(dropAddr);
      if (drop) addDropMarker(drop);
    }
    fitAllMarkers();
  });

  function addPickupMarker(coords) {
    pickupCoords = coords;
    if (pickupMarker) pickupMarker.remove();
    const el = document.createElement('div');
    el.className = 'pin-marker pickup-pin';
    el.innerHTML = '<div class="marker-label">PICKUP</div><div class="pin-head"><div class="pin-head-inner">📍</div></div>';
    pickupMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(coords).addTo(map);
  }

  function addDropMarker(coords) {
    dropCoords = coords;
    if (dropMarker) dropMarker.remove();
    const el = document.createElement('div');
    el.className = 'pin-marker drop-pin';
    el.innerHTML = '<div class="marker-label">DROP DEPOT</div><div class="pin-head"><div class="pin-head-inner">🏭</div></div>';
    dropMarker = new mapboxgl.Marker({ element: el, anchor: 'bottom' }).setLngLat(coords).addTo(map);
  }

  // Smart fit: zoom in to show driver and current target destination (pickup or drop-off)
  function fitAllMarkers() {
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;

    if (currentDriverCoords) {
      bounds.extend(currentDriverCoords);
      hasPoints = true;
    }

    if (currentDriverStatus === 'matched') {
      if (pickupCoords) {
        bounds.extend(pickupCoords);
        hasPoints = true;
      }
    } else {
      // picked_up or on_the_way (moving to depot)
      if (dropCoords) {
        bounds.extend(dropCoords);
        hasPoints = true;
      }
    }

    // Fallback if target coords not resolved yet
    if (!hasPoints) {
      if (pickupCoords) { bounds.extend(pickupCoords); hasPoints = true; }
      if (dropCoords) { bounds.extend(dropCoords); hasPoints = true; }
    }

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1200 });
    }
  }

  // Called from RN when addresses come from API
  async function setAddresses(pickupAddr, dropAddr) {
    if (pickupAddr && !pickupCoords) {
      const coords = await geocode(pickupAddr);
      if (coords) addPickupMarker(coords);
    }
    if (dropAddr && !dropCoords) {
      const coords = await geocode(dropAddr);
      if (coords) addDropMarker(coords);
    }
    fitAllMarkers();
  }

  // Called from React Native every 3 seconds
  function updateDriverLocation(lat, lng, heading, status) {
    const coords = [lng, lat];
    currentDriverCoords = coords;
    currentDriverStatus = status || 'matched';
    updateCount++;

    if (!driverMarker) {
      const el = document.createElement('div');
      el.className = 'driver-marker-wrap';
      el.innerHTML = '<div class="driver-marker-bg"></div>'
        + '<div class="driver-label">${(driverName || "").replace(/'/g, "\\'")}</div>'
        + '<div class="driver-marker-icon">' + truckSVG + '</div>';
      driverMarker = new mapboxgl.Marker({ element: el, anchor: 'center', rotationAlignment: 'map' })
        .setLngLat(coords)
        .addTo(map);
    } else {
      driverMarker.setLngLat(coords);
    }

    if (heading && driverMarker) {
      driverMarker.setRotation(heading);
    }

    // Navigation fix: if goods picked up, target is drop-off depot. If not, target is pickup.
    let destCoords = null;
    if (status === 'matched') {
      destCoords = pickupCoords;
    } else if (status === 'picked_up' || status === 'on_the_way') {
      destCoords = dropCoords;
    }

    // Rate-limit route fetching: only every 15 seconds
    const now = Date.now();
    if (destCoords && (now - lastRouteFetchTime > 15000 || lastRouteFetchTime === 0)) {
      fetchRoute(coords, destCoords);
    }

    // First update: fit relevant markers into view
    if (isFirstUpdate) {
      isFirstUpdate = false;
      fitAllMarkers();
      return;
    }

    // Smoothly follow the driver (unless user dragged)
    if (!userHasInteracted) {
      if (updateCount % 5 === 0) {
        fitAllMarkers();
      } else {
        map.easeTo({
          center: coords,
          duration: 2000,
          easing: function(t) { return t * (2 - t); },
        });
      }
    }
  }
</script>
</body>
</html>
  `;

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'eta') {
        setEta(`${data.duration} min · ${data.distance} km`);
      } else if (data.type === 'log') {
        console.log(`[WebView ${data.level}]`, data.message);
      }
    } catch {}
  };

  return (
    <View style={s.container}>
      {/* Map */}
      <View style={s.mapContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: mapHTML }}
          style={s.webview}
          javaScriptEnabled
          domStorageEnabled
          onMessage={handleWebViewMessage}
          scrollEnabled={false}
          overScrollMode="never"
          setBuiltInZoomControls={false}
        />

        {/* Loading overlay when no location yet */}
        {!hasLocation && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={s.loadingText}>Waiting for driver location...</Text>
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.8}>
          <Text style={s.backBtnText}>←</Text>
        </TouchableOpacity>

        {/* LIVE badge */}
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Bottom Info Panel */}
      <View style={s.bottomPanel}>
        <View style={s.panelHandle} />

        {/* Status Banner */}
        <View style={[s.statusBanner, { backgroundColor: statusInfo.color }]}>
          <Text style={s.statusIcon}>{statusInfo.icon}</Text>
          <Text style={s.statusLabel}>{statusInfo.label}</Text>
          <View style={s.etaBadge}>
            <Text style={s.etaText}>{eta}</Text>
          </View>
        </View>

        {/* Driver Info */}
        <View style={s.driverRow}>
          <View style={s.driverAvatar}>
            <Text style={s.driverAvatarText}>{driverName.charAt(0)}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.driverName}>{driverName}</Text>
            <Text style={s.driverPhone}>📞 {driverPhone}</Text>
          </View>
        </View>

        {/* Route Summary */}
        <View style={s.routeSummary}>
          <View style={s.routeRow}>
            <View style={s.greenDot} />
            <Text style={s.routeText} numberOfLines={1}>{displayPickup || 'Loading pickup...'}</Text>
          </View>
          <View style={s.routeLine} />
          <View style={s.routeRow}>
            <View style={s.redDot} />
            <Text style={s.routeText} numberOfLines={1}>{displayDrop || 'Loading drop-off...'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  mapContainer: { flex: 1, position: 'relative' },
  webview: { flex: 1, backgroundColor: '#0F172A' },

  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#94A3B8', fontSize: 14, fontWeight: '600', marginTop: 12 },

  backBtn: {
    position: 'absolute', top: 16, left: 16,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  backBtnText: { fontSize: 22, color: '#FFFFFF', fontWeight: '400' },

  liveBadge: {
    position: 'absolute', top: 20, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.92)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6,
    elevation: 4,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80', marginRight: 6 },
  liveText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },

  bottomPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 18, paddingBottom: 26,
    elevation: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.18, shadowRadius: 16,
  },
  panelHandle: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: '#E2E8F0', alignSelf: 'center',
    marginTop: 10, marginBottom: 16,
  },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    elevation: 2,
  },
  statusIcon: { fontSize: 24 },
  statusLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 10, flex: 1, letterSpacing: 0.2 },
  etaBadge: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  etaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverAvatarText: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#1A1A1A' },
  driverPhone: { fontSize: 13, color: '#6B6B6B', marginTop: 3, fontWeight: '500' },

  routeSummary: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  greenDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#10B981', marginRight: 12, borderWidth: 2, borderColor: '#A7F3D0' },
  redDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#E53935', marginRight: 12, borderWidth: 2, borderColor: '#FECACA' },
  routeLine: { width: 2, height: 14, backgroundColor: '#E2E8F0', marginLeft: 5 },
  routeText: { fontSize: 13, color: '#1A1A1A', fontWeight: '500', flex: 1 },
});

export default LiveTrackingScreen;
