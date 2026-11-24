# mpobjects100 (batch 100): ghost-disc item on the dedicated server (it disconnects trackers), golem rose S19 executed, villager 12/13/14 statuses

Branch `batch100-mpobjects100`. Target 1.7.10; no claim of full parity.

## Summary
- **`src/multiplayer/server-music.js`**: the dimension's music install owns an `InertDrops` (b99 `inert-drops.js`): `spawnInert` hook on the jukebox, `redstone.beginTick` (already called once per game tick through the tick tree of the overworld and of each other dimension) ages it and runs the tracker pass, `save()` writes `{kind:'inert'}` records inside `musicTiles`, install restores them (age 6000 and over dropped).
- **`src/multiplayer/server-ghost-items.js`** (new): native does not send "nothing". The real tracker sends S0E then an S1C whose write throws (below), which closes the connection. `ghostItemDrops` models it: each inert record, each player of the dimension within `clampTrackRange(64, viewDistance)` of the scaled position (floor(pos*32)/32) that watches the column (`chunkViews.sees`) is dropped once through `sim.admin.host.drop(pid, "Internal Exception: io.netty.handler.codec.EncoderException: java.lang.NullPointerException")` (no S40), and one S0E (id 14, 27 bytes) is counted in /netstat.
- **`server/server.js`** (shared, one hunk): `simulation.admin.host.drop(pid, reason)`: closes the socket like `kick` but without the S40 /netstat record (`kick` is wrapped at the next line to write the S40).
- **`src/entities.js`** (shared, 2 lines): `villageBurst` also calls `this.mobStatus(e, 12 | 13 | 14)` for heart / angryVillager / happyVillager. Before, the dedicated server only drew these bursts on its own (absent) `fx`; nothing reached the clients. `mobStatus` is only set by the server, so single player is unchanged. The client copy already draws 12-14 (`copy-status.js`).
- **`tools/probes/MpObjects100Probe.java`**, **`tools/verify-mpobjects100.mjs`**, **`public/research/mpobjects100-reference.json`** (2.6 KB): executed records.
- **`src/mpobjects100-b100.test.js`** (7 tests).

## Evidence
- Executed (real `my` EntityTrackerEntry + real `xk` EntityItem with `new add((adb)null,1,0)`, packets written through the real `et` PacketBuffer): S0E item (144,32,144 type 2 data 1) writes 26 bytes; S1C (slot 10 stack `I:0:1:0`) throws `NullPointerException` after 15 bytes (short id 0, count, damage, then `Item.hasTag` on the null item); the same S1C with a feather writes 18 bytes. The entry also sends the S1C again on the next tracker pass (watcher flagged changed), same exception. Control row proves the probe distinguishes.
- Bytecode-read: `fa` (MessageSerializer) `a(ctx, ft, buf)` has no catch; netty 4 `MessageToByteEncoder.write` wraps in `EncoderException`; `ej` (NetworkManager) dispatch adds `FIRE_EXCEPTION_ON_FAILURE`; `ej.exceptionCaught` builds `disconnect.genericReason` "Internal Exception: " + throwable and `ej.a(fj)` closes the channel (no S40). `et.a(add)`, `adb.b(null)` = 0.
- Item 2, Executed: real `wt` golem tracked by the real entry; `wt.a(boolean)` calls `ahb.a(sa, byte 11)`; the world double does what `mt.a(sa,byte)` does (Bytecode-read: `mn.b(sa, new gt(sa, b))` -> `my.b(ft)` -> all tracking players). Five calls (true, false, true, true, false) each send exactly one S19 (entity 2, state 11, 5 bytes) and set `bs` 400 / 0. Matches b99 `golemRoseSet` (always sends 11 per call); the b99 bytecode-read claim is now executed. An idle tracker pass sends no status.
- Item 3, Port-read: wolf shake 8, sheep eat 10, tame 6/7, love 18, witch 15, golem 4/11 reach `mobStatus` -> `ServerMobs.statuses` -> S19 to watchers. Villager 12/13/14 did not (fixed above). Bytecode-read in `yv`: `bp()` sends 14 (restock with a remembered buyer in a village), `b(sv)` (setRevengeTarget) 13; the mating AI's 12 is the port's `villagerParticles(m, "heart")`.

## Verification
- `node --test --test-concurrency=2 src/mpobjects100-b100.test.js`: 7 pass; with `server-music.js` reverted: 2 pass, 4 fail.
- Neighbours: 61 files naming server-music, jukebox, inert, villager, village-ai, admin.host, server/server.js, villageBurst, copy-status: 623 tests, 623 pass (echoed list checked, concurrency 2).
- No full suite, no build (no new import cycles; `entities.js` and `server.js` gain no imports), no browser.

## Found wrong in earlier notes
- tiles99 "the dedicated server ejects nothing for a ghost disc" described the port, not native: natively the ghost item exists and disconnects tracking players.

## Follow-ups
- The tracker's re-list cadence (`updatePlayerEntities` for a standing item) is modelled as every tick; a player who walks into range is dropped on that tick, native may take up to the entry's own re-list tick. The client's view of the S0E before the drop (an item with no stack) is not drawn.
- The kick also logs "lost connection" and "left the game" natively; the port's socket-close path is assumed to do the same (not tested end to end through `server.js`).
- Villager 12 (mating) not executed in a probe; 13 and 14 bytecode-read only.
