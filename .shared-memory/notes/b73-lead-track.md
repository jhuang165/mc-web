# Batch 73 lead: merges, joins and release 0.102.0

## Merged (git log --first-parent on batch73-lead)
- nbtexport73 f66051b96
- researchdocs7 e5de60762
- streamfix73 bf884dbf2
- mpriders73 b35d336ff
- mpspawn73 fdafef667
- skins73 6f8be933b
- particles73 f3639f6d1
- sounds73 ebcf08b3e: conflict in `public/research/sound.md` (researchdocs7's sweep line and sounds73's audit section), both kept.
- mpblocks73 056845d25
- mobcells73 a055215bc

No code conflicts: `server-mobs.js` (particles73's crit attack line, mpspawn73's guard), `simulation.js` (streamfix73, mpblocks73), `server-vehicles.js` (mpriders73) and `main.js` (streamfix73, skins73, particles73, sounds73) merged cleanly.

## Lead fixes
- 83344c67f: four older tests compared entity sizes with doubles; mobcells73 made them 1.7.10 floats (`setSize(float, float)`): `models.test.js` (fire layer keys, adult and baby), `mooshroom-golem.test.js`, `player-renderer.test.js` (shadow height), `sheep.test.js`.

## Verification
Targeted tests after each merge (server merges 76 pass; four client tracks 108 pass; mobcells73 133 pass). One full `npm test` on a055215bc: 8408 tests, 8404 pass, 4 fail (all float-size expectations, fixed in 83344c67f, the four files rerun: 63 pass). `npm run build` ok; bridge tests ok. The full suite was not rerun (one full run per change). No browser checks (by request).

## Open
See "Still open from batch 73" in `public/research/remaining-gaps.md` and the ten track notes (`*-b73-track.md`).
