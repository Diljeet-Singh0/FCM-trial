import React from 'react';
import {View, StyleSheet} from 'react-native';
import Svg, {Path, Circle} from 'react-native-svg';
import {colors} from '../theme';

interface ManeuverIconProps {
  type: string;
  modifier?: string;
  size?: number;
  color?: string;
}

const ManeuverIcon: React.FC<ManeuverIconProps> = ({
  type,
  modifier,
  size = 40,
  color = colors.textPrimary,
}) => {
  const getIconPath = (): string => {
    const key = modifier ? `${type}-${modifier}` : type;

    switch (key) {
      case 'turn-left':
      case 'end of road-left':
        return 'M20 35 L20 15 L8 15 M8 15 L14 9 M8 15 L14 21';
      case 'turn-right':
      case 'end of road-right':
        return 'M20 35 L20 15 L32 15 M32 15 L26 9 M32 15 L26 21';
      case 'turn-slight left':
        return 'M22 35 L22 20 L12 8 M12 8 L12 16 M12 8 L19 10';
      case 'turn-slight right':
        return 'M18 35 L18 20 L28 8 M28 8 L28 16 M28 8 L21 10';
      case 'turn-sharp left':
        return 'M24 35 L24 20 L8 28 M8 28 L14 24 M8 28 L10 20';
      case 'turn-sharp right':
        return 'M16 35 L16 20 L32 28 M32 28 L26 24 M32 28 L30 20';
      case 'turn-straight':
      case 'depart-':
      case 'depart':
      case 'continue-straight':
        return 'M20 35 L20 5 M20 5 L14 12 M20 5 L26 12';
      case 'turn-uturn':
        return 'M14 35 L14 15 A6 6 0 0 1 26 15 L26 35 M26 35 L22 30 M26 35 L30 30';
      case 'merge-left':
      case 'merge-slight left':
        return 'M20 35 L20 18 M10 5 L20 18 M28 5 L20 18 M10 5 L14 12';
      case 'merge-right':
      case 'merge-slight right':
        return 'M20 35 L20 18 M10 5 L20 18 M28 5 L20 18 M28 5 L24 12';
      case 'fork-left':
      case 'fork-slight left':
        return 'M20 35 L20 20 L10 5 M10 5 L15 8 M20 20 L30 5';
      case 'fork-right':
      case 'fork-slight right':
        return 'M20 35 L20 20 L30 5 M30 5 L25 8 M20 20 L10 5';
      case 'roundabout-left':
      case 'rotary-left':
        return 'M20 35 L20 24 A5 5 0 1 1 15 18 M15 18 L11 22 M15 18 L19 22';
      case 'roundabout-right':
      case 'rotary-right':
        return 'M20 35 L20 24 A5 5 0 1 0 25 18 M25 18 L29 22 M25 18 L21 22';
      case 'arrive':
      case 'arrive-':
        return 'M20 8 L20 28 M14 22 L20 28 L26 22 M12 32 L28 32';
      default:
        // Default straight arrow
        return 'M20 35 L20 5 M20 5 L14 12 M20 5 L26 12';
    }
  };

  const renderArriveIcon = () => (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {/* Location pin */}
      <Path
        d="M20 5 C14 5 9 10 9 16 C9 24 20 35 20 35 C20 35 31 24 31 16 C31 10 26 5 20 5"
        fill="none"
        stroke={colors.success}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={20} cy={16} r={4} fill={colors.success} />
    </Svg>
  );

  if (type === 'arrive') {
    return renderArriveIcon();
  }

  return (
    <View style={[styles.container, {width: size, height: size}]}>
      <Svg width={size} height={size} viewBox="0 0 40 40">
        <Path
          d={getIconPath()}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ManeuverIcon;
