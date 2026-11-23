# mobrec97 (batch 97) track note

Worktree `wt97-mobrec`, branch `batch97-mobrec97`, from b5fa6dc3d (0.125.0). Nothing here claims full parity.

## Summary (file by file)
- `tools/probes/EndermanWolfProbe.java`, `EndermanWolfScenarios.java` (`run97`): set `b97mr` with 15 bat records (seeds 9701-9716 minus a dropped pool record) and 7 count-0 shears records (9751-9757). `tools/verify-endermanwolf.mjs`: `EW_SET=b97mr` writes `public/research/enderman-wolf-b97mr-reference.json` (bats, ~2.1 MB) and `-b97mr-shears-reference.json`.
- `src/enderman-wolf-replay.js`: `reference97`; the batch regexes now include 7; the player effect compare drops the replay's invisibility sentinel (id 14, duration >= 1e8).
- `src/squid-bat-mobs.js`: removed the bat/player push in `batTick`. Native EntityBat overrides collideWithNearbyEntities (we.bo) and collideWithEntity (we.o) with empty bodies.
- `src/entities.js`: `shear()` tests the held item id (or a count in the inventory) instead of only the count, and the break keeps the size-0 stack in the hand (`wear(id,1,'held')`); `attack()` destroys a size-0 held stack after a landed blow.
- `src/inventory.js` `damage(..., 'held')` and `src/survival.js` `wear(id, amount, keepEmpty)`: keep the broken stack at size 0.
- Tests: `src/mobrec97-b97.test.js` (22 replays plus pins). Old test edits: `src/mobrec96-b96.test.js` source-pin regex allows `,'held'` (pin only); `src/leads2.test.js` helper no longer clears a size<=0 stack after a successful shear. The old helper encoded non-native dispatch: the real dispatcher (`player-edit-simulation.js`) returns before the clean-up, and the old test only passed because the port refused to shear a count<=0 stack.

## Evidence
- Executed: bat records (flight, hang, wake, hurt, glass step, cart-free push) match the port except the push; shears: break leaves `[359,0,0]`, the next sheep click shears again (damage 0 to 1 to 2, count stays 0), a melee blow clears the slot to null, wheat replaces it normally, a lamb is not sheared, a mooshroom shear clears the stack (9755/9756, unchanged port behaviour).
- Bytecode-read: EntityBat collide methods empty, canBePushed false; ItemStack.damageItem; EntityPlayer.interactWith destroys the stack only when interactWithEntity returns true (EntitySheep.interact does not).
- Port-read: server shears go through `EntityWorld.shear`, so the fix covers them.

## Verification
- `node --test --test-concurrency=2` over 38 chosen files (combat, enderman-wolf, inventory, mobrec90-97, mooshroom, mpcombat/mpinventory, sheep, squid-bat, leads2, zerostacks and shear/animal-use files): 651 tests, 650 pass; the one failure (leads2) was fixed as above and leads2 passes alone (11/11).
- Fails-without-fix: reverting entities/squid-bat-mobs/inventory/survival makes 8 of the 26 mobrec97 tests fail. Restored, 26/26 pass.
- `npm run build` not run (no imports of new modules changed beyond a test import). No browser checks.

## Found wrong in the batch 96 list
- The batch 96 note treated a count-0 shears stack as empty; native keeps it and it still shears (fixed in the live path).
- Bats were pushed by the port; native bats push nothing.

## Follow-ups (open)
- Villagers: not started. Villager AI task, door, breeding, trade-unlock records need villager types, door setup and village ticks in the EW probe and replay; existing village records cover fights, trading, restock, mating gates. Left open.
- Dropped the bat-in-pool record: the probe World double has no splash particles while the port draws them (probe artefact, not proven native).
- Multiplayer client prediction (`src/multiplayer/animal-use.js` line 65) still needs `survival.count(SHEARS)`, so it will not predict a ghost shear; the server decides, so only the prediction differs.
- Browser-only: none seen.
