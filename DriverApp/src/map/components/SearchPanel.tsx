import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {colors, typography, spacing, borderRadius, shadows} from '../theme';
import {Coordinate} from '../types';
import AutocompleteInput from './AutocompleteInput';

interface SearchPanelProps {
  sourceAddress: string;
  destinationAddress: string;
  onSourceChange: (text: string) => void;
  onDestinationChange: (text: string) => void;
  onSourceSelect: (coordinate: Coordinate, name: string) => void;
  onDestinationSelect: (coordinate: Coordinate, name: string) => void;
  onUseCurrentLocation: () => void;
  onGetRoute: () => void;
  onSwapLocations: () => void;
  currentLocation: Coordinate | null;
  loading: boolean;
  hasRoute: boolean;
}

const SearchPanel: React.FC<SearchPanelProps> = ({
  sourceAddress,
  destinationAddress,
  onSourceChange,
  onDestinationChange,
  onSourceSelect,
  onDestinationSelect,
  onUseCurrentLocation,
  onGetRoute,
  onSwapLocations,
  currentLocation,
  loading,
  hasRoute,
}) => {
  const [isExpanded] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerHandle} />
        <Text style={styles.title}>Where to?</Text>
      </View>

      {isExpanded && (
        <View style={styles.content}>
          <View style={styles.inputsWrapper}>
            <View style={styles.connectingLine}>
              <View style={[styles.dot, {backgroundColor: colors.markerSource}]} />
              <View style={styles.dottedLine}>
                {[...Array(4)].map((_, i) => (
                  <View key={i} style={styles.dashSegment} />
                ))}
              </View>
              <View style={[styles.dot, {backgroundColor: colors.markerDestination}]} />
            </View>

            <View style={styles.inputsContainer}>
              <AutocompleteInput
                placeholder="Pickup location"
                value={sourceAddress}
                onChangeText={onSourceChange}
                onSelectPlace={onSourceSelect}
                onUseCurrentLocation={onUseCurrentLocation}
                showCurrentLocationButton={true}
                proximity={currentLocation}
                icon=""
                iconColor={colors.markerSource}
              />
              <View style={styles.inputSpacer} />
              <AutocompleteInput
                placeholder="Drop-off location"
                value={destinationAddress}
                onChangeText={onDestinationChange}
                onSelectPlace={onDestinationSelect}
                proximity={currentLocation}
                icon=""
                iconColor={colors.markerDestination}
              />
            </View>

            <TouchableOpacity
              style={styles.swapButton}
              onPress={onSwapLocations}
              activeOpacity={0.7}>
              <Text style={styles.swapIcon}>⇅</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.routeButton,
              loading && styles.routeButtonDisabled,
              hasRoute && styles.routeButtonActive,
            ]}
            onPress={onGetRoute}
            disabled={loading}
            activeOpacity={0.8}>
            {loading ? (
              <ActivityIndicator color={colors.textPrimary} size="small" />
            ) : (
              <>
                <Text style={styles.routeButtonIcon}>
                  {hasRoute ? '🔄' : '🧭'}
                </Text>
                <Text style={styles.routeButtonText}>
                  {hasRoute ? 'Recalculate Route' : 'Find Route'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface, borderRadius: borderRadius.xl,
    marginHorizontal: spacing.lg, marginTop: spacing.section + spacing.md,
    overflow: 'visible', borderWidth: 1, borderColor: colors.border, ...shadows.card,
  },
  header: { alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  headerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, marginBottom: spacing.md },
  title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.textPrimary, letterSpacing: typography.letterSpacing.tight },
  content: { padding: spacing.lg, paddingTop: spacing.md },
  inputsWrapper: { flexDirection: 'row', alignItems: 'stretch' },
  connectingLine: { width: 24, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, marginRight: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.3)' },
  dottedLine: { flex: 1, alignItems: 'center', justifyContent: 'space-evenly', paddingVertical: 4 },
  dashSegment: { width: 2, height: 6, backgroundColor: colors.textMuted, borderRadius: 1 },
  inputsContainer: { flex: 1, zIndex: 10 },
  inputSpacer: { height: spacing.md },
  swapButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(74, 144, 255, 0.12)', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginLeft: spacing.sm, borderWidth: 1, borderColor: colors.border },
  swapIcon: { fontSize: 18, color: colors.primary, fontWeight: typography.weights.bold },
  routeButton: { flexDirection: 'row', backgroundColor: colors.primary, borderRadius: borderRadius.md, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl, ...shadows.button },
  routeButtonDisabled: { backgroundColor: colors.textMuted },
  routeButtonActive: { backgroundColor: colors.primaryDark },
  routeButtonIcon: { fontSize: 18, marginRight: spacing.sm },
  routeButtonText: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, color: colors.textPrimary, letterSpacing: typography.letterSpacing.wide },
});

export default SearchPanel;
