# Batch 79 spexec79: pearl in liquids, bowl on a calf, dispenser fire charge on server vs client, server replays, gaussian audit

## Summary
- New executed probe `tools/probes/SpExec79Probe.java` (kinds `pearl79`, `milk79`, `fire79`), run by `tools/verify-spexec79.mjs` into `public/research/spexec79-reference.json` (92 records). Replay test `src/spexec79-b79.test.js` (7 tests).
- Fix 1, `src/fireballs.js`: EntityFireball.onUpdate (ze.h) spawns its `smoke` AFTER the move, at the new position (x, y + 0.5, z); the port spawned it before the move (one tick behind). In water native also spawns 4 `bubble` after the move at (pos - old motion * 0.25) with the old motion as velocity; the port had none. Both fixed.
- Fix 2, gaussian audit (all three were not `java.util.Random`): `src/item-entities.js` spill (Box-Muller `Math.log`), `src/multiplayer/client-containers.js` dispenserAux 2000 (polar on `Math.log`), `src/enderman-renderer.js` (sum of four `Math.random()`). They now use `gaussianFrom(nextDouble)` (new in `src/java-random.js`: the polar method on `strictLog`, second value cached) or a `JavaRandom`. `src/dragon.test.js` lost its private `strictLog` copy; `src/fx.test.js` comment updated. No field was removed.
- Server replays (part 2) found no mismatch beyond Fix 1 (which the server's Fireballs also had).

## Evidence
- Executed: a calf (age -6000 and -1) given a bowl: `interact` returns false and nothing changes, cow and mooshroom, server and client world, count 1 and 2, full inventory and Creative. An adult mooshroom with a bowl gives stew (client also returns true). Shears or stew on a calf do nothing. The port already matched (`mooshroomUse` needs an adult).
- Executed: ender pearl in still water, flowing water (meta 3 and 7), still lava, flowing lava and air (drop, arc, slow and inside shapes): the ray trace ignores liquids; water gives drag 0.8, 4 bubbles per tick, and a splash (sound plus 6 bubble and 6 splash) on entering; a pearl starting inside water does not splash on tick 0; landing teleports the owner, 5.0 fall damage, 32 portal; a client copy emits portals only and never dies. Replay of 36 records through `Projectiles` and `impactEnderPearl`: tick-for-tick position, motion, water flag, death, sounds and particles equal.
- Executed: lava gives a thrown pearl `fire` 300 (setFire 15 s) on the server world; the client world resets it each tick. No other effect.
- Executed: dispenser fire charge on a client world (`isRemote`): `BlockDispenser.updateTick` does nothing (stack kept at 2, no aux, no entity). On the server: aux 1009 then 2000 (see `sp-dispense77`), one `zi` with zero motion, acceleration `ze.b/c/d`, 3 flight ticks each emitting smoke at (x, y + 0.5, z) of the post-move position. Replayed through `Dispensing` + `Fireballs` for all six facings and two seeds.
- Executed + Port-read: batch 78's `pearl` records (12) replayed through `ServerDispense.prototype.pearlImpact` (connected, riding, other dimension, disconnected, none, with a hit): same events, death and fall distance. Batch 78's `milk` records plus `milk79` replayed through `serverAnimalUse` with the real `mooshroomInteract`: same results, stacks and drops.
- Bytecode-read: `ze.h` order (move, bubbles in water, motion update, smoke) via `javap -c -p`.
- Port-read: server fireballs, snowballs and eggs run through the same `Fireballs`, `Projectiles.tickOne` and `thrownHit` code as single player, so batch 78's fireball and snowball records are covered by the existing replays; the aux 1005 jukebox path is client-only (`client-music.js`).

## Verification
- `node --test src/spexec79-b79.test.js`: 7 pass. 27 fireball-related files (435 tests) pass. Gaussian-audit users (46 files importing item-entities, client-containers, enderman-renderer, plus dragon and fx tests): 634 pass. Not run: block-break-simulation.test.js, explosion-simulation.test.js, block-audit.test.js and streaming-world.test.js (they import item-entities; the first two spun for 12 CPU minutes under load and were killed, no failure seen).

## Follow-ups
- Open: a pearl (or any thrown projectile) in lava keeps `fire` 300 natively; the port has no fire counter on `Projectiles` balls, so the burning overlay on a pearl in lava is not drawn. Not modelled.
- Open: the multiplayer client has no copy of a server fireball's smoke or bubbles (only the server-side `Fireballs` emits them to its own fx).
- Comment-only `Math.log` mention in `src/wither-targets.test.js` left as is.
