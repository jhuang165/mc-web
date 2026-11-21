# Batch 89 mobrec89: snow golem against a blaze, poison on mobs and the player, and a poisoned player's food stats (executed records)

## Summary
- There are 20 records in `public/research/enderman-wolf-b89mr-reference.json` (1.4 MB), and all of them replay with no divergence. Everything the b88mr harness compares is still checked every tick, plus three new things in row element 10:
  - each mob's active effects;
  - the player's health, food, saturation, exhaustion and food timer;
  - the blaze's fireballs in flight.
- Harness: `EndermanWolfProbe` gained a `b89mr` set (`B89`, which implies `B88`).
  - Small fireballs (`ze`) now update in the same spawn-order pass as the throwables. New fireballs are listed in 5[1] as `[fireball, x, y, z, motion, seed]`.
  - The `effect` op takes an amplifier.
  - `realhp h` gives the probe player `generic.maxHealth` 20 and health h, and stops the per-tick reset to 1000.
  - `food level sat [exh]` sets the `FoodStats` fields.
  - The ticked `EntityPlayerMP` already ran `FoodStats.onUpdate`; the row now shows it.
  - `tools/verify-endermanwolf.mjs` knows the set, asserts at least 20 records and lists the extra classes.
- Records:
  - `snow-blaze-8901..8903`: a snow golem pelts a blaze (3 a snowball). The blaze answers with three-ball volleys 6 ticks apart, and the balls set fire (51) beside the blocks they hit. In 8902 a fireball kills the golem at tick 131.
  - `poison-pig-8911` / `poison2-pig-8912`: Poison I deals 1 every 25 ticks and Poison II every 12. Neither takes health below 1, and the effect keeps counting.
  - `poison-zombie-8913`, `poison-pigman-8918`: undead refuse poison and regeneration; Speed stays.
  - `poison-spider-8914`: a spider refuses poison, and Regeneration I heals it every 50 ticks.
  - `poison-witch-8915`: the witch takes 0.15 a poison tick.
  - `poison-snowgolem-8916`, `poison2-golem-8917`: golems take poison.
  - `player-poison2-8921`, `player-poison4-8922`: Poison II hurts the player every 12 ticks. Poison IV is ready every 3 ticks, but the hurt window filters it to every 12.
  - `player-poison2-cave-8923`: a cave spider bites a player who has Poison II, at night.
  - `food-regen-8931`: natural regeneration gives +1 every 80 ticks at food 18 or more and costs 3 exhaustion. Exhaustion over 4 takes saturation first.
  - `food-poison-8932`: poison does not reset the regeneration timer, so both run.
  - `food-poison2-floor-8933`: at food 10 nothing regenerates, and Poison II stops at 1.
  - `food-starve-8934`: at food 0, starvation at timer 80 is refused inside the poison's hurt window.
  - `food-hunger-8935`: Hunger III adds 0.075 exhaustion a tick, then costs food.
  - `food-cave-8936`: a cave spider fight with real health 20 and saturation 0.
- Port fixes:
  - `src/mob-effects.js` `tickMobEffects`: mob poison now goes through the world's attack path (`hurt(e, 1, "magic")`) when the caller passes one.
    - That brings in the hurt window, the knockback draw `d`, the hurt sound (`f f`) and the witch's 15 % rule.
    - Before, it subtracted 1 directly: no draws and no sound, and the witch took 1.
    - Callers without `hurt` (the old unit tests) keep the direct step.
  - `src/snow-golem.js` `SNOW_GOLEM_TARGETS` is now every IMob type, the same list as `iron-golem.js` `IMOB_TYPES`. Before, it held 9 kinds and left out the blaze, ghast, magma cube, pigman and others. `src/mooshroom-golem-live.js` `NearestMonster` now skips the ghast as well as the creeper (`EntityLiving.canAttackClass`).
  - `src/blaze-ghast-mobs.js` `blazeUpdate`: a dead mob target is no longer dropped before the hover read.
    - `xx.e` reads `entityToAttack` without an alive test, and `td.bq` clears it afterwards. So the blaze rose toward the dying golem at 8902 tick 132.
    - The player branch is unchanged.
  - `src/survival.js` `exhaust`: the amount is rounded to a float (`FoodStats.addExhaustion(float)`).
    - A hit's 0.3 is 0.3F. The double 0.3 summed to a value one ulp off once other exhaustion was present (8923 tick 34).
  - `src/enderman-wolf-replay.js` (b89mr only):
    - `reference89`;
    - the fireball seeds from 5[1], and `ew.ignite` records fire cells;
    - `foodTick` after the effects;
    - `maxHealth` is 1000 until `realhp` sets 20;
    - the `food` and `realhp` ops and the effect amplifier;
    - `serverCopyMoved` calls `chargeServerCopy`, as `main.js` does, so the copy's knockback walk costs exhaustion;
    - the blaze's `mob.ghast.fireball` aux event (1009, client pitch) is not compared as a sound;
    - `firstDivergence` checks "mob effects", "player food" and "fireballs".
