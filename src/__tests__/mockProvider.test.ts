import { mockProvider } from '@/ai/providers/mock';
import { generate } from '@/ai/generator/generate';

test.each([
  ['Take a photo of my fridge and make me a grocery list', 'Fridge Snap'],
  ['Track which of my plants I watered', 'Plant Pal'],
  ['Photo of a restaurant bill → split it between friends', 'Bill Splitter'],
])('mock builds %s', async (prompt, name) => {
  const r = await generate({ prompt, provider: mockProvider, model: 'E2B' });
  expect(r.status).toBe('done');
  if (r.status === 'done') expect(r.spec.meta.name).toBe(name);
});

test('mock refuses a physics simulator with a suggestion', async () => {
  const r = await generate({ prompt: 'Build me a physics simulator', provider: mockProvider, model: 'E2B' });
  expect(r.status).toBe('unsupported');
  if (r.status === 'unsupported') expect(r.unsupported.suggestion).toMatch(/projectile/);
});

test('mock fills a list schema with three rows', async () => {
  const schema = { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, qty: { type: 'number' } } } } } };
  const out = JSON.parse(await mockProvider.generate({ system: '', messages: [], jsonSchema: schema }));
  expect(out.items.map((r: { name: string }) => r.name)).toEqual(['Milk', 'Eggs', 'Butter']);
});
