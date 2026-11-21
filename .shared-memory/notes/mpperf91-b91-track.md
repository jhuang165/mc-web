# Batch 91 mpperf91: S20 change test without rows

## Summary
- New `src/mpperf91-fast.js` with `MC_MPPERF91=on|off|verify` (default on). `tools/bench-alloc81.mjs` prints `mode91` after `mode90`.
- `multiplayer/server-mob-entries.js` `SharedEntry.sendAttributes`: a mob that is plain (no stored modifiers, effects, saved bases, horse record or `attrBumps`; not wolf, slime, magma cube, horse, crystal; no baby zombie/pigman, enderman boost, pigman target, drinking witch, sprinting ocelot) is compared by three numbers (max health, speed base, speed value) against the ones its last old-path pass recorded. Equal: return, so `watchedAttributes`, `moveSpeedModifiers`, row objects, mod arrays and `rowKey` strings are not built. Any difference, or a mob that is not plain, takes the old path unchanged, which then re-records. Verify runs the old path as well, asserts it sends nothing when the quick test said unchanged, and that the recorded numbers equal the rows.
- Old tests: the `mode90=` bench-output regexes in mpperf86..90 tests allow `mode91=`.
- Not changed (measured, left): the profile is flat (top self time: `tickMobs` 6%, `updateAITasks` 3%). `mobTargetAt88` (9.5 MB per 150 travel ticks) cannot reuse its box without aliasing earlier target records (b90 note); `blockBoxesFast` already pools boxes; `tickMobs` shapes need key changes that alter saves; pathfinder `finder`/`beginMemo` allocations left.

## Evidence
- Executed heap profile (travel, 150 ticks) before: mobTargetAt88 9.5 MB, watchedAttributes 9.3, walk 6.2, blockBoxesFast 5.7, moveSpeedModifiers 5.5, sendAttributes 5.3, finder 5.1.
- Executed `node --expose-gc tools/bench-alloc81.mjs --scene=X --runs=3 --ticks=150`, off/on alternated, two pairs (shared Mac, noisy):

  | Scene | heap KB/tick off -> on | ms/tick off -> on |
  |---|---|---|
  | travel | 1574 -> 1456, 1562 -> 1447 (-7.5%) | 4.74 -> 5.37, 5.91 -> 5.78 (noise) |
  | terrain | 797 -> 762, 799 -> 762 (-4.6%) | 3.18 -> 3.65, 3.78 -> 4.00 (noise) |
  | pen | 533 -> 432, 535 -> 430 (-19%) | 1.24 -> 1.27, 1.27 -> 1.30 (noise) |

  Tick time is inside the noise; only the allocation drop is claimed.
- Executed `--state` travel 150 ticks: `bbea5e7696813f52,eabd4792df21d0ee,3c1e7bad89653e83` identical off, on, verify.
- Port-read: no game rule changed; the plain-mob numbers are what `watchedAttributes` computes for such a mob.

## Verification
- `node --test src/mpperf91-b91.test.js`: 3 pass (scripted packets with a max health edit, potion, stored modifier, baby flag, bump, wolf owner identical off/on/verify; plainAttrs91 refusals and equality with watchedAttributes; bench hashes pen/travel). Mutation (executed): dropping the max-health comparison fails test 1.
- Neighbours (mpperf86..91, mobpackets*, multiplayer*, tracker*, mplos*), concurrency 2: 260 pass / 0 fail. No full npm test, no build (no import graph beyond one new module), no browser.

## Follow-ups
- Still open: mobTargetAt88 box churn, tickMobs field shapes, pathfinder finder/memo allocations, `walk`, `legacyThink` allocations. Single-player frame time is browser-only.
