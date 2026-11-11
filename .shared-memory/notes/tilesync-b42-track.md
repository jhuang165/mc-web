# Ring container seeding and chunk resend tile entities track (batch 42, branch batch42-tilesync)

## Summary
- **Evicted chest seeding (fixed).** Cause: `ContainerResidency.trim` drops an evicted column's containers from `survival`; `seedRingChest` then found the record claimed (null) and `openChest` made an empty tile, which `beginSave` put in the column scope over the stored data. Fix: `ContainerResidency.reach` (async read through the existing `ensure`, hydrate, mark live), `ringReach` in `ring-chests.js`, `host.containerReady` for furnaces/dispensers/hoppers/brewing stands in `inventory-transfer.js`; pending reads make `containerAt` return null so the hopper waits. `main.js` passes `containerResidency`.
- **Chunk resend tile entities.** Native send recorded: bytecode-read `mr.b` (chunk packet, then per masked section every tile entity's `getDescriptionPacket`; single or 2-63 changes send the changed cell's description when the block has a tile entity) and executed `TileDescriptionProbe` (only sign S33, skull/spawner/beacon/command block/flower pot S35 actions 4/1/3/2/5 send). Port: `src/tile-sync.js`, `splitChanges(..., tilesOf)`, `expandChunks` -> `message.tiles`, `DedicatedSimulation.tileEntities` (saved), `main.js` applies with `applyTiles`.
- **Slow first lookup.** Measured 650-860 ms first build, about 200 ms with terrain cached. `StreamingPopulation.requestCell` hook returns `undefined` (0.06 ms) and the worker builds the cell; `main.js startPrefetch` sets it; no worker keeps the sync build.
- Docs: `public/research/streaming.md` "Batch 42 (tilesync)", `public/research/tile-description-reference.json`. Not touched: remaining-gaps, parity, PROJECT, version.

## Verification
- `node --test src/hopper.test.js src/dispense.test.js src/streaming-population.test.js src/container-residency.test.js src/ring-chests.test.js src/ring-hoppers.test.js src/tile-sync.test.js src/multiplayer-refusal.test.js`: 45 tests, 45 pass, 0 fail (load average 10-14 on the shared Mac).
- Probe: `TileDescriptionProbe` compiled and run against `tools/research/sign-probe/classes` with the 1.7.10 libraries and a stub `com.mojang.authlib.GameProfile`; no verify script (the output is the committed reference JSON).
- No `npm test`, no build, no browser run; the `main.js` changes are one import, three callback lines and one `applyTiles` line.

## Follow-ups (proposed gap lines)
- Cell-change (1 to 63) resends carry no tile descriptions; a sign placed/edited by another player arrives without text. Dedicated sign/skull/spawner/beacon edit messages do not exist.
- A hopper above an evicted column reads null while it loads and then falls back to picking up items (`pickUpFromWorld`) for that tick; natively the chunk would simply be loaded.
- `describeTiles` scans the masked sections cell by cell for flower pots (about 65,000 reads for a full-height mask); fine for the rare resend, not for per-tick use.
- The `requestCell` wait has no timeout beyond the worker's own failure path.
