import dev from '../../../../../evals/coverage.json';
import holdout from '../../../../../evals/coverage-holdout.json';
import { matchSync, refusalGate } from '../match';

type Row = { id: string; prompt: string; expect: string | string[] };
type Route = 'unsupported' | 'unsure' | string;

/** Keywords and the gate only. "unsure" is what the model classifier (or free-form fallback) decides, so it is neither right nor wrong here. */
function route(prompt: string): Route {
  if (refusalGate(prompt)) return 'unsupported';
  const m = matchSync(prompt);
  return m.id && m.confident ? m.id : 'unsure';
}

export function score(rows: Row[]) {
  const out = { total: rows.length, right: 0, wrong: [] as string[], unsure: [] as string[], falseRefusal: [] as string[] };
  for (const row of rows) {
    const expect = [row.expect].flat();
    const got = route(row.prompt);
    if (got === 'unsure') { out.unsure.push(`${expect.join('|')}: ${row.prompt}`); continue; }
    if (expect.includes(got) || (got === 'unsupported' && expect.includes('none'))) { out.right++; continue; }
    (got === 'unsupported' ? out.falseRefusal : out.wrong).push(`${expect.join('|')} <- ${got}: ${row.prompt}`);
  }
  return out;
}

// Guards, set just under what was measured (dev set 97.5%, hold-out 91.9% at the time): a change to the keyword rules that loses ground fails here.
// The hold-out set was written before any tuning; the dev set was used to tune the rules, so only the hold-out number is a fair estimate.
describe.each([['dev set', dev as Row[], 0.95, 1], ['hold-out set', holdout as Row[], 0.88, 2]] as const)('keyword routing on the %s', (name, rows, minRight, maxWrong) => {
  const s = score([...rows]);
  test('report', () => {
    console.info(`${name}: ${s.total} prompts, ${s.right} routed right (${(100 * s.right / s.total).toFixed(1)}%), ${s.unsure.length} unsure (classifier), `
      + `${s.wrong.length} wrong, ${s.falseRefusal.length} wrongly refused\n` + [...s.wrong, ...s.falseRefusal].map((x) => `  WRONG ${x}`).join('\n') + '\n' + s.unsure.map((x) => `  UNSURE ${x}`).join('\n'));
  });
  test('most prompts are routed right with no model call', () => expect(s.right / s.total).toBeGreaterThanOrEqual(minRight));
  test(`at most ${maxWrong} are routed to the wrong app type`, () => expect(s.wrong.length).toBeLessThanOrEqual(maxWrong));
  test('nothing buildable is refused by the gate', () => expect(s.falseRefusal).toEqual([]));
});
