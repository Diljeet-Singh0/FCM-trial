import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  ActivityIndicator,
  PermissionsAndroid,
  Alert,
  Keyboard,
  FlatList,
  Platform,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import Geolocation from 'react-native-geolocation-service';

import { MAPBOX_ACCESS_TOKEN as MAPBOX_TOKEN } from '../secrets';

type PickedLocation = {
  latitude: number;
  longitude: number;
  address: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  initialAddress?: string;
};

type SearchResult = {
  id: string;
  place_name: string;
  center: [number, number];
};

const MapLocationPicker = ({ visible, onClose, onConfirm, initialAddress }: Props) => {
  const webViewRef = useRef<WebView>(null);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setAddress('');
      setCoords(null);
      setIsLoading(true);
      setSearchQuery('');
      setSearchResults([]);
      setShowSearchResults(false);
    }
  }, [visible]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    try {
      setIsSearching(true);
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          query,
        )}.json?access_token=${MAPBOX_TOKEN}&country=in&limit=5`,
      );
      const data = await res.json();
      if (data.features) {
        setSearchResults(
          data.features.map((f: any) => ({
            id: f.id,
            place_name: f.place_name,
            center: f.center,
          })),
        );
        setShowSearchResults(true);
      }
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const onSearchTextChange = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => handleSearch(text), 400);
  };

  const selectSearchResult = (result: SearchResult) => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    Keyboard.dismiss();
    // Move map to selected location
    const js = `
      if (map) {
        map.flyTo({ center: [${result.center[0]}, ${result.center[1]}], zoom: 16, duration: 1200 });
      }
      true;
    `;
    webViewRef.current?.injectJavaScript(js);
  };

  const goToCurrentLocation = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Location permission is required.');
        return;
      }
      Geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const js = `
            if (map) {
              map.flyTo({ center: [${longitude}, ${latitude}], zoom: 16, duration: 1000 });
            }
            true;
          `;
          webViewRef.current?.injectJavaScript(js);
        },
        (error) => {
          Alert.alert('Error', 'Could not get location: ' + error.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } catch (err) {
      console.warn(err);
    }
  };

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'center_changed') {
        setCoords({ lat: data.lat, lng: data.lng });
        if (data.geocoding) {
          // Geocoding in progress — only update address if we don't have one yet
          if (data.address) {
            setAddress(data.address);
          } else if (!address) {
            setAddress('Resolving address...');
          }
          setIsGeocoding(true);
        } else {
          // Geocoding complete — update with final address
          setAddress(data.address || `${data.lat.toFixed(5)}, ${data.lng.toFixed(5)}`);
          setIsGeocoding(false);
        }
      } else if (data.type === 'map_loaded') {
        setIsLoading(false);
      }
    } catch {}
  };

  const handleConfirm = () => {
    if (coords && address && address !== 'Resolving address...') {
      onConfirm({
        latitude: coords.lat,
        longitude: coords.lng,
        address,
      });
    }
  };

  const mapHTML = useMemo(() => `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<script src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"></script>
<link href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css" rel="stylesheet" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 100vw; height: 100vh; overflow: hidden; touch-action: none; }
  #map { width: 100%; height: 100%; }

  /* Center pin */
  .center-pin {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -100%);
    z-index: 10;
    pointer-events: none;
    will-change: transform;
    transition: transform 0.15s ease;
  }
  .center-pin.dragging {
    transform: translate(-50%, -115%);
  }
  .pin-svg {
    width: 48px;
    height: 48px;
    filter: drop-shadow(0 4px 8px rgba(0,0,0,0.35));
  }
  .pin-shadow {
    position: absolute;
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    width: 14px;
    height: 6px;
    background: rgba(0,0,0,0.25);
    border-radius: 50%;
    will-change: width, height, opacity;
    transition: all 0.15s ease;
  }
  .center-pin.dragging .pin-shadow {
    width: 10px;
    height: 4px;
    opacity: 0.4;
  }
