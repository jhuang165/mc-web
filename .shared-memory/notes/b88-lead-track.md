# Batch 88 lead track

## Merged
On `batch88-lead`, cut from fd68ecc68 (0.116.0), in this order: horse88, mobrec88, console88, spcopy88, tiles88, track88, mpperf88, entnbt88, blast88, boatray88. Track agents ran on Opus, by request.

## Lead fixes
- kept both sides in three merge conflicts: the dated `commands.md` entries (console88 and entnbt88), the fireball load in `fireballs.js` (entnbt88's kept Entity keys with blast88's no-shooter rule), and the imports in `boats.js` (entnbt88 and boatray88). `scheduled-ticks.test.js` and `simulation-replay.test.js` compared two runs that each spawn falling blocks with their own random UUIDs (entnbt88); they now leave the UUID out (b18262a22).
- Passed spcopy88's finding (167 corrections in 200 ticks while standing on a boat in single player) to boatray88, which made the player collide with the tracker's boat copies (5 left, from the copy's velocity drift).

## Cross-track tests
265 files (every test changed since fd68ecc68 plus horse, boat, ride, blast, fireball, wither, spcopy, farm, tile, sign, chest, redstone, away, console, dedicated, save, summon, NBT, region, mobrec, village, enderman, golem, tracker, thrown, crystal, dragon, projectile, dimension and mpperf8x neighbours), MC_MPPERF83..88=verify: 3747/3747.

## Verification
- One full `npm test` on 8dd57848a: 9956 tests, 9954 pass, 2 fail (the two-run UUID comparisons), fixed in b18262a22 and rerun 9/9.
- `npm run build` ok (existing chunk-size warning); bridge unittest ok.
- No browser checks, by request.

## Found wrong in the batch 87 list
- `/save-all flush` exists in 1.7.10.
- The live daylight sensor gated on the port's own redstone counter.
- Boat fall distance already matched native.

## Open
"Still open from batch 88" in `public/research/remaining-gaps.md`.
