# Block behaviour audit (batch 16)

Scope: the 38 original block ids that were mapped but only audited through the metadata catalogue (the "39" in earlier notes counted a header line). Target is Minecraft Java 1.7.10; parity is not claimed.

Evidence chain: `tools/probes/BlockAuditProbe.java` (unchanged 1.7.10 classes in a World double, reusing `NetherBlocksProbe`) -> `tools/verify-block-audit.mjs` -> `public/research/block-audit-reference.json` (899 records) -> `src/block-audit.test.js` replay. Run the verifier with `MC_RESEARCH` pointing at the directory holding `minecraft-1.7.10.jar` (SHA-1 e80d9b3bf5085002218d4be59e668bac718abbc6).

Probed per block: facts (hardness, explosion resistance, light opacity and value, material, step sound, slipperiness), `canSilkHarvest`, harvest drops (fortune 0 and 3, 48 seeds per meta), `canPlaceBlockAt` over 16 supports plus a side wall and the block's own cell, neighbour-removal behaviour per meta (removing each of the six neighbours), bounding and collision boxes per meta, and random ticks (nether wart, stems, dragon egg).

## Divergences found and what happened

| Block (original id, port id) | Divergence | Status |
| --- | --- | --- |
| Note block 25 (177), jukebox 84 (178), netherrack 87 (150), soul sand 88 (151), nether brick 112 (153), nether fence 113 (154), end stone 121 (152), quartz ore 153 (156), quartz block 155 (157), skull 144 (172) | Explosion resistance was 0 (missing from the table); now the native values | Fixed, replayed |
| End portal 119 (149) | Resistance 1200000 vs native 3600000 | Fixed, replayed |
| Nether portal 90 (164) | No material, so survival mining treated it as hardness 1 and broke it; native hardness is -1 | Fixed, replayed |
| Nether wart 115 (170) | No material (hardness defaulted to 1) and the break dropped the block id, not wart; native hardness 0, drops 1 wart, mature 2 + nextInt(3) (+ nextInt(fortune + 1)) | Fixed through `wartDropCount`, replayed |
| Dragon egg 122 (171) | No material (hardness defaulted to 1); native 3 | Fixed, replayed |
| Skull 144 (172) | Light opacity 255; native 0 | Fixed, replayed |
| Jack o'lantern 91 (148) and pumpkin 86 (67) | Placeable on any block; BlockPumpkin needs a solid top surface below (not on glass, leaves, liquids, bottom slabs, fences, ice, farmland, snow layers, stairs) | Fixed through `rails.js solidTop`; the jack o'lantern is probe-replayed, the pumpkin shares the class and is not separately probed |
| Double wood slab 125 (166) | Silk Touch kept the two-slab drop; `createStackedBlock` is one slab | Fixed in `SILK[125]`; native silk row, no per-meta replay |
| Lit repeater 94 (112) | Native light 9 when powered; the port emitted none (light is per block id and the lit state is a per-cell set in `LiveRedstone`) | Fixed in batch 17: `lightEmission(112, lit)` is 9, `scene.js` asks `LiveRedstone.lit` through `scene.repeaterLit` and relights when a repeater changes state or is removed; restored powered repeaters relight on load |
| Cake 92 (161) | Collision box was the selection box (0.5 high); native `getCollisionBoundingBoxFromPool` is 1/16 lower (0.4375) | Fixed in `world.js collisionBounds` (batch 17), replayed |

## Per-block status

`P` probed natively and the port replayed in `src/block-audit.test.js` (or an existing subsystem test), `B` read from bytecode only, `O` open. Batch 17 replays the neighbour, box and wart tick columns block by block (see the section below).

