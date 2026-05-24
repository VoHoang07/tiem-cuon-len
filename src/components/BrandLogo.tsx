import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS } from '@/constants/theme';

const LOGO_IMAGE = require('../../assets/images/logo-shop.png');

interface BrandLogoProps {
  showSubtitle?: boolean;
  subtitle?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'circular';
  style?: ViewStyle;
  centered?: boolean;
  onPress?: () => void;
}

const SIZE_MAP = { sm: 30, md: 44, lg: 60, xl: 90 } as const;
const CIRCULAR_SIZE_MAP = { sm: 48, md: 64, lg: 80, xl: 96 } as const;

export function BrandLogo({
  showSubtitle = false,
  subtitle,
  size = 'md',
  variant = 'default',
  style,
  centered = true,
  onPress,
}: BrandLogoProps) {
  const isCircular = variant === 'circular';
  const logoSize = SIZE_MAP[size];
  const circleSize = CIRCULAR_SIZE_MAP[size];

  const content = isCircular ? (
    <View style={[centered && styles.centered, style]}>
      <View
        style={[
          styles.circle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
          },
        ]}>
        <Image
          source={LOGO_IMAGE}
          style={styles.circleImage}
          resizeMode="cover"
        />
      </View>
      {showSubtitle && (
        <Text style={styles.subtitle}>{subtitle ?? 'Sản phẩm len handmade bằng cả trái tim.'}</Text>
      )}
    </View>
  ) : (
    <View style={[centered && styles.centered, style]}>
      <Image
        source={LOGO_IMAGE}
        style={{ width: logoSize, height: logoSize, borderRadius: logoSize / 5 }}
        resizeMode="contain"
      />
      {showSubtitle && (
        <Text style={styles.subtitle}>{subtitle ?? 'Sản phẩm len handmade bằng cả trái tim.'}</Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.mediumText,
    fontStyle: 'italic',
    marginTop: 4,
  },
  circle: {
    borderWidth: 3,
    borderColor: '#765341',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8cbc4',
  },
  circleImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});
