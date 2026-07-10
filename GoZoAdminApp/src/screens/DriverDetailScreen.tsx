import React, { useEffect, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import StatusBadge from '../components/StatusBadge';
import { fetchDriverRideHistory, Driver, Ride } from '../api';

export default function DriverDetailScreen({ route, navigation }: any) {
  const { driver }: { driver: Driver } = route.params;
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDriverRideHistory(driver.id);
      if (res.success) {
        setRides(res.rides);
      } else {
        setError(res.error || 'Failed to load driver ride history');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [driver.id]);

  const handleCall = () => {
    if (driver.phone) {
      Linking.openURL(`tel:${driver.phone}`);
    }
  };

  const renderHeader = () => (
    <View style={styles.headerCard}>
      <View style={styles.headerTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.driverName}>{driver.name}</Text>
          <Text style={styles.vehicleNo}>Vehicle: {driver.vehicle_number}</Text>
          <Text style={styles.phoneNo}>{driver.phone}</Text>
        </View>
        <StatusBadge status={driver.status} />
      </View>
      <TouchableOpacity style={styles.callButton} onPress={handleCall}>
        <Text style={styles.callButtonText}>Call Driver</Text>
      </TouchableOpacity>
      
      <Text style={styles.historyTitle}>Ride History</Text>
    </View>
  );

  const renderRideItem = ({ item }: { item: Ride }) => {
    const time = item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '';

    const cleanGoodsType = (item.goods_type || '').split('_dist_')[0];

    return (
      <View style={styles.historyCard}>
        <View style={styles.historyCardHeader}>
          <Text style={styles.historyCardId}>
            ID: {item.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.historyCardDate}>{time}</Text>
        </View>
        <Text style={styles.routeText} numberOfLines={1}>
          🟢 {item.pickup_address}
        </Text>
        <Text style={styles.routeText} numberOfLines={1}>
          🔴 {item.drop_address}
        </Text>
        <View style={styles.historyCardFooter}>
          <Text style={styles.goodsText}>
            {cleanGoodsType} • {item.weight_kg} kg
          </Text>
          <Text style={styles.priceText}>₹{item.price_inr}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtnHeader} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnHeaderText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No rides assigned to this driver yet.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtnHeader: {
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  backBtnHeaderText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  listContainer: {
    padding: SPACING.md,
  },
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.md,
  },
  driverName: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  vehicleNo: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  phoneNo: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  callButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: SPACING.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border + '80',
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  historyCardId: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  historyCardDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  routeText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 4,
  },
  historyCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border + '40',
  },
  goodsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  priceText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.background,
  },
  errorText: {
    color: COLORS.cancelled,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
});
