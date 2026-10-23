import { palettes } from '../theme';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// [text colour, background] pairs the UI actually draws; AT-16 asks for readable text in both themes.
const PAIRS = [
  ['text', 'bg'], ['text', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['muted', 'accentSoft'],
  ['accent', 'bg'], ['accent', 'surface'], ['accentText', 'accent'], ['danger', 'surface'], ['danger', 'dangerSoft'],
] as const;

describe.each(Object.entries(palettes))('%s palette', (_name, p) => {
  test.each(PAIRS)('%s on %s is at least 4.5:1', (fg, bg) => {
    expect(ratio(p[fg], p[bg])).toBeGreaterThanOrEqual(4.5);
  });
});
