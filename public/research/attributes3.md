# Attributes, hit amounts and foreign owners (batch 27, attributes3)

Evidence: `tools/probes/Attributes3Probe.java` runs the unchanged 1.7.10 classes (InterchangeSpawnProbe's world double); `node tools/verify-attributes3.mjs` writes `attributes3-reference.json` (918 records: attack 306, strength 33, foreign 8, knockback 336, speed 203); `src/attributes3.test.js` replays it.

## Hit amounts
- Only EntityMob classes read `generic.attackDamage` in `attackEntityAsMob`: zombie 3, pigman 5, skeleton 2, spider 2, cave spider 2, enderman 7, silverfish 1, giant 50, witch 2, wither 2, blaze 6. Operations apply as `(base + sum op0) * (1 + sum op1) * product(1 + op2)`: 2 with +3, +1 (op 1), +0.5 (op 2) and +0.25 (op 1) gives 16.875. A base override and a negative modifier (floored at 0) behave the same way.
- A creeper registers the attribute but its `n(Entity)` deals no direct damage (it returns true and explodes via its own AI).
- A wolf (2, 4 tamed), an ocelot (3), an iron golem (7 + nextInt(15)) and slimes (size) use fixed amounts: a saved `generic.attackDamage` entry on those classes is ignored by the reader (the list has no such attribute), and Strength does not raise them (`strength` records, amplifiers 0-2). Strength on an EntityMob is operation 2, +130% a level: zombie 3 gives 6.9 and 10.8.
- Port: `mobHitAmount` (entities.js) is the one place both `hitPlayer` and `hitMob` take the amount from; wolves, ocelots, slimes and magma cubes skip the attribute and Strength. The skeleton's table row lacked `damage` (NaN) and now has 2.

## Movement speed and knockback
- The 203 `speed` records (every living class, modifiers of operations 0/1/2, a base override, a negative modifier) all match `aiMoveSpeed(e, 1)` for the ground movers. Five bases in the port's type table differed from native and were corrected: bat 0.7, ghast, squid and the dragon 0.1 and magma cube 0.2. Those four fliers and the slimes do not consume it (their own movement code), so only the written/exported value changes.
- `getAIMoveSpeed` itself is the field the move helper sets last (0 on a fresh mob), so only the attribute value is comparable.
- 336 `knockback` records (base 0.25/0.5/1, +0.5, +2 and -2 modifiers, op 1, Entity.rand seeds 0-7) match `knockBack`: the roll is `rand.nextDouble() >= value` with the value clamped to 0..1, and the port already derives `knockbackResistance` from the list on load. `followRange` is likewise folded into `e.followRange` on load and read by the navigator and target tasks (bytecode-read for EntityAITarget; the load fold is covered by interchange-spawn tests).

## Foreign owners
- `EntityTameable.getOwner()` finds the owner among the world's players by UUID. In a one-player world an OwnerUUID that is not the player's gives null. Probed for a wolf and an ocelot (wild, owner UUID, sitting, blank-text owner): `EntityAISit.shouldExecute` is true for any tamed animal with no owner, sitting flag or not, so it sits; `EntityAIFollowOwner` and the two owner-target tasks never run; a wolf with no owner never attacks another tamed wolf that also has no owner (`a(target, null)` is false) but attacks a wild one.
- Port: `ownerPresent(e)` (owner-links.js) is false when the record keeps a foreign `ownerUuid`. `m.owner()` of the wolf and ocelot AI, the click toggle (`isOwner`) and `shouldAttackEntity` use it; `isSuitableTarget` compares the raw OwnerUUID text (`ownerKey`), as native does. A foreign-owned tamed animal still takes food, dye and healing from the player (native tamed checks, not owner checks).
- Horses: `OwnerUUID` is only stored; native horse code gates on the Tame byte (bytecode-read, not probed), so a foreign owner changes nothing there.

## Leashes and riders (checked, no change)
- A knot leash already exports `Leash: {X, Y, Z}` and a player-held lead the player's UUIDMost/UUIDLeast (`interchange-links-reference.json` `leash`, tested since batch 21); a knot has no UUID natively, so there is nothing to add. A lead held by another mob (UUID resolved among nearby living entities) cannot be represented: it is dropped on import as for any holder that is not the player.
- Steering (bytecode-read with javap): among the living classes only EntityPig (canBeSteered with the carrot on a stick, fall damage, interact) and EntityHorse read the rider field; EntityLivingBase, EntityLiving and EntityCreature never do, so no other mount is steered by its rider. The port matches this.

## Open
- Modifiers on attributes the port derives rather than stores (slime size, horse jump strength) keep the earlier notes in `mob-riding.md`.
- Villager "a moving player fighting back / several attackers" scenarios were not added this batch.
