# abilities100 (batch 100): S39PacketPlayerAbilities on the dedicated server

## Summary
- New `src/multiplayer/abilities.js`: `abilitiesMessage(p)` (flags from the game type, the player's own fly/walk speeds, raw walkSpeed), `abilitySpeedsOf`, `abilityRecordFields`, `clientModeOf`.
- `src/multiplayer/simulation.js`: `abilitiesOf(p)`. `server/server.js`: the welcome carries `abilities`. `server-dimensions.js`: the `dimRespawn` carries `abilities` (the relaunch keeps the speeds; it is not counted as an S39, a portal trip sends none).
- `server-survival.js` `respawn` and `server-end.js` `finishCredits` queue an `abilities` message in `p.dimOut` (before the `dimRespawn` that may follow), as natively.
- `client.js`: `abilities` is buffered in order and applied through `onAbilities`. `main.js` (shared; code-read only): imports; the join and dimension records carry `abilitySpeeds` (launch already calls `setAbilitySpeeds(record.abilitySpeeds)`) and the player's own game mode; `client.onAbilities` sets the speeds and drops flying unless allowed; `leaveMultiplayer` resets the speeds to the defaults.
- `net-packet-ids.js`: `abilities: 57`, 10 bytes; the welcome counts S01 then S39.
- Test `src/abilities100-b100.test.js` (5 tests).

## Evidence
- Bytecode-read (`hk`, `oi`, `mx`, `mw`, `bjb`, `ahk`): S39 = id 57 (offline87 reference), flags byte (1 invulnerable, 2 flying, 4 allowFlying, 8 creative), flySpeed float, walkSpeed float: 1+1+4+4 = 10 bytes, matching the executed base row `PLAY_FRAME.clientbound[57] = 10`.
- Sent at: `oi.a(ej, mw)` join (after S05, before S09); `mw.q()` (updateCapabilities), whose only caller is `mx.a(ahk)` (setGameType: /gamemode, and `oi.a(mw, mw, ahb)` at respawn, where the new player's connection `mw.a` is already set so S39 precedes the S07; at join and NBT load `mw.a` is still null so `q()` returns). `oi.a(mw, int)` (portal trip) sends no S39. `ahk.a(yw)`: creative sets allowFlying, creative, invulnerable; others clear them and flying.
- Client `bjb.a(hk)`: copies flying, creative, invulnerable, allowFlying, flySpeed, walkSpeed.
- Port-read: /netstat did not count an S39 anywhere; now counted at join and at each respawn message. The port has no runtime game-mode change on the dedicated server (no `/gamemode` mutation of a player's mode), so that S39 point does not exist yet.

## Verification
- `node --test --test-concurrency=2 src/abilities100-b100.test.js`: 5 pass.
- Related run over the 51 test files naming the edited modules (net-packet-ids, client.js, server.js, server-end/dimensions/survival, entnbt99): 415 tests, 412 pass, 3 fail, all old semantics: `console88-b88` (welcome bytes now S01 + S39, +10), `console89-b89` (welcome records now [1, 57, 38, 38]), `offline87-b87` (the class map needed `abilities: S39PacketPlayerAbilities`). Those three edited and rerun with the new test: 32 pass, 0 fail. Edited because the old expectations encoded a join without S39, which is not native.
- Fails-without-the-fix: not checked by reverting; the new module and `abilitiesOf` do not exist on unchanged code.
- `npm run build`: run once, ok.

## Found wrong in the batch 99 list
- Not a list error, but found: the client record's mode was `snapshot.gameMode` (the server default), so a loaded creative or adventure player started in the server's mode on the client; now the player's own mode.

## Follow-ups
- The client keeps its flying/creative state from its own mode; the S39 flags (invulnerable, creative, allowFlying) are not stored separately on the client. Only `flying` is cleared. Differs from native, where the flags are copied.
- The port has no Overworld respawn S07 count (not in scope), and no server-side `/gamemode` on a connected player: when it exists it must queue an `abilities` message.
- Browser-only (not viewed): prediction with non-default speeds on a dedicated server; adventure mode on the client.
