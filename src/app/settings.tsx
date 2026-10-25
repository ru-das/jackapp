import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toast } from '@/capabilities';
import { OPENROUTER_MODELS } from '@/ai/models';
import { localModel } from '@/ai/providers/litert';
import { CURRENCIES } from '@/ai/generator/recipes/splitter';
import { loadSettings, saveSettings, type Settings } from '@/storage/settings';
import { LocalModelCard } from '@/ui/LocalModelCard';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

const STAGES = [
  ['Building', OPENROUTER_MODELS.fill],
  ['Fixing mistakes', OPENROUTER_MODELS.repair],
  ['Reading photos', OPENROUTER_MODELS.run],
] as const;

export default function SettingsScreen() {
  const t = useTheme();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [details, setDetails] = useState(false);

  useEffect(() => { void loadSettings().then(setSettings); }, []);

  const update = async (patch: Partial<Settings>) => {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveSettings(next).catch(() => toast("Couldn't save settings. Try again."));
  };

  if (!settings) return <View style={{ flex: 1, backgroundColor: t.bg }}><ActivityIndicator accessibilityLabel="Loading settings" color={t.accent} style={{ marginTop: space.lg * 2 }} /></View>;
  const card = [styles.card, { backgroundColor: t.surface, borderColor: t.border }];
  const input = [styles.input, { color: t.text, borderColor: t.border, backgroundColor: t.bg }];
  const choices: [Settings['provider'], string][] = [
    ...(localModel.available ? [['local', 'On-device (works offline)'] as [Settings['provider'], string]] : []),
    ['openrouter', 'OpenRouter (free models)'], ['ollama', 'Ollama (your own computer)'],
    ...(__DEV__ ? [['mock', 'Mock (dev, no AI)'] as [Settings['provider'], string]] : []),
  ];

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.content}>
      <View style={card}>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>AI</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>
          {settings.provider === 'local'
            ? 'Everything stays on this device.'
            : 'Your request, and any photo you ask it to read, is sent to the AI you pick. Your mini-apps and their data stay on this device.'}
        </Text>
        {choices.map(([id, label]) => {
          const on = settings.provider === id;
          return (
            <Pressable
              key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={label}
              onPress={() => void update({ provider: id })}
              style={[styles.row, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.border }]}
            >
              <Text style={[styles.name, { color: t.text }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={card}>
        <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Money</Text>
        <Text style={{ color: t.muted, fontSize: 15 }}>The currency used to show amounts. It does not change the language of the app.</Text>
        <View style={styles.chips}>
          {CURRENCIES.map((code) => {
            const on = settings.currency === code;
            return (
              <Pressable
                key={code} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`Currency ${code}`}
                onPress={() => void update({ currency: code })}
                style={[styles.chip, { backgroundColor: on ? t.accentSoft : 'transparent', borderColor: on ? t.accent : t.border }]}
              >
                <Text style={[styles.name, { color: t.text }]}>{code}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {settings.provider === 'local' ? <LocalModelCard style={card} /> : null}

      {settings.provider === 'openrouter' ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>OpenRouter</Text>
          <Text style={{ color: t.muted, fontSize: 15 }}>Get a free key at openrouter.ai/keys. It is kept on this device only.</Text>
          <Text style={{ color: t.text, fontSize: 16 }}>API key</Text>
          <TextInput
            accessibilityLabel="OpenRouter API key" style={input} value={settings.openrouterKey}
            onChangeText={(v) => void update({ openrouterKey: v })}
            secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="sk-or-…" placeholderTextColor={t.muted}
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Model details" accessibilityState={{ expanded: details }} onPress={() => setDetails(!details)} style={styles.toggle}>
            <Text style={{ color: t.text, fontSize: 15 }}>{details ? '▾' : '▸'} Model details</Text>
          </Pressable>
          {details ? STAGES.map(([stage, id]) => (
            <Text key={stage} style={{ color: t.muted, fontSize: 14 }}>{stage}: {id}</Text>
          )) : null}
        </View>
      ) : null}

      {settings.provider === 'ollama' ? (
        <View style={card}>
          <Text accessibilityRole="header" style={[styles.h, { color: t.text }]}>Ollama</Text>
          <Text style={{ color: t.muted, fontSize: 15 }}>Run “ollama serve” on your computer. On a phone, use your computer’s address on the same Wi-Fi.</Text>
          <Text style={{ color: t.text, fontSize: 16 }}>Server address</Text>
          <TextInput
            accessibilityLabel="Ollama server address" style={input} value={settings.ollamaUrl}
            onChangeText={(v) => void update({ ollamaUrl: v })}
            autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholderTextColor={t.muted}
          />
          <Text style={{ color: t.text, fontSize: 16 }}>Model name</Text>
          <TextInput
            accessibilityLabel="Ollama model name" style={input} value={settings.ollamaModel}
            onChangeText={(v) => void update({ ollamaModel: v })}
            autoCapitalize="none" autoCorrect={false} placeholder="a model from “ollama list”" placeholderTextColor={t.muted}
          />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, maxWidth: 640, width: '100%', alignSelf: 'center' },
  card: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
  h: { fontSize: 19, fontWeight: '600' },
  row: { minHeight: MIN_TARGET, padding: space.md, borderRadius: radius.control, borderWidth: 1, justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { minHeight: MIN_TARGET, minWidth: MIN_TARGET + 12, paddingHorizontal: space.md, borderRadius: radius.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  toggle: { minHeight: MIN_TARGET, justifyContent: 'center' },
  input: { minHeight: MIN_TARGET, borderWidth: 1, borderRadius: radius.control, paddingHorizontal: space.md, fontSize: 16 },
});
