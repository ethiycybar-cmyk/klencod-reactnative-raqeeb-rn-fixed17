import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { scanBarcode } from '../services/native';
import { useUIStore } from '../store/uiStore';
import { spacing } from '../theme/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string | null;
  placeholder?: string;
  hint?: string;
  compact?: boolean;
};

/** حقل نصي مع زر «مسح بالكاميرا» يفتح ماسح Google ويكتب الرقم المقروء في الحقل. */
export function BarcodeField({ label, value, onChangeText, error, placeholder, hint, compact }: Props) {
  const show = useUIStore((s) => s.show);
  const [busy, setBusy] = useState(false);

  const scan = async () => {
    setBusy(true);
    try {
      const code = await scanBarcode();
      if (code) onChangeText(code.trim());
    } catch (e) {
      show(e instanceof Error ? e.message : 'تعذّر مسح الباركود', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Input label={label} value={value} onChangeText={onChangeText} error={error} placeholder={placeholder} hint={hint} ltr keyboard="default" />
      <Button
        title="مسح بالكاميرا"
        size="sm"
        variant="secondary"
        onPress={scan}
        loading={busy}
        style={compact ? styles.buttonCompact : styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { alignSelf: 'flex-start', marginTop: -spacing.xs, marginBottom: spacing.md },
  buttonCompact: { alignSelf: 'flex-start', marginTop: -spacing.xs, marginBottom: spacing.sm },
});
