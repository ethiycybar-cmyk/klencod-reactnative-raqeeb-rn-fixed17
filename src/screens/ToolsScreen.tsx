import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, Boxes, CalendarClock, LayoutDashboard, MessageCircle, PackagePlus, Search, Settings2, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { FadeIn } from '../components/ui/FadeIn';
import { useTheme } from '../theme/ThemeContext';
import { cardShadow, radius, spacing, typography } from '../theme/tokens';
import { useResponsive } from '../hooks/useResponsive';
import { isEmployeeMode } from '../services/appPrefs';
import type { TabScreenProps } from '../app/navigation/types';

const TOOLS = [
  { route: 'Migration', title: 'ترحيل الأصناف', sub: 'إدخال جماعي + مسح الباركود + نسخ احتياطي', Icon: PackagePlus, tone: 'primary' },
  { route: 'ReportExport', title: 'تصدير التقرير', sub: 'صورة أنيقة / PDF / رسالة', Icon: MessageCircle, tone: 'good' },
  { route: 'Priority', title: 'أولويات البيع', sub: 'الأقرب انتهاءً أولاً + نص عرض', Icon: AlertTriangle, tone: 'critical' },
  { route: 'Calendar', title: 'تقويم الصلاحية', sub: 'ماذا ينتهي في أي يوم', Icon: CalendarClock, tone: 'primary' },
  { route: 'Insights', title: 'التحليلات', sub: 'صحة المخزون والخسائر', Icon: LayoutDashboard, tone: 'good' },
  { route: 'Stocktake', title: 'الجرد', sub: 'مطابقة الكميات الفعلية', Icon: Boxes, tone: 'warning' },
  { route: 'Recall', title: 'سحب تشغيلة', sub: 'عند إعلان سحب منتج', Icon: ShieldAlert, tone: 'critical' },
  { route: 'ProductInfo', title: 'معلومات المنتج', sub: 'تقرير ذكي عن أي منتج', Icon: Search, tone: 'primary' },
  { route: 'Audit', title: 'سجل التدقيق', sub: 'من غيّر ماذا ومتى', Icon: ShieldCheck, tone: 'primary', manager: true },
  { route: 'Thresholds', title: 'عتبات الفئات', sub: 'حرج/ممتاز لكل فئة', Icon: Settings2, tone: 'warning', manager: true },
] as const;

export function ToolsScreen({ navigation }: TabScreenProps<'Tools'>) {
  const { theme } = useTheme();
  const { columns } = useResponsive();
  const employee = isEmployeeMode();
  const tools = TOOLS.filter((t) => !(employee && 'manager' in t && t.manager));
  const width = columns >= 3 ? '31.5%' : '48%';

  return (
    <Screen title="الأدوات" subtitle="أدوات ذكية لإدارة المخزون">
      <View style={styles.grid}>
        {tools.map((t, i) => {
          const color = theme.colors[t.tone];
          return (
            <FadeIn key={t.route} delay={i * 45} style={{ width }}>
              <Pressable
                onPress={() => navigation.navigate(t.route as never)}
                style={({ pressed }) => [styles.card, cardShadow, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
              >
                <View style={[styles.icon, { backgroundColor: color + '1F' }]}>
                  <t.Icon size={24} color={color} />
                </View>
                <Text style={[typography.bodyLg, { color: theme.colors.text, fontWeight: '700' }]}>{t.title}</Text>
                <Text style={[typography.caption, { color: theme.colors.textMuted }]}>{t.sub}</Text>
              </Pressable>
            </FadeIn>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: 6, minHeight: 132 },
  icon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
});
