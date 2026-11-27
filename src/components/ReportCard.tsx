import React, { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEVELOPER_CREDIT } from '../config/credit';
import type { ExpiryReport, ReportItem } from '../services/reportService';

/** ألوان ثابتة (لا تتبع الوضع الداكن) كي تخرج الصورة/الـPDF بنفس الشكل الأنيق دائماً. */
const C = {
  ink: '#0F1F24',
  muted: '#6B7B7F',
  paper: '#FBF9F4',
  teal: '#0B3D47',
  gold: '#C9A24B',
  line: '#E7E0CF',
  expired: '#7F1D1D',
  critical: '#EF4444',
  warning: '#F59E0B',
  good: '#10B981',
};

type Props = { report: ExpiryReport; shopName: string; dateText: string; width: number };

function Section({ title, color, items, max, daysText }: { title: string; color: string; items: ReportItem[]; max: number; daysText: (d: number) => string }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color: C.ink }]}>{title}</Text>
        <Text style={[styles.sectionCount, { color }]}>{items.length}</Text>
      </View>
      {items.slice(0, max).map((item, i) => (
        <View key={`${item.name}-${item.batchNumber}-${i}`} style={[styles.row, { borderColor: C.line }]}>
          <View style={styles.rowMain}>
            <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.rowSub}>تشغيلة {item.batchNumber} · الكمية {item.quantity}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: color + '1F' }]}>
            <Text style={[styles.chipText, { color }]}>{daysText(item.daysLeft)}</Text>
          </View>
        </View>
      ))}
      {items.length > max ? <Text style={styles.more}>و{items.length - max} أخرى…</Text> : null}
    </View>
  );
}

export const ReportCard = forwardRef<View, Props>(function ReportCard({ report, shopName, dateText, width }, ref) {
  const total = report.total;
  const health = total ? Math.round((report.excellent.length / total) * 100) : 0;
  const healthColor = health >= 60 ? C.good : health >= 30 ? C.warning : C.critical;

  const tiles = [
    { label: 'منتهية', value: report.expired.length, color: C.expired },
    { label: 'حرجة', value: report.critical.length, color: C.critical },
    { label: 'جيدة', value: report.good.length, color: C.warning },
    { label: 'ممتازة', value: report.excellent.length, color: C.good },
  ];

  return (
    <View ref={ref} collapsable={false} style={[styles.card, { width }]}>
      <View style={styles.header}>
        <View style={styles.goldBar} />
        <Text style={styles.shop} numberOfLines={2}>{shopName || 'رقيب'}</Text>
        <Text style={styles.title}>تقرير حالة المنتجات</Text>
        <Text style={styles.date}>{dateText}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.health}>
          <View style={{ flex: 1 }}>
            <Text style={styles.healthLabel}>صحة المخزون</Text>
            <Text style={styles.healthSub}>من {total} تشغيلة فعّالة</Text>
          </View>
          <Text style={[styles.healthValue, { color: healthColor }]}>{health}%</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${health}%`, backgroundColor: healthColor }]} />
        </View>

        <View style={styles.tiles}>
          {tiles.map((t) => (
            <View key={t.label} style={[styles.tile, { borderTopColor: t.color }]}>
              <Text style={[styles.tileValue, { color: t.color }]}>{t.value}</Text>
              <Text style={styles.tileLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        <Section title="منتهية الصلاحية" color={C.expired} items={report.expired} max={8} daysText={(d) => `منذ ${Math.abs(d)} يوم`} />
        <Section title="حرجة" color={C.critical} items={report.critical} max={8} daysText={(d) => `${d} يوم`} />
        <Section title="جيدة" color={C.warning} items={report.good} max={6} daysText={(d) => `${d} يوم`} />
        {total === 0 ? <Text style={styles.empty}>لا توجد تشغيلات فعّالة حالياً.</Text> : null}

        <View style={[styles.footer, { borderTopColor: C.line }]}>
          <Text style={styles.footerText}>أُنشئ بواسطة تطبيق رقيب</Text>
          <Text style={styles.credit}>{DEVELOPER_CREDIT}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: C.paper, borderRadius: 22, overflow: 'hidden', alignSelf: 'center' },
  header: { backgroundColor: C.teal, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24 },
  goldBar: { width: 44, height: 4, borderRadius: 2, backgroundColor: C.gold, marginBottom: 14 },
  shop: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', lineHeight: 34 },
  title: { color: '#E8D9A8', fontSize: 15, fontWeight: '600', marginTop: 4 },
  date: { color: '#FFFFFFB3', fontSize: 12, marginTop: 6, writingDirection: 'ltr', textAlign: 'right' },
  body: { padding: 18, gap: 14 },
  health: { flexDirection: 'row', alignItems: 'center' },
  healthLabel: { color: C.ink, fontSize: 16, fontWeight: '700' },
  healthSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  healthValue: { fontSize: 38, fontWeight: '800' },
  track: { height: 10, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  tile: { width: '48.5%', backgroundColor: '#FFFFFF', borderRadius: 14, borderTopWidth: 4, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.line },
  tileValue: { fontSize: 28, fontWeight: '800' },
  tileLabel: { color: C.muted, fontSize: 13, marginTop: 2 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { flex: 1, fontSize: 16, fontWeight: '700' },
  sectionCount: { fontSize: 16, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderRadius: 12, padding: 10 },
  rowMain: { flex: 1 },
  rowName: { color: C.ink, fontSize: 14, fontWeight: '700' },
  rowSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '700' },
  more: { color: C.muted, fontSize: 12, textAlign: 'center' },
  empty: { color: C.muted, textAlign: 'center', fontSize: 14, paddingVertical: 16 },
  footer: { borderTopWidth: 1, paddingTop: 12, alignItems: 'center', gap: 2 },
  footerText: { color: C.muted, fontSize: 11 },
  credit: { color: C.gold, fontSize: 10, letterSpacing: 0.4, writingDirection: 'ltr' },
});
