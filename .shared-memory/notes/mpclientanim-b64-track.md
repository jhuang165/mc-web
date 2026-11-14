# Batch 64 mpclientanim: connected-client eat/drink/block prediction, remote poses, PvP victim path, overkill

## Summary
- `src/multiplayer/client-use-predict.js` (new): `predictUse(held, survival)` builds the client's own `eating` state when it sends C08: food (needs hunger or alwaysEdible, not Creative), milk bucket and drinkable potion (`drink`), sword (`block`, 72000), bow (as batch 63).
- `src/main.js`: the bow-only line after `multiplayer.use(true)` now calls `predictUse`; the tick passes `predicted: !!multiplayer` to `tickPlayerItemUse`. Import added.
- `src/player-item-use.js`: option `predicted`: the crumbs and `random.drink` sounds still run at the native ticks, but no `survival.eat`, no burp and no `finishDrinking` (the server applies them; its burp reaches the eater, its eat/drink sounds skip the eater, so the client must play those itself).
- `src/multiplayer/server-pvp.js`: a landed PvP hit of 18 or more damage awards `overkill` (`sim.achievements.award`).
- Tests: `src/mpclientanim-b64.test.js` (4 tests).

## Evidence
- Bytecode-read (`javap` on `yz.class`, EntityPlayer.attackTargetEntityWithCurrentItem, method `r`): after the landed-hit knockback, `if (f >= 18.0F) triggerAchievement(overkill)`, f being the damage after the critical and enchantment add. It is for any target, so a player victim counts.
- Item (2) was already done and is tested by earlier batches: the server sends `using` (watcher 0 bit 4) in presence (`simulation.js`), `presence.js` `useFlags` gives `blocking` / `aimedBow` to the renderer, `remote-eating.js` spawns the crumbs (executed reference `mpeating-reference.json`, `mpeating-b58.test.js`). Eating and drinking have no third-person arm pose natively (RenderPlayer only reads bow and block). Not changed: gap found already closed.
- Item (3): existing paths verified by test: a player-caused hit goes through `sim.damagePlayer` into `Survival.damage`, `takeHurt` queues S19 status 2 (`healthHurt`), `applyHurtMessage` sets `hurtTime` 10 (camera tilt) and the hurt sound, the knockback queue drains on the victim's next step, and other players' copies get the `hurt` presence flag. Nothing was missing; the new test pins it.
- Recalled, not verified: PlayerControllerMP.sendUseItem running useItemRightClick on the client (basis of the prediction).

## Verification
- `node --check` on every touched JS file. Scope: `predictUse` imported, `multiplayer` and `survival` are module-scope in `main.js`.
- `node --test src/mpclientanim-b64.test.js src/pvp-b63.test.js src/mpeating-b58.test.js src/mpprojectiles2-b63.test.js src/player-item-use.test.js src/passes2-b47.test.js src/swordblock-b48.test.js src/use-hold.test.js`: 50 pass, 0 fail.
- `npm run build`: see report. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Browser: the first-person eat bob and crumbs while connected, the sword block pose, and that a click that opens a GUI does not leave a stray predicted use.
- If the server refuses a use (for example food full there while the client mirror disagrees) the predicted animation still runs to its end.
- The client's own food bar change after eating comes only from the server.
