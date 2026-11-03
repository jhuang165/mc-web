# Live item durability and Unbreaking

`PlayerInventory.damage` now routes supported damageable live stacks through the unchanged 1.7.10 `ItemStack.attemptDamageItem` port in `src/enchantments.js`. The adapter in `src/item-durability.js` maps browser tool, armour, bow, shears, flint-and-steel and hoe IDs to vanilla IDs so the native helper applies Unbreaking's item-type-specific random sequence (armour first tests `nextFloat() < 0.6`; other items use `nextInt(level + 1)`). The live item definition remains authoritative for its damage limit. Creative mode and Unbreakable remain no-wear paths.

`survival.inventory.random` is a `JavaRandom`. Its internal `save()` state is stored as `inventoryRandom` in `Survival.serialize()` and restored by `new Survival(playerRecord)`. Old saves migrate with a fixed seed-zero stream and incur no RNG draws for unenchanted or otherwise protected wear. The same stream is available to live anvil damage code. This is scoped item RNG state, not persistence of all native player random sources.

The adapter reuses the 500-case native Unbreaking/negate replay in `public/research/enchantment-reference.json`. Focused live tests compare tool, golden-tool and armour decisions plus RNG state against `attemptDamageItem`, cover save/resume, and assert no draw for unenchanted/Creative/Unbreakable durability. Drag placement and its UI preview preserve all supported ItemStack tags, including names, repair cost, enchantment lists and Unbreakable.

Focused command: `node --test src/item-durability.test.js src/inventory.test.js src/survival.test.js src/enchantments.test.js`. The live inventory, GUI, anvil adapter and experience integration checks also pass after block registration. Full-suite results are recorded in the release handoff.
