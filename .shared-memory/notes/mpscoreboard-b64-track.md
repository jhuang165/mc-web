# Batch 64 mpscoreboard: scoreboards and teams on the dedicated server

## Summary
- `src/multiplayer/server-scoreboard.js` (new): `ServerScoreboard extends Scoreboard`, built as `sim.scoreboard`. One shared board saved with the world (`scoreboard` field, `scoreboardToJSON`, omitted when empty). It queues the 1.7.10 packets (`take()`), sends objective, score and display packets only while an objective is in a display slot, sends team packets always, sends a score only when its value changed. Criteria hooks: `statIncrement(name, statId)` (stat.*, deathCount, totalKillCount, playerKillCount), `achievement(name, id)`, `tickHealth(p)` (health = ceil(health + absorption) on change, restarts after a respawn), `teamAllowsAttack(attacker, victim)`, `joinPackets()`.
- `src/multiplayer/client-scoreboard.js` (new): `applyScoreboardMessage(board, msg)` applies the packets to a replica `Scoreboard` (all objectives dummy, as S3B carries no criteria).
- `src/multiplayer/remote-labels.js` (new): the other player's name tag with team colour codes and the belowName row (`<score> <display name>`).
- Wire message `{ type: 'sb', packets: [{k:'obj'|'score'|'display'|'team', ...}] }` (S3B, S3C, S3D, S3E). No other new messages.
- Hooks (short, commented `b64 mpscoreboard`): `simulation.js` (build, save, `allows(from, victim)`), `server-pvp.js` (`allows(from, victim)` adds the team check; `fromOf` carries `formattedName`), `server-stats.js` (`onIncrement` calls the board), `server-survival.js` (death message with the formatted name), `server-broadcast.js` (`scoreboard` in SERVER_COMMANDS, `host.scoreboard`, flush after a command and each drain, per-player achievement and health hooks, team-formatted chat, death and achievement names, `scoreboardJoin`), `server/server.js` (`social.scoreboardJoin(id)` after the welcome), `client.js` (buffer and apply `sb`, `onScoreboard`), `presence.js` (`board` option, redraw on board revision), `main.js` (`mpBoard` replica used for the sidebar and the Tab list in multiplayer, reset on join and leave), `scoreboard-live.js` (SidebarUi resets when the board object changes).
- `src/mpscoreboard-b64.test.js`: 11 tests.

## Evidence
- Bytecode-read (javap, 1.7.10 jar): `lp` (ServerScoreboard) overrides and which packets they send (S3C only for a tracked objective, `a(String)` always; S3B update / remove only when tracked; S3D rules in `a(int, azx)`; `d`/`e`/`f`/`g` show and hide; team hooks always, one S3E per setter); packet layouts `ic`, `ie`, `hv`, `id` (name 16, display 32, flags from `azy.i()`: bit 0 friendlyFire, bit 1 seeFriendlyInvisibles); client handlers `bjb.a(ic/ie/hv/id)`; `azz.c(int)` notifies only on a changed value; `mw.a(yz)` (pvp off refuses) calling `yz.a(yz)` (no team true, other team true, else friendlyFire).
- Executed: the underlying Scoreboard, commands, criteria list and save format are the b13 probe results (`public/research/scoreboard-reference.json`). No new Java probe: `lp` needs a live MinecraftServer and player list, so the packet order is bytecode-read only.
- Recalled (not executed): the name tag in 1.7.10 draws team-formatted names and the belowName line only within 10 blocks (`RenderPlayer.func_96449_a`); here both always show.

## Verification
- `node --test src/mpscoreboard-b64.test.js`: 11 pass.
- Related files (mpcommands2-b60, mpstate-b59, pvp-b63, mpstats-b63, scoreboard): 71 pass with the new test. 22 more files that import the touched modules (accounts, serverbroadcast-b58, servercommands-b59, multiplayer, team-names, chat names, containers, nether, end, vehicles ...): 154 pass.
- `node --check` on every touched file; `main.js` identifiers `mpBoard`, `createClientScoreboard`, `applyScoreboardMessage`, `multiplayer` are declared at module scope before use in functions. `npm run build`: ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Only a browser shows: the sidebar and Tab list scores in multiplayer, the coloured name tag with two rows and its texture size.
- `seeFriendlyInvisibles` is stored, saved and sent but nothing uses it: remote players have no invisibility rendering yet.
- Below-name distance limit (10 blocks) and the shadowed font of the native name tag are not copied.
- No S3C-style score line for the sneaking case (native shows it lower when sneaking).
- Team colour does not tint a player's tab-list name beyond the prefix/suffix codes (that is native behaviour too); the sidebar uses `formatName` as in single player.
- `@a` / `@p` style selectors in `/scoreboard` use whatever the server command host supports; not separately tested.
- Wolves and other tamed mobs do not check the owner's team (1.7.10 has no such rule; recalled).
