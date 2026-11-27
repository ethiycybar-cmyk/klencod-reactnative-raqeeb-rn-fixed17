import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../../theme/ThemeContext';
import { useAuthStore } from '../../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainTabs } from './MainTabs';
import { ProductDetailScreen } from '../../screens/ProductDetailScreen';
import { ProductFormScreen } from '../../screens/ProductFormScreen';
import { BatchFormScreen } from '../../screens/BatchFormScreen';
import { AboutScreen } from '../../screens/AboutScreen';
import { SyncCenterScreen } from '../../screens/SyncCenterScreen';
import { PriorityScreen } from '../../screens/PriorityScreen';
import { CalendarScreen } from '../../screens/CalendarScreen';
import { InsightsScreen } from '../../screens/InsightsScreen';
import { StocktakeScreen } from '../../screens/StocktakeScreen';
import { RecallScreen } from '../../screens/RecallScreen';
import { ProductInfoScreen } from '../../screens/ProductInfoScreen';
import { AuditScreen } from '../../screens/AuditScreen';
import { ThresholdsScreen } from '../../screens/ThresholdsScreen';
import { ReportExportScreen } from '../../screens/ReportExportScreen';
import { MigrateScreen } from '../../screens/MigrateScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { theme } = useTheme();
  const phase = useAuthStore((s) => s.phase);
  const ready = phase === 'ready';

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade_from_bottom',
        animationDuration: 220,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {ready ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
          <Stack.Screen name="ProductForm" component={ProductFormScreen} />
          <Stack.Screen name="BatchForm" component={BatchFormScreen} />
          <Stack.Screen name="About" component={AboutScreen} />
          <Stack.Screen name="SyncCenter" component={SyncCenterScreen} />
          <Stack.Screen name="Priority" component={PriorityScreen} />
          <Stack.Screen name="Calendar" component={CalendarScreen} />
          <Stack.Screen name="Insights" component={InsightsScreen} />
          <Stack.Screen name="Stocktake" component={StocktakeScreen} />
          <Stack.Screen name="Recall" component={RecallScreen} />
          <Stack.Screen name="ProductInfo" component={ProductInfoScreen} />
          <Stack.Screen name="Audit" component={AuditScreen} />
          <Stack.Screen name="Thresholds" component={ThresholdsScreen} />
          <Stack.Screen name="ReportExport" component={ReportExportScreen} />
          <Stack.Screen name="Migrate" component={MigrateScreen} />
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
}
