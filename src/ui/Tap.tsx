import { Pressable, type PressableProps } from 'react-native';

// Android answers a press with a ripple over the control; `pressed()` in theme.ts dims it everywhere else, so one control never does both.
const RIPPLE = { foreground: true } as const;

export function Tap(props: PressableProps) {
  return <Pressable android_ripple={RIPPLE} {...props} />;
}
