# Batch 87 mobrec87: a witch fight with flying potions, zombie pigmen (Easy, a group, a golem kill), a squid pushing a ridden boat, villagers killed by a baby zombie and a zombie villager (executed records)

## Summary
- Witch fight against the player (task 1): 4 records in `public/research/enderman-wolf-b87wf-reference.json` (212 KB), all replaying with no divergence.
  - The b45cw creeperwitch harness of `EndermanWolfProbe` gained a `b87wf` set (`B87W`). The EntityPotion entities a witch throws now update every tick, after the mobs, in spawn order (b45 froze them at the launch).
  - Each row has a seventh element: the potions that updated (`[k, x, y, z, motion, dead]`) and the player's active effects (`[id, duration, amplifier]`).
  - Records `b87wf-witch-fight-8801` and `-near-8803` throw every 60 ticks.
    - The choices: poison 32660, then harming 32732 and slowness 32698 for 8801; poison, poison, then harming for 8803.
    - The potions fly, break, and apply poison and slowness. Harming does 6 to the player at tick 130.
  - Records `b87wf-witch-melee-8811` and `-8812`: the player hits the witch with an iron sword at ticks 30 and 90, sets its health to 1 at 140, and kills it at 141.
    - The hurt witch drinks healing 16341 (ticks 63 and 141 for 8811, tick 102 for 8812).
    - Drops: two sticks and a spider eye at tick 141 for 8811, none for 8812. Orbs follow at tick 160.
  - Port change in `src/enderman-wolf-replay.js` (b87wf only):
    - The live potion walk (`entity-simulation.js` `entityWalkers`, kind `potion` only) now runs.
    - Every potion the probe saw is reported in the spawned list after its first update.
    - The world event 2002 glass sound is skipped (it is the client's).
    - `firstDivergence` compares the potions and the player's effects.
    - Added a test option, `replayEndermanWolf(r, { frozenPotions: true })`.
- Zombie pigmen (task 2) and villager kills (task 4): 19 `b87-*` records in `public/research/village-fight-b87-reference.json` (258 KB). All 19 replay with no divergence and the same hits and loot kinds.
  - Easy and Normal: `b87-pigman-easy-8701`/`-8702` and `-normal-8703`. The pigman strikes for 3.5 on Easy and 5 on Normal.
  - Group (`PPP`): `b87-pigman-group-8710`/`-8711` and `-group-easy-8712`.
    - The player's hit angers the hit pigman and its neighbour.
    - Pigman 2, 38 blocks away at x 98.5, stays calm until its own hit (tick 70; never in the Easy record).
  - Golem: `b87-pigman-golem-8720..8722`. An iron golem kills the pigman (ticks 31, 18, 33). It drops items only, with no orbs (not a player kill).
  - Kills: `b87-babykill-d{1,2,3}-*` and `b87-zvkill-d{1,2,3}-*`, in the b86 pen.
    - Easy never converts and Hard always does.
    - On Normal, seed 8731 does not convert and seeds 8732 and 8733 do, for both killers.
  - Port fix in `src/nether-melee-live.js` (`pigmanHurt`): the anger now also reaches a dying pigman (health 0, not yet removed), via `!o.removedNow` in place of `o.health > 0`.
    - Before the fix, the group records diverged at tick 60 (`draws ["f","f"]` against `[]`).
    - Natively, the dead pigman's angry sound plays 2 ticks after the next pigman's hit.
  - The probe gained a `baby` script op (`yq.i(true)`). The replay op in `src/village-fight-replay.js` sets `growingAge -1` and resizes the box (the `anchoredShrunkBox` half size). `fightReference87` is exported.
- Squid pushing a ridden boat (task 3): 4 rider records in `public/research/squid-push-b87-reference.json` (121 KB), replaying with 0 mismatches (squid, boat and rider, every tick).
  - The setup is the b86 pool plus an `EntityListProbe.Cow` (AI off, Random(7)) mounted on the boat: `rider-sb`, `rider-bs`, `rider-drift`, `rider-ram`.
  - No port change was needed. The boat walker, `mountMobOnVehicle` and the rider update after its mount already matched.
- Correction to the b86 note: the `b86-pigman-d2-*` records ran on Hard. The probe's difficulty was still 3 from the conversion loop, and the records' own `difficulty` field is 3, so the replays were right; only the labels were wrong. The 7.5 damage is the Hard value, not Normal. I fixed the comment in `src/mobrec86-b86.test.js`; the records were not regenerated.

## Evidence
- Executed, on the unchanged 1.7.10 classes:
  - `EW_SET=b87wf node tools/verify-endermanwolf.mjs`: the 4 witch records.
  - `VF_PREFIX=b87- node tools/verify-village-fight.mjs`: the 19 fight records, with the `loot` field.
  - `SQ_B87` in `node tools/verify-squid-push.mjs`: the 4 rider records. The b85 and b86 squid files regenerate unchanged.
- Bytecode-read (javap -c -p on the 1.7.10 jar):
  - `yh.a(ro,F)` (EntityPigZombie.attackEntityFrom): with a player attacker it angers every `yh` from `getEntitiesWithinAABBExcludingEntity(boundingBox.expand(32,32,32))`, then itself, then calls super.
  - `apx.a` (Chunk.getEntitiesWithinAABBForEntity) has no isDead or health test, so a dying pigman is angered too.
  - `zk.h()` (EntityThrowable.onUpdate) moves a potion every tick.
  - `yq.i(boolean)` (setChild) gives the baby size.
- Port-read:
  - the witch's potion choice and drink chance as the port has them (`witch-potions.js`);
  - item ids 280 (stick) and 375 (spider eye);
  - `mountMobOnVehicle`/`seatRiders` order;
  - the replay plumbing.
- Probe artifacts (from the probe, not game rules):
  - The probe player is never ticked, so its effects never run out, and its hurt timer stays up after the harming hit (later harming splashes do nothing).
  - Its attack never takes the sword modifier, so melee does 1 damage.
  - The rider cow has no AI (EntityListProbe.Cow), so only its riding motion is covered.

## Verification
- `node --test --test-timeout=600000 src/mobrec87-b87.test.js`: 37 pass, 0 fail.
  - 4 witch replays, plus checks on the throws and effects, the harming damage, the drinks and the drops. Negative check: frozen potions diverge.
  - 19 fight replays with hits and loot kinds, and the pigman checks:
    - Easy 3.5 against Normal 5;
    - the 32-block anger, with the far pigman calm;
    - the dead pigman's angry sound after the next hit;
    - the golem kill with no orbs.
  - The conversion checks per difficulty. Negative checks: without the `baby` op the baby records diverge, and the converting Hard records diverge on Easy.
  - 4 squid-rider replays. Negative check: an unseated cow diverges.
- Targeted neighbours, in one run of 38 files: 999 pass, 0 fail. The files are `convert85-b85`, `creeperwitch-b45`, `enderman-wolf-b42/43/44`, `entity-list`, `flyturn-b51`, `horse-ride-b47`, `horse-spawn-b45`, `legacy-body-b50`, `magma-pigman*`, `mobpush-b46`, `mobrec86-b86`, `mobrec87-b87`, `order74-b74`, `pathfinding`, `pigman-jockey`, `piston-order-b49`, `pistonpush-b48`, `riders72-b72`, `serverplayer-b47`, `skins73-b73`, `spcopy86-b86`, `squid-push-b85`, `vehicle-riders`, `village-fight*` and `witch`.
- `npm run build`: ok. No full `npm test` and no browser checks.
- Old tests: none encoded the dying-pigman gap. The only old-test edit is the comment fix in `mobrec86-b86.test.js`.

## Follow-ups
- Not recorded:
  - a ticked player in the witch fight (effects running out, the sword modifier);
  - weakness throws (within 3 blocks, chance 0.25);
  - a rider with AI;
  - pigmen angered by a non-player;
  - a pigman group across chunk borders.
- Browser-only:
  - the potion's flight and break visuals, and the glass break sound (a client-only world event 2002 whose pitch takes the client random);
  - the witch's drinking animation;
  - pigman anger in play;
  - how a cow riding a squid-pushed boat looks;
  - the baby zombie's size on screen.
