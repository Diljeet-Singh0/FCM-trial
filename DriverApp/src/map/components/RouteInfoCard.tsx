import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, typography, spacing, borderRadius, shadows} from '../theme';
import {Route} from '../types';
import {formatDistance, formatDuration, formatETA, calculateETA} from '../utils/geo';

interface RouteInfoCardProps {
  route: Route;
  alternativeRoutes: Route[];
  selectedRouteIndex: number;
  onSelectRoute: (index: number) => void;
  onStartNavigation: () => void;
  sourceName: string;
  destinationName: string;
}

const RouteInfoCard: React.FC<RouteInfoCardProps> = ({
  route,
  alternativeRoutes,
  selectedRouteIndex,
  onSelectRoute,
  onStartNavigation,
  sourceName,
  destinationName,
}) => {
  const eta = calculateETA(route.duration);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.summaryRow}>
          <View style={styles.etaContainer}>
            <Text style={styles.etaTime}>{formatETA(eta)}</Text>
            <Text style={styles.etaLabel}>ETA</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statContainer}>
            <Text style={styles.statValue}>{formatDuration(route.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statContainer}>
            <Text style={styles.statValue}>{formatDistance(route.distance)}</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
        </View>

        <View style={styles.endpointsRow}>
          <View style={styles.endpointDot}>
            <View style={[styles.dot, {backgroundColor: colors.markerSource}]} />
          </View>
          <Text style={styles.endpointText} numberOfLines={1}>{sourceName}</Text>
        </View>
        <View style={styles.endpointsRow}>
          <View style={styles.endpointDot}>
            <View style={[styles.dot, {backgroundColor: colors.markerDestination}]} />
          </View>
          <Text style={styles.endpointText} numberOfLines={1}>{destinationName}</Text>
        </View>

        {alternativeRoutes.length > 1 && (
          <View style={styles.alternativesRow}>
            {alternativeRoutes.map((altRoute, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.altRouteChip,
                  idx === selectedRouteIndex && styles.altRouteChipActive,
                ]}
                onPress={() => onSelectRoute(idx)}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.altRouteText,
                    idx === selectedRouteIndex && styles.altRouteTextActive,
                  ]}>
                  {formatDuration(altRoute.duration)}
                </Text>
                <Text
                  style={[
                    styles.altRouteSubtext,
                    idx === selectedRouteIndex && styles.altRouteSubtextActive,
                  ]}>
                  {formatDistance(altRoute.distance)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.startButton}
          onPress={onStartNavigation}
          activeOpacity={0.8}>
          <Text style={styles.startIcon}>▶</Text>
          <Text style={styles.startText}>Start Navigation</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    padding: spacing.xl, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  etaContainer: { flex: 1, alignItems: 'center' },
  etaTime: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.black, color: colors.success },
  etaLabel: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  divider: { width: 1, height: 36, backgroundColor: colors.borderLight },
  statContainer: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.sizes.xs, fontWeight: typography.weights.medium, color: colors.textMuted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 1 },
  endpointsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  endpointDot: { width: 20, marginRight: spacing.md, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  endpointText: { flex: 1, fontSize: typography.sizes.sm, color: colors.textSecondary, fontWeight: typography.weights.medium },
  alternativesRow: { flexDirection: 'row', marginTop: spacing.lg, marginBottom: spacing.sm, gap: spacing.sm },
  altRouteChip: { flex: 1, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: borderRadius.sm, backgroundColor: 'rgba(74, 144, 255, 0.08)', borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  altRouteChipActive: { backgroundColor: 'rgba(74, 144, 255, 0.2)', borderColor: colors.primary },
  altRouteText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.bold, color: colors.textSecondary },
  altRouteTextActive: { color: colors.primary },
  altRouteSubtext: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 2 },
  altRouteSubtextActive: { color: colors.primaryLight },
  startButton: { flexDirection: 'row', backgroundColor: colors.success, borderRadius: borderRadius.md, height: 56, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg, ...shadows.button, shadowColor: colors.success },
  startIcon: { fontSize: 16, color: '#fff', marginRight: spacing.sm },
  startText: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#fff', letterSpacing: 0.5 },
});

export default RouteInfoCard;
