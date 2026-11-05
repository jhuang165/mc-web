# Boats track handoff

Branch `worktree-agent-a4684585e27382c40`. Boats (EntityBoat, ItemBoat) with native evidence.

- Files: `src/boats.js` (extends Minecarts bookkeeping), `src/boat-renderer.js`, `src/boats.test.js`, `tools/probes/BoatProbe.java`, `tools/verify-boats.mjs`, `public/research/boat-reference.json`, `public/research/boats.md`. Wiring: `src/vehicle-simulation.js` (`vehicleSystem`, boat actions, `moveStrafing`), `src/structure-simulation.js` (`useBoat`, `tickBoatSimulation`), `src/main.js`, `src/chunk-runtime.js`, `src/world-import.js`, `src/survival.js` (item and recipe), `src/original-items.js`, `src/population-creative.js`, `tools/inventory-replay.mjs`.
- Item id 495 (original 333). Other agents must not reuse 495; 470 is the wooden door and 450 the chest minecart.
- Creative lists are in `src/population-creative.js` (creative.js tab lists are overwritten from it).
- `src/minecarts.js` dismount now uses `cart.height` when set.
- Tests: `npm test` 1890 pass, `npm run build` ok. Not exercised in a live browser session.
- Remaining: see `public/research/boats.md`.
