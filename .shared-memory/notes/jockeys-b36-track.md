# Batch 36 track: jockeys

## Summary
- Chicken jockeys: `EntityZombie.onSpawnWithEgg` (yq.a) is ported with its World.rand draws: nearby chicken, new chicken in a loaded chunk, new chicken refused in an unloaded chunk (the ghost rider is never ticked, the mount keeps it). Five native records.
- Held-item swaps: equipment sync timing (`equip` vs `equipmid`), `attackEquipment` for damage and `getExperiencePoints` (previous equipment), skeleton `setCombatTask` reset on every held write (`Brain.syncCombatTask(reset)`). Three native records (sword swap Normal and Hard, skeleton).
- Village: 12 records for gates and doors on slopes and villagers fleeing across storeys. All replay exactly; no port fix was needed beyond the above.
- Chicken egg laying and the chicken brain now use the entity's own random, as native does. Rider seat is taken right after the rider's update.
- Small edit outside the owned list: `src/mob-riding.js` `releaseDead` keeps a ghost rider.
- Reference: `public/research/village-fight-b36-reference.json` (20 records). Old reference files are not rewritten; a rerun shows 99 identical records and 11 differing only in constructor-yaw fields (documented Math.random yaw).

## Verification
Focused tests, all passing: village-fight-b36 24, village-fight 4, b31 5, b32 6, b33 33, b34 27, b35 9, chicken 20, mob-riding 12, mob-equipment 13, spawn-eggs 15, ai 12, entities 21, combat 8, mob-riding-nbt 2, pigman-jockey 5, vehicle-riders 5, riding-nbt 5, skeleton-arrow-villager 1, zombie-villager 10.
No browser check needed (no rendering change). No timing measurements taken. Full suite and build left to the lead.

## Follow-ups (proposed gap lines)
- A chicken whose Wander target is underground walks about 5 blocks natively, the port stops one block away (seed 1406, equal search sizes); likely pathfinding partial-path choice (pathcap track).
- Hard baby-zombie jockey scenario at seed 113 (nearby chicken) differs by 3e-4 on a regular zombie at tick 155.
- Other jockey kinds (skeleton spider jockey, pigman chicken jockey interplay) not recorded.
- Old reference records are not regenerated; yaw-only drift on rerun.
