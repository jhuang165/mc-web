# Batch 76 spuseorder76: single-player right-click order (entity first, item use second)

## Summary
Single player ran the held item's use (bow draw, rod cast, bucket, potion, glass bottle, book, snowball, boat, map, rocket, eye of ender) before the clicked entity. It now follows `Minecraft.rightClickMouse`: over an entity, the entity's interaction runs first and a true result ends the click; only a declined click (or a miss) reaches the item's `onItemRightClick`.
- `src/player-edit-simulation.js`: new `interactEntityFirst` (lead, saddle, spawn egg, villager trade, cure, wolf, ocelot, mooshroom, horse, name tag, shears, feeding, pig mount, dye, creeper flint-and-steel, empty bucket on a cow = milk) runs at the top of `applyPlayerEdit` for right clicks. A declined click no longer swings there (a taken click swings, not for food, before its own effects as before). The old late entity branch keeps only the food/sword use start and the `interact-entity` result. Eye of ender and firework no longer take the block behind an aimed entity as their target.
- `src/buckets-simulation.js`: `useHeldBucket` option `entityOnly` (milking only, no fluid trace).
- `src/hanging-interaction.js`: a right click on a painting is declined (EntityPainting has no interactFirst), only item frames consume it. `src/main.js` (one line): a painting hit passes no block target, so the block behind it is not clicked.
- Repeat delay and held use are unchanged: `UseHold` (rightClickDelayTimer 4) still calls `clickEdit(true)` and the same dispatcher decides.

## Evidence
- Bytecode-read: `javap -c -p` of `bao` (Minecraft) rightClickMouse: ENTITY hit calls `bje.b(player, entity)` (interactWithEntitySendPacket) and clears the use flag on true; BLOCK hit calls `onPlayerRightClick` (clears flag, swings); only a still-set flag with a non-null stack reaches `bje.a(player, world, stack)` (sendUseItem). The method sets the repeat delay to 4 first.
- Port-read: existing entity interaction order kept as it was; EntityItemFrame.interactFirst true / EntityPainting false is from earlier batch notes and recall, not re-read here.

## Verification
Targeted `node --test`: spuseorder76-b76 9/0 (bow+cow, bucket+cow milk, milk bucket+cow, rod+sheep, potion+villager both drink and splash, book+frame/painting, captured dispatch, food decline, swing count); with player-edit-simulation, buckets-simulation, hanging, horse-gear, leash, creeper, villager-trading-live, mpusesweep-b75, mpuse2-b65, player-actions, use-hold and 10 other importers: 318 pass, 0 fail. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Entity-aimed eat/drink with food still swings at the late branch (old behaviour; native client does not swing on entity interact, unverified for the port).
- Minecart/boat clicks and remote (server) entities were not changed; the server path already interacts first.
- Not seen in a browser.
