# Batch 61 smallchecks3: brewing take hook, comparator item frames (wrong gap), Java 7 effect order

## Summary
- `src/brewing-container.js`: the bottle slots (0-2) now have a take hook. `BrewingContainer.onPotionTaken(stack)` is called from `BottleSlot.onPickup` when the stack is a potion (internal 385) with damage > 0, for clicks and shift-clicks out of the stand.
- `src/main.js` (`openBrewing`): the old per-slot `onPickup` patch (which awarded for any potion id, water bottles too) is replaced by one line `brewing.onPotionTaken = () => achievements.trigger("potion")`. `achievements` is module scope (declared at the `new Achievements` call).
- `src/multiplayer/server-containers.js`: one short addition on the brewing window: `container.onPotionTaken = (st) => this.sim.achievements?.onPotionTaken(p, st)`.
- `src/multiplayer/server-achievements.js`: `onPotionTaken` also requires damage > 0 (it accepted any potion id).
- `src/smallchecks3-b61.test.js`: 5 tests (take hook by click, shift-click, non-awarding cases; Java 7 HashMap hand simulation).
- Comparators and item frames: nothing changed (see Evidence, the gap is wrong).

## Evidence
- Bytecode-read, 1.7.10 jar `akc` (BlockRedstoneComparator) `h(ahb,III,I)` (getInputStrength): reads the diode input, then the block behind (`aji.M` hasComparatorInputOverride -> `aji.g` getComparatorInputOverride), and if the input is below 15 and that block is a normal cube (`aji.r`) the block behind it. No entity, no item frame, no `ahb.a(Class, AABB)` call anywhere in the method. In 1.7.10 comparators do not read item frames (that arrived after 1.7.10). The "Items: Comparators read no item frames" gap and the batch 60 follow-up are wrong; `redstone.js` and `client-comparator.js` already match. No probe records were added (nothing to record; the engine's agreement with the executed comparator records is unchanged).
- Bytecode-read, `zz` (ContainerBrewingStand) adds `aab` slots 0-2 (SlotBrewingStandPotion) and `aaa` for the ingredient. `aab.a(yz, add)` (onPickupFromSlot): if `stack.getItem() == ade.bn` (potion) and `stack.getItemDamage() > 0` then `player.addStat(pc.B)` (the potion achievement), then `Slot.onPickupFromSlot`. So a plain water bottle (damage 0) and a glass bottle do not award. `zz.transferStackInSlot` calls `onPickupFromSlot` (aay.a(yz,add)) after a shift-click, so shift-click awards too.
- Gap "BrewingContainer has no take hook, in single player either" was half wrong: main.js already patched each slot's `onPickup` after the container was made (no damage check). Now a container hook.
- Java 7 effect order: the only JDK on this Mac is Java 19 (`/usr/libexec/java_home -V`, `/Library/Java/JavaVirtualMachines/jdk-19.jdk`). No Java 6/7 runtime, so Java 7 is NOT executed. The test has a hand simulation of Java 7 `HashMap` (hash `h ^= h>>>20 ^ h>>>12; h ^ h>>>7 ^ h>>>4`, head insertion, resize reversing chains, recalled from source) cross-checked against the existing `JavaHashSetOrder("java7")` over 400 random id sets, and equal to the Java 8 choice for ids 1..15. For ids 16..23: 16<->17 etc. swap buckets, and a chain takes new keys at its front.
- Which runtime ships with 1.7.10 is not decided by the jar (recalled: the 2014 launcher used the machine's installed Java, 6 or 7 then, 8 later; no bundled JRE). There is no evidence for one runtime, so the Java 8 choice stays.

## Verification
- `node --test src/smallchecks3-b61.test.js src/brewing.test.js src/brewing-transfer.test.js src/smallchecks2-b60.test.js src/b60-lead.test.js`: 17 pass, 0 fail.
- `node --check` on the four touched source files: ok. Hook identifiers: `achievements` is used elsewhere in main.js at module scope (line ~613).
- `npm run build`: ok. Full npm test not run (batch rule). No browser checks.

## Follow-ups
- Item 4 (named): fixed the server `onPotionTaken` damage > 0 check, the one cheap self-contained leftover. The other batch 60 follow-ups (S1D login burst, tile signals to clients, mob copy draws) are multiplayer and belong to other tracks.
- Java 7/6 effect order stays reasoned, not executed; would need a Java 7 JDK.
- Only a browser would show the toast when taking a potion from a stand.
