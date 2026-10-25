import { useEffect } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Says `text` to the screen reader each time it changes. TalkBack skips live regions that mount with their text and ignores the alert role, so changes that appear and vanish are announced explicitly. */
export function useAnnounce(text: string | null | undefined): void {
  useEffect(() => {
    if (text) AccessibilityInfo.announceForAccessibility(text);
  }, [text]);
}
