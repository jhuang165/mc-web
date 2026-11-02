# PLAN-03b handoff, second pass: executed metadata readers

Follows `handoff_plan_03b_metadata.md`. Native evidence only, from the pinned 1.7.10 client JAR (SHA-1 e80d9b3b...). No browser parity is claimed. Runtime game code, parity.md, parity-roadmap.md and PROJECT.md are unchanged; the integrator updates them.

## Totals (2,736 values)

| | semantic | alias | invalid | unclassified |
| --- | --- | --- | --- | --- |
| before | 853 | 628 | 2 | 1253 |
| now | 1333 | 933 | 2 | 468 |

Transitions: 480 unclassified->semantic, 440 unclassified->alias, 135 alias->unclassified, no semantic value lost. The 135 downgrades are first-pass aliases that the new external-reader rule blocks: tile-entity blocks (noteblock, mob_spawner, enchanting_table, end_portal, ender_chest, beacon), brewing_stand (render type 25 reads its bottle bits), and iron_bars/glass_pane (they differ from 0 only by their own-item stack damage).

## What runs

- `tools/probes/BlockMetadataExtProbe.java` (new, called from BlockMetadataProbe as `ext`) executes every World/IBlockAccess-taking method declared in each block's class chain, plus Block.dropBlockAsItemWithChance and createStackedBlock. That covers 110 distinct signatures, listed in `executedMethods` in the reference JSON: ticks, random display ticks, neighbour changes, onBlockAdded, breakBlock, harvest/drop, onPostBlockPlaced, onBlockPreDestroy, activation, placement checks, collision boxes and ray traces, colour/icon queries and others.
- Each method runs for metadata 0-15 in a recording World double, in four layouts (`executedScenarios`): `iso`, `enc` (enclosed by stone), `same` (neighbours are the same block and value), `role` (centre 0, neighbours hold the value).
- When a method's `role` outcome varies (74 blocks), it also runs the full matrix: `nb0-nb15` (the value at the centre) and `role1-role15` (the value around). That catches neighbour-comparing code: glass compares neighbour metadata, so glass 0-15 are all semantic.
- Random arguments and World.rand use seeds 0-2 plus ModeRandom MIN/MAX (every draw at its lowest or highest value).
- The player double holds nothing, the block's own item, a red flower, a water bucket, a glass bottle or bone meal.
- Outcomes are return value, written cells, side-effect log, mutated lists and the held stack, each run twice (`NONDET` if they differ).
- Output is 123k fields (about 45 MB on stdout, about 50 s) and is byte-identical across runs. There were 0 probe errors, 138 NONDET fields and 18 skipped methods (the reasons are in the JSON).
- `tools/block-metadata-classify.mjs` does the classification:
  - Block metadata carried in outcomes (cells, falling blocks, aux 2001) is replaced by its class in a joint partition refinement over all blocks, so a value that only carries itself along is not distinct.
  - Own-item stack damage is never distinctness evidence.
  - Readers are covered only if executed without stable failure in all four base layouts and with no tile-entity query.
- External readers (new) block aliases. The canonical lowest value is still semantic.
  - Any block that creates a tile entity.
  - The RenderBlocks render method of the block's render type, when it reads world metadata (javap of `blm`, dispatch parsed from renderBlockByRenderType).
    - Exception: metadata that only reaches getIcon(side, meta), traced with a small stack simulation. This is why render types 1, 6 and 19 count as non-readers.
    - The per-type result is `renderTypeReaders` in the JSON.

## Validation

`npm test` (709 pass) and `npm run build` pass. `src/block-metadata-catalogue.test.js` now checks:

- alias requires no unexecuted reader, no tile entity, and no metadata-reading render method;
- wheat 9 is semantic and 10-13 are alias of 9;
- glass and flowing water 0-15 are semantic;
- stairs 14/15 are alias of 6/7;
- no aliases for chest, sign, end_portal_frame or hopper;
- the normalise and refineAll helpers behave as expected.

To refresh: set MC_RESEARCH and MC_PROBE_LIBS, then run `node tools/verify-block-metadata.mjs`, then `node tools/build-block-metadata-catalogue.mjs`.

## Remaining unclassified (468)

- 192: tile-entity blocks (chest, trapped chest, signs, dispenser, note block, spawner, piston extension, enchanting table, end portal, ender chest, command block, beacon, flower pot). They need tile entities in the World double, or analysis of the tile-entity classes and renderers.
- 140: the RenderBlocks render method reads metadata (rails, torches, ladder, vine, fence gate, tripwire and hook, piston head, end portal frame, brewing stand, hopper). They need RenderBlocks executed with a Tessellator double, or a data-flow argument.
- 61: differ only by own-item stack damage or in fields where one side failed (sapling, bed, wheat/carrots/potatoes 14-15, snow layer, iron bars, glass pane, anvil).
- 48: class-chain readers not covered (bed, pistons, furnaces, jukebox, comparator, dropper; mostly tile-entity queries or stable failures on the doubles).
- 24: probe-side exceptions (comparators). 3: the leader value is not established.

Caveats:

- Executed samples are evidence, not proof over all world states.
- Other blocks, items and entities reading a block's metadata are not analysed (for example the ender eye on the end portal frame, or minecarts on rails).
- The `role` layout passes the value under test to metadata parameters while the centre holds 0, so some blocks run the matrix without a real neighbour read. That costs runtime only, not correctness.
