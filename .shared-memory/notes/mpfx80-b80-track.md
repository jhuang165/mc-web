# Batch 80 mpfx80: client S27 block pass, server blast sources, client fireball smoke

## Summary
- New `src/multiplayer/client-explosion.js`:
  - `S27ClientBlocks` is the block half of `handleExplosion` / `doExplosionB(true)` on the multiplayer client.
  - `clientDropDraws` covers the World.rand draws of client-side ore and spawner drops.
  - `clientBallFx` / `ballWet` give a fireball or skull copy its own smoke and bubbles.
- `src/explosion-particles.js`: `burst` takes an optional `cell(bx, by, bz, r)` hook, called after each cell's explode and smoke particles (native order).
- Client (`main.js`, three small edits):
  - The RemoteDispense `explode` hook passes `cell` to the burst, which clears the listed non-air blocks and redraws them with `scene.updateBlocks`.
  - `applyMultiplayerTick` resets the per-tick memory, and `applyMultiplayerCells` notes each changed cell's old id and meta.
  - The new `ballFx` hook draws the smoke and bubbles.
- Avoiding the double apply: the port's `tick` message (the tick's block changes) is broadcast before that tick's per-player `dispFx` (server.js). Natively the S27 is sent first, inside `newExplosion`, and the S22/S23 changes follow at `updatePlayerInstances`. So a listed cell that the server changed in the same tick is seen with its pre-tick block (for the draws) and is not touched again: the server's newer state, such as fire from a flaming blast, stays. A listed cell the server did not change is cleared, as native does on a desynchronised client.
- Single player (`explosion-simulation.js`): the loopback burst makes the same ore and spawner draws between the cells' particles. The integrated client's world still holds the blocks when S27 arrives, and here the burst also runs before the blocks are broken.
- Server blast sources, audited:
  - Ghast fireball: the S27 was already sent through `drainMobEvents`. The bug was that the ServerMobs `explode` hook dropped `flaming`, so server ghast fireballs lit no fire. Fixed in `server-mobs.js`.
  - Wither skull, wither spawn blast and crystal (a player hit drains in the same tick): the S27 was already sent; tests added.
  - TNT minecart (`server-vehicles.js` cartHost): it called `mobs.explode` without `burst`, so no S27, particles, sound or push. Fixed.
  - Bed (server-sleep) and dispenser TNT (server-dispense) already sent theirs.
- Wither skull smoke (`wither-boss-mobs.js`, single player and server): `zp` has no `onUpdate` of its own, so `ze.h` holds. The smoke now spawns after the move, and there are four bubbles in water (new position minus a quarter of the old motion, moving with it). Batch 79 fixed only `fireballs.js`.
- Client fireball smoke: `RemoteDispense.ents` calls `ballFx(row)` for every `b` row. For fireball, smallFireball and witherSkull it spawns `smoke` at (x, y + 0.5, z). When the client's own water test passes it first spawns 4 `bubble`; the test uses the ball box (ze width) at the row's previous position, which is the start-of-update box. The motion is the row's position delta.

## Evidence
- Bytecode-read (javap -c -p, 1.7.10 jar):
  - `bjb.a(gu)` builds `new agw(world, null, x, y, z, size)` and runs `agw.a(true)`.
  - `agw.<init>` sets `b` (isSmoking) true and leaves `a` (isFlaming) false.
  - `agw.a(Z)`: the cell loop runs only when `b`. Per cell, the particles come first (when the argument is true), then for non-air: `aji.a(agw)` (canDropFromExplosion) -> `aji.a(ahb,IIIIFI)` with 1/size, `setBlock(air, 0, 3)` (`ahb.d(IIILaji;II)`), then `aji.a(ahb,IIILagw;)`.
  - Only `aob` (TNT, returns when `ahb.E` isRemote) and `ans` (stairs, delegate to the model block, a no-op) override onBlockDestroyedByExplosion. `aji.a(ahb,IIIIFI)` returns at once when isRemote.
  - Overrides that draw before their remote-guarded XP drop `aji.c`, from a sweep of all classes overriding the method:
    - `amn` BlockOre: `getItemDropped != self` gates the draw; coal (`ajn.q`) `qh.a(r,0,2)`, diamond (`ag`) and emerald (`bA`) `qh.a(r,3,7)`, lapis (`x`) and quartz (`bY`) `qh.a(r,2,5)`. Gold and iron drop themselves.
    - `amz` BlockRedstoneOre (73, 74): `1 + nextInt(5)`.
    - `ama` BlockMobSpawner: `15 + nextInt(15) + nextInt(15)`.
    - `qh.a(Random,II)` is one `nextInt(max - min + 1)`.
  - The other overrides check `ahb.E` first or draw nothing (`ajz` cocoa calls the guarded `dropBlockAsItem`).
