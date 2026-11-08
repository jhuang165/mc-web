# negstacks (batch 26): negative stacks, zero-size use guards, Count -1/0 reads

## Summary
- **New probe.** `tools/probes/NegStacksProbe.java` and `tools/verify-neg-stacks.mjs` write `public/research/neg-stacks-reference.json` from the unchanged 1.7.10 classes (EyeOfEnderProbe's world double). It holds 88 records: tileRead 16, playerRead 6, use 52 and rightClick 14. `src/neg-stacks.test.js` (6 tests) replays it together with the stackSize 0 records of `attributes2-reference.json`.
- **Native findings.**
  - Chest, dispenser, furnace and brewing stand `readFromNBT` keep Count -1, 0 and 127 and write the same byte back. `InventoryPlayer.readFromNBT` does the same for main and armour slots.
  - At stackSize -1 and -2, ItemBlock, ItemSlab, ItemReed, redstone, doors, seeds, nether wart, spawn eggs (Survival), bone meal and minecarts all act and leave count - 1. ItemBlock and ItemReed refuse only an exact 0.
  - ItemSign and ItemSkull end with an unchecked `--stackSize` (bytecode; the probe world throws first). Throwables, apple, bread and milk go to count - 1. Buckets and bottles replace the stack on `--stackSize <= 0`.
- **Port.**
  - `Survival.take` shrinks a held stack at size 0 or below itself (0 -> -1, only exactly 0 clears the slot). `Survival.usable` is the new gate in place of `count(id)` at the held-item use sites: `block-placement-simulation.js`, `player-edit-simulation.js`, `skull.js`, `signs.js`, eating (`survival.eat`, `beginEating`, one `main.js` line), throwables and spawn eggs (`spawn-egg-use.js`, which now goes through `take` for a size-0 stack). Bone meal uses `take`.
  - `placeHeldBlock` and cake placement refuse only an exact 0, so a -1 stack places.
  - `PlayerInventory.count` ignores stacks of size 0 or below, so a negative stack never offsets a real one.
  - Reads: all container tiles (`readContainerTile`, `allowEmpty: true`), `itemStackFromNbt`/`convertItem` with `allowEmpty`, `PlayerInventory.read` (bytes -128..127), and `ItemEntities.spawn({empty})` keep -1. Saves already wrote the count as is.
  - The player's tool-break pitch (`main.js reportBrokenTool`, two lines) now uses the world Random (`weather.random` through `breakSoundPitch`).
  - Pinned tests updated: `attributes2.test.js` (the -1 gap line and stub), `survival.test.js` (a saved -2 slot is kept, -200 is not), `signs.test.js` (stub `usable`).

## Verification
- `MC_RESEARCH=.../tools/research node tools/verify-neg-stacks.mjs` regenerates the reference (counts above).
- `npm test`: 4591 tests, 4591 pass, 0 fail. `npm run build`: ok.
- No browser check.

## Follow-ups
- Picking up a native EntityItem of Count -1 puts a -1 stack in the inventory (probe: inventoryCount -1, entity stack 0). The port keeps such an item on load but never picks it up.
- Armour slots read at Count -1 for a non-armour item are still dropped (the port filters by slot type; native does not).
- Furnace, dispenser and brewing ticks, hopper pushes and container GUI clicks on negative stacks were not probed. `FireworksItem` and plain `/give` still refuse Count 0.
- Entity interactions that spend the held item through `inventory.decr` (dye on sheep, leads, saddles, name tags, horse items) still clear a size-0 stack instead of leaving -1.
- Glass bottle, bucket and potion paths already replace the stack on `--count <= 0`, but their entry gates were not checked for a size-0 stack.
