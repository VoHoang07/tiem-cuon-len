import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';

export interface AnimalAvatarItem {
  id: string;
  emoji: string;
  name: string;
  bg: string;
  border: string;
}

export const ANIMAL_AVATARS: AnimalAvatarItem[] = [
  { id: 'capybara', emoji: '🦫', name: 'Capybara', bg: '#F4E5D6', border: '#9C6B43' },
  { id: 'bunny', emoji: '🐰', name: 'Thỏ Bông', bg: '#FCE8EE', border: '#D88296' },
  { id: 'bear', emoji: '🧸', name: 'Gấu Nâu', bg: '#EFE2D3', border: '#7F5539' },
  { id: 'cat', emoji: '🐱', name: 'Mèo Mướp', bg: '#FFF1D6', border: '#C98A4B' },
  { id: 'duck', emoji: '🐥', name: 'Vịt Vàng', bg: '#FEF5C8', border: '#D4A017' },
  { id: 'panda', emoji: '🐼', name: 'Gấu Trúc', bg: '#E6F2EA', border: '#5F8D6E' },
  { id: 'fox', emoji: '🦊', name: 'Cáo Nhỏ', bg: '#FFE4D6', border: '#D96B43' },
  { id: 'koala', emoji: '🐨', name: 'Koala', bg: '#EAECEF', border: '#7B8794' },
  { id: 'frog', emoji: '🐸', name: 'Ếch Xanh', bg: '#E2F2DF', border: '#659B5E' },
  { id: 'dog', emoji: '🐶', name: 'Cún Con', bg: '#F5E6D8', border: '#A47551' },
  { id: 'hamster', emoji: '🐹', name: 'Hamster', bg: '#FDEBD0', border: '#C87D28' },
  { id: 'penguin', emoji: '🐧', name: 'Cánh Cụt', bg: '#E3EFFB', border: '#5B87B5' },
];

export function getAnimalAvatar(avatarId?: string, seed?: string): AnimalAvatarItem {
  if (avatarId) {
    const found = ANIMAL_AVATARS.find((a) => a.id === avatarId);
    if (found) return found;
  }
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return ANIMAL_AVATARS[hash % ANIMAL_AVATARS.length];
  }
  return ANIMAL_AVATARS[0];
}

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
  avatarId?: string;
  onPress?: () => void;
}

/**
 * Cute circular animal avatar for profile button and profile screen.
 */
export function BrandAvatar({ size = 40, avatarId, onPress }: BrandAvatarProps) {
  const { user, guestAvatar } = useAuth();
  const effectiveId = avatarId ?? user?.avatar ?? (!user ? guestAvatar : undefined);
  const seed = user?.id || user?.email || user?.name;
  const animal = getAnimalAvatar(effectiveId, seed);

  const content = (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: animal.bg,
          borderColor: animal.border,
          borderWidth: size >= 60 ? 2.5 : 1.8,
        },
      ]}>
      <Text style={[styles.avatarAnimalEmoji, { fontSize: Math.round(size * 0.56) }]}>
        {animal.emoji}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75} hitSlop={8}>
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
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarAnimalEmoji: {
    textAlign: 'center',
  },
});
