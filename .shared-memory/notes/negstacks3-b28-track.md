# negstacks3 (batch 28): /give drop, negative and zero stacks in containers

## Summary
- **/give was a real gap, fixed.** Native `CommandGive` (bytecode-read, then probed) throws the whole stack with `func_146097_a` along the view (not the random-choice scatter), sets pickup delay 0 and owner = the player, and leaves the inventory alone. `command-host.js give` now calls `env.giveDrop(stack, name)`; `main.js` implements it (tiny hunk: `dropStack` replaced by `giveDrop`); `item-entities.js` saves and loads `owner`. Test envs renamed to `giveDrop`.
- **Container clicks (5400 records)**: one mismatch class, the drop key discarding `count <= 0` stacks. `PlayerInventory.drop` now refuses only an exact 0.
- **Dispenser and dropper (302 records)**: port required `count > 0` when choosing the slot and keeping the result; native takes any non-null slot (a -2 stack dispenses one and becomes -3). Fixed in `dispense.js`.
- **Already native**: furnace smelting and fuel (1500 records), brewing ingredient and bottles (720), hopper push, pull, furnace, dropper, dispenser and pickups (13 scenarios). Hopper probe/replay now accept a size-0 stack (count -999 convention).
- New files: `tools/probes/NegStacks3Probe.java`, `tools/verify-neg-stacks3.mjs`, `tools/neg-stacks3-scripts.mjs`, `tools/neg-stacks3-hopper.mjs`, `public/research/neg-stacks3-reference.json`, `src/neg-stacks3.test.js`; `tools/inventory-replay.mjs` extended; `public/research/combat.md` section added.

## Verification
- `MC_RESEARCH=.../tools/research node tools/verify-neg-stacks3.mjs` regenerates the reference.
- `node --test src/neg-stacks3.test.js`: 7 tests pass. Full `npm test` and `npm run build`: 4692 tests, 4692 pass, 0 fail; `npm run build` ok.
- No browser check.

## Follow-ups
- Proposed gap lines for `remaining-gaps.md`: (a) `CreativeContainer.drop` keeps a `count > 0` filter; unprobed. (b) Hopper negative-stack coverage is one layout per scenario, not every facing or double-chest case. (c) Entity feeding and interaction at size <= 0 (wolf, ocelot, sheep dye) is still bytecode-read only (leads2 track). (d) Give motion is compared at 1e-4, not bit for bit (float and table sine).
- Remove the now-stale "/give adds to the inventory first" gap line from `remaining-gaps.md`.
