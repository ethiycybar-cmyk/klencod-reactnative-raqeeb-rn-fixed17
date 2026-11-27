import { checkRow, emptyRow, isBlankRow, parseFlexibleDate, resolveValidity } from '../src/domain/migration';

const now = new Date(2026, 10, 27); // 27 نوفمبر 2026

describe('قراءة التواريخ', () => {
  it('تقبل الصيغ الشائعة والأرقام العربية', () => {
    expect(parseFlexibleDate('2027-03-15')).toBe('2027-03-15');
    expect(parseFlexibleDate('15/3/2027')).toBe('2027-03-15');
    expect(parseFlexibleDate('15-03-27')).toBe('2027-03-15');
    expect(parseFlexibleDate('١٥/٠٣/٢٠٢٧')).toBe('2027-03-15');
  });

  it('شهر/سنة: آخر يوم للانتهاء وأول يوم للإنتاج', () => {
    expect(parseFlexibleDate('03/2027', 'last')).toBe('2027-03-31');
    expect(parseFlexibleDate('02/2028', 'last')).toBe('2028-02-29');
    expect(parseFlexibleDate('3/2027', 'first')).toBe('2027-03-01');
  });

  it('ترفض غير الصالح', () => {
    expect(parseFlexibleDate('31/02/2027')).toBeNull();
    expect(parseFlexibleDate('13/2027')).toBeNull();
    expect(parseFlexibleDate('abc')).toBeNull();
    expect(parseFlexibleDate('  ')).toBeNull();
  });
});

describe('تحديد الصلاحية', () => {
  it('صالح حتى تاريخ: الأيام تُحسب من اليوم', () => {
    expect(resolveValidity({ mode: 'expiry', expiryText: '2027-01-26', productionText: '', monthsText: '' }, now)).toEqual({
      ok: true, expiryDate: '2027-01-26', productionDate: null, daysLeft: 60,
    });
  });

  it('تاريخ الإنتاج + 9 أشهر', () => {
    expect(resolveValidity({ mode: 'production', expiryText: '', productionText: '2026-09-01', monthsText: '9' }, now)).toEqual({
      ok: true, expiryDate: '2027-06-01', productionDate: '2026-09-01', daysLeft: 186,
    });
  });

  it('يضبط آخر الشهر ويقبل رقماً عربياً', () => {
    const r = resolveValidity({ mode: 'production', expiryText: '', productionText: '2026-08-31', monthsText: '٦' }, now);
    expect(r).toMatchObject({ ok: true, expiryDate: '2027-02-28' });
  });

  it('يرفض مدة غير صحيحة', () => {
    for (const monthsText of ['0', '2.5', '', 'x', '999']) {
      expect(resolveValidity({ mode: 'production', expiryText: '', productionText: '2026-09-01', monthsText }, now).ok).toBe(false);
    }
  });

  it('المنتهي يعطي أياماً سالبة', () => {
    const r = resolveValidity({ mode: 'expiry', expiryText: '2026-11-01', productionText: '', monthsText: '' }, now);
    expect(r).toMatchObject({ ok: true, daysLeft: -26 });
  });
});

describe('فحص صف الترحيل', () => {
  const base = { ...emptyRow('a'), name: 'جبنة شيدر', barcode: '٦٢٨١٠٠١٢٣٤٥٦٧', quantity: '٥', mode: 'production' as const, productionText: '1/9/2026', monthsText: '9' };

  it('يحوّل الصف الصالح إلى عنصر ترحيل', () => {
    const c = checkRow(base, now);
    expect(c.ok).toBe(true);
    if (c.ok) {
      expect(c.item).toMatchObject({ barcode: '6281001234567', quantity: 5, expiryDate: '2027-06-01', productionDate: '2026-09-01' });
    }
  });

  it('يرفض الاسم الفارغ والكمية الصفرية', () => {
    expect(checkRow({ ...base, name: ' ' }, now).ok).toBe(false);
    expect(checkRow({ ...base, quantity: '0' }, now).ok).toBe(false);
  });

  it('الصف الفارغ يُتجاهل', () => {
    expect(isBlankRow(emptyRow('x'))).toBe(true);
    expect(isBlankRow({ ...emptyRow('x'), name: 'س' })).toBe(false);
  });
});
