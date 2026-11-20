# Batch 87 lead track

## Merged
On `batch87-lead`, cut from b95bfd9ac (0.115.0), in this order: ride87 (79b38a97a), offline87 (fcace8db9), tiles87 (6b2cc2fa7), blast87 (0a273c3ba), spcopy87 (9b22bd921), mobrec87 (8b29fe9a2), boatcheck87 (0bb64a62c), sptrack87 (d6508dc06), summon87 (457719ea1), mpperf87 (3eb71d4b5). Track agents ran on Opus, by request.

## Lead fixes
- kept both changes in three merge conflicts: the server blast rows in `server-mobs.js` (sptrack87's `hooksIn` line with blast87's placer and attacker arguments), the dated `commands.md` entries (offline87 and summon87), and the fall-state lines in `entities.js` (mpperf87's `dryBoxOf87` with summon87's negative FallDistance rule). No test needed a lead fix.

## Cross-track tests
190 files (every test changed since b95bfd9ac plus horse, boat, blast, spcopy, tile, away, offline, dedicated, console, mobrec, village, enderman, tracker, summon, fishing, thrown, item, falling, region, cart, sign and mpperf8x neighbours), MC_MPPERF83..87=verify: 2337/2337.

## Verification
- One full `npm test` on 3eb71d4b5: 9844 tests, 9844 pass, 0 fail.
- `npm run build` ok (existing chunk-size warning); bridge unittest 5/5.
- No browser checks, by request.

## Found wrong in the batch 86 list
- `/setblock` over a chest spills in 1.7.10 (1.8 clears).
- Minecarts have no collision box; there is no hay cushion or slime block in 1.7.10; boats were already in the copy's collisions.
- The C0C jump flag affects no mount natively.
- The batch 86 pigman damage was the Hard value.
- Away daylight sensors kept their departure value rather than reading noon.

## Open
"Still open from batch 87" in `public/research/remaining-gaps.md`.
