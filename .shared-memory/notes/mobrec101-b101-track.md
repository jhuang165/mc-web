# mobrec101 (batch 101): witch knockback records, iron golem spawn gating

Branch batch101-mobrec101 from main 776d5f8a4 (0.129.0). Probe output dir: tools/research/mobrec101-probe (main checkout, ignored). No shipped game code changed: both items were already native; the work is records and replay.

## Summary (file by file)
- `tools/probes/EndermanWolfProbe.java`: each record carries `mathRandom` ([tick, value, caller]: every `java.lang.Math.random()` of EntityLivingBase outside a constructor, through the SeedMath hook the probe already installed) when there was a call.
- `src/enderman-wolf-replay.js` (replay harness only): a record with `mathRandom` feeds `ew.mathRandom` (the hook `attackEntityFrom` already uses, as village-fight-replay.js) and the result returns `mathCalls`. Values are taken by tick, not as a queue (see Evidence).
- `public/research/enderman-wolf-b101mr-witchknock-reference.json` (298 KB): the two b100 records `b97mr-witch100-throw-near-10072/10073`, restored.
- `tools/probes/VillageGate101Probe.java`, `tools/verify-village101.mjs` (new): 20 golem gate records into `public/research/village-gate-b101-reference.json` (30 KB).
- `src/mobrec101-b101.test.js`: 25 tests.

## Evidence
- Bytecode-read (`sv.a(ro, float)`, offsets 360-436): the knockback direction nudge is `java/lang/Math.random()` (four calls per pass of `while (dx*dx+dz*dz < 1.0E-4)`), and the attacker-less branch is `(int)(Math.random() * 2) * 180`. It is the JVM's unseeded Math.random, NOT the entity's or world's Random, so the scope premise "natively it draws from the entity's / world's Random" is wrong. Routing it through a seeded Random would be non-native; the port's `this.mathRandom ?? Math.random` is already the native source.
- Executed: both records replay with no divergence once the recorded values are fed (the nudge ticks, 304 and 362 in one record and 244 and 302 in the other, draw the same number of values as native). The port draws 8 and 10 fewer values than native in total: the probe's player takes its own poison damage through the same method (an attacker-less hit draws one unused value); the port's survival does not draw it. The value is unused, so this is harmless, but it is why the replay picks values by tick.
- Executed: 20 golem gate records (VillageCollection.tick on unchanged classes, the world Random logged). Facts: 20 doors never spawn (even with 30 villagers); 9 villagers never; 19 villagers with one golem counted never; 20 villagers with one golem spawn (a second golem at tick 8126 in the long run); 20 villagers with two golems never; a villager 10 up, or exactly 4.0 up (box top y+4, strict compare), is not counted; a villager 3.9375 up is; one added late or a 21st door added late moves the first roll (spawn tick 2800 / 3041 instead of 2285); a door removed after tick 500 stops rolls; a slab one block up makes every py 0 box fail and the search finds py 2 on the slab (tick 428, the first roll, y 2); a slab at y 3 fails all 10 tries (rolls at 428, 2285, 2427 and no golem); a stone wall on the west side moves the spawn to (54, 0, 56) at the third roll (tick 2427). The spawned golem is counted at the next recount (10 villagers: exactly one).
- Replayed through the real `createVillageHost` (village-host.js: countEntities AABB, hasSolidTop, isNormalCube, rand) and `VillageCollection` on a fake EntityWorld that holds the probe's cells and entities: spawns, nextInt(7000)==0 ticks, every nextInt(16)/(6) of the box search and the 500-tick village digests all equal. No divergence, no fix.
- Port-read: `EntityWorld.spawnIronGolem` and the real world's blocks and chunk loading were not part of the replay (fake world), only the host code.

## Verification
- `node --test --test-concurrency=2 src/mobrec101-b101.test.js`: 25 pass.
- Fails without the fix: with `src/enderman-wolf-replay.js` reverted to HEAD, the two witch records fail (the third test shows the replay needs the fed values). The golem gate tests have no fix to revert (already native).
- Targeted: 26 files (every test importing enderman-wolf-replay.js, village.test.js, mobrec101): 933 tests, 933 pass. No full `npm test`, no build (no imports of shipped files changed), no browser.

## Found wrong in the batch 100 list
- "The witch's knockback ... uses unseeded Math.random in the port" is true of native too (bytecode above); there is no port gap. The records were only undroppable because the probe did not record the Math.random values.
- "Golem spawn gating has no record": the three golemSpawn records covered only the open case; now 20 records cover the closed ones.

## Follow-ups
- Scope item 3 not done as new work: snow golem trail/shoot (13 trail, shoot, flight records in mooshroom-golem-reference.json) and zombie villager cure (VillageFightProbe zombie records) already have executed records. A mob behaviour with no record was not identified in the time available.
- Still open: whether the shipped loop orders the potion hit and the hurt countdown as the probe (not checked); the golem gate on the real EntityWorld (blocks, chunk loading) rather than the fake world; the player's attacker-less poison hit draws an unused Math.random natively.
- Browser-only: none.
