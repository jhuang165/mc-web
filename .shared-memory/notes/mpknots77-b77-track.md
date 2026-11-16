# Batch 77 mpknots77: server leash knots, cauldron click use swallow, Adventure bucket

## Summary
- Server fence click (`server-leads.js fence`): a sneaking player holding an item other than a lead no longer ties mobs (native: ItemInWorldManager skips BlockFence.onBlockActivated for sneak + item, and only ItemLead.onItemUse ties). Single player had the opposite gap: sneaking with a lead did not tie; `player-edit-simulation.js` now ties through the lead's own onItemUse.
- Cauldron click never starts eating, drinking, blocking or drawing: client (`main.js`, one condition on the multiplayer `use(true)` / `predictUse`), server (`simulation.js`: `p.useSwallowed` set in `edit` from `clientSwallows`, `handleUse` ignores a use that follows within one tick), single player (`player-edit-simulation.js`: every cauldron click counts as `usesBlock`; food/sword branch skipped). A dry cauldron also no longer equips armour (existing test encoded the old behaviour; updated).
- `server-bucket.js`: the Adventure refusal removed. Single player (`buckets-simulation.js`) had none, so it was already right.
- Knot placement, tie/untie, knot hit, 10-block break and fence-gone expiry on the server: no mismatch found beyond the sneak rule; now covered by server tests.
- `src/mpknots77-b77.test.js` (10 tests); `mpbuckets-b75.test.js` Adventure test inverted; `player-edit-simulation.test.js` armour case changed and a food/sword cauldron test added.

## Evidence
- Bytecode-read: `adf` (ItemLead) onItemUse and static func_150909_a (su.b lookup, +-7 box on the block corner, bN && bO == player, su.a for the first found mob, sw.b(knot, true)); `su.c` (EntityLeashKnot.interactFirst: lead in hand attaches the player's mobs within +-7 of the knot; else the knot dies, Creative clears mobs held by it without a drop); `akz` (BlockFence.onBlockActivated: remote true else func_150909_a); `bao` rightClickMouse (bje.a true clears the flag, no sendUseItem); `yz.a(IIIILadd)` = allowEdit || add.z() = adb.v() = true; `abo` (ItemBucket) calls yz.a, not isCurrentToolAdventureModeExempt.
- Executed (existing): leash-reference.json / leads2 / leads3 cover the rules the server reuses (knotAttach, knotClick, leashStep, knot expiry); not re-run natively.
- Port-read: the server glue behaviours in the tests (drops, holder ids).

## Verification
- `node --test src/mpknots77-b77.test.js`: 10 pass; against the unpatched glue tests 2, 9 and 10 fail.
- Targeted pass: mpbuckets-b75, player-edit-simulation, stone-utility, leash, leads2, leads3, potion-use, mpcauldron76-b76, mpusesweep-b75, mpriding2-b62, mppaintings-b68, adventure, mpclicks-b70/76, buckets-simulation, hanging, horse-gear, leash-raw. `npm run build` ok. No full npm test, no browser.

## Follow-ups
- Other server Adventure refusals look wrong for the same canPlayerEdit reason: `server-air.js` (firework), `server-use.js` (fire charge, bone meal, hoe), `server-place.js` (cake). Not touched.
- Only the cauldron swallow is modelled; every block that returns true from onBlockActivated (chest, door, lever...) swallows the item use the same way on the client.
- The server's fence tie runs through `ai.player` being set by a previously ticked mob (existence check only).
- Corpses in the death animation are skipped by `leashedNear` (health > 0); native would re-tie them (unprobed).
- The fence-click knot emulation (a lead or empty hand on a fence with a knot) stands in for the knot ray; a held non-lead item on a knot's fence still goes to placement, native would interact with the knot first.
