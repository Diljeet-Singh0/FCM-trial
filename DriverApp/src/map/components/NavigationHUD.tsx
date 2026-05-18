import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
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
  } = navigationState;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.mainRow}>
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
});

export default NavigationHUD;
