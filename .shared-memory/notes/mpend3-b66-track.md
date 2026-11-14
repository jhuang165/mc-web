# Batch 66 mpend3: legacy End upgraded into the 256 window; island extent; eye of ender

## Summary
- New `src/multiplayer/server-end-upgrade.js`: `upgradeLegacyEnd(saved)` runs first in the `DedicatedSimulation` constructor (one line in `simulation.js`). An End record without `window: full` is copied into the 256 window: every stored coordinate moves by (+103, +32) (native = local - 25/-96 before, local - 128 after). Moved: edits, tile maps (chests, furnaces, ...), signs, skulls, tile entities, scheduled ticks (fluid, fire, falling), falling blocks, crops, redstone (pending, deferred, events, torches, lit, comparators, pistons), items, orbs, mobs (including the dragon's target `tx/tz`), vehicles, the End's lane in the saved projectiles, and the players saved in dimension 1. The record gets `window: full` and `upgradedFrom: legacy`.
- The new area is not stored; `fillEnd` generates the whole 256 window from the world seed (the generator is deterministic per chunk), then the moved edits are applied.
- Crystals: `server-dragon.js` got `addEndCrystals(n, source, skip)` (setupEnd uses it) and `legacyCrystalKeys(source)` (what the 128 window had made). `ServerEnd.ensure` adds crystals for the other spikes only when the record says `dragon: alive` and `upgradedFrom: legacy`. A crystal destroyed in the old window stays destroyed. A dead dragon (or a b63 End with no dragon field) gets none. An End nobody built yet keeps the `upgradedFrom` note through saves until the first build.
- The client still reads a snapshot with no `window` as legacy (older servers). `mpendwindow-b65.test.js` test 4 changed from "legacy stays legacy" to "legacy is upgraded".
- No new wire messages.

## Evidence
- executed (scratch scripts, not committed): end stone extent of the End generator. 8 seeds, chunks -24..23: max radius 120 to 158, columns outside the 256 window 0 to 786 (up to 2.4% of the island's columns). 40 more seeds, ring beyond radius 120: worst radius 165.8, worst |x| or |z| 165, 3 of 40 seeds reach 160. So tails beyond 128 blocks exist in most seeds but are thin and end by about 166.
- bytecode-read `ChunkProviderEnd` (`ara`) noise field: `f = 100 - sqrt(cx^2 + cz^2) * 8`, clamped to 80 and -100 (cx, cz in noise cells), so the island is a disc around (0, 0). The generator makes nothing far from it (no outer islands in 1.7.10; recalled that they came with 1.9). The measured tails are noise lifting stone slightly beyond where f nears 0.
- Decision: keep 256. A window covering every measured seed would be 336 (+-168): 1.7x the columns and light grid, and a second save migration for 0.94.0's 256 Ends. The cost is the outer rim of some tails, cut at 128 blocks like a world border. Open for the lead to override.
- bytecode-read eye of ender: `ItemEnderEye.onItemRightClick` (`acn.a(add, ahb, yz)`): if the ray hits an end portal frame it returns the stack; else on the server it calls `World.findClosestStructure("Stronghold", x, y, z)` (`ahb.b`), which calls the chunk provider (`ChunkProviderServer` `ms.a` delegates to the generator). `ChunkProviderHell` (`aqv.a`) and `ChunkProviderEnd` (`ara.a`) are `aconst_null; areturn`. With null nothing happens: no eye entity, no sound, the stack is not reduced. The server (`server-eyes.js use`: `p.dimension !== 0` returns true without taking the eye) already matches; no change. Gap closed as "already right".
- The upgrade fixture is hand-built from a real End's rows (a dragon row and a crystal row), not saved by a real 0.93.0 server.

## Verification
- `node --test src/mpend3-b66.test.js`: 4 pass. `mpendwindow-b65` 5, `mpdragon-b64` 6, `mpdragon2-b65` 5, `mpend-b63` 5, `mpend2-b64` 6, `b63-lead` 1 (one file per command). `node --check` ok on touched files; `npm run build` ok. Full npm test not run (batch rule).

## Follow-ups
- Only a browser could show: a real legacy save joined by a client (the 256 replica is untested visually, as in b65).
- Fields outside the table above that hold End coordinates would stay at old values (a spawner's nested spawn data, unknown mob fields). The probe found none for the existing mob kinds; a new field needs a key in `X_KEYS` / `Z_KEYS`.
- The thin tails beyond 128 blocks are still clipped (see the decision above).
