import React, { useCallback, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { Screen } from '../components/ui/Screen';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { SearchBar } from '../components/ui/SearchBar';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BatchRow } from '../components/BatchRow';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { useResponsive } from '../hooks/useResponsive';
import { useUIStore } from '../store/uiStore';
import { fetchProductReport, type ProductReport } from '../services/geminiService';
import { getGeminiKey } from '../services/appPrefs';
import { openWhatsappWithText } from '../services/whatsappService';
import { DEVELOPER_CREDIT } from '../config/credit';

export function ProductInfoScreen({ route }: { route: { params?: { query?: string } } }) {
  const { theme } = useTheme();
  const show = useUIStore((s) => s.show);
  const [query, setQuery] = useState(route.params?.query ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProductReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasKey = Boolean(getGeminiKey());

  const run = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await fetchProductReport(query.trim()));
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg === 'NO_KEY' ? 'أضف مفتاح Gemini من الإعدادات أولاً.' : msg || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const googleIt = () => Linking.openURL(`https://www.google.com/search?q=${encodeURIComponent(query.trim())}`).catch(() => show('تعذّر فتح المتصفح', 'error'));

  const share = async () => {
    if (!result) return;
    const ok = await openWhatsappWithText(`*${query.trim()}*\n\n${result.text}\n\n— ${DEVELOPER_CREDIT}`, '');
    if (!ok) show('تعذّر فتح واتساب', 'error');
  };

  return (
    <Screen back title="معلومات المنتج" subtitle="تقرير موجز مدعوم بـ Gemini">
      <Card>
        <Input label="اسم المنتج أو الباركود" value={query} onChangeText={setQuery} placeholder="مثال: جبنة شيدر 200 جم" multiline />
        {!hasKey ? (
          <Text style={[typography.caption, { color: theme.colors.warning }]}>لم تُضبط مفتاح Gemini بعد. أضفه من الإعدادات (مجاني من Google AI Studio).</Text>
        ) : null}
        <Button title="إنشاء التقرير" size="lg" onPress={run} loading={loading} disabled={!query.trim()} style={{ marginTop: spacing.sm }} />
        <Button title="بحث في جوجل" variant="outline" onPress={googleIt} disabled={!query.trim()} style={{ marginTop: spacing.sm }} />
      </Card>

      {error ? (
        <Card><Text style={[typography.body, { color: theme.colors.critical }]}>{error}</Text></Card>
      ) : null}

      {result ? (
        <Card>
          <Text selectable style={[typography.body, { color: theme.colors.text, lineHeight: 24 }]}>{result.text}</Text>
          <Text style={[typography.caption, { color: theme.colors.textMuted, marginTop: spacing.md }]}>
            {result.grounded ? `المصادر: ${result.sources.join('، ')}` : 'بدون بحث مباشر في الويب — قد تحتاج المعلومات إلى مراجعة.'}
          </Text>
          <Button title="إرسال عبر واتساب" variant="secondary" onPress={share} style={{ marginTop: spacing.md }} />
        </Card>
      ) : null}
    </Screen>
  );
}
