# Batch 78 loot78: mob floor pickup for every mob, server mobs, zombie villager armour

## Summary
- `entities.js` `lootPickupOne`: the `GEAR_TYPES` gate is gone. Any living mob with `canPickUpLoot` runs the pickup loop (a type without gear arrays gets them). `mob-equipment-live.js` `pickUpLoot` skips only a missing stack (a size 0 stack is picked up).
- Server: `server-mobs.js` gives the server `EntityWorld` a `lootItems` getter onto `host.items`, so server zombies, skeletons, pigmen (and any mob with the flag) pick up server items through the same code. `server-dispense.js` `equip` adds mobs to the candidates via `sp-dispense76.js` `mobCandidate` / `dressMob` (new, shared with single player) and orders players and mobs together with `orderTargets`.
- Renderer: `mob-equipment-renderer.js` no longer skips zombie villagers; the head armour box is the ModelZombieVillager 8x6x8 at (-4, -10, -4). The held item and a pumpkin head are drawn on them too.

## Evidence
- Bytecode-read `sw.e` (EntityLiving.onLivingUpdate): runs only `!isRemote && canPickUpLoot && !dead && mobGriefing`, items in the box grown (1, 0, 1), skips `isDead` or a null stack; slot from `sw.b(add)` (pumpkin / skull 4, armour by type, else 0); empty slot always takes it; sword vs non-sword, equal sword attack then damage or tag, armour by damageReduceAmount then damage or tag; old stack dropped when `nextFloat() - 0.1 < chance`; chance 2.0, persistence, pickup packet, item setDead; the thrown-diamond achievement is not ported. No type test. Matches the existing port.
- Bytecode-read spawn flag: `yq.a(sy)` (zombie, so zombie villager and pigman) and `yl.a(sy)` (skeleton, wither skeleton) call `h(rand < 0.55 * local difficulty)`; `sw.a(NBT)` reads CanPickUpLoot for every mob. Nothing else sets it. So every other type has it only from NBT or tests (already carried by java-mobs.js).
- Bytecode-read renderers: `bnw` (RenderBiped) has two subclasses, `bos` (RenderSkeleton: skeleton, wither skeleton) and `bpf` (RenderZombie, also zombie pigman and zombie villager); `bop` (RenderPlayer) uses `bnw.a(abb, int)` for textures. No other entity renderer reads armour slots, so armour on a cow, creeper, villager and so on is NOT drawn natively: native-correct gap, recorded. `bpf.b(yq)` swaps armour models to `bil(1.0, 0, true)` / `bil(0.5, 0, true)` for a villager; `bil` with the flag builds a 64x32 head box (-4, -10, -4, 8, 6, 8), no nose. Giant (`bnu`) is not a RenderBiped: no armour.
- Not executed: no probe; nothing here needed a new executed row (pickup rules were executed in earlier batches, mob-equipment-reference.json).

## Verification
- `node --test src/loot78-b78.test.js`: 7 pass (any-type pickup, dead mob, size 0 stack, server zombie picks up a server item, server dispenser dresses a flagged cow and skips an unflagged pig, shared selector, spawn flag, renderer source checks).
- Related, all pass (153 with the new file): spdispense76-b76, spdispense77-b77, mpdispense-b61, mob-equipment, mob-gear-nbt, mob-griefing, zero-stacks, ring-events, away-mobs, java-mobs, mpmobs-b59, village-fight-b33. `npm run build` ok. No full npm test, no browser, no audio. The villager armour drawing is not looked at in a browser.

## Follow-ups
- The diamond thrown by a player and picked up by a mob (achievement "Diamonds to you!") is not ported.
- Server pickup uses the server's item list, so the clients' item rows disappear as for any picked item; no pickup-sound/collect animation packet is sent for mob pickups.
- Nether/End server hosts get `lootItems` only if their host has `items`.
