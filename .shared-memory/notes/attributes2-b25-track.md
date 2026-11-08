# attributes2 (batch 25): live max health and speed, Count 0 reads, zero-size use, break pitch

## Summary
- **New probe.** `tools/probes/Attributes2Probe.java` and `tools/verify-attributes2.mjs` write `public/research/attributes2-reference.json` from the unchanged 1.7.10 classes. It holds 369 records: maxHealth 152, tame 3, aiEnabled 29, noAttributes 8, horseRide 5, itemRead 12, use 80, rightClick 76 and breakPitch 4. `src/attributes2.test.js` (14 tests) replays it.
- **Max health.** `mob-riding.js` has `maxHealthOf` and `OWN_MAX_HEALTH`.
  - Wolves, slimes, magma cubes and horses now take saved max-health bases and modifiers through `liveAttribute`.
  - A tamed wolf and both slimes ignore a saved base, because setTamed and setSlimeSize reset it. A horse keeps its base.
  - On load, HealF is clamped to the maximum from the saved list, or the constructor base when there is no list (`mob-attribute-list.js loadHealthCap`, applied in `java-mobs.js`). A slime is then healed to its full maximum.
  - Taming (`wolf.js interact`) drops a saved base and sets the health to min(20, maximum).
  - The horse feed and breed paths and the mount bar in `main.js` (one line) use the live maximum. So does the random heal.
  - `mob-nbt.test.js` was updated: a tamed wolf with no list now loads with health 8 (native).
- **Speed.**
  - A baby pigman gets the +50% boost.
  - `LEGACY_MOVE` (entities.js) gives the isAIEnabled=false ground movers a 0.1 ground factor and 0.02 water acceleration.
  - The giant and silverfish speeds now come from the attribute.
  - Ridden horse: `bp` is the attribute with its modifiers, and `aQ` is the prior `bp` × 0.1 (`horse-live.js`).
- **Knockback.** A zombie with no Attributes list loads with knockback resistance 0, with no fresh roll.
- **Zero-size use.** `placeHeldBlock` refuses a held size-0 ItemBlock, ItemReed, ItemSlab or ItemSnow stack in both modes. Redstone dust, doors and cocoa are exempt, as natively. Cake placement in `player-edit-simulation.js` refuses too.
- **Count 0 reads.** These now keep Count 0:
  - `item-entities.js`: `spawn({empty})` on load, and `collect` skips size-0 items.
  - `main.js` (one line): the load read.
  - `region-import.js`: drops and hopper tiles.
  - `entity-summon.js`: `/summon Item`.
  - `survival.js`: hopper load.
  - `inventory-transfer.js`: a size-0 hopper or chest slot moves whole and creates no item. This is recalled from source, not probed.
- **Break pitch.** It now comes from the world Random (`mob-equipment.js breakSoundPitch`), at both entities.js call sites.

## Verification
- `node tools/verify-attributes2.mjs` (MC_RESEARCH=…/tools/research) regenerates the reference.
- `node --test src/attributes2.test.js`: 14 pass, 0 fail.
- `npm test`: 4477 tests, 4477 pass, 0 fail. `npm run build`: ok.
- No browser check was done.

## Follow-ups
- Native negative stacks are not modelled. Redstone, doors, signs, skulls, seeds, wart, spawn eggs, bone meal, minecarts, throwables, food and buckets act at size 0 and leave -1. In Survival the port still needs a real item for these. A held size-0 door or redstone stack with more of the item elsewhere takes from that other stack.
- A Count -1 read (native keeps it) is still dropped.
- Bed use at size 0 was not probed: the world double refused even count 1.
- The tamed-wolf health above its maximum (native 34 over 24) is clamped on restore.
- Horse jumpStrength modifiers are not applied.
- The dragon, ghast and squid keep their own movement; only the ground movers use `LEGACY_MOVE`. Enderman and blaze AI speeds remain approximations.
- Chests, dispensers, furnaces and brewing stands still drop Count 0 on read. Native keeps it there too, but it is unprobed and their tick logic was not checked.
- `item-entities.js` and `main.js` are also claimed by pistons3, so expect a small merge. The edits are in `spawn`, `collect`, `load` and one `items.load` line.
- The player's own tool-break pitch (`main.js`) still uses Math.random.
