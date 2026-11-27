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
import { listBatches } from '../data/repositories/batchesRepo';
import { recordMovement } from '../data/repositories/movementsRepo';

export function RecallScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const show = useUIStore((s) => s.show);
  const [q, setQ] = useState('');
  const [rev, setRev] = useState(0);
  const [confirm, setConfirm] = useState(false);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    return listBatches(term).filter((b) => b.batchNumber.toLowerCase().includes(term));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rev]);

  const total = matches.reduce((sum, b) => sum + b.quantity, 0);

  const doRecall = () => {
    setConfirm(false);
    let n = 0;
    matches.forEach((b) => {
      if (b.quantity > 0 && recordMovement(b.id, 'recall', b.quantity, `سحب تشغيلة ${b.batchNumber}`).ok) n += 1;
    });
    setRev((v) => v + 1);
    show(n ? `تم سحب ${n} تشغيلة من المخزون` : 'لا توجد كميات لسحبها', n ? 'success' : 'info');
  };

  return (
    <Screen back title="سحب تشغيلة" subtitle="اكتب رقم التشغيلة المعلن سحبها">
      <Card>
        <Input label="رقم التشغيلة" value={q} onChangeText={setQ} ltr placeholder="مثال: B2407" hint="يبحث في كل المنتجات (حرفان على الأقل)" />
      </Card>

      {q.trim().length >= 2 ? (
        matches.length === 0 ? (
          <EmptyState title="لا توجد تشغيلة بهذا الرقم" message="تأكد من الرقم وحاول مجدداً." />
        ) : (
          <>
            <Card>
              <Text style={[typography.h3, { color: theme.colors.text }]}>وُجدت {matches.length} تشغيلة · إجمالي {total} وحدة</Text>
              <Button title="تسجيل السحب (تصفير الكميات)" variant="danger" onPress={() => setConfirm(true)} disabled={total === 0} style={{ marginTop: spacing.md }} />
            </Card>
            {matches.map((b) => (
              <BatchRow key={b.id} item={b} onPress={() => navigation.navigate('BatchForm', { id: b.id, productId: b.productId })} />
            ))}
          </>
        )
      ) : null}

      <ConfirmDialog
        visible={confirm}
        title="تأكيد السحب"
        message={`سيتم تصفير ${total} وحدة من ${matches.length} تشغيلة وتسجيلها كسحب. هل أنت متأكد؟`}
        confirmLabel="سحب"
        danger
        onConfirm={doRecall}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
