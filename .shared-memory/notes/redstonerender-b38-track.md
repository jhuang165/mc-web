# Batch 38 redstonerender track

## Summary
Probed 28 more RenderBlocks render types natively (`tools/probes/RenderTypes2Probe.java`, 581 fixtures, 96960 vertices, AO 0/1/2, unchanged `blm` and Tessellator executed) into the new `public/research/render-types-2-reference.json`. Ported and made vertex-exact: wire, lever, repeater (lit, delay, locked bar), comparator (both ids, subtract mode), pistons and head, tripwire hook, tripwire, plates, daylight sensor. New code in `src/render-redstone.js` and the repeater/comparator/hook/tripwire methods of `src/chunk-mesher.js` (torch now draws at a fractional base). Plates and buttons use the own-uv rule. Pinned (not ported or partly wrong): fence gate, wall, cauldron, hopper, anvil, flower pot, cocoa, stems, end portal frame, brewing stand, dragon egg, fire, button light on one vertex. `src/render-shapes.js` was not created. Bytecode-read only: x-direction tripwire pieces and the hook structure (`blm.f`, then replayed exact). Guessed: lock bar uv for facings 0, 1, 3 and comparator locking.

## Verification
Focused only (full suite left to the lead; no build). One run each: render-types-2 1/1, render-types 1/1, light-float 2/2, module-names 1/1, mesh-worker 4/4, stairs 14/14, doors-panes 8/8, shaped-blocks 13/13, redstone-blocks 12/12, redstone-blocks-2 11/11, pistons 38/38, piston-scene 2/2, ring-pistons 3/3, anvil-blocks 4/4, hopper 5/5, tripwire 43/43, tripwire-live 5/5. Load average before browser check 4.89 6.05 6.09. Muted headless Playwright check (port 5382, `?silent`, one Chrome closed in finally): wire, repeaters, comparators, levers, pistons, tripwire placed and rendered, no page errors; one generic 404 resource console message not traced. Script and `redstone.png` in `artifacts/b38-redstonerender/`.

## Follow-ups (proposed gap lines)
- Port fence gate (107:21), cauldron, hopper, anvil uv/tile, flower pot contents, cocoa, stems, end portal frame, brewing stand, fire side flames against `render-types-2-reference.json` (pinned in `KNOWN`).
- Button 77/143 and dragon egg 122: one-vertex AO/light weighting on thin partial boxes.
- Verify x-direction tripwire pieces, lock bar for facings 0/1/3 and lit-comparator locking with new fixtures.
- Reference JSON is 7 MB; reduce fixture counts if repo size matters.
