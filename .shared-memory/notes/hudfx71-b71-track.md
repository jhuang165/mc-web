# Batch 71 hudfx71: HUD vignette, witchMagic, brewing bounds, glowstone Fortune

## Summary
- Vignette: `src/vignette.js` (smoothing, testable), `src/screen-overlays.js` (`renderVignette`, GL blend ZERO / ONE_MINUS_SRC_COLOR over the finished frame), one hook in `src/main.js` after the screen overlays (fancy only, not under F1, screens playing/inventory/paused).
- Stem darkness pop: found wrong. 1.7.10 BlockBush.canBlockStay has no light test. No code change; `public/research/stems-cake.md` says so.
- witchMagic: `src/witch-magic.js` (shared loop), `src/fx.js` (kind `witchMagic`, purple spell particle, base texture 144), `src/copy-status.js` (single player copy spawns it), `src/entities.js` (`copyState` passes `this.fx`; `witchUpdate` also sends `mobStatus(e, 15)`), `src/multiplayer/remote-mobs.js` (status 15 on the client copy). No new wire message: the existing S19 `mobStatus`.
- Brewing stand selection: native keeps the shared bounds, so the selection is the unit cube before any collision pass and the 0.125 slab after. `src/brewing.js` (`brewingSelection`, `noteBrewingCollisionPass`, `brewingShared`), `src/world.js` hooks in `blockBounds`, `collisionBoxes`, `collisionBoxList`. The 0.875 box is removed.
- Glowstone Fortune: `src/enchantment-effects.js` rule 89 (and Silk Touch drops the block; the silk path now maps block to item through `itemOfBlock2`, so glowstone drops item 1131 not 131). Server uses the same `breakPlayerBlock` path.
- Probes: `tools/probes/BrewingBoundsProbe.java`, `tools/probes/GlowstoneDropProbe.java`, `tools/verify-brewing-bounds.mjs` -> `public/research/brewing-bounds-reference.json`. Test: `src/hudfx-b71.test.js`.
- Docs (dated Batch 71): brewing.md, stems-cake.md, redstone-blocks-2.md, render-settings.md, particles.md.

## Evidence
- executed (1.7.10 jar, sha1 e80d9b3b): BlockBrewingStand shared bounds before/after the collision pass (5 records); BlockGlowstone quantityDroppedWithBonus, Fortune 0..3 x 200 seeds, and its dust item.
- bytecode-read: `bbv.a(FII)` renderVignette (field `a` starts 1.0F; `(float)((double)a + (double)(t - a) * 0.01)`; glColor4f(a,a,a,1); blend 0,769,1,0; only when `bao.x()` fancy; brightness `bjk.d(1.0F)` = `sa.d(F)`), no world border part. `ajr` (BlockBush) `j` and `anu` (BlockStem) for the stem question. `yp.a(byte)` status 15 loop and `yp.e` roll `nextFloat() < 7.5E-4` then `world.setEntityState(this, 15)`; `bma` witchMagic = EntitySpellParticleFX(144) with colour (f, 0, f), f from the client world's rand. `alg` glowstone and `aji.E` canSilkHarvest (normal cube, no tile entity).
- recalled: the frame loop calls renderVignette once per rendered frame (so the 1 % step is frame-rate dependent natively; the port matches by stepping per drawn frame).

## Verification
- `node --test src/hudfx-b71.test.js` 5/5. Neighbours (brewing, brewing-transfer, enchantment-effects, block-break-simulation, redstone-ore, mobcopies2-b61, creeperwitch-b45, witch, fx, fire-fx, block-audit, stems-cake, redstone-blocks-2, mpanimals-b61, mpmobs-b59, mpmobs2-b60, mpmobtypes-b61, mpsmall2-b62, player-throw-replay): 278 pass, 0 fail.
- `node --check` on every touched file; new `main.js` identifiers (`options`, `playerBrightness`, `BRIGHTNESS`, `scene`, `position`, `screenOverlays`, `screen`) already used in the same function.
- Full npm test not run (batch rule). Build: see the final report.
- Not checked in a browser (no browser checks allowed). Only a browser would show: the vignette strength and edge look, its order against the HUD and the hand, and the witch particles' look.

## Follow-ups
- Brewing: the dedicated server keeps its own shared-bounds flag; a fresh client can aim at the upper part of a stand its server treats as a slab. Native has the same per-process state but the aim is not server-checked there.
- Vignette runs in the single player/server-client render path of `animate` only; Fast graphics draw nothing and keep the stored level.
- Entity.getBrightness for the vignette reuses `playerBrightness` (feet y + 1.8 * 0.66 in the port's height).
