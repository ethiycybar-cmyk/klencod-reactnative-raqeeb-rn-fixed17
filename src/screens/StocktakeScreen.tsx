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
import { recordMovement } from '../data/repositories/movementsRepo';
import type { BatchWithProduct } from '../types/models';

export function StocktakeScreen() {
  const { theme } = useTheme();
  const { columns } = useResponsive();
  const show = useUIStore((s) => s.show);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<BatchWithProduct[]>([]);
  const [counts, setCounts] = useState<Record<number, string>>({});

  const load = useCallback(() => setItems(activeBatches()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((b) => b.productName.toLowerCase().includes(q) || b.batchNumber.toLowerCase().includes(q)) : items;
  }, [items, query]);

  const apply = () => {
    let changed = 0;
    for (const b of items) {
      const raw = counts[b.id];
      if (raw === undefined || raw.trim() === '') continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        show(`قيمة غير صالحة للمنتج: ${b.productName}`, 'error');
        return;
      }
      if (n !== b.quantity) {
        const r = recordMovement(b.id, 'adjust', n, 'تسوية جرد');
        if (r.ok) changed += 1;
      }
    }
    setCounts({});
    load();
    show(changed ? `تمت تسوية ${changed} تشغيلة` : 'لا توجد فروق لتسويتها', changed ? 'success' : 'info');
  };

  return (
    <Screen back title="الجرد" subtitle="أدخل الكمية الفعلية وسنسوّي الفروق" scroll={false}>
      <SearchBar value={query} onChange={setQuery} placeholder="ابحث باسم المنتج أو رقم التشغيلة" />
      <FlashList
        key={columns}
        data={filtered}
        numColumns={columns}
        extraData={counts}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs }}>
            <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[typography.bodyLg, { color: theme.colors.text }]} numberOfLines={1}>{item.productName}</Text>
                <Text style={[typography.caption, { color: theme.colors.textMuted }]}>تشغيلة {item.batchNumber} · بالنظام {item.quantity}</Text>
              </View>
              <TextInput
                value={counts[item.id] ?? ''}
                onChangeText={(v) => setCounts((prev) => ({ ...prev, [item.id]: v }))}
                keyboardType="numeric"
                placeholder="الفعلي"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
              />
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 110 }}
        ListEmptyComponent={<EmptyState title="لا توجد تشغيلات" />}
      />
      <Button title="تطبيق الفروق" size="lg" onPress={apply} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  input: { width: 86, height: 44, borderWidth: 1, borderRadius: radius.sm, textAlign: 'center', fontSize: 15 },
});
