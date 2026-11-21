# console89 (batch 89): autosave on the native tick counter, deflated chunk sizes, item tags, per-packet /netstat records, S40 kicks

## Summary
- **Autosave.** The dedicated server now autosaves on `MinecraftServer.u()`'s tick counter, every 900 ticks from launch, instead of the wall-clock `saveMs` timer (10 s).
  - `src/multiplayer/server-save.js` adds `AUTOSAVE_TICKS` (900), `AUTOSAVE_LOG` (empty), `autosaveClock(every)` and `autosaveTicksOf(options)`.
  - In `server/server.js` the clock steps at the end of each tick, after the world, network and console work, and calls `save()` (b88's player data plus the worlds whose saving is on). The autosave logs nothing.
  - Test override: `autosaveTicks`, read through `arguments[0]` so the signature line is unchanged. Old tests' `saveMs` maps to `round(saveMs / tickMs)` ticks.
  - `saveTimer` is now `null`.
- **Chunk data.** /netstat chunk sizes are now the real `Deflater(-1)` length over the native `gx.a` layout. The code is in the new server-only `src/multiplayer/net-native-bytes.js`, which uses node:zlib.
  - `chunkData` builds the layout. `columnData` maps the port's run-length cells to native ids through `toOriginal` and reads light straight from the `LightVolume` arrays. `columnsDeflated` deflates once per S21, or once per S26 group of up to 5 columns.
  - `chunkSourceFor(sim, dim)` supplies the receiving player's world height, light volume and `biomeAt` ids. It never creates a dimension. With no light source, the sky light is estimated.
  - Lengths are cached by a 64-bit hash of the columns' cells plus the source and options. Each message object is also memoized.
- **Item tags.** ItemStack NBT tags are now counted. `stackTag` builds the region-export tag; the record adds 2 bytes plus the gzip length (`du.a`), memoized per stack. Before this a stack was always 7 bytes.
- **Per-packet records.** Every native packet that a bundled message stands for is now its own /netstat record. `src/multiplayer/net-packet-ids.js` adds `writePackets`, `readPackets` and `kickPacket`; `writePacketBytes` and `readPacketBytes` now return the sum.
  - tick: an S03 only when the server tick counter is a multiple of 20 (`ctx.tick`, else `m.tick`). One S18 per other player; the receiver's own pose is skipped. Changed cells give an S23 (one cell) or an S22 (several) per chunk. Resent chunks are partial S21s with their section mask.
  - welcome and dimRespawn: S01 or S07, then one S26 per 5 columns.
  - chunkUnload: one S21 (mask 0) per column.
  - mobs: one record per packet, with the destroys combined into one S13. vehicles: one S18 per entry plus one S13.
  - Lists give one record per entry: sound, aux, crack, pistonTiles, dispFx, fishFx, dispEnts, fishHooks, slot, pingList and sb.
  - windowItems and invItems: an S30, then the cursor's S2F. beaconWindow: an S2D, then 3 S31.
  - Read side: join is C00 handshake plus C00 login start. pingStatus is the status handshake plus C00 query.
- **Kicks.** These now count as an S40 carrying the full native reason:
  - /kick, /ban, /ban-ip and the idle kick, through a wrapper on `simulation.admin.host.kick`.
  - The stop kick: one S40 "Server closed" (17 bytes) per joined player in `close()`.
- **Kick texts checked.** The port's texts match native (bytecode-read): `/kick` gives "Kicked by an operator." or the joined reason words (`func_147178_a` with no selectors), `/ban` "You are banned from this server.", `/ban-ip` "You have been IP banned.", and the idle kick "You have been idle for too long!". No change was needed.
- **Docs.** `tools/build-surface-catalogue.mjs` has an updated netstat note, and `public/research/command-parity-catalogue.md` was regenerated (only that row changed). A dated correction was appended to `public/research/commands.md`.

## Evidence
- **Executed:** `tools/probes/Console89Probe.java`, run through `tools/verify-console89.mjs` on the unchanged 1.7.10 jar with netty 4.0.10 on `MC_PROBE_LIBS`. It writes `public/research/console89-reference.json`.
  - Chunks come from a formula with 5 sections; section 4 has light only, and biomes come from the formula too. Each sample records bytes, the undeflated data length and its SHA-256:

    | Sample | Bytes | Data length |
    |---|---|---|
    | S21 full | 565 | 41216 |
    | S21 partial 0b10010 | 337 | 20480 |
    | S21 full, no sky | 539 | 33024 |
    | S26 two chunks | 1053 | 82432 |
    | S21 unload | 32 | 256 |

  - S2F with a diamond sword tagged `{ench:[{id:16s,lvl:5s}],display:{Name:"Hi"}}`: 85 bytes (tag gzip 74). An untagged sword is 11 bytes.
  - S40 kick sizes:

    | Reason | Bytes |
    |---|---|
    | "Kicked by an operator." | 26 |
    | "You are banned from this server." | 36 |
    | "You have been IP banned." | 28 |
    | "You have been idle for too long!" | 36 |
    | "Server closed" | 17 |
    | "go \<away\> & don't" (Gson escapes) | 41 |

  - Node zlib at level -1 (deflateSync and gzipSync) gives the Java lengths byte for byte. The port's layout matches the SHA-256 of every chunk sample, both from native arrays and from the port's own encoded columns through `fromOriginal` and `encodeColumn`.
- **Bytecode-read** (`javap -c -p`):
  - `MinecraftServer.u()`: `x++`, then v(), then `x % 900 == 0` runs `oi.j()` and `a(true)`. `x` is not saved. v() sends S03 when `x % 20 == 0`. Neither `a(true)` nor `oi.j()` logs.
  - `gx.<init>` and `gx.a` (the layout and `Deflater(-1)`), `gz.<init>` (one deflate over concatenated chunks) and `gz.c()` (5 per packet). `et.a(add)` and `du.a`.
  - `nh.c(String)` (S40 with `fq`), `oi.u()` ("Server closed").
  - The kick and ban commands, from the srg names: `av` CommandServerKick, `ag` CommandBanPlayer, `af` CommandBanIp. `fa` records (id, readableBytes) with no toggle.
- **Port-read:**
  - One JSON WebSocket message can stand for several native packets.
  - The player tracker does not send a player their own pose.
  - The world's column layout is `(lx * 16 + lz) * height + y`, and `LightVolume` columns are contiguous in y.
  - `DedicatedSimulation.ticks` is the saved world age, so the server now passes its own counter (`autosave.ticks + 1`) for the S03 cadence.

## Verification
- `node --test --test-timeout=600000 src/console89-b89.test.js`: 9/9 pass. It covers the executed chunk samples (layout SHA-256 and sizes), port columns to native records, `chunkSourceFor`, item tags, kick sizes, bundled records, the autosave clock, a live /kick, /ban and stop S40 count, and a live autosave override with no log lines.
- 26 files, 254/254 pass: console89, accounts, catalogue-consistency, catalogue79, console86, console88, dedicated-cmds-b84, mpadmin-b68, mpadmin71, mpbooks, mpchunks71, mpclicks, mpmisc74, mpnether, mpping, mpsettings72, mpstate-b59, mpstream72, mpsurvival-b58, mptrackers71, multiplayer-refusal, multiplayer, offline87, pvp-b63, serverprops-b69, serverprops2-b70.
- Old tests updated because they encoded the gaps fixed here:
  - `src/console88-b88.test.js`: the tick estimate now names its counter. `tick: 20` gives 17 + 2·19 + 12; `tick: 21` has no S03.
  - `src/offline87-b87.test.js`: the join is now 2 records under id 0, not 1, and the S18 assertion's message was reworded (the lone player's own pose is not counted).
  - The source-text test (offline87 `m.type === '...'`) still passes. The `saveMs` options in about 15 server tests keep working through the tick mapping.
- `npm run build` was run once at the end. The full `npm test` was not run (track rules). No browser checks.
- Cost: about 0.6 ms per 256-high column on a first send, measured on the default 64-column world: about 39 ms for all of its columns, light included. Repeats hit the cache.

## Follow-ups
- Chat-spam kicks, "Illegal characters in chat" and "You logged in from another location" are also S40s natively. They still close the socket without an S40 record.
- The cached chunk length ignores a light change in a column whose cells did not change (an estimate). A column with no light source estimates the sky light, and block-side state the port keeps outside the cell (a lit furnace, flowing water) uses `toOriginal`'s default metadata.
- Port messages with no exact native counterpart still use the b88 estimates: a mob spawn's DataWatcher, and S18 standing for S15–S17 moves.
- Per-world partial saving is still only reachable through the probes' rows.
- Browser-only: how the client shows the disconnect screen after /kick, /ban or /stop.
