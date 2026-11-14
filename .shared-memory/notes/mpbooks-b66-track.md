# Batch 66 mpbooks: books, jukeboxes and note blocks on the dedicated server

## Summary
- `src/multiplayer/server-books.js` (new): `bookPacket(sim, id, m)` runs MC|BEdit / MC|BSign through the single-player `applyBookEdit` / `applyBookSign` (books.js) on the stack the player holds. Invalid tag returns false and `server/server.js` closes with "Invalid book tag!" (the original throws IOException). A valid packet for the wrong held item is ignored.
- `src/multiplayer/server-music.js` (new): `installMusic` puts the single-player note block and jukebox behaviours (note-blocks.js, jukebox.js) on each dimension's LiveRedstone (Overworld in `simulation.js`, Nether and End in `server-nether.js`). It adds S29 plus S24 for notes, S28 1005 for records, the right click rules (`serverMusicUse`), the survival left click (`serverNoteClick`) and saving (`musicTiles` inside the redstone save, restored from the same record).
- `src/multiplayer/client-books.js`, `client-music.js` (new): `bookOpensOnUse` (right click with a book opens the screen locally unless a block activates first), `bookMessage`, `recordAux` (1005 to disc or stop), `noteEvent`.
- Wire messages: `bookEdit`, `bookSign` (client to server, field `packet`), `musicEvent` (server to client, `k: 'note'`); record events ride the existing `aux` message as id 1005.
- `server-containers.js` `cleanStack`: book tags (`pages`, `author`, `title`) were not in the whitelist, so a book moved by a window click lost its pages on the server. They are kept now, with the native limits (50 pages, 256 chars, title 16).
- Hooks (small): `simulation.js` (import, install, `serverMusicUse` before `containers.use`, `serverNoteClick` at dig start), `server-nether.js` (install), `server/server.js` (one route), `client.js` (queue and dispatch `musicEvent`), `main.js` (`openMultiplayerBook`, `mpRecord`, `client.onMusic`, 1005 branch in `onAux`, book check before `multiplayer.send({ type: 'edit' })`).
- Records from creepers killed by skeletons: already on the server. ServerMobs runs the shared `entities.js` onDeath, which calls `mobDrops(..., bySkeleton)` (combat.js, `DISC_FIRST + nextInt(12)`). Only a unit check on `mobDrops` was added; no server-level arrow kill test.

## Evidence
- Bytecode-read (javap on the 1.7.10 jar): `ael.a` / `aem.a` (page <= 256 chars, title <= 16, author tag required, no page count check on the server); `amj.a` (BlockNote event: sound `note.<instrument>`, volume 3.0, pitch 2^((note-12)/12), then the particle); `mp.a(String,double,double,double,float,float)` (S29 range 16 * volume when volume > 1, so 48 for a note). The earlier batch 18 notes cover MC|BEdit / MC|BSign in `nh`.
- Recalled (not re-read this batch): S24 goes to players within 64 blocks (WorldServer.func_147485_a), and the client world repeats the handler so a note sounds from both S29 and S24; S28 1005 goes to players within 64 blocks of the jukebox in the same dimension (WorldManager.playAuxSFX); ItemRecord data is the item id 2256+.
- Executed: only the existing probe results replayed by `books.test.js`, `book-gui.test.js`, `note-jukebox.test.js`. No new Java probe: the server handlers need a NetHandlerPlayServer double (batch 18 left that open).

## Verification
- `node --test src/mpbooks-b66.test.js`: 15 pass.
- One at a time: `books.test.js` 13, `book-gui.test.js` 7, `note-jukebox.test.js` 23, `mpinventory-b60.test.js` 9, `mpinventory2-b61.test.js` 12 all pass.
- Also pass: `mpnether3-b63` 9, `mpend-b63` 5, `container-screens` 10, `mpcontainers-b59` 8. `npm run build` ok.
- Full npm test not run (batch rule).

## Follow-ups
- Browser-only: the book screen opening in a connected client, the Now playing line, the record stream (needs `npm run music:fetch`), and double note sound. Not checked (no browser checks this batch).
- Disc insert while sneaking follows ItemRecord.onItemUse (works); single player still requires not sneaking (left as is).
- The right click helper `bookOpensOnUse` uses the `STATIONS` set plus note block and jukebox; blocks that the server activates but STATIONS lacks would also eat the click natively.
- A book read by another player (title screen of a written book in a chest) relies on the window stack wire carrying tags, which `cleanStack` now keeps for client-sent stacks; server-sent stacks were already whole.
- Adventure mode is not checked for notes and jukeboxes.
