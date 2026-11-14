# Batch 67 lead (claude-b67-lead), release 0.96.0

Ten Sonnet tracks in `../wt67-<name>` on `batch67-<name>`, cut from 0.95.0 (4f1a19470), merged --no-ff on `batch67-lead`. Rules: `../artifacts/b67-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b67-track.md` each): boatstand b517cf823, pistons4 9a3a1de27, bonemeal3 04ee6ca95, entityprobes2 4fe7d0645, sieges 44310d593, catalogues2 684728ea3, mpsleep2 73b78a038, mpvehiclehits 2df6c457d, serverchunks 9b6b73af1, mpsummon 7bdb5eb57.

Conflicts and joins:
- pistons4 after boatstand: `entities.js` `collisionBoxes` adds both, the world entity boxes (boats) first, then the moving piston boxes: `if (worldEntityBoxes && e) out.push(...worldEntityBoxes(b, e, world)); out.push(...movingBoxes(b, world));`.
- Everything else merged clean.

Lead fix (2d43462a5): catalogue generator rows brought past the merged tracks: the Village structure and Zombie rows describe the ported siege state machine (no zombies natively, executed), `/summon` leaves the "not on the server" comment (it is in SERVER_COMMANDS), the Silverfish row records blast release, the VillagerGolem row records copy dust and the native lack of snowball knockback. Catalogues regenerated; catalogue tests 6/6.

Lead decisions:
- End island tails stay at the 256 window (user decision pending).
- serverchunks' radius 10 kept over the brief's 7: `mt.p()` returns the configured view distance, default 10 (bytecode-read in the track).

Verification on the merged tree (after the catalogue fix): `npm test` 7888/7888 (`../artifacts/b67-lead/npm-test.log`), `npm run build` ok, bridge 5/5. Targeted after each merge: boat and vehicle files, piston files, bone meal joins, entity list replays, villages and sieges, catalogues, sleep, lightning and golems, mpnether3-b63 9/9 (201 s, slow before too), then mpsummon + servercommands + mpspawners2 + mpstats3 + sieges 50/50. No second full run (one full run per change).

Open: see "Still open from batch 67" in `public/research/remaining-gaps.md`.
