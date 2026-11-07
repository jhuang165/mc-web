# Batch 16 decorate track

Branch b16-decorate (worktree b16/decorate), based on 60d9af0, app 0.45.0.

## Changed
- Audit mode in `tools/probes/PopulateChainProbe.java`; regions from `tools/find-biome-audit-regions.mjs` into `tools/probes/biome-audit-regions.json` (69 regions, 56 slots).
- `tools/verify-biome-audit.mjs` -> `public/research/biome-audit-reference.json`; `src/biome-audit.test.js` replays native populate exactly.
- Real bug fixed: mutated-biome class semantics (`biomeClass` in `src/java-biomes.js`, used in `src/biome-layers.js`). Alters biome map near mutated jungle shores; generation version NOT bumped (lead to decide).
- Lily pad: only top and underside quads (`src/scene.js`, one line in `cube()`).
- Catalogue generator `tools/build-content-catalogue.mjs` marks audited slots; `biome-parity-catalogue.md` regenerated. Docs: `biome-decoration-audit.md`, `remaining-gaps.md`, `biome-colors.md`.

## Remaining
Slots 10, 20, 151 have no natural region; desert wells and jungle melons only via feature records; lily UV rotation unported; light fixtures; structures off; rows stay Partial.
Entity and gamerule catalogues show generator drift from other tracks, not touched here.
- `src/structure-world.test.js` jungle-temple fixture seeds changed 671 -> 267 (671's temple vanished with the corrected jungle-shore biome map).
