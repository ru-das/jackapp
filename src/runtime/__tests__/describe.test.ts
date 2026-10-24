import { RECIPES } from '@/ai/generator/recipes';
import { readSettings } from '@/ai/generator/recipes/settings';
import type { Spec } from '@/spec/types';
import { describeSpec, omissions } from '../describe';

const make = (id: keyof typeof RECIPES, reply: string, request: string, notes: string[] = []) =>
  RECIPES[id].make(readSettings(reply), request, notes) as unknown as Spec;

test('a log describes its fields, taps and reminder from the spec', () => {
  const spec = make('log', 'field plant text Plant\nfield watered date Watered\ntap date watered\nreminder weekly 0 09:00 Water', 'Plant tracker');
  expect(describeSpec(spec)).toBe('Keeps a list with Plant and Watered. Tap an item to record the date. You enter Plant. Reminds you every Sunday at 09:00.');
});

test('a calculator lists its inputs and results', () => {
  const spec = make('calculator', 'input bill money Bill 80\ninput tip percent Tip 15\noutput Tip = bill * tip / 100 as money', 'Tip calculator');
  expect(describeSpec(spec)).toBe('You enter Bill and Tip (%). Shows Tip.');
});

test('a timer states its length', () => {
  expect(describeSpec(make('timer', 'minutes 25', 'Pomodoro'))).toContain('Counts down 25 min.');
});

describe('omissions', () => {
  const counter = make('counter', 'noun glasses', 'Count water');
  test('names what the request asked for and the spec lacks', () => {
    expect(omissions('count water and remind me with a chart of photos', counter))
      .toEqual(['Reminders aren’t in this app.', 'Photos aren’t in this app.', 'Charts aren’t available in this build.']);
  });
  test('stays quiet when it is there', () => {
    const log = make('log', 'reminder daily 08:00 Go', 'Log and remind me');
    expect(omissions('Log and remind me', log)).toEqual([]);
    expect(omissions('Count water', counter)).toEqual([]);
  });
});

describe('recipes report lost intent, not defaults', () => {
  test('a bad formula, a total with no number field and a missing icon', () => {
    const notes: string[] = [];
    make('calculator', 'input a number A 1\noutput Good = a * 2\noutput Bad = a * * 2', 'Calc', notes);
    expect(notes).toEqual(['Left out “Bad”: couldn’t read its formula.']);
    const logNotes: string[] = [];
    make('log', 'field name text Name\ntotal sum price Spent', 'List', logNotes);
    expect(logNotes).toHaveLength(1);
    const quiet: string[] = [];
    make('counter', 'noun glasses', 'Count', quiet);
    make('timer', 'name Tea\nminutes 3', 'Tea', quiet);
    expect(quiet).toEqual([]);
  });
  test('no timer length is reported', () => {
    const notes: string[] = [];
    make('timer', 'name Tea', 'Tea', notes);
    expect(notes[0]).toMatch(/5 minutes/);
  });
});
