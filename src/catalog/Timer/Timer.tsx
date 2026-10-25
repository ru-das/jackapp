import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TARGET, pressed, radius, space, useTheme } from '@/ui/theme';

interface Props { label: string; seconds: number; onDone?(): void }

export const clock = (total: number) => {
  const s = Math.max(0, Math.ceil(total));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// shortcut: the countdown runs while the app is open; a background notification needs the triggers work (T-52).
export function Timer({ label, seconds, onDone }: Props) {
  const t = useTheme();
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 24 * 3600) : 0;
  // null = untouched, so a changed duration shows through; pausing keeps the time left.
  const [spent, setSpent] = useState<number | null>(null);
  const left = spent ?? total;
  const [running, setRunning] = useState(false);
  const deadline = useRef(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const remaining = (deadline.current - Date.now()) / 1000;
      if (remaining <= 0) { clearInterval(id); setSpent(0); setRunning(false); done.current?.(); } else setSpent(remaining);
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  const start = () => { const from = left > 0 ? left : total; deadline.current = Date.now() + from * 1000; setSpent(from); setRunning(true); };
  const reset = () => { setRunning(false); setSpent(null); };
  return (
    <View accessible accessibilityLabel={`${label}: ${clock(left)} left`} style={[styles.box, { backgroundColor: t.accentSoft }]}>
      <Text style={{ color: t.muted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: t.accent, fontSize: 48, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{clock(left)}</Text>
      <View style={styles.row}>
        {running
          ? <Action name="Pause" label={label} primary={false} onPress={() => setRunning(false)} />
          : <Action name={left > 0 && left < total ? 'Resume' : 'Start'} label={label} primary onPress={start} />}
        <Action name="Reset" label={label} primary={false} onPress={reset} />
      </View>
    </View>
  );
}

function Action({ name, label, primary, onPress }: { name: string; label: string; primary: boolean; onPress(): void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${name} ${label}`} onPress={onPress}
      style={(st) => [styles.btn, { backgroundColor: primary ? t.accent : 'transparent', borderColor: t.accent }, pressed(st)]}>
      <Text style={{ color: primary ? t.accentText : t.accent, fontSize: 16, fontWeight: '600' }}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.md, gap: space.sm, borderRadius: radius.control, alignItems: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  btn: { minHeight: MIN_TARGET, minWidth: 96, borderRadius: radius.control, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
});
