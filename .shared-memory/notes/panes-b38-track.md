# Batch 38 track: panes

## Summary
- `src/chunk-mesher.js`: new `glassPane` (blm.k, type 41, panes 102 and 160), `pane` rewritten as the type 18 port for iron bars (blm.a(aoa, ...), bytecode-read, no native fixture), new `vine` (blm.j), `bed` (blm.v) and `lilyPad` (blm.o); fences now draw every box face (renderAllFaces) as native type 11 does. Lily pad special cases in `cube()` and `cubeTint` removed.
- `src/lighting.js` `smoothFace`: the centre sample of a partial face uses the front cell unless it is `isOpaqueCube`; leaves count as opaque only with Fast graphics. This was the 24 nether fence light mismatches.
- `src/render-types.test.js`: `KNOWN` is empty; every recorded type is pinned at 100%. The reference JSON and probe were not changed (old records stay as they were).
- Panes, vine, bed, lily pad and fence results (exact vertices): 612/612 (x2 panes), 144/144, 480/480, 72/72, 648/648 (x2 fences). Panes, vine and bed also keep the native vertex order.
- Docs: "Batch 38 panes" in `public/research/post-shaders.md`.

## Verification
Focused runs, one at a time, all passing: render-types 1, doors-panes 8, fence 6, light-float 2, block-textures 2, atlas-texels 6, lighting 9, mesh-worker 4, module-names 1, lily-pad 4, bed 7. The full suite and `npm run build` were left to the lead.
Browser: muted headless Playwright (`artifacts/b38-panes/smoke.mjs`, port 5381, load average about 8): a new world loads, a glass pane wall, iron bars, vines, lily pads, bed and fence arrangement renders (screenshot `artifacts/b38-panes/panes.png`); the only console error is one 404 on a resource (same as batch 37).

## Follow-ups (proposed gap lines)
- Iron bars (type 18) are ported from bytecode only; add iron bars (original id 101) to the probe as an extra fixture batch after the existing loop so old records stay byte-identical.
- The probe places every fixture at (8,8,8): lily pad, vine and tall grass position hashes are not checked at other positions.
- Fences now emit the hidden top and bar-end faces natively draw (a few extra invisible quads per fence).
