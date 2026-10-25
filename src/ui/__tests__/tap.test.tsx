import { Platform } from 'react-native';
import { Tap } from '@/ui/Tap';
import { pressed } from '@/ui/theme';

afterEach(() => jest.restoreAllMocks());

// Tap is a plain function component, so the element it returns shows the props the native Pressable will get.
test('every Tap carries a ripple for Android, drawn over its content', () => {
  expect(Tap({}).props.android_ripple).toEqual({ foreground: true });
});

test('a Tap can still change its ripple', () => {
  expect(Tap({ android_ripple: { color: 'red' } }).props.android_ripple).toEqual({ color: 'red' });
});

test('a held target dims on iOS and web but not on Android, which ripples instead', () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  expect(pressed({ pressed: true })).toEqual({ opacity: 0.7 });
  expect(pressed({ pressed: false })).toBeNull();
  jest.replaceProperty(Platform, 'OS', 'android');
  expect(pressed({ pressed: true })).toBeNull();
});
