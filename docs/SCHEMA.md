# JackApp Mini-App Spec — Contract v0.1

This is **the** contract between the model, the validator, the runtime, and stored data. Anything not described here is invalid.

**Change rules**
- Changes bump `specVersion` and add a migration in `src/spec/migrations/` (once v0.2 exists). The human-approved implementation clarifications below (ADR-014/015) retain `specVersion: "0.1"`.
- The same commit must update `src/spec/schema.ts`, `src/spec/validate.ts`, tests, and this file.
- Log the change in `DECISIONS.md`.

---

## 1. Top-level shape

```jsonc
{
  "specVersion": "0.1",
  "meta": {
    "name": "Fridge Snap",            // 1–40 chars
    "description": "Photo of fridge → grocery list",  // ≤ 140 chars
    "icon": "🧊",                      // a single emoji
    "sourcePrompt": "…",              // set by the generator, not the model
    "generatedBy": { "provider": "openrouter", "model": "google/gemma-4-31b-it:free" } // set by the generator
  },
  "state":    { /* key → StateDecl */ },
  "screens":  [ /* Screen, first one is the entry screen */ ],
  "elements": { /* elementId → Element (flat map) */ },
  "actions":  { /* actionId → Action */ },
  "triggers": [ /* Trigger, optional */ ]
}
```

The app `id`, `createdAt`, and `updatedAt` live in storage (`jackapp:apps`), **not** in the spec. That way the model never has to invent them.

## 2. Identifiers

- Element, action, screen, trigger ids and state keys: `^[a-z][a-zA-Z0-9]{0,31}$` (camelCase, starts lowercase).
- Ids are unique within their own map. They may repeat across maps, but don't do it.

## 3. State

```jsonc
"state": {
  "photo":  { "type": "image",   "default": null, "persist": false },
  "notes":  { "type": "string",  "default": "" },
  "people": { "type": "number",  "default": 2 },
  "done":   { "type": "boolean", "default": false },
  "since":  { "type": "date",    "default": null },
  "items":  { "type": "list", "of": { "name": "string", "qty": "string", "done": "boolean" }, "default": [] }
}
```

| `type` | JS value | Notes |
|---|---|---|
| `string` | string | |
| `number` | number | |
| `boolean` | boolean | |
| `date` | ISO 8601 string or `null` | |
| `image` | data URL / file URI string or `null` | Always downscaled ≤ 1024 px |
| `list` | array of objects | `of` maps field → `string` \| `number` \| `boolean` \| `date`. No nested lists |

- `persist` defaults to `true`.
- `default` must match the type. Lists default to `[]`.
- Max 20 state keys. Max 8 fields per list item.

## 4. Values (how props read state)

A prop that accepts a **Value** can be any of these:

| Form | Example | Result |
|---|---|---|
| Literal | `"Hello"`, `3`, `true` | itself |
| Template string | `"{{items\|count}} items left"` | string; `{{path}}` or `{{path\|formatter}}` |
| Reference | `{ "$ref": "items" }` | the raw value at the path |
| Aggregate | `{ "$agg": { "op": "sum", "of": "items", "field": "price", "where": { "field": "done", "equals": false } } }` | number |
| Math | `{ "$math": ["/", { "$agg": {…} }, { "$ref": "people" }] }` | number |
| Now | `{ "$now": true }` | current ISO date-time |

**Paths**
- `items`, `notes`: state keys. Dot access into list items by index is **not** allowed (`items.0.name` is invalid).
- Inside a `List` item slot only: `$item.<field>` and `$index`.

**`$agg` ops**: `count`, `sum`, `avg`, `min`, `max`. `field` is required except for `count`. `where` (optional) supports only `{ field, equals }`.

**`$math`**: `[op, a, b]` with `op` in `+ - * /`, or `["round", a, digits]`. Operands are Values. Max nesting depth 3. Division by zero → `0` plus a runtime warning.

**Formatters** (templates only): `count` (list length), `date`, `time`, `ago` ("3 days ago"), `upper`, `lower`, `currency` (locale default currency, 2 decimals), `fixed2`.

Templates render **plain text only**. Write `\{{` for a literal `{{`.

## 5. Screens

```jsonc
"screens": [
  { "id": "main", "title": "Fridge Snap", "root": "rootStack" }
]
```

1–3 screens. `root` must be an element id. Navigate between screens with the `navigate` op.

## 6. Elements (flat map)

