# audio3 (batch 19) track

## Summary
Listener, sound bookkeeping and panning, from the unchanged 1.7.10 client. Details in `public/research/sound.md` (Round 3).
- Listener (`SoundManager.setListener`) replayed: interpolated float position, look/up vectors. The port's listener now interpolates
  `previous -> position`, drops the sneak `ySize` and passes pitch. Sneaking is only the 0.08 `posY` drop.
- `SoundBookkeeping` (`src/sound-bookkeeping.js`) ports update / isSoundPlaying / stopSound / delayed / tickable / repeat. `SoundBank.isPlaying`
  uses it, so MusicTicker sees the 20-tick quirk (not playing for 20 ticks, then playing until removed; end seen one tick late).
- `stereoPan` is now azimuth/90 degrees in the OpenAL listener frame; mono clips only; streams and stereo clips unpanned.
  GUI clicks are panned toward the world origin while a world is open.
- S29 range filter and source exclusion encoded (`broadcastRange`, `receivesBroadcast`), unit-tested, not wired (no audible change in
  single player).
- `src/moving-sounds.js`: minecart sound formulas, not started (no clips).

## Native evidence
Probed natively (no audio device): `tools/probes/AudioProbe3.java` via `node tools/verify-audio3.mjs` -> `public/research/audio3-reference.json`
(40 listener cases, 3 bookkeeping traces of 2100 operations, 160 minecart ticks), compiled into `audio3-probe/` of the research dir.
Bytecode-read only: run-loop order of MusicTicker and SoundHandler, no AL_SOURCE_RELATIVE, S29 range and exclusion, StreamThread
start timing, mono-only OpenAL placement. Assumed, unverified: OpenAL Soft's panning law and speaker angles.

## Tests
`src/audio3.test.js` (10 tests); `src/sound.test.js` pan test relaxed. See the final run in the commit message.

## Remaining gaps
OpenAL Soft pan law unverified against a device; S29 filter not wired to call sites; minecart sounds need clips; stream start timing
not modelled; Random draws of other World ticks between mood draws; listener rotation is the per-frame look.

## Proposed remaining-gaps lines
14. Music and music discs/jukebox record audio. Partial: MusicTicker, Music slider, pause/stop rules and positional records are in ([music.md](music.md)); paulscode gain, channel takeover, interpolated sneak-aware listener, isSoundPlaying's 20-tick rule and the update pass are probe-replayed ([sound.md](sound.md)). The 41 streams are not in Git (`npm run music:fetch`), so music is silent without them. OpenAL Soft's panning law is an assumption and stream start timing is not modelled.
15. Cave ambience (`ambient.cave.cave`). Unchanged from b18: other World Random draws between ticks are not in the stream.
16. Minecart moving sounds. Formulas probe-replayed ([sound.md](sound.md)); not audible because the manifest has no `minecart.base` / `minecart.inside` clips.
