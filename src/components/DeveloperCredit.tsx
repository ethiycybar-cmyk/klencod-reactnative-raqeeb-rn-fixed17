import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { DEVELOPER_CREDIT } from '../config/credit';

/** سطر صغير بخط إنجليزي يظهر أسفل كل الشاشات. */
export function DeveloperCredit({ light, style }: { light?: boolean; style?: TextStyle }) {
  const { theme } = useTheme();
  return (
    <Text
      accessible={false}
      style={[styles.text, { color: light ? '#FFFFFF99' : theme.colors.textMuted }, style]}
    >
      {DEVELOPER_CREDIT}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 10,
    textAlign: 'center',
    writingDirection: 'ltr',
    letterSpacing: 0.4,
    opacity: 0.85,
    marginTop: 10,
    marginBottom: 4,
  },
});
