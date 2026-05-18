import React, {useState, useCallback} from 'react';
import {View, StyleSheet, StatusBar, TouchableOpacity, Text} from 'react-native';
import {useNavigation as useRNNavigation, useRoute as useRNRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {colors, spacing, borderRadius, shadows} from '../theme';
import {Coordinate, NavigationMode, RootStackParamList} from '../types';
import {useLocation} from '../hooks/useLocation';
import {useRoute} from '../hooks/useRoute';
import {reverseGeocode} from '../utils/mapbox';
import MapContainer from '../components/MapContainer';
import SearchPanel from '../components/SearchPanel';
import RouteInfoCard from '../components/RouteInfoCard';

type MapHomeNavigationProp = StackNavigationProp<RootStackParamList, 'MapHome'>;
type MapHomeRouteProp = RouteProp<RootStackParamList, 'MapHome'>;

const MapHomeScreen: React.FC = () => {
  const navigation = useRNNavigation<MapHomeNavigationProp>();
  const rnRoute = useRNRoute<MapHomeRouteProp>();
  const {currentLocation} = useLocation();
  const {route, alternativeRoutes, selectedRouteIndex, loading, getAlternatives, selectRoute, clearRoute} = useRoute();

  // Pre-fill destination from navigation params if available
  const initialDestination = rnRoute.params?.destinationAddress || '';
  const initialDestCoords = rnRoute.params?.destinationCoords || null;

  const [sourceAddress, setSourceAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState(initialDestination);
  const [sourceCoords, setSourceCoords] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(initialDestCoords);
  const [sourceName, setSourceName] = useState('');
  const [destinationName, setDestinationName] = useState(initialDestination);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(NavigationMode.IDLE);

  // Auto-fetch route if destination was pre-filled
  const hasAutoFetched = React.useRef(false);
  React.useEffect(() => {
    if (initialDestCoords && currentLocation && !hasAutoFetched.current) {
      hasAutoFetched.current = true;
      setSourceCoords(currentLocation);
      setSourceAddress('Current Location');
      setSourceName('Current Location');
      getAlternatives(currentLocation, initialDestCoords).then(() => {
        setNavigationMode(NavigationMode.ROUTE_PREVIEW);
      });
    }
  }, [initialDestCoords, currentLocation, getAlternatives]);

  const handleSourceSelect = useCallback((coordinate: Coordinate, name: string) => {
    setSourceCoords(coordinate);
    setSourceAddress(name);
    setSourceName(name);
  }, []);

  const handleDestinationSelect = useCallback((coordinate: Coordinate, name: string) => {
    setDestinationCoords(coordinate);
    setDestinationAddress(name);
    setDestinationName(name);
  }, []);

  const handleUseCurrentLocation = useCallback(async () => {
    if (currentLocation) {
      setSourceCoords(currentLocation);
      setSourceAddress('Current Location');
      setSourceName('Current Location');
      const name = await reverseGeocode(currentLocation);
      if (name !== 'Unknown Location') {
        setSourceName(name);
      }
    }
  }, [currentLocation]);

  const handleSwapLocations = useCallback(() => {
    const tempAddr = sourceAddress;
    const tempCoords = sourceCoords;
    const tempName = sourceName;
    setSourceAddress(destinationAddress);
    setSourceCoords(destinationCoords);
    setSourceName(destinationName);
    setDestinationAddress(tempAddr);
    setDestinationCoords(tempCoords);
    setDestinationName(tempName);
    if (route) {
      clearRoute();
      setNavigationMode(NavigationMode.IDLE);
    }
  }, [sourceAddress, sourceCoords, sourceName, destinationAddress, destinationCoords, destinationName, route, clearRoute]);

  const handleGetRoute = useCallback(async () => {
    let src = sourceCoords;
    let dst = destinationCoords;

    if (!src && currentLocation) {
      src = currentLocation;
      setSourceCoords(currentLocation);
      setSourceAddress('Current Location');
      setSourceName('Current Location');
    }

    if (!src || !dst) return;

    await getAlternatives(src, dst);
    setNavigationMode(NavigationMode.ROUTE_PREVIEW);
  }, [sourceCoords, destinationCoords, currentLocation, getAlternatives]);

  const handleStartNavigation = useCallback(() => {
    if (!route || !sourceCoords || !destinationCoords) return;
    navigation.navigate('Navigation', {
      route,
      sourceCoords,
      destinationCoords,
      sourceName: sourceName || 'Start',
      destinationName: destinationName || 'Destination',
    });
  }, [route, sourceCoords, destinationCoords, sourceName, destinationName, navigation]);

  const handleSelectRoute = useCallback((index: number) => {
    selectRoute(index);
  }, [selectRoute]);

  const handleRecenter = useCallback(() => {
    // Camera will auto-recenter due to currentLocation change
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.statusBar}
        translucent
      />

      <MapContainer
        currentLocation={currentLocation}
        simulatedLocation={null}
        simulatedBearing={0}
        sourceCoords={sourceCoords}
        destinationCoords={destinationCoords}
        route={route}
        alternativeRoutes={alternativeRoutes}
        selectedRouteIndex={selectedRouteIndex}
        navigationMode={navigationMode}
      />

      {/* Search Panel - visible when not in route preview */}
      {navigationMode !== NavigationMode.ROUTE_PREVIEW && (
        <View style={styles.searchOverlay}>
          <SearchPanel
            sourceAddress={sourceAddress}
            destinationAddress={destinationAddress}
            onSourceChange={setSourceAddress}
            onDestinationChange={setDestinationAddress}
            onSourceSelect={handleSourceSelect}
            onDestinationSelect={handleDestinationSelect}
            onUseCurrentLocation={handleUseCurrentLocation}
            onGetRoute={handleGetRoute}
            onSwapLocations={handleSwapLocations}
            currentLocation={currentLocation}
            loading={loading}
            hasRoute={!!route}
          />
        </View>
      )}

      {/* Route Info Card - visible in route preview */}
      {navigationMode === NavigationMode.ROUTE_PREVIEW && route && (
        <RouteInfoCard
          route={route}
          alternativeRoutes={alternativeRoutes}
          selectedRouteIndex={selectedRouteIndex}
          onSelectRoute={handleSelectRoute}
          onStartNavigation={handleStartNavigation}
          sourceName={sourceName}
          destinationName={destinationName}
        />
      )}

      {/* Back to search button in route preview */}
      {navigationMode === NavigationMode.ROUTE_PREVIEW && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setNavigationMode(NavigationMode.IDLE);
            clearRoute();
          }}
          activeOpacity={0.8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      )}

      {/* Back to driver app button (always visible) */}
      {navigationMode !== NavigationMode.ROUTE_PREVIEW && (
        <TouchableOpacity
          style={styles.backToAppButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
      )}

      {/* Recenter button */}
      <TouchableOpacity
        style={[
          styles.recenterButton,
          navigationMode === NavigationMode.ROUTE_PREVIEW && styles.recenterButtonPreview,
        ]}
        onPress={handleRecenter}
        activeOpacity={0.8}>
        <Text style={styles.recenterIcon}>◎</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchOverlay: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50 },
  backButton: {
    position: 'absolute', top: spacing.section + spacing.sm, left: spacing.lg,
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', zIndex: 60,
    borderWidth: 1, borderColor: colors.border, ...shadows.soft,
  },
  backToAppButton: {
    position: 'absolute', top: spacing.section + spacing.sm, left: spacing.lg,
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center', zIndex: 40,
    borderWidth: 1, borderColor: colors.border, ...shadows.soft,
  },
  backIcon: { fontSize: 22, color: colors.textPrimary, fontWeight: '700' },
  recenterButton: {
    position: 'absolute', right: spacing.lg, bottom: spacing.xxxl,
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.soft,
  },
  recenterButtonPreview: { bottom: 240 },
  recenterIcon: { fontSize: 22, color: colors.primary },
});

export default MapHomeScreen;
