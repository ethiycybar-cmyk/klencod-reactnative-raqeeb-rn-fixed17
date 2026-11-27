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
import { buildPromoText } from '../services/reportService';
import { openWhatsappWithText } from '../services/whatsappService';
import type { BatchWithProduct } from '../types/models';

export function PriorityScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { columns } = useResponsive();
  const show = useUIStore((s) => s.show);
  const [items, setItems] = useState<BatchWithProduct[]>([]);

  useFocusEffect(useCallback(() => { setItems(activeBatches().filter((b) => b.status !== 'good')); }, []));

  const sendPromo = async () => {
    const targets = items.filter((b) => b.status === 'critical' || b.status === 'warning');
    if (targets.length === 0) {
      show('لا توجد منتجات مناسبة للعرض حالياً', 'info');
      return;
    }
    const ok = await openWhatsappWithText(
      buildPromoText(targets.map((b) => ({ name: b.productName, batchNumber: b.batchNumber, daysLeft: b.daysLeft, quantity: b.quantity }))),
      '',
    );
    if (!ok) show('تعذّر فتح واتساب', 'error');
  };

  return (
    <Screen back title="أولويات البيع" subtitle="بِع هذا أولاً (الأقرب انتهاءً)" scroll={false}>
      <Button title="نص عرض جاهز للنشر عبر واتساب" variant="secondary" onPress={sendPromo} style={{ marginBottom: spacing.md }} />
      <FlashList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs }}>
            <BatchRow item={item} onPress={() => navigation.navigate('BatchForm', { id: item.id, productId: item.productId })} />
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={<EmptyState title="لا شيء عاجل" message="كل التشغيلات الفعّالة في وضع ممتاز." />}
      />
    </Screen>
  );
}
