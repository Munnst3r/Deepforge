# Deepforge

Static web idle game: three separate modes (Industrialist → Capitalist → Communist) in one app. Plays only on an iPhone 17 Pro Max as a Home Screen web app. No build step, no dependencies; open `index.html`.

## Files (all at the repo root, so the repo can be updated from an iPhone; script load order = order in index.html; one shared global scope)
| File | Contents |
|---|---|
| `index.html` | Markup skeleton only |
| `style.css` | All styles, embedded fonts |
| `core.js` | Title screen, helpers (`$`, `icon`, `fmt`, `plain`, `money`), storage, settings, PixBar, save merging, shared row builders, toasts, `Polish` animations |
| `industrialist.js` | `IndLogic` (rules, minified style) + `Industrialist` (UI module) |
| `capitalist.js` | `Capitalist` module (30 mines, golems, research, transmute/ascend, trials) |
| `communist.js` | `Communist` module (6 industries of production chains, plans, Great Work) |
| `app.js` | MODE INTERFACE doc (top of file), saving, shared actions, input, swipe, tutorial, hints, frame (tab bar, top boxes, panes), cinematics |
| `gems.js` | `StoneView`: 3D gem on each mode's last tab (`GEMS_IND`, `GEMS`, `GEMS_COM`) |
| `main.js` | Ending, mode switching, title picker, start-up + main loop, `Motes` background, iOS viewport fixes |
| `sim.js` | Headless pacing simulation (`node sim.js`) |

## Architecture
- Each mode is a closed IIFE with its own state `S` and modifiers `M` (rebuilt by `refresh()`); the app only uses the returned object (see MODE INTERFACE in `app.js`).
- Saves: one localStorage slot per mode + settings; `migrate()` per mode merges onto `newState()`, so new state fields need only a default there.
- Upgrade lists (research, Dark Matter, runes) use stable string ids; never rename an id (saves and claimed quests key on it).
- Run-scoped milestone latches: Capitalist `S.allMs`, Communist `S.tierMs[i]`, Industrialist `m.allMil` (reset with the run/claim).
- Only cross-mode link: Resonance. `updateResonance()` (app.js) sets `RESONANCE[key]` = 1 + 5% × gem designs unlocked in the other modes; each mode multiplies its output by `resonance(key)` (core.js).
- Prestige rewards are always "total earned minus already held" (Dark Matter, Elder Runes), so repeating a reset gives nothing; keep it that way to avoid snowball loops.

## Conventions
- Comments explain why, not what. Keep numbers/balance in the constant tables at the top of each mode.
- UI text: plain, short; numbers via `fmt`/`plain`/`money`/`usd`.
- No sound, no in-app purchases, no outside libraries or references to other projects.
- Commits/files: no Claude/AI attribution.

## iOS constraints
- Status bar is opaque (`black`) on purpose: `black-translucent` + `viewport-fit=cover` triggers WebKit 301108 (viewport opens short, gap under the tab bar). Don't switch back. Changing it needs the Home Screen icon re-added.
- Never let the page itself scroll (taps desync); only `#view` scrolls.

## Checks
- `for f in *.js; do node --check $f; done`
- Load `index.html` in Playwright at 440×956 and watch for page errors.
- `node sim.js` after balance changes.
