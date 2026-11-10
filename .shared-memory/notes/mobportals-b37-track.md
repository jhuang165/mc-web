# mobportals (batch 37)

## Summary
- Shared Teleporter cache (goal 1). `DimensionLive` keeps one `destinationCoordinateCache` per root and dimension; the player's `arrive` and the mob/item/orb/cart/boat `peekFor` Teleporter (`shareTeleporter`) use the same entry, as the native per-WorldServer Teleporter does. Tests: mob arrival seeds a later player arrival and the reverse.
- Clock (goal 2). `removeStale` uses the save-wide total time (`host.totalTime()` from `mobs.saveTotalTime()`); Nether and End `DerivedWorldInfo` delegate to the Overworld's, so this is the destination world's time. Fallbacks: record `totalTime`, then page ticks.
- Minecarts and boats (goal 3). `EntityPortals.step` handles `cart`/`boat`; `tickEntities` departs them, `deliver` places them with the shared Teleporter and merges them into the destination's `minecarts`/`boats`. Contents, UUID and `portalCooldown` (JSON, NBT for carts) survive. Riders stay behind (native); collision ignored with a rider or when riding.
- Native evidence. `EntityPortalProbe.java` executes real `xl.h` / `xi.h` for 8 vehicle scenarios and 8 persistent-Teleporter cache sequences; `entity-portal-reference.json` has 99 records (83 old unchanged). Docs: "Batch 37 portals" in `public/research/loading-screens.md`.

## Verification
Focused: `entity-portal.test.js` 23 pass, `dimension-live.test.js` 21 pass, `minecarts.test.js` 6 pass, `boats.test.js` 88 pass; `exit-prewarm.test.js` 9 pass, `ring-ticks.test.js` 8 pass, `module-names.test.js` 1 pass. Browser (muted headless Chrome, port 5374, load 3.5, `artifacts/b37-mobportals/cart.mjs`, screenshot `nether.png`): a minecart standing in a lit Overworld portal left the cart list within 4 s, the Nether inbox received it at (17,51,6) with its Teleporter's 80 block writes, then the player's own `travel(-1)` arrived at the same portal (17,51,6, shared cache) and the cart was in the Nether's cart list; no page errors. The full `npm test` and `npm run build` were left to the lead.

## Follow-ups (proposed gap lines)
- Cache replay record 0 (seed 3000): the second Nether portal is built at a different site than the native Teleporter (leftover obsidian frame beside the site); the test replays only its first two steps. Find the validity difference in `Teleporter.makePortalSteps`.
- Share the Teleporter `Random` between arrivals in the player path (natively one persistent Random per world).
- A player riding a cart blocks the cart's portal trip in the port; natively the cart goes and the player stays.
- Away-tick carts and boats (worker, `away-*.js`) do not travel through portals.
- The portal clock does not advance for unloaded dimensions or loading screens.
