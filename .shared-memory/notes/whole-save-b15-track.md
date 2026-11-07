# Whole Java save import (batch 15, b15-whole-save)

Branch b15-whole-save, based on main 01887b4 plus a merge of the entity-interchange branch (16cd887). Version not bumped.

Done:
- `src/whole-save-import.js`: `importWholeSave(entries, {worldId, writeBases, onProgress, signal, name})`. Region files of region/, DIM-1/region, DIM1/region (.mca only) are decoded one file at a time; each chunk goes through `importJavaRegionArea` as a 1x1 area (stand-in `ColumnSink` world, one-chunk mini region). Runtime state is merged per dimension; rider and vehicle ids (mob-, boat-, cart-) are remapped to stay unique across the save (test with two ridden boats).
- `src/whole-save-columns.js` and the `bases` IndexedDB store (version 5, `world-storage.js`): stored full columns that win over generation (`World.terrainFor`, `restoreColumns`). Hydrated lazily with exact-key reads.
- `src/region-export.js`: stored bases and flags round-trip through the Java ZIP export; limit 16384 columns for imported worlds.
- `main.js` / `import-screen.js`: whole-save path when region files exist, progress line, Cancel aborts and deletes partial bases.
- Docs: region-import.md (whole-save section), level-dat.md, hardcore.md, remaining-gaps.md, parity.md.

Population rule: unpopulated imported chunks load bare (the stateless streaming population cannot populate one column); the flag is kept and exported so Java populates them. Neighbour overhang is approximated. Bytecode-read, not probed.

Gaps: portal/spreadplayers peeks ignore non-resident stored columns; prefetch worker wastes work on imported columns; Blockworld JSON export omits bases; CLI is area-only; `world-import.js` SANITIZE caps still apply to merged runtime lists; biomes not rendered; no lighting import; no real large save tried; browser check was only a headless load smoke test (no console errors), not an actual folder import.
