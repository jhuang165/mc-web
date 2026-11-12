# Batch 47 awaythrows track

Branch `batch47-awaythrows` (from 3250e20f5). Commits: 2f2b956fc, c5cc995d4, ac7fcfeaf.

## Summary
- Away run thrown balls (owner null) now target carts, boats and hanging entities (port; replay-checked against probe rows, executed).
- Live rocket is an `entityWalkers` "rocket" walker in the one join-ordered walk; `main.js` only changed in the rocket tick, `joined` and hooks lines. Client-copy hooks kept (port).
- EntityListProbe grew from 63 to 74 cases (executed): egg hatching both ways, exp-bottle orbs on cart/boat/painting, and three `pthrow-pearl-mp-*` cases with a real EntityPlayerMP thrower (Ej/Nh/Sp shells). Old 63 records byte-identical. Port matches all 74 except `arrow-cow*` (NOT_REPLAYED, unchanged).
- Gap 4 `cart-cow-mount-ba` was a port bug in two parts (executed): a mob taken aboard mid-pass was not updated a second time right after its mount, and `minecarts.js boxes()` wrongly excluded a mob rider's box (native `ahb.a(Entity, AABB)` has no rider exclusion, bytecode-read). Both fixed; now replays exactly.
- Chicks hatched join `tickOrder` in the thrower's turn; bottle orbs spawn in the thrower's turn (port).

## Verification
- `node --test src/entity-list.test.js src/away-*.test.js src/minecarts.test.js src/boats.test.js src/vehicle-*.test.js src/entities.test.js src/projectiles.test.js src/projectile-nbt.test.js src/fireworks*.test.js src/ender-pearl*.test.js src/pearl-player.test.js src/player-throws-b46.test.js src/spawn-eggs.test.js src/witch.test.js src/entity-simulation*.test.js`: 477 pass, 0 fail.
- `npm run build`: ok. Full `npm test` not run (by instruction).
- Reference regenerated with `cd tools && MC_PROBE_LIBS=<netty-all-4.0.10.Final.jar> MC_RESEARCH=... node verify-entity-list.mjs`; `launches` restored from the old file.

## Follow-ups (proposed gap lines)
- Live `main.js` does not set `joined` for minecarts, boats and hanging entities.
- Pearl-mp probe needs netty-all 4.0.x via `MC_PROBE_LIBS` (4.1 fails).
- `launches` seeds are nondeterministic on regeneration.
- Port exp-bottle orb count uses a per-ball rng; native uses World.rand.
- Probe thrower box is a point, yOffset 0.
- Away list order has no native probe; item-frame and dispenser-constructor throws unchecked.
- Mob death drops and xp still drain after the walk, not in the entity's own turn.
- No dedicated unit test for the live "rocket" walker hook pass-through.
