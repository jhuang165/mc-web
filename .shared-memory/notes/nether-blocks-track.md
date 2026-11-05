# Nether, End and quartz blocks track

Status: implemented on branch worktree-agent-af7900886e891a13c, not pushed. Details and limits: `public/research/nether-blocks.md`.

- Internal block ids 150-158 (id = item id), nether brick item 520, quartz item 382 (existing). Slab damage 6/7 on item 1103.
- Logic in `src/nether-blocks.js` (no imports). Shared-file touches are small: world.js (installNetherBlocks after the BLOCKS literal, isFence, soul sand box, SEE_THROUGH), fences.js (self-aware connect), scene.js/block-textures.js (render), mining.js, stairs.js, block-registry.js (MAP 150-158 and reserved filter), survival.js (install calls, craftingResult, ITEMS filter of reserved), experience.js, enchantment-effects.js, block-break-simulation.js, block-placement-simulation.js, block-collisions.js and player-environment.js/main.js (soul sand slow hook), fire.js (netherrack), redstone-blocks*.js (plates on the fence), torches.js, lighting.js, shadows.js, projectiles.js, original-items.js, tools/inventory-replay.mjs, region-import.js (VARIANT_DAMAGE 155), population-content.js (slab variants 0-7, quartz xp).
- Merge hazard: `installNetherBlocks` fills empty BLOCKS slots below 150 with hidden `reserved` placeholders (ids 140-149 belong to other tracks). Tests that loop over `BLOCKS` skip `reserved`. Once other tracks fill those ids the placeholders vanish by themselves.
- Evidence: `node tools/verify-nether-blocks.mjs` (needs the JDK and minecraft-1.7.10.jar), fixture `public/research/nether-blocks-reference.json`, test `src/nether-blocks.test.js`.
- Remaining: fire over netherrack not probed natively; no Nether dimension.
