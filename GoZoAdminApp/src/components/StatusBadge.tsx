import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = (status || '').toLowerCase();
  
  let color = COLORS.offline;
  let label = status;

  switch (normalized) {
    case 'pending':
    case 'searching':
      color = COLORS.pending;
      label = 'Searching';
      break;
    case 'matched':
    case 'assigned':
    case 'on the way':
    case 'on_the_way':
    case 'arrived':
      color = COLORS.assigned;
      label = status === 'matched' ? 'Assigned' : status.replace('_', ' ');
      break;
    case 'picked_up':
    case 'picked up':
      color = COLORS.pickedUp;
      label = 'Picked Up';
      break;
    case 'completed':
    case 'delivered':
      color = COLORS.completed;
      label = 'Delivered';
      break;
    case 'cancelled':
      color = COLORS.cancelled;
      label = 'Cancelled';
      break;
    case 'available':
      color = COLORS.completed;
      label = 'Available';
      break;
    case 'in_ride':
      color = COLORS.assigned;
      label = 'In Ride';
      break;
    case 'offline':
      color = COLORS.offline;
      label = 'Offline';
      break;
  }

  return (
    <View style={[styles.badge, { backgroundColor: color + '15', borderColor: color }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