| Block | Facts | Silk and drops | Placement | Neighbour | Boxes | Ticks | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 19 sponge | P | P | P | P | P | n/a | |
| 22 lapis block | P | P | P | P | P | n/a | |
| 25 note block | P | P | P | P | P | n/a | Right-click and signal are in `note-jukebox.md` |
| 62 lit furnace | P | P | P | P | P | n/a | Drops the unlit furnace |
| 84 jukebox | P | P | P | P | P | n/a | |
| 87 netherrack | P | P | P | P | P | n/a | |
| 88 soul sand | P | P | P | P | P | n/a | |
| 90 nether portal | P | P | n/a | P | P | n/a | Frame validation in `portal-wart.md`-era tests |
| 91 jack o'lantern | P | P | P | P | P | n/a | |
| 92 cake | P | P | P (own placement path) | P | P | n/a | Harness cannot use the generic replay |
| 94 powered repeater | P | P | P | P | P | n/a | Light 9 fixed (batch 17) |
| 95 stained glass | P | P | P | P | P | n/a | |
| 96 trapdoor | P | P | P | P | P | n/a | Side-attach placement is `canPlaceBlockOnSide`, only the vertical supports are probed |
| 104, 105 stems | P | P | P | P | P | P | |
| 107 fence gate | P | P | P | P | P | n/a | |
| 112 nether brick | P | P | P | P | P | n/a | |
| 113 nether fence | P | P | P | P | P | n/a | |
| 114 nether brick stairs | P | P | P | P | P | n/a | |
| 115 nether wart | P | P | P | P | P | P | |
| 119 end portal | P | P | n/a | P | P | n/a | |
| 121 end stone | P | P | P | P | P | n/a | |
| 122 dragon egg | P | P | P | P | P | P | |
| 125, 126 wood slabs | P | P | P (double slab uses its own path) | P | P | n/a | |
| 130 ender chest | P | P | P | P | P | n/a | |
| 133 emerald block | P | P | P | P | P | n/a | |
| 138 beacon | P | P | P | P | P | n/a | |
| 139 cobblestone wall | P | P | P | P | P | n/a | |
| 144 skull | P | P | P (own path) | P | P | n/a | |
| 146 trapped chest | P | P | P | P | P | n/a | |
| 153 quartz ore | P | P | P | P | P | n/a | |
| 155 quartz block | P | P | P | P | P | n/a | |
| 156 quartz stairs | P | P | P | P | P | n/a | |
| 160 stained glass pane | P | P | P | P | P | n/a | |
| 170 hay bale | P | P | P | P | P | n/a | |
| 171 carpet | P | P | P | P | P | n/a | |
| 173 coal block | P | P | P | P | P | n/a | |

## Harness artefacts, not port divergences

The snow-layer support case (a new World generates terrain so the replay cell is not empty), cake, wart, skull and double-slab placement (separate placement paths), and trapdoor side placement do not go through the generic replay and were checked against their own subsystem tests.

## Batch 17: light table audit and column replays

### Light of every block (probed)

`tools/probes/BlockLightProbe.java` -> `tools/verify-block-light.mjs` -> `public/research/block-light-reference.json` (171 records: `Block.lightValue` and `Block.lightOpacity` of every registered id 0-255 of the unchanged jar; 1.7.10 light is per block id, with no metadata term and no `getLightValue(world, x, y, z)` override). `src/block-light.test.js` replays every record against `lightEmission` and `lightOpacity` for every internal id that maps to the original id (lit furnace 62 and powered repeater 94 are state, passed as `lit`). Native emitters: lava 15, brown mushroom 1, torch 14, fire 15, lit furnace 13, lit redstone ore 9, redstone torch 7, glowstone 15, nether portal 11, jack o'lantern 15, powered repeater 9, brewing stand 1, end portal 15, end portal frame 1, dragon egg 1, lit redstone lamp 15, ender chest 7, beacon 15, powered comparator 9. Only the powered repeater diverged; the opacity table matched for every block.

### Column replays (probed natively, port replayed)

`src/block-audit-columns.test.js` drives the port against the `box`, `neighbour` and `tick` rows of `block-audit-reference.json`:

- Boxes: `blockBounds` (selection) and `collisionBounds` (single native collision box) for every exact internal state of the 38 blocks, metadata 0-15 (about 600 rows). Skipped: metadata the game never stores (stems and fence gates above 7, cake above 6, wart above 3). Exempt collision rows, kept as documented decisions: end portal 119 (its `addCollisionBoxesToList` is empty, so entities pass; the native row is only the accessor), carpet 171 (native collision is a zero-height plane at the cell floor, the port has no box and the stand height is the same), nether fence 113 (the native single box is 1.0 high; the 1.5 high fence collision is `addCollisionBoxesToList`, which the port uses).
- Neighbours: stone on all six sides, remove one, ask the port. Paths exercised: `LiveRedstone` with the shaped-block behaviours (repeater, trapdoor), `carpetNeighbourChange`, `popDrops` (stems, cake), `NetherLive.neighbourChanged` (nether portal frame, wart soul sand). Breaks and keeps agree for all 16 metadata of every block; drops agree for every breaking block (repeater item, trapdoor, seed counts under the native `Random(3)` including the three offset draws each spawned item takes, wart, carpet colour). Blocks whose native row is "stays" are checked to stay in the port. Note block 25 and trapped chest 146 rows are `NullPointerException` probe artefacts (they need a tile entity) and are skipped.
- Ticks: nether wart growth histogram over the 200 recorded seeds is equal under `JavaRandom`.

Not replayed: stem growth ticks (the native probe rows are NPE, the stem needs a real world), dragon egg tick (the falling entity is covered by the `end-reference.json` egg fall replay), block drop-on-neighbour paths that the port routes through the world-level hooks in `main.js` rather than a pure function (replayed only through the functions above, not the `main.js` wiring).

### Remaining

The probed column rows cover only the 38 blocks of the b16 audit. Boxes, neighbour reactions and ticks of the other ~140 blocks are covered by their own subsystem references and tests but not by a block-by-block native sweep. Fence collision (1.5 high) and wall collision were read from bytecode and existing tests, not probed in this audit.

