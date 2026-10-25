import { existsSync, readFileSync } from 'node:fs';
import { palettes } from '@/ui/theme';

const config = JSON.parse(readFileSync('app.json', 'utf8')) as { expo: { plugins: (string | [string, Record<string, string>])[] } };
const notifications = config.expo.plugins.find((p): p is [string, Record<string, string>] => Array.isArray(p) && p[0] === 'expo-notifications')![1];

// The system tints the reminder's small icon with this colour on a white or dark shade; a pale tint is nearly invisible.
test('the reminder colour is the app accent, readable on white', () => {
  expect(notifications.color.toLowerCase()).toBe(palettes.light.accent.toLowerCase());
});

// Android draws only the alpha of a small icon: it must be its own white-on-transparent 96 px image, not the full-colour launcher icon.
test('the reminder small icon is a 96 x 96 PNG with transparency', () => {
  const file = notifications.icon;
  expect(file).toBeTruthy();
  expect(existsSync(file)).toBe(true);
  const png = readFileSync(file);
  expect(png.readUInt32BE(16)).toBe(96);
  expect(png.readUInt32BE(20)).toBe(96);
  expect(png[25]).toBe(6); // colour type 6: RGBA
});
