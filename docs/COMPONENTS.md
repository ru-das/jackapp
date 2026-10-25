# JackApp — Component & Capability Registry

The **catalog** is the complete set of building blocks the model may use. If a component isn't in this file, the model can't use it and the validator rejects it.

**Source of truth in code:** `src/catalog/<Component>/{props.ts, <Component>.tsx, meta.ts}`.
`meta.ts` holds the one-line **model hint** and an **example**; the generator builds its catalog prompt from those. A test (`catalog-docs-sync`) compares the registry names bidirectionally with **P0** `### <Name>` headings until T-55 implements the P1 components. P1 schemas are deferred.

Legend: **P0** = needed for hero apps and the challenge · **P1** = after P0 is green · **P2** = after the challenge.
Value = see `SCHEMA.md` §4. Template = string with `{{…}}`. StateKey = declared state key.

---

## Design tokens (shared by all components)

| Token | Values |
|---|---|
| `gap` / spacing | `none` 0 · `sm` 8 · `md` 16 · `lg` 24 |
| `variant` (Button) | `primary` · `secondary` · `danger` |
| Text `variant` | `title` · `heading` · `body` · `caption` · `muted` |

Theme: light and dark follow the system. Minimum touch target 48 × 48 (ADR-042). Every input has a visible label (accessibility).

---

## Layout

### Stack — P0
Vertical or horizontal group of children.

| Prop | Type | Req | Default |
|---|---|---|---|
| `direction` | `vertical` \| `horizontal` | | `vertical` |
| `gap` | spacing token | | `md` |
| `align` | `start` \| `center` \| `end` \| `stretch` | | `stretch` |
| `wrap` | boolean | | `false` |

Children: yes. Model hint: *"Arrange children in a column or row. Use as the screen root."*

### Card — P0
A titled surface that groups related elements.

| Prop | Type | Req | Default |
|---|---|---|---|
| `title` | Template | | |
| `subtitle` | Template | | |

Children: yes (stacked vertically, `md` gap). Model hint: *"Group a section with a heading."*

### Divider — P0
Horizontal rule. No props. Model hint: *"Visual separator."*

---

## Display

### Text — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `value` | Template | ✓ | |
| `variant` | Text variant token | | `body` |

Model hint: *"Show text. Can include {{stateKey}} or {{stateKey|formatter}}."*

### Image — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `src` | Value → image | ✓ | |
| `aspect` | `square` \| `wide` \| `tall` | | `wide` |
| `alt` | string | | `""` |

Renders nothing when `src` is `null`. Model hint: *"Show a stored photo."*

### Stat — P0
A big number with a label.

| Prop | Type | Req | Default |
|---|---|---|---|
| `label` | Template | ✓ | |
| `value` | Value (number, string, or date) | ✓ | |
| `format` | `number` \| `currency` \| `percent` \| `date` \| `ago` \| `text` | | `number` |
| `currency` | Template → 3-letter code (e.g. `EUR`) | | app default |

`number` shows up to 4 decimals in the user's locale; `percent` takes a fraction (0.125 → 12.5%); `currency` is USD unless the `currency` prop gives a code; a bad code falls back to USD. Model hint: *"Show a computed number. Use $agg/$math for totals, averages, splits."*

---

## Inputs (all two-way bound through `bind`)

### TextInput — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `bind` | StateKey (`string`) | ✓ | |
| `label` | string | ✓ | |
| `placeholder` | string | | |
| `multiline` | boolean | | `false` |
| `onSubmit` | action id | | |

Model hint: *"Free text from the user."*

### NumberInput — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `bind` | StateKey (`number`) | ✓ | |
| `label` | string | ✓ | |
| `min` / `max` | number | | |
| `step` | number | | `1` |
| `mode` | `field` \| `stepper` \| `slider` | | `stepper` |

`slider` requires `min` and `max`. Model hint: *"A number the user sets: counts, amounts, people."*

### Toggle — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `bind` | StateKey (`boolean`) | ✓ | |
| `label` | string | ✓ | |

### Select — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `bind` | StateKey (`string`) | ✓ | |
| `label` | string | ✓ | |
| `options` | string[] (2–12) | ✓ | |

Model hint: *"Pick one option from a short fixed list."*

### ImageInput — P0 (capability: camera, photoLibrary)
| Prop | Type | Req | Default |
|---|---|---|---|
| `bind` | StateKey (`image`) | ✓ | |
| `label` | string | ✓ | |
| `source` | `camera` \| `library` \| `any` | | `any` |

Downscales to ≤ 1024 px JPEG (quality 0.8) before storing. Shows a thumbnail and a "Retake" button. Model hint: *"Let the user take or pick a photo, usually before an ai.run step."*

### DateInput — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `bind` | StateKey (`date`) | ✓ | |
| `label` | string | ✓ | |
| `mode` | `date` | | `date` |

