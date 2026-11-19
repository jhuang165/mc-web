# Batch 83 lead: merges and release 0.112.0

## Merged (git log --first-parent on batch83-lead, cut from 786c05f67 = 0.111.0)
- cmdblock83 32153b626, rain83 19afc8bf1, mppiston83 2529d6db3, blastorder83 79cf06440, corpse83 838a380f8, mpperf83 fdbbca579, tracker83 32032c4e9, plants83 04b0d5c3d, attack83 8627bbd0d, cmdexec83 62425dbf1.
- Conflict: `src/command-host.js` imports (plants83's `applySetblockTag` and cmdexec83's `item-component.js` import); both kept.
- Lead fixes:
  - b10656c44: the b42 enderman replay host (`enderman-wolf-replay.js`) gives rain83's `mobs.wet` hook (rain and an unroofed column), so `b42-enderman-rain-4020` replays again.
  - 394803b06: the same host's creeper blast runs with `candidateOrder.flat = true`. VillagerProbe.World answers entity queries from one flat ArrayList, so the probe's blast list is in list order, not blastorder83's chunk walk. Fixed b45cw-bystanders-7023/7024/7025.
- Cross-track tests (targeted): mppiston/rain/cmdblock with pots82 and fireext82 46/46; blastorder/rain/piston with explosion-simulation, spblast82, fireext82, away-entities 52/52; corpse83/rain83 with the enderman, wolf and corpse82 tests; all b83 tests with `MC_MPPERF83=verify` plus mpfx80, mpvehicles-b61, mpcadence72, enderman-wolf-b42, mpball82 168/168; plants83 69/69; attack83 with `MC_MPPERF83=verify` 114/114; command tracks 96/96.

## Verification
- One full `npm test` on ab77d39fb: 9311 tests, 9308 pass, 3 fail (the creeper replays above). After 394803b06, every test on that replay host plus blastorder83: 494/494. `npm run build` ok; bridge tests ok. No browser checks (by request).

## Found wrong in the batch 82 list
- The minecart fire counter already existed; native never sends a cart's flames (rain83).
- The iron golem's corpse counters already ran (corpse83).
- mpplace82's attack slowdown claim was refined: both sides follow `yz.r`; a sprint hit on a mob is not slowed, on a player or crystal it is (attack83).

## Open
See "Still open from batch 83" in `public/research/remaining-gaps.md` and the ten `*-b83-track.md` notes. Browser-only items are listed there.
