import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === '__tests__' ? [] : walk(p)) : /\.tsx?$/.test(f) ? [p] : [];
});

// The wordmark font is the brand's alone: nothing else may copy it.
test('font.brand is used only for the JackApp name on Home', () => {
  const users = walk(join(__dirname, '../..')).filter((f) => /font\.brand|BagelFatOne/.test(readFileSync(f, 'utf8')) && !f.endsWith('theme.ts') && !f.endsWith('_layout.tsx'));
  expect(users.map((f) => f.split('/src/')[1])).toEqual(['app/index.tsx']);
});