- Coverage that already existed: spiders climbing walls (b39 rings, pillars and plateau), and scripted snowballs hitting a blaze (`fireballs-reference` fb41/fb42).

## Evidence
- Executed, on the unchanged 1.7.10 classes: `EW_SET=b89mr node tools/verify-endermanwolf.mjs` gives the 20 records (`records 20`).
- Bytecode-read (`javap -c -p` on the 1.7.10 jar):
  - `xx.e` (EntityBlaze.onLivingUpdate): the hover reads `bT()` with no alive check, adds `(0.3 - w) * 0.3` when the target's `t + g()` is above `t + g() + bp`, then applies the 0.6 damping when `w < 0`.
  - `sa.g()` returns 0 and `sv.g()` returns `N * 0.85F`.
  - `sw.a(Class)`: false for `xz` (creeper) and `yd` (ghast).
  - `rv.a(sv, I)`: `attackEntityFrom(magic, 1)` when health > 1.
  - `zr` (FoodStats): `addExhaustion(F)`, and the onUpdate rules.
- Port-read: `src/server-copy-stat.js` `chargeServerCopy` and its `main.js` wiring; `src/movement-stat.js`, whose charges are already float.

## Verification
- `node --test --test-timeout=600000 src/mobrec89-b89.test.js`: 36 pass, 0 fail.
  - 20 replays.
  - Facts: the golem targets the blaze at tick 0 and the target set equals IMob; 3 per snowball; volleys; fire cells; the golem's death and the blaze rising; poison timing and the floor at 1; undead and spider refusal; regeneration on the spider; the witch's 0.15 and the magic `hurt` hook; Poison II and IV on the player; 0.3F exhaustion and the order of the f32 sums; regeneration every 80; regeneration with poison; food under 18; starvation and the hurt window; Hunger III.
  - Negative checks: `firstDivergence` catches a changed food row and a changed effect row.
- Targeted neighbours, in one run of 108 files at concurrency 3: 1969 pass, 0 fail. The run covered:
  - every test that imports or names the edited files (`enderman-wolf-replay`, `mob-effects`, `snow-golem`, `blaze-ghast-mobs`, `mooshroom-golem`, `fireballs-replay`, `legacy-ai-replay`, `server-copy-stat`);
  - every test that names `exhaust` or `blaze`;
  - `mobrec87`, `mobrec88`, `fire-times-b53` and `mob-resist-b50`;
  - the source scanners `skins73-b73`, `module-names`, `sounds73-b73` and `skintex75-b75`.
- After the ghast skip in `mooshroom-golem-live.js`: `mobrec89-b89`, `mooshroom-golem`, `mpgolems-b66`, `mobrec88-b88`, `snow-cloud-particles-b70` and the other `mooshroom-golem-live` importers gave 105 pass, 0 fail.
- `npm run build`: ok. No full `npm test` and no browser checks.
- Old tests: none encoded the fixed gaps, and no old test was edited. Of the 273 tests that import `survival.js`, only those naming `exhaust` were run.

## Follow-ups
- Not recorded: a spider jockey climbing a wall. It needs the VillageFightProbe b39 harness with a jockey. The b37-b39 jockeys are on flat ground and the b39 wall climbs have no rider.
- Not checked against native: the blaze hover still clears a dead or creative player target early; native keeps it until `td.bq`.
- `levelEvent` in `blaze-ghast-mobs.js` draws the aux event's pitch from the world random. Natively the pitch is drawn on the client. Not tested here: no record reads the world random after a shot.
- Browser-only: the poison hearts and green tint; the fireball look, its trail and the fire block; the blaze's smoke and rods; the snow golem's death puff and melting; the hunger bar shake and the green Hunger bar.
