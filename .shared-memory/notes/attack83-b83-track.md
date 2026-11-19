# attack83 (batch 83) track

Branch `batch83-attack83`, cut from release 0.111.0 (786c05f67).

## Summary

1. **Attack slowdown: both sides now follow `yz.r`.**
   - The rule: `yz.r(sa)` scales `motionX/Z` by 0.6 and calls `setSprinting(false)` inside `if (target.attackEntityFrom(...))` and `if (knockback > 0)`. 1.7.10 has no S12 / velocityChanged step there.
   - Server side: the server's EntityPlayerMP slows on every landed knockback hit. New `slowServerAttacker(survival)` in `player-knockback.js` scales `survival.serverPlayer.motion`. That object is the integrated server's PlayerView or the dedicated server's copy. It is called from:
     - single-player `player-edit-simulation.js` and `structure-simulation.js` (`useMinecart` / `useBoat`);
     - `server-attack-slowdown.js`, `server-pvp.js` (landed hits only) and `server-vehicle-hit.js`.
   - Client side: the attacker's own client slows its real velocity only where its copy's `attackEntityFrom` returns true: another player (bll), a dragon part (wy → xa), a crystal (wz), a cart or a boat. A mob copy returns false when remote (sv.a), so a mob hit no longer slows the single-player velocity. The sprint flag still clears, because the server's S1C reaches the owner.
   - `info.clientLands` is set in `entities.js` `attack()` by `attackLandsOnClient(type)`.
   - PvP: the client half now happens on every hit past the damage gate, landed or not, because bll returns true. A hit on a Creative victim or inside the hurt window still slows the attacker and stops the sprint.
   - Crystal fixes (wz is no EntityLivingBase): no critical; no Sharpness, Knockback enchant or Fire Aspect; no damageDealt stat; no setLastAttacker or Thorns; no weapon wear. The 0.3 exhaustion stays.
   - Hanging entities needed no change. `ss.j` (hitByEntity) ends `yz.r` early, so they take no slowdown and no exhaustion.
2. **The single-player PlayerView has processPlayer's jump rule.**
   - The rule is in `entities.js` `serverPlayerUpdate`: `if (mw.D && !jd.i() && d15 > 0) mw.bj()`, then `mw.D = jd.i()`. The copy gets EntityLivingBase.jump's motion: 0.42F, Jump Boost and the sprint push. The stat and exhaustion are not charged a second time.
   - New `PlayerView.packetDy` (in `ai.js`): the position packet's y minus the last sent y, or 0 when no packet was sent.
   - `main.js` `living` now passes `sneaking`, `flying`, `rider`, `packetGround`, `sprinting` and `yaw`. Single player never set the copy's sneaking, flying or riding before (a found gap). `living-simulation.js` hands the packet ground, sprint and yaw to the view.
   - The rule is skipped without `packetGround` (tests and replays), and for riding or sleeping copies.
3. **A lying player is a 0.2 x 0.2 box.**
   - `client-placement-entities.js` has `remotePlayerBox` and `remoteLying`. The `sleep` field uses the same validity test as `remoteSleepPose`. The box's minY is the wire y.
   - `server-pvp.js` `pickPlayer` uses that box for sleepers. Standing players keep the 0.3 / 1.8 numbers.
   - In `multiplayer/simulation.js` `edit`, the placement `collides` skips sleepers. A sleeper's 0.2 box is added to the `entities` blocker.
4. **C08 255 after a refused place.**
   - New `clientWithholdsPlace` in `right-click-swing.js`. It returns true when no activation happened, the held item has no own `clientUseResult` rule (ItemReed placers, slab merges, beds and so on), and `dryPlace` refuses with `entity-collision` or `player-collision`.
   - In that case the multiplayer click sends `{ type: 'edit', place: true, air: true }` instead of the block edit.
   - On the server, `queueEdit` carries `air` and the action loop passes it on. `edit(p, place, air)` then runs only the no-target branch (onItemRightClick: bucket, airUse, vehicles, throw, rod, map). There is no reach or height gate and no `resendCells`.
   - Why it matters: before this, the server placed with its own entity positions where the native server never attempts the placement.
5. **The dedicated copy's riding and sleeping branches** (`server-copy-step.js`).
   - Riding: `c.onGround = p.grounded` comes before the step, `c.riding = true`, and the copy keeps its motion. There is no charge (`yz.k` returns at once for a rider).
   - Sleeping: the step runs on a 0.2 x 0.2 box and is charged.
   - In both branches `serverCopyAfter` returns before the jump rule and keeps the onGround from the copy's own move.

