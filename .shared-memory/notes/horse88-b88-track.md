# horse88 (batch 88): single-player horse riding tick for tick

Branch `batch88-horse88`. Owns `src/vehicle-simulation.js` and the horse code (`horse-live.js`). One small line in the shared `entities.js`.

## Summary
1. **The ridden horse moves with the rider's own input, not decayed** (`horse-live.js` `horseRideThink` / `takeRideMove`, and one line in `entities.js` `walk`).
   - In wi.e(FF), the ridden branch passes `rider.bd * 0.5` and `rider.be` (`* 0.25` backwards) straight to `super.e`.
   - The 0.98 decay in sv.e touches only the horse's own bd/be. bh() zeroes those for a saddled rider.
   - Before, the port decayed the ride input: about 2% slow, about 5e-3 off the executed rows.
   - This applies in single player and on the MP server, since both use the same EntityWorld.
   - The input is held in a WeakMap, so the saved record gains no field.
2. **The jump state matches wi.e(FF) and wi.h()**:
   - `bt` (jumpPower) and `br` (jumpingHorse) clear only in the ridden branch, after the move, when onGround. Before, they cleared on ground for any horse.
     - A power stored in the air is now dropped at the landing (no jump). This is executed: `airRelease`.
     - A power left when the rider gets off in the air stays, and so does `br`, so the next ridden tick does not jump and then clears both. This is executed: `dismountAir`.
   - `bI` (jumpHeld) is cleared on every tick the horse is not rearing (wi.h 270-327). Before, it was never cleared, so a later plain rear did not hold the horse still. This is executed: `tap`, `rearAfter`.
   - motionY = the `horse.jumpStrength` attribute (modifiers included, clamped to 0..2) * bt, plus Jump Boost.
   - The forward push uses the MathHelper sin/cos table and float math.
3. **Yaw**: setRotation's `% 360` (executed: `bigYaw`, rider yaw 1000 gives 280). renderYawOffset and the head follow the wrapped value.
4. **The gallop counter `bP` is reset on any tick with forward <= 0** (executed: `backwardGallop`).
5. **stepHeight 0.5 and jumpFactor 0.02 apply from the first unridden or unsaddled tick, before its move.** Before, they reset after the move, and only with no rider.
6. **Single player (`vehicle-simulation.js` `moveRidingPlayer`)**:
   - On foot, the jump key is tracked (`wasJump`) and bO is held at 0, as blk.e does. Mounting with the key held continues the count instead of restarting it.
   - On the sneak or dismount tick the counter still runs, but no C0B is sent (see Follow-ups).
7. **Verified unchanged (no fix needed)**:
   - the counter itself and `heldJumpPower` (b87);
   - wi.w;
   - speed from the movementSpeed attribute;
   - strafe 0.5 and backwards 0.25 (now exact);
   - riding an untamed or unsaddled horse: AI or RunAround, W 0.5, and w() does nothing (executed: `unsaddled`);
   - pigs with a carrot on a stick:
     - ub.e: the wrap * 0.5 clamped to ±5, accel 0.01 up to 0.3, the boost `speed * 1.15 * sin(t / max * PI)`, wear 0.006;
     - abp.a: 7 damage per boost, and a used-up rod becomes a fishing rod;
     - checked against bytecode and the existing executed `pig-saddle-reference.json`.

## Evidence
- **Executed**:
  - `tools/probes/Horse88Probe.java` (`node tools/verify-horse88.mjs` writes `public/research/horse88-reference.json`): 9 scenarios × seeds 1 and 6 of whole server `wi.h()` ticks.
    - Setup: HorseRearProbe.RW world double with a fixed light level, a FakePlayer rider with fixed be/bd, and the horse's AI task lists emptied. The AI runs only on unsaddled or unridden ticks, and it needs pathfinding.
    - Between ticks the script calls `w(p)`, `cU()` and mountEntity.
  - The older `horse-reference.json` `ride` rows (HorseProbe `e(FF)` moves) are now replayed one tick at a time, within 1e-6.
- **Bytecode-read** (`javap -c -p`):
  - `blk.e` 321-328 and 949-1102;
  - `wi.e(FF)` 0-498, `wi.h()`, `wi.w(I)`, `wi.a(IIIaji)` (step and gallop sounds);
  - `sa.b(FF)` (setRotation % 360);
  - `ub.e` and `abp.a` for the pig.
  - bt is written only in e(FF) and w(); br only via j(Z) in e(FF).
- **Port-read**: native single player handles the C0B/C0C after the integrated server's world tick, so they apply next tick. The port applies them before the horse's tick, which is the same order.

## Verification
- `node --test --test-timeout=600000 src/horse88-b88.test.js`: 6/6 pass.
- Neighbour files, `xargs node --test --test-concurrency=1 --test-timeout=600000` over 55 files: 770/770 pass.
  - The files: horse*, mphorse*, ride*, riders72, player-mount, player-riding, pig-saddle, leads*, vehicle*, attributes2, mob-steps, corpse8*, spcopy87, spswing80, away-ride, tracker-mounts, mpriders73, object-tracker-extras, falling-damage, boats, enderman, pistonpush-b48, mpsurvival-b58, skins73*, riderpose79, horse88-b88.
- `src/mobs84-b84.test.js` (scans entities.js source): 4/4 pass.
- No old test encoded the fixed gaps. The pre-change code fails the new replay: held, vx and vz differ from tick 0.
- `npm run build` passes.
- No full `npm test` and no browser checks.

## Follow-ups
- On the sneak tick, the native horse makes one more ridden move before EntityPlayer.updateRidden dismounts the rider, and a C0B sent that tick still lands. The port dismounts in the same tick and drops the C0B.
- On the first ridden tick of a freshly loaded or spawned horse, natively `aQ = bp * 0.1` with bp = 0 (not saved). The port falls back to the speed attribute when `aiMoveSpeed` is unset. This matters only if the horse is in the air on that tick.
- Mob riders on horses (`riddenBy`) do not steer; this was not checked.
- The gallop's nextInt(10) breathe and the idle sounds come from the horse's own Random. The probe rows were not compared for these.
- Browser-only:
  - the jump bar when mounting with the key already held;
  - the gallop and wood step sounds after riding backwards;
  - how the slightly faster (now exact) ride speed feels.
