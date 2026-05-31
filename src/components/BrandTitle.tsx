import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';

interface BrandTitleProps {
  centered?: boolean;
}

/**
 * Stylized "Tiệm Cuộn Len 🧶" text for the home header.
 */
export function BrandTitle({ centered = false }: BrandTitleProps) {
  return (
    <View style={[styles.wrap, centered && styles.centered]}>
      <Text style={styles.title}>
        Tiệm Cuộn Len{' '}
        <Text style={styles.emoji}>🧶</Text>
      </Text>
    </View>
  );
}

interface BrandAvatarProps {
  size?: number;
  onPress?: () => void;
}

/**
 * Cute circular brand avatar for profile button and profile screen.
 * Replaces plain "CL" text and default person icon.
 */
export function BrandAvatar({ size = 40, onPress }: BrandAvatarProps) {
  const content = (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}>
      <Text style={[styles.avatarEmoji, { fontSize: size * 0.4 }]}>🧶</Text>
      <Text style={[styles.avatarLetter, { fontSize: size * 0.28 }]}>CL</Text>
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
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centered: {
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.3,
  },
  emoji: {
    fontSize: 22,
  },
  avatar: {
    backgroundColor: '#EDE4DD',
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarEmoji: {
    position: 'absolute',
    opacity: 0.35,
  },
  avatarLetter: {
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: -0.5,
  },
});
