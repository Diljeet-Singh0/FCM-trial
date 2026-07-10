import React from 'react';
import {View, Text, StyleSheet, ActivityIndicator} from 'react-native';
import {colors, typography, spacing, borderRadius, shadows} from '../theme';
import {NavigationState} from '../types';
import {formatDistance} from '../utils/geo';
import ManeuverIcon from './ManeuverIcon';

interface NavigationHUDProps {
  navigationState: NavigationState;
}

const NavigationHUD: React.FC<NavigationHUDProps> = ({navigationState}) => {
  const {
    nextInstruction,
    nextManeuverType,
    nextManeuverModifier,
    distanceToNextManeuver,
    streetName,
    isOffRoute,
    isRerouting,
  } = navigationState;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {isRerouting ? (
          <View style={styles.reroutingBanner}>
            <ActivityIndicator size="small" color="#FFFFFF" style={{marginRight: spacing.sm}} />
            <Text style={styles.reroutingText}>Rerouting... finding a new path</Text>
          </View>
        ) : isOffRoute ? (
          <View style={[styles.reroutingBanner, {backgroundColor: '#F59E0B'}]}>
            <Text style={styles.reroutingText}>⚠️ Off Route! Recalculating soon...</Text>
          </View>
        ) : null}
        
        <View style={[styles.mainRow, (isRerouting || isOffRoute) && {opacity: 0.6}]}>
          <View style={styles.iconContainer}>
            <ManeuverIcon
              type={nextManeuverType}
              modifier={nextManeuverModifier}
              size={48}
              color={colors.textPrimary}
            />
          </View>
          <View style={styles.instructionContainer}>
            <Text style={styles.distanceText}>
              {formatDistance(distanceToNextManeuver)}
            </Text>
            <Text style={styles.instructionText} numberOfLines={2}>
              {nextInstruction}
            </Text>
          </View>
        </View>
        {streetName ? (
          <View style={styles.streetBar}>
            <Text style={styles.streetText} numberOfLines={1}>
              {streetName}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    paddingTop: spacing.section + spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(74, 144, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  instructionContainer: {
    flex: 1,
  },
  distanceText: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.black,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  instructionText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  streetBar: {
    backgroundColor: 'rgba(74, 144, 255, 0.08)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  streetText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
  },
  reroutingBanner: {
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  reroutingText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
});

export default NavigationHUD;
