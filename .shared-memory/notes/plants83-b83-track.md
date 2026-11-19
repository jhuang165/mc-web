# Batch 83 plants83: dandelion/tallgrass rawDamage, double plant metadata, /setblock tile tags, away dropStacks

## Summary
- Dandelion and tall grass metadata (`src/block-registry.js`):
  - 43 (dandelion) is now `same(37)`, so the chunk keeps its meta. It was `fixed(37)` before, which collapsed it to 0.
  - 83 (dead shrub, tallgrass:0) is the new `SHRUB` mapping. It stores 31:0 and 31:3..15. Metas 1 and 2 stay the port's tall grass 39 and fern 84.
  - Old saves only ever stored 37:0 and 31:0 for these ids, so they read back unchanged.
  - `public/research/block-metadata-catalogue.md` was regenerated with `node tools/build-block-metadata-catalogue.mjs`. Tallgrass 31 and yellow_flower 37 now read "exact all 16".
- Drops, pick and placement (`src/plant-damage.js`):
  - `plantDropDamage` now covers the dandelion and the shrub (rawDamage when meta != 0) and the double plant (`doublePlantDamage`: types 6/7 keep rawDamage).
  - New `tallGrassShearStack` and `rawDamageCell`.
  - New `plantPick`, used in `main.js` `pickBlock`. It covers the flower, shrub and double plant getDamageValue; the double plant top reads the lower half.
  - `block-placement-simulation.js`:
    - A dandelion or shrub stack with rawDamage places that meta. Shrub rawDamage 1 places tall grass 39, and 2 places fern 84.
    - Tall grass, shrub and fern now need grass, dirt or farmland below (the "plant-support" check). Before this they could be placed anywhere.
    - The double plant places the rawDamage & 15 lower half. Its top gets the native facing bits `8 | (((floor(yaw*4/360 + 0.5) & 3) + 2) % 4)`, where the port used to leave them at 0.
- Port bugs fixed on the way:
  - `population-content.js`, shears:
    - The fern 84 used to drop item 39 damage 2, which clamps to tall grass. It now drops a fern.
    - The shrub keeps its meta.
    - Double fern drops two ferns 84 and double grass drops two tall grass 39.
  - `population-content.js`: double grass without shears drops nothing. It used to roll seeds.
  - `explosion.js`:
    - 83 and 84 roll seeds on nextInt(8), as 39 already did. They used to drop as themselves.
    - Dandelion and double plant drop through `plantDropDamage`. Double plant tops and types 2/3 drop nothing.
  - `bone-meal.js`: a double plant drop keeps types 6/7 as rawDamage. `sparkleHeight` includes 83.
  - `block-textures.js`: double plant types 6/7 draw the sunflower. Natively these overrun the icon arrays (AIOOBE).
  - `chunk-mesher.js`: a shrub cell with meta 3+ gets the grass tint.
  - `item-names.js`: a shrub stack with rawDamage 3..32767 is named "Grass" (`tile.tallgrass`).
- /setblock tile tags (new `src/setblock-tags.js` `applySetblockTag`):
  - Covers the flower pot (Item/Data), the sign 63/68 (Text1-4, cut to 15 characters, editable off), the note block (note), the jukebox (RecordItem/Record; discs only) and the comparator 149/150 (OutputSignal).
  - Every read is a fresh tile, as native does, so missing keys read their defaults.
  - Keys the port keeps no state for are returned as ignoredTagKeys.
  - `command-host.js`: the one-line final `else` calls it. The env gets `signs`, `music` and `comparators` from `main.js`, `multiplayer/server-worldcmds.js` (via `server-music.js` `musicOf`) and `away-commands.js`.
- Away world:
  - `away-commands.js` takes a `dropStacks` param, and `away-world.js` wires it. Each item spills one entity at `+ rand*0.7 + 0.15` per axis, through the entity run's item random (Math.random without it).
  - `spill` now keeps rawDamage.

