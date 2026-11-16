# Batch 76 lead: merges, joins and release 0.105.0

## Merged (git log --first-parent on batch76-lead)
- spuseorder76, mpclicks76, guireplay76, mphorse76, mpwatched76, spsounds76, mplos76, regionimport76, spdispense76, mpcauldron76. All clean; `main.js`, `buckets-simulation.js`, `potion-use.js`, `player-edit-simulation.js`, `simulation.js`, `client-containers.js` auto-merged. Overlap tests rerun after each auto-merge (buckets 23/23, dispense+sounds+useorder 26/26, cauldron+horse+useorder+usesweep 44/44).

## Lead checks
- mpcauldron76's Creative rule for the cauldron bottle: javap on `ajw.a(ahb,int,int,int,yz,...)`: offset 127-133 reads `yz.bE.d` (capabilities.isCreativeMode) and jumps past the potion grant and the stack shrink, so Creative gets no bottle and keeps its glass bottle; the level still drops (bytecode-read).
- `mptrade-b66.test.js` "a full trade over the wire" also fails on main (4/25 runs at 45175ffd6): a farmer with one offer can roll a two-input recipe (gravel or raw fish plus an emerald) and the test only supplied the first payment. The test now puts `buyB` in hotbar slot 31 and clicks it into input slot 1. 0/50 runs fail after the change. No game code changed.

## Verification
One full `npm test` on the merged tip 49c2b8bf0: 8737 tests, 8736 pass, 1 fail (the trade flake above, fixed in the release commit). `npm run build` ok; bridge tests ok. No browser checks (by request).

## Browser-only (not verified)
Horse riding and the horse window, server cauldrons, dispenser smoke and corner clicks, the Generate Structures toggle, the remote hardcore death button.

## Open
See "Still open from batch 76" in `public/research/remaining-gaps.md` and the ten `*-b76-track.md` notes.
