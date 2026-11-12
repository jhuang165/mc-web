# horses2 (batch 47) track note

Branch `batch47-horses2` (from 3250e20f5, release 0.75.0). Evidence labels: executed = unchanged 1.7.10 classes run by EndermanWolfProbe (set `b47h`); bytecode-read = javap only.

## Summary
- New set `b47h`: `public/research/enderman-wolf-b47h-reference.json`, 62 records (executed). Replay test `src/horse-ride-b47.test.js` (63 tests). Probe additions: horse types 3/4 (zombie, skeleton, wild and tame), ops `mount`, `temper`, `age`; the rider is seated by wi.ac() after the horse's update; ArrayList fields of `ahb` filled for the dismount; `ServerPlayerProbe.Net` no-op position packet.
- EntityAIRunAroundLikeCrazy (executed): an untamed horse with a rider runs to a random spot (5, 4) at 1.2 (task priority 1, mutex 1, beside Panic); each task tick draws `nextInt(50)`; on 0 a player rider rolls `nextInt(100) < temper` (tame, status 7) else temper + 5 (cap 100), the rider is dismounted and the horse rears with the angry sound (status 6). Port: `ai.js` RunAround, `horse-live.js` horseRunAround; the old taming blocks of horseTick are gone. An unsaddled rider no longer uses the ride think (only a saddled one does).
- Server draws for statuses 6 and 7: none (the particles are the client's) (executed).
- Dismount (executed): the thrown player keeps the seat's y (record pitch of the horse's look at it), x and z become the horse's; the horse's push applies the same tick.
- Gallop step (executed): a type 0 horse's gallop draws `nextInt(10)`, on 0 plays `mob.horse.breathe` at 0.6 x volume.
- Sound names (executed): feeding plays `eating` (not `random.eat`; the 1.7.10 audio manifest has no `eating` event, so it is silent, as in the original), hurt is `mob.horse.hit`, the angry volume is the float 0.800000011920929.
- Rear from the talk sound (wi.t, bytecode-read and executed): `nextInt(10) == 0 && !isMovementBlocked()`; a horse already rearing keeps its counter.
- `sa.ae()` (executed): the mounted offset is `(double) height * 0.75`, no float rounding (was rounded to float; showed as 1-ulp head pitch).
- Foal growth beside walls (executed): the nudge `moveEntity(oldWidth - width, 0, oldWidth - width)` is stopped flush by blocks (x then z); `resizeBox` takes the world. Records: flush x, flush z, a gap, tame foal, corner.
- Skeleton and zombie horse spawning (bytecode-read): `onSpawnWithEgg` (wi.a(sy)) only rolls horse or donkey (type and colour) and the foal roll; types 3 and 4 never come from the spawn roll, only from NBT, `/summon` or `s(I)`. The replay holds spawned type 3 and 4 horses fixed, so no spawn-roll record for them exists.
- Chest under a sitting ocelot (bytecode-read, not executed): BlockChest.o (ajx.o) searches class EntityOcelot (wn) in the box (x, y+1, z)-(x+1, y+2, z+1) and tests `isSitting` (wn.ca); the port's `sitsOnChest` (ocelot.js) uses the same box. No record: the probe world has no tile entity or block interaction.
- Piston push of a mob: not executed and not re-read this batch; needs TileEntityPiston ticking in the probe world.

## Verification
- `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research EW_SET=b47h node tools/verify-endermanwolf.mjs` (the run used a private copy of that directory with the jar symlinked): records 62.
- Regenerated with the same command for EW_SET=b44 (54), b45 (88), b45cw (77), b46mp (19), b43 (17), and the default b42 set (59): the committed reference files are byte-identical (git shows no change).
- `node --test src/horse*.test.js src/enderman-wolf-b4*.test.js src/ocelot.test.js src/piston*.test.js src/pistons.test.js src/chest*.test.js src/mob-steps.test.js src/mobpush-b46.test.js src/leads2.test.js src/leads3.test.js src/entities.test.js src/ai.test.js src/mob-riding.test.js src/ring-pistons.test.js`: 695 tests, 695 pass after two test edits (`eating` name, float angry volume in `src/horse-world.test.js`).
- `node --test src/horse-ride-b47.test.js`: 63 pass. `npm run build`: ok. No full `npm test` was run.

## Follow-ups (proposed gap lines)
- Horses: a piston pushing a mob has no executed record (needs TileEntityPiston in the probe world).
- Horses: a chest opened under a sitting cat is bytecode-read only (BlockChest.o); an executed record needs BlockChest.a with the probe world's tile entities.
- Horses: skeleton and zombie horses have no natural spawn or spawn-roll record (1.7.10 onSpawnWithEgg never makes types 3 or 4); the trap-horse rule belongs to later versions.
- The reference's `method` text for b47h falls through to the generic "Batch 42" text in verify-endermanwolf.mjs (left alone to avoid a second conflict spot with the b47sp set).
- `eating` has no sound in the manifest: check against the 1.7.10 sounds.json if a sound should play.
