import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { GenerationProgress } from '@/ai/generator/generate';
import { space, type, useTheme } from './theme';

const STAGES = [['building', 'Building'], ['checking', 'Checking']] as const;

/** Building → Checking, with "Fixing mistakes (try n)" appended while the generator is fixing its output. */
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
    ...(repairing ? [{ id: 'repairing', label: `Fixing mistakes (try ${progress.attempt})` }] : [])];
  const elapsed = useElapsed();
  const current = steps.findIndex((s) => s.id === progress.stage);
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={`Step: ${steps[Math.max(current, 0)].label}, ${elapsed} seconds`} style={styles.col}>
      <View style={styles.row}>
        <ActivityIndicator color={t.accent} />
        {steps.map((s, i) => (
          <Text key={s.id} style={{ fontSize: type.body, color: i === current ? t.accent : i < current ? t.text : t.muted, fontWeight: i === current ? '700' : '400' }}>
            {i > 0 ? '→ ' : ''}{s.label}
          </Text>
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: type.meta }}>
        {elapsed} s · Usually under half a minute. The first build after opening the app takes longer.
      </Text>
      {progress.freeForm ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: type.meta }}>
          {(progress.freeFormReason === 'unusable' ? 'This doesn’t fit one of the ready-made kinds of mini-app, so ' : 'No ready-made kind of mini-app fits this one, so ')
            + (progress.freeForm === 'cloud' ? 'the cloud AI is building it.'
              : 'the AI is building it from scratch. That can take a few minutes and may not work.')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
