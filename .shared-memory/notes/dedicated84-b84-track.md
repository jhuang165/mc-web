# dedicated84 (batch 84): the dedicated-server-only commands, executed

## Summary

- `tools/probes/Dedicated84Probe.java` runs the real `bl` (ServerCommandManager) and the dedicated command classes with real `oi` lists (ops, bans, IP bans, whitelist) and a real `ns` profile cache. The DedicatedServer, its player list and the worlds are doubles. It records chat (formatted and plain), exceptions and state per sender (Alex op 4, Steve non-op, Eve op 2) and per setup (base, lists, offline, saveoff, partial): 645 rows, 0 crashes, plus 64 tab rows.
- `tools/verify-dedicated-cmds.mjs` regenerates `public/research/dedicated-cmds-reference.json`. `src/dedicated-cmds-b84.test.js` replays it (16 groups).
- Port fixes: the profile cache learns a directory hit; ban-ip, pardon-ip use `length() > 1`; `whitelist list` second count is the saved-player count (`oi.q`, via `admin.savedCount` set in `simulation.js`); `/list` is op-only (`server-broadcast.js`); `save-all flush` prints the two raw keys; `netstat` answers its refusal line.
- Old tests that encoded gaps and were updated: `servercommands-b59.test.js` (non-op `/list`), `mpadmin-b68.test.js` (out-of-N-seen count).
- Probe polarity bug found and fixed along the way: `mt.c` is levelSaving = saving disabled.

## Evidence

- executed (probe): every row above. bytecode-read: the length checks, `oi.q`, `Entity.f` keys.
- recalled, not executed: the lists' lanServer flag, max players 20, `server.properties` writes, whitelist reload and file loading.
- /summon tags (bytecode-read, `sa.f`): `Dimension` is read into the entity's dimension field `ap`, and `Invulnerable` into `i`, which the damage check `sa.a(ro, F)` reads first. The port reports both as ignored.

## Verification

- `node --test --test-timeout=600000 src/dedicated-cmds-b84.test.js`: 16 pass, 0 fail.
- Neighbours: mpadmin-b68 10/0, mptabcomplete-b69 15/0, sptab-b70 6/0, serverbroadcast-b58 10/0, servercommands-b59 11/0, mpadmin71-b71 7/0, mpplayerfx75-b75 9/0, cmd-exec-b83 4/0.

## Follow-ups

- The 64 tab rows are recorded but not replayed.
- Console sender rows, offline-mode lookup and the per-world `partial` saving setup are skipped (the port has one world save and no console).
- Honour `Invulnerable` on /summon (needs `command-host.js`/`entity-summon.js`); `Dimension` has no visible effect to port.
- Admin notices to other ops are not gated by command level beyond what the rows exercise.
