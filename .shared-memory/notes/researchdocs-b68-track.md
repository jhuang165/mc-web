# Batch 68 researchdocs: stale gap claims in the linked research docs

## Summary
Docs only (no code under `src/`). Each changed claim carries a "Batch 68 (docs sweep)" marker. Generator: `tools/build-content-catalogue.mjs` rows Arrow, EyeOfEnderSignal, Skeleton, Silverfish had "is stale" phrases; reworded, then `public/research/entity-parity-catalogue.md` regenerated.

Claims changed (all evidence by code reading, "recalled/bytecode" not involved):
- `silverfish.md`: sneak/invisible range scaling ported (`ai.js` closestVulnerablePlayer, `detection.test.js`); mobGriefing reads the gamerule (`entities.js` silverfish env); region import converts silverfish (`java-mobs.js` JAVA_SUMMON_MOBS).
- `eye-of-ender.md`: End exists, portal contact travels (`dimension-live.js`); /give, /summon and server eyes (`command-data.js`, `server-eyes.js`).
- `iron-golem.md`: jack-o'-lantern (91) exists now, but `tryBuildIronGolem` (entities.js) tests only PUMPKIN; reworded. Lead correction: not open; the live build path `tryBuildGolem` (mooshroom-golem-live.js) accepts both heads.
- `village.md`: spider legacy AI closed by batch 38 (`legacy-creature.js`, `village-fight-b38.test.js`); the "still diverging" line pointed to the later fixed sections.
- `pathfinding.md`: same spider claim.
- `bows.md`: pointer that crit trails, bubbles, stuck arrows, pickup, Power/Punch/Flame, wither skeletons, server skeletons are in.
- `combat.md`: Looting ported (`enchantment-effects.js`, `combat.js`); creeper record roll drops discs (`DISC_FIRST`).
- `dimensions.md`: pointer that away-run "not ported" lines are superseded by batch 30-46 sections.
- `fire.md`: difficulty setting exists (`difficulty.js`); burning visuals exist (`fire-fx.js`, `display-ticks.js`).
- `weather.md`, `snow.md`: fast graphics ported (`render-settings.test.js`).
- `snow.md`: Silk Touch exists, packed ice and snow golems exist.
- `mob-spawner.md`: SpawnPotentials/SpawnData, wider type list (`SPAWNER_ENTITY_IDS`), Riding chains (`spawner-riding.js`).
- `multiplayer.md`: "Still missing" list marked as first-release state.
- `animations-and-sounds.md`: fluids exist (`fluids.md`).
- `nether.md`: dimension switch exists. `structures.md`, `scattered-features.md`: live generation calls them; structure data save in `structure-data.js`.
- `redstone.md`: piston entity pushing ported (`piston-live.js`, `piston-push.js`).
- `achievements.md`: stats screen and stats file exist.
- `parity.md`: "Systems not yet implemented" list marked historical.

## Evidence
All code reading (grep and module reads in `src/`), plus the batch notes. No probes, no Java, no browser.

## Verification
`node tools/build-content-catalogue.mjs` and `build-surface-catalogue.mjs` run; `node --test src/catalogue-consistency.test.js src/content-catalogue.test.js`: 6 pass, 0 fail. `npm run build` run once. Full npm test not run (batch rule).

## Follow-ups
Left as open or not verified (not edited):
- Only a part of the ~150 linked docs was swept. Not swept: chunks, generation, region-import, particles, loading-screens, streaming, natural-spawning, commands-b13, controls, resource-packs, post-shaders, music, mob-riding, horses and most small mob docs.
- `slime.md`: shadow size 0.25 (`slime.js` has `shadowSize`, but `shadows.js` has no slime entry; unverified), `mob.attack` silent claim (entities.js now emits the sound; audio file presence unchecked), 40-mob save cap (still `entities.length >= 40`).
- `dragon.md` second-kill egg, `inventory-player.md` cape and shadow, `fire.md` flammable block list (FIRE_INFO covers more ids; not compared), `weather.md` bed-through-thunder, `mob-spawner.md` 40-mob cap (still true), `village.md` chicken wander gap (line "Open (probed, not ported)").
- `silverfish.md` 40-mob save cap: still `entities.length >= 40` in entities.js, so left.
- (Lead correction) Not a bug: the live golem build `tryBuildGolem` accepts the jack-o'-lantern; only the unused `tryBuildIronGolem` helper tests the pumpkin alone.
