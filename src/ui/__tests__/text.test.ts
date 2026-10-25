import { withFont } from '../Text';
import { font } from '../theme';

test.each([
  [undefined, font.body], ['400', font.body], ['500', font.medium], ['600', font.semibold], ['700', font.bold], ['bold', font.bold],
] as const)('weight %s picks %s and drops fontWeight', (fontWeight, family) => {
  const style = withFont({ fontSize: 16, fontWeight });
  expect(style).toEqual({ fontSize: 16, fontFamily: family });
});

test('a style that names its family keeps it', () => {
  expect(withFont([{ fontFamily: font.display, fontWeight: '700' }, { color: 'red' }])).toEqual({ fontFamily: font.display, color: 'red' });
});
