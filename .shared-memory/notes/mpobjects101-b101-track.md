# mpobjects101 (batch 101): ghost-item tracker cadence, end-to-end disconnect test, villager 12/13/14 executed (the birth's 12 is the child's)

Branch `batch101-mpobjects101`. Target 1.7.10; no claim of full parity.

## Summary
- **`src/multiplayer/server-ghost-items.js`**: `ghostItemDrops` no longer re-tests every player against every inert item every tick. Native cadence (below): a test happens for (1) a new item (every player), (2) a player whose own entry moved more than 4 blocks (distance squared > 16) since its last list, (3) a player new to the dimension (join, dimension change; also a gap in the passes), (4) the item's column becoming watched (chunk send). State is per dimension (`WeakMap` keyed by the `InertDrops`). The range check, the column-watching check and the once-only drop are unchanged. An inert drop never moves, so the item-moved-4-blocks trigger has nothing to model.
- **`src/village-ai.js`** (shared, 1 hunk in `VillagerMate.giveBirth`): the birth's heart burst (S19 12) is now on the CHILD, with the child's size (`ai.size(child)`), not on the parent. The parents' 12s stay the 1-in-35 rolls of `updateTask`.
- **`tools/probes/MpObjects101Probe.java`**, **`tools/probes/TrackerCadence101Probe.java`**, **`tools/verify-mpobjects101.mjs`**, **`public/research/mpobjects101-reference.json`** (about 10 KB): executed records. The verify script reuses the patched classes of the mobrec100 / mpobjects100 probe directories (copied into `tools/research/mpobjects101-probe/`).
- **`src/mpobjects101-b101.test.js`** (8 tests).

## Evidence
- Item 1, Executed (`cadence` in the reference): the real `my` entry for a feather item (`new my(e, 64, 20, true)`, then `my.b(list)` as addEntityToTracker does) with the player 300 blocks away: create and first `my.a(list)` send nothing; the player then stands 5 blocks away without anyone telling the entry: seven more `my.a(list)` calls send nothing; `my.b(player)` (updatePlayerEntity) sends the S0E and S1C. Bytecode-read: `mn.a()` (updateTrackedEntities) calls `my.a(List)` for every entry; `my.a(List)` runs `my.b(List)` only when `t` is false (its first pass) or the entity moved over 4 blocks (`e(q,r,s) > 16`), and sets `n`; for a player entity with `n` set, `mn.a()` then calls `my.b(mw)` on every entry. `mn.a(mw)` (addPlayer) and `mn.a(mw, apx)` (chunk send) call `b(mw)` too. The update frequency 20 is the S1F/teleport cadence, not the list cadence. Item range 64 as before.
- Item 2, test: a real `createDedicatedServer` with a flat-world simulation, a registered account and a WebSocket joined with `chunks: false`; a ghost jukebox is ejected; the socket closes with 1008 and `GHOST_DROP_REASON`, /netstat counts exactly one more S0E (id 14) and no S40 (id 64), and the socket close removes the player. This also covers the b100 follow-up "the close path is assumed". Port-read for "left the game" lines (the existing close handler, line 342 of `server/server.js`).
- Item 3, Executed (`records`): the real `up` (VillagerMate) and `yv` in VillageFightProbe's village double with the world's `ahb.a(sa, byte)` recording [tick, class, status, growing age].
  - 12: `breed-birth-9902` and `10072`: 13 and 18 sends from adults (growing age 0) over the run, the last one (the birth tick) is on the newborn (age -24000). Bytecode-read `up.g()` ends `world.setEntityState(child, 12)`; `up` update line 193-200 is the adult's 1-in-35 roll (`nextInt(35)`). Port had the burst on the parent at birth: fixed.
  - 14: `restock-9833/9834` tick 54 (trade at 5, buy at 10, 40-tick timer), `restock-open-9836` tick 99 (screen closed at 60); `trade-nobuy-9830` (no purchase) none. The port's `tickVillagerRestock` sends it only with a village and `lastBuyer`: matches (test with a village double; the timing is covered by the b98 villager-trading-live tests).
  - 13: a player hit that leaves the villager alive in a village sends 13 BEFORE the hurt status 2 (same tick); a mob hit, a player hit with no village, and a lethal player hit send no 13 (the lethal one sends 2, 3). The port matches the set (test); the order 13-before-2 is not modelled (see follow-ups).

## Verification
- `node --test --test-concurrency=2 src/mpobjects101-b101.test.js`: 8 pass. With `server-ghost-items.js` and `village-ai.js` reverted: 6 pass, 2 fail (the small-step cadence test and the giveBirth test; the chunk-send test passes either way because the old every-tick test also drops on the first tick the column is watched).
- Neighbours (iron-golem, mob-doors, mobrec97..100, mpbooks-b66, mpobjects99/100, note-jukebox, tiles97/98/99, village-ai, village, villager-polish, villager-trading-live): 179 pass, 0 fail. Existing `village-ai.test.js` mating test unchanged and green (the double has no `ai.size`, hence the `?.` fallback).
- No full suite, no build (no import changes in browser-loaded files), no browser.

## Found wrong in the batch 100 list
- "The tracker re-list cadence is modelled as every tick": native does not re-list every tick; fixed. The b100 villager-12 claim (mating AI's 12 is `villagerParticles(m, "heart")`) was half right: the 1-in-35 roll is, the birth's 12 is the child's (fixed).

## Follow-ups
- Order of S19 13 vs S19 2 for a player hit on a villager is 13 first natively; the port's status queue order is not checked (not touched).
- The player-side trigger uses the player's position at tick granularity; native's `mn.a()` runs the player's own entry once per tick in set order, so a join and a same-tick move could differ by one tick.
- The client's view of the S0E before the drop is not drawn (browser-only).
