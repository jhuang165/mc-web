# mpobjects90 (batch 90): falling-block tick order and join state, pushed crystal hazards, remote falling shadows

## Summary
- **Tick order (`simulation.js`, `server-nether.js`).** `falling.tick()` now runs right before `dispense.flush()` (the thrown-entity tracker pass), in the Overworld and in the Nether instance's tick. Before, it ran after the weather drain, so a block spawned by the scheduled update had its S0E one tick after the source cell turned to air. Measured with a nearby player: spawn row now in the same tick the entity appears, with the join position (y = floor(40.5 * 32) = 1296) and the first S12.
  - Port deviation, kept small: falling.tick now runs before the weather random ticks (which follow the flush); native does random ticks, then tickUpdates, then entities, then the tracker. Both only touch blocks. A full reorder of weather / maps / sounds around the flush was not attempted.
- **Join state for summoned and loaded blocks (`falling.js`, `entity-summon.js`, `falling-lane.js`).** `FallingBlocks.restoreEntity` and the FallingSand branch of `summonEntity` call a new `falling.spawned?.(e)` hook. `hookFallingJoin` sets it to `tracks.birth`, so the S0E carries the state the entity had when spawned (position, motion), whatever tick that is. `joined` is untouched (it is the walk-list hook in single player). The dispense pass's birth at the start of the tick already covered a command run before the tick; the hook covers spawns after it (command blocks in tickWorldSystems, loads).
- **Pushed crystal hazards (`ender-crystal.js`, `entities.js`).** `EntityWorld.pushMove` passes `crystalPushHooks(e, attack)` to moveEntity for a crystal. block-collisions.js then runs the cactus and fire/lava tails: `hurt` calls `crystalAttack`, which explodes it (power 6, once) at posY (the hook restores the posY offset during the call). wet is false. An Invulnerable crystal stays.
- **Shadows (`main.js`).** `shadowCasters` adds the multiplayer client's falling copies (`remoteDispense.falling`) with SHADOWS.falling_block, same numbers as the single-player entry. Remote boats, carts and orbs still cast none (see Follow-ups).
- Old test: `mpobjects89-b89.test.js` pinned the exact `crystalPushMove(..., moveEntity);` source line; the regex now allows the hooks argument. Behaviour unchanged.

## Evidence
- **Bytecode-read** (`javap -c -p`, jar minecraft-1.7.10.jar; dumps `wz.txt`, `sa.txt` in the track scratch):
  - `wz.a(ro, float)`: `aw()` (isEntityInvulnerable) -> false; else if not dead and not remote: health 0, `B()` (setDead), `ahb.a(sa, x, y, z, 6.0F, true)`. No damage-source test, so cactus and inFire explode it.
  - `wz.h()`: no call to `sa.h`; only prev pos, innerRotation, the dataWatcher health, and the End-only fire. It never sets fire "under itself" outside the End (the port already has this in `crystalTick`).
  - `sa.d(DDD)` (moveEntity): `I()` (doBlockCollisions) at offset 1887 and `ahb.e(box.contract(0.001))` at 1955 then `f(1)` (dealFireDamage) / `e(8)` (setFire); no override in wz, no class test.
  - Tracker order (WorldServer tick -> entities -> `EntityTracker.updateTrackedEntities`): from the b89 note and the earlier mn/my reading; not re-dumped.
- **Port-read:** the lane lists (`fallingTrackList`), `birth` / `entryFor`, `blockCollisions` hooks, `shadowCasters`, the ordering in `DedicatedSimulation.tick` and `tickNether`.
- **Executed (port, node):** scratch test (removed) printed the spawn row per tick: tick 2 before, tick 1 after the reorder.
- Shadow sizes: the existing `SHADOWS` table (b71) already holds falling_block 0.5; I did not re-derive crystal / boat / cart / item sizes from native Render classes in this batch.

## Verification
- `node --test --test-concurrency=2 src/mpobjects90-b90.test.js`: 5 pass, 0 fail. Reverting only the tick order fails 2 (spawn tick, source pin); reverting only the spawned hook and the crystal hooks fails the join-state and crystal tests (checked).
- Neighbours (82 files naming falling / crystal / summon / piston / nether / dispense / lanes / mpobjects / end / commands): 82 files: 1596 tests, 1596 pass, 0 fail (`ls src/*.test.js | grep -iE "falling|crystal|summon|mpobjects|piston|nether|dispense|lanes86|mpthrown|hook85|sounds73|end|mpsummon|blast81|commands" | xargs node --test --test-concurrency=2`).
- No `npm run build`: no import graph change beyond one new named export.
- No browser checks (track rules).

## Found wrong in the batch 89 list
- Nothing wrong. The "no join state" item was partly covered already (dispense.tick births every listed block before the entity pass); the real gap was spawns after that point and the missing hook on load.

## Follow-ups
- Browser-only: the falling copies' shadow, the crystal exploding when pushed into a cactus.
- Remote boats, carts and XP orbs on the multiplayer client still cast no shadow: their copy rows (remote-vehicles / orb sync) were not checked for the position fields `shadowCasters` needs.
- Native shadow sizes for crystal (RenderEnderCrystal) and item entities were not re-read from the jar.
- An explosion does not push a crystal (the crystal has no motion step), so only the piston path was needed.
- weather.tick / drain / lightning / maps still run after the tracker flush; native runs random ticks before entities.
