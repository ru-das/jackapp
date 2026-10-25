import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { pickImage } from '@/capabilities';
import { Button } from '@/catalog/Button/Button';
import { Card } from '@/catalog/Card/Card';
import { Divider } from '@/catalog/Divider/Divider';
import { Image } from '@/catalog/Image/Image';
import { ImageInput } from '@/catalog/ImageInput/ImageInput';
import { List } from '@/catalog/List/List';
import { DateInput } from '@/catalog/DateInput/DateInput';
import { NumberInput } from '@/catalog/NumberInput/NumberInput';
import { Timer } from '@/catalog/Timer/Timer';
import { Select } from '@/catalog/Select/Select';
import { Stack } from '@/catalog/Stack/Stack';
import { Stat } from '@/catalog/Stat/Stat';
import { Text as TextEl } from '@/catalog/Text/Text';
import { TextInput } from '@/catalog/TextInput/TextInput';
import { Toggle } from '@/catalog/Toggle/Toggle';
import { catalog } from '@/catalog';
import { resolveTemplate, resolveValue, type ValueContext } from '@/spec/values';
import type { Spec } from '@/spec/types';
import { preferredCurrency } from '@/storage/settings';
import { MIN_TARGET, pressed, space, useTheme } from '@/ui/theme';
import type { createActionEngine } from './actions';
import { ElementBoundary } from './ElementBoundary';
import { useStoreState, type Store } from './store';

type Engine = ReturnType<typeof createActionEngine>;
type Props = Record<string, any>; // JSON boundary: every element's props are re-parsed by its catalog schema below.
type Row = Record<string, unknown>;

interface Ctx {
  spec: Spec; store: Store; engine: Engine; base: ValueContext; busy: ReadonlySet<string>;
}

const LOCALE = Intl.DateTimeFormat().resolvedOptions();
const FORMATS = new Set(['number', 'currency', 'percent', 'date', 'ago', 'text']);

function formatStat(value: unknown, format: string, ctx: ValueContext, currency?: string): string {
  const text = String(value ?? '');
  if (!FORMATS.has(format) || format === 'text') return text;
  // `number` and `percent` have no template formatter (the default format rendered blank before); a non-number falls back to its text.
  if (format === 'number' || format === 'percent') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return text;
    try {
      return new Intl.NumberFormat(ctx.locale, format === 'percent' ? { style: 'percent', maximumFractionDigits: 2 } : { maximumFractionDigits: 4 }).format(value);
    } catch { return text; }
  }
  // Reuse the template formatters so Stat and {{x|fmt}} always agree.
  const code = currency && /^[A-Z]{3}$/.test(currency) ? currency : ctx.currency;
  return resolveTemplate(`{{$item.v|${format}}}`, { ...ctx, currency: code, item: { v: value } });
}

type Scope = { item: Row; index: number };

// The body runs inside <Built>, so a throw is caught by this element's own boundary, not its parent's.
function renderElement(id: string, ctx: Ctx, scope?: Scope): ReactNode {
  return <ElementBoundary key={id} id={id}><Built id={id} ctx={ctx} scope={scope} /></ElementBoundary>;
}

function Built({ id, ctx, scope }: { id: string; ctx: Ctx; scope?: Scope }): ReactNode {
  const el = ctx.spec.elements[id];
  const entry = catalog[el.type as keyof typeof catalog];
  // P1 types pass the validator but have no renderer yet (T-55); the boundary shows the friendly card.
  if (!entry) throw new Error(`No renderer for ${el.type}`);
  const p: Props = entry.props.parse(el.props ?? {});
  const vctx: ValueContext = { ...ctx.base, state: ctx.store.getState(), item: scope?.item, index: scope?.index };
  const t = (s: string | undefined) => (s === undefined ? undefined : resolveTemplate(s, vctx));
  const kids = (el.children ?? []).map((c) => renderElement(c, ctx, scope));
  const set = (key: string) => (v: unknown) => ctx.store.setState({ [key]: v });
  const state = vctx.state;

  let node: ReactNode;
  switch (el.type) {
    case 'Stack': node = <Stack {...p as any}>{kids}</Stack>; break;
    case 'Card': node = <Card title={t(p.title)} subtitle={t(p.subtitle)}>{kids}</Card>; break;
    case 'Divider': node = <Divider />; break;
    case 'Text': node = <TextEl value={t(p.value)!} variant={p.variant} />; break;
    case 'Image': {
      const src = resolveValue(p.src, vctx);
      node = <Image src={typeof src === 'string' ? src : null} aspect={p.aspect} alt={p.alt} />;
      break;
    }
    case 'Stat':
      node = <Stat label={t(p.label)!} value={formatStat(resolveValue(p.value, vctx), p.format, vctx, t(p.currency))} />;
      break;
    case 'TextInput':
      node = <TextInput label={p.label} placeholder={p.placeholder} multiline={p.multiline}
        value={String(state[p.bind] ?? '')} onChange={set(p.bind)}
        onSubmit={p.onSubmit ? () => void ctx.engine.run(p.onSubmit) : undefined} />;
      break;
    case 'NumberInput':
      node = <NumberInput label={p.label} min={p.min} max={p.max} step={p.step} mode={p.mode}
        value={Number(state[p.bind] ?? 0)} onChange={set(p.bind)} />;
      break;
    case 'Toggle': node = <Toggle label={p.label} value={state[p.bind] === true} onChange={set(p.bind)} />; break;
    case 'Select':
      node = <Select label={p.label} options={p.options} value={String(state[p.bind] ?? '')} onChange={set(p.bind)} />;
      break;
    case 'ImageInput':
      node = <ImageInput label={p.label} source={p.source}
        value={typeof state[p.bind] === 'string' ? (state[p.bind] as string) : null}
        onPick={(source) => { void pickImage({ source }).then((uri) => { if (uri) set(p.bind)(uri); }).catch((e) => console.warn('pickImage failed', e)); }} />;
      break;
    case 'DateInput':
      node = <DateInput label={p.label} value={typeof state[p.bind] === 'string' ? (state[p.bind] as string) : null} onChange={set(p.bind)} />;
      break;
    case 'Timer': {
      const seconds = resolveValue(p.seconds, vctx);
      node = <Timer label={t(p.label)!} seconds={typeof seconds === 'number' ? seconds : 0}
        onDone={p.onDone ? () => void ctx.engine.run(p.onDone) : undefined} />;
      break;
    }
    case 'List': node = renderList(p, ctx, state); break;
    case 'Button':
      node = <Button label={t(p.label)!} variant={p.variant} busy={ctx.busy.has(p.onPress)}
        onPress={() => void ctx.engine.run(p.onPress, scope)} />;
      break;
  }
  return node;
}

