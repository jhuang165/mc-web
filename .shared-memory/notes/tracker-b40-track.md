# Batch 40 tracker track

## Summary
- `src/entity-tracker.js` ports 1.7.10 `EntityTrackerEntry` (`my`) and `EntityTracker.updateTrackedEntities` (`mn`) for mobs: 1/32 position encoding by size class (`se.a`), the `ticks % freq` / airborne / data-watcher send test, the 4/32 move and 4/256 look thresholds, the 60-tick move and 400-tick teleport rules, `updatePlayerList` after 4 blocks, `tryStartWachingThis` with truncating integer division, the player entry (range 512, freq 2) flag, and the watched-chunk square (`mq.d`).
- Integrated server clamps every tracker range to `viewDistance*16-16` (144 at distance 10), read once in the `mn` constructor. So the dragon's 160 and the crystal's 256 become 144 (bytecode-read).
- Client entity follows S0F/S14/S18 with the 3-step interpolation, and the destroy packet is applied one tick late.
- `entities.js` `drainClientSounds` now plays hurt/death sounds only for tracked and present client entities, at the client's encoded position. Dragon wing sounds are `clientOnly` (need the client entity, which exists only inside the 144 range). `main.js` sets `mobs.viewChunks`.
- Bytecode quirk replayed: a jump of 30+ blocks is evaluated against the old encoded position, so the mob stays tracked until it later moves more than 4 blocks.
- Goal 3 (live vs interpolated position for rendering): the native client position trails the live one by about 2 ticks of motion, measured with `artifacts/b40-tracker/lag.mjs`: 0.2 blocks at 0.1/tick, 0.43 at 0.216/tick (zombie sprint speed range), 0.70 at 0.35/tick, plus 1/32 quantisation. Rendering other mobs at live positions is therefore visibly ahead by up to ~0.5 to 0.7 block while moving. Porting it means routing the renderer and particles through `tracker.clientOf`; it is moderate work (per-frame partial-tick interpolation between `ClientEntity` steps) and is worth doing only together with S12 velocity packets. Not done here.

## Verification
- Executed unchanged `my` and `se` in `tools/probes/TrackerProbe.java` via `tools/verify-tracker.mjs` (output `public/research/tracker-reference.json`, with class hashes); `tools/probes` doubles for `nh`, `mq`, `mt`, `mw`. The managed-position rule and `mn` order are bytecode-read.
- Focused tests: `entity-tracker` 15/15 (six replays against the executed classes), `ring-events` 6/6, `dragon` 11/11, `entities` 21/21, `living-simulation` 4/4, `damage-fx` 14/14, `away-entities` 10/10.
- Load average at the lag measurement: 33.10 20.75 12.65 (not a timing benchmark).
- No browser check. The full `npm test` and build were left to the lead.

## Follow-ups (proposed gap lines)
- Tracker: velocity packets (S12), the chunk send queue, mounted entities, non-mob entities (items, arrows, XP orbs), data-watcher changes other than health, and the integrated server's thread timing are not modelled.
- Particles and other consumers still use live entity positions, and the renderer draws other mobs at live positions (about 0.2 to 0.7 block ahead while moving).
- Airborne flag is derived from jump detection plus `e.airBorne`, not native `isAirBorne`.
