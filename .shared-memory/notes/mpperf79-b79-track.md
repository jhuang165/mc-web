# Batch 79 mpperf79: profile after the b78 push fix, three small exact speed-ups

## Summary
- `src/mpperf79-fast.js` (`MC_MPPERF79=on|off|verify`): `blockBoxes` (air cells skipped in `entities.js collisionBoxes`), `nearestView` + `mobStateJson` (`server-mobs.js target`, `track`), `sweepBox` (`fireballs.js sweep`). Edits in shared files are call swaps; `addPlayer`/`removePlayer` drop the cached view list.
- `src/mpperf79-b79.test.js` (5 tests), `public/research/server-performance.md` (section).

## Evidence
- Executed: CPU profiles of 16 spread, 32 clustered, Nether 8 and a dense mixed pen; the profile is flat (mob loop 54-61% inclusive, no item above 10% self). Numbers in server-performance.md.
- Executed: `--state` hashes equal across off/on/verify in three scenes; Nether equals the b77 hash.
- Port-read: only air (id 0) cells are skipped and `solid(0)` is false; nearest keeps the first strictly nearer; the state text keeps mobState's key order; the sweep box uses the same fround arithmetic as pushBox.
- Result is small: Nether block scan -30 ms per 200 ticks; whole-tick gains are inside noise.

## Verification
- `node --test src/mpperf79-b79.test.js` (5 pass); related suites run under `MC_MPPERF79=verify` (see lead reply). No full npm test, no browser.

## Follow-ups
- Pathfinding (4%) and `walk` untouched. A direct write to `ServerMobs.views` without `dropViewList` with an unchanged size would use a stale list (verify throws).
