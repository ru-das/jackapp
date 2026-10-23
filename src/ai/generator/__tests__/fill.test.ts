import { mockProvider } from '../../providers/mock';
import { fill } from '../fill';
import { h1Plan } from '../prompts';

test('FILL passes the plan and original request with limits and signal, without a JSON Schema', async () => {
  const generate = jest.fn(async () => '{"raw":true}');
  const provider = { ...mockProvider, generate };
  const controller = new AbortController();
  await expect(fill({ prompt: 'groceries', plan: h1Plan, provider, signal: controller.signal })).resolves.toBe('{"raw":true}');
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({
    system: expect.stringContaining('FILL:'),
    temperature: 0.2, maxTokens: 4096, signal: controller.signal,
    messages: [{ role: 'user', content: JSON.stringify({ request: 'groceries', plan: h1Plan }) }],
  }));
  expect((generate.mock.calls as unknown[][])[0][0]).not.toHaveProperty('jsonSchema');
});
