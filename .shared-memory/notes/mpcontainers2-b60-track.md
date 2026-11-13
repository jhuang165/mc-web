# Batch 60 mpcontainers2: server hoppers, dispensers, lit furnaces, trapped chests, chest models

## Summary
- `src/multiplayer/server-container-ticks.js` (new): `ContainerTicks`. Runs `Hoppers` over the server's tile maps (8-tick cooldown, pull and push, item pickup, power disables via metadata bit 8). Installs the dispense engine for dispenser and dropper. A dispense the server cannot make (arrow, potion, fireball, firework, cart, TNT, egg) puts the stack back and sends nothing. Effects go as `aux` to players within 64 blocks. Trapped chest power comes from the viewer count; a count change notifies the neighbours and the block below. Container clicks tell comparators.
- `src/multiplayer/server-containers.js`: `smelted()` calls an `onFurnaceTake(player, stack, amount)` callback and spawns the smelting XP (it awards no achievement; mpcommands2 can wire the callback). Lit furnace sync (`lightFurnaces`, `contFurnaceLit` tick field). `ensureChest`, `adopt`, `describeAll` for chest descriptions. The S24 lid action now leaves in the tick of the click, one tick earlier than b59.
- `src/multiplayer/simulation.js`: short hooks only. Creates `ContainerTicks`, passes `hoppers` to `tickWorldSystems`, adds furnace light to the light callback, adds `chests`/`enders` to `tileEntities`, adds `contTiles` to `snapshot()`.
- `src/tile-sync.js`: `contChest` tile kind in `describeCell`, `describeTiles`, `applyTiles`.
- `src/multiplayer/client-containers.js`: `litFurnaceData`, `dispenserAux`.
- `src/main.js`: short hooks. Lit furnace data to `scene.setFurnaces` when remote. `applyTiles` gets the chest stores (tick and join snapshot). `onAux` plays 1000/1001/1002 and spawns the 2000 smoke.
- Tests: `src/mpcontainers2-b60.test.js` (9), `src/mpcontainers-b59.test.js` (lid test reads the click tick).

New wire items (all `cont`-prefixed or extensions): tile kind `contChest` (`{x,y,z,facing}` or `{x,y,z,ender:true}`), tick field `contFurnaceLit` (list of `x,y,z` keys), snapshot field `contTiles`. The existing `aux` message now also carries ids 1000, 1001, 1002 and 2000.

## Evidence
- Executed: all behaviour in `mpcontainers2-b60.test.js` against `DedicatedSimulation` (hopper chain with window updates, 8-tick spacing, item pickup, power disable, dispenser fire with aux, range filter at 64 blocks, unsupported stack restore, furnace light 13, trapped chest lamp, chest descriptions into a replica, `dispenserAux`).
- Bytecode-read: `World.func_147452_c`/sendToAllNear uses 64.0 blocks for aux. `RenderGlobal.playAuxSFX`: 1000/1001/1002 at the int corner with volume 1; 2000 spawns 10 smoke particles with `d = rand*0.2+0.01` and gaussian velocities.
- Bytecode-read: native sends no chest tile in the chunk packet. The client builds `TileEntityChest` from the block and its metadata, so a never-opened chest has a lid model. The gap is real. This port keeps chest facing in its tile record, so the server sends that record as `contChest`.
- Recalled: `BlockDispenser.onBlockAdded` resets facing to the neighbour rule (south by default). The test placed with `world.set` and saw south.
- Recalled: hopper and dispenser tick logic is the existing replay-verified code (`hopper.js`, `dispense.js`); this track only runs it on the server.

## Verification
- `node --test src/mpcontainers2-b60.test.js src/mpcontainers-b59.test.js`: 17 pass.
- `node --test` over the 23 files that import tile-sync, hopper.js or the multiplayer simulation/containers modules (accounts, block-sounds, client-screens, container-names, dedicated-beacon, hopper, itemtags2-b58, mp-dig-b57, mpcontainers-b59, mpitems-b59, mpmobs-b59, multiplayer-refusal, mpcontainers2-b60, multiplayer, mpeating-b58, mpstate-b59, mpsurvival-b58, ring-hopper-wait, ring-hoppers, serverbroadcast-b58, servercommands-b59, tile-edits, tile-sync): 158 pass, 0 fail (run before the `furnaceLit` to `contFurnaceLit` rename; the two test files that mention it were rerun, 17 pass).
- `npm run build`: passes (chunk size warning only).
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Dispensers cannot yet fire arrows, potions, fireballs, fireworks, minecarts, TNT or spawn eggs on the server; the stack is put back.
- Hopper minecarts are not handled.
- Generated structure chests with no record get one on first use or edit, not at generation.
- Comparator timing after a container change is simplified.
- `onFurnaceTake` needs wiring by mpcommands2 (the callback exists, nothing is connected).
- Only a browser could show: the furnace face and glow, the chest lid models, dispenser sounds and smoke, hopper window animation.
- Merge risk: `src/main.js` and `src/tile-sync.js` (short hooks). The S24 timing change affects any track that reads b59 lid ticks.
