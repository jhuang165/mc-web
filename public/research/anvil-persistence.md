# Item tags and anvil persistence foundation

This tranche makes the supported 1.7.10 `ItemStack` tags survive browser inventory operations and save conversion. It builds on the standalone anvil rules in [anvil.md](anvil.md); it does not connect `ContainerRepair` to a live anvil block or screen.

## Stack representation

Browser stacks keep the existing `{id, count, damage}` shape and add these optional fields:

| Browser field | Java 1.7.10 item tag |
| --- | --- |
| `repairCost` | `RepairCost` (int) |
| `displayName` | `display.Name` (string) |
| `enchantments: [{id,lvl}]` | `ench` (list of compounds with short `id` and `lvl`) |
| `storedEnchantments: [{id,lvl}]` | `StoredEnchantments` (same list shape) |
| `unbreakable` | `Unbreakable` (byte) |

Enchanted books retain the older `.stored` alias used by existing book content and tooltips. `sameStackItem` treats it as the `storedEnchantments` tag when no canonical field is present. A legacy empty `.stored` means no tag; an explicit `storedEnchantments: []` remains an explicit empty tag. Pair order and explicit empty enchantment lists are preserved. `copyStack` deep-copies both lists.

`PlayerInventory` now deep-copies these fields through slot reads, copies and splits. Slot merges and dropped-item merges compare all supported tags, so names, repair costs and enchantment variants stay separate. An `Unbreakable` stack does not lose durability. The tooltip displays custom names, enchantment lines and the Unbreakable label.

## Save and Java interchange

Local player, chest, furnace, dropped-item and chest-minecart records retain the metadata in browser JSON saves. Browser import validates and retains cart item tags. Java region import reads `ench`, `StoredEnchantments`, `RepairCost`, `display.Name` and `Unbreakable` for supported items in chest/furnace inventories and dropped items; unknown item-tag fields still count as stripped. Java save export writes the supported fields on player items, container items, dropped items and chest-minecart contents. Existing unmapped item reporting and conversion limits still apply.

Regression coverage includes stack split/copy/save round trips, tag-sensitive inventory and dropped-item merging, Java region import, Java region export, and chest-minecart JSON/NBT conversion. `node tools/verify-java-save.mjs` also loads the exported level/region data with the unchanged Java 1.7.10 NBT and `AnvilChunkLoader` classes and checks player `ench`/`RepairCost`/`display`/`Unbreakable` plus chest `StoredEnchantments`/`RepairCost`/`display` tags.

## Remaining limits

- The anvil block, repair GUI, input/output slots, rename packet and live repair-cost transactions are not wired into gameplay. The anvil module remains standalone.
- Enchantment glint and gameplay effects are not implemented. The supported `Unbreakable` tag only stops item durability loss.
- Java region import does not convert minecart entities yet; their item metadata is retained through browser cart saves and Java export when a cart already exists in a browser world.
- Unrecognized item NBT is not round-tripped. The Java save probe parses the exported native storage and sections; it does not instantiate every entity/tile or prove a fully playable Java reload.
