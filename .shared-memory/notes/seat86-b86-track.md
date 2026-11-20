# seat86 (batch 86): what a riding client sends, and lily pads a boat breaks

## Summary
1. **The rider's C0C** (`remote-vehicles.js` `riderPacket`, `main.js` `sendMultiplayerInput`): while `mpRiding` is set the `input` message carries `ride: { s, f, j, k }` = C0C (moveStrafing, moveForward, jump, sneak), computed as the native client does: movement input ±1, ×0.3D when sneaking, then ×0.98F (native strafe sign: to the left). The yaw and pitch already in `input` are the C05. No position is sent (the port never sent one; natively the riding branch ignores the packet's position anyway).
2. **The server's riding rules** (`server-vehicles.js` `cleanRide` / `takeRide` / `applyRide`, `riderInput`; `simulation.js` `input` calls `takeRide`): a C0C sets the rider's moveStrafing / moveForward only when the value lies in [-1, 1] (else the old value stays), and its sneak is what dismounts. An input with no C0C keeps the old steering values and its sneak is the controls' (the C0B of a client that no longer thinks it rides). A client that never sent a C0C (older client, older tests) keeps the old controls rule.
3. **Client boat lag** (`RemoteVehicles.tick` / `ownBoatStep`): the own boat copy now reads the rider's moveForward / moveStrafing from the previous `tick()` (`prevInput`), with the current yaw, because World.updateEntities updates a rider from its mount after the mount's onUpdate. `riderRecord(input, move)` takes the sneak 0.3 factor too (main.js passes `sneak`).
4. **Lily pads** (`boats.js` `boatClearCell`): xi.h's lily pad break is World.func_147480_a: level event 2001 (`id + (meta << 12)`), then the pad drops itself, then the cell clears; a snow layer is setBlockToAir (no event, no drop).
   - Client: the own copy calls `RemoteVehicles.aux(2001, ...)` before the cell clears; main.js draws it with `multiplayerBreakFx` (break sound + destroy particles), both RemoteVehicles constructions.
   - Server: `ServerVehicles.boatHooks` (passed to `boats.tick`) sends `aux` 2001 to every player of the dimension within 64 blocks (strict, from the int corner, nobody excluded, so the rider gets it too) and drops one lily pad through `host.items.dropBlock`. Before: a plain `world.set` (no particles for anyone, no item). Natively the rider therefore sees the pad break twice (his own copy's event and the server's S28).
5. **Idle clock** (`server-idle.js`): an `input` with `ride` neither counts sneak/sprint changes as C0B activity nor moves the remembered sneak/sprint (bjk.a, which holds bW / bX and sends C0B, does not run while riding). A slot change (C09) still counts.

## Evidence
- Bytecode-read (javap, 1.7.10 jar):
  - `bjk.h` (EntityClientPlayerMP.onUpdate): `if (ahb.d(floor x, 0, floor z))` then `blk.h`; `if (am())` (isRiding, `sa.am`: `m != null`, not overridden) sends `jg(y, z, D)` (C05 yaw, pitch, onGround) then `jk(bd, be, bli.c, bli.d)` (C0C moveStrafing, moveForward, jump, sneak); else `a()` (sendMotionUpdates). `a()`'s own `m != null` branch (`jf(v, -999, -999, x, y, z, D)`) is unreachable from `h` (no other caller of `bjk.a()V` in the jar: grep of all 1782 classes).
  - `blj` (MovementInputFromOptions): sneak multiplies both axes by 0.3D; `sv.e`: `bd *= 0.98F`, `be *= 0.98F`.
  - `nh.a(jk)` -> `mw.a(FFZZ)`: only while `m != null`; strafe / forward each set only if in [-1, 1]; `bc = jump`; `b(sneak)` (setSneaking).
  - `nh.a(jd)` riding branch (offsets 94-300): keeps yaw/pitch unless the packet rotates, `m.ac()`, saves pos, `D = jd.i()`, `mw.i()`, `V = 0`, `a(DDDFF)` back to the saved position with the packet's angles, `m.ac()` again, chunk update, last pos, `mt.g(mw)`. Packet x/y/z are never read.
  - `sa.ab` (updateRidden) zeroes motion before `h()`; `yz.ab` dismounts when `!isRemote && an()` (isSneaking). `ahb.h` skips a rider whose mount is alive and holds it (323-348), `ahb.a(sa, Z)` updates the rider after its mount (454-503).
  - `xi.h` 1259-1314: snow `aC` -> `ahb.f(III)` (= `d(x, y, z, air, 0, 3)`), lily `bi` -> `ahb.a(IIIZ)` with true. `ahb.a(IIIZ)`: air -> false; `c(2001, x, y, z, id + (meta << 12))` (-> `a(null, ...)` over the world accesses); if drop `aji.b(ahb, x, y, z, meta, 0)`; `d(x, y, z, air, 0, 3)`. `bma` (RenderGlobal) 2001: break sound ((volume + 1) / 2, pitch × 0.8, cell centre) and `bkn.a` destroy effects. `mp` (WorldManager): S28 `ha(id, x, y, z, data, false)` via `oi.a(null, x, y, z, 64, dim, ...)`. `bjb.a(ha)`: non-broadcast -> `bjf.c(...)` (playAuxSFX on the client world). `aoj` (BlockLilyPad) / `ajr` override no drop method (one pad, damage 0).
- Derived, not probed: the client rider's C05 onGround is false (updateRidden zeroes the motion, so moveEntity's dy is never negative); the port's server copy already uses false (`seat` clears `grounded`). Not sent.
- Not executed: no Java probe this track.

## Verification
- `node --test src/seat86-b86.test.js`: 8 pass.
- Neighbours (24 files incl. mpboat84, mpvehicles-b61/b63, mpriding2, mpriders73, mpvelocity77, mpmisc74, mpreach71, mpstream72, tracker83, rain84, fire85, mppredict85, boats, boatstand, mpclicks, player-mount, riders72, mphorseview78, attack83, movement-stat, mpdispense, blastorder83): 341 tests, 340 pass on the first run; the one failure (mpboat84 "the rider's own boat runs the physics") came from `prevInput` being set in `ride()`; moved to the end of `tick()`, then mpboat84 + mpvehicles-b61 + seat86: 27/27. Source-match neighbours (carts-b70, entity-tracker, mpspawners2, mpsurvival-b58, ring-ticks, tracker-mounts, mpboat84, mpmisc74, away-vehicles, away-throws): 99/99. No old test encoded the gaps.
- `npm run build`: passes (chunk-size warning only).

## Follow-ups
- Browser-only: the feel of steering with the one-tick client lag; the double break effect (local + S28) for the rider; the 2001 sound and particles of a lily pad on other players' screens.
- Single player's boat hook (`main.js` boatHooks.clear) breaks the pad with `breakPlayerBlock`: it charges the player 0.025 exhaustion, the mine stat and tool wear (native func_147480_a has no player). Not changed (main.js / block-break code).
- The C0C's jump is kept on the rider record (`jumping`) but nothing reads it; the horse jump still goes through `horseJump` / `p.input.jump`.
- The server copy's riding branch (`server-copy-step.js`) takes onGround from `p.grounded`, not from a packet; equivalent while the client's is false.
- Away runs (`away-world.js`) and the integrated tracker copies still clear lily pads without the 2001 effect or drop (not this track's files).
