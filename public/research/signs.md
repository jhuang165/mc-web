# Signs (1.7.10)

Native evidence: `tools/probes/SignProbe.java` runs the unchanged 1.7.10 jar; `node tools/verify-signs.mjs` writes
`public/research/sign-reference.json` (1577 records: facts 2, item 1, shape 32, place 494, neighbour 1056, remove 15,
nbt 6, tile 1, chars 1, filter 1, plus javap constants for render, GUI and server). `src/signs.test.js` replays it.

Ids: blocks 175 (standing, original 63) and 176 (wall, original 68); item 480 (original 323). Recipe: 6 planks over a
stick make 3 signs. Stack 16, hardness 1, drops the sign, no collision, light opacity 0.

Implemented: placement (yaw meta in float32, side 0 refused, solid click target, replaceable cell), neighbour pop,
per-metadata bounds and ray boxes, tile store persisted in saves, chunk-runtime and region import/export ("Sign"),
the model/text renderer (`sign-renderer.js`, 64-block cull) and the edit screen (`sign-editor.js`).

Not done: no multiplayer packet path (the edit is applied locally), text uses the browser font rather than the native
bitmap font metrics, and the editor layout is approximate against the native screen. Not a claim of full parity.

Merge notes: `BLOCKS` is sparse at 140-174 (other tracks); loops over `BLOCKS.length` need hole guards. Shared files
touched: world.js, block-registry.js, survival.js, original-items.js, scene.js, lighting.js, main.js,
player-edit-simulation.js, chunk-runtime.js, region-import.js, region-export.js, projectiles.js, shadows.js.
