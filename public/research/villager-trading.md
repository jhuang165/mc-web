# Villager trading rules (Minecraft Java 1.7.10)

This is a standalone rules kernel. It is not connected to the villager entity or a trading screen. `VillagerTradingProbe.java` executes the unchanged `MerchantRecipeList` and `MerchantRecipe` classes from the pinned 1.7.10 client JAR; `verify-villager-trading.mjs` records the results in [villager-trading-reference.json](villager-trading-reference.json), replayed by `src/villager-trading.test.js`.

## Covered

- Offer lookup uses item identity and required stack counts. Stack damage and ItemStack NBT do not affect the original `MerchantRecipeList` lookup. A positive index checks only that row; zero or a negative index searches in order.
- Recipe identity checks the first input, optional second input, and output item identities. The native list replaces a matching offer when the new first cost or second cost is lower; otherwise the old offer stays. Different item identities append.
- A successful kernel trade consumes both inputs, copies the result stack, and increments `uses`. Offers disable when `uses >= maxUses`. The native `increaseMaxUses` operation adjusts the limit; `forceDisableOffer` sets uses equal to the limit.
- Save/restore preserves both inputs, output, `uses`, and `maxUses`, matching `MerchantRecipe` NBT. Missing use fields default to 0 and missing `maxUses` defaults to 7.

## Native evidence

The verifier uses the unchanged JAR with SHA-1 `e80d9b3bf5085002218d4be59e668bac718abbc6`. It records six matching cases, seven use-boundary states, one max-use/force-disable/NBT round trip, four list-replacement cases, and four matching-ID recipe-preference checks; a fifth direct comparator case rejects a different output ID. Class SHA-256 values are included in the reference JSON.

## Deferred

- General villager offer generation by profession and JavaRandom, native offer selection/reuse/restock behavior, and VillageCollection integration.
- Villager interaction, the live trading UI, and persistence wiring to `villager.js`.
- Full ContainerMerchant inventory movement and exploit edge cases.

The native probe does not exercise a timed restock; this kernel does not invent one. Full parity is not claimed.
