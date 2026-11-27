import { addMonthsISO, daysBetween, isISODate, todayISO } from '../utils/dates';
import { toLatinDigits } from '../utils/digits';

/** صالح حتى تاريخ محدد (يُحسب من اليوم) أو صالح لمدة أشهر من تاريخ الإنتاج. */
export type ValidityMode = 'expiry' | 'production';

export type QuickExpiry = { label: string; days?: number; months?: number };

export const QUICK_EXPIRY: QuickExpiry[] = [
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

const SEP = '[\\/\\-.\\s]';
const YMD = new RegExp(`^(\\d{4})${SEP}(\\d{1,2})${SEP}(\\d{1,2})$`);
const DMY = new RegExp(`^(\\d{1,2})${SEP}(\\d{1,2})${SEP}(\\d{4})$`);
const DMY2 = new RegExp(`^(\\d{1,2})${SEP}(\\d{1,2})${SEP}(\\d{2})$`);
const MY = new RegExp(`^(\\d{1,2})${SEP}(\\d{4})$`);
const YM = new RegExp(`^(\\d{4})${SEP}(\\d{1,2})$`);

const pad = (n: number) => String(n).padStart(2, '0');

function build(y: number, m: number, d: number): string | null {
  const iso = `${y}-${pad(m)}-${pad(d)}`;
  return isISODate(iso) ? iso : null;
}

/**
 * يقرأ التاريخ بصيغ شائعة: 2027-03-15 · 15/3/2027 · 15-03-27 · ٣/٢٠٢٧ (شهر/سنة).
 * اليوم يأتي أولاً في الصيغة اليومية (15/3/2027). صيغة شهر/سنة تعني آخر يوم من الشهر
 * عند طلب 'last' (للانتهاء) وأول يوم عند 'first' (للإنتاج). يعيد null إن لم يُفهم.
 */
export function parseFlexibleDate(raw: string, monthEdge: 'first' | 'last' = 'last'): string | null {
  const t = toLatinDigits(raw).trim();
  if (!t) return null;
  let m = YMD.exec(t);
  if (m) return build(Number(m[1]), Number(m[2]), Number(m[3]));
  m = DMY.exec(t);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]));
  m = DMY2.exec(t);
  if (m) return build(2000 + Number(m[3]), Number(m[2]), Number(m[1]));
  const monthYear = MY.exec(t) ?? YM.exec(t);
  if (monthYear) {
    const isMY = MY.test(t);
    const month = Number(isMY ? monthYear[1] : monthYear[2]);
    const year = Number(isMY ? monthYear[2] : monthYear[1]);
    if (month < 1 || month > 12) return null;
    const day = monthEdge === 'first' ? 1 : new Date(year, month, 0).getDate();
    return build(year, month, day);
  }
  return null;
}

function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export type ValidityInput = {
  mode: ValidityMode;
  expiryText: string;
  productionText: string;
  monthsText: string;
};

export type ValidityResult =
  | { ok: true; expiryDate: string; productionDate: string | null; daysLeft: number }
  | { ok: false; error: string };

export const MAX_VALID_MONTHS = 120;

/** يحسب تاريخ الانتهاء النهائي من أحد الخيارين. الأيام المتبقية تُحسب من اليوم. */
export function resolveValidity(input: ValidityInput, now: Date = new Date()): ValidityResult {
  const today = todayISO(now);
  if (input.mode === 'expiry') {
    const expiry = parseFlexibleDate(input.expiryText, 'last');
    if (!expiry) return { ok: false, error: 'تاريخ الانتهاء غير صالح (مثال: 2027-03-15 أو 15/3/2027)' };
    return { ok: true, expiryDate: expiry, productionDate: null, daysLeft: daysBetween(today, expiry) };
  }
  const production = parseFlexibleDate(input.productionText, 'first');
  if (!production) return { ok: false, error: 'تاريخ الإنتاج غير صالح (مثال: 2026-09-01 أو 1/9/2026)' };
  const months = Number(toLatinDigits(input.monthsText).trim());
  if (!Number.isInteger(months) || months < 1 || months > MAX_VALID_MONTHS) {
    return { ok: false, error: `مدة الصلاحية بالأشهر رقم صحيح من 1 إلى ${MAX_VALID_MONTHS}` };
  }
  const expiry = addMonthsISO(months, fromISO(production));
  return { ok: true, expiryDate: expiry, productionDate: production, daysLeft: daysBetween(today, expiry) };
}

export type MigrationRow = {
  key: string;
  name: string;
  barcode: string;
  category: string;
  quantity: string;
  batchNumber: string;
  mode: ValidityMode;
  expiryText: string;
  productionText: string;
  monthsText: string;
};

export function emptyRow(key: string): MigrationRow {
  return { key, name: '', barcode: '', category: '', quantity: '1', batchNumber: '', mode: 'expiry', expiryText: '', productionText: '', monthsText: '' };
}

export type RowCheck =
  | { ok: true; item: { key: string; name: string; barcode: string; category: string; quantity: number; batchNumber: string; productionDate: string | null; expiryDate: string } }
  | { ok: false; error: string };

/** صف فارغ تماماً يُتجاهل عند الترحيل ولا يُعدّ خطأ. */
export function isBlankRow(row: MigrationRow): boolean {
  return !row.name.trim() && !row.barcode.trim() && !row.expiryText.trim() && !row.productionText.trim() && !row.monthsText.trim();
}

export function checkRow(row: MigrationRow, now: Date = new Date()): RowCheck {
  const name = row.name.trim();
  if (name.length < 2) return { ok: false, error: 'اسم الصنف مطلوب (حرفان على الأقل)' };
  const quantity = Number(toLatinDigits(row.quantity).trim());
  if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: 'الكمية رقم صحيح من 1 فأكثر' };
  const validity = resolveValidity(row, now);
  if (!validity.ok) return { ok: false, error: validity.error };
  return {
    ok: true,
    item: {
      key: row.key,
      name,
      barcode: toLatinDigits(row.barcode).trim(),
      category: row.category.trim(),
      quantity,
      batchNumber: row.batchNumber.trim(),
      productionDate: validity.productionDate,
      expiryDate: validity.expiryDate,
    },
  };
}
