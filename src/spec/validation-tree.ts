import { own, type ValidationContext } from './validation-context';

export function tree(ctx: ValidationContext) {
  const { elements, screens } = ctx.spec;
  const incoming = new Map<string, number>();
  const edge = (id: string, path: string) => {
    ctx.reference('elements', id, path);
    incoming.set(id, (incoming.get(id) ?? 0) + 1);
  };
  screens.forEach((screen, i) => edge(screen.root, `screens[${i}].root`));
  for (const [id, element] of Object.entries(elements)) {
    element.children?.forEach((child, i) => edge(child, `elements.${id}.children[${i}]`));
  }
  for (const [id, n] of incoming) if (n > 1 && own(elements, id)) {
    ctx.add('TREE', `elements.${id}`, 'Element is reused by multiple roots or child slots.', 'Give each tree position its own element id; each element belongs to exactly one screen.');
  }
  const visited = new Set<string>();
  const active = new Set<string>();
  const cycle = (id: string) => {
    if (!own(elements, id)) return;
    if (active.has(id)) {
      ctx.add('TREE', `elements.${id}`, 'Element graph contains a cycle.', 'Remove the child link back to an ancestor.');
      return;
    }
    if (visited.has(id)) return;
    visited.add(id); active.add(id);
    elements[id].children?.forEach(cycle);
    active.delete(id);
  };
  Object.keys(elements).forEach(cycle);
  const reached = new Set<string>();
  const depthSeen = new Map<string, number>();
  const walk = (id: string, depth: number, ancestors: Set<string>) => {
    if (!own(elements, id) || ancestors.has(id)) return;
    reached.add(id);
    if ((depthSeen.get(id) ?? 0) >= depth) return;
    depthSeen.set(id, depth);
    if (depth > 8) {
      ctx.add('LIMIT_EXCEEDED', `elements.${id}`, 'Element tree is too deep.', 'Maximum depth is 8, counting the screen root as 1.');
      return;
    }
    const next = new Set(ancestors).add(id);
    elements[id].children?.forEach((child) => walk(child, depth + 1, next));
  };
  screens.forEach((screen) => walk(screen.root, 1, new Set()));
  // Reachability is independent of the depth limit, so deeper nodes are not reported as orphans.
  const reachable = (id: string) => {
    if (!own(elements, id) || reached.has(id)) return;
    reached.add(id); elements[id].children?.forEach(reachable);
  };
  [...reached].forEach((id) => elements[id].children?.forEach(reachable));
  for (const id of Object.keys(elements)) if (!reached.has(id)) {
    ctx.add('TREE', `elements.${id}`, 'Element is orphaned.', 'Attach it to exactly one screen tree or remove it.');
  }
}
