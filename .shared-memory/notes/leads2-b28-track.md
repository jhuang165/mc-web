# leads2 (batch 28): mob-held leads, horse owner text, size <= 0 clicks

## Summary
- New native probe `tools/probes/Leads2Probe.java` + `tools/verify-leads2.mjs` -> `public/research/leads2-reference.json` (leadWrite 6, leadRead 49, leadLive 100, leadCycle 3, leadUse 42, leadKnot 2, horseOwner 432, horseOwnerWrite 12, horseOwnerRead 12, horseTame 60, sizes 2700). Replayed by `src/leads2.test.js`.
- Leads held by another mob ported: `leash: {holder: "mob", holderUuid}` live (`horse-gear-live.js`, `horse-gear.js`, renderer line), Java import (`java-mobs.js`: long-UUID pair wins over X/Y/Z, numeric X/Y/Z of any type floored, strict long tags) and `owner-links.js relinkMobs` (links to a mob of the same save, else drops the lead; the import modules `region-import.js` / `whole-save-import.js` are untouched), export writes the holder mob's UUID (`region-export.js`, one line).
- Tamed wolf/ocelot refuse a lead from a non-owner (`leashUse ownerBlocked`).
- Fixed: a lead was used up in Creative (interactWith clicks a copy); `EntityAnimal` feeding checked the stack count (size <= 0 still feeds); a size <= 0 stack is now destroyed after a true mob click outside Creative (sheep dye, wild horse), and wolf heal/bone and ocelot fish empty it in Creative too (`entities.js clearSpentStack`, `player-edit-simulation.js`, `horse-live.js`: tiny hunks).
- Horse owner: native bytecode and 432 probe records show OwnerUUID never changes interact/riding/GUI; the port already had no owner checks, so only tests were added.
- Probe fix found while checking: the earlier `Leads2Probe` bone item id 311 was wrong (bone is 352); the sizes records use 352.

## Verification
- `node --test src/leads2.test.js`: 11 tests pass. `npm test` and `npm run build`: see the commit message / final reply.
- Native evidence is bytecode run (probe), not only javap, except where stated below.

## Follow-ups (proposed gap lines; remaining-gaps.md not edited)
- A leashed mob's own death: bytecode-read, no EntityLiving method clears the lead on death (`sw.a(ZZ)` is called only from `c`, `bL`, `bP`, and `td.bL`); the probe `heldSetDead` only covers setDead. The port still drops a lead when a leashed mob dies (`gearDeath`); unprobed through real damage.
- A non-player rider (pig) on an untamed horse is thrown with status 6 and no taming natively; the port only models player riders.
- An imported `Leashed` with an unusable `Leash` tag (strings, missing Z, empty) drops the lead natively with a lead item; the port loses the lead without the item.
- Mob-held leads across a dimension change are dropped by the first tick in the new world (`leashRestore`), not through `dimension-live.js`.
- The horse GUI/dye/saddle interactions at size <= 0 for a tame horse (native result false, stack kept) are matched only through `horseInteract` returns; GUI saddle equip with a size <= 0 stack is unprobed.
