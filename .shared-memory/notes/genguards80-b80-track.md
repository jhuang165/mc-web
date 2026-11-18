# Batch 80 genguards80: which world-generation "unported" guards are reachable

## Summary
- Result: none. A serial survey of 201 streamed population cells (81 populate calls each, about 16,000 populates) over Default, Large Biomes, Amplified and six Superflat presets, at generations 13, 15, 16, 19 and 20, aimed at cells holding jungle/desert temples, swamp huts, villages, strongholds and mineshafts, fired no `streaming-population` neighbour retry and no unpopulated fallback. A callback census over 45 of those cells, counting every onNeighborBlockChange / onBlockAdded / breakBlock / drop / updateTick / tile-entity creation the area world received, shows every callback lands on a ported block. Nothing was ported, because nothing reachable is unported. All guards stay as guards, and generated output is unchanged, so no generation bump.
- Jungle temple question answered. Native generation-time updates do change blocks, and generation 20+ already matches them (`structure-live-neighbors.test.js` replays the native `jungleTemple671` area call for call, hash-equal). Compared with the quiet callbacks of generations 14 to 19, exactly two blocks differ: the tripwire strings at (40, 64, 242) and (40, 64, 243) go from the generator's metadata 4 to 0. Two tripwire-hook ticks (delay 10) are also queued, at (33, 64, 247) and (40, 64, 244). The hooks keep their attached bit. The old header in `structure-world-blocks.js`, which said "native tripwire onBlockAdded would set the hooks' attached bit", was wrong and is corrected. The quiet generations keep their inert result by design, so saved worlds do not shift.
- New `src/genguards80-b80.test.js` (4 tests):
  - the jungle diff above;
  - three generation-20 cells (seed 12 jungle temple, seed 9 desert temple and village, seed 10 village and stronghold) build with no warning or error;
  - the retry path: a neighbours-mode throw retries quietly, and a quiet throw falls back to terrain with `failed` set. No test covered this before.
  - four unreached guards still throw: ladder neighbour, crop drops, comparator beside a chest, rail power update.
- Comment-only edits:
  - `streaming-population.js`: the stale "powered door, fallen button" retry examples; both are ported since batch 31.
  - `structure-world-blocks.js`: the inert-redstone scope is now generations 14 to 19, plus the measured tripwire fact.
  - `mineshaft-world.js`: rail power in neighbours mode.
  - `gen-world.js`: pointer to the survey.
  - `public/research/structure-area.md`: new batch 80 bullet.

## Evidence
- Executed (port, this repo):
  - The survey and census scripts and their outputs are in `/Users/programming-xcode/Desktop/mc-web/artifacts/b80-genguards80/` (`survey.mjs`, `survey2.mjs` census, `run*.sh`, `*.out`, `*.err`, `jarea.mjs` jungle diff). Cells were picked by `canSpawnStructureAtCoords` (temple, village, mineshaft) within plus or minus 32 or 64 chunks, by stronghold ring positions, or as the 2 x 2 cells around the origin.
  - Generation 20, Default: seeds 1 to 20 and 671, plus a village-only census over seeds 21 to 44 (22 village cells).
  - Generation 20, Large Biomes and Amplified: seeds 1 to 20 and 671.
  - Generation 20, stronghold cells: seeds 1, 2, 3.
  - Generation 20, Superflat (origin cells): Classic, Tunnelers' Dream, Water World, Overworld, Snowy Kingdom and Desert, each with seeds 1, 2, 671.
  - Quiet generations, Default: 13 (mineshafts only) with seeds 1, 2, 3, 671; 15 with 1, 2, 3, 671; 16 with 1, 2, 3, 671 and 9 to 12; 19 (MapFeatures off) with 1, 2, 3, 671.
  - Structures reached (cell-summary counts summed over runs, overlaps between runs and Default/Amplified placements included): 25 desert temple, 18 jungle temple, 39 swamp hut, 86 village, 8 stronghold and about 100 mineshaft summaries.
  - Census (generation 20): neighbour callbacks reached 13, 31, 39, 40, 54, 55, 64, 66, 106, 131, 132, 29, plus liquids and sand. Ladders (65), crops (59, 141, 142) and farmland (60) were placed but never notified. Drops: 31, 38, 39, 40, 50, 66, 30. Ticks: 8, 10, 12, 13. Tiles: 23, 52, 54, 61, 140. No comparator read.
  - Native-hash replay: `structure-live-neighbors.test.js` 9/9 here.
  - Jungle diff, neighbours mode on vs off: `PopulationArea` over the native `jungleTemple671` area.
- Bytecode-read: `aof.b` (BlockTripWire.onBlockAdded): `ahb.a(ahl, x, y-1, z)` (solid top) ? 0 : 2, then `setBlockMetadataWithNotify(..., 3)` and the hook notify. This is the reason for the 4 to 0 change.
- Port-read:
  - Unreachable by construction. Mineshaft-world's "normal-cube read of an unloaded chunk" and "non-chest-minecart entity": `PopulationArea` overrides `chunkExists` (always true) and `spawnEntity`. The finite `MineshaftPopulation` box plus one block stays inside loaded chunks, and only chest carts spawn there. Gen-world's snow/iron golem: no generator stacks snow or iron blocks under a pumpkin. Comparator neighbour: no 1.7.10 Overworld structure places a comparator.
  - Not run directly: finite generation 14 (`generateLivePopulation`). It uses the same quiet `PopulationArea` chain as streamed generation 15/16, which were surveyed.

## Verification
- `node --test src/genguards80-b80.test.js src/native-neighbor-world.test.js src/mineshaft-world.test.js src/temple-traps.test.js src/streaming-population.test.js`: 31 pass, 0 fail. `node --test src/structure-live-neighbors.test.js`: 9 pass, 0 fail.
- `npm run build`: ok.
- No full `npm test`, no browser.

## Follow-ups (proposed gap lines)
- "World-generation unported guards (gen-world.js, mineshaft-world.js): none reached over 201 surveyed cells (batch 80). Next in line if a seed ever hits one: ladder (65), crop (59/141/142) and farmland (60) neighbour changes and crop drops, e.g. from a spring or falling gravel beside a village farm. They retry quietly in generation 20."
- The survey is sampled, not exhaustive. A longer village-only run (springs near farms) is the cheapest way to look for the first real hit.
- `nether-generator.js` `canNeighborBurn` (docs80's file) was not surveyed here.
