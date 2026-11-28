# abilities102 (batch 102): gameMode.changed from S2B, adventure audit, client creative flag

## Summary
- `src/commands.js` `/gamemode`: skips the target chat line when `host.clientPrintsGameMode` is set. `src/server-broadcast.js` `playerOps` sets it (dedicated server, also inherited by the redirected sub-host). `src/player-op.js`: the `setGameMode` playerOp (S2B reason 3) now prints `gameMode.changed` on the target client. Net: /netstat no longer counts an extra S02; the sender's success.self/other lines (flag 1, ops get chat.type.admin) are unchanged. Single player is unchanged (prints locally).
- `src/ability-flags.js` `isCreativeMode`; `src/main.js` (shared, code-read only, 3 edits): middle-click pick uses the S39 creative flag (the C10 creativePick condition and `inventory.pick`).
- Test `src/abilities102-b102.test.js` (4 tests). Edited `src/cmdblock83-b83.test.js` (2 asserts): it expected a chat line `gameMode.changed`, which is the non-native server behaviour; now expects the S2B playerOp and no chat.

## Evidence
- Bytecode-read `ar` (CommandGameMode): after `yz.a(ahk)` it only calls `a(ac,aa,1,"commands.gamemode.success.self/other",...)`; it names `gameMode.` + mode as the argument, and sends no `gameMode.changed`.
- Bytecode-read `gv` (S2B): static `a = [tile.bed.notValid, null, null, gameMode.changed]`; client `bjb.a(gv)` prints `gv.a[reason]` through `yz.b(fr)` (target only) for any reason with a non-null entry, then for reason 3 calls `bje.a(ahk.a(value))`. So the TARGET alone sees it, from S2B, no S02.
- Bytecode-read `yw` (PlayerCapabilities) client reads of `isCreativeMode` (d): only `bao.ao()` (middle-click pick: the flag decides whether the picked stack is placed in the hotbar) and `bao.Y()`; `yz.q(sa)`, `zs.a(III yz)` are common/server paths. `allowEdit` (e) is read only by `yz.a(IIIIadd)` and `yz.d(III)`.
- Item 2, already native (batch 78 note `mpadventure78-b78.test.js`, `adventure.js`): `isCurrentToolAdventureModeExempt` gates dig in `player-edit-simulation.js` (server and shared client path via `mayHit` in main.js 4011); canPlayerEdit is true with any held item (1.7.10 has no CanPlaceOn tag), so placing is allowed. Port-read; I added no change.

## Verification
- `node --test --test-concurrency=2 src/abilities102-b102.test.js src/cmdblock83-b83.test.js src/cmd-args-b82.test.js src/abilities101-b101.test.js src/adventure.test.js`: 22 pass. Plus abilities100/101/102: 13 pass.
- Fails without the fix: `commands.js` reverted: 1 of 3 (then) fails.
- Not run: full suite, build (main.js import is from an existing module).

## Follow-ups
- Not browser-checked: the chat line on the target after /gamemode, middle-click with flags differing from the mode.
- `bao.Y()` creative read not identified; the creative inventory and item-use rules still follow the game mode on the client.
