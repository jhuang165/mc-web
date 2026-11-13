# Batch 57 horsesounds: horse copy living sound draws and flag starters

## Summary
- `src/horse-copy.js`: `stepHorseCopy(c, flags, live)` now draws EntityLiving.onEntityUpdate's living sound roll on the copy's own Random before the tail roll (`horseCopyLivingSound`): `nextInt(1000) < livingSoundTime++`, on a hit livingSoundTime = -400, `nextInt(10)` (wi.t), two floats (sv.bg, 1.5 for a child). `live` is `{ alive, child, type }`; a dead horse draws no roll. The sound is silent on the client (RenderGlobal.playSound is empty in 1.7.10), so only the draws and `a.sound` (last tick's record) exist.
- `src/entities.js` (3 small edits): the copy call passes `live`; the fresh hurt of a horse calls `horseHurt`; a fatal hit sets `mouthTicks = 1` (wi.aU calls cS).
- `src/horse-live.js`: `horseHurt` (wi.aT: cS opens the mouth, then `nextInt(3) == 0` rears). `src/horse-gear-live.js` `leashTick`: a lead longer than 6 stops the grass eating (wi.o(F), called by td.bL).
- `src/horse-model-b56.test.js`: the tail test passes `{ alive: false }` so only the tail roll is scripted.
- Probe and record: `tools/probes/HorseCopyProbe.java` gained `sound`, `flags` and `graze`; `tools/verify-horse-copy.mjs` writes `public/research/horse-sounds-reference.json` (horse-copy-reference.json is unchanged).

## Evidence
Executed (unchanged wi on world doubles, horse-sounds-reference.json):
- `sound`: wi.h() on a client world, logging Random, adult / donkey / foal / zombie child, 1500 ticks each. Per tick 1000, and on a hit 10, f, f, then 200; the sound is `mob.horse.[donkey.|zombie.]idle` at volume 0.8, pitch (r - r) * 0.2 + 1 (+0.5 for a child); 4 hits per horse.
- `flags` (server world): death aU (mouth only, no draw), hurt aT (mouth, 1/3 rear, eating cleared; 16 rows), idle t (mouth), angry cJ (rear + mouth, two floats except zombie/skeleton), jump w(I) (saddled and power >= 0 rears, negative or unsaddled does not; 20 rows), leash o(F) (eating stops above 6, not at 6), feed cL (two floats, mouth).
- `graze`: wi.e() on an all-grass server world with the AI tasks emptied: draws 200, 900, 300 per tick; eating starts on the 300 roll and ends when bD passes 50.
Bytecode-read (javap on wi): every caller of cS (cL, aU, aT, t, cv), cU (aT, t, cv/cJ, w(I)), o(Z) (e(), i(yz), p(true), o(F), readNBT EatingHaystack) and p(Z). `bq` is never written outside wi.h() (increment and reset), so "bq starters" do not exist; the gap's list is the cS / cU / o / p callers above. td.bL calls o(F) every tick a creature is leashed in its own world.
Recalled: nothing new.

## Verification
- `node --test src/horse-sounds-b57.test.js`: 9 pass.
- `node --test src/horse*.test.js src/entities.test.js src/entity-tracker*.test.js src/tracker-*.test.js src/leads*.test.js src/combat.test.js src/damage-fx.test.js src/fx.test.js src/enderman-wolf-b4*.test.js`: 544 pass, 0 fail.
- `npm run build`: ok. Full `npm test` not run (batch rule). No browser check.

## Follow-ups
- Gap "eating grass and bq starters not ported": eating grass was already ported in batch 56 (horseTick) and is now executed; the rest was hurt/death mouth and the leash stop, now done. Found wrong: bq has no starters.
- The copy's own hurt (status 2: nextInt(3) in wi.aT plus bg floats) and death (status 3) sound draws are not made on the copy's Random; entities.js plays those from `statusPitchRandom`, not from the copy.
- Metadata delay for flags is still not modelled. Order of the leash stop against horseTick inside a tick is not checked.