function renderList(p: Props, ctx: Ctx, state: Row) {
  const raw = Array.isArray(state[p.items]) ? (state[p.items] as Row[]) : [];
  const order = raw.map((_, i) => i);
  if (p.sort) {
    const { field, dir } = p.sort as { field: string; dir: 'asc' | 'desc' };
    const sign = dir === 'asc' ? 1 : -1;
    order.sort((a, b) => {
      const x = raw[a][field] as any, y = raw[b][field] as any;
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
  }
  const write = (next: Row[]) => ctx.store.setState({ [p.items]: next });
  const rows = order.map((orig, pos) => {
    const vctx: ValueContext = { ...ctx.base, state, item: raw[orig], index: orig };
    const r = (s?: string) => (s === undefined ? undefined : resolveTemplate(s, vctx));
    return { key: String(pos), title: r(p.title)!, subtitle: r(p.subtitle), trailing: r(p.trailing),
      flag: p.flagField && typeof raw[orig][p.flagField] === 'string' && raw[orig][p.flagField] ? String(raw[orig][p.flagField]) : undefined,
      checked: p.checkField ? raw[orig][p.checkField] === true : undefined };
  });
  return (
    <List
      rows={rows} emptyText={p.emptyText}
      onToggle={p.checkField ? (i) => write(raw.map((it, k) => (k === order[i] ? { ...it, [p.checkField]: !it[p.checkField] } : it))) : undefined}
      onDelete={p.deletable ? (i) => write(raw.filter((_, k) => k !== order[i])) : undefined}
      onPress={p.onItemPress ? (i) => void ctx.engine.run(p.onItemPress, { item: raw[order[i]], index: order[i] }) : undefined}
    />
  );
}

export interface RendererHandle { navigate(screen: string): void }
interface RendererProps {
  spec: Spec; store: Store; engine: Engine;
  /** Receives the navigate function so the run screen can wire it into the engine services. */
  onReady?(handle: RendererHandle): void;
}

export function Renderer({ spec, store, engine, onReady }: RendererProps) {
  const theme = useTheme();
  const [history, setHistory] = useState<string[]>([spec.screens[0].id]);
  const state = useStoreState(store);
  const busySnap = useSyncExternalStore(engine.subscribe, () => busyKey(spec, engine));
  const screenId = history[history.length - 1];
  const screen = spec.screens.find((s) => s.id === screenId) ?? spec.screens[0];

  const navigate = useCallback((to: string) => {
    if (spec.screens.some((s) => s.id === to)) setHistory((h) => (h.includes(to) ? h.slice(0, h.lastIndexOf(to) + 1) : [...h, to]));
  }, [spec]);
  useEffect(() => onReady?.({ navigate }), [onReady, navigate]);

  const base = useMemo<ValueContext>(() => ({
    state, now: new Date(), locale: LOCALE.locale, timeZone: LOCALE.timeZone, currency: preferredCurrency(),
    onWarning: (m) => console.warn(`spec: ${m}`),
  }), [state]);
  const busy = useMemo(() => new Set(busySnap ? busySnap.split(',') : []), [busySnap]);

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {history.length > 1 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" style={(st) => [styles.back, pressed(st)]}
          onPress={() => setHistory((h) => h.slice(0, -1))}>
          <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '600' }}>‹ Back</Text>
        </Pressable>
      ) : null}
      <View style={styles.root}>{renderElement(screen.root, { spec, store, engine, base, busy })}</View>
    </ScrollView>
  );
}

// useSyncExternalStore needs a stable primitive snapshot, so busy ids are joined into one string.
function busyKey(spec: Spec, engine: Engine): string {
  return Object.keys(spec.actions).filter((id) => engine.isBusy(id)).join(',');
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: 64, maxWidth: 640, width: '100%', alignSelf: 'center' },
  root: { gap: space.md },
  back: { minHeight: MIN_TARGET, justifyContent: 'center', marginBottom: space.sm },
});