## Evidence
- Bytecode-read (`javap -c -p` on `tools/research/minecraft-1.7.10.jar`):
  - `anz` BlockTallGrass:
    - getIcon: meta >= 3 uses icon 0.
    - colorMultiplier: meta != 0 is the grass colour.
    - harvestBlock with shears: `ItemStack(tallgrass, 1, meta)`.
    - getDamageValue: the world meta.
    - It extends BlockBush (`ajr`), whose canPlaceBlockAt checks for grass, dirt or farmland.
  - `ako` BlockDoublePlant:
    - getItemDropped: null for the top half and for types 2/3.
    - damageDropped: meta & 7.
    - Shears on types 2/3: `ItemStack(tallgrass, 2, type == 3 ? 2 : 1)`.
    - getDamageValue: the top reads the lower meta & 7.
    - onBlockPlacedBy: the top meta formula above.
    - getIcon: the arrays have 6 entries, so types 6/7 throw.
  - `adl` ItemMultiTexture, `abr` ItemColored and `aci` ItemDoublePlant: getMetadata returns the damage. `abr` getUnlocalizedName falls back to the base key past its subtypes.
  - `bm` CommandSetBlock:
    - It parses the tag only for tile-entity blocks.
    - If setBlock returns false (same block and meta), it throws noChange before the tag is read.
    - Otherwise it sets x/y/z in the tag and calls readFromNBT on the new tile. The old tile was removed in breakBlock.
  - The readFromNBT methods of TileEntityFlowerPot, TileEntitySign, TileEntityNote, TileEntityRecordPlayer and TileEntityComparator: the keys listed above.
- Executed: no native probes in this track. The port behaviour was executed in the targeted tests below.
- Port-read:
  - The registry's first-exact-match rule (`toOriginal`/`fromOriginal`).
  - The rawDamage convention (`validRawDamage` 1..32767, b82).
  - The existing readers `potFromNbt`/`setPotContents`, `readNoteTile` and `readJukeboxTile`.
  - The redstone comparator tile Map.
  - `ItemEntities.dropBlock` (the offset the away spill copies).

## Verification
All runs are `node --test --test-timeout=600000 src/<files>`:
- `plants83-b83.test.js`: 12/12 pass.
- Plants, placement and pots (block-registry, plants, population-content, block-placement-simulation, block-placement-replace, pots82, flowerpots72, explosion, bonemeal3-b67, item-names, stone-utility): 93 tests.
  - Two failures before the fixes: population-content (a state with no yaw, fixed in code with `yaw||0`) and pots82 (an old assertion, below).
  - The reruns pass 18/18.
- Commands (command-tags, commands, command-block, mpworldcmds-b68, mpcmd80/81/82, cmd-args-b82, away-commands, spfixes75): 93/93 pass.
- Blocks and regions (block-sweep, block-sweep3, shaped-blocks, doors-panes, player-edit-simulation, player-actions, fluids, item-render, dyes, region-file, region-export, decoration-features, biome-overrides, stems-cake): 143/143 pass.
- Redstone, multiplayer and render (redstone-blocks, redstone-blocks-2, tick-tree, spawn-data, mpclicks76, mpperf82, mpsounds-b74, spsounds-b75, attributes2, bed, stairs, redstone-ore, whole-save-import, block-textures, away-world, falling78, fallingblock77): 173/173 pass.
- Mesher, bone meal and item names group: 235 pass and 1 fail (block-metadata-catalogue: the generated md was stale). After regenerating it, that test passes 5/5.
- Import and pot packs (region-import, commands-extra, level-dat, potspacks79/80/81, falling79): 54/54 pass.
- Placement and blasts (attributes2, block-audit, block-sweep, block-sweep3, client-predict-b56/b57, collide81, command-block, directional-placement, dispenser-piston-world, doors-panes, instantbreak-b55, mpplace82, neg-stacks, potspacks81, rails, redstone-ore, redstone-blocks, spblast82, spsounds-b75, spswing80, tilenames-b74, wood-types): 180/180 pass.
- `npm run build`: ok (built in 7.03s; only the usual chunk-size warning). Per the track rules there was no full `npm test` and no browser checks.
- An old test encoded the fixed gap: `pots82-b82.test.js` expected `plantDropDamage(YELLOW_FLOWER, 3)` to be null. It now expects `{ damage: 0, tags: { rawDamage: 3 } }`.

## Follow-ups
- An explicitly empty pot (`{Item:0}`) whose meta is not 0 still shows that meta's plant, because the port's pot has no "empty with meta" record.
- /setblock without a tag does not reset old sign text when only the sign meta changes. Native makes a fresh tile.
- When /setblock replaces a jukebox, record ejection was not checked.
- /setblock tags for the other tile entities (chest family, furnace, dispenser, spawner, skull, beacon, command block) are command-host.js's existing `loaded` path and were not changed.
- Browser-only:
  - The grass tint and icon of a shrub meta 3+ cell in the world.
  - The untinted inventory icon of a rawDamage shrub stack (native tints it green).
  - The double plant top's facing for sunflower heads.
  - The sunflower fallback for types 6/7.
  - Sign text rendering after a tagged /setblock.
