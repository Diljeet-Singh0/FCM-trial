import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import { fetchRideDetail, Ride } from '../api';

export default function RideDetailScreen({ route, navigation }: any) {
  const { requestId } = route.params;
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchRideDetail(requestId);
      if (res.success) {
        setRide(res.ride);
      } else {
        setError(res.error || 'Failed to load details');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
  }, [requestId]);

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (error || !ride) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'Ride not found'}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const cleanGoodsType = (ride.goods_type || '').split('_dist_')[0];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtnHeader} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnHeaderText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ride Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Information Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.bookingLabel}>BOOKING ID</Text>
              <Text style={styles.bookingId}>{ride.id.toUpperCase()}</Text>
            </View>
            <StatusBadge status={ride.status} />
          </View>
        </View>

        {/* Route Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Route Details</Text>
          <View style={styles.routeContainer}>
            <View style={styles.dotContainer}>
              <View style={[styles.dot, { backgroundColor: COLORS.primary }]} />
              <View style={styles.dotLine} />
              <View style={[styles.dot, { backgroundColor: COLORS.cancelled }]} />
            </View>
            <View style={styles.addressContainer}>
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>PICKUP LOCATION</Text>
                <Text style={styles.addressText}>{ride.pickup_address}</Text>
              </View>
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>DROP LOCATION</Text>
                <Text style={styles.addressText}>{ride.drop_address}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Shipment Info Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          <View style={styles.grid}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Goods Type</Text>
              <Text style={styles.gridVal}>{cleanGoodsType}</Text>
            </View>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Weight</Text>
              <Text style={styles.gridVal}>{ride.weight_kg} kg</Text>
            </View>
          </View>
          <View style={[styles.grid, { marginTop: SPACING.md }]}>
            <View style={styles.gridCol}>
              <Text style={styles.gridLabel}>Price / Est. Freight</Text>
              <Text style={[styles.gridVal, { color: COLORS.primary, fontWeight: '800' }]}>
                ₹{ride.price_inr}
              </Text>
            </View>
          </View>
        </View>

        {/* User / Factory Details Card */}
        {ride.user && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Customer Info</Text>
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{ride.user.name}</Text>
                <Text style={styles.contactLabel}>
                  {ride.user.factory_name || 'Factory Owner'}
                </Text>
                <Text style={styles.contactSub}>{ride.user.phone}</Text>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(ride.user?.phone)}
              >
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Driver Details Card */}
        {ride.driver && (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Driver Info</Text>
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{ride.driver.name}</Text>
                <Text style={styles.contactLabel}>
                  Vehicle: {ride.driver.vehicle_number}
                </Text>
                <Text style={styles.contactSub}>{ride.driver.phone}</Text>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => handleCall(ride.driver?.phone)}
              >
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Status Timeline */}
        <StatusTimeline timeline={ride.timeline} />
      </ScrollView>
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
  scrollContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bookingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  bookingId: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    marginTop: 2,
  },
  detailsCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  routeContainer: {
    flexDirection: 'row',
  },
  dotContainer: {
    alignItems: 'center',
    width: 20,
    marginRight: SPACING.sm,
    paddingTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLine: {
    width: 2,
    flex: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  addressContainer: {
    flex: 1,
    gap: 16,
  },
  addressBox: {
    gap: 4,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  addressText: {
    fontSize: 14,
    color: COLORS.white,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
  },
  gridCol: {
    flex: 1,
  },
  gridLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  gridVal: {
    fontSize: 15,
    color: COLORS.white,
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },
  contactLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  contactSub: {
    fontSize: 13,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  callButton: {
    backgroundColor: COLORS.primary + '15',
    borderColor: COLORS.primary,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  callButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 14,
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
    marginBottom: SPACING.lg,
  },
  backBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  backBtnText: {
    color: COLORS.white,
    fontWeight: '700',
  },
});
