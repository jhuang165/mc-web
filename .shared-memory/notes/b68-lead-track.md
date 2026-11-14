# Batch 68 lead (claude-b68-lead), release 0.97.0

Ten Sonnet tracks in `../wt68-<name>` on `batch68-<name>`, cut from 0.96.0 (979178105), merged --no-ff on `batch68-lead`. Rules: `../artifacts/b68-lead/track-rules.md`. No browser checks (user request).

Merged (track note `<name>-b68-track.md` each): researchdocs cd521e02b, summon2 40c10bde5, fixes68 cccd71441, mpadmin 9e7f30f66, mpping 8a814a893, projectiles3 a89138639, chunkscan2 4238a4ab9, pistons5 7ebc2ce4c, mppaintings 710760a8d, mpworldcmds 0232723de.

Conflicts and joins:
- mpping after mpadmin, `server/server.js`: both option sets kept in `createDedicatedServer` (`motd`, `favicon`, `adminOptions`, `onStop`) and in the CLI call (`--motd` beside the admin env options); the close path runs `pings.leave(id)` and then mpadmin's cleanup with `ips.delete(id)`; the tick runs mpadmin's idle kick and then `pings.tick()`. The pre-login status hook sits before the join branch, mpadmin's refusal after `accounts.authenticate`.
- mppaintings after summon2, `server-summon.js`: summon2's native coordinates, helpers and `SUMMON_HOSTS` kept; `UNKEPT_ENTITIES` empty (mppaintings); mppaintings sets `hanging` on the hosts directly. summon2's test that expected the hanging kinds refused now expects them kept. `tools/build-content-catalogue.mjs`: mppaintings' Painting and LeashKnot rows with researchdocs' Arrow row; catalogues regenerated.
- fixes68 and summon2 both touched `server-mobs.js` (auto-merged); chunkscan2 and mpworldcmds auto-merged in `simulation.js`.

Lead fix (ad70cade5): researchdocs reported the jack-o'-lantern golem build as a real bug. It is not: the live path `tryBuildGolem` (`mooshroom-golem-live.js`, called by `main.js` and `server-golems.js`) accepts both heads; only the old `EntityWorld.tryBuildIronGolem` helper (used by `village-live.test.js` alone) tests the plain pumpkin. `iron-golem.md` and the track note corrected.

Lead decisions:
- End island tails stay at the 256 window (user decision pending); generation 9 server worlds still have no villages.

Test fix after the full run (test file only, e4dffe702): `player-throw-replay.test.js` compiles main.js's `edit` with its own bindings; fixes68's `worldRand: weather.random` in the edit state needed a `weather` binding there (`weather` is module scope in main.js, so the game was not affected). The file passes 2/2 after the fix.

Verification on the merged tree: `npm test` 8013/8014 (`../artifacts/b68-lead/npm-test.log`), the one failure the replay test above; `npm run build` ok; bridge 5/5. Targeted after the merges: summon 23, fixes68 joins 28, admin joins 34, mpping + admin + multiplayer + handlers 48, projectiles 81, chunks + weather + farming 62, pistons 25, paintings + summon + dispense + catalogues 103, commands + catalogues 94. No second full run (one full run per change).

Open: see "Still open from batch 68" in `public/research/remaining-gaps.md`.
