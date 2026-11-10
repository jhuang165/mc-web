# Batch 39 gates track

## Summary
Made fence gate 107:21, cobblestone wall 139:32, anvil 145:35, end portal frame 120:26, dragon egg 122:27 and buttons 77:0 / 143:0 match every vertex of the executed RenderTypes2 probe (all three AO settings). Their `KNOWN` rows are deleted. New module `src/render-shapes.js` (gate plan, native-rotation map, anvil uv table); `chunk-mesher.js` got small local edits: `box()` takes a predicate for `renderAllFaces` and an optional uv function, flat lighting for any block with a light value, the end frame, gate, wall and anvil callers.

Shared change (vessels depends on it): in `ChunkMesher.box()` a block with `lightEmission(b) > 0` now takes `flatFace` instead of the smooth path, as `renderStandardBlock` does for non-zero light values. `lighting.js` and `smoothFace` were not touched; the batch 38 "one-vertex AO weighting" was this rule, not partial AO. It also fixes the brewing stand's light/colour mismatches (117:25 now 4056/6432 exact; its `KNOWN` row was left for the vessels track).

Evidence: executed record for every vertex. Bytecode-read: `blm.a(ala,...)` gate box sequence (run through a throwaway symbolic interpreter, saved in `artifacts/b39-gates/interp.py` and `gate.py`), `blm.a(aoi,...)` and `aoi.a(ahl,IIII)` face rule, `blm.a(aku,...)` end frame flow. Fitted to the executed record only: the anvil uv table (`ANVIL_UV`; script `artifacts/b39-gates/anvil-fit*.mjs`).

## Verification
Focused, one at a time (full suite and build left to the lead): render-types-2 1/1, render-types 1/1, anvil-blocks 4/4, shaped-blocks 13/13, stone-utility 11/11, end 12/12, light-float 2/2, mesh-worker 4/4, module-names 1/1, atlas-texels 6/6, shadows 6/6, stairs 14/14, doors-panes 8/8, redstone-blocks 12/12, redstone-blocks-2 11/11, hopper 5/5, tripwire 43/43. No browser check.

## Follow-ups (proposed gap lines)
- Gate, wall, end frame and anvil are exact only at (8,8,8) with the probe's Block bounds; a probe with other positions, and with bounds left stale by a collision query, would pin the end frame's top-face culling and the wall's bottom culling in the live case.
- `scene.js` still imports the old `gateRenderBoxes` (held/item model); check it against `gateRenderPlan` if the item render matters.
- Anvil uv table is fitted, not derived from the uvRotate bytecode.
