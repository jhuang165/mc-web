# Batch 51 flyturn track

## Summary

Branch `batch51-flyturn`, cut from 119a6db93 (release 0.79.0).

- **Ghast body turn, executed (`b51ft`).** `FlyTurnProbe` runs the unchanged `yd.h()` (full onUpdate, real EntityFlying motion, `sv.f(FF)` legacy turn after the action state) on the `BlazeGhastProbe` world double: three wander flights and three with a player (target, charge, fireball; target dropped for ticks 151-200), 240 ticks each. The port (`ghastUpdate` plus `turnBody` with `ghast` in `LEGACY_BODY`) replays position, motion, yaw, prev yaw, renderYawOffset, prev body yaw and head yaw with no change needed. Fireball launches per tick equal the native spawns. Harness limits: the probe world has no entity list, so a player near the flight path pushes the port ghast (the near player stands 10 blocks above), and a fireball the probe never flies is stubbed in the replay.
- **Dragon body yaw, executed and fixed.** `xa.h()` over 5 flights (3 circles with no player, 2 with a player). Natively `xa.e` ends with `renderYawOffset = rotationYaw` and leaves `rotationYawHead` alone (it keeps its constructor value), then `sv.h` runs the legacy turn (`isAIEnabled` false) over the tick's travel. The port set body and head yaw to the yaw; it now sets the body yaw, runs `legacyBodyTurn` with the tick's travel and the prev-angle wraps, and no longer touches the head yaw (`dragon-mobs.js`).
- **Dragon growl timing, fixed (found by the same records).** `EntityLiving.onEntityUpdate`'s `rand.nextInt(1000) < livingSoundTime++` starts at 0, not -80 (the port waited 80 ticks), and a growl then draws the sound pitch (two `nextFloat`). In a seeded flight a growl at tick 37 moves every later draw (target picks), so the flight diverged from tick 52. Now `livingSoundRoll` plus the two pitch draws.
- **Squid turn: already executed.** The batch-before `squidTick` records (`SquidBatProbe`, full `ws.h()`: renderYawOffset, rotationYaw, squidPitch/squidYaw, rotation, tentacles) are replayed by `squid-bat.test.js` (renderYawOffset and rotationYaw asserted per tick); nothing to change. The remaining open part is the client copy's `squidLivingUpdate` (isRemote), still bytecode-read.
- **Silverfish pulled into a retracting block: the port is not early.** Set `b51sf` (3 records, `EW_SET=b51sf`, b50lb piston harness) at seed 9703 (the skipped b50lb record): natively the silverfish takes 1 inWall damage at tick 3 (health 7, then the hurt window), and at tick 14 it hides in the floor cell below it (`updateEntityActionState`: monster egg 97 into (70, -1, 63), explosion-particle draws, `setDead`). `setDead` leaves health 7; the port's despawn marks a removed mob with health 0. Position, draws and flags match tick for tick; the batch 50 "dies earlier" reading was this health field. The replay arena drops writes to its implicit floor (y < 0), so the test blanks that one cell. Two more retract facings (seeds 9801, 9802) replay with no divergence.

## Evidence

- Executed: `b51ft` (ghast 6 x 240 ticks, dragon 5 x 240 ticks, `public/research/flyturn-b51ft-reference.json`, `tools/probes/FlyTurnProbe.java`, `tools/verify-flyturn.mjs`); `b51sf` (3 records, `enderman-wolf-b51sf-reference.json`, `EW_SET=b51sf node tools/verify-endermanwolf.mjs`).
- Bytecode-read: `xa.e` ending `aM = y` (xa 1342) and the death spin (`aM = y += 20`), `sw.C` talk roll and `sw.bg` pitch (two nextFloat).
- Mutation: removing the `legacyBodyTurn` call fails 5 dragon records.

## Verification

- `node tools/verify-flyturn.mjs` -> 11 scenarios, 2,640 rows; `EW_SET=b51sf node tools/verify-endermanwolf.mjs` -> 3 records.
- `node --test src/flyturn-b51.test.js`: 14 pass.
- 486 neighbouring tests (dragon*, squid-bat*, blaze-ghast*, legacy-body-b50, mobpush-b46, enderman-wolf-b4*, piston-order-b49, silverfish, mob-steps, entity-tracker*, everything mentioning the dragon): 0 fail. `npm run build`: ok. No full `npm test`, no browser check (a few degrees of body yaw and a growl timing).

## Follow-ups

- The client dragon copy (`entity-tracker.js`, `renderYawOffset = rotationYaw` at the end of its tick) skips the same legacy turn the server now runs; the renderer reads the ring buffer, so nothing shows. The copy's growl starts at 0 already.
- The squid client copy's turn (isRemote half) and the dragon death-spin body yaw are bytecode-read.
- A removed mob keeps health 0 in the port but its old health natively (`setDead`): visible only to code reading a removed entity.
