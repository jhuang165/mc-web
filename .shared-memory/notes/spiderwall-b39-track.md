# spiderwall b39 track

## Summary
- Branch `batch39-spiderwall`. New file `public/research/village-fight-b39-reference.json` (22 native records) with `src/village-fight-b39.test.js`.
- Goal 1 (climbing): 13 ring, roofed, pillar and plateau records for spiders and cave spiders replay exactly. Fixes: `isJumping` persists (`legacy-creature.js`), no-attacker damage draws one `Math.random` (`entities.js`).
- Goal 2 (kills): 7 kill records (player, golem, jockeys) replay exactly with the spider draws compared whole. Fix: rider freed in the same tick the mount's death reaches 20. The b37 draw limit now applies only to its 2 jockey records; the other 17 compare whole. The 2 jockey records still differ by one trailing draw on the death tick when compared whole (not investigated).
- Goal 3 (creative): not done. The probe player extends `EntityPlayer`; the `td.bq` check needs `EntityPlayerMP` plus `ItemInWorldManager.isCreative()` (bytecode-read). Draft records with only `disableDamage` kept the hunt going, so they were dropped. The `creative` script op and the probe op remain.
- Goal 4 (night jockeys): 2 records replay exactly. New `tools/probes/SeedMath.java` and a constant-pool patch of `sv.class` log every `Math.random()` call; the replay feeds the values to `Entity.knockBack` (1148 calls in one case).
- Probe changes: `VillagerProbe.World.realPlayers` uses the real closest-vulnerable-player search over `playerEntities`.

## Verification
Focused runs, one at a time (load average 5.69 at start): village-fight-b39 22/22, b38 32, b37 19, b36 24, b35 9, b34 27, b33 33, b32 6, b31 5, village-fight 4, cave-spider 8, combat 8, giant 6, mob-riding 12, pigman-jockey 5, silverfish 75, spider 11, entities 21; all pass. The full suite and build were left to the lead. No browser check (nothing visible changed). The reference was generated with `MC_RESEARCH=... VF_PREFIX=b39- node tools/verify-village-fight.mjs`, then the 4 creative records were removed from the JSON and the probe; the probe was not re-run afterward.

## Follow-ups (proposed gap lines)
- Spider/cave spider: record Creative target clearing with a real `EntityPlayerMP` probe player (stub `MinecraftServer`, `WorldServer`, network handler).
- Spider climbing: pillar and plateau paths end about 2.8 blocks short; no record has a spider actually reaching a player on top.
- Spider jockey: b37 jockey records differ from native by one trailing draw on the death tick when compared whole.
- Giant and silverfish think functions still reset `st.jumping` each tick; check against `td.bq`.
