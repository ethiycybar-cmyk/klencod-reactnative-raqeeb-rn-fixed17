import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BarcodeField } from '../components/BarcodeField';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { useResponsive } from '../hooks/useResponsive';
import { useUIStore } from '../store/uiStore';
import { CATEGORIES } from '../types/models';
import { storage, MIGRATE_DRAFT_KEY } from '../data/storage';
import { classifyFor } from '../config/thresholds';
import { isEmployeeMode } from '../services/appPrefs';
import {
  authorizeRestore,
  createEncryptedBackup,
  importBackup,
  pickAndDecryptBackup,
  saveBackupToDevice,
  shareBackup,
  type PreparedRestore,
} from '../services/backupService';
import { migrateItems, type MigrationItem } from '../data/repositories/migrateRepo';
import { checkRow, emptyRow, isBlankRow, QUICK_EXPIRY, resolveValidity, type MigrationRow, type ValidityMode } from '../domain/migration';
import { addDaysISO, addMonthsISO, formatDate, todayISO } from '../utils/dates';
import type { RootStackParamList } from '../app/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Migrate'>;
type TabKey = 'migrate' | 'backup';

const PRODUCTION_MONTHS = [3, 6, 9, 12, 18, 24];
let keyCounter = 0;
const newKey = () => `${Date.now()}-${keyCounter++}`;

