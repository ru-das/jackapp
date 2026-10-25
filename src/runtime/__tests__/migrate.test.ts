import { dataAtRisk } from '../migrate';
import type { Spec } from '@/spec/types';

const spec = (state: object) => ({ state }) as unknown as Spec;

describe('dataAtRisk', () => {
  const old = spec({ count: { type: 'number', default: 0 }, items: { type: 'list', of: { title: 'string', amount: 'number' }, default: [] } });
  const saved = { count: 3, items: [{ title: 'a', amount: 2 }] };
  it('keeps same key and type', () => expect(dataAtRisk(old, old, saved)).toEqual([]));
  it('ignores added keys', () => expect(dataAtRisk(old, spec({ ...old.state, extra: { type: 'string', default: '' } }), saved)).toEqual([]));
  it('reports a removed key', () => expect(dataAtRisk(old, spec({ items: old.state.items }), saved)).toEqual(['count']));
  it('reports a changed type', () => expect(dataAtRisk(old, spec({ ...old.state, count: { type: 'string', default: '' } }), saved)).toEqual(['count']));
  it('reports a renamed or retyped row field', () => {
    const next = spec({ count: old.state.count, items: { type: 'list', of: { title: 'string', cost: 'number' }, default: [] } });
    expect(dataAtRisk(old, next, saved)).toEqual(['items.amount']);
  });
  it('ignores empty data', () => expect(dataAtRisk(old, spec({}), { count: 0, items: [] })).toEqual([]));
});
