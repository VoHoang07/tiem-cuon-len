import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SPACING } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
}

export function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 8,
    gap: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkText,
    letterSpacing: -0.2,
  },
  line: {
    flex: 1,
    height: 0.5,
    backgroundColor: COLORS.border,
  },
});
