# Batch 74 lead: merges, joins and release 0.103.0

## Merged (git log --first-parent on batch74-lead)
- mpperf74, mpmisc74, mptrack74, mpcombat74, mppickup74, mpsounds74 (clean)
- order74: conflict in `src/pickup-order.js` (mppickup74's `keepItem` filter and order74's `orbs` rows); both kept in one `collectPickups` signature.
- spfixes74, tilenames74, recheckgaps74 (clean; `main.js`, `simulation.js`, `server-dimensions.js`, `survival.js` auto-merged).

## Lead checks
- mpmisc74's idle claim checked with javap on `nh` (NetHandlerPlayServer): the activity setter `mw.v()` is called from 11 packet handlers and not from C03 (`jd`), so movement does not reset the idle timer (bytecode-read).

## Verification
Targeted tests on the merged branch (eight b74 files plus mobcells73, mpitems-b59, mpinventory-b60, streamfix73, particles73): 104 pass. One full `npm test` on 20cffeadf: 8476 tests, 8476 pass. `npm run build` ok; bridge tests ok (5). No browser checks (by request).

## Open
See "Still open from batch 74" in `public/research/remaining-gaps.md` and the ten track notes (`*-b74-track.md`; tilenames and recheckgaps and mpsounds use `tilenames-b74-track.md`, `recheckgaps74-b74-track.md`, `mpsounds74-b74-track.md`).
