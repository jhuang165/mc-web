# spcopy89 (batch 89): the single-player server copy re-links at a broken seat, leaves the old world at the portal, carries its motion, and waits on mount and bed

## Summary

Batch 88 (spcopy88) left four things open for the integrated server's copy of the player (`ai.js` PlayerView, `entities.js` `serverPlayerUpdate`, `server-process-player.js`). This track works through them. It does not claim full parity.

1. **A boat or cart broken by damage under the player sends an S08 at the seat.**
   - Natively, EntityBoat and EntityMinecart attackEntityFrom call `riddenByEntity.mountEntity(this)` on a break, before the drop and setDead. EntityPlayerMP.mountEntity re-links (there is no toggle), then sends S1B and setPlayerLocation at the seat.
   - In the port, `boats.js` and `minecarts.js` `attack()` now set `remounted` on the vehicle when they break it with a rider (one new line each).
   - `PlayerView.update` records `brokenSeat` on the tick the client lets go. If the copy is still linked, the riding branch's dead-mount path does it.
   - Then `server-process-player.js brokenMountLocation(ew, p)` runs setLocation at the seat and calls `serverCorrect`, so main.js puts the client there. The S08 does not count in `corrected`, because it is a mount event, not a correction.
   - A crash (`crashBreak`), `/kill` and the void only setDead, so they keep spcopy88's no-S08 dead mount.
2. **The old copy leaves the old world at the portal tick.** transferPlayerToDimension starts with `removePlayerEntityDangerously` on the old WorldServer.
   - `PlayerView.left` is new. main.js sets it from `dims.busy` every movement tick, so it holds from the portal tick through the async save until launch, and a failed trip gives the copy back.
   - While `left` is set, `update()` returns at once and `serverPlayerUpdate` skips the copy: no packet, no `mw.i()`.
   - `closestPlayer` and `closestVulnerablePlayer` return null.
