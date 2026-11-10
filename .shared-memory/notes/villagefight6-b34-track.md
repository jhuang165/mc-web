# villagefight6 (batch 34): ChunkCache finding, unloaded chunks, walls, nether fences, cobweb, reinforcement yaw

## Summary
- Goal 1 premise did not hold (bytecode-read, then probed). `World.getEntityPathToXYZ` / `getPathEntityToEntity` build a `ChunkCache` (radius `(int)(range + 8)` / `(int)(range + 16)`), but `ayg` reads it only in
  the swimming start loop. The open/blocked test (`ayg.a` static, `func_82565_a`) calls `entity.worldObj.getBlock` (`invokevirtual ahb.a`), so the search is NOT bounded by the region: walls beyond it still count.
  I first ported a region bound (`chunkCacheView`), which made `b34-ring-sealed-d3` diverge at tick 432; tracing with a reflection dump of the native `ayg` point map (node (14,0,48) visited, (15,0,48) never
  created, although the cache reads air there) showed the real cause, and I removed the region bound again. The probe still builds the real `ahr` over real `apx`/`apz` chunks (field `chunkCache`).
- Search cap: native has no cap and the only bound is the follow-range sphere around the target. Benchmarks of the uncapped search (sealed target, `PathFinder` directly, Node, dev laptop): flat arena 769 points
  at range 16 (1.2 ms), 1220 at 20, 4988 at 40 (1.6 ms); terraced hills 731 / 1170 / 4969 (4.3 ms at range 40); targets beyond the range from the start end at once (1 point). The old cap of 6000 cut a search
  at a zombie's spawn-bonus range of about 45 (6400 points). `nodeCap` is now 30000 (a few ms per 1000 points worst case on stepped terrain, so 15-20 ms in multi-storey caves only).
- Goal 2: the probe has an unloaded-chunk model (`unloaded` record field) in its `VillagerProbe.World` double: `d(sa)` (`spawnEntityInWorld`) refuses a non-player entity in an unloaded chunk (`chunkExists`),
  `b(6)` (`checkChunksExist`) is false over them. Records: chunk-border fights and hunts (d2/d3), Hard reinforcements loaded vs unloaded for 3 seeds. Native behaviour (bytecode-read): `yq.a` picks the site with
  block/box tests only, the refused zombie still gets `onSpawnWithEgg` (world Random draws), the target, both -0.05 charges, and the search stops. The brief named `checkChunksExist`; it is `spawnEntityInWorld`'s
  `chunkExists`. Port fix: the streaming-chunk test sat inside the site search (a retry); it now follows the site choice, draws the world Random through a ghost zombie and returns (`callReinforcement`).
- Goal 3: records with cobblestone walls (renderType 32), nether fences (113), arrows into cobweb and a mob falling into cobweb (deep, shallow), each as gap / closed / hunt where it applies. All replay exactly.
  Port/replay fixes found by tracing: replay `move` honours y (web-fall), the replay world has far edges (the non-streaming edge clamp stopped the golem at x 0.6), reinforcement yaw (goal 4).
- Goal 4 (bytecode-read): `EntityLivingBase`'s constructor sets `rotationYaw = (float)(Math.random() * 3.1415927 * 2.0)` (degrees, 0 to 6.28) and `rotationYawHead` to it; other yaw fields stay 0; a reinforcement
  zombie gets no `setLocationAndAngles`. `EntityWorld.spawnNatural` now does that for kind `reinforce` (before `entitySeed`); records store it as `zombies[i][7]` and the replay applies it.
- Probe artifact fixed: a zombie spawned with equipment crashed `EntityLivingBase.onUpdate` (equipment packet through a `WorldServer` the double lacks). The probe now runs the rest of that block (`equipSync`:
  attribute modifiers of the held item, `previousEquipment`), skipping only the packet. A sword-armed reinforcement hits for 13.5 on Hard natively, as the port does.
- Files: `src/pathfinding.js` (comment, `nodeCap`), `src/entities.js` (`callReinforcement`, `spawnNatural`, `onSpawnWithEgg` ghost option), `src/village-fight-replay.js`, `src/village-fight-b34.test.js`,
  `public/research/village-fight-b34-reference.json` (23 records, about 6 MB), `tools/probes/{VillagerProbe,VillageFightProbe,MobMoveProbe}.java`, `tools/verify-village-fight.mjs`,
  `public/research/village.md`, `public/research/pathfinding.md`. Older reference files are unchanged (I did not use `VF_REWRITE_OLD`; the b32 pool records are recorded without the cache, as before).
- The probe player's `g()` stays 1.62.

## Verification
- Native: `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-village-fight.mjs` (javac of the probes against the 1.7.10 jar) writes
  `village-fight-b34-reference.json` with class hashes (adds `ahr`, `apx`, `apz`, `ayg`).
- Focused: `node --test src/village-fight*.test.js src/pathfinding.test.js src/ai.test.js src/entities.test.js src/silverfish.test.js src/projectiles.test.js` -> 209 tests, 0 failures
  (27 in `village-fight-b34.test.js`: 23 replays, loaded vs unloaded, removing blocks diverges, live yaw).
- Full `npm test` once: 4994 tests, 4994 pass, 0 fail. `npm run build`: built in 7.3 s (the usual chunk-size warning only).
- Browser: none needed (no live rendering or UI change; the live changes are the reinforcement yaw, the unloaded-site draws and the search cap).

## Follow-ups (proposed gap lines)
- Village fights, round 6: the `ChunkCache` does not bound the path search (the swimming start loop is its only reader); the probe's unloaded chunks are the double's `chunkExists` answer, not a real
  `WorldServer`/`ChunkProviderServer`; chickens of refused jockey zombies are not modelled.
- Reinforcement yaw is `Math.random`-seeded natively: the replay uses the recorded value, so the live heading is only distribution-checked (0 to 6.28, head equal).
- The port's search cap (30000) is a frame-time deviation; multi-storey cave searches near it are unmeasured against native.
- Weapon attribute modifiers for mobs whose equipment is swapped by the old `held()` probe path (b31 pickup swaps)skip the modifier natively (`held()` only syncs `previousEquipment`); b34 zombies run it.
