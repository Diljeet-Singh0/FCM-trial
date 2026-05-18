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
  matched: { label: 'Heading to Pickup', icon: '🚛', color: '#F59E0B' },
  picked_up: { label: 'Goods Picked Up', icon: '📦', color: '#0369A1' },
  on_the_way: { label: 'On the Way', icon: '🚛', color: '#1A56DB' },
  completed: { label: 'Delivered!', icon: '🎉', color: '#16A34A' },
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

        if (res.location.latitude && res.location.longitude) {
          setHasLocation(true);
          setCurrentStatus(res.location.status || currentStatus);

          // Send location to WebView
          const js = `
            if (typeof updateDriverLocation === 'function') {
              updateDriverLocation(
                ${res.location.latitude},
                ${res.location.longitude},
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
  
  .truck-marker {
    width: 44px;
    height: 44px;
    background: #1A56DB;
    border-radius: 50%;
    border: 3px solid #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    box-shadow: 0 4px 16px rgba(26, 86, 219, 0.5);
    transition: transform 0.3s ease;
  }
  
  .pickup-marker {
    width: 32px;
    height: 32px;
    background: #22C55E;
    border-radius: 50%;
    border: 3px solid #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
  }

  .drop-marker {
    width: 32px;
    height: 32px;
    background: #EF4444;
    border-radius: 50%;
    border: 3px solid #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    box-shadow: 0 2px 8px rgba(239, 68, 68, 0.4);
  }

  .marker-label {
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.75);
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }

  .pulse-ring {
    position: absolute;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: rgba(26, 86, 219, 0.2);
    animation: pulse 2s infinite;
    top: -8px;
    left: -8px;
  }

  @keyframes pulse {
    0% { transform: scale(0.8); opacity: 1; }
    100% { transform: scale(2); opacity: 0; }
  }
</style>
</head>
<body>
<div id="map"></div>
<script>
  mapboxgl.accessToken = '${MAPBOX_TOKEN}';
  
  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/navigation-night-v1',
    center: [75.78, 30.78],
    zoom: 13,
    pitch: 45,
    attributionControl: false,
  });

  let driverMarker = null;
  let pickupMarker = null;
  let dropMarker = null;
  let routeAdded = false;
  let currentDriverCoords = null;
  let pickupCoords = null;
  let dropCoords = null;
  let isFirstUpdate = true;

  // Geocode addresses to get coordinates
  async function geocode(address) {
    try {
      const res = await fetch(
        'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        encodeURIComponent(address) +
        '.json?access_token=' + mapboxgl.accessToken + '&limit=1'
      );
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        return data.features[0].center; // [lng, lat]
      }
    } catch (e) {
      console.error('Geocode error:', e);
    }
    return null;
  }

  // Fetch and draw route
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
        
        // Update ETA
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
              'line-color': '#1A56DB',
              'line-width': 10,
              'line-opacity': 0.3,
              'line-blur': 4,
            },
          });
          map.addLayer({
            id: 'route',
            type: 'line',
            source: { type: 'geojson', data: geojson },
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': '#3B82F6',
              'line-width': 5,
              'line-opacity': 0.9,
            },
          });
        }
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
    el.style.position = 'relative';
    el.innerHTML = '<div class="marker-label">Pickup</div><div class="pickup-marker">📍</div>';
    pickupMarker = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
  }

  function addDropMarker(coords) {
    dropCoords = coords;
    if (dropMarker) dropMarker.remove();
    const el = document.createElement('div');
    el.style.position = 'relative';
    el.innerHTML = '<div class="marker-label">Drop-off</div><div class="drop-marker">🏭</div>';
    dropMarker = new mapboxgl.Marker({ element: el }).setLngLat(coords).addTo(map);
  }

  function fitAllMarkers() {
    const bounds = new mapboxgl.LngLatBounds();
    let hasPoints = false;
    if (pickupCoords) { bounds.extend(pickupCoords); hasPoints = true; }
    if (dropCoords) { bounds.extend(dropCoords); hasPoints = true; }
    if (currentDriverCoords) { bounds.extend(currentDriverCoords); hasPoints = true; }
    if (hasPoints) map.fitBounds(bounds, { padding: 80, maxZoom: 18 });
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

    if (!driverMarker) {
      const el = document.createElement('div');
      el.style.position = 'relative';
      el.innerHTML = '<div class="pulse-ring"></div><div class="truck-marker">🚛</div>';
      driverMarker = new mapboxgl.Marker({ element: el, rotationAlignment: 'map' })
        .setLngLat(coords)
        .addTo(map);
    } else {
      driverMarker.setLngLat(coords);
    }

    // Rotate truck based on heading
    if (heading && driverMarker) {
      driverMarker.setRotation(heading);
    }

    // Determine destination based on status
    let destCoords = null;
    if (status === 'matched' || status === 'picked_up') {
      destCoords = pickupCoords;
    } else if (status === 'on_the_way') {
      destCoords = dropCoords;
    }

    // Fetch route from driver to destination
    if (destCoords) {
      fetchRoute(coords, destCoords);
    }

    // Center map on first update
    if (isFirstUpdate) {
      isFirstUpdate = false;
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(coords);
      if (pickupCoords) bounds.extend(pickupCoords);
      if (dropCoords) bounds.extend(dropCoords);
      map.fitBounds(bounds, { padding: 80, maxZoom: 18 });
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
            <ActivityIndicator size="large" color="#3B82F6" />
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { color: '#94A3B8', fontSize: 14, fontWeight: '600', marginTop: 12 },

  backBtn: {
    position: 'absolute', top: 16, left: 16,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  backBtnText: { fontSize: 22, color: '#FFFFFF', fontWeight: '300' },

  liveBadge: {
    position: 'absolute', top: 20, right: 16,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(22, 163, 74, 0.9)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF', marginRight: 6 },
  liveText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },

  bottomPanel: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingBottom: 24,
    elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 12,
  },
  panelHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#D1D5DB', alignSelf: 'center',
    marginTop: 10, marginBottom: 14,
  },

  statusBanner: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 14, padding: 14, marginBottom: 14,
  },
  statusIcon: { fontSize: 24 },
  statusLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginLeft: 10, flex: 1 },
  etaBadge: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  etaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },

  driverRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  driverAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#1A56DB',
    justifyContent: 'center', alignItems: 'center',
  },
  driverAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  driverName: { fontSize: 16, fontWeight: '700', color: '#111827' },
  driverPhone: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  routeSummary: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12 },
  routeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22C55E', marginRight: 10 },
  redDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginRight: 10 },
  routeLine: { width: 2, height: 12, backgroundColor: '#D1D5DB', marginLeft: 4 },
  routeText: { fontSize: 13, color: '#374151', fontWeight: '500', flex: 1 },
});

export default LiveTrackingScreen;