function loadDraft(): MigrationRow[] {
  try {
    const raw = storage.getString(MIGRATE_DRAFT_KEY);
    if (!raw) return [emptyRow(newKey())];
    const parsed = JSON.parse(raw) as MigrationRow[];
    if (!Array.isArray(parsed) || !parsed.length) return [emptyRow(newKey())];
    return parsed.map((r) => ({ ...emptyRow(newKey()), ...r, key: newKey() }));
  } catch {
    return [emptyRow(newKey())];
  }
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.segment, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[styles.segmentItem, active && { backgroundColor: c.primary }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[typography.body, { color: active ? '#FFFFFF' : c.text, fontWeight: active ? '700' : '500', textAlign: 'center' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RowEditor({
  row,
  index,
  error,
  canRemove,
  onChange,
  onRemove,
}: {
  row: MigrationRow;
  index: number;
  error?: string;
  canRemove: boolean;
  onChange: (patch: Partial<MigrationRow>) => void;
  onRemove: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const touched = row.mode === 'expiry' ? Boolean(row.expiryText.trim()) : Boolean(row.productionText.trim() || row.monthsText.trim());
  const validity = useMemo(() => resolveValidity(row), [row]);
  const status = validity.ok ? classifyFor(validity.daysLeft, row.category || null) : null;

  return (
    <Card>
      <View style={styles.rowHeader}>
        <Text style={[typography.h3, { color: c.text }]}>{`صنف ${index + 1}`}</Text>
        {canRemove ? <Button title="حذف" size="sm" variant="outline" onPress={onRemove} /> : null}
      </View>

      <Input label="اسم الصنف *" value={row.name} onChangeText={(v) => onChange({ name: v })} placeholder="مثال: جبنة شيدر 200 جم" />
      <BarcodeField label="الباركود (اختياري)" value={row.barcode} onChangeText={(v) => onChange({ barcode: v })} placeholder="امسح أو اكتب الرقم" compact />

      <Text style={[typography.body, { color: c.text, fontWeight: '600', marginBottom: spacing.xs }]}>الفئة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginBottom: spacing.md }}>
        {CATEGORIES.map((cat) => (
          <Button key={cat} title={cat} size="sm" variant={row.category === cat ? 'primary' : 'outline'} onPress={() => onChange({ category: row.category === cat ? '' : cat })} />
        ))}
      </ScrollView>

      <Input label="الكمية" value={row.quantity} onChangeText={(v) => onChange({ quantity: v })} keyboard="numeric" />

      <Text style={[typography.body, { color: c.text, fontWeight: '600', marginBottom: spacing.xs }]}>تحديد الصلاحية</Text>
      <Segmented<ValidityMode>
        value={row.mode}
        onChange={(mode) => onChange({ mode })}
        options={[
          { key: 'expiry', label: 'صالح حتى تاريخ' },
          { key: 'production', label: 'الإنتاج + مدة الصلاحية' },
        ]}
      />

      {row.mode === 'expiry' ? (
        <View style={{ marginTop: spacing.md }}>
          <Input
            label="تاريخ الانتهاء"
            value={row.expiryText}
            onChangeText={(v) => onChange({ expiryText: v })}
            placeholder="2027-03-15 أو 15/3/2027 أو 03/2027"
            ltr
            hint="تُحسب الأيام المتبقية من تاريخ اليوم. 03/2027 تعني آخر يوم في الشهر."
          />
          <View style={styles.chips}>
            {QUICK_EXPIRY.map((q) => (
              <Button
                key={q.label}
                title={q.label}
                size="sm"
                variant="outline"
                onPress={() => onChange({ expiryText: q.days != null ? addDaysISO(q.days) : addMonthsISO(q.months ?? 0) })}
              />
            ))}
          </View>
        </View>
      ) : (
        <View style={{ marginTop: spacing.md }}>
          <Input
            label="تاريخ الإنتاج"
            value={row.productionText}
            onChangeText={(v) => onChange({ productionText: v })}
            placeholder="2026-09-01 أو 1/9/2026"
            ltr
          />
          <Button title="اليوم" size="sm" variant="outline" onPress={() => onChange({ productionText: todayISO() })} style={{ alignSelf: 'flex-start', marginBottom: spacing.md, marginTop: -spacing.xs }} />
          <Input
            label="صالح لمدة (بالأشهر) من تاريخ الإنتاج"
            value={row.monthsText}
            onChangeText={(v) => onChange({ monthsText: v })}
            keyboard="numeric"
            placeholder="مثال: 9"
            hint="اكتب الرقم فقط، مثلاً 9 تعني ينتهي بعد 9 أشهر من تاريخ الإنتاج."
          />
          <View style={styles.chips}>
            {PRODUCTION_MONTHS.map((m) => (
              <Button key={m} title={`${m} أشهر`} size="sm" variant={row.monthsText.trim() === String(m) ? 'primary' : 'outline'} onPress={() => onChange({ monthsText: String(m) })} />
            ))}
          </View>
        </View>
      )}

      {touched ? (
        <View style={[styles.preview, { backgroundColor: c.surfaceAlt, borderColor: c.border }]}>
          {validity.ok && status ? (
            <>
              <Text style={[typography.body, { color: c.text }]}>{`ينتهي في ${formatDate(validity.expiryDate)}`}</Text>
              <Badge status={status} days={validity.daysLeft} />
            </>
          ) : (
            <Text style={[typography.caption, { color: c.warning }]}>{validity.ok ? '' : validity.error}</Text>
          )}
        </View>
      ) : null}

      <View style={{ marginTop: spacing.md }}>
        <Input label="رقم التشغيلة (اختياري)" value={row.batchNumber} onChangeText={(v) => onChange({ batchNumber: v })} ltr hint="إن تركته فارغاً يُنشأ رقم تلقائي." />
      </View>

      {error ? <Text style={[typography.caption, { color: c.critical }]}>{error}</Text> : null}
    </Card>
  );
}

export function MigrateScreen({ route }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const show = useUIStore((s) => s.show);
  const { columns } = useResponsive();
  const employee = isEmployeeMode();
  const [tab, setTab] = useState<TabKey>(route.params?.tab === 'backup' && !employee ? 'backup' : 'migrate');

  const [rows, setRows] = useState<MigrationRow[]>(loadDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      storage.set(MIGRATE_DRAFT_KEY, JSON.stringify(rows));
    } catch {
      // المسودة ميزة مساعدة؛ فشل حفظها لا يوقف العمل.
    }
  }, [rows]);

  const patchRow = (key: string, patch: Partial<MigrationRow>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow(newKey())]);
  const removeRow = (key: string) => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : [emptyRow(newKey())]));

  const submit = () => {
    const filled = rows.filter((r) => !isBlankRow(r));
    if (!filled.length) {
      show('أدخل صنفاً واحداً على الأقل', 'error');
      return;
    }
    const nextErrors: Record<string, string> = {};
    const items: MigrationItem[] = [];
    filled.forEach((row) => {
      const check = checkRow(row);
      if (check.ok) items.push(check.item);
      else nextErrors[row.key] = `صنف ${rows.indexOf(row) + 1}: ${check.error}`;
    });
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      show('صحّح الأصناف المعلَّمة بالأحمر ثم أعد المحاولة', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = migrateItems(items);
      const failedKeys = new Set(result.failed.map((f) => f.key));
      const failedErrors: Record<string, string> = {};
      result.failed.forEach((f) => { failedErrors[f.key] = f.error; });
      setErrors(failedErrors);
      setRows((prev) => {
        const kept = prev.filter((r) => failedKeys.has(r.key));
        return kept.length ? kept : [emptyRow(newKey())];
      });
      if (result.done.length) {
        show(`تم ترحيل ${result.done.length} صنف (${result.createdProducts} جديد، ${result.addedToExisting} أُضيفت له تشغيلة)`, 'success');
      }
      if (result.failed.length) show(`تعذّر ترحيل ${result.failed.length} صنف. راجع الرسائل الحمراء.`, 'error');
    } catch (e) {
      show(e instanceof Error ? e.message : 'تعذّر الترحيل', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ───────────── النسخ الاحتياطي ─────────────
  const [password, setPassword] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'save' | 'share' | 'import' | null>(null);
  const [prepared, setPrepared] = useState<PreparedRestore | null>(null);

  const needPassword = (): boolean => {
    if (!password.trim()) {
      setPassError('أدخل كلمة التثبيت');
      return false;
    }
    setPassError(null);
    return true;
  };

  const backup = async (how: 'save' | 'share') => {
    if (!needPassword()) return;
    setBusy(how);
    try {
      const file = await createEncryptedBackup(password);
      if (how === 'save') {
        const res = await saveBackupToDevice(file);
        if (res === 'saved') show('تم حفظ النسخة الاحتياطية المشفّرة', 'success');
      } else {
        await shareBackup(file);
      }
      setPassword('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذّر إنشاء النسخة';
      if (/كلمة التثبيت/.test(msg)) setPassError(msg);
      else show(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  const startImport = async () => {
    if (!needPassword()) return;
    setBusy('import');
    try {
      await authorizeRestore(password);
      const result = await pickAndDecryptBackup(password);
      if (result) setPrepared(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'تعذّر الاستيراد';
      if (/^كلمة التثبيت/.test(msg)) setPassError(msg);
      else show(msg, 'error');
    } finally {
      setBusy(null);
    }
  };

  const confirmImport = async () => {
    const current = prepared;
    setPrepared(null);
    if (!current) return;
    setBusy('import');
    try {
      const res = await importBackup(current.json);
      show(res.message, res.ok ? 'success' : 'error');
      if (res.ok) setPassword('');
    } catch (e) {
      show(e instanceof Error ? e.message : 'تعذّر الاستيراد', 'error');
    } finally {
      setBusy(null);
    }
  };

  const cardWidth = columns >= 2 ? '49%' : '100%';

  return (
    <Screen back title="ترحيل الأصناف" subtitle={tab === 'migrate' ? 'أدخل الأصناف وتواريخها ثم رحّلها دفعة واحدة' : 'نسخة مضغوطة ومشفّرة بكلمة التثبيت'}>
      {!employee ? (
        <Segmented<TabKey>
          value={tab}
          onChange={setTab}
          options={[
            { key: 'migrate', label: 'ترحيل الأصناف' },
            { key: 'backup', label: 'النسخ الاحتياطي' },
          ]}
        />
      ) : null}

      {tab === 'migrate' ? (
        <>
          <Card>
            <Text style={[typography.body, { color: c.textMuted }]}>
              أدخل اسم كل صنف وتاريخه. يمكنك كتابة تاريخ الانتهاء مباشرة، أو كتابة تاريخ الإنتاج مع مدة الصلاحية بالأشهر. عند «حفظ وترحيل» تنتقل الأصناف إلى المنتجات والتشغيلات وتُراقب تواريخها.
            </Text>
          </Card>

          <View style={styles.grid}>
            {rows.map((row, i) => (
              <View key={row.key} style={{ width: cardWidth }}>
                <RowEditor
                  row={row}
                  index={i}
                  error={errors[row.key]}
                  canRemove={rows.length > 1}
                  onChange={(patch) => patchRow(row.key, patch)}
                  onRemove={() => removeRow(row.key)}
                />
              </View>
            ))}
          </View>

          <Button title="+ إضافة صنف آخر" variant="outline" onPress={addRow} />
          <Button title="حفظ وترحيل" size="lg" onPress={submit} loading={saving} />
        </>
      ) : (
        <>
          <Card>
            <Text style={[typography.h3, { color: c.text, marginBottom: spacing.sm }]}>كلمة التثبيت</Text>
            <Text style={[typography.caption, { color: c.textMuted, marginBottom: spacing.md }]}>
              تُشفَّر النسخة بكلمة التثبيت نفسها، ولا يقبل التطبيق الاستيراد إلا بإدخالها. تشمل المنتجات والتشغيلات وحركات المخزون.
            </Text>
            <Input label="كلمة التثبيت" value={password} onChangeText={(v) => { setPassword(v); setPassError(null); }} secure error={passError} />
          </Card>

          <Card>
            <Text style={[typography.h3, { color: c.text, marginBottom: spacing.sm }]}>حفظ نسخة احتياطية</Text>
            <Button title="حفظ في الجهاز" onPress={() => backup('save')} loading={busy === 'save'} disabled={busy !== null && busy !== 'save'} />
            <Button title="مشاركة (واتساب / Drive / ...)" variant="secondary" onPress={() => backup('share')} loading={busy === 'share'} disabled={busy !== null && busy !== 'share'} style={{ marginTop: spacing.sm }} />
          </Card>

          <Card>
            <Text style={[typography.h3, { color: c.text, marginBottom: spacing.sm }]}>استيراد نسخة</Text>
            <Text style={[typography.caption, { color: c.textMuted, marginBottom: spacing.md }]}>
              أدخل كلمة التثبيت أولاً ثم اختر الملف. سيحلّ محتوى النسخة محل المنتجات والتشغيلات الحالية.
            </Text>
            <Button title="اختيار ملف واستيراده" variant="outline" onPress={startImport} loading={busy === 'import'} disabled={busy !== null && busy !== 'import'} />
          </Card>
        </>
      )}

      <ConfirmDialog
        visible={prepared !== null}
        title="استيراد النسخة الاحتياطية"
        message={prepared ? `ستُستبدل بياناتك الحالية بـ ${prepared.products} منتجاً و${prepared.batches} تشغيلة من النسخة${prepared.exportedAt ? ` المأخوذة في ${prepared.exportedAt.slice(0, 10)}` : ''}. لا يمكن التراجع.` : ''}
        confirmLabel="استيراد"
        danger
        onConfirm={confirmImport}
        onCancel={() => setPrepared(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: radius.pill, padding: 4, gap: 4 },
  segmentItem: { flex: 1, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  preview: { marginTop: spacing.md, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
});
