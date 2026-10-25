import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  bg: '#F7F3EC', surface: '#FFFDF9', border: '#E8E1D4', outline: '#8C8576', text: '#2B2A27', muted: '#6B665B',
  accent: '#2B7364', accentText: '#FFFFFF', accentSoft: '#E1EFEA', danger: '#9A4430', dangerSoft: '#F6E3DE',
};
const dark: typeof light = {
  bg: '#16191B', surface: '#1F2326', border: '#2E3438', outline: '#7A827E', text: '#ECE8DF', muted: '#9AA09C',
  accent: '#6CBBA9', accentText: '#10201C', accentSoft: '#25382F', danger: '#E08A76', dangerSoft: '#3A2622',
};

export const palettes = { light, dark };
export type Palette = typeof light;
// `border` is the hairline between surfaces; `outline` (3:1) is the edge of a control, so inputs and an off Switch read as controls.
// Snackbar surface (toast, Undo bar): the page's text colour as fill, so it stands off the content without a border or shadow. The accent comes from the other theme so Undo stays readable on it.
export const inverse = (t: Palette) => ({ bg: t.text, fg: t.bg, accent: (t === dark ? light : dark).accent });
export const switchColors = (t: Palette) => ({ trackColor: { true: t.accent, false: t.outline }, thumbColor: t.surface });
export const space = { none: 0, xs: 4, sm: 8, md: 16, lg: 24 } as const;
export const radius = { card: 20, control: 14, pill: 999 } as const;
export const MIN_TARGET = 48; // Material minimum; 44 is the iOS value
// Role sizes for the app's own screens. Catalog Text variants keep their own scale (it is part of what a spec can ask for).
export const type = { title: 34, h: 19, body: 16, hint: 15, meta: 14 } as const;
/** Dim a Pressable while it is held, so every tap target answers the finger. */
export const pressed = ({ pressed: down }: { pressed: boolean }) => (down ? { opacity: 0.7 } : null);

// The static web export is rendered light on the server. A dark first client render would hydrate-mismatch and
// React would never patch the stale attributes, so hydration uses the server snapshot (false) and then flips.
const noop = () => () => {};
const useHydrated = (): boolean => useSyncExternalStore(noop, () => true, () => false);

export const useTheme = (): Palette => {
  const scheme = useColorScheme();
  return useHydrated() && scheme === 'dark' ? dark : light;
};
