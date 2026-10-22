import { useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getProvider } from '@/ai/provider';
import { lastTimings } from '@/ai/providers/local';

const SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, items: { type: 'array', items: { type: 'string' } } },
  required: ['title', 'items'],
  additionalProperties: false,
};
const PROMPTS = [
  'A packing list for a weekend hike',
  'Grocery list for pasta night',
  'Morning routine checklist',
  'Things to bring to a job interview',
  'Gym workout for legs',
];
const now = () => Date.now();
const SYSTEM = 'Reply with JSON only: {"title": string, "items": string[]}.';

const valid = (s: string) => {
  try {
    const o = JSON.parse(s);
    return typeof o.title === 'string' && Array.isArray(o.items);
  } catch {
    return false;
  }
};

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: 'center', padding: 12, backgroundColor: '#ddd', marginVertical: 4 }}>
      <Text>{label}</Text>
    </Pressable>
  );
}

export default function Spike() {
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [...l, s]);
  const p = getProvider('local');

  const load = async () => {
    const t = now();
    let last = -1;
    try {
      await p.load(({ loaded, total }) => {
        const pct = Math.floor((loaded / total) * 100);
        if (pct !== last && pct % 5 === 0) add(`download ${(last = pct)}%`);
      });
      add(`load ok, ${now() - t} ms (incl. download)`);
    } catch (e) {
      add(`load FAILED: ${e instanceof Error ? e.message : e}`);
    }
  };

  const run = async () => {
    let ok = 0;
    for (const q of PROMPTS) {
      const t = now();
      try {
        const out = await p.generate({ system: SYSTEM, messages: [{ role: 'user', content: q }], jsonSchema: SCHEMA, maxTokens: 400, temperature: 0.2 });
        const v = valid(out);
        if (v) ok++;
        add(`${v ? 'OK ' : 'BAD'} ${now() - t} ms: ${q}`);
      } catch (e) {
        add(`ERR ${q}: ${e instanceof Error ? e.message : e}`);
      }
    }
    add(`valid JSON ${ok}/${PROMPTS.length}`);
  };

  const photo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.5 });
    const a = r.assets?.[0];
    if (!a?.base64) return;
    const t = now();
    try {
      const out = await p.generate({
        system: SYSTEM,
        messages: [{ role: 'user', content: 'List what you see in the photo.', images: [`data:image/jpeg;base64,${a.base64}`] }],
        jsonSchema: SCHEMA,
        maxTokens: 400,
      });
      add(`photo ${valid(out) ? 'OK' : 'BAD'} ${now() - t} ms: ${out.slice(0, 200)}`);
    } catch (e) {
      add(`photo ERR: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text accessibilityRole="header">Local model spike ({p.status()})</Text>
      <Btn label="1. Download + load" onPress={load} />
      <Btn label="2. Run 5 JSON prompts" onPress={run} />
      <Btn label="3. Photo prompt" onPress={photo} />
      <Btn label="Show tokens/s" onPress={() => add(`tokens/s ${lastTimings.tokensPerSec.toFixed(1)}`)} />
      {log.map((l, i) => (
        <Text key={i}>{l}</Text>
      ))}
    </ScrollView>
  );
}
