# mobrec99 (batch 99) track note

Worktree `wt99-mobrec`, branch `batch99-mobrec99`, from 8df1376b7 (0.127.0). Nothing here claims full parity.

## Summary (file by file)
- `tools/probes/VillageFightProbe.java`: `b99-` records (`run99`, specs `seed:doors:villagers:ticks`, `B99_SPECS` env for seed search) use the b98 layout (`b98up`); each villager state ends with `[rotationYaw, renderYawOffset, rotationYawHead, rotationPitch]`.
- `tools/verify-villagers99.mjs` (new): writes `public/research/village-fight-b99-birth{1..4}-reference.json` (8 records, 0.5 to 1.0 MB each).
- `src/village-fight-replay.js`: `fightReference99`, yaw fields in `villagerRow` for b99.
- `src/ai.js` (fix): `WatchClosest` for villager/living targets keeps the LATER of two equal distances (`d <= bd`), as `World.findNearestEntityWithinAABB` does. A child standing on its parent made the adult look at the parent (pitch 0) instead of the child (pitch about 34 degrees).
- `src/mobrec99-b99.test.js`: 11 tests.

## Evidence
- Executed: 8 records (births at ticks 611 to 1445 with 9, 12 doors, two and three villagers; a 5-door record with no birth). Seed search: births in about 1 of 60 pair runs (doors 9 or more; fewer doors never, as `villagers < int(doors*0.35)`), same seeds and ticks for 9, 12, 15 doors. All 8 replay with no divergence after the fix; 2 diverged before it (10130, 10424).
- Bytecode-read: `ahb.a(Class, azt, sa)`: `dcmpl; ifle` keeps the later entity on a tie. `up.g` calls `setLocationAndAngles(.., 0, 0)`, which does not touch the head; the constructor head (random 0 to 6.28 degrees) is snapped to the body by the look helper in the birth tick (10 degree step), so the child's head yaw is 0 in every record and the port's default is equivalent (Executed).
- Port-read: village-ai.js mate/follow/golem lookups already used `<=`; the animal Mate/FollowParent loops are other native code, untouched.

## Verification
- `node --test --test-concurrency=2 src/mobrec99-b99.test.js`: 11 pass. Without the `ai.js` fix: 3 fail.
- 31 test files naming village-fight-replay, WatchClosest or ai.js: 516 pass, 0 fail. No full `npm test`, no build (no imports changed), no browser.

## Found wrong in the batch 98 list
- "The child's head yaw not compared": it is compared now and matches; the native head is erased in the birth tick.

## Follow-ups (open)
- Not started: iron golem rose offering, golem village spawn, witch potions, bat in water (probe splash artefact unresolved). Villager sounds and heart particles still not compared (the probe world has no sound/particle sink for villagers).
- Browser-only: none identified.