</style>
</head>
<body>
<div id="map"></div>
<div class="center-pin" id="centerPin">
  <svg class="pin-svg" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pinGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" style="stop-color:#EF4444;stop-opacity:1" />
        <stop offset="100%" style="stop-color:#DC2626;stop-opacity:1" />
      </linearGradient>
    </defs>
    <path d="M24 2C15.163 2 8 9.163 8 18c0 12 16 28 16 28s16-16 16-28C40 9.163 32.837 2 24 2z" fill="url(#pinGrad)" stroke="#B91C1C" stroke-width="1"/>
    <circle cx="24" cy="18" r="7" fill="#FFFFFF"/>
    <circle cx="24" cy="18" r="3" fill="#EF4444"/>
  </svg>
  <div class="pin-shadow"></div>
</div>

<script>
  mapboxgl.accessToken = '${MAPBOX_TOKEN}';
  let geocodeTimeout = null;
  let isDragging = false;
  let geocodeGeneration = 0;
  let lastResolvedAddr = '';
  let lastLat = null;
  let lastLng = null;
  const pinEl = document.getElementById('centerPin');

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [75.78, 30.78],
    zoom: 14,
    attributionControl: false,
    fadeDuration: 0,
  });

  map.on('load', function() {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'map_loaded' }));
    const c = map.getCenter();
    lastLat = c.lat;
    lastLng = c.lng;
    doGeocode(c.lat, c.lng);
  });

  map.on('movestart', function() {
    isDragging = true;
    pinEl.classList.add('dragging');
    if (geocodeTimeout) clearTimeout(geocodeTimeout);
    geocodeGeneration++;
  });

  map.on('moveend', function() {
    isDragging = false;
    pinEl.classList.remove('dragging');
    const center = map.getCenter();
    
    if (lastLat !== null && lastLng !== null) {
      const dLat = Math.abs(center.lat - lastLat);
      const dLng = Math.abs(center.lng - lastLng);
      // If the map just resized without panning, don't re-geocode
      if (dLat < 0.00001 && dLng < 0.00001) return;
    }
    lastLat = center.lat;
    lastLng = center.lng;

    doGeocode(center.lat, center.lng);
  });

  function doGeocode(lat, lng) {
    if (geocodeTimeout) clearTimeout(geocodeTimeout);
    geocodeGeneration++;
    const myGen = geocodeGeneration;

    // Send coordinates immediately but keep the last known address
    // so the UI doesn't flash "Resolving..." on every micro-move
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'center_changed',
      lat: lat,
      lng: lng,
      address: lastResolvedAddr || '',
      geocoding: true,
    }));

    geocodeTimeout = setTimeout(async function() {
      if (isDragging || myGen !== geocodeGeneration) return;
      try {
        const res = await fetch(
          'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
          lng + ',' + lat +
          '.json?access_token=' + mapboxgl.accessToken + '&types=address,poi,place,locality,neighborhood&limit=1'
        );
        const data = await res.json();
        if (isDragging || myGen !== geocodeGeneration) return;
        let addr = lat.toFixed(5) + ', ' + lng.toFixed(5);
        if (data.features && data.features.length > 0) {
          addr = data.features[0].place_name;
        }
        lastResolvedAddr = addr;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'center_changed',
          lat: lat,
          lng: lng,
          address: addr,
          geocoding: false,
        }));
      } catch (e) {
        if (isDragging || myGen !== geocodeGeneration) return;
        const fallback = lat.toFixed(5) + ', ' + lng.toFixed(5);
        lastResolvedAddr = fallback;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'center_changed',
          lat: lat,
          lng: lng,
          address: fallback,
          geocoding: false,
        }));
      }
    }, 700);
  }
