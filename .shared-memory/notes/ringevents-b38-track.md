# Ring events track (batch 38, branch batch38-ringevents)

## Summary
- **Native evidence.** `public/research/ring-events-reference.json` (bytecode-read with javap on `mn` EntityTracker, `mt` WorldServer, `xe` EntityFishHook, `zf` EntityFireworkRocket, with class hashes; nothing executed): tracking ranges per entity type, the S2A particle range (16 blocks, only the fishing hook calls it) and the S27 explosion range (64 blocks).
- **Findings that changed the brief.** Fireball and wither skull gating (batch 25) and positioned ring sound routing through `dropFarEvents` plus the S29 filter (batch 24) were already in place, and loot pickup already ran only after the `isActive` test. The "ring particles culled at 16" gap is the native client cull (`RenderGlobal.doSpawnParticle`), not a shortcut. I added tests for all three instead of code.
- **Changes.** New `src/ring-events.js` (tracking table, square test, S27 range). Explosion burst only for a player within 64 blocks (`explosion-simulation.js`, 2 lines). Status 2/3 client sounds (`EntityWorld.drainClientSounds`) only for a mob inside its tracking square (`entities.js`, 3 lines; `watching` is set in `tickMobs`). `FireworkRockets.tick` takes `ringActive` and `tracked` hooks, passed from `main.js` (1 line plus an import).
- **Docs.** "Batch 38" section in `public/research/natural-spawning.md`.

## Verification
- `node --test src/ring-events.test.js`: 6 tests, 0 fail (tracking table against the reference record, ring ghast and zombie sound ranges, status-sound tracking, explosion burst range, rocket gate, loot pickup at the rim).
- Also green: ring-ticks, module-names, mob-griefing, mob-equipment, fireworks, explosion*, damage-fx, audio4 (78 tests); combat, entities, living-simulation (33 tests). Full `npm test` and `npm run build` were left to the lead.
- Browser (muted headless Chrome through Playwright, `?silent`, `--mute-audio`, port 5385, `artifacts/b38-ringevents/ring-sounds.mjs`; load average about 5): `sounds.play` replaced by a counter so nothing played. New world, 576 held ring columns, 53 ring mobs updating; in 40 s 889 sound dispatches, 480 of them from mobs outside the resident ticking window (zombie and skeleton say/step, cow, spider, bat), one at 95 blocks (dropped by the S29 test in the real `SoundBank.play`). Only a 404 resource console message, no page errors. The ghast placement step found no free spot, so ghast ranges are covered by the node test only.

## Follow-ups (proposed gap lines)
- Tracking uses live positions and no update-frequency delay (native: encoded 1/32-block positions every 3 to 20 ticks).
- Dragon wing sounds and other client sounds with an untyped position skip the tracking test.
- Fishing-hook S2A particles are not modelled separately.
- Rocket launch and blast sounds are exempt from S29 by the existing `fireworks.` rule; the launch is server-side natively (range 48).
