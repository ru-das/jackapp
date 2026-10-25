import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/ui/ActionButton';
import { space, useTheme } from '@/ui/theme';

export default function NotFound() {
  const t = useTheme();
  const router = useRouter();
  return (
    <View style={[styles.box, { backgroundColor: t.bg }]}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 19, fontWeight: '600' }}>We can’t find that page</Text>
      <Text style={{ color: t.muted, fontSize: 16 }}>The link may be old or mistyped.</Text>
      <ActionButton label="Go home" onPress={() => router.replace('/')} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: space.lg, gap: space.md, justifyContent: 'center' },
});
