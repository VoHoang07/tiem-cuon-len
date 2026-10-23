export const COLORS = {
  // Primary beige & warm caramel palette (Màu be chủ đạo phối be nhạt)
  primary: '#8C684C',
  primaryDark: '#6E4F37',
  primaryLight: '#A9876B',
  secondary: '#B89B82',
  accent: '#C9B199',

  // Beige & Light Beige tones
  soft: '#D8C3AD',
  background: '#E6D7C5',
  cream: '#FAF6F0',
  softBeige: '#F2EAE0',
  warmBrown: '#3D2B1F',
  pastelPink: '#EFE3D6',

  // Legacy compat - mapped to beige palette
  softPurple: '#D8C3AD',
  lightPurple: '#F5EDE2',
  cardBg: '#FFFDF9',

  // Text
  darkText: '#3D2B1F',
  mediumText: '#7A5C45',
  lightText: '#9E826B',

  // Basics
  white: '#FFFFFF',
  black: '#000000',
  error: '#D9534F',
  success: '#6BAF5C',
  border: '#E5D6C5',
  shadow: 'rgba(61, 43, 31, 0.12)',
  starYellow: '#E8A840',
  overlay: 'rgba(61, 43, 31, 0.35)',
};

export const Colors = {
  light: {
    text: '#3D2B1F',
    background: '#FAF6F0',
    backgroundElement: '#F2EAE0',
    backgroundSelected: '#D8C3AD',
    textSecondary: '#7A5C45',
  },
  dark: {
    text: '#F2EAE0',
    background: '#3D2B1F',
    backgroundElement: '#2A1F1A',
    backgroundSelected: '#4A3525',
    textSecondary: '#C9B199',
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

export const SHOP_NAME = 'Tiệm Cuộn Len';
export const SHOP_SUBTITLE = 'Sản phẩm len handmade bằng cả trái tim.';
export const MaxContentWidth = 800;
