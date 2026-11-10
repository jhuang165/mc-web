# mobpaths (batch 35): native path point counts, stacked storeys, zombie follow range

## Summary
- New probe output: every native `PathFinder` search is counted (`searches`: [tick, PathPoints created = size of ayg's IntHashMap, found]); the port exposes `setPathSearchObserver` in `src/pathfinding.js` and the replay compares every search size and outcome.
- Finding: the "range 40-45" assumption of b34 was wrong. `EntityZombie.onSpawnWithEgg` (bytecode-read) adds "Random zombie-spawn bonus" on followRange, operation 2, d0 = nextDouble * 1.5 * local difficulty, kept when d0 > 1. A Hard zombie in a well-played chunk has (40 + bonus) * (1 + d0), about 80 to 130. The port already rolls this (difficulty.js); the search cost was not measured for it.
- Native counts (b35 records, all replay with no divergence and equal search sizes): sealed villager, zombie range 100, flat ground: 31191 points; four storeys of 61x67 slabs joined by ramps, range 40: 24461; seven-storey tower: 33088 (28096 expanded). A zombie only targets within 4 blocks vertically, so multi-storey floods need villagers and zombies on neighbouring storeys. So the 30000 cap (counted on expanded points) is reachable on flat ground at range 100+, and a capped search returns the closest point of a truncated flood, which can differ from native.
- Timing (Node, typed-array world): about 1 ms per 1000 expanded points (16k expanded 11 ms best, 28k about 30-45 ms; the machine was loaded, so these are best-of-N and noisy). A memoised `verticalOffset` per search was tried and was slower (Map overhead above the cost of the cell test); reverted. The cap was left at 30000; no cheaper exact search was found.
- Port fix found by the counts: a mob that despawned earlier in its own update (`setDead`) still searches natively with its real health; the port had zeroed it, so the fall tries (`maxSafePointTries`) were 3 instead of 16 for that last search. `despawnedHealth` (entities.js despawn hook) is read by ai.js `maxSafePointTries`.
- Files: `src/pathfinding.js` (observer, comments), `src/ai.js`, `src/entities.js` (one line), `src/village-fight-replay.js` (b35 export, `follow`), `src/village-fight-b35.test.js`, `public/research/village-fight-b35-reference.json` (8 records), `tools/probes/{VillagerProbe,VillageFightProbe}.java`, `tools/verify-village-fight.mjs` (b34 file is now rewritten only with VF_REWRITE_OLD; VF_DUMP exits right after the run).

## Verification
- Native: `MC_RESEARCH=... node tools/verify-village-fight.mjs`.
- Focused: `node --test src/village-fight-b35.test.js` 9 pass; `src/pathfinding.test.js src/ai.test.js` 18 pass. Full `npm test` and `npm run build` NOT run (lead throttle). No browser check (no rendering change).

## Follow-ups (proposed gap lines)
- Goal 2 (chicken of a refused jockey zombie) not recorded. Bytecode-read of `yq.a(sy)`: the new chicken is built, rolled, `setChickenJockey`, `spawnEntityInWorld` (refused in an unloaded chunk, so not spawned), then the zombie mounts it; no world Random draws beyond the zombie's own rolls. A nearby loaded chicken is flagged a jockey and gets the unspawned zombie as rider; the port's ghost path skips both. Unprobed.
- Goal 3: only `b31-equip-swap` swaps held items and it uses a bow (no attribute modifiers), so the old `held()` skip changes nothing in any b31-b34 record. A sword swap on a melee skeleton is unrecorded.
- Goal 4 (doors/gates on slopes, multi-floor fleeing) not started.
- Live cost: range-100+ sealed-target searches expand 30000+ points; consider a larger cap or a time-sliced budget decision by the lead.
