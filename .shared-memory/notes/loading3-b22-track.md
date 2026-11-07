# Batch 22, track loading3 (light slicing, portal-trip screens, generation 13-17 presolve)

## Summary
- Light volume build is a generator (`LightVolume.buildSteps/relightSteps`, `StreamingLight.buildSteps`); `launch` drives it in 12 ms slices. New `src/steps.js` (`drain`, `runSteps`).
- Portal and dimension trips show a blank frame then GuiDownloadTerrain for the whole transfer; heavy work sliced (`Teleporter.*Steps`, `TerrainPeek.portalColumns`, `arrivalWarmer` in new `src/travel-loading.js`, `StreamPrefetch.whenHas`, `DimensionWorld.endCrystalSteps`).
- Generation 13 to 17 saves use the worker presolve (`solveLegacySpawn` + resident cell).
- Hot files: small hunks in `main.js` (imports, openWorld trip path, launch light and crystal slicing, `tripLoading`), `scene.js` (defer light), `java-world.js`. `entities.js` untouched.

## Native evidence
- Bytecode-read (batch 21 reading of `bjb.a(hs)`): respawn = `loadWorld` blank frame, then GuiDownloadTerrain on a dimension change.
- Probed: light results identical to the previous implementation (seeds 4, 11, 17); 36 native Teleporter replay records pass unchanged; timings from headless Chrome.
- Assumed: terrain never contains a portal block (`portalColumns` shortcut; the stepped and shortcut equality tests only use a synthetic floor); native "Downloading terrain" duration; console cleanliness during trips not collected.

## Measurements (muted headless Chrome, longtask observer, port 9493, own profile; before = 674d91b)
- Creation: seed 4 117 -> 66 ms, seed 11 202 -> 65 to 82 ms.
- Nether trip: seed 4 5259 -> max 97 ms; seed 11 6932 -> 109 ms once. Return: 12900/1752 -> 55 ms; 19012 -> 65 ms.
- End trip: 421 and 129 ms before slicing `endCrystals`, none after; End exit none.

## Tests
- `src/light-slicing.test.js` (3), `src/travel-loading.test.js` (6: portalColumns, Teleporter shortcut vs scan vs stepped, blankLoading, arrivalWarmer pregenerated path, whenHas with worker double and failure, endCrystalSteps), `src/loading-screen.test.js` (+1, spawnRequest updated): generation 13/15 flat/16/17 presolve equality.
- `npm test` and `npm run build` pass (4312 tests, 0 fail).

## Remaining gaps
- Slices are on the page thread; Overworld return trip is about 8 s wall (worker cells).
- `portalColumns` relies on an unprobed invariant.
- Download-terrain duration assumed; trip console output not collected.

## Proposed remaining-gaps lines
- Portal trips: GuiDownloadTerrain and slicing done; `TerrainPeek.portalColumns` assumes terrain holds no portal blocks (unprobed).
- Generation 13 to 17 saves are presolved in the worker; gap closed.
- Light volume build is sliced (page thread); no worker light.
