# spcopy85 (batch 85): the single-player server copy follows processPlayer

## Summary

- The integrated server's copy of the player (`ai.js` PlayerView, `entities.js` `serverPlayerUpdate`) now runs `NetHandlerPlayServer.processPlayer`'s walking branch in its native order for the live host (one that gives `packetGround`, not riding, not asleep):
  1. `PlayerView.from` is the last accepted position (nh.o/p/q, the entity's own position when the packet arrives). `mw.i()` (onUpdateEntity) and the copy's own pushes run from there, not from the new packet position.
  2. The copy is put back at `from`; the jump rule reads `mw.D` as the copy's own onGround after that move (the b83 port-read approximation is gone for the live copy).
  3. `mw.d(delta)`: moveEntity by the packet's difference with stepHeight 0 and the sneak edge, so a clipped axis zeroes its motion (the packet-move collision zeroing the b82 / b83 notes listed as missing). The web flag follows the same move.
  4. `mw.D = packet onGround`, then the "moved wrongly" test (`d25 > 0.0625`, |dy| < 0.5 counts as 0, not sleeping, not Creative) and the collision tests at the accepted and the packet position (box shrunk by 0.0625). `d28 && (wrongly || !d32)` answers with setPlayerLocation(from): `p.corrected++`, `mobs.serverCorrect(from)`, `sent` reset at `from` (the client's C06 answer).
  5. `main.js` `mobs.serverCorrect` is the client's S08 handler (bjb.a(fu): position set, motion zeroed).
- New pure module `src/server-process-player.js` holds the checks (`movedTooQuickly(delta, motion, { owner })`, `movedWrongly`, `needsCorrection`, `shrunkBox`) with the offsets in its header.
- "Moved too quickly" is skipped for the integrated server's owner: `N()` is `serverOwner != null`, `M()` the owner name, which `IntegratedServer.<init>` sets to the session name (bsx.<init> `j(...)`). It fires for everybody on a dedicated server (`movedTooQuickly(..., { owner: false })`). The floating-too-long kick is off in single player: `bsx.e` calls `h(true)` (allowFlight).
- The dedicated multiplayer server is unchanged: it moves the player from its input (`movePlayer`, `server-copy-step.js`), has no packet position to compare, and does not import the new module (its flight check stays `flightCheck`, b69). A source test pins this.

## Evidence

- Bytecode-read (`javap -c -p`, 1.7.10 jar): `nh.a(jd)` offsets 360-426 (o/p/q and d5/d7/d9 taken from the entity), 643-678 (`mw.i()`, put back), 689-966 (the deltas, `d25 > 100`, the `N() && M().equals(name)` exemption, S08), 967-1006 (d28), 1008-1073 (jump rule, `mw.d`, `mw.D`, `mw.k`), 1076-1226 (wrongly), 1227-1326 (position := packet, d32, S08), 1359-1464 (floating); `sa.d(DDD)` 1461-1495 (a clipped axis zeroes v/w/x); `mw.<init>` (`W` stepHeight 0); `MinecraftServer.N/M/ac`, `bsx.<init>`, `bsx.e`; `bjb.a(fu)` (client S08 handler).
- Port-read: collision lists use blocks only (`mt.a(entity, aabb)` also lists entity boxes such as boats); the client's C06 answer is modelled as `sent` reset at the corrected position; `hasMoved` (`nh.r`) and the 20-tick teleport branch are not ported.
- Not executed: no probe; no executed record of a packet into a wall.

## Verification

- `node --test src/spcopy85-b85.test.js`: 6/6 pass (checks both modes, from-position, wall correction incl. Creative, jump under a ceiling, teleport snap, legacy copy, source pins).
- Neighbours (concurrency 1): 445/445 pass (attack83, serverplayer-b47, mobpush-b46, pistonpush-b48, pvp-b63, player-knockback, living-simulation (+replay), legacy replays through village-fight / horse / enderman / witch / wolf, detection, eye-height, tick-sequence, mpplace82, fixes68, mpfixes69, revenge-target, zombie-door-player).
- No full `npm test`, no browser checks.

## Follow-ups

- Mobs still see the new packet position at `beginTick` (before the entities); natively packets are processed in the network tick after `World.updateEntities`, so mobs see the previous accepted position. Kept because the executed replays (b46mp / b47sp harnesses) place the copy at the script's position before the tick.
- A packet over 10 blocks (squared 100) is treated as a server-side teleport (snap, no checks). Natively a /tp, portal or bed wake is the server moving the copy itself; the port moves the client and lets the copy catch up, so it has no clean "server moved the player" signal.
- Riding and sleeping branches are unchanged (b83). Entity collision boxes (boats) are missing from the d28 / d32 lists. `mw.b(dy, onGround)` (the server's fall bookkeeping) is the client's survival.
- Browser-only: that no stair, slab, ladder, web, water edge or piston push in single player trips a spurious S08 rubber band.
