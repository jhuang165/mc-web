# Live anvil container adapter

`src/anvil-container.js` adapts the standalone native-ID rules in [anvil.md](anvil.md) to the browser `PlayerInventory` and generic `Container` click model. It does not create the BlockAnvil block or screen; the caller supplies the experience and world-use callbacks.

## Container contract

`AnvilContainer` exposes native slot indices: 0 and 1 are 64-item inputs, 2 is the result, 3–29 are the 27 main-inventory slots, and 30–38 are the hotbar. `setName(name)` recomputes `output` and `maximumCost`; `canTake()` gates the result on a positive cost and enough experience levels (Creative can take any result). `tooExpensive` is true for survival results whose cost is at least 40. `close()` drops the cursor and both inputs into `drops`.

The constructor options are:

| Option | Purpose |
| --- | --- |
| `inventory` | Required live `PlayerInventory` |
| `creative()` | Current game-mode check |
| `experienceLevel()` | Current player level |
| `payExperienceLevels(cost)` | Charge the positive level cost after a successful survival take |
| `itemName(nativeStack)` | Localized default item name for rename comparisons |
| `onUse({stack,cost,creative})` | Run the caller's anvil-use effects after each successful take; the caller decides damage, sounds and world changes |
| `onInputChanged({previous,current,previousNative,currentNative})` | Notifies when input 0's item/tag identity changes, so a screen can reset its name field |

`liveStackToNative` and `nativeStackToLive` translate the supported registry ids and item tags. Internal item IDs map to original 1.7.10 IDs for repair and enchantment calculations; legacy book `.stored` maps to native `StoredEnchantments` and returns with both aliases available to the existing book UI.

## Behavior and evidence

The adapter calls the unchanged pure `updateRepairOutput` logic, so material repair counts, rename costs, RepairCost, enchantment compatibility and Too Expensive rules use the same 1.7.10 implementation already replayed against `public/research/anvil-reference.json`. `takeOutput()` charges levels through the caller, consumes inputs, recalculates the result, then invokes `onUse` for both survival and Creative takes. Shift-click follows `ContainerRepair.transferStackInSlot` (`zu.b(yz,int)`) as read from the pinned client JAR with `javap`: result slot 2 merges into slots 3–38 in reverse order; input slots 0–1 merge into player slots 3–38; player slots 3–38 merge into input slots 0–1. This 1.7.10 container does not route player stacks between main inventory and hotbar. Output transfer consumes the full anvil operation after any amount moves, so a renamed stackable output can partially fill a matching stack and the unused result is discarded with the consumed inputs, matching the native pickup path.

`src/anvil-container.test.js` covers native/live ID and tag conversion, rename and material-repair transactions, experience charging, the use callback, output click/shift-click including partial stackable output, input/player shift-click routes, input-change notifications, closing drops and unaffordable results. `src/anvil.test.js` remains the native reference replay for the underlying cost and take rules. Transfer routing is checked against the unchanged `zu.b(yz,int)` bytecode; callback ordering and UI integration remain adapter-level behavior.

## Remaining work

Version 0.35.0 wires this container to the anvil block, original GUI sheet and text field, local item names, experience-level payment and the 12% use-damage roll/sounds. Closing drops unfinished inputs, while autosaves snapshot input/cursor stacks into the saved inventory without copying the calculated output. The screen closes if its anvil disappears or the player moves beyond the native eight-block interaction distance. Experience saves preserve level and fractional bar independently of the native total counter after a payment.

The partial result transfer and input routing match the inspected `ContainerRepair` bytecode, but this adapter itself has not been executed inside the original Java container. Automated component/action/save checks pass; browser import/interaction acceptance was blocked by file-picker/CDP availability, so GUI pixel and full gameplay acceptance are still open. Falling impact callbacks currently damage players and living mobs; nonliving target damage remains unfinished. Native GL rendering, network packets, remaining enchantment effects/glint and falling-entity RNG reload continuity are not claimed.