```jsonc
"elements": {
  "rootStack": { "type": "Stack", "props": { "gap": "md" }, "children": ["photoIn", "makeBtn", "list"] },
  "photoIn":   { "type": "ImageInput", "props": { "bind": "photo", "label": "Fridge photo", "source": "any" } },
  "makeBtn":   { "type": "Button", "props": { "label": "Make my list", "onPress": "makeList" } }
}
```

- `type` must be a component name from `COMPONENTS.md`.
- `props` are validated against that component's prop schema. Unknown props are errors.
- `children` is allowed only on containers (`Stack`, `Card`). Each child must exist.
- Every element must be reachable from exactly one screen root, and appear only once in the tree. No cycles, no orphans.
- `bind` props take a **state key** (string) and need a compatible type (see `COMPONENTS.md`).
- Props that take an action take an **action id** (string).
- Max 60 elements. Max tree depth 8.

## 7. Actions (closed op set)

```jsonc
"actions": {
  "makeList": { "steps": [
    { "op": "ai.run",
      "prompt": "Look at this fridge photo. List groceries that look missing or low. Notes: {{notes}}",
      "image": { "$ref": "photo" },
      "output": { "type": "list", "of": { "name": "string", "qty": "string" } },
      "into": "items", "mode": "replace",
      "defaults": { "done": false } },
    { "op": "toast", "message": "List ready: {{items|count}} items" }
  ]}
}
```

| `op` | Fields | Behavior |
|---|---|---|
| `state.set` | `path`, `value: Value` | Set a state key |
| `state.append` | `path` (list), `value: { field: Value }` | Push an item |
| `state.update` | `path` (list), `index: Value`, `set: { field: Value }` | Patch one item |
| `state.remove` | `path` (list), `index: Value` **or** `where: { field, equals }` | Remove item(s) |
| `state.toggle` | `path` (boolean) | Flip a boolean |
| `state.increment` | `path` (number), `by: Value` (default 1) | Add to a number |
| `state.reset` | `path` | Back to its `default` |
| `ai.run` | `prompt` (template), `image?: Value`, `output`, `into`, `mode?`, `defaults?` | Calls the model (see below) |
| `navigate` | `screen` | Switch screen |
| `confirm` | `message` | Ask the user; "No" stops the action |
| `toast` | `message` (template) | Short message |
| `notify` | `title`, `body` (templates) | Immediate local notification |
| `share` | `text` (template) | System share sheet / Web Share / clipboard fallback |

Rules:
- Max 12 actions. Max 8 steps per action.
- `$item` and `$index` are allowed in steps only when the action is triggered from a `List` item (`onItemPress`, per-item buttons). The runtime passes that context.

### `ai.run` details
- `output` describes the result using the **same type vocabulary as state**: `{ "type": "string" }`, `{ "type": "number" }`, or `{ "type": "list", "of": {…} }`.
- `into` must be a state key whose type matches `output`. For lists, the `of` fields of `output` must be a subset of the target list's fields. Missing fields are filled from `defaults`, then from type zero values (`""`, `0`, `false`, `null`).
- `mode`: `replace` (default) or `append` (lists only).
- The runtime converts `output` into a JSON Schema, asks the provider for JSON, validates it, and retries **once** on failure. A second failure shows a toast and changes nothing.
- `prompt` max 2000 chars after template expansion. `image` must resolve to an image or `null` (if `null`, it is skipped).

## 8. Triggers

```jsonc
"triggers": [
  { "id": "sundayWater", "type": "schedule",
    "schedule": { "kind": "weekly", "weekday": 0, "time": "09:00" },
    "notify": { "title": "Plant Pal 🌱", "body": "Time to water. Last done {{lastWatered|ago}}." } }
]
```

- `schedule.kind`: `daily { time }`, `weekly { weekday 0=Sun..6, time }`, `once { at: ISO }`. Times are local `HH:MM`.
- Templates in `notify` are evaluated **at scheduling time** (on save and app start), not at fire time. Keep them stable.
- Tapping the notification opens the mini-app.
- Max 3 triggers.

## 9. Unsupported response

When a request can't be built from the catalog, the generator returns this **instead of** a spec:

```json
{ "unsupported": {
    "reason": "Physics simulation needs a real-time drawing canvas and a physics engine.",
    "missing": ["physics simulation", "animated canvas"],
    "suggestion": "I can build a projectile calculator with sliders for angle and speed that shows range and height."
} }
```

## 10. Plan contract (generator stage 1, internal)

