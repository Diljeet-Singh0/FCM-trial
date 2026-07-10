import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Alert,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, BORDER_RADIUS, SPACING } from '../theme';
import StatusBadge from '../components/StatusBadge';
import {
  fetchScheduledRideDetail,
  assignDriverToScheduledRide,
  fetchDriversWithStatus,
  deleteScheduledRide,
  ScheduledRide,
  Driver,
} from '../api';

export default function ScheduledRideDetailScreen({ route, navigation }: any) {
  const { rideId } = route.params;
  const [ride, setRide] = useState<ScheduledRide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Assignment states
  const [availableDrivers, setAvailableDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const loadDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchScheduledRideDetail(rideId);
      if (res.success && res.ride) {
        setRide(res.ride);
        
        // If the ride is pending (unassigned), fetch available drivers
        if (res.ride.status === 'pending') {
          const driversRes = await fetchDriversWithStatus();
          if (driversRes.success) {
            // Filter drivers who are online/available
            const available = driversRes.drivers.filter(d => d.status === 'available');
            setAvailableDrivers(available);
          }
        }
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
  }, [rideId]);

  const handleCall = (phone?: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleAssign = async () => {
    if (!selectedDriverId) {
      Alert.alert('Selection Required', 'Please select a driver first');
      return;
    }

    setAssigning(true);
    try {
      const res = await assignDriverToScheduledRide(rideId, selectedDriverId);
      if (res.success) {
        Alert.alert('Success', 'Driver assigned successfully');
        loadDetail();
      } else {
        Alert.alert('Assignment Failed', res.error || 'Could not assign driver');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Connection failed');
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Ride',
      'Are you sure you want to permanently delete this ride? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await deleteScheduledRide(rideId);
              if (res.success) {
                Alert.alert('Success', 'Ride deleted successfully.', [
                  { text: 'OK', onPress: () => navigation.goBack() }
                ]);
              } else {
                Alert.alert('Error', res.error || 'Failed to delete ride. Please try again.');
              }
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete ride. Please try again.');
            }
          }
        }
      ]
    );
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

  // Format scheduled time
  const scheduledTimeFormatted = ride.scheduled_time
    ? `${new Date(ride.scheduled_time).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })} at ${new Date(ride.scheduled_time).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })}`
    : '';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtnHeader} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnHeaderText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scheduled Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bookingLabel}>BOOKING ID</Text>
              <Text style={styles.bookingId}>{ride.booking_id || ride.id.toUpperCase()}</Text>
              <Text style={styles.schedTimeLabel}>SCHEDULED TIME</Text>
              <Text style={styles.schedTimeText}>{scheduledTimeFormatted}</Text>
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
                <Text style={styles.addressText}>{ride.pickup_location}</Text>
              </View>
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>DROP LOCATION</Text>
                <Text style={styles.addressText}>{ride.drop_location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Shipment Info Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Details</Text>
          <Text style={styles.gridLabel}>Goods description / Requirements</Text>
          <Text style={styles.goodsDescription}>
            {ride.goods_description || 'No description provided'}
          </Text>
        </View>

        {/* Factory Customer Info Card */}
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

        {/* Assigned Driver Card */}
        {ride.driver ? (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Assigned Driver</Text>
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
        ) : ride.company ? (
          <View style={styles.detailsCard}>
            <Text style={styles.sectionTitle}>Assigned Company</Text>
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{ride.company.name}</Text>
                <Text style={styles.contactLabel}>
                  Location: {ride.company.location || 'Not Specified'}
                </Text>
                <Text style={styles.contactSub}>{ride.company.contact_phone}</Text>
              </View>
              {ride.company.contact_phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => handleCall(ride.company?.contact_phone)}
                >
                  <Text style={styles.callButtonText}>Call</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* Driver Assignment section */
          ride.status === 'pending' && (
            <View style={styles.detailsCard}>
              <Text style={styles.sectionTitle}>Assign Available Driver</Text>
              {availableDrivers.length === 0 ? (
                <Text style={styles.noDriversText}>
                  No available transporters online right now.
                </Text>
              ) : (
                <View>
                  <Text style={styles.selectLabel}>Select Transporter:</Text>
                  <View style={styles.driversList}>
                    {availableDrivers.map((driver) => {
                      const isSelected = selectedDriverId === driver.id;
                      return (
                        <TouchableOpacity
                          key={driver.id}
                          style={[
                            styles.driverSelectItem,
                            isSelected && styles.driverSelected,
                          ]}
                          onPress={() => setSelectedDriverId(driver.id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.driverSelectName,
                                isSelected && { color: COLORS.white },
                              ]}
                            >
                              {driver.name}
                            </Text>
                            <Text style={styles.driverSelectVehicle}>
                              {driver.vehicle_number} • {driver.phone}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.radioCircle,
                              isSelected && styles.radioSelected,
                            ]}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <TouchableOpacity
                    style={[styles.assignButton, assigning && styles.disabledButton]}
                    onPress={handleAssign}
                    disabled={assigning}
                  >
                    {assigning ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.assignButtonText}>Assign Transporter</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        )}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Text style={styles.deleteButtonText}>Delete Ride</Text>
        </TouchableOpacity>
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
    alignItems: 'flex-start',
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
  schedTimeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  schedTimeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
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
  gridLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  goodsDescription: {
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
  noDriversText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: SPACING.sm,
  },
  selectLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    fontWeight: '600',
  },
  driversList: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  driverSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  driverSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.card,
  },
  driverSelectName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  driverSelectVehicle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  assignButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  disabledButton: {
    opacity: 0.7,
  },
  assignButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
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
  deleteButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: COLORS.cancelled,
    fontSize: 16,
    fontWeight: '700',
  },
});
