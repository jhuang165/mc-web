# Batch 60 smallchecks2: client comparator powers, non-italic id suffix, effect HashMap order

## Summary
- `src/client-comparator.js` (new): a `RedstoneWorld` subclass whose storage is the client's own world (internal ids converted with block-registry, repeater lit from a hook, another comparator's tile from a hook or its steady-state output). `clientComparatorToggle` reads the rear input and larger side input, then runs `comparator-toggle.js` (now wired). Tile-held inputs (chests, furnaces, jukebox) read 0, as on a client that has not opened them.
- `src/client-prediction.js`: the comparator branch of `dryActivate` calls it (state.redstoneHooks {lit, signal}, both optional). `src/main.js`: one `redstoneHooks` field in `predictPlace` (lit repeaters from `redstoneRuntime.redstone.lit`, which the client already receives). `src/redstone.js`: one exported helper `comparatorReadings` (no behaviour change; server redstone untouched).
- `src/gui.js`: a named stack's advanced title is `name + "§r" + " (#0035/5)"`, so the suffix is not italic (the reference title line prefix `§o` is on the name only). `§r` is added only when a suffix exists.
- `src/status-effects.js`: `effectsMapOrder` and `Effects.ordered()` give the HashMap bucket order (Java 8). `tick`, `serialize` and the inventory effect list (`main.js`, one line) use it; the old list sorted by id.
- Probe `tools/probes/ClientPredictProbe.java` + `tools/verify-client-predict.mjs`: 144 new `comparator-powered-*` activate records (12 input arrangements x metas 0/4/8/12 x tile output 0/7/15) and a `tileSignal` [before, after] field on every activate record (402 records, was 258). Test `src/smallchecks2-b60.test.js` (5 tests). `status-effects.test.js` follows the new save order.

## Evidence
- Executed (unchanged 1.7.10 classes, isRemote world): the 144 powered-input records. Inputs: wire at meta 12/15/5, redstone block, lever on a stone block, wire past a stone block, a lit repeater block 94, a lit torch, side wire/block powers of 9 and 12. The port prediction matches every record's cell diff and the tile's OutputSignal afterwards.
- Executed (b59 SmallChecksProbe rows): the named title is `§oBob§r (#0035/5)` with advanced tooltips and `§oAtlas§r` without. So the gap "suffix is drawn italic" was real: FontRenderer drops italic at `§r`. Gap closed. The rarity or base colour also resets at `§r` (the suffix is drawn in the base white), which `font-quads.js` already does.
- Bytecode-read: not new; comparator rule from b59 (`akc.a`).
- Effect order: executed for Java 8 (b54 order records, JavaHashSetOrder checked in the test for all 1..23 pairs and a 13-entry table). Recalled/source-reasoned for Java 6/7: ids 1..15 hash to themselves in both, so the order is identical; for 16..23 Java 7's spread (`h ^ h>>>7 ^ h>>>4`) flips the low bit (16<->17, 18<->19, 20<->21, 22<->23 swap buckets) and a new key joins the front of its chain. Not executed (JDK 19 here).
- Decision: Java 8. Reasons: it is the order the existing executed records and the mob export use, so player and mob effects now agree; 1.7.10 (2014) ran on whatever JRE the player had and there is no single native answer; only a player holding two or more of ids 16..23 (or a 16+ id with its low-bit partner) sees a difference. Documented in `status-effects.js`.

## Verification
- `node tools/verify-client-predict.mjs`: 402 records. `node --test` over every test importing status-effects, tooltipLines, client-prediction, redstone.js or the reference: 697 pass, 0 fail. Over every test mentioning main.js, survival.js, region-export, away-commands or potion: 2915 pass, 0 fail. `npm run build`: ok.
- Full npm test not run (batch rule). No browser check.

## Follow-ups
- S1D at login: the dedicated server has no login effect burst yet (only the beacon grant sends `effect`). mphealth or whoever adds it should walk `player.survival.effects.ordered()`; this track left server files alone.
- The comparator reads item frames natively (comparator input from an item frame behind it); neither the server engine nor this view models it.
- The client tile output is the steady state unless a `signal` hook supplies it; multiplayer clients do not yet receive comparator tile signals.
- A browser would show only the click-time meta (lit bit kept or cleared) and the tooltip suffix glyphs; both are covered by data here.
