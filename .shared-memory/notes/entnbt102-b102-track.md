# entnbt102 (batch 102): entity NBT load/save edges (default health, modifier Name text, zombie cure, villager Offers)

## Summary
- `src/java-mobs.js`:
  - A mob loaded with neither HealF nor Health reads the type's constructor maximum (`nativeMaxHealth`, from the `JAVA_ATTRIBUTE_BASES` table: bat 6, squid 10, ocelot 10, ghast 10, enderman 40, iron golem 100, wither 300, dragon 200, horse 53; ender crystal 5). It was a flat 20 for every type without its own entry.
  - A saved Health / HealF above the type's constructor maximum is clamped to it when the record carries no Attributes (Bat `Health:7s` reads 6, as every other type already did with an Attributes list).
  - Zombie `ConversionTime` above -1 adds Strength (id 5, amplifier 0, duration = the time) after the saved ActiveEffects, with `PotionEffect.combine` against a saved Strength (longer duration at equal amplifier, higher amplifier wins).
  - Villager `Offers`: an Offers compound always makes a (possibly empty) trade list (`Offers:{}`, `Recipes:[]`, `Recipes:5` all give `[]`; was "no offers", so the villager re-rolled its trades). A `buyB` that loads as no stack (`buyB:{}`) is dropped and the trade stays (it dropped the whole trade).
- `src/mob-attribute-list.js`: a modifier `Name` that is not a string tag is kept as the tag's text (`nbtTagText`: `5`, `5b`, `5s`, `5L`, `1.5f`, `2.5d`, `[1,]`, `{a:1,}`).
- Probe `tools/probes/Entnbt102Probe.java` (335 rows) and `Entnbt102Dbg.java` (cause of a failing row). Reference `public/research/entnbt102-reference.json` (hex of each written compound; 22 native crash rows carry the exception text). Test `src/entnbt102-b102.test.js` (5 tests).

## Evidence
- Item 1 Executed (Entnbt102Probe, `{}` / `{Health:7s}` / `{HealF:3.5f}` on 29 mob ids via `/summon`): `{}` writes HealF = bat 6, blaze 20, cave spider 12, chicken 4, cow 10, creeper 20, dragon 200, enderman 40, horse 53, ghast 10, giant 100, mooshroom 10, ocelot 10, pig 10, pigman 20, sheep 8, silverfish 8, skeleton 20, slime/magma 1 (size 1), snow golem 4, spider 16, squid 10, villager 20, iron golem 100, witch 26, wither 300, wolf 8, zombie 20. `Health:7s` is clamped to the maximum (chicken 4, snow golem 4, bat 6).
- Item 2 Executed: modifier `Name:5` writes `"5"`, `5b` `"5b"`, `5s`, `5L`, `1.5f`, `2.5d` likewise, `[1]` `"[1,]"`, `{a:1}` `"{a:1,}"`. Array tags (`[B;1,2]`, `[I;1,2]`) write `[0:"B;1",]` (the probe's own parser turns them into a list); not modelled (rows kept open).
- Item 3 Executed, already native (checked against the rows, no change): creeper Fuse / ExplosionRadius / powered widths, enderman carried / carriedData widths, slime Size widths up to 126, zombie IsBaby / IsVillager / ConversionTime widths, skeleton SkeletonType 0/1 widths, sheep Color / Sheared widths, wolf CollarColor / Angry / Sitting-with-owner, ocelot CatType 0..3 widths, villager Profession / Riches / maxUses default 7 / uses / maxUses 0 and negative, horse Variant / Temper / Tame / OwnerUUID / chest Items slots / Bred / HasReproduced.
- Bytecode-read: none new. Port-read: `villager.js:318` tests `!m.e.offers`, so an empty array does not re-roll (native `buyingList == null`).

## Verification
- `node --test --test-concurrency=2 src/entnbt102-b102.test.js`: 5 pass, 0 fail (about 22 s).
- Fails-without-the-fix: with `java-mobs.js` and `mob-attribute-list.js` restored from git all 5 tests fail.
- Related run, 42 files naming java-mobs / mob-attribute-list / javaMobFromNbt / villager-offers / ConversionTime: 499 tests, 499 pass, 0 fail.
- No `npm run build` (the only new import is `options-txt.js` into `mob-attribute-list.js`; it has no `node:` import and the browser already loads it).
- No old test edited.

## Found wrong in the batch 101 list
- None. Both follow-ups ("Bat default 20", "modifier Name non-string") were real and are fixed.

## Follow-ups (still open)
- Native crash rows on the probe double (`Owner:"..."` on wolf / ocelot; `Offers` recipe with no `buy` or `sell`, or `{}`): not modelled; the port loads the mob and drops the trade.
- Skeleton / pigman with no Equipment tag: the port gives the default bow / sword, native holds nothing (a saved world always has Equipment). SkeletonType 2 / -1 and ocelot CatType 4 / -1 are kept raw natively, normalised by the port. A `Sitting:1b` on an unowned wolf / ocelot is kept natively, dropped by the port. Slime Size 127 and above wraps in the data watcher natively (byte), the port clamps.
- Zombie cure: the Strength attribute modifier (`potion.damageBoost 0`, 1.3, operation 2 on attackDamage) native writes into Attributes is not written by the port.
- Horse: Type outside 0..4 is clamped (native keeps it); SaddleItem / ArmorItem Count and Damage are normalised to 1 / 0; a type 0 horse with `ChestedHorse` and Items keeps the stack (native drops it); `EatingHaystack` is not kept. A trade stack with Count 0 is dropped (native keeps it).
- Browser-only: nothing viewed.
