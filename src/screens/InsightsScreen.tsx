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
import { movementTotalsSince } from '../data/repositories/movementsRepo';
import type { BatchWithProduct, MovementType } from '../types/models';
import { MOVEMENT_LABELS } from '../types/models';

function Bar({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const { theme } = useTheme();
  const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text style={[typography.body, { color: theme.colors.text }]}>{label}</Text>
        <Text style={[typography.body, { color, fontWeight: '700' }]}>{value}{suffix ?? ''}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.colors.surfaceAlt }]}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function InsightsScreen() {
  const { theme } = useTheme();
  const [active, setActive] = useState<BatchWithProduct[]>([]);
  const [moves, setMoves] = useState<Record<MovementType, number>>({ sale: 0, waste: 0, return: 0, adjust: 0, recall: 0 });

  useFocusEffect(
    useCallback(() => {
      setActive(activeBatches());
      const d = new Date();
      setMoves(movementTotalsSince(new Date(d.getFullYear(), d.getMonth(), 1).toISOString()));
    }, []),
  );

  const c = theme.colors;
  const count = (s: string) => active.filter((b) => b.status === s).length;
  const total = active.length;
  const health = total ? Math.round((count('good') / total) * 100) : 0;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    active.filter((b) => b.status === 'expired' || b.status === 'critical').forEach((b) => {
      const k = b.category ?? 'بدون فئة';
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [active]);

  return (
    <Screen back title="التحليلات" subtitle="نظرة سريعة على صحة المخزون">
      <Card>
        <Text style={[typography.caption, { color: c.textMuted }]}>صحة المخزون (نسبة الممتاز)</Text>
        <Text style={[typography.display, { color: health >= 60 ? c.good : health >= 30 ? c.warning : c.critical, fontWeight: '800' }]}>{health}%</Text>
        <Text style={[typography.caption, { color: c.textMuted }]}>من {total} تشغيلة فعّالة</Text>
      </Card>

      <Card>
        <Text style={[typography.h3, { color: c.text, marginBottom: spacing.sm }]}>توزيع الحالات</Text>
        <Bar label="منتهية" value={count('expired')} max={total} color={c.expired} />
        <Bar label="حرجة" value={count('critical')} max={total} color={c.critical} />
        <Bar label="جيدة" value={count('warning')} max={total} color={c.warning} />
        <Bar label="ممتازة" value={count('good')} max={total} color={c.good} />
      </Card>

      <Card>
        <Text style={[typography.h3, { color: c.text, marginBottom: spacing.sm }]}>أكثر الفئات عرضة للخسارة</Text>
        {byCategory.length === 0 ? (
          <Text style={[typography.body, { color: c.textMuted }]}>لا توجد فئات في وضع خطر.</Text>
        ) : (
          byCategory.map(([name, n]) => <Bar key={name} label={name} value={n} max={byCategory[0][1]} color={c.critical} />)
        )}
      </Card>

      <Card>
        <Text style={[typography.h3, { color: c.text, marginBottom: spacing.sm }]}>حركة هذا الشهر (وحدات)</Text>
        {(['sale', 'waste', 'return', 'recall'] as MovementType[]).map((t) => (
          <Bar key={t} label={MOVEMENT_LABELS[t]} value={moves[t]} max={Math.max(moves.sale, moves.waste, moves.return, moves.recall)} color={t === 'waste' || t === 'recall' ? c.critical : c.primary} />
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  barRow: { marginBottom: spacing.md },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
});
