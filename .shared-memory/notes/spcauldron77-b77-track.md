# Batch 77 spcauldron77: single-player block-click item swallow and entity-click swing

## Summary
- `src/block-activation.js` (new): `swallowsItemUse(block, STATIONS, jukeboxLoaded)`. `player-edit-simulation.js` uses it for `usesBlock`, so the held item's right-click (bucket, potion, bottle, food, sword block, bow, rod, boat, map, armour, book, ...) is skipped when the client-world `onBlockActivated` answers true. Newly swallowing: cauldron (any item, empty hand, any level), fence and nether fence, wooden button, comparator (both states). Jukebox now swallows only when loaded (meta != 0); it used to swallow always.
- Food and sword blocking on a block click no longer start when the block swallowed the click (`!usesBlock`).
- Entity clicks never swing (`interactEntityFirst`, the declined-entity swing at the old line 245, item-frame interactFirst in `hanging-interaction.js`), except EntityCreeper.interact (flint and steel) which calls swingItem itself.
- Tests: new `src/spcauldron77-b77.test.js` (5). Updated old-gap tests: `spuseorder76-b76` (entity result swung once -> 0) and `player-edit-simulation.test.js` (leather armour on a level 0 cauldron used to equip; now swallowed).

## Evidence
- Bytecode-read (`javap -c -p` over the whole jar, every class with `a(ahb,int,int,int,yz,int,float,float,float)Z`): ajw cauldron returns true first when `ahb.E` (remote), then true for empty hand; the client world is remote, so any cauldron click returns true. Same remote-true start: anvil ajb, beacon ajg, bed ajh, brewing stand ajq, chest ajx, command block akb (always true), comparator akc, workbench ake, dispenser akm, dragon egg akp, enchanting table aks, ender chest akv, fence akz, fence gate ala, furnace ale, hopper aln, lever alv, note block amj, repeater anf, button ajs, cake aju, doors akn and trapdoors aoe (iron answers true too). Conditional: jukebox alq (meta 0 false), flower pot ald (true only when a plant is accepted), TNT aob (flint and steel only). False: redstone ore amz (super), piston base app, stairs ans (base block). Block classes were named by their registry strings.
- Bytecode-read `bao.am` (rightClickMouse): ENTITY branch: `bje.b` true clears the flag, no swing; BLOCK branch: `bje.a` true clears the flag and calls `bjk.ba` (swingItem); only a still-set flag reaches `bje.a(player, world, stack)` (sendUseItem), no swing. `bje.b` sends C02 then `yz.q` (interactWith), no swing. Callers of swingItem (`ba`): bao, bjb, nh, xz (EntityCreeper), acv (ItemFishingRod).
- Note: the brief said entity interaction swings when it returns true; the bytecode shows it does not (except the creeper). Followed the bytecode.
- The server-side activation still runs `onItemUse` after a declined block, so placing a block against a fence or cauldron keeps working (the dispatcher falls through as before).

## Verification
- `node --test src/spcauldron77-b77.test.js`: 5 pass. Targeted importers of player-edit-simulation / hanging-interaction: see lead report. No full npm test, no browser.

## Follow-ups
- A declined block click with a non-placeable item still swings in SP (native swings only on activate or successful placement); not changed.
- Jukebox client prediction in client-prediction.js / client-books.js (multiplayer) still use `STATIONS` and were not touched; the port-side meta for a loaded jukebox is read from world meta (1) as in jukebox.js.
- Piston-moving block click (apr) not modelled.