3. **The motion crosses the trip.** Neither transfer method writes the motion. Only the Teleporter does.
   - `dimension-live.js travel()` puts `host.player().motion` (main.js: the copy's motion) into `transit.motion`.
   - `arrive()` seeds the port's Teleporter entity (`e.vx/vy/vz`) with it. The Teleporter already turns x and z at an existing portal, keeps y, and zeroes all three on the End platform. `arrive()` stores the result in `transit.arrivalMotion`.
   - `PlayerView.arriveFrom(old, motion)` takes that motion, falling back to `old.motion`.
   - **Port bug found and fixed:** `arrive()` deletes `record.transit` before `launch()`, so b88's `if (tripLoading && record.transit ...) arriveFrom(leftCopy)` never ran in the game.
     - main.js now keeps the transit in `tripArrival` (set in openWorld just before `launch`) and reads it there.
     - spcopy88's source pin was updated to match.
4. **The mount and bed-start ticks go through setLocation.**
   - On the mount tick (riding now, not last tick, not sleeping), the copy runs setLocation at its own spot. mountEntity's S08 goes to where the server has the player, and the C02 is handled before the tick's C03.
   - On the first sleeping tick, sleepInBedAt zeroes the motion and then runs setLocation at the bed.
   - The riding and sleeping branches in `serverPlayerUpdate` now wait on `hasMoved`, through `awaitedRuns(ew, p)` in `server-process-player.js`:
     - 0 runs while waiting, with the S08 resent when `netTicks % 20 == 0` (nh 1512-1549);
     - 2 runs on the tick the queued C06 answers (the port's same-tick compression);
     - 1 run otherwise.
   - The riding and sleeping packet case in `PlayerView.update` no longer forces `hasMoved = true`.

## Evidence

- **Bytecode-read** (`javap -c -p`, `tools/research/minecraft-1.7.10.jar`; the offsets are in the b89 header of `server-process-player.js`):
  - `xi.a(ro,F)` and `xl.a(ro,F)` 106-118: when a Creative attacker breaks the vehicle, or the damage is over 40, `if (l != null) l.a(this)` runs before the drop and setDead.
  - `xi.h` (the crash) only calls setDead.
  - `mw.a(sa)` → `yz.a(sa)` → `sa.a(sa)` re-links, then S1B and `nh.a(DDDFF)` at s/t/u.
  - `mw.a(III)` → `yz.a(III)`: dismount, setSize(0.2,0.2), the bed spot (+0.5, +0.9375), v/w/x := 0. Then S0A to the trackers, setPlayerLocation, S0A to self.
  - `oi.a(mw,int)`, in order: `mt.f(sa)` (= `ahb.f`: setDead, playerEntities.remove, the chunk, loadedEntityList), K := false, `a(sa,int,mt,mt)`, setPlayerLocation. None of these writes v/w/x.
  - `ahp.a` 198-205 zeroes the motion (End platform).
  - `ahp.b` 1063-1106 turns v and x and keeps w; 1132-1144 zeroes all three when the portal has no side.
  - `nh.a(jd)` 31-87 (the hasMoved wait), 94-300 (riding), 301-359 (sleeping), 1512-1549 (the resend every 20 ticks).
  - `bjb.a(fu)`: the client answers the S08 with a C06 from that exact spot.
- **Port-read:**
  - `dimension-live.js arrive()` runs `delete record.transit` before `launch()`, which is how the dead b88 path was found;
  - `dims.busy` covers travel and respawn (dimension-live.js 456-481);
  - `dimensions.js placeInExistingPortalSteps` turns `e.vx/e.vz`;
  - the boats and minecarts `attack()` break branches.
- **Executed** (port only, no 1.7.10 client): `src/spcopy89-b89.test.js` drives `movePlayer` and `finishPlayerMovement` into the copy with the port's Minecarts and Boats. It also runs `DimensionLive.travel` and `arrive`: to the End, and to a mock Nether with a portal.

## Verification

- `node --test --test-timeout=600000 src/spcopy89-b89.test.js`: 12/12 pass.
- `node --test --test-timeout=600000 --test-concurrency=2 src/spcopy8[5-9]-*.test.js`: 48/48 pass.
- Neighbours: 100 files that import or source-scan the edited files (server-process-player, ai.player, PlayerView, serverPlayerUpdate, processPlayer, arriveFrom, dimension-live, the readdirSync scanners, and the boats/minecarts importers), run with `--test-concurrency=2`: 1402/1402 pass.
- `npm run build`: passes (only the usual chunk-size warning).
- Old tests updated because they encoded a gap this track fixes:
  - `spcopy86-b86.test.js`: the "server places the copy itself while riding" test asserted the direct mount placement (x 44.5). It now asserts the riding branch, the copy staying at its spot, and the queued answer.
  - `spcopy88-b88.test.js`: the dead-mount and main.js `arriveFrom` source pins now match the new code.
- No browser checks were run. Only a browser can confirm:
  - no rubber-band on mounting, entering a bed, a boat or cart broken under the player, or a portal arrival;
  - the client visibly put back at the broken seat before it falls;
  - momentum kept or turned through a Nether portal in play.

## Follow-ups

- `dimension-live.js awayIdle` (about line 1901) also reads `record.transit` after `arrive()` deleted it. It has the same dead read, but it is outside this track's scope.
- `left` follows `dims.busy` until the trip's `finally`. If the new world launches before then, the new copy is held for those last ticks too.
- Other code reads `ai.player` directly without the `left` gate; only the two closest-player lookups are gated. Audit the rest: trackers, villager and golem targeting, experience-orb pickup.
- onGround is not carried across the trip, and neither is the client-side velocity. Only the server copy's motion is.
- The port answers the S08 in the same tick it is sent, so one tick is compressed. Natively the C06 arrives on a later network tick.
- In the port, the client always answers. The wait and resend paths are covered only by tests that drop the answer.
