# Leads: path-following, home area and leash knots (Minecraft Java 1.7.10)

Evidence: `tools/probes/LeashProbe.java` runs the unchanged original classes (`td` EntityCreature, `sw` EntityLiving, `su` EntityLeashKnot, `ss` EntityHanging, `adf` ItemLead, `ut` EntityAIMoveTowardsRestriction, `vv` PathNavigate, `wi` EntityHorse) on the `HorseGearProbe` world double. `tools/verify-leash.mjs` writes `leash-reference.json` (class SHA-256 digests, 96 path, 2 release, 3 homeCell, 6 eating, 14 knotLife, 8 knotValid, 1 fenceBreak, 2 knotHit, 6 knotClick2, 2 fenceClick, 1 nbtWrite and 7 nbtRead records). `src/leash.test.js` replays it against `horse-gear.js` and drives the live `EntityWorld` (`horse-gear-live.js`). Not full parity.

## EntityCreature.updateLeashedState (td.bL), every leashable mob

Each tick of a leashed mob that has its holder in the world:

- A sitting EntityTameable (wolf, ocelot) only breaks the lead beyond 10 blocks; no task, no home, no path, no pull. The wolf probe confirms it.
- Otherwise the home area is set to the truncated cell of the holder (radius 5) on every tick. The first leashed tick adds EntityAIMoveTowardsRestriction at priority 2 with speed 1 and turns avoid-water off (the probe shows one task, priority 2, speed 1, follow range 16).
- A grazing horse stops eating beyond 6 blocks (`eating`: still eating at 6, stopped at 6.1).
- Beyond 4 blocks (float distance, `getDistanceToEntity`) `PathNavigate.tryMoveToEntityLiving(holder, 1.0)` runs. Beyond 6 the velocity pull is `delta / d * |delta / d| * 0.4` per axis, and beyond 10 the lead breaks and drops. The pull and the break share a tick.
- On release (`sw.a(true, true)` then the next tick) the task leaves the task list (a running one is reset), avoid-water returns to true and the home radius goes to -1; the navigator keeps its last path.

The port: `leashStep` (pure rules), `leashTick` (sets the home with `setHomeArea`, adds the village `MoveTowardsRestriction` task at priority 2, calls `PathNavigate.tryMoveToEntityLiving` with the player or knot centre) and `leashRelease`. Any type that is not in `NOT_LEASHABLE` goes through the same path.

## Leash knots (su EntityLeashKnot) as runtime entities

- Knots live in `world.knotList` (`{x, y, z, age, dead}`), are never saved (`su.d` refuses to write; the `knotWritesToChunk` record is false) and are ticked by `knotTick` from `EntityWorld.tick`.
- `ss.h` counts ticks and checks the surface only on the call after the counter reads 100: a knot whose block is not a fence (render type 11: fence 85, nether brick fence 113, plus the block ids in `knotValid`) dies on tick 101, 202 and so on. It drops nothing. The mobs it held lose the lead on their next tick and the lead item drops there (probe `fenceBreak`: rows at ticks 1 and 100 still tied, at 101 freed with `420x1`).
- An empty knot lingers: freeing the last mob leaves the knot until its fence goes or it is clicked or hit.
- Click on a knot (`su.c`): with a lead in hand the player's own leashed mobs near the knot centre join it; if none attach the knot dies, and in Creative the mobs it held are freed with no drop. A hit (`attackEntityFrom`) kills it with no drop (the held mobs lose the lead on the next tick).
- Lead on a fence (`adf.a`): the player's leashed mobs whose boxes meet the 7-block box around the fence corner move to the existing knot, or to a new one made only when at least one mob was found (`fenceClick`).

## NBT round trip

- A mob with a player holder writes `Leash: {UUIDMost, UUIDLeast}`; one held by a knot writes `Leash: {X, Y, Z}` of the knot's block. The knot itself writes nothing.
- On the first leashed tick after a load (`sw.bP`): a player holder is matched by UUID within a box grown by 10 blocks, otherwise the lead drops (`playerFar`, `playerWrongUuid`, `noLeashTag`); a knot holder is found at X/Y/Z or created, even with no fence (it then dies within 101 ticks and the lead drops: `knotNoFence`). The port does this in `leashRestore`.
- `serialize()` already keeps `leash` through `gearFieldsFrom`. Region interchange now writes and reads the `Leash` compound (see `mob-gear-nbt.md`); the knot is never written as an entity because `su.d` refuses to save.

## Gaps

- The leash catenary (`leashStrip`) is still the recalled vanilla algorithm; it is not bytecode verified or pixel compared.
- The player UUID is not a real UUID (single player); a mob held by a player at load only checks the 10-block box.
- The browser does not ray-test the knot's 9-pixel box nor route left clicks to knots, so a hit on a knot (`knotAttack`) is only reachable from code, and a click on the fence acts on the knot.
- The navigator's path budget (per-tick search count) applies to leash searches, so a crowded tick can delay a path by a tick; 1.7.10 has no such budget.
- Not run in a browser; verified by the native probe, unit tests and the build.

## Leads held by another mob, owners and size <= 0 (batch 28 leads2)

Evidence: `leads2-reference.json` (`tools/probes/Leads2Probe.java`, unchanged 1.7.10 classes), replayed by `src/leads2.test.js`.

- Save: `Leashed` always, `Leash` only with a holder. A living holder gives `UUIDMost`/`UUIDLeast`, a hanging holder `X`/`Y`/`Z`. Any mob can hold: a pig, horse, wolf or ocelot holder is written as its own UUID (`leadWrite`).
- Load (`sw.bP`, first tick): a pair of two long tags wins over `X/Y/Z`; the holder is the first living entity of that UUID in the mob's box grown by 10 (the mob itself and a dead one are found too). A wrong UUID is not rescued by `X/Y/Z`; a `UUIDMost` alone with `X/Y/Z` becomes a knot. `X/Y/Z` of any numeric tag type (byte to double) are floored; string or missing coordinates drop the lead. A dead or absent holder is dropped on the next tick with a lead item (`leadRead`, `leadLive`).
- `td.bL` pulls, paths and breaks the same for a mob holder as for the player (`leadLive`, `leadCycle`: two mobs holding each other).
- `sw.c`: only a player holder frees a leashed mob; a lead in hand never moves a mob held by a mob. A tamed wolf or ocelot is leashed only by its owner (`isOwner`): a foreign or blank `OwnerUUID` refuses and the lead stays in the hand (`leadUse`). Creative clicks a copy (`interactWith`), so the lead is not used up there.
- Port: `leash: {holder: "mob", holderUuid}` (`horse-gear-live.js`: `leashHolder`, `leashRestore`, `leashTick`); `relinkMobs` links an imported holder UUID to a mob of the same save, else drops the lead; export writes the holder mob's UUID.
- Horse owner: the OwnerUUID text is written and read back verbatim and changes nothing in `interact`, riding or the inventory GUI (432 `horseOwner` records, no owner checks in bytecode either). A non-player rider of an untamed horse is thrown (status 6) with no temper change and no taming (`horseTame`); the port only models the player rider.
- Size <= 0 (`sizes`, 2700 records): `interactWith` spends nothing from Creative; a mob click that returns true destroys a held stack left at size <= 0 outside Creative, whatever the stack is (wild horse, sheep dye, sheep feeding all count). Wolf meat or bone and ocelot fish also empty a size <= 0 stack in Creative; EntityAnimal feeding does not. The port's wolf, ocelot, sheep, feeding and wild-horse clicks match all 2160 wolf/ocelot/sheep/horse records.
