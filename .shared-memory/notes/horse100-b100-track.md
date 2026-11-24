# horse100 (batch 100) track note

Branch `batch100-horse100`, cut from main 9958c1313 (release 0.128.0).

## Summary (file by file)
- `src/multiplayer/client.js`: `buffer()` dropped a `dismount` message that arrived while the client was not ready (terrain loading after join, or after a `dimRespawn`; it fell through to `if (type !== 'tick') return`). Now it is queued in order: `flushPending()` moves the merged ticks so far into the queue as one tick, then the dismount is pushed, and `start()` applies ticks merged after it last (`dismountQueued`). Result: earlier tick, dismount, later tick, as the S08/S1B/S08 arrive. The dimRespawn filter only removes chunk messages, so the dismount survives the swap. No `main.js` change.
- `src/horse100-b100.test.js`: 2 tests on `DedicatedClient` (order at `start()`; arrival after a dimRespawn).

## Evidence
- Port-read: `buffer()` had no `dismount` branch (the b99 note said "dropped during terrain loading" on purpose, because the tick row carries the state). That left the old `previous`/velocity/ySize jump for a rider dismounted during loading, and made the state depend on the tick merge.
- Bytecode-read (item 2): `mw.a(sa)` (EntityPlayerMP.mountEntity) calls `yz.a(sa)` (-> `sa.a(sa)`: for null it only moves the player to the mount's top `b(x, boundingBox.minY + N, z, yaw, pitch)` with the rider's OWN `y`/`z` rotation fields, then clears ridingEntity), S1B, then `nh.a(x, y, z, mw.y, mw.z)` which sends S08 (`fu`) with y + 1.62 and the player's own yaw/pitch (also `mw.a(DDDFF)`). The server's rotation is the last C03/C05 angles it received (riding branch too, server-vehicles.js:360). So the native S08 look equals what the client last sent; the only difference is client turning still in flight (a few ms of mouse input snapped back natively). The port client ignoring yaw/pitch keeps its newer look: no real divergence worth a hunk. Left as is.
- Port-read + bytecode-read (item 3, jump strength charge): `wi.w(int)`: unsaddled (`cu()` false) does nothing; negative -> 0 with no jump flag and no rear, power 0.4 + 0.4 * 0 = 0.4; else `bI` set, `cU()` rear, `>= 90` -> 1 else 0.4 + 0.4 * i / 90. `horse.js` `jumpPower` and `horse-live.js` `horseJump` match line for line (already read in b87). No probe run; temper and armour were executed in earlier batches (leads2-reference, b47h), so nothing new picked.

## Verification
- `node --test --test-concurrency=2 src/horse100-b100.test.js`: 2 pass, 0 fail.
- With `client.js` reverted: 2 fail.
- Neighbours (21 files naming multiplayer/client.js, file list echoed, via xargs): 146 pass, 0 fail.
- `npm run build`: not run (no imports changed).

## Found wrong in the batch 99 list
- "A message arriving during terrain loading is dropped, the tick row carries the state": that left the loading-time dismount un-snapped; fixed.

## Follow-ups
- Browser-only: nothing checked.
- Open: the C06 reply to S08; S08 yaw/pitch (no-op as argued, in-flight turning only); other ordered messages still apply after the merged tick at `start()`.
