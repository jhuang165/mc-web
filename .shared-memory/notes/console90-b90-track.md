# console90 (batch 90): S40 for every kick, light and side state in the cached chunk length, S23 ids, mob packet ids and DataWatcher sizes

## Summary
- **Kicks.** `server/server.js`: the illegal-character and chat-spam kicks, and the duplicate-login kick of the old connection, each write an S40 (`kickPacket`) when the socket is open, before the close. The chat kick checks `readyState === OPEN`, so messages still in flight after the kick are not counted again.
  - The spam kick's S40 text is the literal key `disconnect.spam` (19 bytes), as natively. The close text sent to the browser stays `Kicked for spamming`.
- **Cached chunk length.** `src/multiplayer/net-native-bytes.js`: the cache key of `columnsDeflated` now includes `hashSide`, a hash of the columns' light arrays (read as Uint32 words) and of the side-state codes of their stateful cells. A light-only change and a state-only change deflate again.
- **Real metadata.** `columnData` asks `source.stateAt(x, y, z, portId)` for the ids in `STATEFUL` (flowing water and lava, furnace, moist farmland, chests, repeater) and passes the state to `toOriginal`. Flowing water is native 8 (not 9), a lit furnace 62 with its facing, a chest its own facing, farmland its moisture, a repeater 94 when powered.
  - `chunkSourceFor` supplies `stateAt` from the dimension's own systems: fluids (`pending` or `inFlight`), farming fields, tile furnaces and chests, `containers.litFurnaces`, `redstone.lit`. For the Overworld it applies only while the sim's own world is the Overworld (not inside a Nether swap).
  - S23 writes the VarInt of the native block id (`toOriginal`), not the port id. This is a size change only (stained clay 58 is native 159, two bytes).
- **Mob packets.** `net-packet-ids.js` `mobRecords` records each tracker packet under its own native id: move S15 (8), look S16 (7), moveLook S17 (10), teleport S18 (19), head S19 (6), velocity S12 (11), meta S1C, equipment S04, effect S1D, attributes S20. Before, all of these counted as S18.
  - S0F is 24 + the class's DataWatcher bytes. The S1C right after a spawn is the whole DataWatcher (5 + the same bytes), as `tryStartWatching` sends it. A later S1C counts only the changed entries (potion 5, air 3, flags byte 2 once, screaming 2, invul 5, health 5, ambient 2, bat hang 2, horse flags 5, plus the end byte).
  - `MOB_WATCHER` has all 29 living classes, from the reference file. An unknown mob keeps the empty-watcher size.
- **Probe and reference.** `tools/probes/Console90Probe.java`, run through `tools/verify-console90.mjs`, writes `public/research/console90-reference.json`.

## Evidence
- **Executed:** Console90Probe on the unchanged jar: S0F (`fz(sv)`) written after its id VarInt for each of the 29 living classes, plus each class's DataWatcher entries (type, index, bytes). Examples: Pig 55, Wolf 66, Horse 72, Wither 68, Bat 50, Squid 48. Fixed frames of S04, S12, S15-S19, S1D, S20 come from the b88 base rows.
- **Bytecode-read:** `nh.c(String)` is an S40 with an `fq` text; `nh` passes `"disconnect.spam"` and `"Illegal characters in chat"` to it. `il.b` (S20) writes: int, int count, per row string, double, short, per modifier long, long, double, byte (25).
- **Port-read:** the tracker (`entity-tracker.js`) already emits the native packet kinds (move, look, moveLook, teleport, head) and `startPackets` emits spawn then the meta; only the counting mapped them all to S18. The port's `nh` text for spam is the display text, not the key.

## Verification
- `node --test --test-concurrency=2 src/console90-b90.test.js`: 7/7 pass. With `server` and `src/multiplayer` stashed it fails (import of `MOB_WATCHER`).
- 24 files naming netstat or the packet modules (accounts, client-screens, console86/88/89/90, mpadmin71, mpbooks, mpclicks, mpcontainers, mpnether, mpping, mpsettings72, mpstations, mpstate, mpstream72, mptabcomplete, mpsurvival, mptrackers71, mptrade, multiplayer, multiplayer-refusal, offline87, pvp-b63): the first run had 3 failures, all old assertions (below); after updating them, console88, console89 and offline87 pass (27/27). The other files passed in the first run (227 of 230).
- `npm run build` once: ok. No full `npm test`, no browser.
- Old tests changed because they encoded non-native behaviour: `console88-b88` and `console89-b89` used port id 152 as the S23 block id (the VarInt is the native id's: they now use 58 -> 159); `offline87-b87` expected an S18 from mob moves (they are now S15-S19 under their own ids; the assertion sums 21 to 25).

## Found wrong in the batch 89 list
- "block states outside the cell use default metadata in some server packets": only chunk data (S21/S26) did; S22/S23 carry a metadata byte of fixed size, so only the size of S23's id VarInt was off (port id, now native).

## Follow-ups
- Not proved, still estimates: a tamed wolf, ocelot or horse's owner string (36 bytes each natively when the owner is a UUID, not in the port's packet) and custom name tags are not in the S0F / S1C bytes; later S1C changes from keys the port does not emit (baby age, tamed flags, sheep colour) are not counted; vehicles and object entity packets still count S18 per entry.
- The Overworld's side state is read only while the sim's own world is the Overworld; Nether/End use their instance. Ring-world (streaming) key offsets are not checked.
- Hash cost: light words of each column are read on every send (about 130 KB a column); not measured in a browser or a long run.
- Browser-only: how the disconnect screen shows these kicks.
