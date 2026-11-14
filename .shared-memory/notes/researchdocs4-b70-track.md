# researchdocs4 (batch 70) - docs sweep, second half

## Summary
Took the "Claims left open" list of researchdocs3-b69-track.md and checked each gap claim against the live caller. 26 docs got a dated "Batch 70 (docs sweep, 2026-11-14)" line; old text stays as history. Only docs and this note changed. Native dragon egg question settled by bytecode: no code change.

Dragon egg: native `xa.aF` (EntityDragon.onDeathUpdate) calls `b(II)V` once at deathTicks == 200; that ends with an unconditional `setBlock(x, y+4, z, ajn.bt)` (dragon egg 122), no branch skips it on later kills. The `dragon.md` "second kill not modelled" claim was wrong; `exit-portal.js` is correct.

Docs touched: dragon, stone-utility-blocks, player-step, redstone-blocks-2, shaped-blocks, redstone-live (2), region-import, sheep, zombie-villager, xp-orbs, mob-steps, slime (2), mob-gear-nbt, squid-bat, polish, models, signs, potions (2), sprinting (2), ocelots, plants, third-person (2), villager-trading, villager-trading-live, villager-offers, wither-boss.

## Evidence
- bytecode-read (1.7.10 jar): EntityDragon `xa` egg placement; RenderSheep `boq` jeb_ rainbow; EntitySlime `ym` split loop has no count cap; EntityAnimal `wf` never despawns.
- executed: `enchantedBreakDrops` for double wood slab with Silk Touch (one slab, no xp); glowstone with Fortune III returned null.
- code-read (callers grepped): eye-of-ender(-live), potion-use, player-physics/entity-collision, population-content recipes, nether-generator quartz, redstone-runtime trapped chest, region-export (ticks, biomes, leashes), zombie-villager BED, server-items tickOrbs, mob-steps, spawn-eggs, mob-spawner, projectile-renderer, player-renderer, falling, shadows, server-trade, wither-boss tests.
- recalled: fence step-sound render types (11, 32, 21), RenderSlime/RenderFallingBlock shadow sizes, ItemPotion flat sprite.

## Verification
- `node --test src/catalogue-consistency.test.js src/content-catalogue.test.js` and `npm run build`: 6/6 pass, 0 fail; build ok (5.65s).
- Full npm test not run (batch rule).
- Nothing was checked in a browser (no browser checks allowed). Only a browser would show: the baby zombie head scale, third-person item placement vs native, and the signs editor layout.

## Follow-ups (real code gaps, with evidence)
1. `jeb_` rainbow sheep: no `jeb` in `src/`; native boq blends fleece colours by tick. Render only.
2. Fence/wall/gate step sound: `mobStepEvents` (`src/mob-steps.js` ~77) returns silence when floor(y-0.2) is air, no look below.
3. Weakness does not reduce mob damage: `attackDamage` in `src/mob-effects.js` reads Strength only.
4. Slime split cap: `src/entities.js` ~2675 stops at 40 entities; native has none.
5. Spawners for Squid and Bat (and, from the earlier analysis, MagmaCube and Villager) missing in `SPAWNER_ENTITY_IDS` (`src/mob-spawner.js`).
6. No shadows for slime, magma cube, falling block (`src/shadows.js` `SHADOWS`).
7. Skull in a mob's helmet slot not drawn; SkullOwner skins not rendered.
8. No GuiIngame vignette; no stem darkness pop.
9. Legacy default hands: bare skeleton gets a bow and pigman a golden sword (`DEFAULT_HELD`, `src/mob-equipment-live.js`).
10. Fortune on glowstone: `enchantedBreakDrops` returns null, unresolved/not verified.
11. XP orb multi-player: nearest target re-picked every tick, native keeps first target within 8 blocks.
Not reached in depth (no gap claim found or skimmed only): mob-riding, music, streaming, structure-*, superflat, trees, wood-types, spiders, stairs, resource-packs, post-shaders, projectile-nbt, potion-fx, note-jukebox, pig-saddle, portal-particles, modal-dialogs, void-fog, parity-roadmap, stems-cake, render-settings.
