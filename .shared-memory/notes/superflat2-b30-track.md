# Superflat2 (batch 30) track

## Summary
- Population neighbour callbacks (doors, buttons, tripwire, redstone family, dispenser markDirty) now run in the live `PopulationArea` when `neighbors: true`; class in `src/native-neighbor-world.js`, wired through `StreamingPopulation` and `java-world.js`.
- Gate: new worlds are created at generation 20 (21 with MapFeatures off); `neighborsOn(v) = v >= 20`. Versions 15 to 19 keep quiet callbacks, so old saves regenerate unchanged. A cell whose chain throws is retried quietly with a console warning.
- Tiny `src/main.js` hunk: `makeRecord` creates streamed worlds at 20 instead of 18. `src/world.js` accepts 20 and 21.
- Probe: 6 new flat areas (jungle N/E/W, desert S/N/W scattered features) in `tools/probes/flat-populate-areas.json` and `flat-populate-reference.json`; `SpringProbe -DtraceStack` adds stack frames to traces. Fixes found by comparing against native: tripwire hook read order and double meta read, button neighbour reads, unpressed button power, dispenser tile reads, TNT onBlockAdded, redstone world sharing the area's Random.
- Bonus chest: already placed in `openWorld` before `launch`, and `launch` saves at once; native source is unseeded `new Random()` (bytecode-read). Nothing changed in the module.
- Powered generation states: vanilla jungle generation writes none (no id 94/75, no lever/button bit 8); asserted by test.

## Verification
- `npm test` and `npm run build` (see final report for counts); new `src/generation-gate.test.js`, `src/structure-live-neighbors.test.js`; `flat-populate.test.js` now compares every area fully.
- Muted headless Chrome (`artifacts/b30-superflat2/smoke.mjs`, vite on 5317, `--mute-audio`, `?silent`): Default and Superflat worlds created with Bonus Chest on; chest in the live world and in the serialised player chests right after creation; stored record has `bonusChestPlaced: true`.

## Follow-ups
- Proposed gap lines for `remaining-gaps.md` (not edited): "Generation-time neighbour updates replay native for superflat and default populate from generation 20; worlds saved at 15 to 19 keep the quiet callbacks." and "Bonus chest contents are not reproducible: native uses an unseeded Random."
- The jungle temple area in the default world still differs from native in non-temple decoration (structure-area.md), so only temple chunks are compared call by call.
- Powered door and other unported power states throw in neighbours mode and fall back to the quiet path; none were hit by the covered areas.
