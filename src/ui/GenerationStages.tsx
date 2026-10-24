import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { GenerationProgress } from '@/ai/generator/generate';
import { space, useTheme } from './theme';

const STAGES = [['planning', 'Planning'], ['building', 'Building'], ['checking', 'Checking']] as const;

/** Planning → Building → Checking, with "Repairing n" appended while the generator is fixing its output. */
/** Seconds since mount; a slow phone model needs visible proof that it is still going. */
export function useElapsed(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setS((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return s;
}

export function GenerationStages({ progress }: { progress: Pick<GenerationProgress, 'stage' | 'attempt' | 'freeForm'> }) {
  const t = useTheme();
  const repairing = progress.stage === 'repairing';
  const steps = [...STAGES.map(([id, label]) => ({ id: id as string, label })),
    ...(repairing ? [{ id: 'repairing', label: `Repairing ${progress.attempt}` }] : [])];
  const elapsed = useElapsed();
  const current = steps.findIndex((s) => s.id === progress.stage);
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={`Step: ${steps[Math.max(current, 0)].label}, ${elapsed} seconds`} style={styles.col}>
      <View style={styles.row}>
        <ActivityIndicator color={t.accent} />
        {steps.map((s, i) => (
          <Text key={s.id} style={{ fontSize: 16, color: i === current ? t.accent : i < current ? t.text : t.muted, fontWeight: i === current ? '700' : '400' }}>
            {i > 0 ? '→ ' : ''}{s.label}
          </Text>
        ))}
      </View>
      <Text style={{ color: t.muted, fontSize: 14 }}>
        {elapsed} s · Sloth pace: this can take a minute or two on a phone.
      </Text>
      {progress.freeForm ? (
        <Text accessibilityLiveRegion="polite" style={{ color: t.muted, fontSize: 14 }}>
          {progress.freeForm === 'cloud'
            ? 'None of my ready-made app types fits this one, so the cloud model is building it.'
            : 'None of my ready-made app types fits this one, so I am building it from scratch. That can take a few minutes and may not work.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  col: { gap: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
