# Batch 80 docs80: the remaining parity rows and the Nether fire port

## Summary
- Code: `src/nether-generator.js` `NetherGenWorld.canNeighborBurn` no longer throws. It is `alb.e(ahb, III)` (private BlockFire.canNeighborBurn): `canCatchFire` (`alb.e(ahl, III)`, `chanceToEncourageFire[id] > 0`) on x+1, x-1, y-1, y+1, z-1, z+1, stopping at the first true, over a new `FIRE_ENCOURAGEMENT` table in native ids (fire.js keeps its own table in internal ids). `hasSolidTopSurface` no longer throws for non-opaque blocks either: it reads the block, then the metadata, then GenWorld's existing `solidTop(id, meta)`. The old `isOpaqueCube` test was wrong for 7 ids (glowstone 89, leaves 18/161 and TNT 46 have no solid top; spawner 52, end portal frame 120 and hopper 154 do), unreached because population only places fire on netherrack.
- Reachability: still not reached by population. `WorldGenFire` (`arq`) places fire only after reading netherrack below, so `onBlockAdded`'s `!solidTop && !canNeighborBurn` short-circuits on the solid top. The port is covered by direct replays instead (below).
- Catalogue: `tools/build-surface-catalogue.mjs` `NETHER` text now says the checks are ported (batch 80, executed fire fixtures, not reached by population); regenerated `structure-parity-catalogue.md` (4 rows: WorldGenFire, GlowStone1/2, HellLava; status word Implemented unchanged, so the consistency tests needed no edit).
- Docs, dated "Batch 80 (docs sweep, 2026-11-18)", old text kept: `parity.md` rows Hunger, Mining, Crafting, Tools, Item drops, Pigs / root crops, Buckets, Boats; `nether.md` (two "not ported" lines); `buckets.md` (no-probe line, "there is no Nether" line); `items.md` (no water push / lava, slipperiness).
- New test: `src/nether-fire-b80.test.js` (4 tests).

## Evidence
- Executed (existing `fire-reference.json`, FireProbe on the unchanged `alb`/`ahb`): the 171-row native table, column 1 (chanceToEncourageFire) is exactly `FIRE_ENCOURAGEMENT` and column 9 (doesBlockHaveSolidTopSurface, meta 0) matches `hasSolidTopSurface` for every id; the 160 `place` fixtures replay `canPlaceBlockAt` and `onBlockAdded` (setAir, or the `30 + nextInt(10)` schedule, then the world Random's next int) through `NetherGenWorld`. The probe's World writes its map without neighbour notifications, so the test compares the fire cell's own operations only.
- Executed (existing records, counted this batch): 41 ItemBucket records in `client-predict-reference.json`; 60 player-killed zombie deaths in `combat-reference.json` roll the rare drop, seed 63 drops a potato (392); 339 recipe catalogue rows (317 manager entries + 22 furnace), all Partial.
- Bytecode-read (javap -c -p this batch): `alb.e(ahb, III)` neighbour order and `alb.e(ahl, III)`; `alb.e()` setFireInfo; `ahb.a(ahl, III)` doesBlockHaveSolidTopSurface (opaque material and renderAsNormalBlock, then `ans` stairs meta & 4, `alj` slabs meta & 8, `aln` hopper, `ann` snow meta & 7); `wo.c(add)` EntityPig.isBreedingItem = `ade.bF` = "carrot" (tempt uses `ade.bM` carrot_on_a_stick and `ade.bF`); `yz.k(DDD)` EntityPlayer.addMovementStat (head in water 3-D, in water, ladder no exhaustion, on ground 0.099999994 sprint / 0.01 walk, all on `Math.round(d * 100) * 0.01`, nothing while riding).
- Port-read (grep of `src/` and docs): every other row correction (exhaustion call sites, Efficiency/Aqua Affinity/Haste/Fatigue wiring, crack overlay, anvils and enchanting, Unbreaking through `item-durability.js`, `collisionBoxList` for items, village fields, player mount export, batch 72 rider falls, Nether bucket fizz, cauldron and dispenser buckets).

## Verification
- `node --test src/nether-fire-b80.test.js`: 4 pass.
- `node --test src/nether.test.js src/fire.test.js`: 95 pass, 0 fail.
- `node --test src/catalogue-consistency.test.js src/vite-base-path.test.js src/catalogue79-b79.test.js src/docs-sweep-b70.test.js src/nether-fire-b80.test.js`: 16 pass, 0 fail.
- `npm run build` once at the end. No full `npm test`, no browser.

## Follow-ups
1. Real code gap (bytecode-read, not fixed: several branches, not one constant): movement exhaustion in `src/player-environment.js` `finishPlayerMovement` is `distance * (inWater ? 0.015 : sprinting ? 0.1 : 0.01)` on the raw horizontal distance every tick. Native `addMovementStat` rounds to centimetres first, uses 0.099999994, takes the 3-D distance with the head under water, and charges nothing on ladders, off the ground or while riding. Needs a probe-backed fix in the movement owner's file.
2. Live mining applies Haste/Fatigue to the finished progress, not inside `getBreakSpeed`; same in real numbers, float rounding against native unchecked (no executed potion dig case).
3. Item collision for fences uses the 1.5-high union box (`collisionBoxList`), not the two per-axis boxes of `BlockFence.addCollisionBoxesToList`; boats: pair pushes and lava burning have no native records.
4. Not swept: `buckets.md` sound claim, the lake-generator part of its no-probe line, `items.md` fire damage; the Pigs row "flyPig approximate" is corrected from `achievements.md`, not re-probed.
5. Still open from batch 79: `dimensions.md` and `region-import.md` "Not ported" lists, entity/gui catalogue limitation text, `wolves.md` leads, `settings-parity-catalogue.md` RENDER_DISTANCE wording.
