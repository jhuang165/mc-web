# Pistons track, batch 20

## Summary
Moving pistons now push and collide like 1.7.10 in the browser. `movingCollisionBox` (batch 19) is wired in as `pistons.collisionBoxes(box)`, appended to `entities.js collisionBoxes` through a new `setMovingBoxes` hook (installed and cleared by `redstone-runtime.js`), so the player, mobs and every `moveEntity` caller land on and bump into moving blocks. Entity pushing (TileEntityPiston.func_145863_a, which batch 0.39 already ported for the player, mobs, items and TNT) now also covers experience orbs, falling blocks, minecarts and boats, and uses `moveEntity` for items and TNT instead of teleporting them (new `src/piston-push.js`). The stored block's native box quirk (read with the world cell holding the moving block) is reproduced for the probed blocks.

## Native evidence
Probed (executed on the unchanged jar): `tools/probes/PistonLiveProbe.java` extended with a per-tick `World.getCollidingBoundingBoxes(mover, cell)` over each moving tile; `tools/verify-piston-live.mjs` now runs 49 scenarios (6 before): all six facings, entities inside/beside/ahead/on top, standing-on-moving-block, sticky retract, and about 30 stored blocks with non-cube boxes. `piston-live-reference.json` records 160 collision boxes, 244 push boxes, 200 entity pushes. Bytecode-read: `apr.a(ahb,III)` (collision uses `aps.a(0.0F)` and 1 - p when extending), `aps.a(FF)` (push loop, no entity-type filter; `ahb.b(null, box)` returns all entities, delta applied through `sa.d`). Compiled probe output: ignored `tools/research/piston-live-probe/`.
Not probed: real EntityLivingBase / EntityMinecart `moveEntity` inside the piston world (the probe's entities record `moveEntity` deltas, as in batch 0.39).

## Tests
`src/piston-live.test.js` (59 tests): replays every scenario's tile states, offsets, push boxes, collision boxes and entity moves; no-sticky-pull assertion; `piston-push` movers (item, TNT, falling block, orb, cart) with a wall; falling onto a moving block through `moveEntity` and `setMovingBoxes`.

## Remaining gaps
- Pool boxes of stored blocks outside the probed list use render bounds (unverified).
- Player velocity, ySize, riders and entity-vs-entity collision are not modelled during a push; no real living-entity `moveEntity` in the probe.
- Boats/carts push through `moveEntity` on a body copy, not their own `Minecarts.move` / `Boats.move` tails (detector rails, block hurts).

## Proposed remaining-gaps lines
- Pistons: moving blocks push and collide (items, TNT, orbs, falling blocks, carts, boats, player, mobs; native collision box reproduced for 30 probed stored blocks); open: unprobed stored-block pool boxes, player/rider push details, live-entity `moveEntity` in the probe ([piston-live.md](piston-live.md)).
