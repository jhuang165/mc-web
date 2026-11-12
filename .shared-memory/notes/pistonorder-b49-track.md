# Batch 49 pistonorder track

## Summary

Branch `batch49-pistonorder`, cut from ac7027870 (release 0.77.0).

- Live tile order. `World.updateEntities` (ahb, bytecode-read with `javap -c`): the `global` (weather) loop, then `regular` entities, then `blockEntities`. The live tick ran the piston tile loop (`redstone.endTick` -> `updateTileEntities`, then `pistons.tick()`) before the mob update. Now `endTick(deferTiles)` / `tickEnd(deferTiles)` skip the tile loop when `world-tick.js` is given `deferTiles: true` (main.js), and `redstoneRuntime.tickTiles()` runs `updateTileEntities`, `pistons.tick()` and `flush` from `mobs.afterEntities` (the b48 hook: after every entity, before the server copy's update). `main.js` also calls `tickTiles()` after `tickLivingSimulation` as a fallback; it is a no-op when the hook already ran. Block events and the plate/sensor scan stay before the walk. The multiplayer simulation and the non-tree path keep the old full `tickEnd`.
- Away run: `away-world.js` already ran `ents.tick()` and then `live.updateTileEntities()` / `rt.pistons.tick()`, so it has the native order (the test pins it).
- New record set `b49po` (12 records, executed, `public/research/enderman-wolf-b49po-reference.json`): a cow and a zombie standing on a block pushed east, a cow on a block pushed up, a retracting block, a spider east / into a wall / lifted into a ceiling, a size 4 slime east and lifted, an iron golem east / into a wall / standing on the moved block. New probe types `B` (spider, yn) and `I` (size 4 slime, ym, jump timer bn fixed to 20). All 12 replay with no divergence.
- Port fix found by the new records: spiders, cave spiders, slimes and magma cubes use the legacy body turn (`EntityLiving.isAIEnabled` sw.bk is false; yn, ym, yf do not override it, bytecode-read), not the AI body helper. They were in `LEGACY_BODY` only for the enderman. Executed: spider and slime body yaw in b49po (bodyYaw diverged at tick 23 / 35 before). Cave spider and magma cube follow by inheritance (bytecode-read, not executed).
- Pushing itself needed no change: mobs on top of a moved block, and large mobs, already match (a golem standing on the block is not carried, a cow and a zombie are; the box test decides).
- b46mp hacks (`hurtByTime = clock + 1`, `sent = null`): kept. They are about the b46mp records' own scripts (the copy's hurt-by timestamp and the C03 packet state before the b47 client separation), not about tile order, so the right order does not remove them; removing them still needs b46mp regenerated.

## Verification

- `EW_SET=b49po node tools/verify-endermanwolf.mjs` -> 12 records.
- `node --test src/piston-order-b49.test.js`: 14 pass (12 records, coverage, live-hook wiring).
- Targeted `node --test` on piston*, enderman-wolf-*, mobpush-b46, serverplayer-b47, redstone-live, away-*, entities* and every test mentioning renderYawOffset/bodyYaw: 788 pass, 0 fail.
- `npm run build` ok. Not run: full `npm test`; no browser check (the order change is not visible on screen).

## Follow-ups

- The live order is wired in source and checked by source-pattern tests only; there is no executed live-loop test of mob-then-tile order.
- Magma cube / cave spider legacy body is inherited, not recorded. Silverfish, giant, blaze are not in `LEGACY_BODY` and were not probed.
- The client player's own piston push (pushPlayer) still happens in the tile loop, now after the entity walk; native client/server split is not modelled.
