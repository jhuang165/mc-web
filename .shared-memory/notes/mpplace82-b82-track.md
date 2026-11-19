# mpplace82 (batch 82) track

Branch `batch82-mpplace82`, cut from release 0.110.0 (3b99e1bd4).

## Summary

1. **Placement prediction checks entities now.**
   - `dryPlace` passes `entities: hooks.entities ?? state.entities` to `placeHeldBlock`.
   - The single-player `predictPlace` state gets collide81's `placementEntities`.
   - `player-edit-simulation.js` uses `hooks.placement.entities` for its piston-moving swing rule.
   - New `src/multiplayer/client-placement-entities.js` (`clientPlacementBlocker`) builds the test from the multiplayer client's copies: other players (0.6 x 1.8, skipped once `entry.hidden`), mob copies (`RemoteMobs.list()` and `factory.size`), cart and boat copies (`bb`), and primed TNT rows (a 0.98 box from the wire's bottom y).
   - `rightClickSwings` / `clientItemUse` take `entities`. The multiplayer click passes `mpPlacementEntities`, so a refused ItemBlock does not swing.
   - Native refusal point: `bje.a` returns false before the C08.
2. **Dragon part hits.**
   - Neither side has a critical or enchantment spark. Already true; it is now tested, including Sharpness.
   - New: the attacker slows itself. `wy.a` → `xa.a(wy, ro, F)` returns true on the client, so `motion * 0.6` happens there. `server-attack-slowdown.js` now scales `p.velocity` when `info.part` is set, and `entities.js` `attack` sets `info.part`.
   - New: a part hit always lands. `xa.a(wy)` ignores the hurt window, so `entities.js` skips the `e.hurt && damage <= lastDamage` precheck for the dragon. The sword wears and the hit costs exhaustion.
   - Extra (PvP): the attacker's own client runs the hit, because `bll.a(ro, F)` returns true. The attacker now gets its own crit / magic crit burst from `sendOwnCritFx` in `server-crit-fx.js`, even when the server refuses the hit. The attacker therefore sees two bursts for a landed crit, as native does.
3. **The server copy's second movement charge is real.**
   - New `src/server-copy-stat.js`: `serverCopyStat` / `chargeServerCopy`.
   - New `src/multiplayer/server-copy-step.js`: `p.serverCopy` and `serverCopyBefore` / `serverCopyAfter`, called around `movePlayer` in `simulation.js`.
   - The copy is also `p.survival.serverPlayer`, so `queueKnockBack`, `queueVelocity` and explosion pushes add to it at the hit. The mob AI views share its motion object (`server-mobs.js` `addPlayer`).
   - `entities.js` `serverCopyMove` is extracted from `serverPlayerUpdate` and shared.
   - Single player: `mobs.serverCopyMoved` (set in `main.js`) charges the integrated server's PlayerView move.

## Evidence

- Bytecode-read (`javap -c -p`, 1.7.10 jar):
  - `bje.a(yz, ahb, add, IIII, azw)`: an `abh` instance check, then `abh.a(ahb, IIII, yz, add)` (which calls `ahb.a(aji, IIIZ, I, sa, add)`), then `ireturn` at 140, before the `jo` C08 at 170.
  - `abh.a(add, yz, ahb, ...)` also calls `ahb.a(aji, IIIZ, I, sa, add)`.
  - `wy.a(ro, F)`, `xa.a(wy, ro, F)` (always `iconst_1`), `xa.a(ro, F)` (false), `bll.a(ro, F)` (`iconst_1`).
  - `blk.b(sa)` / `c(sa)` (EntityCrit2FX, magicCrit), and `mw.b` / `c` → `my.b(ft)`.
  - `nh.a(jd)`: `mw.i()` at 191, 315 and 647, the position put back, the `mw.bj()` jump rule, `mw.d` and `mw.k`.
  - `mw.i` begins with `invokespecial yz.h()`.
- Port-read: the copy physics (`serverCopyMove`) are the b47sp PlayerView step. The test numbers (10 cm a tick terminal sink, 40 cm fly from a knockback) come from the port's physics, not a probe.
- No new executed probe.

## Verification

- `node --test src/mpplace82-b82.test.js`: 11/11 pass.
- Neighbours, each run with `--test-concurrency=1`. All pass:
  - Placement and prediction (block-placement-simulation, clientfire-b58, prediction5-b59, spswing78/80, smallchecks2-b60, crystal-fire-b57, instantbreak-b55, player-actions, prediction4-b58, client-predict-b56/b57, collide81): 94/94.
  - Combat, stats and dragon (explfx79, movement-stat, mpcombat74, mphorseview78, mpmobs2-b60, mpplayerfx75, mpreach71, mpstats-b63, particles73, pvp-b63, stats, player-environment, corpse80, corpse81, dragon): 131/131.
  - Multiplayer mobs and projectiles (mpmobtypes-b61, mpprojectiles-b62/b63, mpend2-b64, mpcopies81, blast81, mpperf81, mpfx80): 67/67.
  - Server copy and source-text (entityprobes-b64, fixes68, legacy-body-b50, mobpush-b46, mpfixes69, pistonpush-b48, piston-order-b49, serverplayer-b47, order74, spsounds-b75): 173/173.
- `npm run build`: OK.
- No full `npm test` and no browser checks (track rules).
- No old test encoded these gaps; none needed changes.

## Follow-ups

- Single player has no `processPlayer` jump rule on the PlayerView, so the integrated copy's post-jump fly and walk residue is not charged. The copy also takes no packet-move collision zeroing.
- Single-player attack (`player-edit-simulation.js` ~270) scales the player's velocity for every knockback hit. Natively, the client slows only for dragon parts and other players. A mob hit only stops the sprint (the S1C), as `attackerSlowdown` already does in multiplayer.
- The mounted (191) and sleeping (315) `mw.i()` charges are not ported. Riding gives the mounted stat from the rider's re-seat; sleeping gives about zero.
- The client copy of a sleeping player is tested as 0.6 x 1.8. Natively it is 0.2 x 0.2.
- On the client, `bje.a` refusing an ItemBlock goes on to `sendUseItem` (C08 255). The port still sends its single `edit` message; the server's placement check refuses it the same way.
- Browser-only: the swing and no-swing when placing into another player or a mob copy; the double crit burst on the attacker's screen in PvP; the slowdown feel after a sprint hit on the dragon.
