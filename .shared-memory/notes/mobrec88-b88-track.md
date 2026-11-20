# Batch 88 mobrec88: cave spider poison on a ticked player, iron and snow golem fights (creepers left alone, snowballs in flight) (executed records)

## Summary
- 20 records in `public/research/enderman-wolf-b88mr-reference.json` (1.5 MB), all replaying with no divergence. Every field is compared on every tick:
  - mob position, health, target, revenge, flags, every Entity.rand draw and motion;
  - sounds, player damage and revenge;
  - spawned items, orbs and snowballs;
  - the server copy's motion and position;
  - the snowballs in flight and the player's effects.
- Harness: `EndermanWolfProbe` gained a `b88mr` set (`B88`).
  - It runs on the b47 serverplayer harness, with a ticked EntityPlayerMP whose `onUpdateEntity` runs its potion effects.
  - The two counters of `EntityPlayerMP.onUpdate` (`mw.h`) now count down after the mobs: `--field_147101_bU`, and `--hurtResistantTime` when above 0. Without them, the earlier ticked-player harness kept the window of the first hit forever and refused every later poison tick.
  - Every `EntityThrowable` (`zk`) updates after the mobs, in spawn order.
  - A spider's or cave spider's row target is `entityToAttack` (`td.bT`).
  - New type `J` is a cave spider (`xy`).
  - Row element 9 is `[[throwable k, x, y, z, motion, dead], [player effects [id, duration, amplifier]]]`.
  - Row element 5[1] lists a new snowball as `[snowball, x, y, z, motion, seed]`.
- Cave spiders (task 1): `b88mr-cave-normal-8801..8803`, `-hard-8811..8813`, `-easy-8821` and `-creative-8822`.
  - The spider attacks at night (bright 0) from 4 blocks away. At tick 60 the player sets the spider's health to 1, and kills it with a blow at tick 61. Items drop at once and orbs follow at tick 80.
  - Poison is 140 ticks on Normal and 300 on Hard; the first row shows 139 and 299. Easy gives no poison.
  - Bites deal 2 on Easy and Normal and 3 on Hard.
  - Poison deals 1 when the duration is a multiple of 25. The hurt window gates it:
    - On Normal, a bite 5 ticks after a poison tick deals only the difference (2 - 1).
    - On Hard, the poison tick due 25 ticks after a bite falls inside the next bite's window and is refused.
  - The effect runs out exactly its duration after the last bite.
  - A creative player takes no poison damage, and the effect still counts down.
- Iron golem (task 4): `b88mr-golem-creeper-8831..8833`, `-golem-spider-8841/8842` and `-golem-cave-8843/8844`.
  - A blow is `7 + nextInt(15)` (the `i15` draw), with `mob.irongolem.throw` at 1.0/1.0 and `motionY += 0.4`. For example, 8841 deals 10, then the 6 left.
  - The spider's `entityToAttack` turns to the golem on the hit.
  - Neither golem ever targets a creeper, not even after the creeper's own hit (`hit 0 1 1` at tick 10). The golem's revenge target is the creeper for exactly 100 ticks; there is no fight and no explosion.
- Snow golem (task 3): `b88mr-snow-zombie-8851..8853` and `-snow-creeper-8861/8862`.
  - A snowball every 20 ticks (`random.bow`). Each hit deals the zombie 0, knocks it back east, and makes the golem the zombie's revenge target. The zombie's HurtByTarget then targets the golem.
  - The snow golem never targets a creeper.
- Port fixes:
  - `src/mooshroom-golem-live.js` `GolemBalls.shoot`:
    - The snowball's random now first draws the three gaussians of the `EntityThrowable(world, thrower)` constructor's own aim, as `witch-potions.js` already does. Before, every ball's heading diverged at the throw tick.
    - The snow golem's `NearestMonster` now skips creepers (`EntityLiving.canAttackClass`). Before, the port's golem walked to the creeper at tick 0.
  - `src/snow-golem.js` `aimFor`: the lift is `f(f(sqrt) * 0.2F)` (`MathHelper.sqrt_double` returns a float). Before, it was one rounding of the double product, an ulp off in the ball's motion.
  - `src/enderman-wolf-replay.js` (b88mr only):
    - J is `cave_spider`, and `reference88` is exported.
    - b88mr joins the b47 rules.
    - The snowball walk (`entityWalkers` kinds `golemBall` and `potion`) runs, with each ball's random seeded from the record.
    - After `ew.tick`, the player's protection, `hurtTicks` and `hurtTime` count down, then `survival.effects.tick`.
    - A spider's target is `silverfishState(e).target`.
    - `firstDivergence` compares row element 9 and the b47 copy motion and position. Snowball spawns compare without their seed.
