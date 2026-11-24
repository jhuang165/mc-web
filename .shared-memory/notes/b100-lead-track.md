# b100 lead track (batch 100, 2026-11-23)

Lead branch `batch100-lead` in `../wt100-lead`, cut from 9958c1313. Released as 0.129.0. Does not claim full parity.

## Merges
horse100, mpperf100 (+ lead fix 675a7ded6: `fail100` import in `server-mobs.js`), entnbt100, spcopy100, credit100, mpobjects100, abilities100 (conflict in `client.js` `buffer()` with horse100: both lines kept), console100, tiles100, mobrec100; lead fix 814a2453d after the full run. Every shared-file diff reviewed before merging; targeted tests run after each merge.

## Verification
One full `npm test` on the merged tree: 11000/11001; the one failure (`gui-screens.test.js` death-screen layout after spcopy100's `main.js` branch) and a build break (mpobjects100's `server-ghost-items.js` pulled `node:zlib` into the browser bundle through `net-packet-ids.js`) fixed in lead commit 814a2453d, then the failing and related tests (22/22) and the build rerun ok. Bridge tests ok. Logs in `../artifacts/b100-lead/`. No browser checks.

## Open
"Still open from batch 100" in `public/research/remaining-gaps.md`. Notable: the death screen should not pause the world; the server ghost-disc tracker re-list cadence; respawn keeps the tracker entry; the client keeps S39 flags from its own mode.
