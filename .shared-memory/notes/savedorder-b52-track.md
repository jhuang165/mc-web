# savedorder (batch 52)

## Summary
- Saved cross-kind list order is kept. `src/saved-order.js`: a save stamps each entity record (mobs, items, orbs, TNT, arrows, thrown entities, falling blocks, carts, boats, paintings/frames, rockets, potions) with `ord`, its place in the native save walk (chunks by their first joined entity, then section posY/16 clamped 0..15, then list order); a load gives the restored entities those stamps (`EntityWorld.orderSeqs`), re-sorts `mobs.entities`, and puts any unstamped entity after them. Hooks: `src/main.js` save() and load (two lines + import), `src/away-entities.js` (restore at the end of setup, stamp in `finish()` above the records the run left alone).
- Dispensed and right-click spawn eggs follow ItemMonsterPlacer.spawnCreature order: the yaw is the first World.rand draw, then onSpawnWithEgg runs (`spawnEggMob` creates the mob, sets the yaw, then `onSpawnWithEgg`, as the real spawnCreature does; before, the rolls ran before the yaw draw). The right-click egg takes its yaw from the world Random (`mobs.worldRandom`), not Math.random. The villager egg now rolls its profession `World.rand.nextInt(5)` (EntityVillager.onSpawnWithEgg), which also applies to `/summon` and any other caller of `onSpawnWithEgg`.
- The sheep, spider, zombie, pigman, ocelot and skeleton rolls already existed in `onSpawnWithEgg`; they now match the executed world Random after the dispense.

## Evidence
- Executed: `tools/probes/SavedOrderProbe.java` -> `tools/verify-saved-order.mjs` -> `public/research/saved-order-reference.json` (tag b52so, 7 scenarios, regeneration byte-identical). It runs the unchanged AnvilChunkLoader writer and reader (aqk.a(apx, ahb, dh) and aqk.a(ahb, dh)) and Chunk.onChunkLoad (apx.d: ahb.b(List) = loadedEntityList.addAll per section 0..15) over EntityListProbe's World double with EntityItem, EntityXPOrb, EntityArrow, EntityTNTPrimed and EntityCow added to chunks in a given order; each record lists the index order before the save and after the load (one chunk mixed and reversed, one section, clamped sections below 0 and above 255, two and three chunks, already sorted).
- Executed (existing): `away-dispense-reference.json` (b51ad) `worldNext`, now compared for 54 egg rows (the 18 villager, sheep, spider, zombie, pigman, ocelot rows draw more than the yaw).
- Bytecode-read (javap): apx.a(sa) (Chunk.addEntity: section posY/16 clamped, appended), apx.d (onChunkLoad), aqk writer loop (sections 0..15, `sa.d(dh)` skips dead entities and mounts with riders), yv.a(sy) (rx.a, then `s(world.rand.nextInt(5))`).

## Verification
- `node --test src/saved-order-b52.test.js` 10/10 (7 replayed probe scenarios through awayEntities finish() and a second run, plus no-stamp, stamp-cleanup and group-mismatch checks).
- `node --test src/spawn-egg-rolls-b52.test.js` 3/3.
- `node --test` over the 40 test files that mention villager/onSpawnWithEgg/spawn eggs, `src/away-*.test.js`, `src/dispense*.test.js` and both new files: 1244/1244.
- `node --test src/spawn-eggs.test.js src/away-dispense-b51.test.js src/player-edit*.test.js` 45/45. `npm run build` once, ok. No full `npm test` (batch rule).

## Follow-ups
- Chunk order is approximated by the first joined entity of each chunk; a native load follows the chunk provider's order. An entity that crossed a section keeps its join place inside the new section (natively it moves to the end of that section's list: Chunk.removeEntityAtIndex then addEntity; not probed).
- A mount saved with its rider is written natively as one nested record (the mount is skipped); here they are two records and the pair order is not modelled. Fireballs and skulls are not stamped (dimension-split records).
- A baby villager from breeding calls `onSpawnWithEgg(null)` (yv.b(rx)) so it draws the profession from World.rand: the port draws it in `spawnVillagerChild` already (unchecked against an executed row).
- The dispensed egg's `playLivingSound` (the mob's own unseeded Entity.rand) is still not played. Eggs for mobs this build lacks still draw nothing from the world Random.
- Saves written before 0.81 carry no `ord`; they load as before (walk-kind order after the mobs).
