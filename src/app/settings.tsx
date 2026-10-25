import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/ui/Text';
import { Tap } from '@/ui/Tap';
import { toast } from '@/capabilities';
import { localModel } from '@/ai/providers/litert';
import { CURRENCIES } from '@/ai/generator/recipes/splitter';
import { loadSettings, saveSettings, type Settings } from '@/storage/settings';
import { Card } from '@/ui/Card';
import { Icon, type IconName } from '@/ui/Icon';
import { useInsets } from '@/ui/insets';
import { LocalModelCard } from '@/ui/LocalModelCard';
import { font, MIN_TARGET, pressed, radius, setThemePreference, space, type, useTheme } from '@/ui/theme';

const THEMES: [Settings['theme'], string, IconName][] = [['system', 'System', 'contrast-outline'], ['light', 'Light', 'sunny-outline'], ['dark', 'Dark', 'moon-outline']];
const PROVIDER_ICONS: Record<Settings['provider'], IconName> = { local: 'phone-portrait-outline', ollama: 'desktop-outline', mock: 'construct-outline' };

export default function SettingsScreen() {
  const t = useTheme();
  const { bottom } = useInsets();
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { void loadSettings().then(setSettings); }, []);

  const update = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    if (patch.theme) setThemePreference(patch.theme);
    await saveSettings(next).catch(() => toast("Couldn’t save settings. Try again."));
  };

  if (!settings) return <View style={{ flex: 1, backgroundColor: t.bg }}><ActivityIndicator accessibilityLabel="Loading settings" color={t.accent} style={{ marginTop: space.lg * 2 }} /></View>;
  const input = [styles.input, { color: t.text, borderColor: t.outline, backgroundColor: t.bg }];
  const choices: [Settings['provider'], string][] = [
    ...(localModel.available ? [['local', 'On-device (works offline)'] as [Settings['provider'], string]] : []),
    ['ollama', 'Ollama (your own computer)'],
    ...(__DEV__ ? [['mock', 'Mock (dev, no AI)'] as [Settings['provider'], string]] : []),
  ];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={[styles.content, { paddingBottom: space.lg + bottom }]} keyboardShouldPersistTaps="handled">
      <Card>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>AI</Text>
        <Text style={{ color: t.muted, fontSize: type.hint }}>
          {settings.provider === 'local'
            ? 'Everything stays on this device.'
            : 'Your request, and any photo you ask it to read, is sent to the AI you pick. Your mini-apps and their data stay on this device.'}
        </Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="AI provider" style={styles.group}>
          {choices.map(([id, label]) => {
            const on = settings.provider === id;
            return (
              <Tap
                key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
                onPress={() => void update({ provider: id })}
                style={(st) => [styles.row, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.outline }, pressed(st)]}
              >
                <Icon name={PROVIDER_ICONS[id]} size={22} color={on ? t.accent : t.text} />
                <Text style={[styles.name, { color: t.text }]}>{label}</Text>
                {on ? <Icon name="checkmark-circle" size={22} color={t.accent} /> : null}
              </Tap>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Appearance</Text>
        <Text style={{ color: t.muted, fontSize: type.hint }}>System follows your phone’s light or dark setting.</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Appearance" style={styles.chips}>
          {THEMES.map(([id, label, icon]) => {
            const on = settings.theme === id;
            return (
              <Tap
                key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Appearance ${label}`}
                onPress={() => void update({ theme: id })}
                style={(st) => [styles.chip, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.outline }, pressed(st)]}
              >
                <Icon name={icon} size={20} color={on ? t.accent : t.text} />
                <Text style={[styles.name, { color: t.text }]}>{label}</Text>
              </Tap>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Money</Text>
        <Text style={{ color: t.muted, fontSize: type.hint }}>The currency used to show amounts. It does not change the language of the app.</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Currency" style={styles.chips}>
          {CURRENCIES.map((code) => {
            const on = settings.currency === code;
            return (
              <Tap
                key={code} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Currency ${code}`}
                onPress={() => void update({ currency: code })}
                style={(st) => [styles.chip, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.outline }, pressed(st)]}
              >
                <Text style={[styles.name, { color: t.text }]}>{code}</Text>
              </Tap>
            );
          })}
        </View>
      </Card>

      {settings.provider === 'local' ? <LocalModelCard /> : null}

      {settings.provider === 'ollama' ? (
        <Card>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Ollama</Text>
          <Text style={{ color: t.muted, fontSize: type.hint }}>Run “ollama serve” on your computer. On a phone, use your computer’s address on the same Wi-Fi.</Text>
          <Text style={{ color: t.text, fontSize: type.body }}>Server address</Text>
          <TextInput
            accessibilityLabel="Ollama server address" style={input} value={settings.ollamaUrl}
            onChangeText={(v) => void update({ ollamaUrl: v })}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholderTextColor={t.muted}
          />
          <Text style={{ color: t.text, fontSize: type.body }}>Model name</Text>
          <TextInput
            accessibilityLabel="Ollama model name" style={input} value={settings.ollamaModel}
            onChangeText={(v) => void update({ ollamaModel: v })}
            autoCapitalize="none" autoCorrect={false} placeholder="a model from “ollama list”" placeholderTextColor={t.muted}
          />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  h: { fontSize: type.h, fontFamily: font.display },
  row: { minHeight: MIN_TARGET, padding: space.md, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },
  group: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: MIN_TARGET, minWidth: MIN_TARGET + 12, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', gap: space.sm, alignItems: 'center', justifyContent: 'center' },
  name: { flexShrink: 1, fontSize: type.body, fontWeight: '600' },
  input: { minHeight: MIN_TARGET, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, fontSize: type.body },
});
