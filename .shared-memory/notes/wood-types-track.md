# Wood types / live saplings / big oaks track

Most of the live path (growSapling for meta 0-5 in 256-high worlds, textures, Creative list, leaf drops with fortune) already existed. This track added the missing native evidence and the remaining gaps:

- `tools/probes/SaplingTypesProbe.java` + `tools/verify-sapling-types.mjs` -> `public/research/sapling-types-reference.json` (1296 growth rows, 40 leaf-drop rows), replayed by `src/sapling-types.test.js`. All match.
- `src/wood-types.js`: log placement orientation (BlockRotatedPillar) wired in `block-placement-simulation.js`; middle-click pick damage wired in `main.js` (small localized edits); held-item meta list extended.
- `src/trees.js` growTree: use growSapling also when world.height >= 256.
- Research page: `public/research/wood-types.md`. parity.md / PROJECT.md untouched for the lead.
- Remaining: legacy 64-high worlds keep the oak stand-in for big oaks; log placement is bytecode-only.
