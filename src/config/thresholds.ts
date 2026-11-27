import { storage, THRESHOLDS_KEY } from '../data/storage';
import { classifyExpiry, DEFAULT_THRESHOLDS, type Thresholds } from '../domain/expiry';
import type { StatusLevel } from '../types/models';

/** عتبات افتراضية ذكية لكل فئة (بالأيام). الفئة غير المذكورة تستخدم العتبة العامة 10/90. */
export const DEFAULT_CATEGORY_THRESHOLDS: Record<string, Thresholds> = {
  'أجبان وألبان': { critical: 5, excellent: 30 },
  'مخبوزات': { critical: 3, excellent: 14 },
  'لحوم ودواجن': { critical: 5, excellent: 30 },
  'مجمدات': { critical: 14, excellent: 90 },
  'آيس كريم': { critical: 14, excellent: 90 },
  'عصائر': { critical: 7, excellent: 45 },
  'مشروبات غازية': { critical: 14, excellent: 90 },
  'بسكويت وكيك': { critical: 10, excellent: 60 },
  'حلويات وشوكولاتة': { critical: 10, excellent: 60 },
  'معلبات': { critical: 30, excellent: 180 },
  'أرز وحبوب': { critical: 30, excellent: 180 },
  'زيوت وسمن': { critical: 30, excellent: 180 },
  'أدوية': { critical: 30, excellent: 180 },
  'مستلزمات طبية': { critical: 30, excellent: 180 },
  'مكمّلات غذائية': { critical: 30, excellent: 180 },
};

let overrides: Record<string, Thresholds> | null = null;

function loadOverrides(): Record<string, Thresholds> {
  if (overrides) return overrides;
  try {
    const raw = storage.getString(THRESHOLDS_KEY);
    overrides = raw ? (JSON.parse(raw) as Record<string, Thresholds>) : {};
  } catch {
    overrides = {};
  }
  return overrides;
}

export function thresholdsFor(category: string | null | undefined): Thresholds {
  if (!category) return DEFAULT_THRESHOLDS;
  return loadOverrides()[category] ?? DEFAULT_CATEGORY_THRESHOLDS[category] ?? DEFAULT_THRESHOLDS;
}

/** يحفظ عتبة فئة؛ يعيد false إن كانت القيم غير منطقية. */
export function saveThresholds(category: string, critical: number, excellent: number): boolean {
  if (!Number.isFinite(critical) || !Number.isFinite(excellent) || critical < 0 || excellent <= critical) return false;
  const next = { ...loadOverrides(), [category]: { critical: Math.round(critical), excellent: Math.round(excellent) } };
  overrides = next;
  storage.set(THRESHOLDS_KEY, JSON.stringify(next));
  return true;
}

export function resetThresholds(): void {
  overrides = {};
  storage.remove(THRESHOLDS_KEY);
}

export function classifyFor(days: number, category: string | null | undefined): StatusLevel {
  return classifyExpiry(days, thresholdsFor(category));
}
