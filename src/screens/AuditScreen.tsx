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
import { listAudit } from '../data/repositories/auditRepo';
import type { AuditEntry } from '../types/models';

const ACTIONS: Record<string, string> = { create: 'إضافة', update: 'تعديل', delete: 'حذف', movement: 'حركة مخزون' };
const ENTITIES: Record<string, string> = { product: 'منتج', batch: 'تشغيلة' };

export function AuditScreen() {
  const { theme } = useTheme();
  const { columns } = useResponsive();
  const [items, setItems] = useState<AuditEntry[]>([]);
  useFocusEffect(useCallback(() => { setItems(listAudit(300)); }, []));

  return (
    <Screen back title="سجل التدقيق" subtitle="آخر 300 عملية على البيانات" scroll={false}>
      <FlashList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs }}>
            <View style={[styles.row, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <Text style={[typography.bodyLg, { color: theme.colors.text }]}>
                {ACTIONS[item.action] ?? item.action} · {ENTITIES[item.entity] ?? item.entity}
                {item.entityId ? ` #${item.entityId}` : ''}
              </Text>
              {item.details ? <Text style={[typography.body, { color: theme.colors.textMuted }]}>{item.details}</Text> : null}
              <Text style={[typography.caption, { color: theme.colors.textMuted }]}>{item.createdAt.slice(0, 16).replace('T', ' ')}</Text>
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState title="السجل فارغ" message="ستظهر هنا عمليات الإضافة والتعديل والحذف والحركات." />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 2 },
});
