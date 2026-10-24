import type { Unsupported } from '../outputSchemas';
import { RECIPES } from './index';
import type { RecipeId } from './types';

// Deterministic first steps of the recipe path (ADR-027/028): refuse what the catalog cannot do, then pick the app type from the wording.
// Keyword heuristics, not understanding: when they are not sure the model classifies (classify.ts), and when nothing fits the request
// falls back to free-form generation. `matchRecipe` is async so an embedding model can replace it later.

const text = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9+'%-]+/g, ' ').replace(/\s+/g, ' ')} `;

const GATES: { re: RegExp; missing: string[]; reason: string; suggestion: string }[] = [
  { re: /\b(physics|simulat\w*|collisions?|bouncing|particles?)\b/,
    missing: ['physics simulation', 'animated canvas'], reason: 'Physics and simulations need a real-time drawing canvas, which mini-apps do not have.',
    suggestion: 'Build me a log where I note each object with its mass and speed, with the total mass.' },
  { re: /\b(3d|racing|shooters?|platformers?|multiplayer|video games?|arcade|real[- ]?time games?|tic[- ]tac[- ]toe|chess|sudoku|solitaire|crossword|snake|tetris|pong|minesweeper|wordle|flappy)\b|\bplay\b[^.]{0,20}\b(online|live)\b|\b(build|make|create|code)\b[^.]{0,20}\ban? ([a-z]+ )?game\b/,
    missing: ['game engine', 'real-time graphics'], reason: 'Games need real-time graphics and controls, which mini-apps do not have.',
    suggestion: 'Build me a score tracker: a list of players with their scores and the total.' },
  { re: /\b(live|real[- ]?time)\b[^.]{0,14}\b(weather|scores?|stocks?|prices?|news|traffic|rates?|data)\b|\b(current|latest)\b[^.]{0,6}\b(weather|news|traffic|stocks?)\b|\bweather (forecast|for|in|report|app|widget)\b|\bforecast\b|\bweather\b[^.]{0,40}\b(my location|where i am|gps|fetch\w*|automatic\w*)\b|\b(fetch\w*|scrap\w*|download\w*|pull\w*)\b[^.]{0,40}\b(from|off)\b[^.]{0,15}\b(web|internet|website|api|server|online)\b|\bautomatically\b[^.]{0,30}\b(fetch\w*|download\w*|sync\w*|check\w*)\b|\bstock (prices?|market|ticker)\b/,
    missing: ['internet access', 'live data'], reason: 'Mini-apps work offline and cannot fetch live data from the internet.',
    suggestion: 'Build me a weather diary where I log the date, the weather and the temperature.' },
  { re: /\b(connect\w*|sync\w*|link\w*|access\w*|log ?in\w*)\b[^.]{0,30}\b(e-?mails?|inbox|gmail|outlook|bank|accounts?|facebook|instagram|whatsapp|twitter|tiktok|slack|calendar|drive)\b|\b(read\w*|send\w*|clean\w*|reply|summari[sz]e\w*)\b[^.]{0,20}\b(e-?mails?|inbox|gmail)\b|\b(accept|process|take|make|send|receive|collect)\w* (online |card |credit card |mobile )?payments?\b|\bpay\b[^.]{0,15}\b(online|with (a )?(card|paypal|apple pay|google pay))\b|\b(checkout|password (manager|vault)|paypal|stripe|venmo)\b/,
    missing: ['external accounts', 'internet access'], reason: 'Mini-apps cannot connect to other accounts or services.',
    suggestion: 'Build me a checklist of messages I need to answer, that I can tick and delete.' },
  { re: /\b(chat|messag\w*)\b[^.]{0,30}\b(with|to)\b[^.]{0,15}\b(friends?|others|people|users?|team|family)\b|\b(chat ?app|messenger|social (network|media)|forum|group chat|real[- ]?time chat)\b|\bchat\b[^.]{0,30}\breal[- ]?time\b/,
    missing: ['messaging', 'internet access'], reason: 'Mini-apps cannot send messages to other people.',
    suggestion: 'Build me a checklist of people I need to message, that I can tick off.' },
  { re: /\b(an?|the|show\w*|display\w*|interactive|google|apple) maps?\b|\bmaps? (of|view|app)\b|\b(gps|navigation|directions|turn[- ]by[- ]turn|nearby)\b/,
    missing: ['maps', 'location'], reason: 'Mini-apps cannot show maps or use your location.',
    suggestion: 'Build me a list of places to visit with a note for each that I can tick off.' },
  { re: /\b(video (call|chat|diary|recorder|player)|voice (chat|call|recorder|notes?)|audio (recorder|player|notes?)|live ?stream\w*|stream (music|video|audio)|record (audio|video|voice)|recorder app|speech|text[- ]to[- ]speech|podcast (player|app|recorder)|listen\w* to (a )?podcasts?|karaoke)\b/,
    missing: ['audio and video'], reason: 'Mini-apps cannot record or stream audio and video.',
    suggestion: 'Build me a notes log where I type a title and a note for each entry.' },
  { re: /\b(my|phone'?s|device'?s|current|live) location\b|\b(track|find|locate)\w*\b[^.]{0,15}\b(phone|device|car|friends?)\b[^.]{0,10}\b(location|position)\b/,
    missing: ['location'], reason: 'Mini-apps cannot use your location.',
    suggestion: 'Build me a list of places I have been, with a note and a date for each.' },
  { re: /\b(order|book|buy|purchase|reserve)\b[^.]{0,20}\b(food|groceries|tickets?|flights?|hotels?|a ride|taxi|online)\b|\b(uber|lyft|doordash|spotify|netflix|youtube|amazon|whatsapp|telegram|alexa|google home|smart (home|lights?|plugs?|thermostat|devices?))\b|\bcontrol\b[^.]{0,15}\b(lights?|tv|thermostat|speaker|devices?)\b/,
    missing: ['online services', 'internet access'], reason: 'Mini-apps work offline and cannot order things or talk to other apps and devices.',
    suggestion: 'Build me a shopping list with prices where I tick what I have bought.' },
  { re: /\b(dice|die roll|coin (flip|toss)|flip a coin|roll a? ?(dice|die)|random (number|picker|name|generator|group)|wheel of fortune|magic 8|spin the (bottle|wheel))\b/,
    missing: ['random numbers'], reason: 'Mini-apps cannot roll dice or pick at random.',
    suggestion: 'Build me a picker: I type my options and the AI picks one for me.' },
  { re: /\b(qr|bar ?code|flashlight|torch|compass|metronome|stopwatch|photo editor|drawing app|whiteboard|sketch ?pad|paint app)\b/,
    missing: ['device sensors', 'drawing canvas'], reason: 'Mini-apps cannot use sensors, scan codes or draw freely.',
    suggestion: 'Build me a notes log where I type a title and a note for each entry.' },
  { re: /\b(gantt|org(ani[sz]ation(al)?)? chart|family tree|mind ?map|flow ?chart|diagram)\b|^ ?(a |an |my |the )?(simple |monthly |weekly |yearly |printable |google |wall )?calendar( app| view)? ?$/,
    missing: ['charts and diagrams'], reason: 'Mini-apps have lists and numbers, not charts, diagrams or calendar grids.',
    suggestion: 'Build me a task list with a start date, an owner and a status for each task.' },
];

