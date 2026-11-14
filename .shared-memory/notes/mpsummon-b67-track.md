# Batch 67 mpsummon: /summon on the dedicated server, spawner status ranges, revenge target liveness

## Summary
- `src/multiplayer/server-summon.js` (new): `summonHost(sim, player)` gives the command host `inWorld` and `summon`. It runs the single-player `createCommandHost(env).summon` (data tag merge, Riding chains, onSpawnWithEgg only without a tag, one creation path per EntityList name) over this server's live systems, inside the sender's dimension (`ServerDimensions.within`, so the Overworld, Nether and End each use their own mobs, vehicles, dispenser, falling blocks, items and orbs). Mobs go through `ServerMobs`' EntityWorld; minecarts (spawner cart too) and boats through the dimension's `ServerVehicles`; arrows, snowballs, pearls, potions and eyes through `ServerProjectiles` (`adoptProjectile` adds only the new entity, so a live arrow keeps its owner and id); fireballs and wither skulls into the mobs' own Fireballs/WitherSkulls; primed TNT into the dispenser's `primed`; falling blocks, items and orbs (the orb takes a world entity id) into the dimension's lists; rockets into the dispenser's rockets.
- Refusals give `commands.summon.failed` (also as a Riding mount, which ends the chain): mob kinds outside `SUPPORTED` (the giant), a world at `MOB_LIMIT`, Painting, ItemFrame and LeashKnot (no hanging system on the server).
- `src/server-broadcast.js`: `summon` joins `SERVER_COMMANDS` (operators only; others get the permission message); the host merges `summonHost`. `src/multiplayer/server-cart-commands.js`: the same merge, so a command block cart can run `/summon`.
- `src/command-host.js` (one line): `env.summonRefuses?.(type)` makes a creation fail. `src/entity-summon.js` (4 lines): `hosts.adopt` replaces the load-the-whole-list append for projectiles.
- `src/multiplayer/server-spawners.js`: the spawner cart status and the mob puff (status 20) reach players by the tracker's square range (`sq`, inclusive, height ignored): 80 for the cart and most mobs, 64 for squid, 160 for the dragon (`mobTrackRange`). The burst (2004) and block event stay a 64-block sphere.
- `src/multiplayer/server-combat-tracker.js`, `server-stats.js`: the revenge fallback of the kill credit only counts a living attacker (`killer(..., revengeAlive)`); attackingPlayer stays unchecked.
- Test: `src/mpsummon-b67.test.js` (15 tests). No new wire messages (the `dispFx` events gain an ignored `sq` field).

## Evidence
- Bytecode-read (javap, jar SHA1 e80d9b3b): `mn.a(sa)` (EntityTracker.addEntityToTracker): `xl` (EntityMinecart, the superclass of `xt` the spawner cart) 80/3, boat 80, squid `ws` 64, `ry` (IAnimals, so every IMob too) 80, bat/wither 80, dragon `xa` 160. `my.b(mw)` (updatePlayerEntity): the player tracks when the player-to-entity dx and dz are each within the range (a square). `mt.a(sa, byte)` (setEntityState) sends to the entity's tracking players (`mn.b` -> `my.a(ft)`). So the b65 "80 for the cart" was right in range but the test was a circle; the puff's "64 blocks" was wrong (the mob's tracker range applies).
- Bytecode-read: `sv.aX` (func_94060_bK) returns the CombatTracker's best, else `aR` (attackingPlayer), else `i` (revenge target), with no alive check of its own. `sv.C` (the victim's per-tick update) clears `i` with `b(null)` when `Z()` (isEntityAlive) is false or `aa - bm > 100`, and clears `aR` when recentlyHit runs out. So a dead revenge target is dropped; the batch 65 note was right that the port ignored this.
- Recalled (not re-verified): CommandSummon (bu) level 2 and the messages; the single-player summon was already bytecode-read in earlier batches (summon-reference.json).
- Approximation: the port tests the attacker's life at the moment of the kill, native at the victim's last tick before it; they differ only when the attacker dies between the victim's last tick and its death in the same tick.
- Not executed: no new Java probe (the single-player summon records and combat-best records are reused).

## Verification
- `node --test src/mpsummon-b67.test.js`: 15 pass, 0 fail.
- One at a time: `servercommands-b59` 11, `mpspawners2-b65` 9, `mpstats3-b65` 7, `mpstats2-b64` 10, `mpnether3-b63` 9, `summon-coverage` 7, `summon-reference` 2, `commands` 14, `command-tags` 6, `away-commands` 18, `serverbroadcast-b58` 10, `mpvehicles3-b63` 13: all pass.
- `node --check` on every touched file: clean. `npm run build`: ok. Full npm test not run (batch rule). No browser check (batch rule).

## Follow-ups
- Coordinates are the server's local ones, as `/tp` uses them: the End window's origin is not added and the Nether is not scaled.
- Falling blocks, orbs and items summoned on the server fall and land there; whether every client draws a summoned falling block entity is the existing falling-block wire path (not checked; only a browser would show it).
- Painting, ItemFrame, LeashKnot, the giant and any mob beyond `MOB_LIMIT` fail here although native would create them.
- The tracker's view-distance clamp (144 blocks at view-distance 10) is not modelled.
- A summoned entity is not announced to clients until the next tick's normal tracking; nothing was looked at in a browser.
