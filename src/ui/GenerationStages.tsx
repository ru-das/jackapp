import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from '@/ui/Text';
import type { GenerationProgress } from '@/ai/generator/generate';
import { Icon } from './Icon';
import { font, space, type, useTheme } from './theme';

const STAGES = [['building', 'Building'], ['checking', 'Checking']] as const;

/** Building → Checking, with "Adjusting (try n)" appended while the generator is correcting its output. */
/** Seconds since mount; a slow phone model needs visible proof that it is still going. */
export function useElapsed(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return s;
}

export function GenerationStages({ progress }: { progress: Pick<GenerationProgress, 'stage' | 'attempt' | 'freeForm' | 'freeFormReason'> }) {
  const t = useTheme();
  const repairing = progress.stage === 'repairing';
  const steps = [...STAGES.map(([id, label]) => ({ id: id as string, label })),
    ...(repairing ? [{ id: 'repairing', label: `Adjusting (try ${progress.attempt})` }] : [])];
  const elapsed = useElapsed();
  const current = steps.findIndex((s) => s.id === progress.stage);
  return (
    <View style={styles.col}>
      <View accessibilityLiveRegion="polite" accessible accessibilityLabel={`Step: ${steps[Math.max(current, 0)].label}`} style={styles.row}>
        <ActivityIndicator color={t.accent} />
        {steps.map((s, i) => (
          <View key={s.id} style={styles.step}>
            {i > 0 ? <Icon name="chevron-forward" size={16} color={t.muted} /> : null}
            <Text style={{ fontSize: type.body, color: i === current ? t.accent : i < current ? t.text : t.muted, fontFamily: i === current ? font.bold : font.body }}>{s.label}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: type.meta }}>
        {elapsed} s · Usually under half a minute. The first build after opening the app takes longer.
      </Text>
      {progress.freeForm ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: type.meta }}>
          {(progress.freeFormReason === 'unusable' ? 'This doesn’t fit one of the ready-made types of mini-app, so ' : 'No ready-made type of mini-app fits this one, so ')
            + 'the AI is building it from scratch. That can take a few minutes and may not work.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: space.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