- Bytecode-read: `zg.a(azu)` calls `newExplosion(null, x, y, z, (float)e, true, mobGriefing)`; `zp.a(azu)` calls `newExplosion(this, x, y, z, 1.0F, false, mobGriefing)`; `xv` calls `createExplosion(this, x, y, z, size, true)`. Of `ze`, `zg`, `zi` and `zp`, only `ze` defines `h()`. In `ze.h` the order is: move, `e()` factor, `M()` (in water) 4 bubbles at pos - v*0.25 with velocity v and factor 0.8, motion update, smoke at y + 0.5.
- Port-read: server.js sends `broadcast(tick)` before each player's `dispOut`, and the client applies messages in arrival order once ready. The crystal event from a C02 hit is drained in the same tick (actions run before `mobs.tick`).
- Not executed: no probe of a real client world's draws or of the client block pass.

## Verification
- `node --test src/mpfx80-b80.test.js`: 9 pass (ghast fire and S27, skull and crystal S27, TNT cart S27, client block pass with covered cells and draws, the draw table, the burst `cell` order, server-vs-client fireball smoke and bubbles over 25 ticks through water, skull smoke and bubbles, RemoteDispense hooks).
- Neighbours: explosion-particles, explfx79, mpdispense-b61, mpexplosion78, mpwither-b63/b64, wither-boss, wither-targets, mob-griefing, game-rules, player-knockback, mpprojectiles(2), spexec79, ring-events, hurt-drops-b49, spfixes75, fireballs-native/b41/b42/b43: 242 pass, 0 fail. Second batch (`node --test --test-concurrency=2 src/mpvehicles-b61.test.js src/mpvehicles3-b63.test.js src/mpvehiclehits-b67.test.js src/mpspawners2-b65.test.js src/mpsleep-b66.test.js src/skull.test.js src/mpfx80-b80.test.js`): 72 pass, 0 fail. `npm run build` passes. No old test encoded the fixed gaps. No full npm test, no browser.
- Pre-existing, not from this track: `src/explosion-simulation.test.js` never finishes (test 1 spins at full CPU; the file-level 60 s and 90 s timeouts cancel it). It does the same with every b80 source change reverted, so it already happens on the b79 lead base 6c0bf72a3. Not investigated further (out of scope).

## Follow-ups
- Browser-only: the client-side clear of S27 cells (meshes, light), smoke and bubble trails behind server fireballs and skulls, ghast fire on a server, and TNT cart blasts seen from a client.
- The native client also runs neighbour updates from its `setBlock(.., 3)` (for example a torch on a cleared block drops on the client); the port's client runs no block updates, and the server's cells cover it.
- The client fireball copy has no flight of its own (native predicts with motion and acceleration between 10-tick position packets). The smoke follows the server's positions, and the last update (impact tick) draws no smoke on the client because dead balls leave the snapshot.
- A crystal (or TNT) killed by another blast explodes one tick later in both single player and server (the event queue is drained before the chain's event is pushed); natively the chain recurses inside `doExplosionA`.
- The client's World.rand in the port is `scene.explosionParticles.worldRandom`, not shared with the rest of the client world, so only the order inside one blast matches.
