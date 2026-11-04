# Leather armor washing in cauldrons

The live right-click path uses the original cauldron rule from Java 1.7.10: any leather armor stack consumes one water level, even if it has no explicit dye color. A dyed stack loses its `color` tag while keeping its other supported ItemStack metadata. Water use is the same in Survival and Creative; an empty cauldron does not handle the armor click. Armor count and durability stay unchanged.

`src/stone-utility.js` exposes the stack/water transition, and `src/player-edit-simulation.js` applies the new stack and cauldron metadata to the live world, updates the hotbar and marks changes for saving. The existing water-bucket filling path remains intact.

## Native evidence

`tools/probes/CauldronWashProbe.java` invokes unchanged `BlockCauldron.onBlockActivated` and `ItemArmor` methods using native item stacks and a map-backed native World fixture. `MC_RESEARCH=../tools/research node tools/verify-cauldron-wash.mjs` regenerates [`cauldron-wash-reference.json`](cauldron-wash-reference.json): 128 cases across four leather pieces, absent/black/`0x123456`/default tan color tags, water levels 0–3 and both game modes, plus eight non-leather checks. The native return value, resulting water level, held color/count and block writes are replayed in `src/stone-utility.test.js`.

First-person and third-person held items and dropped leather sprites use the saved color for the base icon and the original overlay texture without tint. Their cache keys include the resolved color (including black), overlay materials retain the correct item light, and glint passes follow both layers. Renderer material tests in `src/leather-items.test.js` cover tint, layer separation, color changes, and disposal of owned glint materials across multiple dropped copies.
