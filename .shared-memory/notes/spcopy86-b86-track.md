# spcopy86 (batch 86): the single-player server copy runs processPlayer in the network tick, with hasMoved

## Summary

Batch 85 (spcopy85) left four things open. This track closes them for the integrated server's copy of the player (`ai.js` PlayerView, `entities.js` `serverPlayerUpdate` / `processPlayer`).

1. **Mobs read the accepted position.** `PlayerView.update` no longer writes the C03's position into the copy. It holds it as `packet`. `serverPlayerUpdate` processes it in the network tick after `World.updateEntities` (after every mob and the tile pass). So the world tick's mobs, the piston pass and the explosions read the position processPlayer accepted last, as they do natively. `from` (nh.o/p/q) is now the copy's position when the packet is processed, including any piston push from that tick's tile pass. B85 took it before the tick.
2. **The 10-block guard is gone.** A far packet runs the native checks. "Moved too quickly" (`d25 > 100`) is skipped for the integrated owner (`N() && M().equals(name)`), so a far packet goes through `mw.d` and the "moved wrongly" and collision tests. Natively, a server-side move is `setPlayerLocation`. The port now has it as `PlayerView.setLocation(at)`, and `main.js` calls it on the single-player paths that natively go through `nh.a(DDDFF)`:
   - `env.teleport` (CommandTeleport `bv.b`, used by `/tp` and `/spreadplayers` in single player);
   - the ender pearl's teleport hook (`mw.a(DDD)` setPositionAndUpdate);
   - the bed wake (`mw.a(ZZZ)`);
   - the debug `__mc.teleport`.

   A test shows the gap this fills. The same jump through a wall is put back (S08) when it is a client move. With `setLocation` first, it is kept.
3. **The `packetGround` gate is gone.** It was not a native condition. Only the live host passed `packetGround`, so the gate really meant "this caller is a harness that places the copy itself". `EndermanWolfProbe` does that: `VillageFightProbe.at` puts the copy at the packet's position before the world tick, then `player.i()` and a put-back. Every copy now runs processPlayer. A harness says what it does with `PlayerView.placed = true`:
   - `enderman-wolf-replay.js` (b46mp / b47sp / b48pp records);
   - `leads3.test.js` and `flyturn-b51.test.js`, whose probes set the player's position directly;
   - `detection.test.js`, which calls `beginTick` with no network tick.

   With no `packetGround`, a caller's packet onGround is the copy's own onGround after `mw.i()`, so the jump rule cannot fire.
4. **hasMoved (`nh.r`) and the 20-tick branch.** `setPlayerLocation` sets `r = false` and `o/p/q` to the spot, moves the entity there and sends the S08. While `r` is false, every packet is ignored and `mw.i()` does not run. Only a packet with x == o and z == q exactly, and (y - p)^2 < 0.01, sets `r` again (offsets 31-87, `server-process-player.js awaitedAnswer`). Until then, `if (e % 20 == 0)` resends the S08 (1512-1549), where `e` is nh.a()'s network-tick counter (`PlayerView.netTicks`, ++ after the tick's packets). The answer is the C06 that the client's S08 handler `bjb.a(fu)` sends from inside the handler: the exact spot, onGround false. That handler does not reset the client's last reported position. B85's `sent` reset is gone. When `serverCorrect` exists (main.js applies the S08), the C06 is queued as `PlayerView.answer`. The next network tick processes it first (it has its own `mw.i()`), then that tick's C03. `setLocation` also drops a C03 already in flight, which natively arrives while `r` is false. With no client to take the S08 (no `serverCorrect`), the copy keeps waiting and resends every 20th network tick.

