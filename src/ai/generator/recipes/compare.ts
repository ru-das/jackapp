import { assemble, ref, tree, type Obj } from './kit';

export const STAPLES = ['Milk', 'Eggs', 'Bread', 'Butter', 'Cheese', 'Yoghurt', 'Fruit', 'Vegetables'];

/**
 * Photo → what is visible (user-corrected) → compared with an editable staples list → shopping list.
 * "I can see this" and "you may want to buy this" stay on separate cards, and the list says it is not proof the fridge lacks an item.
 */
export function buildCompare(c: { name: string; icon: string; description: string; usual: string[]; button: string; share: boolean }): Obj {
  const t = tree();
  const adder = (bind: string, label: string, action: string) => [
    t.add('TextInput', { bind, label, onSubmit: action }), t.add('Button', { label: 'Add', onPress: action, variant: 'secondary' })];
  const seen = t.add('Card', { title: '1. What I can see' }, [
    t.add('ImageInput', { bind: 'photo', label: 'Fridge photo' }),
    t.add('Button', { label: 'Look at the photo', onPress: 'look', variant: 'primary' }),
    t.add('Text', { value: 'Only items clearly visible. Remove wrong ones and add what I missed.', variant: 'muted' }),
    t.add('List', { items: 'seen', title: '{{$item.name}}', deletable: true, emptyText: 'Nothing read yet' }),
    ...adder('newSeen', 'Something I missed', 'addSeen')]);
  const staples = t.add('Card', { title: '2. What you usually keep' }, [
    t.add('List', { items: 'staples', title: '{{$item.name}}', deletable: true, emptyText: 'Add the things you always buy' }),
    ...adder('newStaple', 'Add a usual item', 'addStaple')]);
  const list = t.add('Card', { title: '3. Shopping list' }, [
    t.add('Button', { label: c.button, onPress: 'makeList', variant: 'primary' }),
    t.add('Text', { value: 'Usual items not seen in the photo. Food can hide at the back, so check before you buy.', variant: 'muted' }),
    t.add('List', { items: 'items', title: '{{$item.name}}', checkField: 'done', deletable: true, emptyText: 'Your list will appear here' }),
    t.add('Button', { label: 'Clear bought', onPress: 'clearDone', variant: 'secondary' }),
    ...(c.share ? [t.add('Button', { label: 'Share', onPress: 'share', variant: 'secondary' })] : [])]);
  const root = t.add('Stack', { gap: 'md' }, [seen, staples, list]);
  const one = { name: 'string' };
  const append = (path: string, draft: string) => ({ steps: [{ op: 'state.append', path, value: { name: ref(draft) } }, { op: 'state.reset', path: draft }] });
  return assemble({ name: c.name, description: c.description, icon: c.icon }, {
    photo: { type: 'image', default: null, persist: false },
    seen: { type: 'list', of: one, default: [] },
    staples: { type: 'list', of: one, default: c.usual.map((name) => ({ name })) },
    items: { type: 'list', of: { name: 'string', done: 'boolean' }, default: [] },
    newSeen: { type: 'string', default: '', persist: false }, newStaple: { type: 'string', default: '', persist: false },
  }, root, t.elements, {
    look: { steps: [{ op: 'ai.run', image: ref('photo'), into: 'seen', output: { type: 'list', of: one },
      prompt: 'List the food and drink items you can clearly see in this photo of a fridge. Short names. Do not guess items that are hidden or unclear.' },
    { op: 'toast', message: '{{seen|count}} items seen. Check the list.' }] },
    addSeen: append('seen', 'newSeen'), addStaple: append('staples', 'newStaple'),
    makeList: { steps: [{ op: 'state.diff', path: 'items', from: 'staples', without: 'seen', field: 'name' }, { op: 'toast', message: '{{items|count}} usual items not seen' }] },
    clearDone: { steps: [{ op: 'state.remove', path: 'items', where: { field: 'done', equals: true } }] },
    ...(c.share ? { share: { steps: [{ op: 'share', text: `${c.name}: to buy\n{{items|lines}}` }] } } : {}),
  });
}
