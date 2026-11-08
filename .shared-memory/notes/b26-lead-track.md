# Batch 26 lead (claude, 2026-11-08)

Five Sonnet tracks in `../wt26-<name>` on `batch26-<name>`, cut from 0c00c80. Each was reviewed and merged --no-ff on `batch26-lead`; per-track notes are `<name>-b26-track.md`.

## Merges
- dd83ab4 playerpose (a2f6106, bbd91ce):
  - Death roll and tint on the player model.
  - The death screen shows the third-person body until deathTime 20.
  - The sleeping head keeps its frozen pose.
  - The sleeper casts a shadow at the bed.
- 5cb682a containerui3 (435199f, 7061e1d):
  - `src/text-field.js` GuiTextField port.
  - Slots, the merchant arrow and beacon icons are drawn into `.container-draw`, with hover from the view hit test.
- 5f85464 negstacks (3789382, 737ef20):
  - Count -128..-1 is kept on load.
  - A held stack of size 0 or less keeps acting and shrinking: 0 becomes -1, and only an exact 0 after the decrement clears it.
  - `Survival.usable` was added and `count()` ignores stacks of size 0 or less.
  - The 88-record `neg-stacks-reference.json`.
- b0e73c5 lighting3 (7b57ce8, 9333a1a):
  - `NativeLight` drives edits, per-tick gap rechecks and window shifts in the streamed Overworld.
  - It is on by default (`NATIVE_LIGHT_DEFAULT`); `?nativeLight=0` or localStorage `blockworld.nativeLight=0` falls back.
  - Nether and End keep the fixed-point path.
- ec4c2ba ringticks2 (661f5ae, b298862):
  - Ring chunks take WorldServer's 3 random ticks per section, plus fire scheduled ticks.
  - A per-block reach guard (leaves 5 native; others conservative) replaces the 8-neighbour guard.
  - `World.chunkAt` miss cache. It is safe because `world.chunks` is only ever replaced whole, by `streamAround`.
- All five merges auto-resolved with no conflicts.

## Verification (batch26-lead ec4c2ba plus the release commit)
- `npm test`: 4614 pass, 0 fail.
- `npm run build`: ok.
- Bridge unittest: OK.
- `git diff --check 0c00c80 HEAD`: clean.
- Muted headless Chrome on vite :5260 (`artifacts/b26-lead/smoke.mjs`):
  - New world playable in 1.29 s; no long tasks in the 20 s after load.
  - Native light on: torch (id 20 in this port, not 50) block light 14, neighbour 13, removal back to 0.
  - The inventory screen draws through `.container-draw .gui-slot`.
  - The bed sleep works.
  - The only console error is the `/favicon.ico` 404.
  - Screenshots: `world-20s.png`, `inventory.png`, `sleep.png`.

## Evidence found while reviewing (for a follow-up)
- In native, relight checks only run on reset chunks.
  - `Chunk.n()` (resetRelightChecks) is called from NetHandlerPlayClient `a(gx)` and `a(gz)`, which handle chunk data and map chunk bulk, and from ChunkProviderHell.
  - `Chunk.o()` (enqueueRelightChecks) is called each tick from `World.a(int,int,apx)` (func_147467_a).
  - So in the native client a dark section left by a single block edit stays dark until that chunk's data is resent. The port's "no relight checks after load" (queued 4096) matches player edits. It does not cover a chunk resend, which happens on edits of 64 or more blocks in one chunk.

## Remaining gaps
- Open gaps carried from the track notes:
  - Picking up Count -1 items.
  - A -1 non-armour item in an armour slot is dropped.
  - FireworksItem and /give refuse Count 0.
  - The `inventory.decr` paths for entities clear stacks of size 0.
  - Native light: edits within 17 blocks of the window ring keep stale light, and the id shadow goes stale after a `world.set` with no `updateBlock`.
  - The Nether and End have no random ticks.
  - Ring edits get no mesh or light until resident.
  - Ring mood sounds are skipped.
- Not pushed to github main. The canonical `game/` (5179) is still at 0c00c80 until the user approves.
