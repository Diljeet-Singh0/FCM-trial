import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface RouteIndicatorProps {
  pickupAddress: string;
  dropAddress: string;
}

export const RouteIndicator: React.FC<RouteIndicatorProps> = ({ pickupAddress, dropAddress }) => {
  return (
    <View style={styles.container}>
      <View style={styles.graphicsColumn}>
        <View style={styles.pickupDot} />
        <View style={styles.dashedLine} />
        <View style={styles.dropDot} />
      </View>
      <View style={styles.textColumn}>
        <View style={styles.addressBlock}>
          <Text style={styles.label}>PICKUP</Text>
          <Text style={styles.addressText} numberOfLines={2}>{pickupAddress || 'Enter pickup location'}</Text>
        </View>
        <View style={styles.addressBlock}>
          <Text style={styles.label}>DROP</Text>
          <Text style={styles.addressText} numberOfLines={2}>{dropAddress || 'Enter drop location'}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingVertical: 12,
  },
  graphicsColumn: {
    alignItems: 'center',
    width: 24,
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981', // GoZo brand green
  },
  dropDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E53935', // Red
  },
  dashedLine: {
    flex: 1,
    width: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#CCCCCC',
    marginVertical: 4,
  },
  textColumn: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  addressBlock: {
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B6B6B', // Medium grey
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#1A1A1A', // Near black
    fontWeight: '500',
    lineHeight: 18,
  },
});

export default RouteIndicator;
