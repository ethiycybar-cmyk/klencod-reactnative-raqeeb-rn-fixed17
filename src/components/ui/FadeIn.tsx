import React, { useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

/** ظهور ناعم (تلاشٍ + صعود خفيف) باستخدام Animated الأصلي بدون أي مكتبة إضافية. */
export function FadeIn({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 320, delay, useNativeDriver: true }).start();
  }, [progress, delay]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}