```json
{
  "name": "Fridge Snap", "icon": "🧊", "summary": "…",
  "state":   [{ "key": "items", "type": "list", "of": { "name": "string", "qty": "string", "done": "boolean" }, "purpose": "the grocery list" }],
  "screens": [{ "id": "main", "purpose": "capture + list" }],
  "components": [{ "type": "ImageInput", "purpose": "fridge photo", "bind": "photo" }],
  "actions": [{ "id": "makeList", "purpose": "AI reads photo into items", "ops": ["ai.run", "toast"] }],
  "triggers": [],
  "unsupported": null
}
```

Validated loosely (types and catalog names only). Its job is to make the FILL stage easier for a small model.

## 11. Validation errors

`validate(input: unknown) → SpecError[]` accepts an object or JSON text. An empty array means valid. Structural `SpecSchema.parse()` applies defaults but **does not** authorize rendering or saving; callers must run `validate()` first. Errors use dot/bracket paths, stable stage/input order, no repeated code/path pairs, and repair hints. Unknown keys point to the offending property. Malformed Values use `BAD_VALUE`, component props use `BAD_PROP`, action step shape uses `BAD_ACTION`, and version/component/§12 limit errors take precedence over generic `SHAPE`. Checks that depend on malformed declarations or props are skipped; independent valid sections are still checked.

```ts
type SpecError = { code: ErrorCode; path: string; message: string; hint?: string };
```

| `code` | Example `path` | Meaning |
|---|---|---|
| `BAD_JSON` | `` | Not parseable JSON |
| `BAD_VERSION` | `specVersion` | Unknown version |
| `SHAPE` | `meta.name` | Structural (Zod) error |
| `UNKNOWN_COMPONENT` | `elements.foo.type` | Not in the catalog |
| `BAD_PROP` | `elements.foo.props.gap` | Prop fails its schema or is unknown |
| `MISSING_REF` | `elements.root.children[2]` | Element, action, or screen id not found |
| `UNDECLARED_STATE` | `elements.inp.props.bind` | State key not declared |
| `TYPE_MISMATCH` | `actions.a.steps[0].into` | Bound or target state has the wrong type |
| `TREE` | `elements.x` | Orphan, cycle, or element reused |
| `BAD_VALUE` | `elements.s.props.value.$math` | Bad expression, bad path, depth exceeded |
| `BAD_ACTION` | `actions.a.steps[1].op` | Unknown op or wrong fields |
| `LIMIT_EXCEEDED` | `elements` | Over a limit in this document |

`hint` is written for the model (for example, "Valid components: Stack, Card, Text, …"). The repair prompt sends the full error list.

## 12. Limits summary

| Item | Max |
|---|---|
| Spec size | 32,768 UTF-8 bytes of compact input JSON, including metadata, before defaults |
| Screens | 3 |
| Elements | 60 (tree depth 8; screen root is depth 1) |
| State keys | 20 (8 fields per list item) |
| Actions | 12 (8 steps each) |
| Triggers | 3 |
| `$math` nesting | 3 nested math nodes; violations use `BAD_VALUE` |
| `ai.run` prompt | 2000 chars expanded |

### Approved v0.1 validation clarifications (ADR-015)

- Other §12 limits use `LIMIT_EXCEEDED`. Size is measured after compact serialization, so JSON text whitespace is excluded. Metadata counts; parser defaults do not.
- Prompt validation expands declared defaults with `now = 2000-01-01T00:00:00Z`, locale `en-US`, time zone UTC and currency USD. Every default item of every calling List is checked; an empty list uses a typed zero item (`""`, `0`, `false`, `null` for date) and index 0. **T-41 must check the actual expanded prompt with live state, item and user settings immediately before inference.**
- `state.append` supplies every declared item field. `state.update` permits partial patches. Both reject unknown fields. Whole-list `state.set` requires identical field names and types, regardless of declaration order.
- `ai.run.defaults` is list-only; each key must be declared by the target list and each literal must match that field type. Output list fields remain a type-matching subset of the target; omitted fields retain the documented defaults/zero-value behavior.
- Literal indices are nonnegative integers; literal rounding digits are integers. Dynamic numeric arguments are type-checked here and need runtime range checks (T-31/T-41).
- There is no numeric coercion. The Value grammar is unchanged (in particular, direct `null` is not a Value). Valid ISO date and image URI literals are accepted in their corresponding typed positions; nullable references may resolve to null.
- Templates inspect complete unescaped expressions only; unmatched braces remain literal, matching `resolveTemplate`. Only documented Template/Value positions are inspected (input labels/placeholders, image alt text and List.emptyText are literal strings).
- `$item`/`$index` actions must be compatible with **every** calling List. Mixed ordinary/item callers and unused actions requiring an item context are invalid. P0 item slots are List.title/subtitle/trailing; List.onItemPress passes item context.

