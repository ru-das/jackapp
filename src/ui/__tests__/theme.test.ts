import { inverse, palettes } from '../theme';

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

// WCAG 1.4.11: the edge of a control (input, off Switch) is a graphic the user must see; `border` is only a hairline.
describe.each(Object.entries(palettes))('%s palette controls', (_name, p) => {
  test.each(['bg', 'surface', 'accentSoft'] as const)('outline on %s is at least 3:1', (bg) => {
    expect(ratio(p.outline, p[bg])).toBeGreaterThanOrEqual(3);
  });
  test('an off Switch thumb stands out from its track', () => {
    expect(ratio(p.surface, p.outline)).toBeGreaterThanOrEqual(3);
  });
});

// The toast and Undo bar are drawn on the inverse surface; their text and the Undo action must read on it.
describe.each(Object.entries(palettes))('%s palette inverse surface', (_name, p) => {
  const snack = inverse(p);
  test('text and the Undo action are at least 4.5:1', () => {
    expect(ratio(snack.fg, snack.bg)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(snack.accent, snack.bg)).toBeGreaterThanOrEqual(4.5);
  });
});
