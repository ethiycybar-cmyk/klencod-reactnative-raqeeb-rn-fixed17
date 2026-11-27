import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/ui/Screen';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { listProducts } from '../data/repositories/productsRepo';
import { createBatch, deleteBatch, getBatch, updateBatch } from '../data/repositories/batchesRepo';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { MOVEMENT_LABELS, type BatchDraft, type MovementType } from '../types/models';
import { listMovementsForBatch, recordMovement } from '../data/repositories/movementsRepo';
import { isEmployeeMode } from '../services/appPrefs';
import { addDaysISO, addMonthsISO, isISODate, todayISO } from '../utils/dates';
import { errorMessage } from '../utils/errors';
import { useUIStore } from '../store/uiStore';
import type { RootStackParamList } from '../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'BatchForm'>;

const schema = z.object({
  productId: z.number().int().positive('اختر المنتج'),
  batchNumber: z.string().trim().min(1, 'رقم التشغيلة مطلوب'),
  quantity: z.coerce.number().int().min(0, 'الكمية يجب أن تكون رقماً صحيحاً'),
  productionDate: z.string().refine((v) => v === '' || isISODate(v), errorMessage('INVALID_DATE')),
  expiryDate: z.string().refine(isISODate, errorMessage('INVALID_DATE')),
});

const QUICK_EXPIRY: { label: string; days?: number; months?: number }[] = [
  { label: '10 أيام', days: 10 },
  { label: '22 يوماً', days: 22 },
  { label: 'شهر', months: 1 },
  { label: 'شهران', months: 2 },
  { label: '3 أشهر', months: 3 },
  { label: '4 أشهر', months: 4 },
  { label: '5 أشهر', months: 5 },
  { label: '6 أشهر', months: 6 },
  { label: 'سنة', months: 12 },
];

