import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Says `text` to the screen reader each time it changes. TalkBack skips live regions that mount with their text and ignores the alert role,
 * so changes that appear and vanish are announced explicitly. `onMount: false` keeps the text that is already there when the component appears quiet.
 */
export function useAnnounce(text: string | null | undefined, { onMount = true } = {}): void {
  const mounted = useRef(false);
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (text && (onMount || !first)) AccessibilityInfo.announceForAccessibility(text);
  }, [text, onMount]);
}
