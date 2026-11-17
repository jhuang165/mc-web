# Batch 78 mpexplosion78: S27 explosion packet on the wire, batched relighting

## Summary
- New `src/multiplayer/server-explosion-packet.js`. `ServerMobs.explode` now records, per player, the push `Explosion.doExplosionA` puts in its player map (`hit.push`, before Blast Protection). The burst event (`dispFx` `explode`, built in `ServerMobs.burst` and `server-dispense.explode`) carries that map; `server-dispense.flush` sends it to each player of the dimension with squared feet distance < 4096 (3D, was a 160-block square) and attaches that player's `mx,my,mz` as floats. `client-dispense` plays the effect, then calls a new `knock` hook; `main.js` adds the floats to the client `velocity` (1 line).
- Server side fixes found while reading: a creative player takes no damage but is pushed (the server skipped him entirely); the server's own motion now gets Blast Protection (`blastKnockback`, as the single-player path already did) while the packet keeps the unreduced push.
- S12: unchanged and still native. `velocityChanged` is set by `attackEntityFrom` only, so a hurt player still gets S12 (server motion after the tick's move) after the S27; a creative player (damage refused, no setBeenAttacked) gets S27 only. Not re-changed.
- Relighting: `LightVolume.updateMany(changes)` (lighting.js) replaces the per-cell `update` loop in `simulation.js` and `server-nether.js`: one flood per merged rectangle of the overlapping +-15 boxes. `MC_RELIGHT=verify` runs the per-cell floods on a copy and throws on any differing sky, block or height cell; `off` is the old loop.
- Tests: `src/mpexplosion78-b78.test.js` (7).

## Evidence
- Bytecode-read (javap -c -p, 1.7.10 jar): `mt.a(sa,DDDFZZ)` WorldServer.newExplosion: doExplosionA, doExplosionB(false), clear affected list when !smoking, then `mw.a.a(new gu(x,y,z,size,list,explosion.b().get(player)))` for each player with `getDistanceSq(x,y,z) < 4096.0`. `agw.a()`: after `sa.a(DamageSource, ...)` the entity gets `agi.a(entity, d10)` (Blast Protection) added to its motion, while the map (`agw.l`, EntityPlayer only) stores `d5*d10, d6*d10, d7*d10`: the unreduced push. `gu`: x,y,z as floats, size, count, signed byte offsets from floor(x,y,z), motion x,y,z floats. `bjb.a(gu)` handleExplosion: `new Explosion`, `doExplosionB(true)`, then `motionX/Y/Z += (double) float`.
- Executed: bench `MC_RELIGHT=on|off|verify` on 40 seeded blasts, sky/block/height arrays hash equal (`7ee3680c14f8`), verify passes; ms 199 on vs 2911 off (about 15x). Profile before: `relightSteps` 74% self time.
- Reasoning (Port-read): light is the unique fixed point (each step costs >= 1), a change lights only within 15 columns, and the world holds all changes before the relights, so a box covering the changes gives the same arrays; the verify mode and a randomised test check it.

## Verification
- `node --test src/mpexplosion78-b78.test.js`: 7 pass (incl. batched vs per-cell on three random worlds with torches, roofs, world edges).
- Related server files under `MC_RELIGHT=verify` (dispense, combat74, nether 1-3, sleep, end, wither, velocity77, perf77, pistons, blocks73, lightning, golems, b62-lead, light-client-server, game-rules, health, dragon): see lead reply for the count. `npm run build` once at the end. No full npm test, no browser.

## Follow-ups
- Deviation: the port client has no physics, so the S27 motion only feeds its `velocity` (bob, cape) and the next tick's position delta or S12 replaces it; the knockback is already in the server-integrated position.
- S27's affected-block offsets are not sent (block changes travel as cells, so the client's `doExplosionB(true)` block clearing and per-block particles are not driven by the list; the burst uses its own sampling).
- Single player's `applyExplosion` is unchanged (it already adds the Blast-Protection-reduced push to the client; native client in SP gets the server's unreduced S27 as well, which is another small gap).
- Mob blasts via `mobs.explodeInline` (creeper line 119) call `explode` without `burst`; the S27 for them still depends on that existing path.
