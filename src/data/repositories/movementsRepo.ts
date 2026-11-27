import { getDB } from '../db/client';
import { logAudit } from './auditRepo';
import { enqueue } from './syncRepo';
import { MOVEMENT_LABELS, type MovementType, type StockMovement } from '../../types/models';

/** يسجّل حركة مخزون ويحدّث كمية التشغيلة. الإتلاف/البيع/الإرجاع/السحب تخصم، والتسوية تضبط الكمية. */
export function recordMovement(batchId: number, type: MovementType, quantity: number, reason = ''): { ok: boolean; message?: string } {
  const db = getDB();
  const rows = db.executeSync('SELECT product_id, quantity FROM batches WHERE id = ? AND deleted_at IS NULL', [batchId]).rows;
  if (!rows.length) return { ok: false, message: 'التشغيلة غير موجودة' };
  const productId = Number(rows[0].product_id);
  const current = Number(rows[0].quantity);
  const qty = Math.floor(Number(quantity));
  if (!Number.isFinite(qty) || qty < 0) return { ok: false, message: 'كمية غير صالحة' };

  let next: number;
  let moved: number;
  if (type === 'adjust') {
    next = qty;
    moved = qty - current;
  } else {
    if (qty <= 0) return { ok: false, message: 'أدخل كمية أكبر من صفر' };
    if (qty > current) return { ok: false, message: `الكمية المتاحة ${current} فقط` };
    next = current - qty;
    moved = -qty;
  }
  const now = new Date().toISOString();
  db.executeSync('UPDATE batches SET quantity = ?, updated_at = ?, dirty = 1 WHERE id = ?', [next, now, batchId]);
  db.executeSync(
    'INSERT INTO stock_movements (batch_id, product_id, type, quantity, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [batchId, productId, type, moved, reason.trim() || null, now],
  );
  enqueue('batches', batchId, 'update', { id: batchId, productId });
  logAudit('movement', 'batch', batchId, `${MOVEMENT_LABELS[type]}: ${moved > 0 ? '+' : ''}${moved}${reason ? ' — ' + reason : ''}`);
  return { ok: true };
}

export function listMovementsForBatch(batchId: number, limit = 20): StockMovement[] {
  const rows = getDB().executeSync('SELECT * FROM stock_movements WHERE batch_id = ? ORDER BY id DESC LIMIT ?', [batchId, limit]).rows;
  return rows.map(toMovement);
}

/** مجاميع الحركات (بالقيمة المطلقة) منذ تاريخ ISO معيّن، لكل نوع. */
export function movementTotalsSince(sinceISO: string): Record<MovementType, number> {
  const totals: Record<MovementType, number> = { sale: 0, waste: 0, return: 0, adjust: 0, recall: 0 };
  const rows = getDB().executeSync(
    'SELECT type, SUM(ABS(quantity)) AS q FROM stock_movements WHERE created_at >= ? GROUP BY type',
    [sinceISO],
  ).rows;
  for (const r of rows) {
    const t = String(r.type) as MovementType;
    if (t in totals) totals[t] = Number(r.q ?? 0);
  }
  return totals;
}

const toMovement = (r: Record<string, unknown>): StockMovement => ({
  id: Number(r.id),
  batchId: Number(r.batch_id),
  productId: Number(r.product_id),
  type: String(r.type) as MovementType,
  quantity: Number(r.quantity),
  reason: r.reason == null ? null : String(r.reason),
  createdAt: String(r.created_at),
});
