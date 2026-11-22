# mobrec95 (batch 95): executed pigman/giant fights, sheep and squid records

## Summary
- `tools/probes/EndermanWolfProbe.java`: set `b95mr` (B95 implies B94). `seenHeld` sets `EntityLivingBase.previousEquipment` after hold/holdn/use (the ticked EntityPlayerMP otherwise failed on its equipment packet). Sheep flags `[love, growing age, colour, sheared, eat-grass timer]`; lamb type `e`; ops `shear`, `color`.
- `tools/probes/EndermanWolfScenarios.java`: `run95` (8 pigman/giant fights, 9801-9808) and `run95b` (13 sheep 9811-9823, 10 squid 9831-9840) = 31 records.
- `tools/verify-endermanwolf.mjs`: `EW_SET=b95mr` writes four files in `public/research/` (each under 2 MB): `enderman-wolf-b95mr-{,pigman-,sheep-,squid-}reference.json`.
- `src/enderman-wolf-replay.js`: `reference95`, batch 95 in the b8x/b9x regexes, sheep flags (the grazing timer as read before the tasks), `shear`/`color` ops, dye/shear on `use`, the grass-eaten changed cell, a lamb spawn reported as `["other","wp"]`, tall grass (39) non-solid, and `probeFixedList` kept on (the probe never ticks a spawned lamb).
- `src/entities.js` (port fixes): `giantThink` syncs entityAge with the idle counter; `shear` uses the sheep's own Random; `makeBaby` picks a sheep lamb's colour with `World.rand.nextBoolean()`.
- `src/mobrec95-b95.test.js`: 37 tests.

## Evidence
- Executed: all 31 records replay with no divergence (pigman vs giant, giant vs pigmen, giant vs zombie both ways, giant vs player, pigman group vs player 600+ ticks, calm and kill; sheep idle, lamb eat, regrow, wheat, breed, lamb follow, shear, dye, hit, kill, zombie, fire, arrow; squid kill, zombie, arrow, fire, two, shallow, surface, wall, far, dry kill).
- Weakest families by executed records before this batch: sheep (no AI-task/breeding/shear/regrow records) and squid (almost none). Both now covered with AI tasks, attacks, sounds, drops and the corpse tail.
- Bytecode-read: `wp.a(wf,wf)` (dye mix, `ahb.s.nextBoolean`, true = first parent), EntityMob entityAge handling.
- Port-read: the grass block edit event.

## Fixes found by the replays
1. Giant: entityAge never advanced with the idle counter, so the despawn roll nextInt(800) came at the wrong tick (9801 tick 473, 9806).
2. Sheep shear: wool count and drop offsets used the world random; native uses the sheep's own Random (9817).
3. Sheep breed: the lamb colour used `Math.random`-style `this.random`; native draws `World.rand.nextBoolean()` when no dye recipe applies (9815: one world draw was missing).

## Verification
- `node --test --test-concurrency=2 src/mobrec95-b95.test.js`: 37 pass. With entities.js reverted to HEAD: 6 fail (9801, 9806, 9815, 9817 replays plus the shear and breed regexes), checked once.
- Regression run over the files that import or name the replay, entities.js, sheep, giants, pigmen, squid : 27 test files, 886 tests, 0 fail.
- No full `npm test`, no build (no imports changed), no browser checks.

## Probe artefacts (not port bugs)
- 9802 had a far pigman despawn in the probe and hit from a dead body: pigman moved closer.
- Sheep arrow with a non-world skeleton shooter made the sheep panic natively only: scenario is an arrow kill.
- The probe player drowns near tick 300 standing in water: squid shallow/surface are 300 ticks.

## Found wrong in the batch 94 list
- Nothing listed as wrong; the "sheep and squid have no executed records" gap is now closed for the cases above.

## Follow-ups
- Not covered: sheep shear by a player with a real shears item stack and damage, sheep jeb_ name, sheep in a pen against fences, squid ink-less death XP orb count beyond the dry-kill record.
- Other families still thin: cow, pig, chicken breeding, bat, villager trading.
- Browser-only: lamb and sheep model/wool rendering, squid swim animation, eat-grass head animation.