## Evidence

- Bytecode-read (`javap -c -p`, 1.7.10 jar):
  - `yz.r(sa)`:
    - offsets 0-16: `av()` and the `j` (hitByEntity) early return;
    - `instanceof sv` gates on the afv.a / afv.b enchant reads, the critical, the stat, setLastAttacker, Thorns, and wear (`add.a`, with the wy → dragon swap);
    - 205-211: attackEntityFrom, then addVelocity, `v/x *= 0.6` and `c(false)`;
    - exhaustion 0.3 on every landed target.
  - `bje.a(yz, sa)`: the C02, then `yz.r` on the client.
  - `sv.a(ro, F)` 9-20: false when isRemote. `bll.a` and `xa.a(wy, ...)` are `iconst_1`. `wz.a` returns true unless invulnerable; the explosion is server-only.
  - `ss.j`: attackEntityFrom(player, 0) and return.
  - `nh.a(jd)`:
    - riding 94-300 (`mw.D = jd.i()` at 184, before `mw.i()` at 191);
    - sleeping 301-359 (`mw.i()` at 315, then put back at o/p/q);
    - walking: `mw.i()` 647, put back, d15 = packet y − `mw.t` (711), jump test 1008-1036, `mw.D = jd.i()` 1060.
  - `bje.a(yz, ahb, add, ...)`: the ItemBlock `func_150936_a` refusal returns before the block C08. rightClickMouse then calls sendUseItem (C08 255 → tryUseItem).
- Executed: `pvp-reference.json` (PvpAttackProbe) measures the server's EntityPlayerMP. Its attacker motion now matches the server copy in `pvp-b63.test.js`, including the Creative victim (not slowed on the server).
- Port-read approximation: the single-player view already stands at the new packet position before `mw.i()` (beginTick). The jump test therefore reads `mw.D` as it went into the update (the last packet's onGround), not the result of a step from the accepted position. The two differ only when the copy's own motion lifts it off the floor.
- No new probe.

## Verification

- `node --test src/attack83-b83.test.js`: 12/12 pass.
- Neighbours, run with `--test-concurrency=1`, all pass: 388/388 and 92/92.
  - First run (388): player-edit-simulation, mpplace82, enchantment-effects, mpcombat74, mpplayerfx75, mpvehicles / mpvehicles3, serverplayer-b47, pistonpush-b48, pvp-b63, spswing78/79/80, living-simulation (+ replay), player-knockback, vehicle-simulation, mpsleep / mpsleep2, mpfixes69, mpreach71, multiplayer, mpusesweep75, collide81, aim-copies-b49, movement-stat, mpdragon / mpdragon2, dragon, mpblocks73, tile-edits, combat, fixes68, order74, attack83.
  - Second run (92): mineshaft-integration, polish, mpsmall2, mpwatched76, server-handlers, eye-height, zombie-door-player, village-aggressors, detection, mpclicks70, mpadventure78.
  - Also run: multiplayer-refusal (5/5).
- `npm run build`: OK.
- No full `npm test` and no browser checks (track rules).
- Two old tests encoded gaps and were updated:
  - `player-edit-simulation.test.js`: a cow hit used to expect a client slowdown to 0.06/0.12. It now expects 0.1/0.2.
  - `pvp-b63.test.js`: it compared the client's real motion with the server probe. It now compares the server copy, and the client clears the sprint wherever it slowed.

## Follow-ups

- The single-player copy still moves from the new packet position, not from the last accepted one (beginTick order). There is no packet-move collision zeroing either.
- C08 255 is sent only for the entity refusals. The `occupied` and `*-support` refusals of an ItemBlock also return before the block C08 natively. Today the server refuses them the same way, except for its S23 resend, which native does not send.
- Lily pads (ItemLilyPad.onItemRightClick) after a withheld place are untested.
- `simulation.js` placement `collides` and the sleeper boxes check every connected player, with no dimension filter (unchanged).
- Browser-only:
  - the feel of a sprint hit on a mob in single player (no slowdown now) and on a player or crystal (slowed);
  - sprint resuming with a held key;
  - placing beside or over a sleeping player;
  - aiming at a lying player;
  - no ghost block after a refused place in multiplayer.
