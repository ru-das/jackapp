import { useRef } from 'react';
import { Platform, ScrollView, Text, type ScrollViewInstance } from 'react-native';
import { radius, space, useTheme } from '@/ui/theme';

export const SHOWN_LINES = 300;

/** Monospace, newest line last, scrolled to the end as lines arrive. */
export function EvalLog({ lines }: { lines: string[] }) {
  const t = useTheme();
  const scroll = useRef<ScrollViewInstance>(null);
  if (!lines.length) return null;
  return (
    <ScrollView
      ref={scroll} accessibilityLabel="Run log" nestedScrollEnabled
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      style={{ maxHeight: 360, backgroundColor: t.bg, borderRadius: radius.control, padding: space.sm }}
    >
      {lines.slice(-SHOWN_LINES).map((line, i) => (
        <Text key={i} selectable style={{ color: t.text, fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>
          {line}
        </Text>
      ))}
    </ScrollView>
  );
}
