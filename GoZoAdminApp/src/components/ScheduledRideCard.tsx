import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import StatusBadge from './StatusBadge';
import { ScheduledRide } from '../api';

interface ScheduledRideCardProps {
  ride: ScheduledRide;
  onPress: () => void;
}

export default function ScheduledRideCard({ ride, onPress }: ScheduledRideCardProps) {
  // Format scheduled time
  const time = ride.scheduled_time
    ? new Date(ride.scheduled_time).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const date = ride.scheduled_time
    ? new Date(ride.scheduled_time).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View>
          <Text style={styles.bookingId}>ID: {ride.booking_id || ride.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.timeText}>Sched: {date} at {time}</Text>
        </View>
        <StatusBadge status={ride.status} />
      </View>

      <View style={styles.divider} />

      <View style={styles.routeContainer}>
        <View style={styles.dotContainer}>
          <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
          <View style={styles.dotLine} />
          <View style={[styles.dot, { backgroundColor: COLORS.cancelled }]} />
        </View>
        <View style={styles.addressContainer}>
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.pickup_location}
          </Text>
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.drop_location}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>GOODS / DETAILS</Text>
          <Text style={styles.valueText} numberOfLines={1}>
            {ride.goods_description || 'No description provided'}
          </Text>
        </View>
        
        {ride.driver ? (
          <View style={styles.driverCol}>
            <Text style={[styles.label, { textAlign: 'right' }]}>DRIVER</Text>
            <Text style={styles.driverName} numberOfLines={1}>
              {ride.driver.name}
            </Text>
          </View>
        ) : (
          <View style={styles.unassignedBadge}>
            <Text style={styles.unassignedText}>UNASSIGNED</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingId: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  timeText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.md,
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotContainer: {
    alignItems: 'center',
    width: 20,
    marginRight: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLine: {
    width: 1,
    height: 16,
    backgroundColor: COLORS.textSecondary,
    marginVertical: 2,
  },
  addressContainer: {
    flex: 1,
    gap: 8,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  valueText: {
    fontSize: 14,
    color: COLORS.white,
    marginTop: 2,
    fontWeight: '600',
  },
  driverCol: {
    alignItems: 'flex-end',
    maxWidth: '40%',
  },
  driverName: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  unassignedBadge: {
    backgroundColor: COLORS.pending + '15',
    borderColor: COLORS.pending,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
  },
  unassignedText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.pending,
  },
});
