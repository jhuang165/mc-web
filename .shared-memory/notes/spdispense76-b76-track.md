# Batch 76 spdispense76: single-player dispenser buckets and level events

## Summary
- Found (executed through the real `createRedstoneRuntime`): the runtime host only forwarded some hooks. `spawnEgg`, `boat`, `armorType`, `equip` and `isReplaceable` were never passed on, so in single player a spawn egg was spent with no mob, a boat was thrown as an item, worn armour was thrown, and a filled bucket never replaced a non-solid block. Fixed in `src/redstone-runtime.js` (a `boat` / `fizz` getter returns undefined without a hook, so a host with none still throws the boat).
- `src/dispense.js`: the Nether branch of `tryPlaceContainedLiquid` now comes before the break (`host.nether()`, `host.fizz(x, y, z)`): in the Nether a water bucket only fizzes, the block in front stays, the bucket is emptied. The server host (`server-container-ticks.js`) got the same two hooks (before, it broke the block, then fizzed).
- `src/sp-dispense76.js` (new): `replaceableCell` (native Material.isSolid via `GenWorld.isSolid` on the original id; the old port `solid()` call would treat a web as passable), `netherFizz` (random.fizz, volume 0.5, float pitch 2.6 + (r - r) * 0.8, cell centre, sound only), `equipArmor` (player first, then loot-picking mobs; the drop chance becomes 2.0).
- `src/main.js`: dispense hooks `isReplaceable`, `nether`, `fizz`, `armorType`, `equip`; `game.auxEffect` draws the level events through `dispenserAux` (shared with multiplayer): 2000 smoke puffs (were not drawn), 2005 bone meal sparkles, 1009 fire charge sound. `src/away-world.js`: `boat`, `isReplaceable`, silent Nether fizz (the away run threw boats as items).
- Sound positions: 1000 / 1001 / 1002 play at the block corner (x, y, z), not x + 0.5 (single player used the centre). Pitches 1.0 / 1.2 / 1.2 were right.
- `src/multiplayer/client-containers.js` `dispenserAux`: added 1009 (mob.ghast.fireball, volume 2, pitch (r - r) * 0.2 + 1, cell centre), which the multiplayer client dropped for fire-charge dispensers.

## Evidence
- Executed: `tools/probes/SpDispense76Probe.java` + `tools/verify-spdispense76.mjs` -> `public/research/sp-dispense76-reference.json`, 240 records of the unchanged BehaviorDispenseFilledBucket (water and lava, 15 blocks in front, 4 facings, Overworld and Nether via WorldProvider.isHellWorld). Facts: air, torch, ladder, snow layer, tall grass, flower, fire, carpet, wheat and liquids are replaced (break with drop, then set); stone, web, glass and sign post refuse (bucket thrown); Nether water: no break, no set, `sound random.fizz 0.5 <pitch>` at x+0.5/y+0.5/z+0.5, bucket emptied; Nether lava places normally. All 240 are replayed in `spdispense76-b76.test.js` (132 placed, 64 refused, 44 fizzed), the Nether pitch matching float for float with `JavaRandom(9)`.
- Bytecode-read (`bma.a(yz,int,int,int,int,int)` playAuxSFX): 1000 random.click 1.0/1.0 and 1001 1.0/1.2, 1002 random.bow 1.0/1.2, all at integer (x, y, z); 1009 mob.ghast.fireball volume 2.0 at +0.5; 2000 loop matches `dispenserAux` (10 puffs). Bytecode-read (`abc`, selector `sp`): armour goes to an alive EntityLivingBase whose slot is empty, an EntityLiving only with canPickUpLoot, a player always (Creative included).
- Port-read: the engine's projectile velocity/inaccuracy, fire charge, TNT, boats, carts, bone meal were already replayed against `dispense-reference.json` (batches 6x); not changed.
- Port-read: WorldServer.spawnParticle draws nothing, so the Nether's 8 largesmoke puffs of a dispenser are not shown in single player (the integrated server world).

## Verification
- `node --test src/spdispense76-b76.test.js`: 8 pass. Related (`dispense`, `away-dispense-b51`, `mpdispense-b61`, `mpbuckets-b75`, `mpcontainers2-b60`, `redstone-live`, `dispenser-container`, `dispenser-piston`, `away-order-b50`): all pass. `npm run build` ok. No full npm test, no browser, no audio.

## Follow-ups
- Armour: the entity chosen is player first, then mob list order; native takes the first of `getEntitiesWithinAABB` (chunk list order). Only zombie/skeleton/pigman types carry gear; other mob types never wear it.
- Boats and carts need the entity systems; the away run's Nether fizz is silent (no audio there).
- Not seen in a browser: the smoke puffs, the corner-positioned click and the new fizz.
