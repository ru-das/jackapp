import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LITERT_MODEL } from '@/ai/models';
import { localModel } from '@/ai/providers/litert';
import { confirm } from '@/capabilities';
import { MIN_TARGET, radius, space, useTheme } from '@/ui/theme';

const gb = (bytes: number) => (bytes / 1e9).toFixed(1);

export function LocalModelCard({ style }: { style: object }) {
  const t = useTheme();
  const [downloaded, setDownloaded] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { void localModel.isDownloaded().then(setDownloaded); }, []);

  const download = async () => {
    setError('');
    setProgress({ loaded: 0, total: LITERT_MODEL.size });
    try {
      await localModel.download(setProgress);
      setDownloaded(true);
    } catch (e) {
      console.error('settings: model download failed', e);
      setError(e instanceof Error ? e.message : 'Download failed. Check your connection and try again.');
    }
    setProgress(null);
  };
  const remove = async () => {
    if (!(await confirm('Delete the downloaded model? You can download it again later.'))) return;
    await localModel.remove();
    setDownloaded(false);
  };

  const button = (label: string, onPress: () => void, danger = false) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ minHeight: MIN_TARGET, justifyContent: 'center', alignItems: 'center', borderRadius: radius.control, paddingHorizontal: space.md, backgroundColor: danger ? 'transparent' : t.accent, borderWidth: danger ? 1 : 0, borderColor: t.danger }}
    >
      <Text style={{ color: danger ? t.danger : t.accentText, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={style}>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: 19, fontWeight: '600' }}>On-device model</Text>
      <Text style={{ color: t.muted, fontSize: 15 }}>
        {LITERT_MODEL.label}, {gb(LITERT_MODEL.size)} GB. Runs on this phone, so it works offline and has no request limit. Download it once over Wi-Fi.
      </Text>
      {progress ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Downloading model">
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.accentSoft }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.accent, width: `${Math.min(100, (progress.loaded / progress.total) * 100)}%` }} />
          </View>
          <Text style={{ color: t.muted, fontSize: 14 }}>{gb(progress.loaded)} of {gb(progress.total)} GB</Text>
        </View>
      ) : downloaded ? (
        <>
          <Text style={{ color: t.text, fontSize: 16 }}>Ready on this phone.</Text>
          {button('Delete model', () => void remove(), true)}
        </>
      ) : downloaded === false ? button(`Download (${gb(LITERT_MODEL.size)} GB)`, () => void download()) : null}
      {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 15 }}>{error}</Text> : null}
    </View>
  );
}
