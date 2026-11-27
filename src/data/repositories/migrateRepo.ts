import { getDB } from '../db/client';
import { createProduct } from './productsRepo';
import { createBatch } from './batchesRepo';
import { logAudit } from './auditRepo';
import { todayISO } from '../../utils/dates';

export type MigrationItem = {
  key: string;
  name: string;
  barcode: string;
  category: string;
  quantity: number;
  batchNumber: string;
  productionDate: string | null;
  expiryDate: string;
};

export type MigrationResult = {
  done: string[];
  failed: { key: string; error: string }[];
  createdProducts: number;
  addedToExisting: number;
};

function findProductId(item: MigrationItem): number | null {
  const db = getDB();
  if (item.barcode) {
    const byBarcode = db.executeSync('SELECT id FROM products WHERE barcode = ? AND deleted_at IS NULL', [item.barcode]).rows;
    if (byBarcode.length) return Number(byBarcode[0].id);
  }
  const byName = db.executeSync('SELECT id FROM products WHERE deleted_at IS NULL AND name = ? COLLATE NOCASE', [item.name]).rows;
  return byName.length ? Number(byName[0].id) : null;
}

/**
 * يرحّل الأصناف المدخلة إلى المنتجات والتشغيلات. الصنف الموجود (بنفس الباركود أو الاسم) يُضاف له
 * تشغيلة جديدة بدل تكراره. الفاشل يُعاد مع سببه ويبقى في القائمة، والناجح يُحذف منها.
 */
export function migrateItems(items: MigrationItem[]): MigrationResult {
  const result: MigrationResult = { done: [], failed: [], createdProducts: 0, addedToExisting: 0 };
  const stamp = todayISO().replace(/-/g, '');
  items.forEach((item, index) => {
    try {
      let productId = findProductId(item);
      if (productId == null) {
        productId = createProduct({ name: item.name, barcode: item.barcode, category: item.category, minStock: '10' });
        result.createdProducts += 1;
      } else {
        result.addedToExisting += 1;
      }
      createBatch({
        productId,
        batchNumber: item.batchNumber || `T${stamp}-${index + 1}`,
        quantity: String(item.quantity),
        productionDate: item.productionDate ?? '',
        expiryDate: item.expiryDate,
        supplier: '',
        notes: 'مرحَّل من شاشة ترحيل الأصناف',
        location: '',
      });
      result.done.push(item.key);
    } catch (e) {
      result.failed.push({ key: item.key, error: e instanceof Error ? e.message : 'تعذّر ترحيل الصنف' });
    }
  });
  logAudit('migrate', 'products', null, `${result.done.length} صنف مرحَّل، ${result.failed.length} فاشل`);
  return result;
}
