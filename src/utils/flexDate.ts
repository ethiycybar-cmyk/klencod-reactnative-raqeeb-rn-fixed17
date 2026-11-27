/** تحويل أي رقم عربي/فارسي إلى لاتيني. */
export function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

const pad = (n: number) => String(n).padStart(2, '0');

function valid(y: number, m: number, d: number): boolean {
  if (y < 1990 || y > 2200 || m < 1 || m > 12 || d < 1) return false;
  return d <= new Date(y, m, 0).getDate();
}

/**
 * يقبل: 2027-03-15 · 2027/3/15 · 15/03/2027 · 15-3-2027 · 03/2027 (شهر/سنة).
 * للصيغة شهر/سنة: endOfMonth=true يعيد آخر يوم في الشهر (الأنسب لتاريخ الانتهاء)،
 * وإلا أول يوم. يعيد YYYY-MM-DD أو null.
 */
export function parseFlexibleDate(text: string, opts: { endOfMonth?: boolean } = {}): string | null {
  const s = toLatinDigits(text).trim().replace(/[.\s]+/g, '/').replace(/-/g, '/');
  if (!s) return null;
  const parts = s.split('/').filter(Boolean).map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  let y: number, m: number, d: number;
  if (parts.length === 3) {
    if (parts[0] > 31) [y, m, d] = parts;
    else [d, m, y] = parts;
  } else if (parts.length === 2) {
    if (parts[0] > 31) [y, m] = parts;
    else [m, y] = parts;
    d = opts.endOfMonth ? new Date(y, m, 0).getDate() : 1;
  } else {
    return null;
  }
  if (y < 100) y += 2000;
  return valid(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateToISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** تاريخ + n أشهر (مع ضبط نهاية الشهر) أو + n أياماً. */
export function addToISO(iso: string, amount: number, unit: 'months' | 'days'): string {
  const base = isoToDate(iso);
  if (unit === 'days') {
    base.setDate(base.getDate() + amount);
    return dateToISO(base);
  }
  const y = base.getFullYear();
  const m = base.getMonth() + amount;
  const lastDay = new Date(y, m + 1, 0).getDate();
  return dateToISO(new Date(y, m, Math.min(base.getDate(), lastDay)));
}
