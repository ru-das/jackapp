import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { h1, h2, h3 } from '@/spec/fixtures';
import { validate } from '@/spec/validate';
import { toast } from '@/capabilities';
import { specKey, writeJson } from '@/storage';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

const FIXTURES = [
  { id: 'fixture-h1', spec: h1 },
  { id: 'fixture-h2', spec: h2 },
  { id: 'fixture-h3', spec: h3 },
];

export default function Home() {
  const t = useTheme();
  const router = useRouter();
  const open = async (id: string, spec: unknown) => {
    const errors = validate(spec);
    if (errors.length) {
      console.error('home: fixture invalid', errors);
      toast("This template is damaged, so we can't open it.");
      return;
    }
    await writeJson(specKey(id), spec);
    router.push({ pathname: '/run/[id]', params: { id } });
  };
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: t.text }]}>JackApp</Text>
      <View style={[styles.card, styles.empty, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={styles.icon}>🦥</Text>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>No mini-apps yet</Text>
        <Text style={{ color: t.muted, fontSize: 16, textAlign: 'center' }}>
          Tell me a chore you’d rather not do. I’ll build the app. Slowly.
        </Text>
      </View>
      {([['New mini-app', '/create'], ['Settings', '/settings']] as const).map(([label, to]) => (
        <Pressable
          key={to} accessibilityRole="button" onPress={() => router.push(to)}
          style={[styles.nav, { backgroundColor: to === '/create' ? t.accent : t.surface, borderColor: t.border }]}
        >
          <Text style={[styles.name, { color: to === '/create' ? t.accentText : t.text }]}>{label}</Text>
        </Pressable>
      ))}
      {__DEV__ ? (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Dev: load a fixture</Text>
          <Pressable
            accessibilityRole="button" onPress={() => router.push('/dev/eval')}
            style={[styles.row, { backgroundColor: t.accentSoft }]}
          >
            <Text style={[styles.name, { color: t.text }]}>Run model eval</Text>
          </Pressable>
          {FIXTURES.map(({ id, spec }) => (
            <Pressable
              key={id} accessibilityRole="button" accessibilityLabel={`Open ${spec.meta.name}`}
              onPress={() => void open(id, spec)} style={[styles.row, { backgroundColor: t.accentSoft }]}
            >
              <Text style={styles.icon}>{spec.meta.icon}</Text>
              <View style={styles.flex}>
                <Text style={[styles.name, { color: t.text }]}>{spec.meta.name}</Text>
                <Text style={{ color: t.muted, fontSize: 14 }}>{spec.meta.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 34, fontWeight: '700' },
  empty: { alignItems: 'center' },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 17, fontWeight: '600', marginBottom: space.sm },
  row: { minHeight: MIN_TARGET + 12, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.control },
  nav: { minHeight: MIN_TARGET + 8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', padding: space.md },
  icon: { fontSize: 28 },
  flex: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600' },
});
