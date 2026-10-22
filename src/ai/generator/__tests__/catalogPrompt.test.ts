import { catalog } from '@/catalog';
import { ActionStepSchema } from '@/spec/schema';
import { buildCatalogPrompt } from '../catalogPrompt';

test('catalog contains every registered hint, prop and children policy', () => {
  const { text, chars, estimatedTokens } = buildCatalogPrompt();
  for (const { props, meta } of Object.values(catalog)) {
    expect(text).toContain(`${meta.name}: ${meta.hint}`);
    const line = text.split('\n').find((line) => line.startsWith(`${meta.name}:`))!;
    expect(line).toContain(`children:${meta.children ? 'yes' : 'no'}`);
    for (const key of Object.keys(props.shape)) expect(line).toContain(key);
  }
  expect(text).toContain('bind!:Id');
  expect(text).toContain('direction?:"vertical"|"horizontal"');
  expect(text).toContain('sort?:{field!:Id,dir!:"asc"|"desc"}');
  expect(text).toContain('deletable?:boolean=false');
  expect(text).toContain('value!:Value');
  expect(text).toContain('step?:number=1');
  expect(text).not.toContain('__schema');
  expect(chars).toBe(text.length);
  expect(estimatedTokens).toBe(chars / 4);
  expect(chars).toBeLessThan(10000);
  console.info(`Catalog: ${chars} chars, ~${estimatedTokens} tokens (chars/4)`);
});

test('all ops and documented Value forms, paths and formatters are included', () => {
  const { text } = buildCatalogPrompt();
  for (const option of ActionStepSchema.options) {
    expect(text).toContain(`op!:"${option.shape.op.value}"`);
    for (const key of Object.keys(option.shape)) expect(text).toContain(key);
  }
  for (const token of ['$ref', '$agg', '$math', '$now', '$item.<field>', '$index',
    'count', 'sum', 'avg', 'min', 'max', 'date,time,ago,upper,lower,currency,fixed2']) {
    expect(text).toContain(token);
  }
});
