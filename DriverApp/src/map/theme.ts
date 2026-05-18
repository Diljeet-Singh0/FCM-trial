import {Platform} from 'react-native';

export const colors = {
  // Backgrounds
  background: '#0A0E1A',
  surface: 'rgba(20, 25, 45, 0.92)',
  surfaceLight: 'rgba(30, 38, 65, 0.85)',
  card: 'rgba(22, 28, 50, 0.95)',

  // Primary
  primary: '#4A90FF',
  primaryDark: '#1E3A8A',
  primaryLight: '#7CB3FF',

  // Accents
  success: '#00D47E',
  successDark: '#00A862',
  danger: '#FF4757',
  dangerDark: '#CC3945',
  warning: '#FFB830',
  warningDark: '#CC9326',

  // Route
  routeActive: '#4A90FF',
  routeTraveled: '#1E3A8A',
  routeAlternative: 'rgba(74, 144, 255, 0.35)',
  routeGlow: 'rgba(74, 144, 255, 0.3)',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#8892B0',
  textMuted: '#5A6380',
  textAccent: '#4A90FF',

  // Borders
  border: 'rgba(74, 144, 255, 0.15)',
  borderLight: 'rgba(255, 255, 255, 0.08)',
  borderFocused: 'rgba(74, 144, 255, 0.5)',

  // Markers
  markerSource: '#00D47E',
  markerDestination: '#FF4757',
  markerPulse: 'rgba(0, 212, 126, 0.3)',

  // Overlays
  overlay: 'rgba(10, 14, 26, 0.7)',
  overlayLight: 'rgba(10, 14, 26, 0.4)',

  // Input
  inputBackground: 'rgba(15, 20, 38, 0.8)',
  inputBorder: 'rgba(74, 144, 255, 0.2)',
  inputPlaceholder: '#5A6380',

  // Status bar
  statusBar: '#060912',
};

export const typography = {
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
  }),
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 26,
    hero: 36,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
  letterSpacing: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 40,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 50,
  circle: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  button: {
    shadowColor: '#4A90FF',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  glow: {
    shadowColor: '#4A90FF',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 8,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
};

export const mapStyles = {
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
  dark: 'mapbox://styles/mapbox/dark-v11',
  streets: 'mapbox://styles/mapbox/streets-v12',
};