## Batch 18: block sweep, round 2 (all remaining registered blocks)

### Evidence chain (probed natively)

`tools/probes/BlockSweepProbe.java` -> `tools/verify-block-sweep.mjs` -> `public/research/block-sweep-reference.json` (about 390 KB, 856 records) against the unchanged 1.7.10 jar. It covers ids 1-175 except the 38 of batch 16 and the unregistered 165-169 (132 classes with box rows). Per exact metadata state (0-15):

- `sbox`: `setBlockBoundsBasedOnState` bounds, `getSelectedBoundingBoxFromPool`, `getCollisionBoundingBoxFromPool` and the `addCollisionBoxesToList` list (multi-box blocks included); the constructor bounds are restored between reads because the bounds fields are shared per class.
- `mask`: fences, panes, bars, walls and nether fence over the 16 neighbour masks. `stair`: 12 stair ids x meta 0-7 x side x neighbour stair meta. `door`: both doors, lower meta x upper hinge.
- `nb`: remove each of six supports (stone on all sides; grass and farmland below as extra layouts; door, tall plant and bed partners placed) and record breaks, stays or meta change plus the drops under a seeded Random.
- `tick`: histograms of the resulting cell map for seeded random ticks (crops with farmland variants, sapling, cactus, reeds, farmland, ice, snow layer, snow block at block light 0/11/12/15, leaves, grass, mycelium, redstone ore, cocoa and plants).

Probe doubles: a cell-map World with fixed light (sky and block light set per scenario). Tile-entity blocks (36, 54, 149, 150, pistons 29/33 at metas 8-14) throw in the double and are skipped.

### Port replay (`src/block-sweep.test.js`, 8 tests)

- Boxes: selection bounds, collision accessor and collision list for every exact state (over 1000 rows), all 16 masks, all 96 stair contexts, 32 door contexts.
- Neighbours: about 23,000 state cases with the main.js watcher stack composed in wrapping order (watchFlowers closure, fire, trees, plants, population blocks, rails, torches, carpet, doors, beds, nether, redstone blocks, live redstone runtime); state and drops compared.
- Ticks: farmland moisture and dirt reversion, crop growth probability (port growth rate against the native frequency, 4 sigma), cactus and sugar cane (deterministic), ice/snow layer/snow block melt thresholds.

### Divergences fixed

| Area | Before | Now |
| --- | --- | --- |
| In-game selection outline (main.js) | full cube except snow, ladder, cactus, reeds | `selectionBounds` (slabs, stairs, fences, plants, doors and so on) |
| Crop selection and ray box | full cube | 0.25 high |
| Sapling, tall grass, dandelion, rose boxes | full cube or wrong | native 0.1-0.9 x 0.8 and 0.3-0.7 x 0.6 |
| Chest join bounds | independent per side | native else-if chain (north, south, west, east) |
| Powered rail with meta 8+ | masked to 0-7 | selects flat like BlockRailBase's raw metadata test |
| Cactus selection | collision box | full height, inset 1/16 on x and z |
| Crops and farmland neighbour updates | only the cell below or above changed | every neighbour update (`farmNeighbourChange`): crop off farmland pops, farmland under a solid block turns to dirt |
| Tall grass (meta 1) | never popped | pops with 1/8 seed drop when its ground goes |
| Dead bush ground | grass accepted | sand, hardened clay, stained clay, dirt (BlockDeadBush bytecode) |
| Lily pad | stayed after its water went | pops without still water (meta 0) below |
| Vine | kept stale face bits | `BlockVine.func_150093_a`: unsupported face bits are cleared |
| Snow block | never melted | random tick above block light 11 drops 4 snowballs |

### Documented exemptions (not port bugs)

Torches 50/75/76 and buttons 77/143 (bounds set in collisionRayTrace or at placement, so the idle probe value is stale); brewing stand 117 and end portal frame 120 (history-dependent bounds field); vine meta 0 (inverted native artefact); piston 29/33 metas 14-15; piston head, fence and snow layer meta 0 collision accessors (the replayed lists match); ladder metas 0, 1, 6, 7; liquids 8-11 (flow in Fluids); drops that draw from the probe's seeded Random (sapling, crops, tall grass, double plant) are state-compared only; flower pot contents (tile entity).

### Remaining gaps

- Flowers, saplings and mushrooms: BlockBush light rules read the probe's fixed light; the port uses the sky column and has no mushroom light rule (needs a world light provider in `populationPlantCanStay`).
- Door cascade drops: native drops the door item through the partner call when the lower half is removed by non-player means; owned by the doors track.
- Seeded-Random drops and grass/mycelium/leaf/redstone-ore/cocoa random ticks are not replayed stream-for-stream (the port draws other streams); sapling growth and leaf decay have their own references.
- Tile-entity blocks (chests 36/54, comparators, moving pistons) have no probe rows; their boxes come from the b16 chest/piston references.
- Stem growth, dragon egg and per-state redstone power outputs are covered elsewhere.
