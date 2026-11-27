# Shots

Each recipe is one scene. Start from [kit/compositions/scene.html](kit/compositions/scene.html), which `build.mjs` copies for you. Keep its shape: a caption, one or two cards, one action, a result, then the push-through. Names in `<>` are placeholders. Fill them from the source.

All sizes are for 1920 × 1080:

- Cards sit between x 140 and 1780, and below y 236, which leaves room for the caption.
- Two cards side by side: 720 + 880 wide with a 40 px gap, or 1060 + 540.

## 1. Document read

Use this when the story starts from something written: meeting notes, a spec, an incident report or a support ticket.

- **On screen.** A document card holds a file path in mono, a title, the people, and `##` sections with 3–6 lines.
- **The action.** A second actor's cursor (`.cursor.bot`) reads down the document:
  - noise lines are struck through: a 2.5 px bar scales x 0 → 1 over 0.32 s, and the text goes to `--ink-3`
  - the lines that matter get an accent-tint highlight that scales x 0 → 1 over 0.42 s, `power3.out`
  - each kept line gets a chip naming where it goes: a repo, an owner, a team
- **Timing.** Strikes 0.34 s apart. Highlights 0.45 s apart, each with a tick cue.

```html
<div id="nt-d0" class="nt-ln"><span class="tx"><span class="hl"></span><span class="t2"><real line></span></span></div>
<!-- .tx { position: relative } .hl { position: absolute; inset: 6px -12px 2px; border-radius: 8px; transform-origin: 0 50%; transform: scaleX(0);
     background: linear-gradient(90deg, rgba(255,77,109,.16), rgba(255,122,69,.16) 55%, rgba(255,196,87,.26)); } .t2 { position: relative } -->
```

## 2. Cards and a choice

Use this when something produces several options and a person picks: drafts, plans or results.

- **On screen.** Three 520 × 444 cards at x 140, 700 and 1260. Each card has:
  - a chip with where it goes, and a status box top right
  - a title, at most 4 words at 38 px
  - three short rows, each labelled in mono (`AC-1`)
  - a "cites line n" footnote
- **Arrival.** The cards pop in 0.12 s apart, and their rows land 0.08 s apart.
- **The choice.** A question bar (`.card.up`, 880 × 128) rises, with one primary button. The "you" cursor clicks it, the bar leaves, and each card's status swaps (`draft` becomes `#212`) 0.12 s apart.
- **The ending.** Use `F.focus` to bring forward the one the story follows.

## 3. Command and one yes

Use this for starting work with a command and approving it once.

- **On screen.** A prompt card (1100 × 196) holds a folder path in mono and the command, typed at 44 px. The command word is in `--accent-solid`. Then the send button presses.
- **The ask.**
  - a scrim (`rgba(ground, .62)`) fades in
  - a sheet rises: an icon and the asker's name, one sentence of what's being allowed (46 px), and one line of limits (30 px), with Deny (ghost) and Approve (primary)
  - you click Approve
  - the sheet and the scrim go, and a `granted` chip pops on the prompt card

```js
var end = F.type(tl, "#pn-text", [["/tool", "cmd"], [" do the thing #212"]], 0.45);
F.click(tl, "#pn-send", null, end + 0.2);
tl.set("#pn-caret", { opacity: 0 }, end + 0.25);
tl.fromTo("#pn-scrim", { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power2.out" }, end + 0.4);
F.popIn(tl, "#pn-sheet", end + 0.44, { fromScale: 0.93, fromY: 26 });
```

## 4. Work, then proof

Use this to show the hard part being done and proven: a fix, a migration, an integration.

- **Left card (720 wide).** What was pulled in for the job, as rows: a chip with a dot, and its kind on the right. The rows land 0.24 s apart.
- **Right card (880 wide).** The real diff, 2–4 lines in mono at 28 px. Removed lines are on `#fbeceb`, added lines on `#e9f6ee`, and one short comment is in green.
- **The proof.** Under a rule, one sentence says what the test does. Then two big numbers at 96 px: the thing that repeats counts up (`F.count`, 0 → 50 over 1.7 s, `power1.inOut`), and the invariant stays put in green (1). The invariant bumps to 1.12 once, when it first appears.
- **The result.** A `met` chip pops.

## 5. Verdict

Use this when work is checked against its goal: tests, criteria or a review.

- **On screen.** A checker card holds its criteria rows. `met` pops on each one 0.22 s apart, with a tick each.
- **The verdict.** The verdict chip pops.
- **The outcome.** An outcome panel rises (an MR, a deploy, a release) with its real name and branch. Its steps pop as green chips, and then its status swaps to the key chip (`merge-ready`) with a `reveal`.

## 6. Climb

Use this to show a number getting better through repeated tries: performance, cost or accuracy.

- **Chart card (1060 × 660).**
  - a title chip
  - the big current number at 110 px, tabular figures
  - a dashed target line in green
  - an SVG best-so-far line that draws itself segment by segment
  - one dot per try: kept tries are accent-filled, reverted ones are white with a grey ring
- **Log card (540 wide).** A `decision.tsv` header, and one row per try: the number, what was tried, then `kept` in green or `reverted` in grey.
- **Timing.** One try per beat or half beat. A kept try runs the big number down with `F.count` over 0.36 s. At the end, the delta chip pops (−83%) and then the goal chip.
- **SVG lines.** Set `stroke-dasharray` to the line's length and tween `attr: { "stroke-dashoffset": len }` to 0.

## 7. Close the loop

Use this when finished work goes back where it came from.

- **On screen.** A list card with one row per item: a chip, a title, an id, and a status box.
- **The action.** The statuses swap to `closed` 0.3 s apart.
- **The next item.** The row for the next item tints with the accent at 7%, and the next command slides in with a blinking caret. Blink it with `tl.set` opacity 0 and 1, 0.3 s apart, twice. Don't use `repeat`.

## 8. Step (guides)

One per step. The `.step` counter sits top left, and the caption is the instruction.

- **On screen.** One card with the real surface: a terminal, a settings panel, a form, or a config file.
- **The action.** Do it in one way only: `F.type` for a command or a field, or `F.path` plus `F.click` for a click.
- **The result.** The result appears in the same card, such as output lines landing or a toggle flipping. A `success` chip says what happened.
- **The hold.** Hold for 1.5 s or more with `F.drift`.

## 9. Recap (guides)

- **On screen.** Every step as a row: the step number in a dark circle, and the instruction.
- **The ticks.** The rows land, then each one ticks green one beat apart, with a tick cue on the first and the last.
- **The end.** Cut to the end card.

## 10. End card

This is [kit/compositions/end.html](kit/compositions/end.html).

- **Opening.** An ink iris opens over the last shot, and the mark lands at 0.45 s.
- **The text.** One line in grey, the action in a mono box with a `$` or an arrow in the accent, then the link.
- **Bloom.** A warm bloom rises from below over 2 s.
- **The mark.** Use the brand's real logo, as an `<img>` from `assets/` or inline SVG. If the logo is a bitmap or pixel art, drop it in point by point with `F.springEase(0.78, 0.42, 0.62)`, staggered 9 ms per column and 6 ms per row.
