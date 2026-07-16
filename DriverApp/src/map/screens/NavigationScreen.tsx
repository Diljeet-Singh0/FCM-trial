import React, {useEffect, useCallback} from 'react';
import {View, Text, TouchableOpacity, StyleSheet, StatusBar} from 'react-native';
import {useNavigation as useRNNavigation, useRoute as useRNRoute, RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {colors, typography, spacing, borderRadius, shadows} from '../theme';
import {NavigationMode, RootStackParamList} from '../types';
import {useNavigation} from '../hooks/useNavigation';
import {formatDistance, formatDuration, formatETA, calculateETA} from '../utils/geo';
import MapContainer from '../components/MapContainer';
import NavigationHUD from '../components/NavigationHUD';
import TripSummary from '../components/TripSummary';

type NavigationScreenRouteProp = RouteProp<RootStackParamList, 'Navigation'>;
type NavigationScreenNavProp = StackNavigationProp<RootStackParamList, 'Navigation'>;

const NavigationScreen: React.FC = () => {
  const rnNavigation = useRNNavigation<NavigationScreenNavProp>();
  const rnRoute = useRNRoute<NavigationScreenRouteProp>();
  const {route, sourceCoords, destinationCoords, sourceName, destinationName} = rnRoute.params;

  const {
    navigationState,
    liveLocation,
    liveBearing,
    tripStats,
    activeRoute,
    startNavigation,
    stopNavigation,
    isActive,
  } = useNavigation();

  useEffect(() => {
    if (route) {
      startNavigation(route, destinationCoords);
    }
    return () => {
      stopNavigation();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExit = useCallback(() => {
    stopNavigation();
    rnNavigation.goBack();
  }, [stopNavigation, rnNavigation]);

  const handleDone = useCallback(() => {
    stopNavigation();
    rnNavigation.goBack();
  }, [stopNavigation, rnNavigation]);

  const eta = calculateETA(navigationState.remainingDuration);
  const isArrived = navigationState.mode === NavigationMode.ARRIVED;

  // Use the activeRoute (which updates on reroute) or fall back to original route
  const displayRoute = activeRoute || route;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <MapContainer
        currentLocation={liveLocation || sourceCoords}
        simulatedLocation={liveLocation || sourceCoords}
        simulatedBearing={liveBearing}
        sourceCoords={sourceCoords}
        destinationCoords={destinationCoords}
        route={displayRoute}
        navigationMode={NavigationMode.NAVIGATING}
        currentRouteIndex={navigationState.currentRouteIndex}
      />

      {/* Navigation HUD */}
      {isActive && !isArrived && (
        <NavigationHUD navigationState={navigationState} />
      )}

      {/* Bottom bar with ETA & controls */}
      {isActive && !isArrived && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomCard}>
            <View style={styles.bottomRow}>
              <View style={styles.etaSection}>
                <Text style={styles.etaTime}>{formatETA(eta)}</Text>
                <Text style={styles.etaLabel}>ETA</Text>
              </View>
              <View style={styles.remainingSection}>
                <Text style={styles.remainingValue}>
                  {formatDistance(navigationState.remainingDistance)}
                </Text>
                <Text style={styles.remainingLabel}>
                  {formatDuration(navigationState.remainingDuration)} left
                </Text>
              </View>
              <View style={styles.destSection}>
                <View style={styles.destDot} />
                <Text style={styles.destText} numberOfLines={1}>
                  {destinationName}
                </Text>
              </View>
            </View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {width: `${Math.min(navigationState.progress * 100, 100)}%`},
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Exit button */}
      {isActive && !isArrived && (
        <TouchableOpacity
          style={styles.exitButton}
          onPress={handleExit}
          activeOpacity={0.8}>
          <Text style={styles.exitIcon}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Trip Summary overlay */}
      {isArrived && tripStats && (
        <TripSummary
          tripStats={tripStats}
          destinationName={destinationName}
          onDone={handleDone}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl,
  },
  bottomCard: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  etaSection: { marginRight: spacing.lg },
  etaTime: { fontSize: typography.sizes.xl, fontWeight: typography.weights.black, color: colors.success },
  etaLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  remainingSection: { marginRight: spacing.lg },
  remainingValue: { fontSize: typography.sizes.md, fontWeight: typography.weights.bold, color: colors.textPrimary },
  remainingLabel: { fontSize: typography.sizes.xs, color: colors.textSecondary },
  destSection: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  destDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.markerDestination, marginRight: spacing.sm },
  destText: { flex: 1, fontSize: typography.sizes.sm, color: colors.textSecondary, fontWeight: typography.weights.medium },
  progressContainer: { marginTop: spacing.xs },
  progressBg: { height: 4, backgroundColor: 'rgba(74, 144, 255, 0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 2 },
  exitButton: {
    position: 'absolute', right: spacing.lg, bottom: 140,
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border, ...shadows.soft,
  },
  exitIcon: { fontSize: 18, color: colors.danger, fontWeight: typography.weights.bold },
});

export default NavigationScreen;