---

## 13. Complete example — H1 Fridge Snap

```json
{
  "specVersion": "0.1",
  "meta": { "name": "Fridge Snap", "description": "Photo of your fridge → grocery list", "icon": "🧊" },
  "state": {
    "photo": { "type": "image", "default": null, "persist": false },
    "notes": { "type": "string", "default": "" },
    "items": { "type": "list", "of": { "name": "string", "qty": "string", "done": "boolean" }, "default": [] }
  },
  "screens": [{ "id": "main", "title": "Fridge Snap", "root": "root" }],
  "elements": {
    "root":     { "type": "Stack", "props": { "gap": "md" }, "children": ["capture", "listCard"] },
    "capture":  { "type": "Card", "props": { "title": "Snap your fridge" }, "children": ["photoIn", "notesIn", "makeBtn"] },
    "photoIn":  { "type": "ImageInput", "props": { "bind": "photo", "label": "Fridge photo", "source": "any" } },
    "notesIn":  { "type": "TextInput", "props": { "bind": "notes", "label": "Anything to add?", "placeholder": "e.g. we're out of eggs" } },
    "makeBtn":  { "type": "Button", "props": { "label": "Make my list", "onPress": "makeList", "variant": "primary" } },
    "listCard": { "type": "Card", "props": { "title": "Grocery list" }, "children": ["list", "clearBtn"] },
    "list":     { "type": "List", "props": { "items": "items", "title": "{{$item.name}}", "subtitle": "{{$item.qty}}", "checkField": "done", "deletable": true, "emptyText": "Snap a photo to start" } },
    "clearBtn": { "type": "Button", "props": { "label": "Clear bought items", "onPress": "clearDone", "variant": "secondary" } }
  },
  "actions": {
    "makeList": { "steps": [
      { "op": "ai.run",
        "prompt": "You see a photo of a home fridge. List common groceries that look missing or nearly finished. Short names. Extra notes from the user: {{notes}}",
        "image": { "$ref": "photo" },
        "output": { "type": "list", "of": { "name": "string", "qty": "string" } },
        "into": "items", "mode": "replace", "defaults": { "done": false } },
      { "op": "toast", "message": "{{items|count}} items on your list" }
    ]},
    "clearDone": { "steps": [
      { "op": "confirm", "message": "Remove items you've bought?" },
      { "op": "state.remove", "path": "items", "where": { "field": "done", "equals": true } }
    ]}
  }
}
```

### Excerpt — H2 Plant Pal (timestamps + trigger)

```jsonc
"state": {
  "plants": { "type": "list", "of": { "name": "string", "lastWatered": "date" }, "default": [] },
  "newPlant": { "type": "string", "default": "" },
  "lastWatered": { "type": "date", "default": null }
},
"actions": {
  "waterOne": { "steps": [
    { "op": "state.update", "path": "plants", "index": { "$ref": "$index" }, "set": { "lastWatered": { "$now": true } } },
    { "op": "state.set", "path": "lastWatered", "value": { "$now": true } }
  ]}
},
// List: "subtitle": "Watered {{$item.lastWatered|ago}}", "onItemPress": "waterOne"
"triggers": [{ "id": "sunday", "type": "schedule", "schedule": { "kind": "weekly", "weekday": 0, "time": "09:00" },
               "notify": { "title": "Plant Pal 🌱", "body": "Sunday watering time!" } }]
```

### Excerpt — H3 Bill Splitter (computed values)

```jsonc
"state": {
  "bill": { "type": "image", "default": null, "persist": false },
  "lines": { "type": "list", "of": { "name": "string", "price": "number" }, "default": [] },
  "people": { "type": "number", "default": 2 }
},
// ai.run output: { "type": "list", "of": { "name": "string", "price": "number" } } into "lines"
"eachPays": { "type": "Stat", "props": {
  "label": "Each person pays",
  "value": { "$math": ["round", { "$math": ["/", { "$agg": { "op": "sum", "of": "lines", "field": "price" } }, { "$ref": "people" }] }, 2] },
  "format": "currency" } }
```

The full specs for H2 and H3 live in `src/spec/fixtures/` and must pass `validate()`.
