import React, {useRef, useEffect, useMemo} from 'react';
import {View, StyleSheet} from 'react-native';
import Mapbox, {
  MapView,
  Camera,
  UserLocation,
  ShapeSource,
  LineLayer,
  SymbolLayer,
  CircleLayer,
  PointAnnotation,
  Images,
} from '@rnmapbox/maps';
import {Coordinate, Route, NavigationMode} from '../types';
import {colors} from '../theme';
import {
  MAPBOX_ACCESS_TOKEN,
  CAMERA_ZOOM_NAVIGATING,
  CAMERA_ZOOM_PREVIEW,
  CAMERA_ZOOM_DEFAULT,
  CAMERA_PITCH_NAVIGATING,
  CAMERA_PITCH_DEFAULT,
  CAMERA_ANIMATION_DURATION,
} from '../constants';

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

interface MapContainerProps {
  currentLocation: Coordinate | null;
  simulatedLocation: Coordinate | null;
  simulatedBearing: number;
  sourceCoords: Coordinate | null;
  destinationCoords: Coordinate | null;
  route: Route | null;
  alternativeRoutes?: Route[];
  selectedRouteIndex?: number;
  navigationMode: NavigationMode;
  onMapReady?: () => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
  currentLocation,
  simulatedLocation,
  simulatedBearing,
  sourceCoords,
  destinationCoords,
  route,
  alternativeRoutes = [],
  selectedRouteIndex = 0,
  navigationMode,
}) => {
  const mapRef = useRef<MapView>(null);
  const cameraRef = useRef<Camera>(null);

  const activeLocation = simulatedLocation || currentLocation;

  // Build main route GeoJSON
  const routeGeoJSON = useMemo(() => {
    if (!route) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {isMain: true},
          geometry: {
            type: 'LineString' as const,
            coordinates: route.rawCoordinates,
          },
        },
      ],
    };
  }, [route]);

  // Build alternative routes GeoJSON
  const altRoutesGeoJSON = useMemo(() => {
    if (alternativeRoutes.length <= 1) return null;
    return {
      type: 'FeatureCollection' as const,
      features: alternativeRoutes
        .filter((_, idx) => idx !== selectedRouteIndex)
        .map((r, idx) => ({
          type: 'Feature' as const,
          properties: {index: idx},
          geometry: {
            type: 'LineString' as const,
            coordinates: r.rawCoordinates,
          },
        })),
    };
  }, [alternativeRoutes, selectedRouteIndex]);

  // Route outline glow effect GeoJSON
  const routeGlowGeoJSON = useMemo(() => {
    if (!route) return null;
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: route.rawCoordinates,
          },
        },
      ],
    };
  }, [route]);

  // Fit camera to show entire route
  useEffect(() => {
    if (
      navigationMode === NavigationMode.ROUTE_PREVIEW &&
      sourceCoords &&
      destinationCoords &&
      cameraRef.current
    ) {
      const sw: [number, number] = [
        Math.min(sourceCoords.longitude, destinationCoords.longitude) - 0.002,
        Math.min(sourceCoords.latitude, destinationCoords.latitude) - 0.002,
      ];
      const ne: [number, number] = [
        Math.max(sourceCoords.longitude, destinationCoords.longitude) + 0.002,
        Math.max(sourceCoords.latitude, destinationCoords.latitude) + 0.002,
      ];
      cameraRef.current.fitBounds(ne, sw, [80, 80, 300, 80], 1000);
    }
  }, [navigationMode, sourceCoords, destinationCoords]);

  const getCameraProps = () => {
    if (navigationMode === NavigationMode.NAVIGATING && activeLocation) {
      return {
        centerCoordinate: [activeLocation.longitude, activeLocation.latitude] as [number, number],
        zoomLevel: CAMERA_ZOOM_NAVIGATING,
        pitch: CAMERA_PITCH_NAVIGATING,
        heading: simulatedBearing,
        animationMode: 'flyTo' as const,
        animationDuration: CAMERA_ANIMATION_DURATION,
      };
    }

    if (activeLocation) {
      return {
        centerCoordinate: [activeLocation.longitude, activeLocation.latitude] as [number, number],
        zoomLevel: CAMERA_ZOOM_DEFAULT,
        pitch: CAMERA_PITCH_DEFAULT,
        animationMode: 'flyTo' as const,
        animationDuration: CAMERA_ANIMATION_DURATION,
      };
    }

    return {
      centerCoordinate: [77.5946, 12.9716] as [number, number], // Default: Bangalore
      zoomLevel: 12,
      animationMode: 'flyTo' as const,
      animationDuration: CAMERA_ANIMATION_DURATION,
    };
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/navigation-night-v1"
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={true}
        compassViewMargins={{x: 16, y: 100}}
        scaleBarEnabled={false}>
        <Camera
          ref={cameraRef}
          {...(navigationMode !== NavigationMode.ROUTE_PREVIEW ? getCameraProps() : {})}
          defaultSettings={{
            centerCoordinate: [77.5946, 12.9716],
            zoomLevel: 12,
          }}
        />

        <UserLocation
          showsUserHeadingIndicator={true}
          androidRenderMode="compass"
          visible={navigationMode !== NavigationMode.NAVIGATING}
        />

        {/* Route glow (wider, semi-transparent line beneath) */}
        {routeGlowGeoJSON && (
          <ShapeSource id="routeGlowSource" shape={routeGlowGeoJSON}>
            <LineLayer
              id="routeGlowLine"
              style={{
                lineColor: colors.routeGlow,
                lineWidth: 14,
                lineCap: 'round',
                lineJoin: 'round',
                lineBlur: 6,
              }}
              belowLayerID="routeLine"
            />
          </ShapeSource>
        )}

        {/* Alternative routes */}
        {altRoutesGeoJSON && (
          <ShapeSource id="altRouteSource" shape={altRoutesGeoJSON}>
            <LineLayer
              id="altRouteLine"
              style={{
                lineColor: colors.routeAlternative,
                lineWidth: 5,
                lineCap: 'round',
                lineJoin: 'round',
                lineDasharray: [2, 2],
              }}
            />
          </ShapeSource>
        )}

        {/* Main route */}
        {routeGeoJSON && (
          <ShapeSource id="routeSource" shape={routeGeoJSON}>
            <LineLayer
              id="routeLine"
              style={{
                lineColor: colors.routeActive,
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Source marker */}
        {sourceCoords && navigationMode !== NavigationMode.NAVIGATING && (
          <PointAnnotation
            id="sourceMarker"
            coordinate={[sourceCoords.longitude, sourceCoords.latitude]}>
            <View style={styles.sourceMarkerOuter}>
              <View style={styles.sourceMarkerInner} />
            </View>
          </PointAnnotation>
        )}

        {/* Destination marker */}
        {destinationCoords && (
          <PointAnnotation
            id="destMarker"
            coordinate={[
              destinationCoords.longitude,
              destinationCoords.latitude,
            ]}>
            <View style={styles.destMarkerOuter}>
              <View style={styles.destMarkerPin} />
              <View style={styles.destMarkerDot} />
            </View>
          </PointAnnotation>
        )}

        {/* Simulated location during navigation */}
        {simulatedLocation && navigationMode === NavigationMode.NAVIGATING && (
          <PointAnnotation
            id="simLocation"
            coordinate={[
              simulatedLocation.longitude,
              simulatedLocation.latitude,
            ]}>
            <View style={styles.navMarkerOuter}>
              <View style={styles.navMarkerInner}>
                <View style={styles.navMarkerCore} />
              </View>
            </View>
          </PointAnnotation>
        )}
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  // Source marker - pulsing green
  sourceMarkerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 212, 126, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sourceMarkerInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.markerSource,
    borderWidth: 3,
    borderColor: '#fff',
  },
  // Destination marker - red pin
  destMarkerOuter: {
    alignItems: 'center',
  },
  destMarkerPin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.markerDestination,
    borderWidth: 3,
    borderColor: '#fff',
  },
  destMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.markerDestination,
    marginTop: -2,
    opacity: 0.5,
  },
  // Navigation marker - blue arrow circle
  navMarkerOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 144, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  navMarkerInner: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  navMarkerCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});

export default MapContainer;
