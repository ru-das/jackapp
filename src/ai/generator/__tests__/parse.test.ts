import { parseResponse } from '../parse';

test.each([
  ['```json\n{"a":1}\n```', { a: 1 }],
  ['Sure!\n```json\n{"nested":[{"x":3}]}\n```\nDone', { nested: [{ x: 3 }] }],
  ['{"a":1} {"b":2}', { a: 1 }],
  ['The string "{ignore}" precedes {"a":1}', { a: 1 }],
  [JSON.stringify({ text: 'quote " brace } and { slash \\ "', a: { b: [] } }),
    { text: 'quote " brace } and { slash \\ "', a: { b: [] } }],
])('extracts first balanced object: %s', (raw, expected) => {
  expect(parseResponse(raw as string)).toEqual({ raw, value: expected, errors: [] });
});

test.each(['[]', '[{"x":1}]', 'null', 'true', '3', '"text"', '"{}"', '{"a":',
  '{"a":"unfinished}', '{"a":1,}', "{'a':1}", '{"a":[}]', '{bad} {"valid":true}']) (
  'rejects invalid object without altering raw response: %s', (raw) => {
    const result = parseResponse(raw);
    expect(result.raw).toBe(raw);
    expect(result.value).toBeUndefined();
    expect(result.errors).toEqual([expect.objectContaining({ code: 'BAD_JSON', hint: expect.any(String) })]);
  },
);
