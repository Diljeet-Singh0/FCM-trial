import React, { useState, useEffect } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, SPACING } from '../theme';
import FilterChips from '../components/FilterChips';
import DatePickerButton from '../components/DatePickerButton';
import ScheduledRideCard from '../components/ScheduledRideCard';
import { fetchScheduledRides, ScheduledRide } from '../api';

const FILTER_OPTIONS = ['All', 'Pending', 'Assigned', 'Completed', 'Cancelled'];

export default function ScheduledRidesScreen({ navigation }: any) {
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [rides, setRides] = useState<ScheduledRide[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getFormattedDateString = (d: Date | null) => {
    if (!d) return undefined;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const loadScheduledRides = async (showRefresher = false) => {
    if (showRefresher) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const dateStr = getFormattedDateString(selectedDate);
      const res = await fetchScheduledRides(selectedFilter, dateStr);
      if (res.success) {
        setRides(res.rides);
      } else {
        setError(res.error || 'Failed to fetch scheduled rides');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-reload when screen is focused or parameters change
  useEffect(() => {
    loadScheduledRides();
    
    const unsubscribe = navigation.addListener('focus', () => {
      loadScheduledRides();
    });
    return unsubscribe;
  }, [selectedFilter, selectedDate, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Scheduled Rides</Text>
      </View>

      <View style={styles.filterSection}>
        <FilterChips
          options={FILTER_OPTIONS}
          selected={selectedFilter}
          onSelect={(opt) => setSelectedFilter(opt)}
        />
        <DatePickerButton date={selectedDate} onChange={(d) => setSelectedDate(d)} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No scheduled rides found</Text>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScheduledRideCard
              ride={item}
              onPress={() => navigation.navigate('ScheduledRideDetail', { rideId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContainer}
          onRefresh={() => loadScheduledRides(true)}
          refreshing={refreshing}
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
    padding: SPACING.md,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.white,
  },
  filterSection: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '50',
  },
  listContainer: {
    padding: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  errorText: {
    color: COLORS.cancelled,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
