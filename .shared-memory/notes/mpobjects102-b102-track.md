# mpobjects102 (batch 102): S19 status order, ghost-item player trigger confirmed native, painting / item-frame tracker cadence

Branch `batch102-mpobjects102`. Target 1.7.10; no claim of full parity.

## Summary
- **`src/entities.js`** (shared, small): `nextStatusSeq()`; a fresh hit's hurt / death client sound (the source of S19 2 / 3) carries `seq` (only when the dedicated server's `mobStatus` hook exists).
- **`src/multiplayer/server-mobs.js`** (shared): `status()` and `noteStatus()` stamp `seq`; `track()` sorts the tick's statuses by `seq` before sending, so S19 leave in the order `World.setEntityState` ran. Before, every 2 / 3 was queued at the end of the tick, after every other status (a player's hit on a golem sent its 4 before the hit's 2).
- **`src/village-ai.js`** (shared, 1 line): `golemStrike` sends status 4 itself, before the target's `attackEntityFrom`. **`src/multiplayer/server-golems.js`**: the after-tick attackTimer diff stays only for a bare attackTimer set (the old b66 test); it skips a golem whose `golemStrike` already sent the 4 (`golemStruck`).
- **`src/multiplayer/server-hanging.js`** + **`server-chunk-view.js`** (`'hanging'` fresh consumer): paintings, item frames and knots were range-tested for every player every tick. Now a key is range-tested only when the player's own entry re-lists (first view, moved over 4 blocks, column sent) or the entity is new to the view; a tracked key stays tracked until a re-list. Record changes (frame item or rotation) still resend.
- **`src/mpobjects102-b102.test.js`** (4 tests).

## Evidence
- Item 1, Bytecode-read: `sv.a(ro,F)` (attackEntityFrom) calls `b(sv)` (setRevengeTarget, villager 13) at offset 233 and `ahb.a(sa,B)` (status 2) at 306: 13 before 2 inside the entity, as the port already had (13 is queued during the hit, the 2 at tick end). `wt.n(sa)` (golem attack): `ahb.a(this,4)` at 12, then `sa.a(ro,F)` at 33: 4 before the target's 2. Wolf taming 6 / 7 has no hurt status on the same event (Port-read). The real divergence was the global order of 2 / 3 against other statuses; fixed by sequence stamps.
- Item 2, Bytecode-read (`mn.a()` and `my.a(List)`): `n` is cleared at the top of `my.a(List)`; the list runs only when `t` is false (first pass) or the entity moved over 4 blocks, and sets `t` and `n` and the baseline at that time. `mn.a()` first runs every entry's list pass, then calls `my.b(player)` on every entry for each player whose `n` is set. So the player's own entry runs once per tick with the tick's position and a join always lists on its first pass: the b101 port model is native. No change. Not re-executed (the b101 executed `cadence` record covers `my.a` / `my.b`).
- Item 3: dropped items and XP orbs (`server-object-tracker.js`), arrows and thrown (`thrown-tracks.js`, b86), minecarts and boats (`server-vehicles.js` `relist`), mobs and players already follow the cadence (Port-read). Paintings / frames / knots did not; fixed (Bytecode-read of the same two methods; a hanging entity never moves so only the first pass and player triggers apply).

## Verification
- `node --test --test-concurrency=2 src/mpobjects102-b102.test.js`: 4 pass. With `server-hanging.js` reverted: 2 pass, 2 fail.
- Neighbours (23 files, concurrency 2, one run): 212 tests; the first run had 1 failure (mpgolems-b66, which sets attackTimer directly, not via golemStrike); fixed by keeping the diff as a fallback, no test edited; mpgolems-b66 + village-ai + mine rerun: 19 pass, 0 fail.
- No full suite intended, no build, no browser. One accidental whole-suite start (empty file list from a bad shell variable) was stopped with TaskStop within a minute.

## Follow-ups
- Hanging entities are still not gated on the sent column (`chunkViews.sees`), and their S13 is not delayed one tick.
- The seq order covers S19 only; other packet kinds in a player's list keep their existing order.
