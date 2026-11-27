import React, { useEffect, useState } from 'react';
import { AppState, I18nManager, StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../theme/ThemeContext';
import { RootNavigator } from './navigation/RootNavigator';
import { SplashScreen } from '../screens/SplashScreen';
import { ToastHost } from '../components/ui/ToastHost';
import { bootstrap } from './bootstrap';
import { useAuthStore } from '../store/authStore';
import { logout } from '../services/authService';

/** يُقفل التطبيق تلقائياً إن بقي في الخلفية أكثر من هذه المدة. */
const AUTO_LOCK_MS = 2 * 60 * 1000;

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

export default function App() {
  const [booted, setBooted] = useState(false);
  const phase = useAuthStore((s) => s.phase);
  const setPhase = useAuthStore((s) => s.setPhase);

  useEffect(() => {
    let active = true;
    bootstrap()
      .then((next) => { if (active) setPhase(next); })
      .catch(() => { if (active) setPhase('install'); })
      .finally(() => { if (active) setBooted(true); });
    return () => { active = false; };
  }, [setPhase]);

  useEffect(() => {
    if (phase !== 'ready') return undefined;
    let hiddenAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (hiddenAt !== null && Date.now() - hiddenAt > AUTO_LOCK_MS) {
          logout();
          setPhase('pattern-login');
        }
        hiddenAt = null;
      } else if (hiddenAt === null) {
        hiddenAt = Date.now();
      }
    });
    return () => subscription.remove();
  }, [phase, setPhase]);

  if (!booted || !phase) {
    return (
      <ThemeProvider>
        <SplashScreen />
      </ThemeProvider>
    );
  }

  const authGroup = phase === 'ready' ? 'main' : 'auth';

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <StatusBar barStyle="light-content" />
          <NavigationContainer key={authGroup}>
            <RootNavigator />
          </NavigationContainer>
          <ToastHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
