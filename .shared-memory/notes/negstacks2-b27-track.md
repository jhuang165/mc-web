# negstacks2 (batch 27): negative-stack pickups, armour slots, drops, interaction spend

## Summary
- **New probe.** `tools/probes/NegStacks2Probe.java` and `tools/verify-neg-stacks2.mjs` write `public/research/neg-stacks2-reference.json` from the unchanged 1.7.10 classes: add 200, pickup 18, decr 60, drop 12, armour 6, firework 6, interact 60 (362 records). `src/neg-stacks2.test.js` (9 tests) replays them.
- **Gap 1 (pickup) was real.** Native `addItemStackToInventory` refuses only an exact 0; a -n stack is stored (new -n slot, or it lowers a matching stack) and the call returns false, so `EntityItem.onCollideWithPlayer` gives the inventory a -n stack, empties the entity to Count 0, fires no pickup event and leaves the entity alive. `ItemEntities.collect` now does that. `PlayerInventory.add` already matched all 200 add records.
- **Gap 2 (armour slot) was real.** `readFromNBT` keeps any item in a slot 100-103 entry; the port filtered by armour type and lost it. The constructor now keeps it (armour points still count only armour; `getTotalArmorValue` ignores size, probed).
- **Found while probing.** `func_146097_a` returns null only for an exact 0, so dropOneItem and death (`dropAllItems`) drop -n stacks. `takeAll`, `ItemEntities.dropPlayer` and `main.js throwStacks` (one-line hunk) now do.
- **Gap 3 (fireworks, /give) was already native.** `ItemFirework.onItemUse` has no count check and the port gate (`usable` + `take`) already launches at 0/-1 (6 records, now pinned). `/give` count is `parseIntBounded(1, 64)` (bytecode-read of `CommandGive`), so Count 0 cannot exist natively and the port bounds match.
- **Gap 4 (`inventory.decr` for entities) was not a gap, with one bug.** `decrStackSize` itself matches 60 records. Real `EntityPlayer.interactWith` on a pig and a horse (saddle, lead, name tag) does `--stackSize`, then clears the slot whenever the result is <= 0 outside Creative, so `decr(current, 1)` equals native for every size. In Creative the stack is a copy and nothing is used up: the port used a name tag up in Creative (comment said otherwise) and now does not (`horse-gear-live.js`, one line, test in `horse-gear.test.js`).

## Verification
- `MC_RESEARCH=.../tools/research node tools/verify-neg-stacks2.mjs` regenerates the reference.
- `npm test` and `npm run build`: `npm test` 4624 tests, 4624 pass, 0 fail; `npm run build` ok.
- Touched outside my list: `src/main.js` (one line in `throwStacks`), `src/horse-gear-live.js` (one line), `src/horse-gear.test.js` (one test). No browser check.

## Follow-ups
- Proposed gap lines for `remaining-gaps.md`: (a) `/give` adds to the inventory and drops only the remainder; native `CommandGive` drops the whole stack at the player (delay 0, owner = player) through `dropPlayerItemWithRandomChoice`. (b) Wolf, ocelot, sheep-dye, horse feeding and the `ItemDye`/saddle hit path were read from bytecode (`interactWith` copy/clear logic), not probed with live mobs at size <= 0. (c) Furnace, dispenser, brewing ticks, hopper pushes and container GUI clicks on negative stacks are still unprobed.
- The `/give` direct-drop divergence is not size-related and was left alone.
