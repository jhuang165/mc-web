# fireext82 (batch 82): fire counters and saved rotations of the remaining projectiles

## Summary
- Eyes of ender: `eye-of-ender-live.js` gets `eyeBox`, `eyeWet` and `eyeFire`, the fire part of Entity.onEntityUpdate. Water zeroes the counter. A client world zeroes it every update. A server eye loses 1 a tick and sets `velocityChanged` on every 20th. Lava sets `velocityChanged` and fire = max(fire, 300).
  - `EyesOfEnder.tick` takes `hooks.world`. Without an `inWater` hook it uses handleWaterMovement's box test.
  - main.js and `server-eyes.js` pass the world. The server's old point-water hook is gone; it only picked bubble particles, which the server never spawns.
  - The helpers live in the live module, not `eye-of-ender.js`. `world.js` imports `eye-of-ender.js`, so importing `fluids.js` there makes a cycle (`END_PORTAL` before initialization).
  - Eye copies (`object-tracker.js`) run `eyeFire` remote on the box from the last spawn, move or teleport packet (`boxAt`).
  - `load` keeps `fire`, rows carry `burning`, and the `dispEnts` eye row carries `f: 1`.
- Firework rockets: `tickRocket` adds the counter (water, then client zeroing or count-down, then lava, in sa.C's order) and moveEntity's fire tail after `moveParticleEntity`.
  - A fire or lava cell in the moved box (shrunk 0.001) sets `velocityChanged`. Out of water it also does ++fire, with 160 when that reaches 0. Out of fire, a counter <= 0 rests at -1.
  - `createRocket` starts at 0. `FireworkRockets.load` keeps `fire`, rows carry `burning`, and the `dispEnts` rocket row carries `f: 1`.
  - The wet fizz branch is left out: isWet here is this update's water test, which already zeroed the counter, and the lava test reads the same cells. Only rain could reach that branch.
- Overlays: `ProjectileRenderer`'s `THROWN_FIRE` adds `eyeOfEnder` and `firework`. `objectView` sets `burning` for eye and rocket views from flag 0 or the copy's own counter.
- Fire saves: `java-projectiles.js` imports Fire for EyeOfEnderSignal (when > 0) and for FireworksRocketEntity (any non-zero value, since -1 is the native resting value). `region-export.js` writes the eye's Fire and the rocket's counter.
  - Fixed: an exported eye's `Motion` was always 0. The exporter passed `mx`, but eyes keep `vx/vy/vz`.
- Primed TNT: `tickTnt(world, e, smoke, { remote })` now passes moveEntity hooks, so `blockCollisions` runs the fire tail. xw.h never calls sa.h, so nothing counts the fire down. The counter rests at -1, goes to 160 on entering fire, and stays above 0 for the rest of the fuse.
  - `blockCollisions`' cauldron branch skips `hooks.remote`, since BlockCauldron's test is under `!isRemote`.
  - The TNT copy runs it with `remote`. `metaValues` never sets flag 0 for TNT. `objectView` sets TNT `burning` from the copy's counter.
  - Fixed: a dangling else in `objectView` bound the falling branch to `if (c.sim)` under the TNT test. Falling-block views never read the copy's block or meta; now they do.
  - `TntRenderer` draws a `FireOverlays` (`FIRE_BOXES.tnt` = [0.98, 0.98, 0.49]).
  - The fire counter is now kept in:
    - `primeTnt` (starts at 0)
    - the main.js save/load
    - away-entities run save/load
    - server-dispense extras
    - the `dispEnts` TNT row (`f: 1`)
    - the java-objects `Fire` import
    - region-export, which writes the integer counter
- Minecarts: no change. xl.h's remote branch sets position and rotation and returns before any moveEntity, so a cart copy never sets a counter or draws flames. xl.h never calls sa.h either, so flag 0 is never set.
- Ghast/blaze fireballs: `Fireballs.launch` takes the shooter's rotationYaw/Pitch (0, 0 for the `exact` dispenser form, a "player" owner or no owner). `tickBall` stores the previous rotation after the owner/blockExists test, then runs `fireballTurn` with the pre-update motion right after `fireballStep`.
  - `serialize` writes `rotation` for every ball. `build` restores it with the new exported `savedRotation` (prev = stored floats, current = mod 360), which `WitherSkulls.build` now shares. The skulls' redundant `serialize` override is removed.
  - `java-projectiles.js` imports and exports Rotation for all three fireball ids.
- Multiplayer, cadence off: `simulation.js` `itemList`, `server-dimensions.js` `list` and `server-items.js` `xpField` rows carry `b: 1` while the fire counter runs. main.js `syncMultiplayerItems`/`syncMultiplayerOrbs` already read it.

## Evidence
- Bytecode-read (javap -c -p on the 1.7.10 jar):
  - `zd.h`, `zf.h` and `ze.h` call `sa.h`; `xw.h` and `xl.h` do not.
  - The order of `sa.C`: water (`N`, fire = 0), then isRemote → fire = 0, else count down with `a(onFire, 1)` on `fire % 20 == 0`, then lava (`P`/`E`: `a(lava, 4)`, `e(15)`), then setFlag(0) on the server only.
  - `sa.d(DDD)`'s fire tail: isWet, the burning box, `f(1)`, `++fire`, setFire(8), rest at -fireResistance, the wet fizz.
  - `zd` and `zf` override neither attackEntityFrom nor any fire method. `zd`'s read and write NBT methods are empty.
  - `zd.h` calls setPosition only under `!isRemote`.
  - `zf.h` calls moveEntity. `xw.h` calls moveEntity on both sides.
  - xl.h's isRemote branch returns before moveEntity.
  - `ze`'s shooter constructor uses setLocationAndAngles with the shooter's rotation, and its turn in `h()` is the same as `fireball-turn.js`.
  - `ajw` (BlockCauldron) collision tests `ahb.E` (isRemote) before extinguishing.
  - `xw` setSize(0.98, 0.98).
- Port-read: the box sizes come from `OBJECT_KINDS`. The rule that rows carry `burning` and renderers read `entityBurning` is the throwfire81 design.
- Correction to throwfire81's note: "xw (primed TNT) and xl (minecarts) ... are not given overlays". That holds for flag 0 and for minecarts, but a TNT copy burns by its own moveEntity counter, so natively it does draw the flames.
- Correction to the old `tickRocket` comment: fire damage is not "refused" by the rocket. Entity.attackEntityFrom sets velocityChanged.
- No new executed probe.

## Verification
- `node --test src/fireext82-b82.test.js`: 10/10 pass.
- Targeted neighbour run: 88 existing test files that import an edited module (eye, fireworks, fireballs, wither, explosion, object-tracker, region-export, saved-order, projectile, mp* and render81 suites), `node --test --test-concurrency=3`. 941 tests: 940 passed, 1 failed.
- The failure was `render81-b81.test.js`, which encoded the gap: it expected an exported ghast fireball to have no Rotation. It now expects Rotation. A rerun of render81-b81 plus fireext82-b82 passed 21/21.
- `npm run build` passed (only the usual chunk-size warning). No full `npm test`, no browser checks.

## Follow-ups
- Browser-only checks:
  - the flames over a burning eye of ender, firework rocket and primed TNT (size, height, facing; going out when the counter or flag ends), in single player and on a multiplayer client
  - the ghast and blaze fireball facing after a save and reload
- Not modelled:
  - isWet's rain half for TNT and rockets: no rain fizz, and TNT out in the rain still keeps its counter
  - the eye's water push and splash
  - a minecart's server-side fire counter
- `/summon PrimedTnt {Fire:...}` ignores Fire, as other summoned objects do.
- An executed probe of a rocket passing a fire block, and of a TNT block primed next to fire, would turn the counter parts into executed facts.
