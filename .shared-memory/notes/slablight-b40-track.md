# slablight b40 track

## Summary
- Ported the native slab rule in `Block.getMixedBrightnessForBlock` (`aji.c(ahl,x,y,z)`, bytecode-read and executed in the new probe): when the cell holds a `BlockSlab` (alj) and its brightness is 0, the answer is the brightness of the cell below. `lighting.js` (`cellPacked`, `isSlabBlock`, `LightVolume.packed`) and `mesh-region.js` (`RegionLight.packed`) implement it. The use-neighbour-brightness max (stairs, farmland, soul sand, plants and so on) was already right from batch 36 and is now pinned for those blocks as well.
- `away-light.js` left alone on purpose: it models `World.getBlockLightValue` for mobs, which has no slab rule.
- Bug found by the replay: sandstone (port 82) and wood (165) single slabs ignored the single-slab `shouldSideBeRendered` rule (only stone used it) and a neighbouring sandstone slab did not count as a single slab. Fixed in `chunk-mesher.js` `slabCulled` (3 small edits).
- New evidence: `tools/probes/SlabLightProbe.java`, `tools/verify-slab-light.mjs`, `public/research/slab-light-reference.json` (408 fixtures, 30924 vertices, seed 40, class hashes, client SHA1 asserted), `src/slab-light.test.js`.
- Docs: `public/research/post-shaders.md` ("Batch 40 slab light").

## Verification
- Probe run with `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research`: 408 fixtures, 30924 vertices.
- Focused tests, one at a time, all passing: slab-light 4/4, render-types 1/1, render-types-2 1/1, light-float 2/2, lighting 9/9, shadows 6/6, stairs 14/14, mesh-worker 4/4, module-names 1/1, block-light 3/3, streaming-light 2/2. No `mesh-region` test file exists; the worker path is covered only by mesh-worker.
- slab-light.test.js also checks that without the re-query the mesher differs on more than 20 fixtures, so the rule is what the fixtures pin.
- No browser check, no full suite, no build (left to the lead).

## Follow-ups (proposed gap lines)
- `RegionLight.packed` (worker path) has no direct slab fixture test; mesh-worker only compares against the main path on its own scene.
- Fixture coverage is limited to the 5x5x5 cell window and render types the mesher already matches; the replay does not cover entity brightness (`Entity.getBrightnessForRender`) or item frames, which use a different native path.
- `away-light.js` mob light has no native fixture for slab or stair cells beyond batch 33/35.
