import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { FadeIn } from '../components/ui/FadeIn';
import { useTheme } from '../theme/ThemeContext';
import { cardShadow, radius, spacing, typography } from '../theme/tokens';
import { useUIStore } from '../store/uiStore';
import { CATEGORIES } from '../types/models';
import { classifyFor } from '../config/thresholds';
import { daysUntilExpiry } from '../domain/expiry';
import { addDaysISO, addMonthsISO, todayISO } from '../utils/dates';
import { addToISO, parseFlexibleDate, toLatinDigits } from '../utils/flexDate';
import { createBatch } from '../data/repositories/batchesRepo';
import { createProduct, findProductByBarcode, findProductByName } from '../data/repositories/productsRepo';
import { scanBarcode, pickFileBase64 } from '../services/nativeBridge';
import { createBackupZip, restoreBackupZip } from '../services/backupFile';
import { shareZip } from '../services/exportService';
import { verifyInstallPassword } from '../services/authService';
import { isEmployeeMode } from '../services/appPrefs';

type Mode = 'expiry' | 'production';
type Unit = 'months' | 'days';
type Row = {
  id: number;
  name: string;
  barcode: string;
  category: string;
  quantity: string;
  batchNumber: string;
  mode: Mode;
  expiry: string;
  production: string;
  validFor: string;
  unit: Unit;
};

let nextId = 1;
const blank = (name = ''): Row => ({
  id: nextId++,
  name,
  barcode: '',
  category: 'أخرى',
  quantity: '1',
  batchNumber: '',
  mode: 'expiry',
  expiry: '',
  production: '',
  validFor: '',
  unit: 'months',
});

type Resolved = { expiryISO: string | null; productionISO: string | null; error: string | null };

function resolveDates(r: Row): Resolved {
  if (r.mode === 'expiry') {
    const e = parseFlexibleDate(r.expiry, { endOfMonth: true });
    if (e) return { expiryISO: e, productionISO: null, error: null };
    return { expiryISO: null, productionISO: null, error: r.expiry.trim() ? 'تاريخ الانتهاء غير صالح' : 'أدخل تاريخ الانتهاء' };
  }
  const p = parseFlexibleDate(r.production, { endOfMonth: false });
  if (!p) return { expiryISO: null, productionISO: null, error: r.production.trim() ? 'تاريخ الإنتاج غير صالح' : 'أدخل تاريخ الإنتاج' };
  const n = parseInt(toLatinDigits(r.validFor).replace(/\D/g, ''), 10);
  if (!n || n <= 0) return { expiryISO: null, productionISO: null, error: 'أدخل مدة الصلاحية' };
  return { expiryISO: addToISO(p, n, r.unit), productionISO: p, error: null };
}

function quantityOf(r: Row): number | null {
  const raw = toLatinDigits(r.quantity).trim();
  if (raw === '') return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

/** سبب عدم جاهزية الصف، أو null إن كان جاهزاً. */
function issueOf(r: Row): string | null {
  const existing = r.barcode.trim() ? findProductByBarcode(r.barcode) : null;
  if (!existing && !r.name.trim() && !findProductByName(r.name)) return 'أدخل اسم الصنف';
  const d = resolveDates(r);
  if (d.error) return d.error;
  if (quantityOf(r) === null) return 'الكمية غير صالحة';
  return null;
}

const EXPIRY_SHORTCUTS: { label: string; get: () => string }[] = [
  { label: '10 أيام', get: () => addDaysISO(10) },
  { label: 'شهر', get: () => addMonthsISO(1) },
  { label: '3 أشهر', get: () => addMonthsISO(3) },
  { label: '6 أشهر', get: () => addMonthsISO(6) },
  { label: 'سنة', get: () => addMonthsISO(12) },
];
const VALID_MONTHS = ['3', '6', '9', '12', '18', '24'];

function Chip({ label, active, onPress, color }: { label: string; active?: boolean; onPress: () => void; color?: string }) {
  const { theme } = useTheme();
  const c = color ?? theme.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? c : theme.colors.surfaceAlt, borderColor: active ? c : theme.colors.border }]}
    >
      <Text style={[typography.caption, { color: active ? '#FFFFFF' : theme.colors.text, fontWeight: active ? '700' : '500' }]}>{label}</Text>
    </Pressable>
  );
}

type RowCardProps = {
  row: Row;
  index: number;
  onChange: (id: number, patch: Partial<Row>) => void;
  onRemove: (id: number) => void;
  onScan: (id: number) => void;
};

