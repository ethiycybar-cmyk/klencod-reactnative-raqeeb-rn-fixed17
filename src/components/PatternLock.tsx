import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { radius, spacing, typography } from '../theme/tokens';

const DOT = 62;
const GAP = 30;
const SIZE = DOT * 3 + GAP * 2;
const HIT_RADIUS = 36;

type Point = { x: number; y: number };

const positions: Point[] = Array.from({ length: 9 }, (_, i) => {
  const row = Math.floor(i / 3);
  const col = i % 3;
  return { x: col * (DOT + GAP) + DOT / 2, y: row * (DOT + GAP) + DOT / 2 };
});

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function PatternLock({
  onComplete,
  label = 'ارسم نمط القفل',
  error,
  disabled = false,
}: {
  onComplete: (points: number[]) => void;
  label?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState<number[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const selectedRef = useRef<number[]>([]);
  const startRef = useRef<Point>({ x: 0, y: 0 });

  // نحتفظ بآخر قيم للخصائص داخل refs حتى لا نعيد إنشاء PanResponder أثناء اللمس
  // (إعادة الإنشاء في منتصف الإيماءة كانت تقطع الرسم).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const reset = () => {
    selectedRef.current = [];
    setSelected([]);
    setCursor(null);
  };

  const addAt = (x: number, y: number) => {
    const idx = positions.findIndex((p) => distance(p, { x, y }) < HIT_RADIUS);
    if (idx >= 0 && !selectedRef.current.includes(idx)) {
      selectedRef.current = [...selectedRef.current, idx];
      setSelected(selectedRef.current);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        reset();
        // الأبناء بـ pointerEvents="none" لذا locationX نسبةً إلى لوحة النقاط نفسها.
        const start = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
        startRef.current = start;
        addAt(start.x, start.y);
        setCursor(start);
      },
      onPanResponderMove: (_event, gesture) => {
        const x = startRef.current.x + gesture.dx;
        const y = startRef.current.y + gesture.dy;
        addAt(x, y);
        setCursor({ x, y });
      },
      onPanResponderRelease: () => {
        const result = [...selectedRef.current];
        setCursor(null);
        if (result.length > 0) onCompleteRef.current(result);
        setTimeout(reset, 220);
      },
      onPanResponderTerminate: () => reset(),
    }),
  ).current;

  const lines = useMemo(() => {
    const result: { x: number; y: number; length: number; angle: number }[] = [];
    for (let i = 1; i < selected.length; i += 1) {
      const a = positions[selected[i - 1]];
      const b = positions[selected[i]];
      result.push({
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        length: distance(a, b),
        angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      });
    }
    return result;
  }, [selected]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, typography.bodyLg, { color: theme.colors.text }]}>{label}</Text>
      <View style={[styles.board, { width: SIZE, height: SIZE }]} {...pan.panHandlers}>
        {lines.map((line, index) => (
          <View
            key={`line-${index}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: line.x - line.length / 2,
              top: line.y - 2,
              width: line.length,
              height: 4,
              backgroundColor: theme.colors.primary,
              transform: [{ rotate: `${line.angle}deg` }],
              borderRadius: 2,
            }}
          />
        ))}
        {cursor && selected.length > 0 ? (() => {
          const a = positions[selected[selected.length - 1]];
          const length = distance(a, cursor);
          return (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: (a.x + cursor.x) / 2 - length / 2,
                top: (a.y + cursor.y) / 2 - 2,
                width: length,
                height: 4,
                backgroundColor: theme.colors.primary,
                opacity: 0.55,
                borderRadius: 2,
                transform: [{ rotate: `${(Math.atan2(cursor.y - a.y, cursor.x - a.x) * 180) / Math.PI}deg` }],
              }}
            />
          );
        })() : null}
        {positions.map((point, index) => {
          const active = selected.includes(index);
          return (
            <View
              key={index}
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: point.x - DOT / 2,
                top: point.y - DOT / 2,
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                borderWidth: 3,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.primary : theme.colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View pointerEvents="none" style={{ width: active ? 18 : 10, height: active ? 18 : 10, borderRadius: 9, backgroundColor: active ? '#FFFFFF' : theme.colors.textMuted }} />
            </View>
          );
        })}
      </View>
      {error ? <Text style={[styles.error, typography.body, { color: theme.colors.critical }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.lg },
  label: { fontWeight: '600', textAlign: 'center' },
  // التطبيق بالكامل RTL؛ نثبّت اتجاه اللوحة LTR كي تتطابق مواضع النقاط مع إحداثيات اللمس.
  board: { position: 'relative', borderRadius: radius.lg, direction: 'ltr' },
  error: { textAlign: 'center', fontWeight: '600' },
});
