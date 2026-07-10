import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import StatusBadge from './StatusBadge';
import { Driver } from '../api';

interface DriverCardProps {
  driver: Driver;
  onPress: () => void;
}

export default function DriverCard({ driver, onPress }: DriverCardProps) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.left}>
        <Text style={styles.name}>{driver.name}</Text>
        <Text style={styles.details}>
          {driver.vehicle_number} • {driver.phone}
        </Text>
      </View>
      <StatusBadge status={driver.status} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  left: {
    flex: 1,
    marginRight: SPACING.md,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  details: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});
