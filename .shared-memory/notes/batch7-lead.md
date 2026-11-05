# Batch 7 lead merge (2026-11-05, claude-lead)

Branches merged into batch7-merge in this order: fortress (42f2f0f), polish (a947248), wither-boss (2154d89), dimensions (a81240a), dragon (ba8f285). The track notes are dimensions-track.md, dragon-track.md, fortress-track.md, polish-track.md and wither-boss-track.md.

## Conflict resolutions (unions)
- commands.js SUMMONABLE: `FireworksRocketEntity`, `WitherBoss: "wither"` and `EnderDragon: "ender_dragon"` are all kept.
- region-export.js NAMES: adds `wither: 'WitherBoss'` and `ender_dragon: 'EnderDragon'`.
- main.js tickSurvival: the dimensions version (`dims.tick`, portalTimer, `dims.portalFrame`) is kept, plus `sleeping: bedSleep.sleeping` from 684ab0d.
- maps-clock-live.js: the clock and map work only on the surface (`world.dimension === 0`).

## Lead wiring after the merge
- Sounds: the mob.enderdragon growl, hit, wings and end clips were imported in scratch and merged additively, for 473 clips (media.test.js).
- dragon-renderer.js: `createDragonRig` now calls `renderer.scene.add(root)`. Without it the dragon was invisible. `animateDragon` feeds `setBossStatus` every drawn frame.
- living-simulation.js `drainMobEvents`: a `push` hook for `event.dragonPush`. main.js adds the push to the player velocity.
- dimension-world.js `endCrystals(r = 10)`: endChunk drops populated entities, so the crystals are collected by repopulating the chunks within r. main.js `launch` turns them into `ender_crystal` mobs and calls `spawnDragonIfAbsent` when `dims.onDragonSpawn` fired. That happens on the first End entry only, through `record.dragonSpawned`.

## Checks
- npm test: 3064 pass. npm run build: ok.
- Browser on :5181 ?silent, fresh creative world, `__mc.travel(1)`: the dragon spawns at 0,128,0, flies, picks a healer crystal and renders with its wings. There are 14 or 15 crystals on the spikes, the Ender Dragon boss bar shows, and the console has no errors.
- Crystal and dragon saves were rechecked and work: the 3:01 check world reopened in the End with all 14 of its generated crystals and the dragon where it was left. The earlier "6 crystals" world was a pre-merge track world sharing the :5181 browser storage. `dimension-live.test.js` covers the save round trip.

## Gaps / follow-ups
- No natural Nether or End mob spawning. `FORTRESS_SPAWN_LIST` / `fortressMonsterSpawnList` are not wired.
- Nether population approximates the carried-over chunk Random. The bed explosion is written from the source, not probed. getMaxInPortalTime is 0 in Creative.
- Missing: the End lightmap override, the credits screen, followers through portals, the saved portal counter and DIM-1/DIM1 region import/export.
- Dragon: the model is from the source and not probed, and death rays are not drawn. Arrows and explosions route to the nearest part. A dying dragon is not saved, and `Math.log` may differ by one bit.