- Not re-recorded because they are already covered:
  - spider jockeys (`b37-spider-jockey-*`, `b38-*`, `b39-spider-jockey-killed-*` in the village-fight sets);
  - slime splits from a player kill (`la-split-s4-3930`, `-m4-3931` and `-s2-3932` in `legacy-ai-reference.json`, and `slime-reference.json`).

## Evidence
- Executed, on the unchanged 1.7.10 classes: `MC_RESEARCH=<private dir with the jar and libs-1.7.10> EW_SET=b88mr node tools/verify-endermanwolf.mjs` gives the 20 records. The verify script asserts at least 20.
- Bytecode-read (javap -c -p on the 1.7.10 jar):
  - `xy.n(sa)`: poison (`rv.u`) for 7 s on `rd.c` (Normal) and 15 s on `rd.d` (Hard), times 20.
  - `rv.a(II)`: poison is ready when `duration % (25 >> amp) == 0`.
  - `rv.a(sv,I)`: `attackEntityFrom(ro.k magic, 1)` when health > 1.
  - `mw.h()` decrements `bU` and `ad`; `mw.i()` starts with `yz.h()`.
  - `wt.n(sa)`: `7 + Z.nextInt(15)`, `w += 0.4` on a hit, then `mob.irongolem.throw`.
  - `zj.a(azu)`: 3 damage to `xx` (blaze), 0 otherwise.
  - `sw.a(Class)`: false for `xz` (creeper) and `yd` (ghast).
  - `zk.<init>(ahb, sv)`: calls `c(DDDFF)` with inaccuracy 1.
  - `wr.a(sv, F)`: `qh.a(D)F * 0.2F`, heading `c(.., 1.6F, 12.0F)`, sound pitch from `aI()`.
- Port-read: the existing survival hurt window (`hurtTicks` 10 and the difference rule), `status-effects.js` poison, `iron-golem.js` `golemCanAttack`, and the replay plumbing.
- Probe artifacts (from the probe, not game rules):
  - Of `mw.h`, only its two counters run. The container and chunk packets are not modelled.
  - The player's health is reset to 1000 after every tick, so it never dies and poison's health > 1 test always passes.
  - Hunger and regeneration are not compared: the replay skips the rest of `Survival.tick`.

## Verification
- `node --test --test-timeout=600000 src/mobrec88-b88.test.js`: 31 pass, 0 fail.
  - 20 replays, plus checks on the poison lengths, the bite damage per difficulty, the poison timing through the hurt window, the creative player, the spider's target and drops, golems ignoring creepers, the golem blow range and sound, the snowball knockback and revenge, and the six-gaussian snowball random with the float lift.
  - Negative checks: the Hard records diverge without the difficulty op, the creative record diverges without the creative toggle, and a snowball record diverges with another ball seed.
- Targeted neighbours, in one run of 34 files at concurrency 2: 923 pass, 0 fail.
  - The 30 files that import or name the edited files or `snow_golem`: `creeperwitch-b45`, `corpse83-b83`, `enderman-wolf-b42/43/44`, `eye-height`, `flyturn-b51`, `fireballs-b42`, `horse-spawn-b45`, `horse-ride-b47`, `leash`, `legacy-body-b50`, `mob-effects-b54/55`, `mob-steps`, `mooshroom-golem`, `mobcopies2-b61`, `mobrec87-b87`, `mobsounds-b60`, `mob-nbt`, `mobpush-b46`, `mpgolems-b66`, `mpvehiclehits-b67`, `pistonpush-b48`, `piston-order-b49`, `snow-cloud-particles-b70`, `serverplayer-b47`, `spcopy86-b86`, `spawner-animals` and `spexec79-b79`.
  - The 4 source scanners: `skins73-b73`, `module-names`, `sounds73-b73` and `skintex75-b75`.
- `npm run build`: ok. No full `npm test` and no browser checks.
- Old tests: none encoded the fixed gaps (the b44 snow golem records never fly their balls). No old test was edited.

## Follow-ups
- Not recorded:
  - a snow golem against a blaze (3 damage; the blaze's fireballs would need the fireball walk);
  - poison on a mob (a cave spider biting the golem: the golem killed it first in 8843/8844);
  - a spider climbing a wall in a jockey fight (the b37-b39 jockeys are on flat ground);
  - poison with an amplifier;
  - a ticked player's hunger and regeneration under poison.
- Browser-only: the snowball flight and poof particles, the golem's arm swing on a throw, the poison hearts and screen tint, and the cave spider's look.
