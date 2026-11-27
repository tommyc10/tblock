---
name: film
description: "Make a calm, Apple-like film in code: a promo for a product or service, or a step-by-step video guide. Built with HyperFrames from real details in the source, one idea per shot, spring motion, push-through cuts on the beat, and a measured sound pass. Use when someone asks for a promo, explainer, walkthrough, how-to or launch video."
---

# film

Makes a short film in the style of the tblock films: warm paper, white cards, one caption at a time, a cursor that does the one thing a person does, springs that settle and then stay still, a push-through cut on every beat of the music, and an ink end card. It's calm. Nothing shakes, flashes or spins.

This skill fixes **how the film moves, cuts and sounds**. The **colours, type and logo** belong to whatever the film is about. Take them from the source: its CSS tokens, Tailwind config, logo file, or a `brand.md` or `MOTION.md` if the project has one. Without a brand, keep the kit's defaults, which are tblock's own (warm paper with a pink-to-amber accent).

## Two formats

| | promo | guide |
| --- | --- | --- |
| For | a product, service or feature, on launch day or in a README | how to do one thing, step by step |
| Length | 30–45 s, 6–8 shots of 4–7 s | 45–120 s, one shot per step, 6–10 s each |
| Story | one sentence split across the shots; the end card asks for one action | "Step n of N" on every shot; each step does one thing and shows its result; a recap ticks every step off |
| Captions | say what the shot shows, last word in the accent | an instruction: "Run the install command." |
| Hold | the result holds 0.4 s or more before the cut | the result holds 1.5 s or more, so a viewer can copy it |

## Needs

- The [hyperframes](https://github.com/heygen-com/hyperframes) skill, to build and render. Install it with `npx skills add heygen-com/hyperframes`.
- The sound-effects skill, for the sound pass. Install it with `npx skills add Barty-Bart/motion-graphics` and pick `sound-effects`.
- Node 18+, ffmpeg, and Python 3.10+ for the sound pass.

Check which ones are there before starting. Ask before installing anything.

## The work loop

1. **Brief.** Get four things, and ask only for what the source can't tell you:
   - the format
   - who watches it
   - where it's posted (the music licence depends on it)
   - the one thing the viewer should do at the end

   Then read the source for real names: commands, endpoints, file names, ticket ids, screens, settings. A film made of real details reads as true. A film of placeholders reads as an ad.
2. **Story.** Write the one sentence. Split it into shots. For each shot, write down:
   - its caption, 7 words or fewer
   - what's on screen
   - the one action
   - the result

   Pick each shot from [SHOTS.md](SHOTS.md). Write it all to `SPEC.md`, with a list of what's real and what's illustrative. Tell the user the shot list in a few lines and carry on. Changing it later is cheap, because every timing lives in `film.json` and each scene's cue list.
3. **Scaffold.** Make the film's folder, copy [kit/film.json](kit/film.json) into it, list the scenes, and run `node <this skill>/kit/build.mjs` from that folder. That one command:
   - writes `index.html`, `assets/timing.js` and `cues.json`
   - copies `film.js` and `film.css` into `assets/`
   - fetches the Geist fonts
   - makes any missing scene from [kit/compositions/scene.html](kit/compositions/scene.html), or from [kit/compositions/end.html](kit/compositions/end.html) for a scene called `end`

   Run it again after every change to `film.json` or to a scene's cue list.
4. **Build each shot.** Use the recipe from [SHOTS.md](SHOTS.md) and the helpers and rules in [MOTION.md](MOTION.md). Each scene declares its beats once, in its `<id>-cues` block. The timeline reads those same times by name, so the picture and the sound stay together. Put the brand's tokens into `assets/film.css`.
5. **Check.** Run `npx hyperframes check`, then snapshot every shot at its key moments: just after each action lands, the held result, and halfway through each cut. **Look at every frame.** Fix these:
   - overlaps
   - wrapped lines
   - any text under 28 px
   - contrast that fails
   - a caption that doesn't stay up long enough to read
   - an empty frame 0

   Repeat until the check passes and every frame reads.
6. **Music.** Pick the track and find its beat as [SOUND.md](SOUND.md) says, then put `beat` and `first` into `film.json`. Run `build.mjs` again, which snaps every cut onto the nearest beat, then check again.
7. **Render** the silent master: `npx hyperframes render -o renders/<name>-silent.mp4 -q delivery`. Grain or gradients can bloat the file. If they do, re-encode with `ffmpeg -i in.mp4 -c:v libx264 -preset slow -crf 23 -c:a copy out.mp4`.
8. **Sound pass**, as [SOUND.md](SOUND.md) says. This gives `renders/<name>.mp4`.
9. **Review.** Write `REVIEW.md`, then report to the user:
   - the path to the film
   - what each shot shows
   - what's real and what's illustrative
   - the music, its licence and whether that's confirmed
   - the loudness numbers
   - 5 timestamps to check with headphones

   Claude can't hear the film or watch it in motion, so never say it sounds or looks good. Say what was measured.

## The look

- **Ground and cards.** The ground is warm paper (`--ground`), never pure white. Content sits on white cards with a 1 px line and one soft shadow. A dialog or sheet floats higher, with `.card.up` and a scrim behind it.
- **One idea per shot.** One caption at a time, top centre, 64 px, at most 7 words. The words that carry the idea take the accent: `data-text="It starts with a *meeting.*"`.
- **One accent, used at most twice per shot.** It goes on the caption word, the key chip, or the "you" cursor. Green means passed or met. Red means a removed line or a real failure, nothing else.
- **Type.** Geist and Geist Mono, unless the brand has its own. No text under 28 px. Nothing wraps: shorten the copy instead of shrinking the type. Use tight letter-spacing on anything large (-0.03 to -0.05 em).
- **People do the deciding.** A cursor with a "you" pill clicks the one choice a person makes. An agent or a second person gets its own cursor and pill colour (`.cursor.bot`). Everything else happens on its own.
- **Show the real thing.** The screen is built as HTML cards from real names: the actual command, endpoint, error or setting. Mark any number you made up as illustrative in `REVIEW.md`. Never pass it off as a result.
- **Still, then move, then still.** Every motion settles and stops. No idle wobble, loops, shake, flashes, glitches or spins. The camera makes one move per shot (see [MOTION.md](MOTION.md)).
- **The end.** The last shot cuts with an ink iris to a dark end card: the mark, one line, the one action, and the link.

## Guides

- Put `<div class="step"><b>2</b>Step 2 of 5</div>` on every step shot.
- The caption is the instruction. The card shows exactly what to type or click, using the real text.
- Then the cursor or typing does it, the result appears, and it holds.
- If a step can fail in a common way, show the right result, not the error. Put the fix in the video's description, not in the film.
- End with a recap shot: every step as a row, each ticking green on a beat. Then the end card.

## Don'ts

- Don't recreate another company's film, logo or look. Build this style from the brand you're given.
- Don't put a track ripped from YouTube or any unlicensed music in the film. See [SOUND.md](SOUND.md).
- Don't ship timing by feel. Cuts land on measured beats, and the report gives the error for each cut in milliseconds.
