import corpus from '../../../../../evals/prompts.json';
import { matchSync, NO_MATCH, refusalGate } from '../match';
import type { RecipeId } from '../types';

// Expected app type per buildable corpus prompt. The keyword rules were tuned with these in view, so this table proves "no regression",
// not generalisation: the held-out table below was written separately.
const corpusExpect: Record<string, RecipeId> = {
  e01: 'ai-list', e02: 'ai-list', e03: 'ai-list', e04: 'ai-list', e05: 'log', e06: 'log', e07: 'log',
  e08: 'splitter', e09: 'splitter', e10: 'splitter', e11: 'log', e12: 'log', e13: 'log', e14: 'counter', e15: 'log', e16: 'log',
  e17: 'log', e18: 'log', e19: 'log', e20: 'log', e21: 'ai-list', e22: 'log', e23: 'log', e24: 'log', e25: 'log',
};

test.each(corpus.filter((row) => row.expect === 'spec'))('corpus $id → its app type', ({ id, prompt }) => {
  expect(refusalGate(prompt)).toBeUndefined();
  expect(matchSync(prompt).id).toBe(corpusExpect[id]);
});

test.each(corpus.filter((row) => row.expect === 'unsupported'))('corpus $id is refused by the gate', ({ prompt }) => {
  expect(refusalGate(prompt)).toEqual({ reason: expect.any(String), missing: expect.any(Array), suggestion: expect.any(String) });
});

const heldOut: [string, RecipeId][] = [
  ['Keep track of books I want to read and mark them when finished', 'log'],
  ['Workout log with exercise, sets and weight', 'log'],
  ['A to-do list with due dates', 'log'],
  ['Monthly budget planner with categories and totals', 'log'],
  ['Grocery list I can add to and tick off', 'log'],
  ['Track my medication and remind me every morning at 8', 'log'],
  ['Record how much I spend on coffee each day', 'log'],
  ['Habit tracker for reading, running and meditation', 'log'],
  ['A tally counter for laps I swim', 'counter'],
  ['Count how many cups of coffee I drink', 'counter'],
  ['Simple clicker to count people entering a room', 'counter'],
  ['Divide the dinner bill between four people', 'splitter'],
  ['Split costs with my roommates from the receipt', 'splitter'],
  ['Figure out what each person owes from the receipt', 'splitter'],
  ['Take a picture of my pantry and tell me what to buy', 'ai-list'],
  ['Suggest dinner ideas from what is in my fridge', 'ai-list'],
  ['Scan my bookshelf and list the titles', 'ai-list'],
];
test.each(heldOut)('held-out: %s → %s', (prompt, expected) => {
  expect(refusalGate(prompt)).toBeUndefined();
  expect(matchSync(prompt).id).toBe(expected);
});

test.each([
  'Real-time multiplayer quiz game', 'Show the current weather for my city', 'Stream music from the internet', 'Read my emails and summarize them',
  'A map of my favorite cafes', 'Turn-by-turn directions to the office', 'Build a game where I jump over obstacles', 'Fetch the latest news from a website',
  'Sync with my Google calendar',
])('held-out refusal: %s', (prompt) => expect(refusalGate(prompt)).toBeDefined());

test.each([
  'Log the weather I saw each day', 'Track my gaming hours', 'A list of movies to stream tonight', 'Email addresses of my friends',
  'Track the current price I paid for each item', 'Keep a list of board games I own', 'Log my map reading practice sessions',
  'Track my bank balance every month', 'Record the live music gigs I went to',
])('not refused: %s', (prompt) => expect(refusalGate(prompt)).toBeUndefined());

test('nothing recognisable has no match', () => {
  expect(matchSync('I want an app').id).toBeUndefined();
  expect(matchSync('hello').id).toBeUndefined();
});

test('every canned suggestion is itself buildable: it passes the gate and matches the list app', () => {
  const suggestions = [NO_MATCH.suggestion, ...[
    'Physics simulation', 'racing game', 'live weather', 'connect to my email', 'a map', 'video call',
  ].map((p) => refusalGate(p)?.suggestion ?? '')];
  for (const suggestion of suggestions) {
    expect(suggestion).not.toBe('');
    expect(refusalGate(suggestion)).toBeUndefined();
    expect(matchSync(suggestion).id).toBe('log');
  }
});
