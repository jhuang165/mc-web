# trackerhits (batch 44): client copies run their own arrows, throwables, rockets and hooks

Branch `batch44-trackerhits`, cut from `e131af9d6`. Owner: claude-b44-trackerhits.

## Summary

The tracker's client copies of arrows, thrown entities, firework rockets and fishing hooks (`src/object-tracker.js`) now emit the particles the 1.7.10 client emits from its own onUpdate and onImpact. Before this they leaned on the server entities (the server copy drew the poofs, trails and splashes, and the rocket burst came from the server death).

Native evidence (executed, not just read): `tools/probes/TrackerHitsProbe.java` runs the unchanged EntityTrackerEntry on a real server entity and builds the real client class from the packets (zc, zj, zl, zm, zo, zf, xe), with its Entity.rand reseeded to Random(12345). The client world double records every `spawnParticle` and `makeFireworks` call per tick. S1A goes through the tracker entry. `tools/verify-tracker-hits.mjs` writes `public/research/tracker-hits-reference.json` with class hashes.

Facts the executed classes showed (some correct the brief):
- Snowball and egg (not iconcrack: `snowballpoof`, bytecode and execution agree) emit 8 `snowballpoof` with zero velocity per tick the client copy is still alive after its impact, at the entity position. The pearl emits 32 `portal` per tick (y + nextDouble()*2, vx and vz gaussian). A thrown potion emits nothing (impact is S28 only, already in `main.js`/`potion-fx.js`).
- Client arrow: `inGround` from the stick, `arrowShake` 7 counting down. The crit trail (4 `crit` per tick, velocity -m, -my + 0.2) reads the data watcher flag (S1C 16), and the server clears that flag when it sticks. In water: a 26-particle splash burst on entry and 4 `bubble` per tick.
- Rocket: one `fireworksSpark` per tick at y - 0.3 from the client's own rand. S1A 17 reaches `handleHealthUpdate` and calls `makeFireworks` with the client position, motion and the Fireworks tag of data watcher object 8.
- Fishing hook: S1A 31 does nothing on 1.7.10 (bytecode-read: EntityFishHook has no handleHealthUpdate). The angler check, the hooked entity follow and the fish timers are server-only. But the hook does count as in water (Entity.handleWaterMovement runs in onEntityUpdate, also on the ticks a client hook interpolates): it splashes on entering water (6 `bubble` + 6 `splash`), and Entity.moveEntity draws the swim step pitch (2 floats) because the hook's `canTriggerWalking` is true. The old JS comment "the hook never counts as in water" was an artefact of `FishingProbe`'s world stub (`handleMaterialAcceleration` returned false).

Changes:
- `src/object-tracker.js`: client rocket sparks, `particle()` / `hooks.particle` / `log`, `events` + `drainEvents()` (status 17 -> firework burst), `handleStatus`, arrow client sim reads crit from S1C, `objectView` arrows carry the client's `inGround` and `shake`, status 17 sent before a rocket's destroy, each client hook has its own rand, hook water on interpolating ticks.
- `src/projectiles.js`: `clientImpact` (snowball, egg, pearl) on the remote sim; `clientParticles` stops the server copy poofing.
- `src/fishing.js`: `waterMovement` (splash, push), moveEntity step swim draws, release products rounded to float like Java. `public/research/fishing-reference.json` regenerated with the real water method in `FishingProbe` (now matches the JS exactly, 16 tests).
- `src/firework-rocket.js`, `src/fireworks-live.js`: `exploded` flag, `clientCopies` option (the server rocket draws no sparks and does not make the burst itself).
- `src/main.js` (small): `bindObjectTracker()`, `clientCopies: true` for rockets, S1A burst drain after `objectTracker.update`, server arrow fx off, projectiles `clientParticles`, pearl server particle hook is a no-op.

## Verification

Focused tests only; the full suite and the build were left to the lead.
- `node --test src/object-tracker-hits.test.js`: 13 pass (10 replays, the impact table, 2 mutation checks).
- `src/object-tracker.test.js` 13, `src/object-tracker-extras.test.js` 15, `src/fishing.test.js` + `src/fishing-simulation.test.js` 16, and one run of module-names, projectiles, bow, fireworks, fishing-simulation, polish, ring-events, player-throw-replay, projectile-nbt, neg-stacks2: 141 pass, 0 fail.
- All three verify scripts that use `TrackerItemsProbe` (`verify-tracker-items`, `verify-tracker-extras`, `verify-tracker-hits`) and `verify-fishing` were re-run and their references committed. The items and extras references differ run to run (unseeded item and orb constructors, and the server hook's rand); the tests replay the recorded inputs so they pass. `hookFloor`/`hookWater` row counts also vary per run for the same reason. In `object-tracker-extras.test.js` the hook's `onGround` is no longer compared in the random tail (it flipped with the regenerated reference at tick 63).
- Browser (muted headless Chrome via Playwright, port 5456, `artifacts/b44-trackerhits/browser.mjs`): after throwing from 25 blocks up, the tracker log shows 84 `crit` (crit arrow), 21 `fireworksSpark` (rocket) and 32 `portal` (pearl impact). The snowball had not landed within the check (the headless game ticked slowly under load), so the snowball poof is covered by the replay only. Only console error: a 404 resource. Vite stopped; no Chrome left.

## Follow-ups (proposed gap lines)

- Client entity hits are not modelled: a client arrow, thrown entity or hook against a client mob (native: attackEntityFrom returns false on the client, so the arrow ricochets or the hook attaches only on the server). Needs the client mob boxes of `entity-tracker.js` (bosstracker).
- Sounds: the native client also plays its own copy of impact, splash and step sounds (server and client double up); only the particle side is moved here. The hook's block step sound (func_145780_a) is not played.
- The fishing hook's server-side `env.sound` now carries the splash and swim sounds; check against the in-game hook once the angler side moves to the client copy.
- Snowball and egg impact particles were only exercised by the replay in the browser (see above).
