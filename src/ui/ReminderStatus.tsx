import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { sendTestReminder, type SyncResult } from '@/runtime/triggers';
import { radius, space, useTheme } from '@/ui/theme';

const when = (d: Date) => d.toLocaleString(undefined, { weekday: 'short', hour: '2-digit', minute: '2-digit' });
const hm = (d: Date) => d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

/** One line saying whether the mini-app's reminders will show; hidden when it has none. */
export function ReminderStatus({ appId, result }: { appId: string; result: SyncResult }) {
  const t = useTheme();
  const [testAt, setTestAt] = useState<Date>();
  const [failed, setFailed] = useState(false);
  if (result.status === 'none') return null;
  const text = result.status === 'on'
    ? `🔔 Next reminder: ${result.next ? when(result.next) : 'set'}${Platform.OS === 'web' ? ' · only while this tab is open' : ''}`
    : result.status === 'denied' ? 'Notifications are off for JackApp, so reminders will not show.'
      : 'Reminders are not available on this device.';
  const button = (label: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.btn, { borderColor: t.border }]}>
      <Text style={{ color: t.accent, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View accessibilityLiveRegion="polite" style={[styles.box, { backgroundColor: t.surface, borderColor: t.border }]}>
      <Text style={{ color: t.text, fontSize: 15 }}>{text}</Text>
      {testAt ? <Text style={{ color: t.muted, fontSize: 14 }}>Test reminder arrives at {hm(testAt)}.</Text> : null}
      {failed ? <Text style={{ color: t.muted, fontSize: 14 }}>Couldn’t schedule the test.</Text> : null}
      {result.status === 'denied' && Platform.OS !== 'web' ? button('Open settings', () => void Linking.openSettings()) : null}
      {result.status === 'on' && result.test
        ? button('Send a test in 2 minutes', () => { setFailed(false); sendTestReminder(appId, result.test!).then(setTestAt, () => setFailed(true)); }) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: space.lg, marginTop: space.sm, padding: space.md, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  btn: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: space.md, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
