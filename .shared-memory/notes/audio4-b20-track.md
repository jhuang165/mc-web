# audio4 (batch 20) track

## Summary
- Minecart clips (`minecart/base`, `minecart/inside`) imported into the manifest; `src/cart-sounds.js` starts the probed
  MovingSoundMinecart / MovingSoundMinecartRiding, `SoundBank.playMoving` loops them. One hook in `src/main.js` (sound tick loop).
- S29 range wired: `src/sound-origin.js` + `SoundBank.play` drop positioned world sounds beyond `broadcastRange` of the feet
  (client-made sounds exempt). Double-play audit: no doubled player sounds, because the client world's IWorldAccess sound methods are empty.
- `updateVolumes` now follows `SoundManager.setSoundCategoryVolume`: only the moved category's sounds are stopped at volume 0.
- Importer: `minecart/` and `ambient/cave` prefixes, `MC_ASSET_OBJECTS` local-objects option.

## Native evidence
Bytecode-read (javap): `bjf.d` / `bjk.a` (start of the moving sounds), `bma` empty playSound methods, `ahb` playSoundAtEntity /
playSoundEffect, `mp` (WorldManager S29, except variant), `btj.a(w, float)` and the two `getNormalizedVolume` overloads, `btj`'s
paulscode configuration. Nothing new probed natively; the minecart formulas stay replayed from `audio3-reference.json`.
Asset hashes are those of the 1.7.10 asset index (local launcher copy). Extracted classes sit in `audio4-scan/` of the research dir.

## Tests
`src/audio4.test.js` (7). Full run in the commit message.

## Remaining gaps
Stream start timing not modelled (paulscode jar absent, no streaming config in the JAR). `random.wood_click` not imported (unused by 1.7.10
code). The S29 filter is by event name, not per call site; the loop is Web Audio, not OpenAL. The importer does not reproduce the
committed manifest's key order. Cart sounds start for every cart in the port's list (no client entity-tracking range).

## Proposed remaining-gaps lines
16. Minecart moving sounds. Clips imported; the probed MovingSoundMinecart / ...Riding start and loop ([sound.md](sound.md), Round 4). The loop runs in Web Audio and carts outside the client tracking range also sound.
14 (tail). The S29 range filter is wired by event name; stream start timing is not modelled (no paulscode streaming configuration in the JAR).
