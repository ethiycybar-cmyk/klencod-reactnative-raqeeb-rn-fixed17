import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { Button } from './ui/Button';
import { buildExpiryReport, formatReportForWhatsapp, type ExpiryReport, type ReportItem } from '../services/reportService';
import { openWhatsappWithText } from '../services/whatsappService';

const MAX_LISTED = 5;

function Section({ title, color, items, daysText }: { title: string; color: string; items: ReportItem[]; daysText: (d: number) => string }) {
  const { theme } = useTheme();
  if (items.length === 0) return null;
  return (
    <View style={[styles.section, { borderColor: color + '55', backgroundColor: color + '14' }]}>
      <View style={styles.sectionHead}>
        <Text style={[typography.bodyLg, styles.bold, { color }]}>{title}</Text>
        <Text style={[typography.bodyLg, styles.bold, { color }]}>{items.length}</Text>
      </View>
      {items.slice(0, MAX_LISTED).map((item, index) => (
        <Text key={`${item.name}-${item.batchNumber}-${index}`} style={[typography.caption, { color: theme.colors.text }]}>
          • {item.name} ({item.batchNumber}) — {daysText(item.daysLeft)}
        </Text>
      ))}
      {items.length > MAX_LISTED ? (
        <Text style={[typography.caption, { color: theme.colors.textMuted }]}>و{items.length - MAX_LISTED} أخرى…</Text>
      ) : null}
    </View>
  );
}

/** نافذة وسط الشاشة تمنع استخدام التطبيق حتى يضغط المستخدم «موافق». */
export function ExpiryReportModal() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const [report] = useState<ExpiryReport>(() => buildExpiryReport());
  const [visible, setVisible] = useState(report.total > 0);
  const [waError, setWaError] = useState(false);
  const c = theme.colors;

  const sendWhatsapp = async () => {
    setWaError(false);
    const ok = await openWhatsappWithText(formatReportForWhatsapp(report));
    if (ok) setVisible(false);
    else setWaError(true);
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.overlay, { backgroundColor: c.overlay }]}>
        <View style={[styles.dialog, { backgroundColor: c.surface }]}>
          <Text style={[typography.h3, styles.title, { color: c.text }]}>تقرير حالة المنتجات</Text>
          <Text style={[typography.caption, styles.subtitle, { color: c.textMuted }]}>
            إجمالي التشغيلات الفعّالة: {report.total}
          </Text>
          <ScrollView style={styles.body} contentContainerStyle={{ gap: spacing.sm }}>
            <Section title="منتهية الصلاحية" color={c.expired} items={report.expired} daysText={(d) => `منذ ${Math.abs(d)} يوم`} />
            <Section title="حرجة" color={c.critical} items={report.critical} daysText={(d) => `${d} يوم`} />
            <Section title="جيدة" color={c.warning} items={report.good} daysText={(d) => `${d} يوم`} />
            <Section title="ممتازة" color={c.good} items={report.excellent} daysText={(d) => `${d} يوم`} />
          </ScrollView>
          {waError ? (
            <Text style={[typography.caption, styles.errorText, { color: c.critical }]}>تعذّر فتح واتساب. تأكد أنه مثبّت على الجهاز.</Text>
          ) : null}
          <View style={styles.actions}>
            <Button title="موافق" size="lg" onPress={() => setVisible(false)} />
            <Button title="إرسال عبر واتساب" size="lg" variant="secondary" onPress={sendWhatsapp} />
            <Button title="تصدير صورة / PDF" size="lg" variant="outline" onPress={() => { setVisible(false); navigation.navigate('ReportExport'); }} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '88%', borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm },
  title: { textAlign: 'center', fontWeight: '700' },
  subtitle: { textAlign: 'center', marginBottom: spacing.xs },
  body: { flexGrow: 0 },
  section: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bold: { fontWeight: '700' },
  actions: { gap: spacing.sm },
  errorText: { textAlign: 'center' },
});
