import { mockProvider } from '../../providers/mock';
import { fill } from '../fill';
import { h1Plan } from '../prompts';

test('FILL passes the plan and original request with schema, limits and signal', async () => {
  const generate = jest.fn(async () => '{"raw":true}');
  const provider = { ...mockProvider, generate };
  const controller = new AbortController();
  await expect(fill({ prompt: 'groceries', plan: h1Plan, provider, signal: controller.signal })).resolves.toBe('{"raw":true}');
  expect(generate).toHaveBeenCalledWith(expect.objectContaining({
    system: expect.stringContaining('FILL:'), jsonSchema: expect.any(Object),
    temperature: 0.2, maxTokens: 3072, signal: controller.signal,
    messages: [{ role: 'user', content: JSON.stringify({ request: 'groceries', plan: h1Plan }) }],
  }));
});
