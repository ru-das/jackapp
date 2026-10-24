import type { Unsupported } from '../outputSchemas';
import type { RecipeId } from './types';

// Deterministic first steps of the recipe path (ADR-027): refuse what the catalog cannot do, then pick the app type from the wording.
// Keyword heuristics, not understanding: they are tuned on the eval corpus plus independent phrasings (see the tests), and a miss degrades to a
// friendly "I can't tell" message, never a broken app. `matchRecipe` is async so an embedding model can replace it later.

const text = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+' -]+/g, ' ').replace(/\s+/g, ' ')} `;

const GATES: { re: RegExp; missing: string[]; reason: string; suggestion: string }[] = [
  { re: /\b(physics|simulat\w*|collisions?|bouncing|particles?)\b/,
    missing: ['physics simulation', 'animated canvas'], reason: 'Physics and simulations need a real-time drawing canvas, which mini-apps do not have.',
    suggestion: 'Build me a log where I note each object with its mass and speed, with the total mass.' },
  { re: /\b(3d|racing|shooters?|platformers?|multiplayer|video games?|arcade|real[- ]?time games?)\b|\bplay\b[^.]{0,20}\b(online|live)\b|\b(build|make|create|code)\b[^.]{0,20}\ban? ([a-z]+ )?game\b/,
    missing: ['game engine', 'real-time graphics'], reason: 'Games need real-time graphics and controls, which mini-apps do not have.',
    suggestion: 'Build me a score tracker: a list of players with their scores and the total.' },
  { re: /\b(live|real[- ]?time)\b[^.]{0,6}\b(weather|scores?|stocks?|prices?|news|traffic|rates?|data)\b|\b(current|latest)\b[^.]{0,6}\b(weather|news|traffic|stocks?)\b|\bweather\b[^.]{0,40}\b(my location|where i am|gps|fetch\w*|automatic\w*)\b|\b(fetch\w*|scrap\w*|download\w*|pull\w*)\b[^.]{0,40}\b(from|off)\b[^.]{0,15}\b(web|internet|website|api|server|online)\b|\bautomatically\b[^.]{0,30}\b(fetch\w*|download\w*|sync\w*|check\w*)\b/,
    missing: ['internet access', 'live data'], reason: 'Mini-apps work offline and cannot fetch live data from the internet.',
    suggestion: 'Build me a weather diary where I log the date, the weather and the temperature.' },
  { re: /\b(connect\w*|sync\w*|link\w*|access\w*|log ?in\w*)\b[^.]{0,30}\b(e-?mails?|inbox|gmail|outlook|bank|accounts?|facebook|instagram|whatsapp|twitter|tiktok|slack|calendar|drive)\b|\b(read\w*|send\w*|clean\w*|reply|summari[sz]e\w*)\b[^.]{0,20}\b(e-?mails?|inbox|gmail)\b|\b(payments?|checkout|passwords?)\b/,
    missing: ['external accounts', 'internet access'], reason: 'Mini-apps cannot connect to other accounts or services.',
    suggestion: 'Build me a checklist of messages I need to answer, that I can tick and delete.' },
  { re: /\b(an?|the|show\w*|display\w*|interactive|google|apple) maps?\b|\bmaps? (of|view|app)\b|\b(gps|navigation|directions|turn[- ]by[- ]turn|nearby)\b/,
    missing: ['maps', 'location'], reason: 'Mini-apps cannot show maps or use your location.',
    suggestion: 'Build me a list of places to visit with a note for each that I can tick off.' },
  { re: /\b(video (call|chat)|voice (chat|call)|live ?stream\w*|stream (music|video|audio)|record (audio|video|voice)|speech|text[- ]to[- ]speech)\b/,
    missing: ['audio and video'], reason: 'Mini-apps cannot record or stream audio and video.',
    suggestion: 'Build me a notes log where I type a title and a note for each entry.' },
];

export function refusalGate(request: string): Unsupported | undefined {
  const t = text(request);
  const gate = GATES.find((g) => g.re.test(t));
  return gate && { reason: gate.reason, missing: gate.missing, suggestion: gate.suggestion };
}

/** What the wording says about each app type; a type needs its minimum to be eligible. */
const RULES: Record<RecipeId, { min: number; rules: [RegExp, number][] }> = {
  splitter: { min: 3, rules: [
    [/\b(split|divide|divvy)\w*\b/, 3], [/\b(bills?|receipts?|invoices?)\b/, 2],
    [/\b(each|per) (person|friend|guest|head)\b|\bwho owes\b|\bevenly\b|\bequally\b|\bshare the (cost|bill)\b/, 2], [/\btips?\b/, 1],
  ] },
  'ai-list': { min: 3, rules: [
    [/\b(photos?|photograph\w*|pictures?|pics?|snap\w*|camera|scan\w*)\b/, 3],
    [/\b(suggest\w*|ideas?|recommend\w*|generate\w*|what (should|can) i (cook|make|eat))\b/, 3],
    [/\b(groceries|grocery|pantry|fridge|cupboard|ingredients?|meals?)\b/, 1],
  ] },
  counter: { min: 3, rules: [
    [/\b(counters?|tally|tallies)\b/, 4], [/\bcount(ing)?\b/, 2], [/\b(plus one|\+ ?1|increment\w*|clickers?)\b/, 3], [/\badd one\b/, 1],
    [/\b(glasses|cups?|reps?|laps?|push-?ups?|sit-?ups?|cigarettes|coffees)\b/, 1],
  ] },
  log: { min: 1, rules: [
    [/\b(lists?|check ?lists?|trackers?|track\w*|logs?|logging|record\w*|keep|manage|journal|diary|inventory|collection|to-?dos?|tasks?|items?|habits?|budget|expenses?|subscriptions?|plan|planner|organi[sz]e\w*|add)\b/, 1],
  ] },
};
const PRIORITY: RecipeId[] = ['splitter', 'ai-list', 'counter', 'log'];

export type Match = { id: RecipeId | undefined; scores: Record<RecipeId, number> };

export function matchSync(request: string): Match {
  const t = text(request);
  const scores = Object.fromEntries(PRIORITY.map((id) =>
    [id, RULES[id].rules.reduce((sum, [re, weight]) => sum + (re.test(t) ? weight : 0), 0)])) as Record<RecipeId, number>;
  const eligible = PRIORITY.filter((id) => scores[id] >= RULES[id].min);
  const id = eligible.reduce<RecipeId | undefined>((best, next) => (best === undefined || scores[next] > scores[best] ? next : best), undefined);
  return { id, scores };
}

export const matchRecipe = async (request: string): Promise<Match> => matchSync(request);

export const NO_MATCH: Unsupported = {
  reason: "I couldn't tell which kind of app this is. Offline I can build checklists, logs with a total, counters, bill splitters and photo-to-list apps.",
  missing: ['a matching app type'],
  suggestion: 'Build me a checklist where I can add items, tick them off and delete them.',
};
