# entnbt94 (batch 94): DeathTime corner cases and an edge-value NBT audit

## Summary
Not full parity; open items at the end.
- `java-mobs.js`: `readActiveEffects` drops an effect Id that has no Potion (1 to 23 exist). DeathTime import: Health 0 below 20 (negative too) sets `death`; Health 0 at 20 or more sets `deathKept` (and `death` 0); a live mob's non-zero DeathTime and the dragon's become `deathKept`; a crystal has none.
- `entities.js`: `restore` accepts a Health 0 record with a negative `death` or a `deathKept >= 20`; `serialize` keeps them; `deathUpdate` counts `deathKept` on forever for a Health 0 mob (never reaches the removal check); `onDeath` hands a live mob's `deathKept` over to `death` (counts on from it, or stays immortal at 20 or more).
- `region-export.js`: DeathTime = `deathKept` if set, else the dying `death` at Health 0, else 0; the dragon never writes its `death`. A chested horse always writes `Items` (empty list). An item frame without an item writes no ItemRotation / ItemDropChance.
- `enderman.js` (+ renderer): carried id is valid only 1..127 (signed byte), carriedData is kept as a signed byte even with nothing carried; placing masks the data `& 15`; renderer masks `& 15`.
- `cart-variants.js`: DisplayTile = `id & 0xffff` if registered else 0, DisplayData as the high half of the watcher (`<< 16 >> 16`).
- `region-import.js` / `hanging.js`: ItemRotation is Java `% 4` (sign kept), not `& 3` / floor-mod.
- New: `src/entnbt94-b94.test.js` (7 tests), `tools/probes/Entnbt94Probe.java`, `tools/verify-entnbt94.mjs`, `public/research/entnbt94-reference.json`.

## Evidence
- **Executed** (`Entnbt94Probe`, unchanged classes through CommandSummon): Health 0 with DeathTime 25 is saved with 25, 26, 30, 44, 45, 46, 65 after 0, 1, 5, 19, 20, 21, 40 updates (never removed). DeathTime -5 counts to 0 at 5, 14 at 19 and is removed at 25 updates. A live cow keeps -3, 9 and 30. The dragon keeps a loaded DeathTime 9 forever (also at Health 0). A crystal writes no HealF, Health or DeathTime. Edge rows (40): AbsorptionAmount (negative and 1e30 -> 0), effect Amplifier -56b / 127b / int 300 (-> 44b), Duration 0 and -1, Ambient, Id 0 / 24 to 32 / negative dropped (23 kept), villager uses 7/7, 12/7, -1/0 and missing maxUses (7), horse saddle / armor (non-saddle and non-armor items dropped, armor on an untamed horse kept), Ghast ExplosionPower 200, -3, 100000 kept, enderman carried (128 and up, 166, 175 and 300 -> 0, data byte-wrapped 300 -> 44, 200 -> -56, kept with no block), item frame ItemRotation 7 -> 3, -1 -> -1, none without an item, painting unknown Motive -> Kebab, minecart DisplayTile 166 / 200 / -1 -> 0, 65556 -> 20, 300 -> 0, DisplayData 70000 -> 4464.
- **Bytecode-read:** `sv.aF` (onDeathUpdate) does `++deathTime` and acts only when it equals 20; the dragon `xa.aF` uses its own `bB`, never `aA`; `wz` (ender crystal) extends `sa`, not `sv`.
- **Port-read:** the port's removal marker is `death >= 20`, hence the separate `deathKept` counter.

## Verification
- `node --test --test-concurrency=2 src/entnbt94-b94.test.js src/entnbt93-b93.test.js`: 10 pass. With the eight source files reverted from Git, 6 of the 7 new tests fail (the executed-rows test passes by design).
- 45 files naming enderman, cart, hanging, frame, painting, java-mobs, entities, entnbt, region-import/export, effects, summon, horse88/92: 468 tests, 467 pass, 1 fail (enderman.test.js, updated below, now 14/14).
- Wider run over the 133 files naming exportJavaSave, region-export, hangingFromNbt, variantNBT, cart-variants, endermanFieldsFrom, readActiveEffects or serialize(): 1601 tests, 1601 pass, 0 fail (concurrency 2; this ran before the enderman.test.js update, which was then rerun alone: 14/14).
- Old tests changed (they encoded non-native behaviour): `entnbt93-b93.test.js` third test (a Health 0 DeathTime 25 record "does not load"; native keeps it as an immortal corpse); `enderman.test.js` (carried 300 / 0 with carriedData 2 / 7 zeroed the data; executed rows keep it).
- Build not run (no new imports beyond block-registry in cart-variants, an existing module).

## Found wrong in the batch 93 list
- "A live mob with DeathTime > 0 keeps the rotated death pose (the renderer reads deathTime)": not so for the on-screen copy. The client entity is a fresh object built from the spawn packet; DeathTime is not sent, so its deathTime is 0. The live mob only keeps the value in its server entity and NBT (executed). No renderer change needed.
- "Players and the dragon write DeathTime 0": the dragon writes whatever it loaded (executed, 9 stays 9), never a count; a crystal writes none (port already did, now tested).

## Follow-ups
- Players: the port's player export writes DeathTime 0 always; a player saved at Health 0 is not modelled (the player respawns before any save in the port).
- Leash compound and the zombie / horse random attributes were exempted in the edge test (the summon double's empty world has no holder; the random rolls differ per run); the batch 91 round trip covers Leash with a real holder.
- Browser-only: the corpse of an immortal Health 0 mob (the client copy counts to 20 and disappears natively; not viewed), negative ItemRotation frame drawing.
