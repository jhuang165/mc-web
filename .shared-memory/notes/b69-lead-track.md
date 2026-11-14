# Batch 69 lead (claude-b69-lead), release 0.98.0

Ten Sonnet tracks in `../wt69-<name>` on `batch69-<name>`, cut from 0.97.0 (7ec8361fe), merged --no-ff on `batch69-lead`. Rules: `../artifacts/b69-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b69-track.md` each): catalogues3 e93b3a622, spawnreplays cadb648e1, researchdocs3 786ab6c86, researchdocs2 d4b45a7e8, mpfixes69 62d549138, spfarming ba69e71c8, mptabcomplete 73c13c9ea, mpmaps 961c1fde1, projectiles4 56dec07a9, serverprops 5bc740471.

Conflicts and joins:
- serverprops after mpfixes69, `src/multiplayer/simulation.js` `aimCell` and `edit`: mpfixes69's `serverPosY(p.position.y, p.sleeping)` reach origin kept with serverprops' `limit: this.rules.maxBuildHeight` in both `serverClick` calls. The save line auto-merged (mpmaps' `maps.saveField()`, serverprops' `hardcore` and `generateStructures`).
- projectiles4 after the lead fix, `tools/build-content-catalogue.mjs`: the lead's Painting row kept, projectiles4's Arrow, Snowball and Fireball rows taken; catalogues regenerated.
- mptabcomplete, mpmaps, spfarming, mpfixes69 and projectiles4 all auto-merged in `src/main.js`; mptabcomplete and serverprops auto-merged in `server/server.js`.

Lead fix (33e571d54): the Painting and ItemFrame catalogue rows still said pistons do not push them and frames hold no maps on the server; both closed this batch (mpfixes69, mpmaps).

Checked, left open: researchdocs2's chicken breeding gap is real in code (`BREED_ITEM.chicken = 309`, single player and `animal-use.js`); 1.7.10 is believed to take any `ItemSeeds` (pumpkin 361, melon 362, nether wart 386 in this port's ids) for breeding while the tempt task stays on wheat seeds. Not changed without a bytecode read; carried in remaining-gaps.

Behaviour note: a fresh dedicated server now writes `server.properties` with native defaults (20 players, Easy, spawn protection 16). The ledoge0 gun arena is not redeployed by this release; check its config before the next deploy.

Lead decisions: End island tails stay at the 256 window (user decision pending); generation 9 server worlds still have no villages.

Test fixes after the full run (test files only, bbc653214):
- `pvp-b63.test.js` grepped server.js for `argument('--pvp'`; since serverprops `--pvp` and `MC_WEB_PVP` reach the server through `overridesFrom` and `settings.pvp`. The test now checks those.
- `mpgolems-b66.test.js` (Creative monster egg) and `mpnether2-b62.test.js` (punched fireball kills a ghast) were already flaky on 0.97.0 (3/8 and 1/6 runs failed in `../wt68-lead`): each mob's Entity.rand is seeded from Math.random, so the silverfish could hide in stone on its first tick and the ghast could drift off the ball's line. The silverfish test counts released = (puffs + left) / 2; the ghast is held in place. 0/8 failures each after the fix.

Verification on the merged tree: `npm test` 8138/8141 (`../artifacts/b69-lead/npm-test.log`), the three failures above, each file passing after the test fixes; `npm run build` ok; bridge unittest ok. No browser checks.
