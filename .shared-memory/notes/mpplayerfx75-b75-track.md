# Batch 75 mpplayerfx75: server player state that reaches the client

## Summary
- Death throw on the server: `src/multiplayer/server-death-throw.js` (new) `applyDeathThrow`, called from `ServerSurvival.die`. The dead player's `velocity` gets the `death-throw.js` motion (attackedAt from `Survival.damage`, yaw of the server player), the knock queue is emptied, drowning keeps the old motion. The server already moves a dead player with idle input, so the position stream shows the flying body to the owner (his row drives his camera) and to every viewer. Respawn already zeroes the velocity.
- Attacker slowdown (split by target, lead review): MOB targets: `server-attack-slowdown.js` only clears `motion.sprinting` (no motion scaling). PLAYER targets: `server-pvp.js` keeps scaling the attacker's motion by 0.6 and clears sprint, because EntityOtherPlayerMP (`bll`) answers attackEntityFrom with true, so the native client slows itself. The port's client has no motion of its own in multiplayer (position rows are the server's), so the server scaling IS the client-side slowdown; no `main.js` hook. `pvp-b63` is back to the original. `mpcombat74-b74` (mob) updated.
- Player tracker (`server-player-tracker.js`): forced off-beat sends (`jumped` = was grounded, now airborne and higher; `watcherSig` change = sneak, sprint, item in use, burning, invisible, health, absorption, air, arrows, potion colour) passed to `sendLocation(airBorne, dataChanged)`; head angle with its own S19 baseline (`rotationYawHead` = body yaw, rows carry `head`, `PlayerBody.tick({head})`, `presence.js` passes it); S18 teleport y + 1/64 kept until the next relative move packet (`lift` in `released`).
- Idle (`server-admin.js`): the clock is wall-clock ms (`clock` option, default `Math.floor(performance.now())`, the nanoTime/1e6 of `getSystemTimeMillis`); `join(id, at)`, `activity(id, msg, at, chat)`, `idle(now)`. Callers in `server/server.js` (2 lines) and `simulation.js` (1) no longer pass ticks. `idle` also needs the stored time > 0, as native `x() > 0`.
- Wire: no new messages. Rows gain an optional `head` field.
- Tests: `src/mpplayerfx75-b75.test.js` (9).

## Evidence
- Bytecode-read (javap, unchanged 1.7.10 jar): `my.a(List)` (EntityTrackerEntry.updatePlayerEntity/sendLocation): block runs on `m % c == 0 || entity.al (isAirBorne) || entity.z().a() (hasChanges)`; `al` reset to false after the block; S19 head `ht` sent inside the block when |byte(au() * 256 / 360) - i| >= 4; the last lines send S12 `hy` through `b(ft)` when `velocityChanged`; `my.b(ft)` sends to all tracking players and to the `mw` itself, so S12 and the S1C metadata (`my.b()`) reach the owner. `sv.a(ro, F)` returns false at once when `worldObj.isRemote` (client mobs), but `bll.a(ro, float)` (EntityOtherPlayerMP) is `iconst_1; ireturn`, so against a remote player the client's hit counts. `yz.a(sa)` (attackTargetEntityWithCurrentItem): the `0.6` motion scale, `setSprinting(false)` and the Knockback push all sit under `if (entity.attackEntityFrom(...))`. `sv.e()` sets `aO` (rotationYawHead) = `y` (rotationYaw) in the non-AI branch; no class but `bjb.a(...)` (client S19) calls `sa.e(F)`; the server player's head is the body yaw. `bjb.a(ik)` (S18) is the only client handler with the `0.015625` y offset (all entities, players too). `nh.update`: `getSystemTimeMillis() - x() > minutes * 1000 * 60`, `x() > 0`.
- Executed: nothing new (the entry code is the executed `TrackerEntry`; the pvp reference `pvp-reference.json` is the server entity's motion).
- Recalled: `Entity.jump` sets isAirBorne and `NetHandlerPlayServer.processPlayer` calls `jump()` for a grounded-to-airborne packet with dy > 0 (not re-read this batch); potion colour, arrows, absorption watcher indices.

## Gap findings
- Death throw: closed (server + owner + viewers through the position stream). Native S12 is only sent when `setBeenAttacked` ran (everything but drowning), modelled.
- Attacker slowdown: for mobs the client's attack returns false (no motion change, only the S1C sprint flag); for players it returns true and the client slows itself, kept on the server (b74 was right for PvP, wrong for mobs).
- Forced sends, head packet, y + 1/64, idle in ms: closed. "Head angle is body yaw" was native-correct; only the separate baseline was missing.

## Verification
- `node --test src/mpplayerfx75-b75.test.js` 8 pass. One at a time: mpcombat74-b74 4, pvp-b63, mptrack74-b74 6, mpcadence72 10, streamfix73 9, mpstream72 10, mptrackers71 10, mpnether-b61 7, mpsurvival-b58 8, mpmobs-b59 10, mpmobs2-b60 7, multiplayer 5, deathdrops-b48 7, particles73 6, serverprops-b69 19, serverprops2-b70 6, server-handlers 17, mpadmin-b68 10, mpadmin71 7, mpmisc74 5, player-renderer 26: all pass. `node --check` on every touched file.
- Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Only a browser shows the thrown body from the owner's camera and a viewer's head turning with its own baseline.
- Remote copies' own motion from S12 is not modelled (the interpolated position stream drives them).
- Datawatcher entries for sleeping, riding and score are not in `watcherSig`.
