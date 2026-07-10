import React, { useState, useEffect } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { COLORS, SPACING, BORDER_RADIUS } from '../theme';
import FilterChips from '../components/FilterChips';
import DriverCard from '../components/DriverCard';
import { fetchDriversWithStatus, Driver } from '../api';

const FILTER_OPTIONS = ['All', 'Online', 'Offline'];

export default function DriversScreen({ navigation }: any) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [filteredDrivers, setFilteredDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDrivers = async (showRefresher = false) => {
    if (showRefresher) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetchDriversWithStatus();
      if (res.success) {
        setDrivers(res.drivers);
      } else {
        setError(res.error || 'Failed to fetch drivers');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDrivers();
    
    const unsubscribe = navigation.addListener('focus', () => {
      loadDrivers();
    });
    return unsubscribe;
  }, [navigation]);

  // Apply filters and search client-side
  useEffect(() => {
    let result = [...drivers];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (d) =>
          (d.name || '').toLowerCase().includes(query) ||
          (d.phone || '').includes(query) ||
          (d.vehicle_number || '').toLowerCase().includes(query)
      );
    }

    // Status filter
    if (selectedFilter === 'Online') {
      result = result.filter((d) => d.status === 'available' || d.status === 'in_ride');
    } else if (selectedFilter === 'Offline') {
      result = result.filter((d) => d.status === 'offline' || !d.status);
    }

    setFilteredDrivers(result);
  }, [drivers, searchQuery, selectedFilter]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Drivers Monitor</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search driver by name, vehicle, phone..."
            placeholderTextColor={COLORS.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <Text style={styles.clearBtn} onPress={() => setSearchQuery('')}>
              ✕
            </Text>
          ) : null}
        </View>

        <FilterChips
          options={FILTER_OPTIONS}
          selected={selectedFilter}
          onSelect={(opt) => setSelectedFilter(opt)}
        />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : filteredDrivers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No drivers found matching criteria</Text>
        </View>
      ) : (
        <FlatList
          data={filteredDrivers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DriverCard
              driver={item}
              onPress={() => navigation.navigate('DriverDetail', { driver: item })}
            />
          )}
          contentContainerStyle={styles.listContainer}
          onRefresh={() => loadDrivers(true)}
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
  searchSection: {
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border + '50',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    height: 44,
    fontSize: 14,
  },
  clearBtn: {
    color: COLORS.textSecondary,
    fontSize: 16,
    padding: SPACING.xs,
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
