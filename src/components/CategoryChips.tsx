import React, { useRef } from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Category } from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';

interface CategoryChipsProps {
  categories: Category[];
  selected: Category;
  onSelect: (category: Category) => void;
}

export function CategoryChips({ categories, selected, onSelect }: CategoryChipsProps) {
  const scrollRef = useRef<ScrollView | null>(null);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      style={Platform.OS === 'web' ? ({ cursor: 'grab', userSelect: 'none' } as any) : undefined}
      contentContainerStyle={styles.container}>
      {categories.map((cat, idx) => {
        const isSelected = selected === cat;
        const emoji = cat === 'All' ? '✨' : getCategoryEmoji(cat);
        return (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => {
              onSelect(cat);
              try {
                scrollRef.current?.scrollTo({
                  x: Math.max(0, idx * 110 - 120),
                  animated: true,
                });
              } catch {
                // ignore
              }
            }}
            activeOpacity={0.75}>
            <Text style={styles.emoji}>{emoji}</Text>
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {getCategoryLabel(cat)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    gap: 8,
    paddingVertical: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    minHeight: 42,
  },
  chipSelected: {
    backgroundColor: '#D8C3AD',
    borderColor: '#B89B82',
    ...SHADOWS.small,
  },
  emoji: {
    fontSize: 14,
  },
  chipText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  chipTextSelected: {
    color: '#3D2B1F',
    fontWeight: '800',
  },
});
