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
import { activeBatches } from '../data/repositories/batchesRepo';
import { todayISO } from '../utils/dates';
import type { BatchWithProduct, StatusLevel } from '../types/models';

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const DAYS = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];
const RANK: Record<StatusLevel, number> = { expired: 3, critical: 2, warning: 1, good: 0 };
const pad = (n: number) => String(n).padStart(2, '0');

export function CalendarScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState(todayISO());
  const [all, setAll] = useState<BatchWithProduct[]>([]);

  useFocusEffect(useCallback(() => { setAll(activeBatches()); }, []));

  const byDate = useMemo(() => {
    const map: Record<string, BatchWithProduct[]> = {};
    all.forEach((b) => {
      if (!map[b.expiryDate]) map[b.expiryDate] = [];
      map[b.expiryDate].push(b);
    });
    return map;
  }, [all]);

  const first = new Date(cursor.y, cursor.m, 1);
  const offset = (first.getDay() + 1) % 7; // السبت أول العمود
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const list = byDate[selected] ?? [];

  return (
    <Screen back title="تقويم الصلاحية" subtitle="اضغط على يوم لعرض ما ينتهي فيه">
      <Card>
        <View style={styles.monthRow}>
          <Button title="‹" size="sm" variant="outline" onPress={() => move(-1)} />
          <Text style={[typography.h3, { color: theme.colors.text }]}>{MONTHS[cursor.m]} {cursor.y}</Text>
          <Button title="›" size="sm" variant="outline" onPress={() => move(1)} />
        </View>
        <View style={styles.week}>
          {DAYS.map((d) => (
            <Text key={d} style={[styles.dayName, typography.caption, { color: theme.colors.textMuted }]}>{d}</Text>
          ))}
        </View>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.week}>
            {week.map((day, di) => {
              if (day === null) return <View key={di} style={styles.cell} />;
              const key = `${cursor.y}-${pad(cursor.m + 1)}-${pad(day)}`;
              const batches = byDate[key] ?? [];
              let worst: StatusLevel | null = null;
              batches.forEach((b) => { if (worst === null || RANK[b.status] > RANK[worst]) worst = b.status; });
              const color = worst ? theme.colors[worst] : theme.colors.border;
              const isSel = key === selected;
              return (
                <Pressable key={di} style={styles.cell} onPress={() => setSelected(key)}>
                  <View style={[styles.cellInner, { backgroundColor: worst ? color + '33' : 'transparent', borderColor: isSel ? theme.colors.accent : worst ? color : 'transparent' }]}>
                    <Text style={[typography.body, { color: theme.colors.text }]}>{day}</Text>
                    {batches.length > 0 ? <Text style={[styles.count, { color }]}>{batches.length}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <Text style={[typography.h3, { color: theme.colors.text }]}>تنتهي في {selected}</Text>
      {list.length === 0 ? (
        <EmptyState title="لا شيء ينتهي في هذا اليوم" />
      ) : (
        list.map((b) => (
          <BatchRow key={b.id} item={b} onPress={() => navigation.navigate('BatchForm', { id: b.id, productId: b.productId })} />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  week: { flexDirection: 'row' },
  dayName: { width: `${100 / 7}%`, textAlign: 'center', marginBottom: 4 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cellInner: { flex: 1, borderRadius: radius.sm, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  count: { fontSize: 10, fontWeight: '700', marginTop: -2 },
});
