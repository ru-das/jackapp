import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LITERT_MODEL } from '@/ai/models';
import { localModel } from '@/ai/providers/litert';
import { confirm } from '@/capabilities';
import { ActionButton } from '@/ui/ActionButton';
import { Card } from '@/ui/Card';
import { space, type, useTheme } from '@/ui/theme';

const gb = (bytes: number) => (bytes / 1e9).toFixed(1);

export function LocalModelCard() {
  const t = useTheme();
  const [downloaded, setDownloaded] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [partial, setPartial] = useState(0);
  const [loaded, setLoaded] = useState(() => localModel.isLoaded());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [abort, setAbort] = useState<AbortController | null>(null);

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
    if (!ok) setError("Couldn't load the model. It will try again when you build.");
    setLoading(false);
  };
  const remove = async () => {
    if (!(await confirm('Delete the downloaded model? You can download it again later.'))) return;
    await localModel.remove();
    setDownloaded(false);
    setLoaded(false);
    setPartial(0);
  };

  const button = (label: string, onPress: () => void, danger = false) => (
    <ActionButton label={label} accessibilityLabel={label} onPress={onPress} kind={danger ? 'danger' : 'primary'} />
  );

  return (
    <Card>
      <Text accessibilityRole="header" style={{ color: t.text, fontSize: type.h, fontWeight: '600' }}>On-device model</Text>
      <Text style={{ color: t.muted, fontSize: type.hint }}>
        {LITERT_MODEL.label}, {gb(LITERT_MODEL.size)} GB. Runs on this phone, so it works offline and has no request limit. Download it once over Wi-Fi.
      </Text>
      {progress ? (
        <View accessibilityRole="progressbar" accessibilityLabel="Downloading model" style={{ gap: space.sm }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: t.accentSoft }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.accent, width: `${Math.min(100, (progress.loaded / progress.total) * 100)}%` }} />
          </View>
          <Text style={{ color: t.muted, fontSize: type.meta }}>{gb(progress.loaded)} of {gb(progress.total)} GB</Text>
          {button('Cancel download', () => abort?.abort(), true)}
        </View>
      ) : downloaded ? (
        <>
          <Text style={{ color: t.text, fontSize: type.body }}>
            {loaded ? 'Downloaded and loaded. Ready offline.' : 'Downloaded. It loads into memory on your first build (10 to 20 seconds).'}
          </Text>
          {loaded ? null : button(loading ? 'Loading…' : 'Load now', () => void (loading || load()))}
          {button('Delete model', () => void remove(), true)}
        </>
      ) : downloaded === false && partial > 0 ? (
        <>
          <Text style={{ color: t.text, fontSize: type.body }}>Paused at {gb(partial)} of {gb(LITERT_MODEL.size)} GB.</Text>
          {button('Resume download', () => void download())}
          {button('Delete model', () => void remove(), true)}
        </>
      ) : downloaded === false ? button(`Download (${gb(LITERT_MODEL.size)} GB)`, () => void download()) : null}
      {downloaded === null ? <Text style={{ color: t.muted, fontSize: type.hint }}>Checking for the model…</Text> : null}
      {error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: type.hint }}>{error}</Text> : null}
    </Card>
  );
}
