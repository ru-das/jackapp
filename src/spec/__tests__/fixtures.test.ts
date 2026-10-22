import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { h1, h2, h3, invalidFixtures, validFixtures } from '../fixtures';
import { SpecSchema } from '../schema';

const contract = readFileSync(join(__dirname, '../../../docs/SCHEMA.md'), 'utf8');
test('H1 is exactly the documented raw JSON, without parser defaults', () => {
  const json = contract.split('## 13.')[1].match(/```json\n([\s\S]*?)\n```/)![1];
  expect(h1).toEqual(JSON.parse(json));
  expect(h1.state.notes).not.toHaveProperty('persist');
});
test.each(Object.entries(validFixtures))('%s is structurally valid', (_, input) => {
  expect(SpecSchema.safeParse(input).success).toBe(true);
});
test('H2 preserves the timestamp action, List context and Sunday trigger', () => {
  expect(h2.actions.waterOne.steps).toEqual([
    { op: 'state.update', path: 'plants', index: { $ref: '$index' }, set: { lastWatered: { $now: true } } },
    { op: 'state.set', path: 'lastWatered', value: { $now: true } },
  ]);
  expect(h2.elements.plantsList.props).toMatchObject({ subtitle: 'Watered {{$item.lastWatered|ago}}', onItemPress: 'waterOne' });
  expect(h2.triggers).toEqual([{ id: 'sunday', type: 'schedule', schedule: { kind: 'weekly', weekday: 0, time: '09:00' },
    notify: { title: 'Plant Pal 🌱', body: 'Sunday watering time!' } }]);
  expect(h2.actions.addPlant.steps).toEqual([
    { op: 'state.append', path: 'plants', value: { name: { $ref: 'newPlant' }, lastWatered: { $now: true } } },
    { op: 'state.set', path: 'newPlant', value: '' },
  ]);
});
test('H3 preserves the exact computed split and receipt workflow', () => {
  expect(h3.elements.eachPays).toEqual({ type: 'Stat', props: { label: 'Each person pays',
    value: { $math: ['round', { $math: ['/', { $agg: { op: 'sum', of: 'lines', field: 'price' } }, { $ref: 'people' }] }, 2] }, format: 'currency' } });
  expect(h3.elements.peopleIn.props.min).toBe(1);
  expect(h3.actions.readBill.steps[0]).toMatchObject({ op: 'ai.run', image: { $ref: 'bill' },
    output: { type: 'list', of: { name: 'string', price: 'number' } }, into: 'lines' });
});
test('invalid fixtures cover every documented code', () => {
  expect(Object.keys(invalidFixtures).length).toBeGreaterThanOrEqual(12);
  const codes = [...contract.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((match) => match[1]);
  expect([...new Set(Object.values(invalidFixtures).map((fixture) => fixture.expected.code))].sort()).toEqual(codes.sort());
});