export function refusalGate(request: string): Unsupported | undefined {
  const t = text(request);
  const gate = GATES.find((g) => g.re.test(t));
  return gate && { reason: gate.reason, missing: gate.missing, suggestion: gate.suggestion };
}

type Rules = { min: number; rules: [RegExp, number][] };
const LIST_WORDS = /\b(lists?|check ?lists?|trackers?|track\w*|logs?|logging|records?|keep|keeper|manage[rd]?|organi[sz]\w*|journal|diary|notes?|notebook|database|register|catalog(ue)?|inventory|watch ?lists?|wish ?lists?|schedule|planner|time ?sheet|crm|roster|directory|contacts?|bookmarks?|flash ?cards?|vocabulary|habits?|budget\w*|expenses?|bills?|subscriptions?|invoices?|attendance|collection|chart|board|form|goals?|okrs?|tasks?|to-?dos?|items?|plan|add|database|library|diary|history|calendar)\b/;

/** What the wording says about each app type; a type needs its minimum to be eligible. Negative weights break ties toward the other type. */
const RULES: Record<RecipeId, Rules> = {
  splitter: { min: 3, rules: [
    [/\b(split|divide|divvy)\w*\b/, 3], [/\b(bills?|receipts?|invoices?)\b/, 2],
    [/\b(each|per) (person|friend|guest|head)\b|\bwho owes\b|\bevenly\b|\bequally\b|\bshare the (cost|bill)\b/, 2], [/\btips?\b/, 1],
  ] },
  ai: { min: 3, rules: [
    [/\b(generator|generate\w*|suggest\w*|recommend\w*|summari[sz]\w*|rewrit\w*|rephras\w*|paraphras\w*|translat\w*|explain\w*|identif\w*|recogni[sz]\w*|describe\w*|analy[sz]\w*|brainstorm\w*|proofread\w*|draft\w*|compose\w*|writer|chatbot|assistant|tutor|coach|buddy|helper|advis[eo]r|itinerary|captions?)\b|\bwrite (me|a|an|my)\b/, 3],
    [/\b(photos?|photograph\w*|pictures?|pics?|snap(s|ped|ping)?|camera|scan\w*)\b/, 3],
    [/\b(choose|pick\w*|decide)\b[^.]{0,30}\bfor me\b|\bwhat (should|can|to) i\b|\btell me\b/, 3],
    [/\bideas?\b/, 2], [/\b(groceries|grocery|pantry|fridge|cupboard|ingredients?|meals?)\b/, 1],
    [/\b(tracker|track|log|journal|diary|database|keeper|register|inventory)\b/, -2],
  ] },
  calculator: { min: 3, rules: [
    [/\b(calculators?|converters?|convert\w*|calculate\w*|compute\w*|conversion)\b/, 3],
    [/\bdays? (until|since|between|left|to)\b|\bcountdown (in|to)\b|\bhow many days\b/, 3],
    [/\b(tip|bmi|bmr|mortgage|loans?|interest|tax|gst|vat|discount|percent\w*|salary|inflation|retirement|annuity|currency|exchange|age|pace|calorie\w*|gpa|grade|fraction|triangle|concrete|paint|tile|profit|break-?even|fuel|electricity|due date|body fat|ideal weight|snowball|scaler|unit)\b/, 2],
  ] },
  counter: { min: 3, rules: [
    [/\b(counters?|tally|tallies)\b/, 4], [/\bcount(ing)?\b/, 2], [/\b(plus one|\+ ?1|increment\w*|clickers?)\b/, 3], [/\badd one\b/, 1],
    [/\b(glasses|cups?|reps?|laps?|push-?ups?|sit-?ups?|cigarettes|coffees|steps)\b/, 1],
  ] },
  log: { min: 1, rules: [
    [LIST_WORDS, 1], [/\b(price|prices|cost|costs|amount|total|totals|money|spend|spent|owe|owed|hours?|minutes|weight|distance|mileage|liters?)\b/, 1],
    [/\b(status|owner|priority|rating|ratings|stars?|progress|due|deadline|mood|sleep)\b/, 1],
  ] },
};
const PRIORITY: RecipeId[] = ['splitter', 'ai', 'calculator', 'counter', 'log'];

export type Match = { id: RecipeId | undefined; confident: boolean; scores: Record<RecipeId, number> };

export function matchSync(request: string): Match {
  const t = text(request);
  const registered = PRIORITY.filter((id) => id in RECIPES);
  const scores = Object.fromEntries(PRIORITY.map((id) =>
    [id, RULES[id].rules.reduce((sum, [re, weight]) => sum + (re.test(t) ? weight : 0), 0)])) as Record<RecipeId, number>;
  const eligible = registered.filter((id) => scores[id] >= RULES[id].min).sort((a, b) => scores[b] - scores[a] || PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const [best, next] = eligible;
  // Sure only when nothing else is close: two near scores are the classifier's call.
  return { id: best, confident: best !== undefined && (next === undefined || scores[best] - scores[next] >= 2), scores };
}

export const matchRecipe = async (request: string): Promise<Match> => matchSync(request);
