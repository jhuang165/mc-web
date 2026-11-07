# villagers4 (batch 22): arrow at a villager, zombie door player, zero-size armour stack

## Summary
Never claim full parity. Leftovers of batch 21, all three done.
- Skeleton arrow hitting a villager: 52 native records replayed. One divergence fixed (the mob arrow's attacker reached the village as a string, aggressor count 0 instead of 1; `bow.js` and one line of `entities.js`).
- Player as zombie target through a wooden door: 11 native records replayed with no port change (Easy 2.5, Normal 3, Hard 4.5 damage; Hard breaks a closed door and hits on tick 339; Normal never breaks it).
- Zero-size broken armour stack: native does it for the player too; ported for armour slots (Thorns wear and the anvil helmet leave it, `damageArmor` clears it, saves and NBT keep it, death never drops it). The mob path and main-inventory slots stay pinned differences.

## Native evidence
- Probed: `SkeletonArrowVillagerProbe` (`tools/verify-skeleton-arrow-villager.mjs`, `public/research/skeleton-arrow-villager-reference.json`, 52 records).
- Probed: `ZombieDoorPlayerProbe` (`tools/verify-zombie-door-player.mjs`, `zombie-door-player-reference.json`, 11 records).
- Probed: `ZeroArmourStackProbe` (`tools/verify-zero-armour-stack.mjs`, `zero-armour-stack-reference.json`, 30 records: armour value, Protection, NBT, damageArmor).
- Bytecode-read: `mw` (EntityPlayerMP) sets yOffset to 0, so the server player's posY is its feet; `sv.a(ro, F)` helmet hit uses `add.a(int, sv)`; zero-stack drop returns null.
- Assumed: container clicks on a zero armour slot (not probed); a pure `EntityPlayer` with yOffset 1.62 would draw differently in `EntityAIAttackOnCollide` (the host player is an EntityPlayerMP); the player not ticked during the door probe.

## Tests
- `src/skeleton-arrow-villager.test.js`, `src/zombie-door-player.test.js`, `src/zero-armour-stack.test.js` (new); `src/thorns-wear.test.js` pin updated.

## Remaining gaps
- Mob zero-size stack (broken Thorns piece on a mob) still removed; main-inventory zero stacks still rejected; container clicks on a zero armour slot unprobed.
- Door probe: stationary un-ticked player, no second hit, no Peaceful, single zombie.
- Arrow probe: single skeleton and villager; no crowd or multiple shooters.

## Proposed remaining-gaps lines
- Zero-size armour stack: player armour slots port it (probed armour value, Protection, NBT, damageArmor); open: mob equipment, main-inventory zero stacks, container clicks on it.
- Skeleton arrow at a villager (52 records) and the player as zombie target through a door (11 records) are replayed; open: a moving player fighting back, several zombies or shooters.
