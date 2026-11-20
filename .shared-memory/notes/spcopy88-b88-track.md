# spcopy88 (batch 88): the single-player server copy owns the landing's effects, waits on dismount and arrival, and lets go at a dead mount's seat

## Summary

Batch 87 (spcopy87) left five things open for the integrated server's copy of the player (`ai.js` PlayerView, `entities.js` `serverPlayerUpdate` / `processPlayer`, `server-process-player.js`). This track works through them. It does not claim full parity.

1. **The landing's dust, the trample and the fall stat now come from the copy.** `handleFalling(world, p, dy, ground, hooks)` follows `sv.a(DZ)`'s order on a landing with R > 0:
   - `dust(x, y, z, ceil(R - 3))` when the block at (floor x, floor(y - 0.2), floor z) is not air and R > 3 (World.playAuxSFX 2006);
   - `trample(R)` (Block.onFallenUpon);
   - `stat(R)` for R >= 2 outside Creative (EntityPlayer.fall's distance-fallen stat);
   - then the b87 damage.

   `EntityWorld.copyLanding(p)` routes these to the existing `landingDust` and `onLand` hooks and to a new `serverFallStat` hook, which `main.js` wires to `addFallStat`. When the copy owns the fall (`fallOwner`), `player-environment.js landPlayer` skips its trample and dust, and `main.js` skips both client `addFallStat` calls (the tick's landing and a piston push's landing). The fall sounds stay on the client. `main.js trampleFarmland` now also treats an `isPlayer` entity as a player for the mobGriefing exemption. Before, only `entity === position` passed, so the copy would have needed mobGriefing.
2. **The S08 wait.** The wait itself was ported in b86 (`setLocation`, `hasMoved`, the queued C06 `answer`). This track adds the parts that were missing:
   - processPlayer 681-688 (`if (!r) return` after `mw.i()`): a setPlayerLocation inside the copy's tick ends the packet at the new spot.
   - The deliberate dismount is now `mountEntity(null)` → setPlayerLocation. The copy is put on the client's spot and waits for the C06, then takes the walking branch. Before, it was placed directly.
3. **A stale seat.** A mount that died or was removed (`.dead`: the boats' and carts' flag, the horse seat's isDead) is dropped natively by Entity.updateRidden or World.updateEntities. Neither calls setPlayerLocation, so the copy stays at its last seat. In the port:
   - `serverPlayerUpdate`'s riding branch reads the live mount through the new `serverMount` hook (`main.js`: `rider.vehicle`). When that mount is dead, the packet (a C05, with no position) goes to `processPlayer` from the seat.
   - On the tick the client's link ends, `PlayerView.update` tells the two cases apart: a dead `mount` takes the walking branch with no wait, and anything else is the dismount above.
4. **The portal tick.** transferPlayerToDimension keeps the same EntityPlayerMP: nothing on the way writes R, and it ends with setPlayerLocation at the arrival.
   - `main.js` now keeps the old copy (`leftCopy`) across `leaveWorld`. On a portal trip (`tripLoading && record.transit` that is neither an End exit nor a death; both of those go through respawnPlayer, which makes a new entity) it calls `mobs.ai.player.arriveFrom(leftCopy)`.
   - That carries `fallDistance`, `inWater` and `corrected`. The first tick in the new world is then a setLocation at the arrival rather than a login's direct placement.
5. **Boat bobbing.** Natively the bob does not matter to the copy. The tracker never sends it (a relative move needs a delta of at least 4/32 block, or 60 ticks), so the native client stands on a still boat. The server copy is checked against the live, bobbing boat, but the bob (about 0.04) stays under processPlayer's 1/16 box shrink, so it trips no correction (executed).
   - The port does differ, though. The client collides with the live boat (one `Boats` and one `boatBoxProvider` for both sides), sinks into the rising box, and the copy rightly puts it back. In the test harness that gave 167 corrections in 200 ticks.
   - This is a client and boat-system issue (boatray88's files), not a copy issue. It is recorded below and not fixed here.

## Evidence

- Bytecode-read (`javap -c -p`, `tools/research/minecraft-1.7.10.jar`; the offsets are in the `server-process-player.js` header):
  - `sv.a(DZ)` 0-212: the dust and trample order quoted in item 1, with the `ahb.E` (isRemote) test on the 2006 call. Air falls back to the block below when its render type is 11, 32 or 21.
  - `aky.a` (BlockFarmland.onFallenUpon): `!E && nextFloat < R - 0.5`; a non-player only with mobGriefing.
  - `yz.b(F)`: returns on allowFlying (`bE.c`); `R >= 2` → `a(pp.j, round(R * 100))`.
    - `pp.j` is independent (`ph.i()`). `bjk.a(ph, I)` passes it on, but `blk` and `blg` do not override `a(ph, I)`, so it reaches EntityPlayer's empty one. Only `mw.a(ph, I)` (StatisticsFile) counts it.
  - `nh.a(jd)` 681-688.
  - `sa.ab`, `sa.C` 13-31 (the dead-mount drop) and 202 (`b(I)` travelToDimension inside `mw.i()`).
  - `ahb.h` 324-361.
  - `mw.a(sa)`: S1B, then setPlayerLocation.
  - `yz.a(sa)` (dismountEntity for null).
  - `xi` / `xl` attackEntityFrom call `rider.mountEntity(this)` before setDead; `xi.h` (a crash) sets dead only.
  - `oi.a(mw, int)`, `mt.f`, `ahp.a(sa, DDDF)` (motion zeroed or turned, R untouched).
  - `my.a(List)` 481-507 (the 4/32 threshold) and the 60-tick resend.
- Port-read:
  - the `main.js` hooks (`onLand`, `landingDust`, `playerLanding`, the world switch in `launch`);
  - `dimension-live.js` `transit {from, exit, death}`;
  - `vehicle-simulation.js` (a dead vehicle runs the client's `minecarts.dismount` spot search);
  - the `.dead` getters in `horse-live.js`, `boats.js` and `minecarts.js`;
  - `farming.js trample`, `stats-live.js addFallStat`.
- Executed (port only, no 1.7.10 client): `src/spcopy88-b88.test.js` drives `movePlayer` and `finishPlayerMovement` into the copy with the port's Boats, Minecarts and horse.

## Verification

- `node --test --test-timeout=600000 --test-concurrency=2 src/spcopy88-b88.test.js src/spcopy87-b87.test.js src/spcopy86-b86.test.js src/spcopy85-b85.test.js`: 36/36 pass (12 of them new).
  - A drop gives the copy's dust once at ceil(R - 3), the trample once with the copy, the stat once and the damage once, with nothing from the client.
  - Small falls: a jump gives a trample with no stat and no dust; a 2.5-block step-off gives the stat only.
  - Farmland becomes dirt from the copy's landing.
  - `handleFalling` units: over air there is no dust, Creative gives no stat, and water zeroes R first.
  - `landPlayer` with and without `fallOwner`.
  - 681: a setLocation inside `mw.i()` ends the packet.
  - A dead cart lets the copy go at its seat with no wait or S08. A dismount answers its C06. A removed horse behaves like the dead cart.
  - A portal arrival carries R = 6, which gives the native damage on landing; a login carries none.
  - The bob: a native-style still client boat gives 0 corrections. The port's shared boat is measured as a diagnostic.
  - Source pins.
- Updated an old test that encoded the gap: `spcopy86-b86.test.js` "the server places the copy itself while riding, on the dismount, ..." asserted that the dismount was a direct placement. It now asserts `direct === false`, `hasMoved === false` and the queued C06, and the test was renamed.
- Neighbours, 55 files (everything that names `ai.player`, PlayerView, processPlayer, landPlayer, finishPlayerMovement, handleFalling, addFallStat, the hooks, or scans source text, plus the farming, game-rule, dimension-live and vehicle tests), run with `--test-concurrency=2`: 629/629 pass.
- `npm run build`: built (only the usual chunk-size warning).
- Browser-only (not checked; no browser checks per the track rules):
  - the dust shows on a real landing, from the copy's hook;
  - farmland breaks under the player;
  - the fall stat appears in the Statistics screen;
  - no rubber-band on a dismount, on a vehicle killed under the player, or on a portal arrival;
  - the boat-standing rubber-band in the browser.

## Follow-ups

- The client's dead-vehicle path (`vehicle-simulation.js`, horse88 / boatray88): natively the client also lets go at the seat and falls. The port searches for a `dismountSpot`. The copy follows either way with no wait, but the player lands somewhere else than native.
- A boat or cart broken by damage: `attackEntityFrom` calls `rider.mountEntity(this)` (a re-link, sending an S08 at the seat) before setDead. This is not modelled; the port treats it as a dead mount (no S08).
- The boat bob in the port: the client should collide with the boat where the tracker last put it, not the live box (boats.js / entity-collision.js, boatray88). spcopy87's note about this stands.
- The portal trip: the old copy keeps processing during the async travel save ticks (natively it leaves at once), and the motion is not carried (the Teleporter zeroes or turns it anyway).
- The mount and sleep-start ticks are still direct placements, with no S08 / C06 exchange modelled.
- The dust's fence, wall and gate fallback (air → the block below when its render type is 11, 32 or 21) only changes which block's onFallenUpon runs. The dust needs a non-air block at the feet in both the native code and the port.
