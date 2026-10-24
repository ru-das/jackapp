// Helpers the recipe builders share. Builders return plain Spec-shaped objects; generateRecipe validates them like any other spec.
export type Obj = Record<string, unknown>;

/** Collects elements into the flat map, naming them `<type><n>` like the line parser does. */
export function tree() {
  const elements: Record<string, Obj> = {};
  const counts: Record<string, number> = {};
  const add = (type: string, props: Obj, children?: string[]) => {
    const n = (counts[type] = (counts[type] ?? 0) + 1);
    const id = `${type[0].toLowerCase()}${type.slice(1)}${n}`;
    elements[id] = { type, props, ...(children ? { children } : {}) };
    return id;
  };
  return { elements, add };
}

export const ref = (path: string) => ({ $ref: path });
export const NOW = { $now: true };

export type Reminder = { kind: 'daily' | 'weekly'; weekday: number; time: string; body: string };

export function reminderTrigger(name: string, reminder: Reminder) {
  return {
    id: 'reminder', type: 'schedule',
    schedule: reminder.kind === 'daily' ? { kind: 'daily', time: reminder.time }
      : { kind: 'weekly', weekday: reminder.weekday, time: reminder.time },
    notify: { title: name, body: reminder.body },
  };
}

export function assemble(meta: { name: string; description: string; icon: string }, state: Obj, root: string,
  elements: Record<string, Obj>, actions: Obj, triggers: Obj[] = []): Obj {
  return {
    specVersion: '0.1', meta, state, screens: [{ id: 'main', title: meta.name, root }], elements, actions,
    ...(triggers.length ? { triggers } : {}),
  };
}
