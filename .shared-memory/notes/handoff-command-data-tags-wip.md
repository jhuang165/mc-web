# Command data tags: work in progress (paused by claude-lead, 2026-11-04)

State: nothing is committed past 877cee5. The uncommitted work is all intended. npm test passed 1793/1793 after the entities refactor. The only later edit is a moved comment in region-import.js (node --check ok).

## Done (uncommitted)
- src/json-nbt.js: an exact port of 1.7.10 JsonToNBT (eb.a), exporting parseJsonNbt, NBTException, NBTHang and canonicalNbt.
  - It returns nbt.js trees: {type, value}; a compound value is a Map; a list value is {elementType, items}; a long is a BigInt; arrays are Int32Array/Int8Array.
  - Native hangs on an empty list element ("[a,,b]"); the port throws NBTHang (a subclass of NBTException) instead.
- Differential evidence:
  - tools/probes/JsonToNBTProbe.java and tools/verify-json-nbt.mjs run against the unchanged jar (SHA1 e80d9b3b…).
  - The output is public/research/json-nbt-reference.json: 119 cases, 0 mismatches.
  - src/json-nbt.test.js has 3 tests.
  - To rerun: `MC_RESEARCH=/Users/programming-xcode/Desktop/mc-web/tools/research node tools/verify-json-nbt.mjs`. It needs a JDK and the log4j-api jar.
- src/nbt-get.js: the NBTTagCompound getters.
  - nbtGet(map, key, type, fallback): any numeric tag converts to any numeric type (narrowing masks bits, floats floor first); any other type must match exactly.
  - Also exports hasNumber and primitiveAs.
  - region-import.js and java-mobs.js now use it.
- src/region-import.js: readItemTag(stack, nbt) is exported.
  - It applies ench, StoredEnchantments, RepairCost, display.Name, display.color and Unbreakable.
  - It returns the ignored keys.
- src/entities.js: mob restoration is factored out as `restore(e)`.
  - It returns a live mob or null; the caller pushes it and does nextId++.
  - It ends with ...this.physics(), which zeroes fire and velocity, so set Fire and Motion after calling it.

## Remaining: native semantics, from bytecode
These were verified against at/bu/bm/bx in the 1.7.10 jar.
- **Tag text:** args from the tag index onward, joined with " ". No selector expansion.
- **/give (tag at index 4):**
  - A parse error or a non-compound tag gives notifyAdmins feedback, which is white and not thrown: tr("commands.give.tagError", msg | "Not a valid tag"). Then return; nothing is given.
  - Otherwise apply readItemTag to the stack.
- **/summon (tag at index 4):**
  - Base position: floor(x)+0.5, floor(y+0.5), floor(z)+0.5. The coordinates are relative to that base.
  - Not in world: feedback "commands.summon.outOfWorld" and return. This is NOT a throw; today the code throws.
  - The tag is parsed next; a tagError is feedback + return.
  - Any tag, even {}, means onSpawnWithEgg is skipped: the sheep Color tag defaults to 0 and the zombie knockback bonus is 0.
  - The entity is created from id = args[0]; null gives feedback "commands.summon.failed". This is also not a throw.
  - Position is x, y, z, keeping the entity's own rotation; then spawn.
  - `Riding` chain: native spawns and mounts each rider. The port has no riding: spawn the riders unmounted and add a gray note.
  - Success gives feedback.
  - Planned in java-mobs.js: `summonedMobRecord(type, tag, {convertItem})`.
    - Fields: Rotation, HealF/Health, ActiveEffects, Age/InLove, sheep Color/Sheared, villager Profession/Riches/Offers, golem PlayerCreated, zombie IsBaby/IsVillager/ConversionTime, creeper powered/ignited, witch Equipment[0].
    - Then call mobs.restore({...record, x, y, z}), push it and do nextId++.
    - Then set fire (Fire) and vx/vy/vz (Motion, using 0 when |v| > 10).
- **/setblock (tag at index 6):**
  - The tag is parsed only when the block has a tile entity. A tagError is THROWN (red).
  - outOfWorld is checked before the tag is parsed.
  - Modes: "destroy" breaks the old block with drops BEFORE the same-block check; "keep" gives noChange unless the target is air; any other mode string means replace. Today the code usage-errors on unknown modes, which is not native.
  - If setBlock returns false: noChange.
  - With a tag, put x, y, z into the tag and then call tile readFromNBT.
  - Plan: refactor the container tile readers in region-import.js (the tile loop near line 290: Chest/Trap/Dropper/Hopper/Cauldron/Furnace) into an exported function. Write to survival.chests/furnaces/dispensers/hoppers/brewing[key].
  - The chest record needs `facing`; see the chest.js settleFacing/newChest helpers.
- **/testforblock (tag at index 5):**
  - The block comes from the registry; an unknown name gives "commands.setblock.notFound".
  - The tag is parsed only when the block has a tile entity; a tagError (key "commands.setblock.tagError") is thrown.
  - Next comes the block check (failed.tile), then the meta check (failed.data).
  - With a tag and no tile entity: "commands.testforblock.failed.tileEntity" (x, y, z).
  - Otherwise writeToNBT into a fresh compound and compare with func_147181_a:
    - a null means true;
    - b null means false;
    - different classes mean false;
    - a compound requires every key of a to match recursively in b (a subset);
    - anything else must be fully equal, including type (lists compare their element type and every element).
  - A mismatch gives "commands.testforblock.failed.nbt" (x, y, z).
  - The tile writer can be factored out of region-export.js (around line 71).
- **Deviation note:** add a gray "§7Not kept in this build: …" line listing the ignored keys (a port deviation).
- **Tests:**
  - Add src/command-tags.test.js.
  - Update commands.test.js: summon outOfWorld/failed and tagError are now feedback, not red errors.
- **Docs:** extend public/research/commands.md with the deviations: hang → error, the fround double-rounding tie, ignored keys, no riding, no onSpawnWithEgg equipment.

## After data tags (the rest of the gap list)
- The command block (id 137): texture, rising-edge trigger, GuiCommandBlock, the sender, @p/@a/@r, and the commandBlockOutput rule. Also mark func_152372_a as wired in verify-game-rules.mjs.
- The inventory player model: fire overlay and armour glint.
- Stuck arrows use entity id 0.
- Release 0.43.0: bump package.json and the lock file; update parity.md and PROJECT.md; commit (including the untracked handoff notes); then `npm run push:github`.
- Releases run on localhost:5179 (vite dev), never a ChatGPT Site publish. Use `?silent` for browser checks.
- For the user: "Mobs never sleep" is native 1.7.10 behaviour. The hit-sound report is still waiting on their answers (tab age, the Friendly/Hostile sliders, which mob/browser). The code path works, and a silent witch is native.
