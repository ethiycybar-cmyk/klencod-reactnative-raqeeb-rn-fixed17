import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { radius, spacing, typography } from '../../theme/tokens';
import { useResponsive } from '../../hooks/useResponsive';
import { DeveloperCredit } from '../DeveloperCredit';

type Props = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
  back?: boolean;
};

export function Screen({ title, subtitle, actions, children, scroll = true, back = false }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { maxWidth } = useResponsive();
  const c = theme.colors;

  return (
    <View style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: c.header }]}>
        <View style={[styles.headerInner, { maxWidth }]}>
          {back ? (
            <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back} accessibilityLabel="رجوع">
              <Text style={styles.backText}>›</Text>
            </Pressable>
          ) : null}
          <View style={styles.headerText}>
            <Text style={[styles.title, typography.h3, { color: c.onHeader }]} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, typography.caption, { color: c.onHeader + 'CC' }]} numberOfLines={1}>{subtitle}</Text> : null}
            <View style={[styles.accent, { backgroundColor: c.accent }]} />
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </View>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxxl, alignItems: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.content, { maxWidth }]}>{children}</View>
          <DeveloperCredit />
        </ScrollView>
      ) : (
        <View style={[styles.fixed, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={[styles.fixedInner, { maxWidth }]}>
            {children}
            <DeveloperCredit />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  headerInner: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF1F', alignItems: 'center', justifyContent: 'center', marginEnd: spacing.md },
  backText: { color: '#FFFFFF', fontSize: 28, lineHeight: 30, fontWeight: '600' },
  headerText: { flex: 1 },
  title: { fontWeight: '700' },
  subtitle: { marginTop: 2 },
  accent: { width: 34, height: 3, borderRadius: 2, marginTop: 8 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginStart: spacing.md, alignItems: 'center' },
  scroll: { flex: 1 },
  content: { width: '100%', gap: spacing.md },
  fixed: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, alignItems: 'center' },
  fixedInner: { flex: 1, width: '100%' },
});
