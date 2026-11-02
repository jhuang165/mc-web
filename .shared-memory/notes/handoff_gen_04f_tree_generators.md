GEN-04f (Claude): `src/tree-generators.js` ports the 1.7.10 worldgen tree generators over an original-ID adapter (getBlock, setBlock(x,y,z,id,meta,flags), isOpaqueCube; flag 3 with notify, 2 without; HugeTrees soil always 2). The classes are:

- WorldGenTrees (asq), Shrub (arp), BigTree (ard), Forest (are), Swamp (aso), Taiga1 (asf), Taiga2 (asn), MegaJungle (arz) and MegaPineTree (asa) over HugeTrees (asb), SavannaTree (ask) and CanopyTree (asi);
- WorldGenBigMushroom (aru).

BigTree is stateful: the first height limit is reused on later generate calls, so share instances exactly as biomes do. `BiomeTrees` holds a world's shared objects:

- per-slot fields az oak, aA big oak, aB swamp, and aid.aD spruce;
- statics in aif, ais and aiw.

`pickTree(slot, random, trees)` = func_150567_a and `pickGrassMeta` = func_150569_a. Mutated slots delegate to the base slot's picker and objects; aig (mutated birch) overrides.

TreeGeneratorProbe/verify-tree-generators.mjs run the unchanged classes on a synthetic World double (steps, swamp water, y=250 plateau; mirrored in the test). There are 672 tree records (28 configurations × 24, one to three chained origins, func_150524_b after success) and 244 picker records (61 slots × 4 seeds). They replay results, write hash/counts, ordered call hash and the next long exactly. Regeneration is byte-identical, and a seven-way mutation check fails the replay. npm test 711/711, build OK, bridge 5/5. App 0.23.2, generation 9, no Site publish.

Not integrated: `src/trees.js` (sapling growth, its own adapter) is unchanged, and Java worlds are still undecorated.

Next:
- WorldGenLiquids springs, which need an immediate fluid updateTick;
- the genDecorations driver, with getHeightValue/getTopSolidOrLiquidBlock services, using BiomeTrees per world and the GEN-04e features;
- biome decorate overrides and flower picks;
- emeralds and silverfish;
- animals and snow;
- versioned runtime integration.
