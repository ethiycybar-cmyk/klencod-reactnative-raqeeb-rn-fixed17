/** الحالات الصحية للتشغيلة/المنتج حسب القرب من انتهاء الصلاحية. */
export type StatusLevel = 'good' | 'warning' | 'critical' | 'expired';

export interface Product {
  id: number;
  name: string;
  barcode: string | null;
  category: string | null;
  minStock: number;
  createdAt: string;
  updatedAt: string;
  dirty: number;
  deletedAt: string | null;
}

export interface Batch {
  id: number;
  productId: number;
  batchNumber: string;
  quantity: number;
  productionDate: string | null;
  expiryDate: string;
  purchasePrice: number | null;
  sellingPrice: number | null;
  supplier: string | null;
  notes: string | null;
  location: string | null;
  isSold: number;
  createdAt: string;
  updatedAt: string;
  dirty: number;
  deletedAt: string | null;
}

export interface AppSettings {
  id: number;
  installHash: string | null;
  installSalt: string | null;
  patternHash: string | null;
  patternSalt: string | null;
  licenseKeyHash: string | null;
  licenseExpiry: string | null;
  licenseSignature: string | null;
  trialStart: string | null;
  isLicenseActive: number;
  deviceFingerprint: string | null;
  failedAttempts: number;
  lockedUntil: string | null;
  lastUpdated: string | null;
}

export interface ProductSummary extends Product {
  totalQuantity: number;
  batchCount: number;
  nearestExpiry: string | null;
  status: StatusLevel;
  daysLeft: number | null;
}

export interface BatchWithProduct extends Batch {
  productName: string;
  category: string | null;
  status: StatusLevel;
  daysLeft: number;
}

export interface DashboardStats {
  totalProducts: number;
  totalBatches: number;
  lowStock: number;
  expiringSoon: number;
  expiredCount: number;
  criticalCount: number;
}

export type ProductDraft = {
  name: string;
  barcode: string;
  category: string;
  minStock: string;
};

export type BatchDraft = {
  productId: number;
  batchNumber: string;
  quantity: string;
  productionDate: string;
  expiryDate: string;
  supplier: string;
  notes: string;
  location: string;
};

export type MovementType = 'sale' | 'waste' | 'return' | 'adjust' | 'recall';

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  sale: 'بيع',
  waste: 'إتلاف',
  return: 'إرجاع للمورد',
  adjust: 'تسوية جرد',
  recall: 'سحب',
};

export interface StockMovement {
  id: number;
  batchId: number;
  productId: number;
  type: MovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
}

export const CATEGORIES = [
  'أجبان وألبان',
  'مشروبات غازية',
  'عصائر',
  'مياه ومشروبات',
  'بسكويت وكيك',
  'حلويات وشوكولاتة',
  'آيس كريم',
  'مجمدات',
  'معلبات',
  'لحوم ودواجن',
  'مخبوزات',
  'زيوت وسمن',
  'أرز وحبوب',
  'قهوة وشاي',
  'مكسرات وتسالي',
  'بهارات وصلصات',
  'منظفات',
  'أدوية',
  'مستلزمات طبية',
  'مكمّلات غذائية',
  'منتجات عناية',
  'أخرى',
] as const;
