# predict86 (batch 86) track

Branch `batch86-predict86`, cut from release 0.114.0 (e814bef37).

## Summary

The multiplayer client now runs more of `sendUseItem`'s own `onItemRightClick` (`src/client-item-use.js`, `src/client-prediction.js` `applyHeldPlan`, wired in `main.js` `predictMultiplayerUse`).

1. **Empty map (acl).** The client makes its own map: the id comes from the client world's map counter, which counts in memory from 0 for each connection. The data is "map_<id>" at scale 0, centred on `Math.round(pos / 128) * 128`, in the client world's dimension. It is written into the page's `mapStore`, replacing any copy the client already had under that id, so a server map with the same id is blanked until S34 rows refill it (native does the same). The held stack then changes: a lone map becomes the filled map with that damage; otherwise one is taken and the filled map is given. There is no creative test, so Creative does the same. The server's S2F / invSet later replaces the client's id with the server's.
2. **Overflow drop.** Natively no item entity appears on the client: `EntityClientPlayerMP.joinEntityItemWithWorld` (bjk.a(xk)) is an empty method. Only the held stack and the slots change. `applyHeldPlan` already added nothing when the inventory was full. Its undo now also takes back a give that merged into an existing stack (a filled map with the same id).
3. **Boat (abj).** Two changes:
   - The ray is now the native one: start at posY + 1.62 - yOffset, which on the client is feet - ySize + 1.62 (not the camera eye or the sneak eye). The direction uses MathHelper sin/cos of the tick rotation.
   - The sight check was skipped on the client before. It is now native: a collidable copy inside the reach box refuses when its box, grown by its border (0.1, or 1.0 for a large fireball), contains the ray start. The box check now uses every client copy's box, including items, orbs, arrows, throwables and the player's own box. Before, it used only the placement blockers. New exports: `boatRay`, `clientBoatFits`, `clientEntityBoxes` (players, mobs, carts/boats, hanging, primed TNT, items, orbs, arrows, balls).
4. **Armour (abb).** This was not predicted before. Now an empty armour slot (39 - armour type) takes a copy and the hand empties at once, in Creative too. A worn slot changes nothing. `main.js` also redraws the vitals.
5. **Checked, nothing on the client:**
   - Carrot on a stick (abp): the pig's AI never runs on a client world (sv.br() = !isRemote), so EntityAIControlledByPlayer.h() stays false.
   - Rod reel (acv): xe.e() returns 0 when isRemote.
   - Bow, food, milk (adi), sword (aeh): use animation only.
   - Books (ael / aem): screen only.
   - Everything else was already covered by b85.

All 22 overriders of `onItemRightClick` (`a(add, ahb, yz)`) in the jar are now classified: abb, abj, abl, abm, abo, abp, ack, acl, acn, aco, acp, acv, acx, adi, adp, aed, aee, aeh, aej, ael, aem, plus adb (the base).

## Evidence

- **Bytecode-read** (`javap -c -p`, 1.7.10 jar):
  - Items: acl.a, abj.a, abb.a, abp.a, acv.a.
  - Client world and map storage: azq.a(String) / azq.a(String, ayl) / azq.<init>, bjb.<init> (new azq(null)), bjf.<init> (z = bjb.a), ahb.b(String).
  - Player and controller: bje.a(yz, ahb, add) (sendUseItem: C08 first, no creative restore), yz.a(add, boolean) -> yz.a(add, boolean, boolean) -> yz.a(xk), bjk.a(xk) (empty), yx.a(add).
  - Entity rules: sa / sv / ss / wy / wz / xa / xi / xj / xl / xw / ze / zi / zp R() and af(), xi.h(sa) / J(), xl.h(sa) / J().
  - AI and fish hook: ub.h / f / g, sv.br, sv.e, xe.e.
  - Server: mx.a(yz, ahb, add) (tryUseItem's creative restore).
- **Port-read:** wire-row box conventions (items and orbs from the box bottom, arrows and balls from posY), `applySlots`, `inventoryFields` (authoritative: nothing mirrored), invSet armour sync.
- **Executed:** none new.

## Verification

- `node --test src/predict86-b86.test.js`: 10/10.
- Neighbours, concurrency 1: 133/133 across 18 files that import or source-match client-item-use / client-prediction / applyHeldPlan / predictMultiplayerUse / mpPlacementEntities / maps-clock / client-maps, plus 39/39 for mpmaps-b69, mpclicks-b70, maps-clock, itemtags2-b58.
- Old test updated: `mppredict85-b85` boat row used the removed `blocked` hook; it now passes an entity row instead.
- `npm run build`: passes.

## Follow-ups

- **Creative armour on the server and in single player.** Native `tryUseItem` (mx.a) restores stackSize in Creative, so the piece is equipped AND stays in the hand. `server-air.js airUse` and `player-edit-simulation.js` equip-armor empty the hand. Not changed here (not my files).
- **Boat copies not included:** fishing hook copies and falling-block copies are left out of `clientEntityBoxes`, and so is the ender crystal unless it is a mob copy. Dragon parts are not modelled.
- **Server sight list:** the server's boat sight list (server-vehicles.js `useHeld`) lacks hanging entities, primed TNT and the fireball's 1.0 border. Its box list lacks items, orbs and arrows (seat86's file).
- **Browser-only:**
  - the hotbar flicker of the client's map id before S2F;
  - the blanked client copy of a same-id map;
  - the armour bar update on right-click;
  - a boat refused by a floating item.
