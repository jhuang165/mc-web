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
