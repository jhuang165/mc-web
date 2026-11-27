# abilities101 (batch 101): client takes S39 verbatim, /gamemode sends S39 + S2B

## Summary
- New `src/ability-flags.js`: the multiplayer client's capabilities (disableDamage, flying, allowFlying, creative) from the last S39; `null` (single player / no S39) keeps the game-mode rule. `allowsFlight`, `disablesDamage` helpers.
- `src/survival.js` (`damage`, `anvilDamage`: `disablesDamage`) and `src/player-physics.js` (`toggleFlight`: `allowsFlight`) read the flags. `src/multiplayer/abilities.js` `abilityRecordFields` stores the welcome / dimRespawn S39 flags.
- `src/main.js` (shared; code-read only): `client.onAbilities` stores the flags and sets `flying = a.flying` (was: cleared unless allowFlying && flying); touch-fly button uses `allowsFlight`; `leaveMultiplayer` clears the flags; one import.
- `/gamemode` on the dedicated server already existed (`server-broadcast.js` playerOps, op level 2 from COMMAND_LIST; test `/gamemode needs operator level 2`) but sent no S39: `setGameMode` now delivers `abilities` first, then the `playerOp setGameMode`.
- `net-packet-ids.js`: `playerOp` with op `setGameMode` is counted as S2B (43, reason 3) instead of S1F; the `abilities` message is S39 (already counted).
- Test `src/abilities101-b101.test.js` (4 tests).

## Evidence
- Bytecode-read `bjb.a(hk)`: copies flags verbatim (see abilities100 note). `ar` (CommandGameMode): `yz.a(ahk)` = `mw.a(ahk)`: `mx.a(ahk)` (setGameType; its `q()` sends S39 when the connection exists) then `nh.a(new gv(3, mode id))` = S39 then S2B reason 3. `gv` carries the key "gameMode.changed" (the client prints it from the S2B, so natively no S02 follows).
- Permission level 2: COMMAND_LIST `gamemode` permission 2 (existing).

## Verification
- `node --test --test-concurrency=2 src/abilities101-b101.test.js`: 4 pass; with `server-broadcast.js` reverted 3 pass, 1 fail (S39 before S2B).
- Related run, 55 files naming net-packet-ids / server-broadcast / abilities / playerOp / setGameMode / player-physics: 493 tests, 492 pass, 1 fail (`cmd-exec-b83` /summon Spider air), which passes alone (4/4): flake.
- `npm run build`: ok (once, no errors shown).

## Follow-ups
- Item 3 (adventure on the MP client) not started.
- Port still sends a separate chat S02 "gameMode.changed" to the target via targetPrint (native: the client prints it from S2B 3); counts one extra S02 in /netstat.
- The client's S39 `creative` flag is stored but nothing else reads it; flySpeed/walkSpeed were already applied.
- Browser-only (not viewed): flight toggle and damage immunity with flags differing from the mode.
