import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveTemplate, resolveValue } from '../values';
import type { ValueContext } from '../values';
import type { Value } from '../types';

const now = new Date('2026-10-22T12:00:00Z');
const items = [{ name: 'Milk', price: 40, done: false }, { name: 'Eggs', price: 60, done: true }];
const context: ValueContext = {
  state: { items, people: 2, name: 'Milk', since: '2026-10-19T12:00:00Z', nil: null },
  now, locale: 'en-US', timeZone: 'UTC', currency: 'USD',
};
const sum: Value = { $agg: { op: 'sum', of: 'items', field: 'price' } };

describe('value resolution', () => {
  test.each<[Value, unknown]>([
    ['Hello', 'Hello'], [3, 3], [true, true], [false, false],
    ['{{items|count}} items', '2 items'], [sum, 100],
    [{ $agg: { op: 'count', of: 'items', where: { field: 'done', equals: false } } }, 1],
    [{ $math: ['/', sum, { $ref: 'people' }] }, 50],
    [{ $ref: 'nil' }, null], [{ $ref: 'missing' }, undefined], [{ $now: true }, '2026-10-22T12:00:00.000Z'],
  ])('literal / AT-02 / expression %j', (value, expected) => expect(resolveValue(value, context)).toEqual(expected));
  test('AT-02 division by zero warns exactly once', () => {
    const onWarning = jest.fn();
    expect(resolveValue({ $math: ['/', sum, 0] }, { ...context, onWarning })).toBe(0);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onWarning).toHaveBeenCalledWith('Division by zero.');
  });
  test.each<[Value, number]>([
    [{ $math: ['+', 2, 3] }, 5], [{ $math: ['-', 2, 3] }, -1], [{ $math: ['*', 2, 3] }, 6],
    [{ $math: ['/', 9, 2] }, 4.5], [{ $math: ['round', 12.345, 2] }, 12.35],
    [{ $math: ['round', 123, -1] }, 120], [{ $math: ['round', -1.6, 0] }, -2],
    [{ $math: ['+', { $math: ['*', 2, 3] }, 4] }, 10],
  ])('math %j', (value, expected) => expect(resolveValue(value, context)).toBe(expected));
  test.each<[Value, number]>([
    [{ $math: ['pow', 2, 10] }, 1024], [{ $math: ['pow', 9, 0.5] }, 3], [{ $math: ['pow', 2, -1] }, 0.5],
    [{ $math: ['min', 4, 2] }, 2], [{ $math: ['max', 4, 2] }, 4],
    [{ $math: ['days', '2026-10-01', '2026-10-25'] }, 24], [{ $math: ['days', '2026-10-25', '2026-10-01'] }, -24],
    [{ $math: ['days', '2026-10-19T23:59:00Z', '2026-10-20T00:01:00Z'] }, 1], [{ $math: ['days', { $ref: 'since' }, { $now: true }] }, 3],
    [{ $math: ['days', '2024-02-28', '2024-03-01'] }, 2],
  ])('more math %j', (value, expected) => expect(resolveValue(value, context)).toBe(expected));
  test.each<Value>([
    { $math: ['pow', -8, 0.5] }, { $math: ['pow', 10, 400] }, { $math: ['days', 'soon', '2026-10-25'] }, { $math: ['days', '2026-10-25', 5] },
    { $math: ['days', { $ref: 'nil' }, '2026-10-25'] },
  ])('invalid pow or days warns and returns zero %j', (value) => {
    const onWarning = jest.fn();
    expect(resolveValue(value, { ...context, onWarning })).toBe(0);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
  test.each<Value>([
    { $math: ['+', '2', 3] }, { $math: ['*', true, 3] }, { $math: ['-', { $ref: 'missing' }, 1] },
    { $math: ['/', { $ref: 'nil' }, 1] }, { $math: ['+', { $ref: 'bad' }, 1] },
    { $math: ['*', Number.MAX_VALUE, 2] }, { $math: ['round', 1, 400] },
    { $math: ['round', 1, -400] }, { $math: ['round', 1, 1.5] },
  ])('invalid math warns and returns zero %j', (value) => {
    const onWarning = jest.fn();
    expect(resolveValue(value, { ...context, state: { ...context.state, bad: Infinity }, onWarning })).toBe(0);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
  test.each(['count', 'sum', 'avg', 'min', 'max'] as const)('aggregate %s and empty lists', (op) => {
    const value: Value = op === 'count' ? { $agg: { op, of: 'items' } } : { $agg: { op, of: 'items', field: 'price' } };
    expect(resolveValue(value, context)).toBe({ count: 2, sum: 100, avg: 50, min: 40, max: 60 }[op]);
    const onWarning = jest.fn();
    expect(resolveValue(value, { ...context, state: { items: [] }, onWarning })).toBe(0);
    expect(onWarning).not.toHaveBeenCalled();
    expect(resolveValue({ $agg: { ...value.$agg, where: { field: 'name', equals: 'absent' } } }, context)).toBe(0);
  });
  test('aggregates filter with strict equality and keep negative numbers', () => {
    expect(resolveValue({ $agg: { op: 'count', of: 'items', where: { field: 'done', equals: 0 } } }, context)).toBe(0);
    expect(resolveValue({ $agg: { op: 'sum', of: 'items', field: 'price', where: { field: 'done', equals: true } } }, context)).toBe(60);
    const ctx = { ...context, state: { items: [{ price: -4 }, { price: -2 }] } };
    expect(resolveValue({ $agg: { op: 'max', of: 'items', field: 'price' } }, ctx)).toBe(-2);
  });
  test.each([null, {}, 2, 'items', [{ price: '40' }], [{}], [{ price: Infinity }], [{ price: NaN }], [{ price: null }], [{ price: Number.MAX_VALUE }, { price: Number.MAX_VALUE }]])('invalid aggregate %j', (list) => {
    const onWarning = jest.fn();
    expect(resolveValue(sum, { ...context, state: { items: list }, onWarning })).toBe(0);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
  test('item / index context and absent context', () => {
    const ctx = { ...context, item: items[1], index: 1 };
    expect(resolveValue({ $ref: '$item.name' }, ctx)).toBe('Eggs');
    expect(resolveValue({ $ref: '$index' }, ctx)).toBe(1);
    expect(resolveTemplate('{{$index}}: {{$item.name}}', ctx)).toBe('1: Eggs');
    expect(resolveTemplate('{{$index}}{{$item.name}}', context)).toBe('');
  });
  test('only own properties, with no dotted traversal', () => {
    const inherited: Record<string, unknown> = Object.create({ secret: 'hidden' });
    inherited.items = [Object.create({ price: 10, done: true })];
    const ctx = { ...context, state: inherited, item: Object.create({ name: 'hidden' }) };
    for (const path of ['secret', 'constructor', '__proto__', 'items.0.price', '$item.name', '$item.constructor', '$item.name.length']) {
      expect(resolveValue({ $ref: path }, ctx)).toBeUndefined();
    }
    expect(resolveValue({ $agg: { op: 'count', of: 'items', where: { field: 'done', equals: true } } }, ctx)).toBe(0);
    const onWarning = jest.fn();
    expect(resolveValue(sum, { ...ctx, onWarning })).toBe(0);
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
  test('templates escape once and never evaluate substituted text', () => {
    const ctx = { ...context, state: { ...context.state, text: '{{people}}' } };
    expect(resolveTemplate('\\{{people}} {{people}} \\{{name|upper}}', ctx)).toBe('{{people}} 2 {{name|upper}}');
    expect(resolveTemplate('{{text}}', ctx)).toBe('{{people}}');
    expect(resolveValue({ $ref: 'text' }, ctx)).toBe('{{people}}');
    expect(resolveTemplate('{{people}}/{{people}}', ctx)).toBe('2/2');
    expect(resolveTemplate('{{nil}}/{{missing}}/{{people.unknown}}', ctx)).toBe('//');
  });
  test('template HTML is plain text', () => {
    const html = '<img src=x onerror="alert(1)">';
    expect(resolveTemplate('<b>{{html}}</b>', { ...context, state: { html } })).toBe(`<b>${html}</b>`);
  });
  test.each([
    ['{{name|upper}}', 'MILK'], ['{{name|lower}}', 'milk'], ['{{items|count}}', '2'],
    ['{{people|fixed2}}', '2.00'], ['{{people|currency}}', '$2.00'],
    ['{{since|date}}', 'Oct 19, 2026'], ['{{since|time}}', '12:00 PM'], ['{{since|ago}}', '3 days ago'],
  ])('formatter %s', (template, expected) => expect(resolveTemplate(template, context)).toBe(expected));
  test('locale, time zone and currency are injected', () => {
    expect(resolveTemplate('{{since|time}}', { ...context, timeZone: 'Asia/Kolkata' })).toBe('5:30 PM');
    expect(resolveTemplate('{{since|date}}', { ...context, state: { since: '2026-10-22T01:00:00Z' }, timeZone: 'America/Los_Angeles' })).toBe('Oct 21, 2026');
    expect(resolveTemplate('{{people|currency}}', { ...context, locale: 'de-DE', currency: 'EUR' })).toBe('2,00 €');
    expect(resolveTemplate('{{people|currency}}', { ...context, currency: 'JPY' })).toBe('¥2.00');
    expect(resolveTemplate('{{name|upper}}', { ...context, locale: 'tr', state: { name: 'milk' } })).toBe('MİLK');
  });
  test.each([
    [0, 'in 0 seconds'], [-59.9, '59 seconds ago'], [-60, '1 minute ago'], [-3599, '59 minutes ago'],
    [-3600, '1 hour ago'], [-86399, '23 hours ago'], [-86400, '1 day ago'],
    [-29 * 86400, '29 days ago'], [-30 * 86400, '1 month ago'], [-364 * 86400, '12 months ago'],
    [-365 * 86400, '1 year ago'], [90, 'in 1 minute'],
  ])('ago uses whole units at %s seconds', (seconds, expected) => {
    const ctx = { ...context, state: { date: new Date(now.getTime() + Number(seconds) * 1000).toISOString() } };
    expect(resolveTemplate('{{date|ago}}', ctx)).toBe(expected);
  });
  test('ago is localized', () => expect(resolveTemplate('{{since|ago}}', { ...context, locale: 'fr-FR' })).toBe('il y a 3 jours'));
  test.each([
    ['{{v|upper}}', 2], ['{{v|lower}}', true], ['{{v|fixed2}}', '2'], ['{{v|currency}}', NaN],
    ['{{v|count}}', {}], ['{{v|date}}', 'bad date'], ['{{v|date}}', '2026-02-30'],
    ['{{v|time}}', 123], ['{{v|ago}}', false], ['{{v}}', []], ['{{v}}', {}], ['{{v}}', Infinity],
    ['{{v|unknown}}', 'x'], ['{{v|upper|lower}}', 'x'],
  ])('invalid formatting %s / %j warns', (template, value) => {
    const onWarning = jest.fn();
    expect(resolveTemplate(template, { ...context, state: { v: value }, onWarning })).toBe('');
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
  test.each([
    ['{{people|currency}}', { currency: undefined }], ['{{people|currency}}', { currency: 'invalid' }],
    ['{{since|date}}', { timeZone: 'invalid' }], ['{{since|time}}', { locale: '_' }],
    ['{{since|ago}}', { now: new Date('invalid') }],
  ])('invalid Intl/context settings %s', (template, settings) => {
    const onWarning = jest.fn();
    expect(resolveTemplate(template, { ...context, ...settings, onWarning })).toBe('');
    expect(onWarning).toHaveBeenCalledTimes(1);
  });
  test('null and missing substitutions are empty with all formatters', () => {
    const onWarning = jest.fn();
    for (const formatter of ['count', 'date', 'time', 'ago', 'upper', 'lower', 'currency', 'fixed2']) {
      expect(resolveTemplate(`{{nil|${formatter}}}{{missing|${formatter}}}`, { ...context, onWarning })).toBe('');
    }
    expect(onWarning).not.toHaveBeenCalled();
  });
  test('no implicit clock reads, no state or list mutation', () => {
    const state = Object.freeze({ items: Object.freeze(items.map((item) => Object.freeze({ ...item }))), people: 2 });
    const ctx = { ...context, state };
    const before = JSON.stringify(state);
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => { throw new Error('Implicit clock read'); });
    try {
      expect(resolveValue({ $now: true }, ctx)).toBe(now.toISOString());
      expect(resolveValue(sum, ctx)).toBe(100);
      expect(resolveValue({ $ref: 'items' }, ctx)).toBe(state.items);
      expect(resolveTemplate('{{since|ago}}', context)).toBe('3 days ago');
    } finally { clock.mockRestore(); }
    expect(JSON.stringify(state)).toBe(before);
    expect(now.toISOString()).toBe('2026-10-22T12:00:00.000Z');
  });
  test('spec production modules have no React/platform imports or dynamic execution', () => {
    for (const file of ['schema.ts', 'types.ts', 'values.ts', 'validate.ts']) {
      const source = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(source).not.toMatch(/from\s+['"](?:react(?:-native)?|expo[^'"]*)['"]/);
      expect(source).not.toMatch(/\beval\s*\(|new\s+Function\s*\(|\bimport\s*\(/);
    }
  });
});
