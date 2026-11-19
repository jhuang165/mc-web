# Batch 84 lead: merges and release 0.113.0

Track agents ran on Sonnet this batch (by request); the lead merged, tested and released.

## Merged (git log --first-parent on batch84-lead, cut from 5cb5c6458 = 0.112.0)
- mobs84 85fc27535, mpboat84 5831bf374, drops84 40e4e8f34, mpplace84 48b4abda6, blastparts84 847df8699, rain84 16faeceba, mpperf84 b7d50019c, mpthrown84 7c415db3f, cmdfix84 ee4f1cbd9, dedicated84 57bc31bfe.
- No textual conflicts (auto-merges in `main.js`, `entities.js`, `item-entities.js`, `multiplayer/simulation.js`, `away-world.js`, `falling.js`, `bow.js`, `projectiles.js`, `server-broadcast.js`).
- Lead fixes:
  - c51783bb5: the dedicated server's boats get rain84's `rain` and `fizz` hooks (`server-vehicles.js`, mpboat84's file, so rain84 left it).
  - a5567a884: `chunkscan2-b68.test.js` set its farmland under the terrain's grass; drops84's server support-loss hook (farmNeighbourChange) now turns it back at once, so the test clears the cell above first.
- Checked: mpthrown84's thrown lane forwards `velocityChanged`, so blastparts84's arrow flag reaches clients.
- Cross-track tests (targeted): all b84 tests plus vehicle and boat tests after the boat rain fix 368/368; cmdfix84 with rain84, mpthrown84, blastparts84, plants83, cmd-exec-b83, falling, bow, broadcast and dispense tests 151/151; command and placement tracks (dedicated84, cmdfix84, mpplace84, drops84 with the admin, tab and broadcast tests) 102/102.

## Verification
- One full `npm test` on 065523a7f: 9382 tests, 9381 pass, 1 fail (`the dedicated server ticks farmland only inside the active chunks`, drops84's alone). After a5567a884 the file passes 8/8. `npm run build` ok; bridge tests ok. No browser checks (by request).

## Found wrong in the batch 83 list
- "The dragon is one list entry, not its parts": `apx.a` adds the body then its parts together, so the dragon's slot is native; only the push and part collection needed fixing (blastparts84).
- The server's extra S23 after a refused place came from the client's old C08, not from the server (mpplace84).
- Batch 83's "balls 64/10/false" tracker line was the fireballs' (mpthrown84).
- The jar registers 16 dedicated commands, `netstat` included (dedicated84).
- `MC_MPPERF83=verify` threw on dragon tests (closure identity); fixed by mpperf84.

## Open
See "Still open from batch 84" in `public/research/remaining-gaps.md` and the ten `*-b84-track.md` notes. Browser-only items are listed there.