export function BatchFormScreen({ route, navigation }: Props) {
  const id = route.params?.id;
  const existing = id ? getBatch(id) : null;
  const products = useMemo(() => listProducts(), []);
  const { theme } = useTheme();
  const show = useUIStore((s) => s.show);
  const [draft, setDraft] = useState<BatchDraft>({
    productId: existing?.productId ?? route.params?.productId ?? 0,
    batchNumber: existing?.batchNumber ?? '',
    quantity: existing ? String(existing.quantity) : '0',
    productionDate: existing?.productionDate ?? todayISO(),
    expiryDate: existing?.expiryDate ?? addDaysISO(365),
    supplier: existing?.supplier ?? '',
    notes: existing?.notes ?? '',
    location: existing?.location ?? '',
  });
  const [moveType, setMoveType] = useState<MovementType>('sale');
  const [moveQty, setMoveQty] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [history, setHistory] = useState(() => (existing ? listMovementsForBatch(existing.id, 5) : []));

  const doMove = () => {
    if (!existing) return;
    const result = recordMovement(existing.id, moveType, Number(moveQty), moveReason);
    if (!result.ok) {
      show(result.message ?? 'تعذّر تسجيل الحركة', 'error');
      return;
    }
    const fresh = getBatch(existing.id);
    if (fresh) set('quantity', String(fresh.quantity));
    setHistory(listMovementsForBatch(existing.id, 5));
    setMoveQty('');
    setMoveReason('');
    show('تم تسجيل الحركة', 'success');
  };
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedProduct = products.find((p) => p.id === draft.productId);
  const set = (key: keyof BatchDraft, value: string | number) => setDraft((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    const parsed = schema.safeParse(draft);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => { next[String(issue.path[0])] = issue.message; });
      setErrors(next);
      return;
    }
    if (draft.productionDate && draft.expiryDate < draft.productionDate) {
      setErrors({ expiryDate: errorMessage('DATE_ORDER') });
      return;
    }
    setSaving(true);
    try {
      if (existing) updateBatch(existing.id, draft);
      else createBatch(draft);
      show(existing ? 'تم تحديث التشغيلة' : 'تمت إضافة التشغيلة', 'success');
      navigation.goBack();
    } catch (e) {
      show(e instanceof Error ? e.message : 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen back title={existing ? 'تعديل التشغيلة' : 'تشغيلة جديدة'}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={[typography.body, { color: theme.colors.text, marginBottom: 6 }]}>المنتج *</Text>
          <Pressable
            onPress={() => setPicker(true)}
            style={({ pressed }) => [styles.select, { borderColor: errors.productId ? theme.colors.critical : theme.colors.border, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[typography.body, { color: selectedProduct ? theme.colors.text : theme.colors.textMuted }]}>
              {selectedProduct?.name ?? 'اضغط لاختيار المنتج'}
            </Text>
          </Pressable>
          {errors.productId ? <Text style={[typography.caption, { color: theme.colors.critical }]}>{errors.productId}</Text> : null}

          <Input label="رقم التشغيلة *" value={draft.batchNumber} onChangeText={(v) => set('batchNumber', v)} ltr error={errors.batchNumber} />
          <Input label="الكمية" value={draft.quantity} onChangeText={(v) => set('quantity', v)} keyboard="numeric" error={errors.quantity} />

          <Input label="تاريخ الإنتاج" value={draft.productionDate} onChangeText={(v) => set('productionDate', v.trim())} placeholder="YYYY-MM-DD" ltr hint="اتركه فارغاً إن لم يوجد" />
          <Input label="تاريخ الانتهاء *" value={draft.expiryDate} onChangeText={(v) => set('expiryDate', v.trim())} placeholder="YYYY-MM-DD" ltr error={errors.expiryDate} />
          <View style={styles.quickDates}>
            {QUICK_EXPIRY.map((q) => (
              <Button
                key={q.label}
                title={q.label}
                size="sm"
                variant="outline"
                onPress={() => set('expiryDate', q.days != null ? addDaysISO(q.days) : addMonthsISO(q.months ?? 0))}
              />
            ))}
          </View>

          <Input label="المورد" value={draft.supplier} onChangeText={(v) => set('supplier', v)} />
          <Input label="موقع التخزين" value={draft.location} onChangeText={(v) => set('location', v)} placeholder="مثال: ثلاجة 2 / رف 3" />
          <Input label="ملاحظات" value={draft.notes} onChangeText={(v) => set('notes', v)} multiline />
        </Card>

        {existing ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { color: theme.colors.text, marginBottom: spacing.sm }]}>حركة سريعة</Text>
            <View style={styles.quickDates}>
              {(['sale', 'waste', 'return'] as MovementType[]).map((t) => (
                <Button key={t} title={MOVEMENT_LABELS[t]} size="sm" variant={moveType === t ? 'primary' : 'outline'} onPress={() => setMoveType(t)} />
              ))}
            </View>
            <Input label="الكمية" value={moveQty} onChangeText={setMoveQty} keyboard="numeric" />
            <Input label="السبب (اختياري)" value={moveReason} onChangeText={setMoveReason} />
            <Button title="تسجيل الحركة" variant="secondary" onPress={doMove} />
            {history.map((m) => (
              <Text key={m.id} style={[typography.caption, { color: theme.colors.textMuted, marginTop: 4 }]}>
                {MOVEMENT_LABELS[m.type]} {m.quantity > 0 ? '+' : ''}{m.quantity} · {m.createdAt.slice(0, 10)}{m.reason ? ` · ${m.reason}` : ''}
              </Text>
            ))}
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button title={existing ? 'حفظ التعديلات' : 'إضافة التشغيلة'} onPress={save} loading={saving} size="lg" />
          <Button title="إلغاء" onPress={() => navigation.goBack()} variant="outline" />
          {existing && !isEmployeeMode() ? <Button title="حذف التشغيلة" onPress={() => setConfirmDelete(true)} variant="danger" /> : null}
        </View>
      </ScrollView>

      <ConfirmDialog
        visible={confirmDelete}
        title="حذف التشغيلة"
        message="سيتم حذف هذه التشغيلة. لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف"
        danger
        onConfirm={() => {
          setConfirmDelete(false);
          if (existing) deleteBatch(existing.id);
          show('تم حذف التشغيلة', 'success');
          navigation.goBack();
        }}
        onCancel={() => setConfirmDelete(false)}
      />

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <View style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}>
          <View style={[styles.picker, { backgroundColor: theme.colors.surface }]}>
            <Text style={[typography.h3, { color: theme.colors.text, marginBottom: spacing.md }]}>اختر المنتج</Text>
            <ScrollView>
              {products.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => { set('productId', p.id); setPicker(false); }}
                  style={({ pressed }) => [styles.productItem, { borderBottomColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[typography.body, { color: theme.colors.text }]}>{p.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button title="إغلاق" variant="outline" onPress={() => setPicker(false)} style={styles.close} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  select: { borderWidth: 1, borderRadius: radius.md, minHeight: 50, justifyContent: 'center', paddingHorizontal: spacing.md, marginBottom: spacing.md },
  quickDates: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md, flexWrap: 'wrap' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  picker: { width: '100%', maxWidth: 420, maxHeight: '75%', borderRadius: radius.xl, padding: spacing.lg },
  productItem: { paddingVertical: spacing.md, borderBottomWidth: 1 },
  close: { marginTop: spacing.md },
});