</script>
</body>
</html>
  `, []);

  const webViewSource = useMemo(() => ({ html: mapHTML }), [mapHTML]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={s.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

        {/* Search Bar */}
        <View style={s.searchContainer}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeBtnText}>←</Text>
          </TouchableOpacity>
          <View style={s.searchInputWrap}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              style={s.searchInput}
              placeholder="Search for a place..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={onSearchTextChange}
              returnKeyType="search"
            />
            {isSearching && (
              <ActivityIndicator size="small" color="#1A56DB" style={{ marginRight: 8 }} />
            )}
            {searchQuery.length > 0 && !isSearching && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowSearchResults(false);
                }}
                style={s.clearBtn}
              >
                <Text style={s.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View style={s.searchDropdown}>
            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={s.searchResultItem}
                onPress={() => selectSearchResult(item)}
              >
                <Text style={s.searchResultIcon}>📍</Text>
                <Text style={s.searchResultText} numberOfLines={2}>
                  {item.place_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Map WebView */}
        <View style={s.mapContainer}>
          <WebView
            ref={webViewRef}
            source={webViewSource}
            style={s.webview}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleWebViewMessage}
            scrollEnabled={false}
            overScrollMode="never"
            androidLayerType="hardware"
            renderToHardwareTextureAndroid
            nestedScrollEnabled={false}
            cacheEnabled
            startInLoadingState={false}
          />

          {/* Loading overlay */}
          {isLoading && (
            <View style={s.loadingOverlay}>
              <ActivityIndicator size="large" color="#1A56DB" />
              <Text style={s.loadingText}>Loading map...</Text>
            </View>
          )}

          {/* GPS Button */}
          <TouchableOpacity style={s.gpsButton} onPress={goToCurrentLocation} activeOpacity={0.8}>
            <Text style={s.gpsButtonIcon}>◎</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom Address Bar + Confirm */}
        <View style={s.bottomBar}>
          <View style={s.addressRow}>
            <View style={s.addressDot} />
            <View style={s.addressContent}>
              <Text style={s.addressLabel}>Selected Location</Text>
              <View style={s.addressTextWrapper}>
                {isGeocoding ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#1A56DB" style={{ marginRight: 8 }} />
                    <Text style={s.addressResolving}>Resolving address...</Text>
                  </View>
                ) : (
                  <Text style={s.addressText} numberOfLines={2}>
                    {address || 'Move the map to select a location'}
                  </Text>
                )}
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[
              s.confirmBtn,
              (!coords || isGeocoding || !address) && s.confirmBtnDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!coords || isGeocoding || !address}
            activeOpacity={0.8}
          >
            <Text style={s.confirmBtnText}>✓  Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F4F8',
  },

  // Search bar
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 52,
    paddingBottom: 12,
    backgroundColor: '#1A56DB',
    zIndex: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  closeBtnText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontWeight: '400',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    paddingVertical: 11,
  },
  clearBtn: {
    padding: 6,
  },
  clearBtnText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },

  // Search dropdown
  searchDropdown: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 64 : 108,
    left: 64,
    right: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    elevation: 8,
    shadowColor: '#1A3B6D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    zIndex: 30,
    maxHeight: 260,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  searchResultIcon: {
    fontSize: 16,
    marginRight: 10,
  },
  searchResultText: {
    fontSize: 14,
    color: '#334155',
    flex: 1,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Map
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#E2E8F0',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 10,
  },

  // GPS button
  gpsButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gpsButtonIcon: {
    fontSize: 24,
    color: '#1A56DB',
  },

  // Bottom bar
  bottomBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 26,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    elevation: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  addressDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#EF4444',
    borderWidth: 2.5,
    borderColor: '#FECACA',
    marginTop: 3,
    marginRight: 12,
  },
  addressContent: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  addressTextWrapper: {
    minHeight: 42,
    justifyContent: 'center',
  },
  addressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    lineHeight: 21,
  },
  addressResolving: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
  },
  confirmBtn: {
    backgroundColor: '#1A56DB',
    borderRadius: 14,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#1A56DB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmBtnDisabled: {
    backgroundColor: '#93C5FD',
    elevation: 0,
    shadowOpacity: 0,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

export default MapLocationPicker;
