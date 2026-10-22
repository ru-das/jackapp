import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  bg: '#F7F3EC', surface: '#FFFDF9', border: '#E8E1D4', text: '#2B2A27', muted: '#7B766B',
  accent: '#3E8E7E', accentText: '#FFFFFF', accentSoft: '#E1EFEA', danger: '#B4533F', dangerSoft: '#F6E3DE',
};
const dark: typeof light = {
  bg: '#16191B', surface: '#1F2326', border: '#2E3438', text: '#ECE8DF', muted: '#9AA09C',
  accent: '#6CBBA9', accentText: '#10201C', accentSoft: '#25382F', danger: '#E08A76', dangerSoft: '#3A2622',
};

export type Palette = typeof light;
export const space = { none: 0, sm: 8, md: 16, lg: 24 } as const;
export const radius = { card: 20, control: 14, pill: 999 } as const;
export const MIN_TARGET = 44;

// The static web export is rendered light on the server. A dark first client render would hydrate-mismatch and
// React would never patch the stale attributes, so hydration uses the server snapshot (false) and then flips.
const noop = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(noop, () => true, () => false);

export const useTheme = (): Palette => {
  const scheme = useColorScheme();
  return useHydrated() && scheme === 'dark' ? dark : light;
};
