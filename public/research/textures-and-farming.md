# Original 1.7.10 textures and wheat farming

The 0.4 build preserves the complete client texture tree: **941 PNGs and 13 animation metadata files**, 2,316,959 bytes. Files are copied unchanged from the official client with SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`. [Provenance](../media/1.7.10/provenance.json) records each file hash. Original artwork remains © Mojang / Microsoft. The existing owner-private Site audience is preserved.

## Connected artwork

Supported world blocks now use native textures with separate tops, sides and ends: grass, logs, workbenches and furnaces no longer share generic faces. Active furnaces show the original lit front. Native grass and foliage colormaps tint a runtime atlas; source images remain unchanged. Crops and tall grass use crossed planes, glass uses cutout transparency, and farmland has the original 15/16-block height. Held blocks and inventory icons use the same face mapping.

Original GUI sheets supply hotbar/selection, hearts and half-hearts, hunger, underwater bubbles and crosshair. Item sprites, sun, eight moon phases and animated water are original artwork. Water's 32 frames advance every two game ticks, matching its original metadata.

Importing artwork does not implement every associated object. Menus, clouds, lighting, geometry and many effects are still adapted; the complete block/item/mob roster remains unfinished.

## Playable farming

1. Break tall grass in new worlds for a chance to collect wheat seeds.
2. Craft a wooden, stone, iron, diamond or golden hoe. Right-click exposed grass/dirt to till it.
3. Plant seeds on farmland. Water within four blocks horizontally at soil height or one block above hydrates it.
4. Wheat grows through eight stages under sufficient light. Bone meal advances it by two to five stages.
5. Harvest mature golden wheat; use three wheat in a crafting row to make bread. Immature wheat returns one seed.

Moisture drains without water; bare dry farmland becomes dirt. Fields, crop stages, tool wear and resources persist across save/reload and export/import. Existing worlds preserve their generation versions; version 3 new worlds add tall grass.

## Recovered rules and limitations

MCP mappings identify `akf` as BlockCrops, `aky` as BlockFarmland and `ada` as ItemHoe. `tools/investigate.mjs` stores their `javap -c -p` listings locally. Crop code requires light ≥9 and chooses growth with `nextInt(floor(25 / rate) + 1) == 0`. Rate starts at one, adds three for hydrated soil or one for dry soil, quarters neighboring soil contributions, and halves for crowded rows/diagonals. Mature drops include wheat and three seed trials with `nextInt(15) <= 7`; tall grass has a one-in-eight seed chance. Bone meal adds `2 + nextInt(4)` stages.

The browser approximates random ticks with a deterministic sampler at the original expected 3/4096 per block per tick. It does not reproduce Java RNG selection sequences. Daylight/nearby torches approximate crop light; full skylight/blocklight propagation, trampling, neighbor/support updates, rainfall, other crops and breeding remain unfinished.

Automated checks cover original-media hashes, face mapping and UVs, soil hydration/range, crop growth/spacing, light gating, bone meal, harvest drops, crafting prerequisites, moisture persistence and farmland collision. Browser checks cover tilling, planting, maturing and harvesting with resource consumption and the original textures visible.