The user types `YYYY-MM-DD` or taps **Today**; invalid text is flagged and never written to state. Time-of-day and date-time modes are deferred: they need a native picker (a new dependency and a rebuild). Model hint: *"A date the user types or sets to today: birthday, due date, start day."*

---|---|---|---|
| `bind` | StateKey (`date`) | ✓ | |
| `label` | string | ✓ | |
| `mode` | `date` \| `time` \| `datetime` | | `date` |

---

## Collections

### List — P0
Shows the items of a list state key. Item slots are Templates that may use `$item.<field>` and `$index`.

| Prop | Type | Req | Default |
|---|---|---|---|
| `items` | StateKey (`list`) | ✓ | |
| `title` | Template | ✓ | |
| `subtitle` | Template | | |
| `trailing` | Template | | |
| `checkField` | boolean field of the item | | |
| `flagField` | string field of the item | | | A non-empty value shows as `⚠ <text>` in place of `trailing`, in the danger colour |
| `deletable` | boolean | | `false` |
| `onItemPress` | action id (gets `$item`, `$index`) | | |
| `sort` | `{ field, dir: "asc" \| "desc" }` | | insertion order |
| `emptyText` | string | | `"Nothing here yet"` |

`checkField` renders a checkbox that toggles that field. `deletable` adds swipe or long-press delete (web: a delete icon). Model hint: *"Show and tick off a list of items. Use checkField for to-dos and shopping lists."*

---

## Actions & feedback

### Button — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `label` | Template | ✓ | |
| `onPress` | action id | ✓ | |
| `variant` | Button variant token | | `primary` |

Shows a spinner and is disabled while its action runs. Model hint: *"Run an action. One primary button per screen is best."*

### Timer — P0
| Prop | Type | Req | Default |
|---|---|---|---|
| `seconds` | Value → number | ✓ | |
| `label` | Template | ✓ | |
| `onDone` | action id | | |
| `notify` | boolean | | `true` |

Start / Pause / Reset countdown (up to 24 h). It runs while the app is open; a background notification needs the triggers work (T-52), so `notify` is reserved until then. `onDone` runs once when it reaches zero. Model hint: *"Countdown for chores: tea, laundry, workouts, focus sessions."*

### Chart — P1
| Prop | Type | Req | Default |
|---|---|---|---|
| `kind` | `bar` \| `line` | ✓ | |
| `data` | StateKey (`list`) | ✓ | |
| `x` | field (string or date) | ✓ | |
| `y` | field (number) | ✓ | |
| `title` | Template | | |

Use a tiny SVG implementation (`react-native-svg`). No heavy chart libraries.

---

## Not in the catalog (on purpose)

| Request | Why not | What to suggest |
|---|---|---|
| Custom code, HTML, WebView | Security and ADR-002 | Combine existing components |
| Maps, location | Not needed for hero apps | P2 |
| Network fetch / web search | No network rule | P2, with explicit user opt-in |
| Canvas, games, physics | Out of scope | Calculator with sliders + Stat |
| Audio record / playback | Out of scope for the deadline | P2 (Gemma 4 small models support audio) |

---

## Capabilities

Capabilities are device features the runtime exposes. Components and ops declare which ones they use, so the app can ask for permissions only when a mini-app needs them.

| Capability | Used by | Web | Android | Permission prompt |
|---|---|---|---|---|
| `ai.text` | `ai.run` | OpenRouter / Ollama | on-device (LiteRT-LM), OpenRouter or Ollama | none |
| `ai.vision` | `ai.run` with `image` | OpenRouter / Ollama | on-device (LiteRT-LM), OpenRouter or Ollama | none |
| `camera` | ImageInput | ✅ | ✅ | first use |
| `photoLibrary` | ImageInput | ✅ (file picker) | ✅ | first use |
| `storage` | all state | ✅ | ✅ | none |
| `notifications.local` | `notify`, Timer | ⚠️ while open | ✅ | first use |
| `notifications.scheduled` | triggers | ⚠️ while open | ✅ | when saving a trigger |
| `share` | `share` op | Web Share → clipboard | ✅ | none |

---

## Adding a component (checklist)

1. `src/catalog/<Name>/props.ts`: Zod schema, strict (no unknown keys).
2. `src/catalog/<Name>/<Name>.tsx`: implementation. Props only. No AI, no storage.
3. `src/catalog/<Name>/meta.ts`: `{ name, tier, hint, example, children: boolean, capabilities: [] }`.
4. Register it in `src/catalog/index.ts`.
5. Add a `### <Name>` section here.
6. Tests: props schema accepts the example and rejects a bad prop; renders in a fixture.
7. If it changes the spec contract, follow the change rules in `SCHEMA.md`.
