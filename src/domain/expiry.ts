import type { StatusLevel } from '../types/models';

/** عدد الأيام الكاملة بين تاريخ اليوم وتاريخ الانتهاء (سالب = منتهٍ). */
export function daysUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  const [y, m, d] = expiryDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const expiry = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((expiry - today) / 86_400_000);
}

/** عتبات التصنيف بالأيام (يمكن تعديلها هنا فقط). */
export const CRITICAL_DAYS = 10; // حرج: 0–10 يوم
export const EXCELLENT_FROM_DAYS = 90; // ممتاز: 90 يوماً فأكثر (3 أشهر)

/** expired < 0 · critical 0–10 · warning(جيد) 11–89 · good(ممتاز) ≥ 90 */
export type Thresholds = { critical: number; excellent: number };
export const DEFAULT_THRESHOLDS: Thresholds = { critical: CRITICAL_DAYS, excellent: EXCELLENT_FROM_DAYS };

export function classifyExpiry(days: number, t: Thresholds = DEFAULT_THRESHOLDS): StatusLevel {
  if (days < 0) return 'expired';
  if (days <= t.critical) return 'critical';
  if (days < t.excellent) return 'warning';
  return 'good';
}

export function statusForDate(expiryDate: string, now: Date = new Date()): StatusLevel {
  return classifyExpiry(daysUntilExpiry(expiryDate, now));
}

export const STATUS_LABEL: Record<StatusLevel, string> = {
  good: 'ممتاز',
  warning: 'جيد',
  critical: 'حرج',
  expired: 'منتهي',
};

/** ترتيب التشغيلات: الأقرب للانتهاء أولاً (يُستخدم في SQL و JS). */
export function byExpiryAsc<T extends { expiryDate: string }>(a: T, b: T): number {
  return a.expiryDate.localeCompare(b.expiryDate);
}
