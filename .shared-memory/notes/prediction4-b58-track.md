# Batch 58 prediction4: held-stack, button, comparator and Nether-water client prediction

## Summary
- `tools/probes/ClientPredictProbe.java`, `tools/verify-client-predict.mjs`, `public/research/client-predict-reference.json`: probe extended to 241 records. New cases: wooden button, comparators 149/150 (12 modes), 15 station and tile blocks (chest, ender chest, anvil, enchanting table, brewing stand, hopper, furnace, beacon, jukebox with and without a disc, command block with and without a tile), flower pots (13 held items), a cauldron with a water bucket, bucket stacks (empty stack 2 and 16, Creative), Nether water, throwables (snowball, egg, pearl, exp bottle, potion; stack 5, 1 and Creative), and a server-to-client sound chain.
- `src/client-prediction.js`: `dryActivate` handles the wooden button and both comparators; `useKind` draws them; `activateSound` no longer returns the button click; `dryBucketUse` (cells, fizz cell, liquid taken) with `dryBucket` kept as its cells; `heldPlan` and `applyHeldPlan` (the client's own held-stack change with a relative undo).
- `src/main.js` (small hooks): `predictPlace` applies the held plan at the click and no longer plays the place sound at the click; throwables and exp bottles reach the prediction; the queued run undoes the held change before the server half and renders the hotbar; a world reset undoes queued changes; the Nether's smoke shows at the click (y + random, 8 puffs) and the queued run plays the fizz only.
- Tests: new `src/prediction4-b58.test.js` (9 tests). Updated wiring regexes in `client-predict-b57.test.js` and `instantbreak-b55.test.js`, and the button sound assertion.

## Evidence
- Executed (probe on the unchanged 1.7.10 jar, isRemote world double): button press (meta 1 -> 9, wood and stone); comparator metas; stack decrement on use, throw, Creative restore; bucket swaps and counts; Nether water logs one random.fizz and 8 largesmoke particles by the client world; the sound chain (the server's S29 reaches the clicker and every near player, nobody far or in another dimension).
- Executed comparator rule: with bit 4 set the meta becomes `m & 3`; else 149 sets bit 4 and 150 sets bits 4 and 8. This is the observed result; the bytecode path that produces it was not read.
- Bytecode-read: `RenderGlobal.playSound` is empty, so the client's own `playSoundEffect` is silent; the sound the player hears is S29 from the server. Aux effects (door 1003, break 2001) are played locally.
- Recalled: `PlayerControllerMP.onPlayerRightClick` sends C08 after the client's own `onBlockActivated` / `onItemUse`, and an emptied main-inventory stack is cleared from its slot.

## Verification
- `node --test src/prediction4-b58.test.js src/client-predict-b57.test.js src/client-predict-b56.test.js src/instantbreak-b55.test.js src/block-clicks-b51.test.js src/block-clicks-b52.test.js src/player-edit-simulation.test.js src/buckets-simulation.test.js src/buckets.test.js src/redstone-blocks.test.js src/redstone.test.js`: 169 pass, 0 fail. `src/crystal-fire-b57.test.js src/dimension-rules.test.js`: 9 pass.
- `node tools/verify-client-predict.mjs`: 241 records.
- `npm run build`: ok. Full npm test not run (batch rule). No browser check.

## Follow-ups
- Gap "native may click twice": found wrong. The client's own click is silent; one S29 click arrives (the port used to click twice for the stone button, now once).
- Gap "Nether fizz not shown at the click": found wrong in part. The client shows only smoke at the click; the fizz is the server's S29. The port played the fizz at the click by accident and again at the run; it now shows smoke at the click and the fizz once at the run. The place sound at the click (b55) was also not native; it now plays at the run.
- Open: empty-bucket stacks above 1 (the filled bucket goes to another slot natively; left to the server). Flower pot contents (stored outside the overlay in `world.pots`; the probe records the metas). Command block screen at the click needs a server-provided tile; the probe shows no screen without one. Dragon egg client particles. Potion and exp-bottle throws only take the stack count (exp bottle included; potion not wired). Other tile-entity clicks (chest, furnace, hopper, beacon and so on) change nothing on the client world: nothing to draw.
- Browser check worth doing: hotbar count drops at the click and settles with the server; water bucket in the Nether shows smoke once, fizz once.
