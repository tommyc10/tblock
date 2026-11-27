# Motion

Every helper is in [kit/assets/film.js](kit/assets/film.js) as `window.FILM`. A scene calls it as `F`, adding tweens to its own paused timeline at scene times. Every frame is a function of time, so renders repeat exactly.

## Springs

The springs are closed-form, with Apple's two numbers: damping ratio and response in seconds. `F.springEase(damping, response, duration)` lands exactly on 1 at `duration`.

| name | spring | for |
| --- | --- | --- |
| `F.UI_IN` | 0.8, 0.45 over 0.7 s | cards, panels and sheets arriving: a hint of settle |
| `F.SOFT_IN` | 1.0, 0.5 over 0.75 s | rows and text: no overshoot |
| `F.POP` | 0.7, 0.35 over 0.45 s | chips, badges and status changes: one small bounce |

Use plain curves only for things that aren't objects: `power2.out` for opacity in, `power2.in` or `power3.in` for anything leaving.

## Vocabulary

| helper | does | timing |
| --- | --- | --- |
| `F.popIn(tl, sel, at, {fromScale, fromY, shown})` | a card arrives | scale 0.95 → 1 and y 24 → 0 on `UI_IN`; opacity over 0.22 s. `shown` skips the fade |
| `F.popOut(tl, sel, at)` | a card leaves | 0.22 s: opacity 0, scale 0.96, blur 8 |
| `F.rowIn(tl, sels, at, stagger, from)` | rows land in reading order | 0.5 s, x −14 → 0; stagger 0.07–0.09 s |
| `F.pop(tl, sel, at)` | a chip pops | scale 0.6 → 1 on `POP` |
| `F.swap(tl, from, to, at, origin)` | one status becomes another in place | the old one blurs out over 0.14 s; the new one pops 0.06 s later |
| `F.capIn / F.capOut(tl, sel, at)` | caption words | in: blur 10 → 0, 0.06 s apart. Out: 0.025 s apart. No movement |
| `F.path(tl, cur, [[t, x, y, ease?], ...])` | a cursor travels | about 0.8 s per move, `power3.inOut`, then rests |
| `F.click(tl, cur, btn, at)` | press | the cursor goes to 0.86 for 0.07 s then back over 0.22 s; the button goes to 0.95 and springs back |
| `F.type(tl, host, [["text", "class"]], at, gap)` | typing | 32 ms a character; returns the end time |
| `F.count(tl, sel, a, b, at, dur, fmt)` | a number runs | a proxy tween writes the text. Never use `tl.set(el, {textContent})` |
| `F.drift(tl, sel, at, dur)` | camera drift on the held result | scale 1 → 1.03, linear |
| `F.focus(tl, keep, dims, at)` | one item steps forward | the others go to 0.35 opacity and 0.97 scale; the kept one goes to 1.04 |
| `F.through(tl, stage, at)` | the cut | the stage goes to scale 1.3, blur 14 and opacity 0 over 0.32 s, `power3.in`. Starts at `F.dur(id) - 0.34` |
| `F.iris(tl, stage, at)` | into the end card | an ink circle opens from 0% to 75% over 0.6 s |
| `F.cues(id)`, `F.dur(id)`, `F.first(id)`, `F.beat(n)` | timing | the cue times by name, the scene's length, whether it's frame 0, and n beats in seconds |

## Rhythm in a shot

A shot runs: **arrive, read, act, result, hold, cut.**

| step | when |
| --- | --- |
| caption A | 0.05 s |
| the main card | 0.12 s |
| its rows | 0.3 s |
| the action | about 1.5–3 s in |
| caption B | about 0.22 s after A starts leaving. B says what changed |
| the result | 0.1–0.3 s after the action |
| drift | through the hold |
| cut | on the beat |

- **Only one thing leads at a time.** If a card is arriving, the caption is already still. If the cursor is moving, nothing else enters.
- **Exits take about a third as long as entrances.** Things leave faster than they arrive.
- **Repeats land on a beat.** For tickets, tries or checks that repeat, space them at a beat or half a beat (`F.beat(0.5)`) so they ride the music.

## Camera

Each shot gets one move.

- **Push-through.** Every shot ends this way. The stage scales past the viewer and blurs out, and the next shot is already arriving.
- **Drift.** A slow 3% push while a result holds.
- **Focus.** Use this when the story narrows from many things to one: three tickets, then the one we build.
- **Iris.** Only into the end card. It sits on its own track and overlaps the last shot by 0.4 s (`"overlap": 0.4` in `film.json`).

Never pan, orbit, tilt in 3D or zoom twice in one shot.

## Rules that broke the last film

- **Frame 0 is the thumbnail.** The first shot's card starts on screen (`{ shown: F.first(id) }`), and its rows start at 0.75 opacity.
- **Hide starting states with `fromTo`,** which renders at once, or with `gsap.set` outside the timeline. Never use `tl.set` at time 0.
- **Prefix every id with the scene id.** All scenes share one page. For two labels stacked in one spot, put the later one on `data-layout-allow-overlap`. Put cursors on `data-layout-allow-overlap data-layout-allow-overflow`.
- **Watch CSS specificity.** `#card > div { left: 44px }` beats `.chip { left: auto }` and moves the wrong thing. Use `#card > #thing` or a direct class rule.
- **Accent across several words:** start with `*` on the first word and end with `*` on the last: `*Keep or revert.*`.
- **Never tween `display`, `visibility` or `autoAlpha` on a `.clip`.** Animate a child. Typing uses `tl.set(char, {display: "inline"})` on each character inside the stage, which is fine.
- **A swapped status sits in a fixed-width box,** right-aligned and absolute, so the row doesn't reflow when its width changes.
