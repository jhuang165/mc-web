# Fortress track handoff

Branch `batch7-fortress` (from main). Details in `public/research/fortress.md`.

## Changed

- New: `src/fortress.js` (MapGenNetherBridge, Start, all 15 piece classes, weights, loot, spawn list, `fortressMonsterSpawnList`), `src/fortress.test.js`, `tools/probes/FortressProbe.java`, `tools/verify-fortress.mjs`, `public/research/fortress-reference.json`, `public/research/fortress.md`.
- Shared files touched: `src/nether-generator.js` only (import, `this.bridge` in the provider, `bridge.generate` after the caves, `generateStructuresInChunk` first in populate, `blockAdded` no-op for stairs 114, header comment). `public/research/nether.md` (two gap lines reworded).
- Not touched: PROJECT.md, parity.md, items, blocks, entities. No ids allocated.

## Merge hints

- `nether-generator.js` edits are 5 small hunks; other tracks (dimensions) likely import `ChunkProviderHell` and can call `provider.bridge` for the structure map and `fortressMonsterSpawnList(provider.bridge, blockAt, x, y, z)` for spawning.
- The `NetherGenWorld.blockAdded` stairs hook could collide with another track editing that method; keep the `id === 114` early return.

## Remaining

See Gaps in `fortress.md` (no mob spawning or wither skeleton roll wiring, no persistence, Nether unreachable).

Tests: `npm test` 2986 pass (60 in fortress.test.js), `npm run build` ok. No credentials stored.
