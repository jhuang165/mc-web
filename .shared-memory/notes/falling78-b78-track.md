# falling78 (batch 78): falling block leftovers from batch 77

## Summary
- TileEntityData on landed falling blocks now covers spawners, skulls, flower pots, command blocks, note blocks, jukeboxes, beacons and comparators (`src/falling-tiles.js`). Merge = tile's own writeToNBT entries overlaid with the data keys except x/y/z.
- Falling water, lava, fire and portal: the native ItemBlocks exist, so a block that times out or cannot land drops that item. The port already dropped its hidden block items; `ORIGINAL_ITEMS` and `tools/inventory-replay.mjs` now map original ids 8, 9, 10, 11, 51, 90 so they export and import. Landing uses the native replaceable set (`doors-panes.js`) and a falling fire block needs `fire.canPlace` (solid top or burnable neighbour).
- Item Fire in region export: 0 before the first tick, -1 afterwards (derived from Age).
- Server falling blocks share the single-player code via `src/multiplayer/server-falling-tiles.js`, hooked in `simulation.js` and `server-nether.js`; changed cells go to `dirtyTiles`.
- Server eye of ender forwards aux 1002 to every player within 64 blocks of the truncated throw position (`server-eyes.js`).

## Evidence
- Executed: `tools/probes/FallingBlock78Probe.java` -> `public/research/falling-block78-reference.json` (ItemBlock existence for 8, 9, 10, 11, 51, 90, 12, 13, 145, 1; 264 `World.canPlaceEntityOnSide` landing rows; EntityItem Fire after N onUpdate calls).
- Bytecode-read: `xj.h()` (onUpdate) landing path and tile readFromNBT with x/y/z skipped; eye aux 1002 sent to nearby players (`mp`/`oi`), thrower included.
- Port-read: per-tile readFromNBT semantics in each handler mirror the port's existing tile read code (not executed against native for these kinds); LastOutput error on command blocks leaves the tile unloaded.

## Verification
Targeted `node --test`, all passing: falling78-b78 (6), fallingblock77-b77 (8), falling (7), falling-damage (6), region-import (8), region-export (3), nbtexport73-b73 (3), lava (31), mpend2-b64 (6), spsounds77-b77 (11), eye-of-ender (12), creative (10), explosion (9), interchange (13), item-entities (10), summon-coverage (7), summon-reference (2), summon2-b68 (8). `npm run build` ok. No existing test needed changing. No full npm test, no browser.

## Follow-ups
- Tile kind data was not probed natively per kind (Port-read only).
- Water/lava export gives 9/11; the flowing ids 8/10 are not distinguished.
- An item loaded with Age>0 but never ticked would natively save Fire 0; the port exports -1.
- Server has no command block store, so a falling command block's data is not applied there.
- Eye aux is sent to the thrower and players within 64 blocks; the End/Nether dimension of the throw is not distinguished (dimension 0 lane only).
