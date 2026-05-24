export const COLORS = {
  // Primary brown palette
  primary: '#765341',
  primaryDark: '#5C3D2E',
  primaryLight: '#8B6C5C',
  secondary: '#8B6C5C',
  accent: '#A08679',

  // Soft warm tones
  soft: '#BCA89F',
  background: '#D8CBC4',
  cream: '#F5EDE8',
  softBeige: '#EDE4DD',
  warmBrown: '#3B2A22',
  pastelPink: '#E8D5D0',

  // Legacy compat - mapped to brown palette
  softPurple: '#BCA89F',
  lightPurple: '#F5EDE8',
  cardBg: '#FFFAF7',

  // Text
  darkText: '#3B2A22',
  mediumText: '#8B6C5C',
  lightText: '#A08679',

  // Basics
  white: '#FFFFFF',
  black: '#000000',
  error: '#E04B4B',
  success: '#6BAF5C',
  border: '#D8CBC4',
  shadow: 'rgba(59, 42, 34, 0.15)',
  starYellow: '#E8A840',
  overlay: 'rgba(59, 42, 34, 0.4)',
};

export const Colors = {
  light: {
    text: '#3B2A22',
    background: '#D8CBC4',
    backgroundElement: '#EDE4DD',
    backgroundSelected: '#D8CBC4',
    textSecondary: '#8B6C5C',
  },
  dark: {
    text: '#D8CBC4',
    background: '#3B2A22',
    backgroundElement: '#2A1F1A',
    backgroundSelected: '#3D2D26',
    textSecondary: '#A08679',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const Fonts = {
  bold: 'Inter_800ExtraBold',
  semiBold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
  light: 'Inter_300Light',
  mono: 'ui-monospace',
} as const;

export const SPACING = Spacing;
export const FONTS = Fonts;

export const SHADOWS = {
  small: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  large: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const CATEGORIES = [
  'All',
  'Yarn',
  'Crochet',
  'Bags',
  'Dolls',
  'Accessories',
] as const;

export const SHOP_NAME = 'Twist Thread';
export const SHOP_SUBTITLE = 'Sản phẩm crochet handmade bằng cả trái tim.';
export const MaxContentWidth = 800;