The server still places the copy itself in these cases. They are PlayerView `direct`: the copy rests where `update` puts it, then `mw.i()` runs and the position is put back, as before.
- At login, the first update (`initializeConnectionToPlayer`).
- On respawn (`respawnPlayer`, a new EntityPlayerMP) and while dead.
- While riding, where the mount carries the copy (riding branch 94-300).
- On the dismount tick (`mountEntity` then `setPlayerLocation`).
- While asleep: the sleeping branch 301-359 puts the copy back at o/p/q, which `sleepInBedAt` set.
- For `unticked` copies (the dedicated server's views and the replays that never tick the player).
- For `placed` harnesses.

The S08 / C06 exchange of these server moves is not modelled, because copy and client already agree.

Kept: the integrated owner's exemption from "moved too quickly" (native), the "moved wrongly" and d28 / d32 tests, `mw.d` with stepHeight 0, the jump rule and the floating check that never counts in single player (allowFlight). The dedicated server is unchanged. Its views are `unticked`, and `simulation.js` still does not import `server-process-player.js`.

## Evidence

- Bytecode-read (`javap -c -p`, 1.7.10 jar):
  - `nh.a(jd)` 0-30 (left the world), 31-87 (hasMoved test), 87 / 94-300 / 301-359 (r wraps the riding and sleeping branches), 360-426, 643-1464 (as in b85), 1512-1549 (`e % 20` resend).
  - `nh.a(DDDFF)` (r = false, o/p/q, `mw.a`, S08 with y + 1.62 and onGround false).
  - `nh.a()` (++e, before keep-alive).
  - `bjb.a(fu)` (client S08: motion zeroed, position set, C06 `jf` with x, minY, posY, z and the S08's onGround, sent from the handler; the first-time block resets prevPos, not the last reported position).
  - A javap scan of every top-level class for `nh.a(DDDFF)` callers: `bv.b`, `mw.a(ZZZ)`, `mw.a(DDD)`, `mw.a(sa)`, `mw.b(I)`, `mw.a(III)`, `oi.a(mw,int,boolean)`, `oi.a(ej,mw)`, `oi.a(mw,int)`.
- Port-read: packets are processed once per network tick (the port's one C03 per tick, plus the queued C06). Collision lists still use blocks only (no boat boxes). The integrated server's thread timing (when the C06 arrives relative to the next tick) is modelled as "next network tick, first".
- Not executed: no probe of processPlayer with a live NetworkManager. The walk tests drive the port's own client physics (`player-physics.js movePlayer`, what `main.js` runs), not a 1.7.10 client.

## Verification

- `node --test src/spcopy86-b86.test.js`: 10/10 pass. The client physics drives the copy through a walk, a sprint, sprint-jumps and jumps in place (take-offs on the copy checked), a ledge fall and a 13-block drop, 0.5-slab steps, walking into and sliding along a wall, a sneak to an edge, a ladder climb, hold and slide, and a swim. Every tick the copy stays within the C03 threshold of the client, and no correction or S08 happens. Further tests cover mobs reading the accepted position, no gate, the hasMoved wait and the `e % 20` resend, the C06 answer ordering, `/tp` and a pearl inside the tick through a wall versus the same move as a client move, and direct placements. Mutation check: dropping the y delta from `mw.d` fails the fall and step tests.
- `node --test src/spcopy85-b85.test.js`: 6/6 pass. Updated:
  - the wall test now expects the copy to wait for the answer, not the `sent` reset;
  - the >10-block test is renamed (native checks, owner exempt);
  - the legacy test uses `placed`.
- Neighbours, concurrency 1: the 91 files that touch `ai.player`, `serverPlayerUpdate`, `serverCorrect`, `packetGround`, the replays, and b85's list. Result: 1275 tests, 1271 pass. The 4 failures were harness placements (detection, flyturn ghast x2, leads3) and now pass with `placed`: 28/28. The wider set: 183 more files that drive an EntityWorld or a replay, concurrency 1, 3377/3377 pass.
- No full `npm test`, no browser checks.

## Follow-ups

- Browser-only:
  - That no stair, slab, ladder, web, water edge, soul sand, ice, piston push or boat edge trips a spurious S08 in a real session.
  - That `/tp`, an ender pearl and a bed wake land without a snap back.
  - That an S08 the host takes resumes at once, with no visible stutter.
- Other server-side moves in `main.js` that natively call setPlayerLocation are covered only as `direct` (riding / dismount, respawn, login, dimension travel through a new EntityWorld). Any new `main.js` path that moves the client without `setLocation` will now be checked like a client move, and can be put back if it passes through blocks.
- `mt.a(entity, aabb)` also lists entity boxes (boats). The d28 / d32 lists are still blocks only.
- The riding and sleeping branches are not ported beyond `direct`, for example `oi.d(mw)` and the mount's `sa.ac` order.
- `mw.b(dy, onGround)` (the server's fall bookkeeping) is still the client's survival.
