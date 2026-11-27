import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ReportCard } from '../components/ReportCard';
import { useTheme } from '../theme/ThemeContext';
import { spacing, typography } from '../theme/tokens';
import { useUIStore } from '../store/uiStore';
import { buildExpiryReport, formatReportForWhatsapp, type ExpiryReport } from '../services/reportService';
import {
  captureReport,
  makeReportPdf,
  shareReportFile,
  shareReportText,
  type ExportFormat,
  type ExportTarget,
} from '../services/exportService';
import { getShopName } from '../services/appPrefs';
import { getWhatsappNumber, openWhatsappWithText } from '../services/whatsappService';
import { todayISO } from '../utils/dates';

const FORMATS: { key: ExportFormat; label: string }[] = [
  { key: 'image', label: 'صورة' },
  { key: 'pdf', label: 'PDF' },
  { key: 'text', label: 'رسالة' },
];

export function ReportExportScreen() {
  const { theme } = useTheme();
  const show = useUIStore((s) => s.show);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 420);
  const cardRef = useRef<View>(null);

  const [report, setReport] = useState<ExpiryReport>(() => buildExpiryReport());
  const [shop, setShop] = useState(() => getShopName());
  const [owner, setOwner] = useState(() => getWhatsappNumber());
  const [format, setFormat] = useState<ExportFormat>('image');
  const [target, setTarget] = useState<ExportTarget>('owner');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setReport(buildExpiryReport());
      setShop(getShopName());
      setOwner(getWhatsappNumber());
    }, []),
  );

  const send = async () => {
    if (target === 'owner' && !owner) {
      show('أضف رقم صاحب المحل من الإعدادات أولاً', 'error');
      return;
    }
    setBusy(true);
    try {
      if (format === 'text') {
        const text = formatReportForWhatsapp(report);
        if (target === 'owner') {
          const ok = await openWhatsappWithText(text);
          if (!ok) show('تعذّر فتح واتساب', 'error');
        } else {
          await shareReportText(text);
        }
      } else {
        const base64 = format === 'pdf' ? await makeReportPdf(cardRef) : await captureReport(cardRef, 'png');
        const result = await shareReportFile(format, base64, { toOwner: target === 'owner', ownerNumber: owner, shopName: shop });
        if (!result.ok && result.message && result.message !== 'تم الإلغاء') show(result.message, 'error');
      }
    } catch {
      show('تعذّر إنشاء التقرير. حاول مجدداً.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen back title="تصدير التقرير" subtitle="صورة أنيقة أو PDF أو رسالة">
      <Card>
        <Text style={[typography.body, { color: theme.colors.text, marginBottom: spacing.sm }]}>الصيغة</Text>
        <View style={styles.chips}>
          {FORMATS.map((f) => (
            <Button key={f.key} title={f.label} size="sm" variant={format === f.key ? 'primary' : 'outline'} onPress={() => setFormat(f.key)} />
          ))}
        </View>
        <Text style={[typography.body, { color: theme.colors.text, marginVertical: spacing.sm }]}>إلى</Text>
        <View style={styles.chips}>
          <Button title="صاحب المحل (واتساب)" size="sm" variant={target === 'owner' ? 'primary' : 'outline'} onPress={() => setTarget('owner')} />
          <Button title="مشاركة عامة" size="sm" variant={target === 'any' ? 'primary' : 'outline'} onPress={() => setTarget('any')} />
        </View>
        {target === 'owner' && !owner ? (
          <Text style={[typography.caption, { color: theme.colors.warning, marginTop: spacing.sm }]}>رقم صاحب المحل غير مضبوط. أضفه من الإعدادات.</Text>
        ) : null}
        {!shop ? (
          <Text style={[typography.caption, { color: theme.colors.textMuted, marginTop: spacing.xs }]}>اسم المحل غير مضبوط، سيظهر "رقيب". غيّره من الإعدادات.</Text>
        ) : null}
        <Button
          title={target === 'owner' ? 'إرسال لصاحب المحل' : 'مشاركة'}
          size="lg"
          onPress={send}
          loading={busy}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Text style={[typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>معاينة التقرير</Text>
      <ReportCard ref={cardRef} report={report} shopName={shop} dateText={todayISO()} width={cardWidth} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
