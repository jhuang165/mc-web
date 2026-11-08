# zerostacks (batch 24) — zero-size stacks on mobs, main inventory, container clicks

## Summary
- New probe `tools/probes/ZeroStacksProbe.java` + `tools/probes/zero-stack-scenarios.txt` + `tools/verify-zero-stacks.mjs` -> `public/research/zero-stacks-reference.json` (42 inventory script cases; records mobThorns 36, mobNbt 3, mobDrop 72, mobXp 12, anvil 60), replayed by `src/zero-stacks.test.js`. Runs on the unchanged 1.7.10 classes (PlayerDamageProbe world double, real EntityZombie, real EntityPlayer drop methods).
- Mob Thorns: a broken piece now stays a size-0 stack with damage 0 (`thorns-live.js`, using `breakStack` and `brokenItemDraws` in `mob-equipment.js`). renderBrokenItemStack's 15 Random floats are drawn, and the random.break sound goes through `breakSound`; the entities.js call site has one line added. Unbreaking was already applied for mobs.
- Mob anvil/falling block: `fallingBlockHelmet` (mob-equipment.js) is called once from `entities.js attackEntityFrom`, after the fire-resistance refusal. It wears the helmet-slot stack and multiplies the damage by 0.75; a broken helmet stays at size 0 and keeps its point.
- Mob NBT: `readGear`, `mobGearNbtFields` and region-import `convertItem` (now `{allowEmpty}`) keep Count 0; the export already wrote it. dropEquipment/pickUpItem roll but never drop a size-0 stack. XP counts it, as natively.
- Main inventory: the `PlayerInventory` constructor and `javaPlayerFromNbt` keep Count 0 main stacks (native readFromNBT). `PlayerInventory.damage` clears a size-0 stack after any use attempt (all native held-item damageItem callers do), except the keepEmpty armour path.
- Container clicks: the 41 click scripts on zero stacks already matched; no code change.
- The player anvil helmet already matched (armour read before damageArmor); the stale skip in `falling-damage.test.js` is removed.
- `command-host.js` convertItem forwards options.

## Verification
- `node tools/verify-zero-stacks.mjs`: 0 port mismatches; output byte-identical on a rerun.
- `npm test`: 4361 tests, 4361 pass, 0 fail.
- `npm run build`: ok.
- Updated pinned tests: thorns-wear (mob rows pass `broken: () => {}` because ThornsWearProbe's double overrode renderBrokenItemStack), zero-armour-stack (main Count 0 kept), level-dat (inventory-odd-slots slot 3 is native `[1,0,0]`), falling-damage.
- No browser check.

## Follow-ups
- Zero-size block, food or armour used from the hand is not guarded: native ItemBlock.onItemUse refuses stackSize 0, while the port's consume path would place a block and clear the slot. This can only be reached through NBT imports or container moves.
- The player's renderBrokenItemStack (15 Entity.rand floats) is not modelled; the player's inventory.random stands in.
- The mob random.break pitch uses Math.random, not the world Random.
- Rendering a zero stack on a mob is bytecode-read only (RenderBiped draws any non-null stack, and the port does too); there is no native image comparison.
- Plain `itemStackFromNbt` (hoppers, item entities, /give) still rejects Count 0, which is unprobed for those paths.
