# Batch 66 mptrade: villager trading over a connection

## Summary
- `src/multiplayer/server-trade.js` (new): `ServerTrade` opens the merchant window for a villager click (`interact`), sends `tradeList`, handles `tradeSelect`, releases the customer on close/disconnect, awards the craft statistic. Exports `openTrade(sim, player, mob)` and `installTrade(sim)`; `simulation.js` does `this.mobs.villagerUse ??= installTrade(this)`, so mpvillage's `sim.mobs.villagerUse` entry is already filled (lead: keep one of the two joins). Adds `villager` to `SUPPORTED`.
- `src/multiplayer/client-trade.js` (new): client merchant container, `tradeList` apply (disabled -> uses 7/7 as `MerchantRecipeList.b(et)`), `tradeSelect` wiring.
- Hooks: `simulation.js` (construct, `tradeSelect`, `removePlayer`), `server-containers.js` (`canInteract` for a merchant window), `server-mobs.js` (villager branch in `interact`; `target` reads the customer), `server-dimensions.js` (`tradeSelect` entry point), `server/server.js` (route), `client.js` (`tradeList` in WINDOW, `tradeSelect()`), `client-containers.js` (build/apply/wire).
- `merchant-ui.js`: the result slot now reports `onCraft(stack, amount)` (SlotMerchantResult.onCrafting); `main.js useMerchant` hooks it to `statsLive.crafted`.
- Wire messages: `openWindow kind:'merchant'`, `tradeList {windowId, offers:[{buy,sell,buyB?,disabled}]}`, `tradeSelect {windowId,index}`.

## Evidence
- Bytecode-read: `EntityPlayerMP.a(agm,String)` (displayGUIMerchant): S2D type 6, then window id int + `MerchantRecipeList.a(et)` (byte count; buy, sell, hasSecond, second, disabled; no uses/maxUses) as `MC|TrList`.
- Bytecode-read: `EntityVillager.a(yz)`: refuses spawn egg, dead, already trading, child; no sneak or name-tag test (the brief's guess was wrong). `MC|TrSel`: int, not range checked, `ContainerMerchant.e` -> `InventoryMerchant.c` recalculates. `ContainerMerchant.a(yz)`: customer == player; `EntityAITradePlayer` (`vl`) clears the customer (then the window closes). `useRecipe` (`yv.a(agn)`) has no XP orb (that is 1.8) and no stat; already ported.
- Bytecode-read: `SlotMerchantResult.onPickupFromSlot` calls `ItemStack.onCrafting(world, player, amount)` -> craft statistic by the taken amount; no achievement. Single player did not count it before; fixed.
- Executed: only the existing replay (`villager-trading-live-reference.json`) for the container and villager rules. The wire is node-tested, not run against Java.

## Verification
- `node --test src/mptrade-b66.test.js`: 9 pass. Also one at a time: villager-trading-live 3, merchant-ui 6, mpcontainers-b59 8, mpcontainers2-b60 9, mpinventory-b60 9, mpinventory2-b61 12, mpanimals-b61 11, all pass.
- Full npm test not run (batch rule).

## Follow-ups
- Only a browser could show the GuiMerchant arrows, tooltips and result sound on a connected client; not checked (no browser rule).
- A villager removed while trading keeps the window open (as native: customer not cleared); `mob.customName` as title is unused until name tags exist on the server.
- The client's uses count differs from the server's maxUses (native also sends only `disabled`).
