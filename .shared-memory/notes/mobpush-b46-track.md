# Mob pushes on the player and the witch's lead: executed records and port (batch 46, branch batch46-mobpush)

## Summary
- **New executed set `b46mp`** (`EW_SET=b46mp`, probe arg `b46mp`, `EndermanWolfScenarios.run46`, `public/research/enderman-wolf-b46mp-reference.json`, replay export `reference46`, `src/mobpush-b46.test.js`): 20 tests over 19 records on the unchanged obfuscated classes. The batch 45 harness (rows with the fifth `extras` element) now also runs **`EntityPlayerMP.onUpdateEntity` (`mw.i`) on its real player after the mobs each tick** (the network tick), so the native `EntityLivingBase.onLivingUpdate` of the server copy runs: motion snap below 0.005, `moveEntity`, friction, then `collideWithNearbyEntities`. Row element `5[3]` is that player's motion; elements 6 and 7 are the copy's `onGround` at the start of its update and its y at the start of the tick (inputs the client reports in a position packet; the replay feeds them). The probe puts x and z back at the client's place after `mw.i` (a position packet); y follows its own motion. Existing sets are untouched: the b45cw and b45 dumps are byte-identical to the committed references.
- **Records:** cows and pigs touching, diagonal, coincident (distance 0), just over the 0.01 threshold, a crowd of four, creative, walking into and through herds, a zombie touching and hitting (knockback then pushes), a witch throwing at a pushed, a knocked (three hits), a knocked-by-poison-range and a walking player, and at a knocked cow (mob target motion). Mutation checks: with the witch's lead forced to 0 three records (`witch-knocked-8016`, `witch-cow-knocked-8017`, `witch-knocked-poison-8018`) diverge; without the friction 13 diverge; without the player's own update 14 diverge.
- **Executed findings** (all on the real classes):
  - `mw.h` (`EntityPlayerMP.onUpdate`) does not call super; the living update runs in `mw.i` (`onUpdateEntity`, `invokespecial yz.h`). The mob-to-player push and the player-to-mob push are `sa.g(sa)` both ways with the float `qh.a(D)F` square root, threshold 0.009999999776482582, 0.05000000074505806 and `(1 - entityCollisionReduction)`; both entities move, only the `ridden`/`riding` pair check refuses (bytecode-read: there is no `riddenByEntity == null` test in 1.7.10's `addVelocity` calls).
  - Friction is evaluated twice in `moveEntityWithHeading`: the second time (the one that multiplies the motion) uses the block under the **moved** position, and `collideWithNearbyEntities` runs against the moved box. A server copy that is not on the ground uses 0.91F (executed: a first tick with motionY 0 left onGround false and the friction showed 0.91).
  - The witch's aim adds `target.motionX/Z`: the server's motion of the player (pushes, knockback of the hit itself, blast push) or the mob's own `motionX/Z`.
- **Port changes** (`src/entities.js serverPlayerUpdate`, `pushServerPlayer`; `src/ai.js PlayerView.motion/onGround`; `src/player-knockback.js`, `src/explosion-simulation.js`, `src/witch-potions.js`, `src/living-simulation.js`, `src/main.js` `onGround: grounded`):
  - `ai.player.motion` is the integrated server's copy of the player's motion. Mobs push it in their own update (`push`), hits add the same `knockBack`/`addVelocity` at once (`queueKnockBack`, `queueVelocity`, the client copy still drains later), explosions add their push, and each tick `serverPlayerUpdate` runs snap, friction (block under the moved position when onGround, else 0.91F) and the push of every mob the moved box meets (the player pushed too, which the old code did not do; it only moved the mob).
  - The witch throws with `target.motion` (player) or the mob's `vx/vz` instead of 0.
  - The client's own movement is unchanged: nothing moves the real player from this motion.
- **Executed vs bytecode-read.** Executed: every number above through the replay. Bytecode-read: `mw.i` as `onUpdateEntity` (disassembly of `mw`), `sa.g(sa)`'s code, and that `EntityPlayerMP.onUpdate` has no `invokespecial` super call.

## Approximations (documented, not fixed)
- The server copy's `moveEntity` is `position + motion` with no block collision (native stops the motion against walls and the sneak edge clamp) and no water, lava, web, ladder or flying friction; the friction block is the one under the moved feet.
- The server copy's position is the client's. Natively the copy keeps its own moved position until the next position packet; a stationary client sends none, so mobs would see the drifted copy. The probe puts it back every tick, so the record does not show that drift.
- `onGround` and y reach the replay from the record; in the game the client's `grounded` is passed (`state.onGround`).
- The motion's y component is tracked only through knockback and blasts and is not decayed or used.
- Dragon pushes (`dragonPush`) and piston pushes of the player do not reach the server copy's motion; ridden mounts skip the push (`rider.player`) but a boat or cart rider is not examined.
- No record covers an explosion's push on the copy beyond the existing b45cw scenarios (the b45cw replay still compares only the blast push after an explosion).

## Verification
- `node --test src/mobpush-b46.test.js`: 20 pass.
- Neighbour files (witch, enderman, creeper, explosion, knockback, entity, village, mob, horse, legacy, fireball, zombie, living, combat, ai, player, iron, golem, away, survival, piston, cart, boat; 141 files via `ls src/*.test.js | grep -E ...`): 1,949 pass, 0 fail.
- Regenerating `EW_SET=b45cw` and `EW_SET=b45` into `EW_DUMP` gives records identical to the committed references (77 and 88).
- `npm run build`: ok. Full `npm test` not run (batch rule). No browser run.

## Follow-ups (proposed gap lines)
- The server copy of the player has no block collision, sneak edge clamp or fluid/web/ladder friction, and its position is pinned to the client's (native keeps the pushed copy until the next packet).
- Dragon, piston and cart/boat pushes on the player do not reach `ai.player.motion`.
- A creeper blast's push on the copy is added by `explosion-simulation.js`; no b46mp record explodes next to the player.
- Merge note: `verify-endermanwolf.mjs` gained a `b46mp` set, the record-count chain starts with `set==="b46mp"?19:`, the names-map line adds `||set==='b46mp'`, and `enderman-wolf-replay.js` adds `reference46`, `x46` and `d2`; the probe adds the `B46` flag and `run46`.
