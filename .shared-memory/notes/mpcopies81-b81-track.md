# mpcopies81 (batch 81): client copies of a revived wolf, the dying dragon's parts, and wither skull rotation

## Summary
- **Revived wolf (no source change, now locked by tests).** You can tame a dying wolf with a bone (wv.a(yz) has no health test). setHealth(20) revives it on the server. The copy gets health 20 from the S1C state and S19 7 draws the seven hearts. The copy's death counter stops where it was, because onDeathUpdate only runs while getHealth() <= 0. The copy is never removed. Feeding meat to a tamed dying wolf uses the meat, heals nothing and sends no health, so that copy dies and leaves. Both cases already matched native.
- **Dragon parts after the body rises (fixed).** getMouseOver only lists a dragon's parts when the dragon body is listed. The body is listed when its own box meets the query box (the player box from the eye, addCoord(look * reach), expand 1). It must also stand in a chunk column and section that the query walks: floor((min - 2) / 16)..floor((max + 2) / 16), with sections clamped to 0..15.
  - In the death sequence the body rises 0.1 per tick while the parts stay frozen. Once the body leaves the query, the frozen parts can no longer be picked. The same rule applies to a living dragon: a tail part outside the body's query reach is not picked.
  - New `src/dragon-part-query.js` (`mouseOverBox`, `dragonListed`), used in `EntityWorld.pick` (single player) and `RemoteMobs.pick` (multiplayer copy).
  - `RemoteMobs.pick` takes a new optional 4th argument, the full reach (3 survival, 6 creative). It is used for the query box, while the 3rd argument stays the block-cut reach. main.js passes it.
- **Wither skull copy rotation (fixed).** The skull copy used to turn from the snapshot displacement. It now takes the tracker's bytes and runs its own EntityFireball turn. New `src/multiplayer/skull-look.js`:
  - `skullEntry` / `skullEntryTick` model the skull's EntityTrackerEntry: frequency 10, no packet at the entry's first update, the look rule of 4 byte steps, and the S18 teleport. last yaw/pitch move only when a look is sent.
  - Server rows (server-dispense.js) add `yb`/`pb`: the S0E bytes, which are the spawn angles in the entry's first tick and the current ones after that. They also add `a8`, the S0E speed fields (int)(accel * 8000), and `look`/`lyb`/`lpb` on a tick whose S16/S17/S18 carries the angles.
  - The entry is created before the skull's first update, in the `installServerWither` tickOne wrapper.
  - Client (`skullCopyLook`, one call from client-dispense.js):
    - At creation the yaw/pitch come from the bytes and prev yaw/pitch are 0.
    - Each later tick: prev = current, `fireballTurn` toward the copy's own motion, which starts at 0 and becomes (m + a) * 0.95 (0.73 when charged). Here `a` is the speed fields normalised and multiplied by 0.1, as in the 7-argument constructor.
    - Then a look packet replaces the angles (packets are processed after the entities in runTick).
  - The drawn position is still the server snapshot. Only `row.look` holds the motion.

## Evidence
All bytecode-read with `javap -c -p` on the 1.7.10 jar, unless noted:
- EntityTracker.trackEntity (mn): fireballs and skulls (ze) are tracked at range 64, frequency 10, without velocity updates.
- EntityTrackerEntry (my):
  - `<init>` takes lastYaw/lastPitch = floor_float(angle*256/360) at spawn.
  - The tracker update (my.a(List)): no packets while m = 0. The move rule is >= 4 or m % 60 == 0, the look rule is >= 4. S18 when a delta falls outside -128..127 or v > 400; S18 always carries the angles. Otherwise S17/S15/S16.
  - my.c builds the speed fields as (int)(ze.b * 8000) etc.
- S0E (fw): signed angle bytes h (pitch) and i (yaw).
- Client spawn (bjb.a(fw), type 66):
  - It runs `new zp(world, x, y, z, g/8000, h/8000, i/8000)` and then `fw.g(0)`, so no setVelocity runs.
  - It sets rotationPitch = j*360/256 and rotationYaw = k*360/256 only.
  - ze's 7-argument constructor normalises the acceleration with MathHelper.sqrt and multiplies it by 0.1.
- bjb.a(hf) and bjb.a(ik) call sa.a(DDDFFI), which ze/zp do not override, so setRotation is yaw % 360.
- Minecraft.runTick (bao): the client world's updateEntities runs before the network packets are processed.
- ze.h: the turn comes after pos += motion and before motion = (motion + accel) * e(). zp.e() is 0.73 when charged, else 0.95.
- getMouseOver (blt.a(F)): reach 6 with extendedReach, else 3. The query is boundingBox.addCoord(look * reach).expand(1, 1, 1). The body xa.R() is false, the parts wy.R() true.
- The world entity query ahb.a(sa, azt, sj): chunk columns are walked with a margin of 2, and only chunks that exist.
- The chunk query apx.a(sa, azt, List, sj): sections are walked with a margin of 2, clamped. The entity is listed when its box strictly intersects the query, and its parts are added ONLY then.
- Wolf: native sends S19 7 immediately (setEntityState in interact) and S1C at the tracker update. The port sends `state` before `mobStatus` in the same tick. This is cosmetic: both are handled in the same client tick, and the hearts do not read the health. Left as is.
- Executed earlier (unchanged): the dragon's client death positions, with the parts frozen and the body rising (TrackerMountsProbe `dragonDeath`, tracker-mounts.test.js).
- Port-read and node-executed: the wolf revival end to end through DedicatedSimulation and RemoteMobs, and the skull rows end to end through DedicatedSimulation and RemoteDispense.

## Verification
- `node --test --test-timeout=600000 src/mpcopies81-b81.test.js`: 9/9 pass.
- Neighbours, run sequentially: 198/198 pass. Files:
  - corpse79-b79, corpse80-b80, entity-tracker, mpanimals-b61, mpdispense-b61, mpdragon-b64, mpdragon2-b65, mpfx80-b80, mpmobtypes-b61
  - mpprojectiles-b62, mpprojectiles2-b63, mpwither-b63, mpwither-b64, wither-boss, tracker-mounts, renderfx80-b80, wolf-world, explfx79-b79
- More neighbours: 103/103 pass. Files:
  - dragon-world, dragondeath-b56, dragon-client-b49, dragon-sweep, entities, knot-splash-b50
  - mpadventure78-b78, mppaintings-b68, mpsmall2-b62, mpvehicles-b61, projectiles5-b70, projectiles6-b72
- `npm run build`: OK.
- No full `npm test`. No browser checks.

## Follow-ups
- Browser-only:
  - how the skull copy looks on screen, including the first rendered frame's swing from prev 0 to the spawn yaw (native does this too);
  - the revived wolf copy staying tipped and red-tinted;
  - aiming at the frozen dragon parts while the body rises, and the moment they stop being picked.
- The skull copy's own motion ignores water: the copy's own handleWaterMovement would use 0.8. A late watcher's spawn bytes are the current angles, which matches native's S0E built in that tick's update.
- If blast81 models the client fireball's own flight, it could share the motion recurrence held in `row.look` (skull-look.js). Rotation-only here.
- The query box uses the eye minus 1.62 for the box's minY. Sneaking (the client's eye offset) is not modelled.
- The skull NBT rotation on reload is render81's. A reloaded skull without yaw sends byte 0.
