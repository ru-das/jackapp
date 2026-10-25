import { toCsv } from '../export';
import type { Spec } from '@/spec/types';

const spec = {
  state: {
    items: { type: 'list', of: { name: 'string', amount: 'number', done: 'boolean' }, default: [], persist: true },
    draft: { type: 'string', default: '', persist: false },
    photo: { type: 'image', default: null, persist: true },
    currency: { type: 'string', default: 'USD', persist: true },
  },
} as unknown as Spec;

test('lists become header + rows; drafts and images are left out', () => {
  const csv = toCsv(spec, { items: [{ name: 'Tea', amount: 3, done: false }], draft: 'x', photo: 'data:image/png;base64,AA', currency: 'EUR' });
  expect(csv).toBe('Items\nName,Amount,Done\nTea,3,no\n\nOther values\nName,Value\nCurrency,EUR');
});

test('quotes commas, quotes and newlines', () => {
  const csv = toCsv(spec, { items: [{ name: 'a, "b"\nc', amount: 1, done: true }], currency: 'USD' });
  expect(csv).toContain('"a, ""b""\nc",1,yes');
});

test('text that looks like a formula gets a quote prefix; numbers stay numbers', () => {
  const csv = toCsv(spec, { items: [{ name: '=HYPERLINK("x")', amount: -5, done: false }, { name: '@a', amount: 0, done: false }], currency: 'USD' });
  expect(csv).toContain(`"'=HYPERLINK(""x"")",-5,no`);
  expect(csv).toContain("'@a,0,no");
});