const RowCard = React.memo(function RowCard({ row, index, onChange, onRemove, onScan }: RowCardProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const issue = issueOf(row);
  const dates = resolveDates(row);
  const existing = useMemo(() => (row.barcode.trim() ? findProductByBarcode(row.barcode) : null), [row.barcode]);
  const days = dates.expiryISO ? daysUntilExpiry(dates.expiryISO) : null;
  const status = days !== null ? classifyFor(days, existing?.category ?? row.category) : null;
  const statusColor = status ? c[status] : c.textMuted;
  const accent = issue ? c.warning : c.good;

  return (
    <View style={[styles.rowCard, cardShadow, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.rowHead}>
        <View style={[styles.badge, { backgroundColor: c.primarySoft }]}>
          <Text style={[typography.bodyLg, { color: c.primary, fontWeight: '800' }]}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyLg, { color: c.text, fontWeight: '700' }]} numberOfLines={1}>{row.name.trim() || existing?.name || 'صنف جديد'}</Text>
          <Text style={[typography.caption, { color: issue ? c.warning : c.good }]}>
            {issue ?? (existing ? 'جاهز · منتج موجود وستُضاف له تشغيلة' : 'جاهز للترحيل')}
          </Text>
        </View>
        <Pressable onPress={() => onRemove(row.id)} hitSlop={10} style={[styles.remove, { backgroundColor: c.surfaceAlt }]}>
          <Text style={{ color: c.critical, fontSize: 16, fontWeight: '800' }}>✕</Text>
        </Pressable>
      </View>

      <Input label="اسم الصنف" value={row.name} onChangeText={(v) => onChange(row.id, { name: v })} placeholder={existing ? existing.name : 'مثال: جبنة شيدر 200 جم'} />

      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Input label="الباركود" value={row.barcode} onChangeText={(v) => onChange(row.id, { barcode: v })} ltr placeholder="اختياري" />
        </View>
        <Button title="مسح" size="md" variant="secondary" onPress={() => onScan(row.id)} style={styles.scanBtn} />
      </View>

      <Text style={[typography.caption, { color: c.textMuted }]}>الفئة</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {['أخرى', ...CATEGORIES.filter((x) => x !== 'أخرى')].map((cat) => (
          <Chip key={cat} label={cat} active={row.category === cat} onPress={() => onChange(row.id, { category: cat })} />
        ))}
      </ScrollView>

      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Input label="الكمية" value={row.quantity} onChangeText={(v) => onChange(row.id, { quantity: v })} keyboard="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="رقم التشغيلة (اختياري)" value={row.batchNumber} onChangeText={(v) => onChange(row.id, { batchNumber: v })} ltr placeholder="تلقائي" />
        </View>
      </View>

      <Text style={[typography.caption, { color: c.textMuted }]}>طريقة تحديد الصلاحية</Text>
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <Button title="صالح حتى (تاريخ الانتهاء)" size="sm" variant={row.mode === 'expiry' ? 'primary' : 'outline'} onPress={() => onChange(row.id, { mode: 'expiry' })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="إنتاج + مدة صلاحية" size="sm" variant={row.mode === 'production' ? 'primary' : 'outline'} onPress={() => onChange(row.id, { mode: 'production' })} />
        </View>
      </View>

      {row.mode === 'expiry' ? (
        <>
          <Input label="تاريخ الانتهاء" value={row.expiry} onChangeText={(v) => onChange(row.id, { expiry: v })} ltr placeholder="2027-03-15 أو 15/03/2027 أو 03/2027" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {EXPIRY_SHORTCUTS.map((s) => (
              <Chip key={s.label} label={s.label} onPress={() => onChange(row.id, { expiry: s.get() })} />
            ))}
          </ScrollView>
        </>
      ) : (
        <>
          <Input label="تاريخ الإنتاج" value={row.production} onChangeText={(v) => onChange(row.id, { production: v })} ltr placeholder="2026-05-01 أو 01/05/2026 أو 05/2026" />
          <View style={styles.inline}>
            <View style={{ flex: 1 }}>
              <Input label="صالح لمدة" value={row.validFor} onChangeText={(v) => onChange(row.id, { validFor: v })} keyboard="numeric" placeholder="مثال: 9" />
            </View>
            <View style={styles.unitBox}>
              <Chip label="أشهر" active={row.unit === 'months'} onPress={() => onChange(row.id, { unit: 'months' })} />
              <Chip label="أيام" active={row.unit === 'days'} onPress={() => onChange(row.id, { unit: 'days' })} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {VALID_MONTHS.map((m) => (
              <Chip key={m} label={`${m} شهر`} active={row.validFor === m && row.unit === 'months'} onPress={() => onChange(row.id, { validFor: m, unit: 'months' })} />
            ))}
          </ScrollView>
        </>
      )}

      {dates.expiryISO && days !== null ? (
        <View style={[styles.preview, { backgroundColor: statusColor + '1A', borderColor: statusColor + '55' }]}>
          <Text style={[typography.body, { color: statusColor, fontWeight: '700' }]}>
            ينتهي في {dates.expiryISO} · {days < 0 ? `منتهٍ منذ ${Math.abs(days)} يوم` : `بعد ${days} يوم`}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

export function MigrationScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const navigation = useNavigation<any>();
  const show = useUIStore((s) => s.show);
  const employee = isEmployeeMode();

  const [rows, setRows] = useState<Row[]>(() => [blank()]);
  const [bulk, setBulk] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ ok: number; created: number } | null>(null);

  const [bkPass, setBkPass] = useState('');
  const [bkBusy, setBkBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const readyCount = rows.filter((r) => issueOf(r) === null).length;

  const update = useCallback((id: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const remove = useCallback((id: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : [blank()]));
  }, []);

  const scan = useCallback(
    async (id: number) => {
      try {
        const code = await scanBarcode();
        if (!code) return;
        const found = findProductByBarcode(code);
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, barcode: code, name: r.name.trim() ? r.name : found?.name ?? r.name, category: found?.category ?? r.category } : r,
          ),
        );
        show(found ? `منتج موجود: ${found.name}` : 'تم قراءة الباركود', found ? 'info' : 'success');
      } catch (e) {
        show(e instanceof Error ? e.message : 'تعذّر المسح', 'error');
      }
    },
    [show],
  );

  const addBulk = () => {
    const names = bulk
      .split(/[\n،,]+/)
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 100);
    if (names.length === 0) return;
    setRows((prev) => {
      const base = prev.length === 1 && !prev[0].name.trim() && !prev[0].barcode.trim() ? [] : prev;
      return [...base, ...names.map((n) => blank(n))];
    });
    setBulk('');
    show(`أُضيفت ${names.length} أسماء`, 'success');
  };

  const migrate = () => {
    setSaving(true);
    setDone(null);
    const failed: Row[] = [];
    let ok = 0;
    let created = 0;
    let seq = 1;
    const stamp = todayISO().replace(/-/g, '');
    for (const r of rows) {
      if (issueOf(r) !== null) {
        failed.push(r);
        continue;
      }
      try {
        const dates = resolveDates(r);
        const existing = (r.barcode.trim() ? findProductByBarcode(r.barcode) : null) ?? findProductByName(r.name);
        let productId: number;
        if (existing) {
          productId = existing.id;
        } else {
          productId = createProduct({ name: r.name.trim(), barcode: r.barcode.trim(), category: r.category, minStock: '0' });
          created += 1;
        }
        createBatch({
          productId,
          batchNumber: r.batchNumber.trim() || `M-${stamp}-${seq++}`,
          quantity: String(quantityOf(r) ?? 1),
          productionDate: dates.productionISO ?? '',
          expiryDate: dates.expiryISO as string,
          supplier: '',
          notes: '',
          location: '',
        });
        ok += 1;
      } catch {
        failed.push(r);
      }
    }
    setRows(failed.length ? failed : [blank()]);
    setSaving(false);
    if (ok > 0) {
      setDone({ ok, created });
      show(`تم ترحيل ${ok} صنف`, 'success');
    }
    if (failed.length > 0) show(`${failed.length} صنف لم يُرحَّل — راجع الحقول الناقصة`, 'error');
  };

  const makeBackup = async () => {
    if (!bkPass) {
      show('أدخل كلمة مرور التثبيت', 'error');
      return;
    }
    setBkBusy(true);
    try {
      if (!(await verifyInstallPassword(bkPass))) {
        show('كلمة مرور التثبيت غير صحيحة', 'error');
        return;
      }
      const { base64, filename } = createBackupZip(bkPass);
      const result = await shareZip(base64, filename);
      if (!result.ok && result.message && result.message !== 'تم الإلغاء') show(result.message, 'error');
    } catch {
      show('تعذّر إنشاء النسخة الاحتياطية', 'error');
    } finally {
      setBkBusy(false);
    }
  };

  const startImport = async () => {
    if (!bkPass) {
      show('أدخل كلمة مرور التثبيت أولاً', 'error');
      return;
    }
    setBkBusy(true);
    try {
      if (!(await verifyInstallPassword(bkPass))) {
        show('كلمة مرور التثبيت غير صحيحة — لا يُقبل الاستيراد', 'error');
        return;
      }
      const file = await pickFileBase64();
      if (file) setPending(file);
    } catch (e) {
      show(e instanceof Error ? e.message : 'تعذّر اختيار الملف', 'error');
    } finally {
      setBkBusy(false);
    }
  };

  const confirmImport = async () => {
    const file = pending;
    setPending(null);
    if (!file) return;
    setBkBusy(true);
    try {
      const result = await restoreBackupZip(file, bkPass);
      show(result.ok ? `تم الاستيراد: ${result.products} منتج و${result.batches} تشغيلة` : result.message, result.ok ? 'success' : 'error');
    } finally {
      setBkBusy(false);
    }
  };

  return (
    <Screen back title="ترحيل الأصناف" subtitle="أدخل الأصناف وسنراقب صلاحيتها">
      <View style={[styles.summary, cardShadow, { backgroundColor: c.header }]}>
        <View style={styles.summaryTile}>
          <Text style={styles.summaryValue}>{rows.length}</Text>
          <Text style={styles.summaryLabel}>أصناف</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryValue, { color: '#5EEAD4' }]}>{readyCount}</Text>
          <Text style={styles.summaryLabel}>جاهزة</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryTile}>
          <Text style={[styles.summaryValue, { color: '#FBBF24' }]}>{rows.length - readyCount}</Text>
          <Text style={styles.summaryLabel}>ناقصة</Text>
        </View>
      </View>

      {done ? (
        <FadeIn>
          <Card>
            <Text style={[typography.bodyLg, { color: c.good, fontWeight: '700' }]}>تم ترحيل {done.ok} تشغيلة ({done.created} منتج جديد)</Text>
            <View style={[styles.inline, { marginTop: spacing.sm }]}>
              <View style={{ flex: 1 }}>
                <Button title="عرض المنتجات" size="sm" variant="secondary" onPress={() => navigation.navigate('Main', { screen: 'Products' })} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="عرض التشغيلات" size="sm" variant="secondary" onPress={() => navigation.navigate('Main', { screen: 'Batches' })} />
              </View>
            </View>
          </Card>
        </FadeIn>
      ) : null}

      <Card>
        <Text style={[typography.bodyLg, { color: c.text, fontWeight: '700' }]}>إضافة أسماء دفعة واحدة</Text>
        <Text style={[typography.caption, { color: c.textMuted }]}>اكتب أو الصق الأسماء، اسم في كل سطر، ثم أكمل التواريخ لكل صنف.</Text>
        <Input label="الأسماء" value={bulk} onChangeText={setBulk} multiline placeholder={'حليب كامل الدسم\nجبنة شيدر\nعصير برتقال'} />
        <Button title="إضافة الأسماء كأصناف" variant="outline" onPress={addBulk} disabled={!bulk.trim()} />
      </Card>

      {rows.map((row, i) => (
        <RowCard key={row.id} row={row} index={i} onChange={update} onRemove={remove} onScan={scan} />
      ))}

      <Button title="+ إضافة صنف" variant="outline" onPress={() => setRows((prev) => [...prev, blank()])} />
      <Button title={`حفظ وترحيل (${readyCount})`} size="lg" onPress={migrate} loading={saving} disabled={readyCount === 0} />

      {employee ? null : (
        <Card>
          <Text style={[typography.bodyLg, { color: c.text, fontWeight: '700' }]}>نسخة احتياطية مضغوطة (zip)</Text>
          <Text style={[typography.caption, { color: c.textMuted }]}>
            تُحمى بكلمة مرور التثبيت. الاستيراد لا يُقبل إلا بإدخال كلمة التثبيت الصحيحة، ويستبدل البيانات الحالية.
          </Text>
          <Input label="كلمة مرور التثبيت" value={bkPass} onChangeText={setBkPass} secure />
          <Button title="إنشاء نسخة احتياطية ومشاركتها" variant="secondary" onPress={makeBackup} loading={bkBusy} />
          <Button title="استيراد نسخة احتياطية" variant="outline" onPress={startImport} disabled={bkBusy} />
        </Card>
      )}

      <ConfirmDialog
        visible={pending !== null}
        title="استيراد النسخة الاحتياطية"
        message="سيتم استبدال كل المنتجات والتشغيلات الحالية بمحتوى النسخة. هل أنت متأكد؟"
        confirmLabel="استيراد"
        danger
        onConfirm={confirmImport}
        onCancel={() => setPending(null)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.lg },
  summaryTile: { flex: 1, alignItems: 'center' },
  summaryValue: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  summaryLabel: { color: '#FFFFFFB3', fontSize: 12, marginTop: 2 },
  summaryDivider: { width: 1, height: 36, backgroundColor: '#FFFFFF33' },
  rowCard: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, overflow: 'hidden' },
  accent: { position: 'absolute', top: 0, start: 0, end: 0, height: 4 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  badge: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  remove: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  scanBtn: { marginBottom: spacing.xs },
  chips: { gap: spacing.xs, paddingVertical: spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  unitBox: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xs },
  preview: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
});
