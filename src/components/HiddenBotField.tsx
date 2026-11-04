import React from 'react';
import { View, TextInput, StyleSheet } from 'react-native';

interface HiddenBotFieldProps {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * Invisible form field (hidden bot filter) that normal users & screen readers ignore,
 * while automated credential-stuffing / spam bots fill out and trigger detection.
 */
export function HiddenBotField({ value, onChangeText }: HiddenBotFieldProps) {
  return (
    <View
      style={styles.hiddenContainer}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Leave this field empty"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect={false}
        tabIndex={-1}
        aria-hidden={true}
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
    overflow: 'hidden',
    zIndex: -1,
  },
  hiddenInput: {
    width: 1,
    height: 1,
    opacity: 0,
  },
});
