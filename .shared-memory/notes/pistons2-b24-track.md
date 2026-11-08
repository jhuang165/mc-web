# Pistons2 track, batch 24

## Summary

A piston push now goes through each pushed entity's own move path, as `TileEntityPiston.func_145863_a` does in 1.7.10. javap confirms that no entity class overrides `Entity.moveEntity`.

- **Player.** `src/piston-push.js` `pushPlayer` runs entities.js `moveEntity` on the player's own state:
  - motion, onGround, sneaking (the sneak edge), ySize (×0.4), fallDistance, the web flag and inWater;
  - position, motion (zeroed on blocked axes), flags, ySize and the web flag are written back.
  - main.js `player()` adapter: a minimal edit that adds velocity, motion, flags as getters/setters, rider, and `boatSystem()`.
- **Mobs.** `EntityWorld.pushMove` (entities.js) runs the mob's own move: stepHeight, the living hooks, step events and the landing. `moveWith` was split into `moveHooks`, `moveSteps` and `moveLanding`, keeping the same order.
- **Minecarts and boats.** They use their own `Minecarts.move` / `Boats.move`: detector rail hook, block hurts and fall state. They are blocked by other carts, the player and living mobs.
- **Moving box as a collider.** BlockPistonMoving's box now also blocks carts, boats and dropped items. A new `src/moving-boxes.js` registry is shared by entities.js, minecarts.js and item-entities.js. The player and mobs already had this since batch 20.
- **Stored blocks with no pool box.** Rails (66/27/28/157) and an open fence gate have no pool box (native `func_149964_a` returns null), so there is no push and no collision box. This is `NO_POOL_BOX` in `piston-live.js`.

## Verification

All of the following were run on the unchanged jar (java 19).

- **Probe changes.**
  - `tools/probes/PistonLiveProbe.java` has a new `live` event. It constructs a real EntityPig, an EntityMinecartEmpty or an EntityBoat in the World. Their own moveEntity runs; the subclasses record the delta first. Each tick outputs [label, posX, minY, posZ, motion, onGround, collidedH, fallDistance].
  - `tools/probes/PistonProbe.java` `W.scripted` uses a real entity's live box and excludes the mover. A `blocksOnly` flag is set for the collision readout.
- **Verifier.** `node tools/verify-piston-live.mjs` passes:
  - 124 scenarios (49 before), 646 tile states, 646 push boxes, 420 collision boxes, 525 scripted moves;
  - 104 live entity states and 19 live moves, all identical to the jar.
  - The replay passes the game-style world view to all scenarios.
- **New live scenarios:**
  - a pig pushed into a wall, with motion;
  - pigs lifted under a ceiling and free;
  - a pig stepping onto a slab, and one stopped by a full block;
  - a cart and a boat pushed into walls;
  - a pig pushed into a boat;
  - a pig on the path of a pushed stone.
- **New odd-block2 scenarios (69):** every stairs id, slab variants, carpet colour, the mossy wall, anvil metadata, the dragon egg, rails, an open gate, wet farmland, trapdoor metadata, ladders, snow, the end portal frame with an eye.
- **Tests.**
  - `src/piston-live.test.js` (140 tests) replays every scenario, including the live entities through EntityWorld, Minecarts and Boats.
  - New unit tests cover pushPlayer (a wall, an upward push, the sneak edge, the web), the pushMove step, the cart detector hook and boat wall, and cart/item collisions with the moving box.
- `npm test`: 4435 pass, 0 fail. `npm run build`: OK.
- No browser check was done, so main.js wiring is covered only by the build and the adapter shape.

## Follow-ups

- Pushes still run after the whole tile loop, not inside each tile's updateEntity. This matched in every probed scenario, but it is untested for two tiles pushing one colliding entity in a tick.
- A landing caused by a push on the player deals no fall damage (`land` is not wired in main.js). The player's cactus and fire tail does not run on a push.
- Items, TNT, orbs and falling blocks still use the bodyMove copy rather than their own move.
- Riders follow on their own next tick.
- The detector rail plus a pushed cart was only unit-tested, not probed.
- Stored blocks outside the probed lists remain unverified (stale-bounds dependence).
