import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { COLORS, SPACING, FONTS } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  disabled = false,
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[`size${size}`],
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}>
      <Text
        style={[
          styles.text,
          styles[`text${variant}`],
          styles[`textSize${size}`],
          textStyle,
        ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.softPurple,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  sizesm: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 15,
  },
  sizemd: {
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
  },
  sizelg: {
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.lg,
  },
  text: {
    fontWeight: '700',
    fontStyle: 'italic',
  },
  textprimary: {
    color: COLORS.white,
  },
  textsecondary: {
    color: COLORS.primary,
  },
  textoutline: {
    color: COLORS.primary,
  },
  textSizesm: {
    fontSize: 14,
  },
  textSizemd: {
    fontSize: 18,
  },
  textSizelg: {
    fontSize: 20,
  },
});
