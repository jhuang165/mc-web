# Maps and clock (1.7.10)

Evidence: `tools/probes/MapsClockProbe.java` drives the unchanged original classes (MapColor `awv`, ItemMap `adh`, ItemEmptyMap `acl`, MapData `ayi`, MapInfo `ayj`, MapCoord `ayk`, MapStorage `azq`, RecipesMapCloning `afb`, RecipesMapExtending `afc`, TextureClock `bql`) against Unsafe-allocated world, chunk and player doubles with closed-form integer terrain. `tools/verify-maps-clock.mjs` runs it and writes `public/research/maps-clock-reference.json` (286 records). `src/maps-clock.test.js` replays the records against the JS port (9 tests). Needs `MC_RESEARCH` pointing at the ignored `tools/research`.

## Behaviour

- Clock: original 347, internal 2080, recipe 4 gold ingots around redstone. The 64-frame icon follows TextureClock (celestial angle, damped `j += d*0.1; j *= 0.8; i += j`, frame `trunc((i+1)*64)%64`), matching the reference. Shown in hotbar, inventory and first-person hand; the frame is refreshed at 20 Hz.
- Filled map: original 358, internal 2081, damage is the map id. Right-clicking an empty map (379) creates `map_N` centred on `floor(x/128+0.5)*128`, scale 0, and gives the filled map. `updateMapData` (colour sampling, shading by height difference, water depth, ring skipping, nether hash), decorations (rotation, out-of-range type 6 clamp, removal beyond 320) and the held-slot update cadence are ported.
- Persistence: `data/map_N.dat` and `data/idcounts.dat` are written and read by region export/import and the browser save (`record.maps`).
- Recipes: zoom out (map surrounded by paper, new id allocated when the craft is taken) and clone (map plus empty maps).

## Gaps

- Batch 69 (docs sweep): `src/map-render.js` ports `MapItemRenderer` (colour quad, decorations from `map_icons.png`), the first-person map pose (`mapHandMatrices`, used in `first-person.js`) and the item frame map case (`RenderItemFrame` at 1/128 scale with frame markers only), so the line below is stale. Not checked by a browser.
- Batch 69 (docs sweep): `maps-clock-live.js` passes the world's dimension and `hasNoSky` to `ItemMap.updateMapData` (`worldContext`, `dimension: state.world?.dimension ?? 0`), so Nether and End map data is created by the live path. Native evidence for those branches was not re-checked.
- Clock spin in non-surface dimensions is bytecode-derived, not probed.
- `HashMultiset` ties in the colour choice are non-deterministic in the original; the port picks arbitrarily among ties.
- Shift-click crafting of a zoomed map is not specially handled.
- `heightValue` scans downward per column (slow for big loads).
- Dropped clock items stay on their spawn frame.
- Map centres are not adjusted by region export/import offsets.
- Nothing browser-verified.
