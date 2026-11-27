import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { AlertTriangle, Boxes, CalendarClock, MessageCircle, Package, PackagePlus, Plus, RefreshCw, ShieldAlert } from 'lucide-react-native';
import { Screen } from '../components/ui/Screen';
import { StatCard } from '../components/ui/StatCard';
import { EmptyState } from '../components/ui/EmptyState';
import { BatchRow } from '../components/BatchRow';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';
import { attentionBatches, dashboardStats } from '../data/repositories/batchesRepo';
import type { BatchWithProduct, DashboardStats } from '../types/models';
import type { TabScreenProps } from '../app/navigation/types';
import { licenseValidity, trialDaysLeft } from '../services/licenseService';
import { formatNumber } from '../utils/format';
import { buildExpiryReport, formatReportForWhatsapp } from '../services/reportService';
import { openWhatsappWithText } from '../services/whatsappService';
import { useUIStore } from '../store/uiStore';
import { useResponsive } from '../hooks/useResponsive';
import { FadeIn } from '../components/ui/FadeIn';

const EMPTY_STATS: DashboardStats = {
  totalProducts: 0, totalBatches: 0, lowStock: 0, expiringSoon: 0, expiredCount: 0, criticalCount: 0,
};

export function DashboardScreen({ navigation }: TabScreenProps<'Dashboard'>) {
  const { theme } = useTheme();
  const { columns } = useResponsive();
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [items, setItems] = useState<BatchWithProduct[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const show = useUIStore((s) => s.show);

  const sendReport = async () => {
    const ok = await openWhatsappWithText(formatReportForWhatsapp(buildExpiryReport()));
    if (!ok) show('تعذّر فتح واتساب. تأكد أنه مثبّت.', 'error');
  };

  const load = useCallback(() => {
    setStats(dashboardStats());
    setItems(attentionBatches(10));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = () => {
    setRefreshing(true);
    load();
    setTimeout(() => setRefreshing(false), 350);
  };

  const trial = trialDaysLeft();
  const licenseState = licenseValidity();
  const licenseText =
    licenseState === 'active' ? 'الترخيص: مفعّل' : `الترخيص: فترة تجربة — ${trial} يوم متبقٍ`;

  return (
    <Screen
      title="لوحة التحكم"
      subtitle={`رقيب · ${formatNumber(stats.totalProducts)} منتجاً مسجلاً`}
      scroll={false}
      actions={
        <Pressable onPress={onRefresh} hitSlop={10}>
          <RefreshCw size={20} color={theme.colors.onHeader} />
        </Pressable>
      }
    >
      <FlashList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={{ flex: 1, padding: spacing.xs }}>
            <BatchRow item={item} onPress={() => navigation.navigate({ name: 'ProductDetail', params: { id: item.productId } })} />
          </View>
        )}
        style={styles.list}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        ListHeaderComponent={
          <FadeIn style={styles.headerBlock}>
            <View style={[styles.trial, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
              <ShieldAlert size={18} color={theme.colors.primary} />
              <Text style={[typography.body, { color: theme.colors.text }]}>{licenseText}</Text>
            </View>

            <View style={styles.stats}>
              <StatCard label="المنتجات" value={stats.totalProducts} tone="primary" icon={<Package size={18} color={theme.colors.primary} />} />
              <StatCard label="التشغيلات" value={stats.totalBatches} tone="good" icon={<Boxes size={18} color={theme.colors.good} />} />
              <StatCard label="مخزون منخفض" value={stats.lowStock} tone="warning" icon={<AlertTriangle size={18} color={theme.colors.warning} />} />
              <StatCard label="تحتاج انتباهاً" value={stats.criticalCount} tone="critical" icon={<CalendarClock size={18} color={theme.colors.critical} />} />
            </View>

            <View style={styles.quickRow}>
              <Pressable
                onPress={() => navigation.navigate({ name: 'ProductForm', params: {} })}
                style={({ pressed }) => [styles.quick, { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <PackagePlus size={20} color="#FFFFFF" />
                <Text style={[styles.quickText, { color: '#FFFFFF' }]}>منتج جديد</Text>
              </Pressable>
              <Pressable
                onPress={() => navigation.navigate({ name: 'BatchForm', params: {} })}
                style={({ pressed }) => [styles.quick, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 }]}
              >
                <Plus size={20} color={theme.colors.primary} />
                <Text style={[styles.quickText, { color: theme.colors.primary }]}>تشغيلة جديدة</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => navigation.navigate({ name: 'ReportExport', params: undefined })}
              style={({ pressed }) => [styles.quick, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, opacity: pressed ? 0.85 : 1 }]}
            >
              <MessageCircle size={20} color={theme.colors.primary} />
              <Text style={[styles.quickText, { color: theme.colors.primary }]}>تصدير ومشاركة التقرير</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, typography.h3, { color: theme.colors.text }]}>تنبيهات الصلاحية</Text>
            {items.length === 0 ? (
              <EmptyState title="لا توجد تنبيهات" message="كل التشغيلات ضمن نطاق الصلاحية الآمن." />
            ) : null}
          </FadeIn>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1 },
  headerBlock: { gap: spacing.md, marginBottom: spacing.md },
  trial: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderRadius: radius.md, padding: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quick: { flex: 1, minHeight: 48, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  quickText: { fontWeight: '700', fontSize: 14 },
  sectionTitle: { marginTop: spacing.sm },
});
