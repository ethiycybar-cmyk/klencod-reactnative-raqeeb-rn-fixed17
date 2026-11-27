import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { SearchBar } from '../components/ui/SearchBar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BatchRow } from '../components/BatchRow';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { useResponsive } from '../hooks/useResponsive';
import { useUIStore } from '../store/uiStore';
import { CATEGORIES } from '../types/models';
import { resetThresholds, saveThresholds, thresholdsFor } from '../config/thresholds';

type Draft = Record<string, { c: string; e: string }>;

const initial = (): Draft => {
  const d: Draft = {};
  CATEGORIES.forEach((cat) => {
    const t = thresholdsFor(cat);
    d[cat] = { c: String(t.critical), e: String(t.excellent) };
  });
  return d;
};

export function ThresholdsScreen() {
  const { theme } = useTheme();
  const show = useUIStore((s) => s.show);
  const [draft, setDraft] = useState<Draft>(initial);

  const set = (cat: string, key: 'c' | 'e', v: string) => setDraft((p) => ({ ...p, [cat]: { ...p[cat], [key]: v.replace(/[^0-9]/g, '') } }));

  const save = () => {
    let bad = 0;
    CATEGORIES.forEach((cat) => {
      const t = draft[cat];
      if (!saveThresholds(cat, Number(t.c), Number(t.e))) bad += 1;
    });
    show(bad ? `${bad} فئة بقيم غير منطقية (الممتاز يجب أن يكون أكبر من الحرج)` : 'تم حفظ العتبات', bad ? 'error' : 'success');
  };

  const reset = () => {
    resetThresholds();
    setDraft(initial());
    show('تمت استعادة العتبات الافتراضية', 'success');
  };

  return (
    <Screen back title="عتبات الفئات" subtitle="حرج حتى كم يوماً، وممتاز من كم يوماً">
      {CATEGORIES.map((cat) => (
        <Card key={cat}>
          <Text style={[typography.bodyLg, { color: theme.colors.text, marginBottom: spacing.sm }]}>{cat}</Text>
          <View style={styles.pair}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: theme.colors.critical }]}>حرج حتى (يوم)</Text>
              <TextInput value={draft[cat].c} onChangeText={(v) => set(cat, 'c', v)} keyboardType="numeric" style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.caption, { color: theme.colors.good }]}>ممتاز من (يوم)</Text>
              <TextInput value={draft[cat].e} onChangeText={(v) => set(cat, 'e', v)} keyboardType="numeric" style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]} />
            </View>
          </View>
        </Card>
      ))}
      <Button title="حفظ العتبات" size="lg" onPress={save} />
      <Button title="استعادة الافتراضي" variant="outline" onPress={reset} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pair: { flexDirection: 'row', gap: spacing.md },
  input: { height: 44, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 15, marginTop: 4 },
});
