import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import StatusBadge from './StatusBadge';
import { Ride } from '../api';

interface RideCardProps {
  ride: Ride;
  onPress: () => void;
}

export default function RideCard({ ride, onPress }: RideCardProps) {
  // Format creation time
  const time = ride.created_at
    ? new Date(ride.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const date = ride.created_at
    ? new Date(ride.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  // Clean goods type
  const cleanGoodsType = (ride.goods_type || '').split('_dist_')[0];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <View>
          <Text style={styles.bookingId}>ID: {ride.id.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.timeText}>{date} at {time}</Text>
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
            {ride.pickup_address}
          </Text>
          <Text style={styles.addressText} numberOfLines={1}>
            {ride.drop_address}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.footer}>
        <View>
          <Text style={styles.label}>GOODS TYPE</Text>
          <Text style={styles.valueText}>
            {cleanGoodsType} ({ride.weight_kg} kg)
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.label}>EST. FREIGHT</Text>
          <Text style={styles.priceText}>₹{ride.price_inr}</Text>
        </View>
      </View>

      {ride.driver && (
        <View style={styles.driverContainer}>
          <Text style={styles.driverLabel}>DRIVER</Text>
          <Text style={styles.driverValue}>
            {ride.driver.name} ({ride.driver.vehicle_number})
          </Text>
        </View>
      )}
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
    my: SPACING.sm,
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
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },
  driverContainer: {
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + '50',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  driverLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  driverValue: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: '600',
  },
});
