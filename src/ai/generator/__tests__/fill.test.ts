import { mockProvider } from '../../providers/mock';
import { fill } from '../fill';
import { repair } from '../repair';
import { h1Plan } from '../prompts';

test('FILL passes the plan and original request with limits and signal, without a JSON Schema', async () => {
  const generate = jest.fn(async () => '{"raw":true}');
  const provider = { ...mockProvider, generate };
  const controller = new AbortController();
  await expect(fill({ prompt: 'groceries', plan: h1Plan, provider, signal: controller.signal })).resolves.toBe('{"raw":true}');
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({
    system: expect.stringContaining('FILL:'),
    temperature: 0.2, stage: 'fill', maxTokens: 4096, signal: controller.signal,
    messages: [{ role: 'user', content: JSON.stringify({ request: 'groceries', plan: h1Plan }) }],
  }));
  expect((generate.mock.calls as unknown[][])[0][0]).not.toHaveProperty('jsonSchema');
});

test('REPAIR forbids refusing unless the broken response was a refusal attempt', async () => {
  const generate = jest.fn(async () => '{}');
  const provider = { ...mockProvider, generate };
  await repair({ prompt: 'groceries', provider, target: 'spec', raw: '{"specVersion":"0.1"', errors: [] });
  await repair({ prompt: 'groceries', provider, target: 'spec', raw: '{"unsupported":{"reason":"x"', errors: [] });
  const systems = (generate.mock.calls as unknown as { system: string }[][]).map(([req]) => req.system);
  expect(systems[0]).toContain('Never return "unsupported"');
  expect(systems[1]).toContain('with no other fields');
});
