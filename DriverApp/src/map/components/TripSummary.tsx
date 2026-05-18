import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {colors, typography, spacing, borderRadius, shadows} from '../theme';
import {TripStats} from '../types';
import {formatDistance, formatDuration, formatSpeed} from '../utils/geo';

interface TripSummaryProps {
  tripStats: TripStats;
  destinationName: string;
  onDone: () => void;
}

const TripSummary: React.FC<TripSummaryProps> = ({
  tripStats,
  destinationName,
  onDone,
}) => {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.checkCircle}>
          <Text style={styles.checkIcon}>✓</Text>
        </View>

        <Text style={styles.title}>You've Arrived!</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {destinationName}
        </Text>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatDistance(tripStats.distanceTraveled)}
            </Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatDuration(tripStats.timeTaken)}
            </Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatSpeed(tripStats.averageSpeed)}
            </Text>
            <Text style={styles.statLabel}>Avg Speed</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={onDone}
          activeOpacity={0.8}>
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: colors.overlay, justifyContent: 'center',
    alignItems: 'center', zIndex: 200, padding: spacing.xxl,
  },
  card: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xxl,
    padding: spacing.xxxl, alignItems: 'center', width: '100%',
    maxWidth: 360, borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.success,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xl,
    ...shadows.glow, shadowColor: colors.success,
  },
  checkIcon: { fontSize: 36, color: '#fff', fontWeight: typography.weights.bold },
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.sizes.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl },
  statsGrid: {
    flexDirection: 'row', alignItems: 'center', width: '100%',
    backgroundColor: 'rgba(74, 144, 255, 0.06)', borderRadius: borderRadius.lg,
    paddingVertical: spacing.xl, marginBottom: spacing.xxl,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: colors.borderLight },
  statValue: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.sizes.xs, color: colors.textMuted, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  doneButton: {
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    height: 52, width: '100%', justifyContent: 'center', alignItems: 'center',
    ...shadows.button,
  },
  doneText: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: '#fff' },
});

export default TripSummary;
