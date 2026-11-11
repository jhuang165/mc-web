# Batch 42 entityorder track

## Summary
- **Entity list order.** `EntityWorld.tickMobs` walks mobs and fireballs in one insertion order (stamps from `orderStamp`, merge in `withBalls`, `Fireballs.tickOne` per ball, `reap` at the end of the pass); a ball launched in the pass is pushed on `tickOrder`. Batch 41's "all mobs, then all balls" is gone. Other non-mob entities (arrows, potions, golem snowballs, skulls, items, orbs, falling blocks, TNT, carts, boats, frames) live in lists ticked by main.js or earlier in `tickMobs` and are not merged; that needs one world list.
- **Records.** `fireballs-b42-reference.json`, 17 executed records (`FireballProbe` `scenarios42`, `unified`, ops `join`, `idle`, `health`, `snow`): list order (ball before/after a mob joins, ball killing a mob before its update, two balls with a mob between), ghast balls at zombie/skeleton/blaze/pigman/spider/silverfish and an iron golem, the ghast's target after hits by a mob, arrow source and snowball, a snowball on a blaze.
- **Fix found.** `thrownHit`: EntitySnowball.onImpact does 3 to a blaze (the port did 0); a mob thrower is the source entity. `main.js` one line passes the ball. `legacy-ai-replay.js` stubs `tickOne` (the probe never ticks balls).
- **Crackle.** `drainClientSounds` (it is in `entities.js`, not `entity-tracker.js`) adds the sound's `offset` (0.5) to the client entity's x, y, z.
- Ghast target and ghast balls on mobs already matched the port.

## Verification
- Probe: `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research FB_PREFIX=fb42- node tools/verify-fireballs.mjs` writes the record file (17 records).
- Targeted `node --test src/<file>.test.js`, one at a time: fireballs-b42 20/20, fireballs-native 28/28, fireballs-b41 11/11, legacy-ai 36/36, blaze-ghast 7/7, blaze-ghast-world 7/7, entities 21/21, village-fight-b38 32/32, b39 22/22, b41 22/22, wither-boss 19/19, entity-tracker 24/24, away-trip 1/1, away-mobs 10/10, dimension-live 23/23, entity-portal 27/27, projectiles 20/20, mooshroom-golem 9/9, silverfish 75/75, giant 7/7, slime-world 8/8, iron-golem 12/12, fortress 60/60, ring-events 6/6, ring-ticks 8/8, mob-griefing 6/6, projectile-nbt 42/42. No full `npm test`, no build, no browser. Load average 5 to 7 during the runs.
- Old order check: with balls placed after all mobs, 8 of the 9 order records diverge (the mob-first control does not).

## Follow-ups
- Merge arrows, items, orbs, falling blocks, TNT into the one list (needs a world-wide list); arrows hurting a blaze in flight not replayed against the double.
- Idle legacy wanderers (spider, pigman, blaze) differ from native on some seeds (the b41 zombie gap); a silverfish dies at tick 0 in the port on seeds 4213, 4214, 4222, 4226; an iron golem next to a blaze attacks it natively on tick 9, the port's does not.
