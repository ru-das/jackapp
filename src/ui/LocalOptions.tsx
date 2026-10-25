import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Text } from '@/ui/Text';
import { localModel } from '@/ai/providers/litert';
import type { LocalTuning } from '@/ai/provider';
import { MIN_TARGET, space, switchColors, type, useTheme } from '@/ui/theme';

const OPTIONS: { label: string; hint: string; read: (t: LocalTuning) => boolean; write: (t: LocalTuning, on: boolean) => void }[] = [
  { label: 'GPU', hint: 'Off = CPU, for comparing speed', read: (t) => t.backend === 'gpu', write: (t, on) => { t.backend = on ? 'gpu' : 'cpu'; } },
  { label: 'Speculative decoding', hint: 'Experimental, may write faster', read: (t) => t.speculative, write: (t, on) => { t.speculative = on; } },
];

/** Switches for the on-device engine; they apply to the next call and the engine reloads when GPU or speculation change. */
export function LocalOptions({ disabled }: { disabled?: boolean }) {
  const t = useTheme();
  const [state, setState] = useState<LocalTuning>(() => ({ ...localModel.tuning }));
  if (!localModel.available) return null;
  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ color: t.muted, fontSize: type.meta }}>On-device options</Text>
      {OPTIONS.map((o) => (
        <View key={o.label} style={{ flexDirection: 'row', alignItems: 'center', minHeight: MIN_TARGET }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontSize: type.body }}>{o.label}</Text>
            <Text style={{ color: t.muted, fontSize: type.meta }}>{o.hint}</Text>
          </View>
          <Switch
            accessibilityLabel={o.label} disabled={disabled} value={o.read(state)} {...switchColors(t)}
            onValueChange={(on) => { o.write(localModel.tuning, on); setState({ ...localModel.tuning }); }}
          />
        </View>
      ))}
    </View>
  );
}
