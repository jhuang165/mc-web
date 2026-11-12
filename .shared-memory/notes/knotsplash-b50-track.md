# knotsplash b50 track

Branch `batch50-knotsplash` from ca6a447bf.

## Summary
- Leash knots (placed and summoned) are on the crosshair pick. `proto.pick` in `src/horse-gear-live.js` now tests every live knot through `this.knotBoxOf(k)` (box grown by the 0.1F collision border, as `getMouseOver` does), else the live 0.5 cube; the result is the knot's stand-in `{ id: "mob-<n>", knotRef }` (placed knots get a lazy WeakMap id), so the existing capture (`player-actions.js knotEntity`), `leashInteract -> knotInteract` (right click) and `attack -> knotAttack` (left click) work unchanged. `main.js` sets `mobs.knotBoxOf` to the new `aimKnotBox(objectTracker, k, live)` (`src/object-tracker.js`): the knot copy's box, the live box before the tracker follows it, null when followed without a copy.
- Boat copies spawn splash particles: `ObjectClient.splash()` runs at the start of `stepVehicle` for boats (before the interpolation or coast, with the motion the copy has at the start of the tick), routed through `tracker.particle` to `scene.fx` like other client effects. The boat copy's sim gets its own `rand` (`newSim`).

## Evidence
- Bytecode-read (`javap -c -p` on su = EntityLeashKnot, ss = EntityHanging, sa = Entity, xi = EntityBoat): su.c (interactFirst): holding a lead on a server world attaches the player's leashed mobs within 7 blocks; if none attached and not remote it calls setDead, Creative also frees the mobs it held; always true. ss.a (attackEntityFrom): not invulnerable, not dead, not remote -> setDead, onBroken (empty for the knot); true. ss.R (canBeCollided) true; sa.af (border) 0.1F. xi.h: the splash block runs before the isRemote branch with d3 = sqrt(motionX^2 + motionZ^2) > 0.26249999999999996, loop `i < 1 + d3 * 60`, per particle nextFloat (d4 = (f*2-1)), nextInt(2) (d5 = (n*2-1)*0.7), nextBoolean; positions (x - cos*d4*0.8 + sin*d5, posY - 0.125, z - sin*d4*0.8 - cos*d5) or (x + cos + sin*d4*0.7, ..., z + sin - cos*d4*0.7); velocity = the boat's motion. No water test (only speed). Not executed: no probe was run.
- The test replays the formula independently with `JavaRandom` against the copy.

## Verification
- `node --test src/knot-splash-b50.test.js src/aim-copies-b49.test.js src/vehicle-render-b48.test.js src/object-tracker-vehicles.test.js src/object-tracker-hits.test.js src/leash.test.js src/leads2.test.js src/leads3.test.js src/summon-coverage.test.js src/horse-gear.test.js src/hanging.test.js src/boats.test.js` -> 258 pass, 0 fail. `node --check src/main.js`. Not browser-checked.

## Follow-ups
- Overlap: edited `src/object-tracker.js` (claimed by trackerids) and one line of `src/main.js` (claimed by meleeorder): additive hunks in splash/stepVehicle first line/newSim/aimKnotBox.
- Run a Java probe for the splash stream and a boat copy at set speeds; the client copy of the ridden boat still has no physics (so no splash while riding).
- A knot's interact/attack still run on the live knot (the packet names the entity id).
