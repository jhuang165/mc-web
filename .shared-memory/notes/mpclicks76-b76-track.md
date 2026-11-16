# Batch 76 mpclicks76: client prediction of entity clicks, owner death throw, server /setblock table names

## Summary
- `predictAnimalUse` (multiplayer/animal-use.js) now predicts the batch 75 server clicks: name tag with a display name on any living mob (customName, persistent, one tag in Survival), spawn egg on an ageable mob (click consumed, one egg spent only when the egg class fits the mob, villager included), flint and steel on a creeper (ignited, tool worn). Creative keeps stacks. An adult villager and a tamed wolf/ocelot take the click first, so no name tag is predicted there; a wrong guess is corrected by the existing `animResend`. No sounds are predicted (the server's `except: null` sounds reach the clicker). `entities.js`: `AGEABLE_EGG_TYPES` exported. main.js untouched (it already calls `predictAnimalUse` and sends `claim`).
- Owner death throw: no code change needed. The server moves a dead player with the throw velocity and the owner's `players` row carries that position, which `applyMultiplayerTick` applies to the camera; verified end to end (first tick at the death spot, then +x/+y motion). Only a native-style S12 packet is absent, by design (b75).
- Server `/setblock ... enchanting_table {CustomName:"x"}`: already works in the Overworld and the Nether (command-host.js `original === 116` branch runs through server-worldcmds.js; the player's `tableNames` is the same store; serialize saves it; replacing the block drops the name). Added regression tests only.

## Evidence
- Bytecode-read: EntityPlayer.interactWith (`yz.q(sa)`): `target.interactFirst` (sa.c) first, then `ItemStack.interactWithEntity` (add.a) for a living target, Creative uses a copy of the stack, a stack at size <= 0 is cleared outside Creative.
- Port-read: server-use-entity.js, animal-use.js order; server-worldcmds.js, command-host.js, tile-names.js.
- Executed: `src/mpclicks76-b76.test.js` compares the prediction with the real DedicatedSimulation result for name tag, egg (fitting and not) and flint; death and setblock tests drive the real simulation.
- Not claimed: ItemNameTag/ItemMonsterPlacer client-side behaviour was not run in a native probe.

## Verification
`node --test`: mpclicks76-b76 7/0, mpanimals-b61 11/0, mpusesweep-b75 10/0, mpplayerfx75-b75 9/0, mpworldcmds-b68 11/0, mpuse2-b65 27/0, tilenames-b74 6/0. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Horse clicks (feed, gear, mount) are not predicted; the client has no horse stand-in rules.
- Leash clicks and a villager's trade window stay server-driven.
- A native S12 for the owner (separate from the position stream) is not modelled.
