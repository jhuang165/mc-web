# console88 (batch 88): dedicated server saving under /save-off, the stop sequence and native /netstat byte counts

## Summary
- Saving under /save-off: the timer save and the shutdown save now always write the player data. A world whose `levelSaving` flag is set keeps the part already in the save file. Before this, the timer skipped the whole save.
  - `src/multiplayer/server-save.js`: `planSave(sim, { force })` returns `{ data }` when every world saves (or `force`), else `{ compose(previous) }`. The snapshot is taken now, in tick order. `composeSave` takes the Overworld part (everything but `players`, `admin`, `dimensions`), `dimensions.nether` and `dimensions.end` from the previous file for worlds with saving off; `players` and `admin` are always current. With no earlier file, an unsaved world is absent.
  - `server.js` `save({ force })`: the compose path reads the existing data file (ENOENT or SyntaxError = no previous file); the atomic write is unchanged. `host.save` (/save-all) passes `force: true`; the timer always calls `save()`.
- /save-all under /save-off saves everything: `bh` clears each world's flag around `mt.a(true, null)` and restores it. `/save-all flush` DOES exist in 1.7.10 (case-sensitive `flush`: `commands.save.flushStart`, `mt.m()` per world, `commands.save.flushEnd`). The lang file has no text for those keys, so the raw keys show. The port already replays those rows (b84/b87); this corrects the premise that flush is later-only.
- /stop follows `MinecraftServer.o()`: log "Stopping server", the listener closes, "Saving players", the players are saved, every client is closed with 1008 "Server closed" (the S40 of `oi.u()`), then a wait up to `kickGraceMs` (1000) before stragglers are terminated, "Saving worlds", one "Saving chunks for level '<level-name>'/<Overworld|Nether|The End>" line per world (logged even with saving off, as `a(false)` does), the save (no longer skipped under save-off), the accounts. `levelName` comes from `server.properties` `level-name` (default `world`); the logger is the new `log` option.
- /netstat bytes: `src/multiplayer/net-packet-ids.js` adds `readPacketBytes(m)` and `writePacketBytes(m)`. They estimate the native frame the encoder `fa` / decoder `ez` counts: the id VarInt plus the payload (no length prefix, no compression in 1.7.10). Fixed sizes come from the executed `PLAY_FRAME` table. Variable fields use `varIntSize`/`stringSize` (UTF-8 length VarInt plus bytes), Gson-escaped chat JSON, item slots (7 bytes, 2 when empty), S22 (15 + 4n), S23 (11 + VarInt(id)), S13 (2 + 4n), chunk columns (8 + 12 per column plus a run-count proxy for the deflated data; unload = 18 + 12 biome bytes). The wire format is unchanged; each message is still one record under its b87 id. Cost: arithmetic over fields already in hand, no serialisation.
- /save-on and /save-off messages and the admin notices were already executed and replayed at 0 differences (b84, b86, b87). The new test asserts those rows directly: the sender gets "Turned off world auto-saving", the log "[Alex: ...]", ops of a console command "[Server: ...]".
- `tools/build-surface-catalogue.mjs` netstat note updated; `public/research/command-parity-catalogue.md` regenerated (only that row changed). Dated correction appended to `public/research/commands.md`.

## Evidence
- Executed: `tools/probes/Console88Probe.java` through `tools/verify-console88.mjs` on the unchanged 1.7.10 jar (netty 4.0.10 on `MC_PROBE_LIBS`), writing `public/research/console88-reference.json`: 99 packet classes over every state and direction written empty (S01PacketEncryptionRequest not writable empty: NPE on the null key), and 19 samples (S02 chat.type.text 56, S02 text 9, S40 "Server closed" 17, S29 random.click 31, S2A flame 39, S13 three ids 14, S3A 14, S38 9, S30 three empty 10, S30 stone + empty 13, S2F stone x64 11, S22 three records 27, S2D chest 21, S0E data 1 27, S0F empty watcher 25, S37 one stat 18, S01 default 17, S07 default 15, S21 unload 30). Also executed earlier (Dedicated84Probe, b84/b87 rows): /save-all, /save-all flush, /save-off, /save-on and the partial saving rows, the admin notices.
- Bytecode-read (`javap -c -p`): MinecraftServer `u()` (900-tick `oi.j()` then `a(true)`), `o()` (stop order), `a(boolean)` (per-world lines, `mt.a`), `r()`; `oi.j()`, `oi.u()` ("Server closed"), `oi.b(mw)`; `mt.a(boolean, qk)` returning unless `ms.e()`, `mt.n()`, `mt.m()`; `bh`, `bi`, `bj`, `bt`; `fa`/`ez` recording (id, readableBytes) in `eu`; the write layouts of the sampled packets; `aqo.l()` dimension names; `Deflater(-1)` in `gx`.
- Port-read: one save file for every world; JSON WebSocket messages, several native packets per message in places (`tick` under S18, bundled `mobs`, `blocks`).

## Verification
- `node --test --test-timeout=600000 src/console88-b88.test.js`: 9/9 pass.
- Neighbours, 164/164 pass: offline87, console86, dedicated-cmds-b84, mpadmin-b68, mpadmin71, accounts, multiplayer, mpping, mpstate-b59, pvp-b63, multiplayer-refusal, mpsurvival-b58, serverprops-b69, serverprops2-b70.
- Neighbours, 142/142 pass: client-screens, mpbooks, mpclicks, mpcontainers, mpmisc74, mpnether, mpplayerfx75, mpsettings72, mptabcomplete, mpstations, mptrade, mptrackers71, mpstream72, sptab-b70, skins73, catalogue-consistency, catalogue79.
- No old test encoded the fixed gaps. Full `npm test` not run (track rules). No browser checks.

## Follow-ups
- The autosave interval is still the port's `saveMs` (10 s), not 900 ticks.
- Chunk data size is a run-count proxy, not a real deflate; item NBT tags are not counted.
- `tick` counts once under S18 (standing for S15-S17 too); bundled messages still count once.
- The stop kick is a WebSocket close reason, so it does not appear as an S40 record in /netstat.
- Per-world partial saving is only reachable through the probes' rows (the port's commands set every flag).
- Browser-only: how the client shows the "Server closed" disconnect screen after /stop.
