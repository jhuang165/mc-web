GEN-04j (Claude): ChunkProviderGenerate.populate (map features off) on one GenWorld, replayed natively.

- `src/populate-chunk.js`: `populateChunk(world, random, worldSeed, decoration, cx, cz)` = `populateBeforeDecoration` (biome read, reseed, lakes, eight dungeons) then `populateTail` (decorate, animals, snow) with that biome.
- `src/gen-world.js` adds:
  - `getSkyLight` (onCall kind 7, `skyLight` option), `biomeTop`, `canFreeze`;
  - chunk tile maps (`chunk.tiles`, key y<<8|z<<4|x), created on lookup for native provider ids. Chests (27 slots, type) and spawners (name, "Pig" default). Other providers throw unported;
  - updateContainingBlockInfo (`tileChanged`) at the native sites; `setChestSlot` (clamp 64, markDirty reads, comparator update);
  - `notifyComparators` (func_147453_f) from setBlock/setBlockMetadata for the native comparator-input ids. A comparator found throws unported;
  - BlockChest onBlockAdded/unify, onNeighborBlockChange, breakBlock (contents drop throws: unseeded Random); spawner add/break;
  - `removeTileEntity` with chest invalidate → checkForAdjacentChests (four neighbour reads, own-block type read, neighbour lookup).
- Probe: `tools/probes/PopulateChainProbe.java`, `tools/verify-populate-chain.mjs` → `public/research/populate-chain-reference.json`. Chunks are marked loaded (`apx.d`), or Chunk.removeTileEntity does nothing.
  - 17 regions (13 picked by a dungeon scan), 34 records: 407 chunks, 47 lakes, 40 dungeons, 49 chests, 40 spawners, 80 animals. Every record then removes all tile entities (89). All replay exactly (`src/populate-chunk.test.js`).
- Mutation checks kill invalidate read order, an unrecorded own-block read, skipping invalidation, skipping the chest neighbour cache reset, block light for the lake grass test, and desert lakes.
  - Not exercised: the mycelium shore (no mushroom island region). No comparators, other providers or chest drops occur.
- Gaps: structures, light propagation (saved light is synthetic), chest drops, comparators, other tile entities, tile ticking, live placement.
- npm test 753/753, build OK, bridge 5/5. Regeneration byte-identical. App 0.23.4, generation 9, no Site publish.

Next: structures (GEN-05) or versioned runtime integration of populate in Java worlds.
