# Sound

The sound-effects skill does the measuring and mixing. This page says what this film style wants from it.

## Music

- **The feel.** Warm, calm pop or lo-fi, 100–125 BPM, a steady kick, no vocals, nothing that drops or builds hard. The music sits under the effects. For the `music_style` in the sound-effects skill's `MUSIC.md`, go for "calm", "corporate", "lofi" or "pop". Offer the user 2–3 tracks and let them pick.
- **The licence.** Ask where the film will be posted, and record the track, the artist, the link and the licence. Mixkit's free music allows YouTube, social posts, ads and education. It doesn't allow Content ID registration, TV or games. Download the track into the film's `sound-effects-cache/` at run time, and never commit it.
- **A track the user names.** Check its licence page first. Many free beats are non-commercial only and need a credit. Never rip audio from YouTube. The user downloads the file from the producer, and you build from that file.
- **Trim the track to its beat.** Find the first strong downbeat after any intro that has no beat. Cut the track from there, and fade it in and out:
  ```
  ffmpeg -ss <downbeat> -t <film length + 1> -i track.mp3 -af "afade=t=in:d=0.35,afade=t=out:st=<film length - 1.6>:d=1.6" sound-effects-cache/music.mp3
  ```

## The beat

1. **Get the beat.** Run the sound pass once on the silent master. Its log gives the beat period, and `beatgrid.png` shows the grid against the kicks.
2. **Check it.** Look at `beatgrid.png`.
3. **If librosa drifts or locks onto the off-beat,** measure the beat another way:
   - autocorrelate the onset strength to find the period
   - score each candidate phase by the onset strength at its grid points
   - keep the phase with the highest score
4. **Write it in.** Put `"music": { "file": "sound-effects-cache/music.mp3", "beat": <seconds>, "first": <time of a downbeat in the trimmed file, usually 0> }` into `film.json`.
5. **Snap the cuts.** Run `build.mjs` again. Every cut snaps to the nearest beat, scene lengths change by at most half a beat, and `cues.json` follows.
6. **Re-render.** Render the silent master again before the final pass.

## Cues

Each scene lists its cues in its `<id>-cues` block as `[t, type, what happens, name]`. `build.mjs` adds a `scene_cut` at every cut and writes `cues.json`.

| on screen | cue type | sound |
| --- | --- | --- |
| a push-through cut | `scene_cut` (automatic) | a short whoosh, 2 frames early |
| a card or chip arrives | `appear` | a pop |
| the cursor clicks | `click` | a click |
| a command is typed | `typing`, with `"dur"` set to the typing time | quiet keys |
| a line is struck, a row lands, an item is met | `hover_or_small_ui` | a very quiet tick |
| a status turns done | `success` | a pop, louder |
| a run starts that ends on a payoff | `build_up` | a riser that **ends** on the payoff |
| the payoff, and the logo | `reveal` | the impact, **at most twice in the film** |

Keep it sparse: about one cue a second on average. When a row of items lands, cue the first and the last, not every one. Leave a beat of quiet before a `reveal`.

## The pass

```
<venv>/bin/python <sound-effects>/scripts/sound_pass.py \
  --video renders/<name>-silent.mp4 --cues cues.json --music sound-effects-cache/music.mp3 \
  --manifest <sound-effects>/sfx/manifest.json --out sound/ \
  --use-case "<where it's posted>" --music-source "<track, artist, link>" --music-license "<licence>"
```

The pass should end at about −16 LUFS integrated, with the true peak below −4 dBFS, in stereo and in mono. Copy `sound/after.mp4` to `renders/<name>.mp4`.

If the pass picks a music offset that fights the grid you measured, pin the offset to 0 in a copy of the script. The grid you checked by hand wins.

Report these to the user:

- the per-cut beat error in ms
- LUFS and peak
- the music licence, and whether it's confirmed
- `sound/report.html` for swapping sounds
- `CREDITS.txt`
- 5 timestamps to check with headphones: the first cut, the typing, the riser into the payoff, the payoff, and the logo
