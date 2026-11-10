# Batch 39 vessels track

## Summary
Branch `batch39-vessels`. New `src/render-vessels.js` (cauldron, hopper, pot, cocoa, stems, brewing stand quads); `chunk-mesher.js` dispatches (hopper/brewing use `box()` with renderAllFaces, own-uv and a face-skip function). `src/fire.js` FIRE_INFO gained stairs/fences/wood slabs (native 5/20), which fixed the fire floor-versus-side branch. KNOWN rows deleted for 118:24, 154:38, 127:28, 104:19, 105:19, 117:25, 51:3; 140:33 tightened from [2980, 2520, 1908] to [5508, 0, 2376] (the record has no plant).

## Verification
`node --test` one at a time: render-types-2 (1 pass), render-types (1), fire (21), fire-fx (12), stems-cake (6), stone-utility (11), hopper (5), module-names (1), atlas-texels (6), light-float (2), mesh-worker (4). No full suite, no build. Load average at last check 6.61 5.97 5.28 (no timing measured).

## Follow-ups (proposed gap lines)
- Flower pot plant is bytecode-read: the probe's TileEntityFlowerPot does not resolve, so no executed plant quads exist; fix the probe to insert a real tile entity and drop the 2376 jsOnly pin.
- Connected (bent) stem has no probe fixture; add stems with an adjacent pumpkin/melon.
- Brewing stand light/colour exactness depends on the gates-track emission rule (1108d03ca) in `box()`.
- FIRE_INFO burn tables for stairs/fence/slabs: BURNS/flammability checks are not in the TO_BUILD loop.
