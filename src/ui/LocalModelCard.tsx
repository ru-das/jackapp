import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Text } from '@/ui/Text';
import { LITERT_MODEL } from '@/ai/models';
import { localModel } from '@/ai/providers/litert';
import { confirm } from '@/capabilities';
import { ActionButton } from '@/ui/ActionButton';
import { useAnnounce } from '@/ui/announce';
import { Card } from '@/ui/Card';
import type { IconName } from '@/ui/Icon';
import { font, space, type, useTheme } from '@/ui/theme';

const gb = (bytes: number) => (bytes / 1e9).toFixed(1);
const percent = ({ loaded, total }: { loaded: number; total: number }) => Math.min(100, Math.round((loaded / total) * 100));

export function LocalModelCard() {
  const t = useTheme();
  const [downloaded, setDownloaded] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [partial, setPartial] = useState(0);
  const [loaded, setLoaded] = useState(() => localModel.isLoaded());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [abort, setAbort] = useState<AbortController | null>(null);
  useAnnounce(error);

  useEffect(() => {
    void localModel.isDownloaded().then(setDownloaded);
    void localModel.partialBytes().then(setPartial);
  }, []);

  const download = async () => {
    setError('');
    setProgress({ loaded: partial, total: LITERT_MODEL.size });
    const controller = new AbortController();
    setAbort(controller);
    try {
      await localModel.download(setProgress, controller.signal);
      setDownloaded(true);
      setPartial(0);
    } catch (e) {
      // A cancel is the user's own choice, so it shows the paused state, not an error.
      if (!controller.signal.aborted) {
        console.error('settings: model download failed', e);
        setError(e instanceof Error ? e.message : 'Download failed. Check your connection and try again.');
      }
      setPartial(await localModel.partialBytes());
    }
    setAbort(null);
    setProgress(null);
  };
  const load = async () => {
    setError('');
    setLoading(true);
    await localModel.warmUp();
    const ok = localModel.isLoaded();
    setLoaded(ok);
    if (!ok) setError("Couldn’t load the model. It will try again when you build.");
    setLoading(false);
  };
  const remove = async () => {
    if (!(await confirm('You can download it again later.', { title: 'Delete the downloaded model?', confirmLabel: 'Delete model', destructive: true }))) return;
    await localModel.remove();
    setDownloaded(false);
    setLoaded(false);
    setPartial(0);
  };

  const button = (label: string, icon: IconName, onPress: () => void, danger = false) => (
    <ActionButton icon={icon} label={label} accessibilityLabel={label} onPress={onPress} kind={danger ? 'danger' : 'primary'} />
  );

  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: type.h, fontFamily: font.display }}>On-device model</Text>
      <Text style={{ color: t.muted, fontSize: type.hint }}>
        {LITERT_MODEL.label}, {gb(LITERT_MODEL.size)} GB. Runs on this phone, so it works offline and has no request limit. Download it once over Wi-Fi.
      </Text>
      {progress ? (
        <View style={{ gap: space.sm }}>
          <View
            accessible accessibilityRole="progressbar" accessibilityLabel="Downloading model"
            accessibilityValue={{ min: 0, max: 100, now: percent(progress), text: `${gb(progress.loaded)} of ${gb(progress.total)} GB` }}
            style={{ height: 8, borderRadius: 4, backgroundColor: t.accentSoft }}
          >
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.accent, width: `${percent(progress)}%` }} />
          </View>
          <Text style={{ color: t.muted, fontSize: type.meta }}>{gb(progress.loaded)} of {gb(progress.total)} GB</Text>
          {button('Cancel download', 'close', () => abort?.abort(), true)}
        </View>
      ) : downloaded ? (
        <>
          <Text style={{ color: t.text, fontSize: type.body }}>
            {loaded ? 'Downloaded and loaded. Ready offline.' : 'Downloaded. It loads into memory on your first build (10 to 20 seconds).'}
          </Text>
          {loaded ? null : button(loading ? 'Loading…' : 'Load now', 'flash-outline', () => void (loading || load()))}
          {button('Delete model', 'trash-outline', () => void remove(), true)}
        </>
      ) : downloaded === false && partial > 0 ? (
        <>
          <Text style={{ color: t.text, fontSize: type.body }}>Paused at {gb(partial)} of {gb(LITERT_MODEL.size)} GB.</Text>
          {button('Resume download', 'play', () => void download())}
          {button('Delete model', 'trash-outline', () => void remove(), true)}
        </>
      ) : downloaded === false ? button(`Download (${gb(LITERT_MODEL.size)} GB)`, 'cloud-download-outline', () => void download()) : null}
      {downloaded === null ? <Text style={{ color: t.muted, fontSize: type.hint }}>Checking for the model…</Text> : null}
      {error ? <Text style={{ color: t.danger, fontSize: type.hint }}>{error}</Text> : null}
    </Card>
  );
}
