# ride87 (batch 87): the horse jump bar, the C0C jump flag, single player's boat lily pads, Creative armour

Branch `batch87-ride87`, cut from release 0.115.0 (b95bfd9ac).

## Summary
1. **Horse jump counter** (`horse-live.js` `horseJumpCounter`, used by `horseSeats.charge` in single player and by `multiplayer/client-horse.js` `MpHorseRider`). The block is now the bytecode-read EntityPlayerSP.onLivingUpdate code. Before, the counter was a recalled one-tick-early version.
   - `flag` is the previous tick's jump key.
   - On a horse: `if (a < 0) { a++; if (a == 0) bO = 0 }`. Then:
     - `flag && !jump`: a = -10, send C0B 6 with `(int)(bO * 100F)`.
     - `!flag && jump`: a = 0, bO = 0.
     - `flag`: a++, bO = heldJumpPower(a).
   - Off a horse, bO = 0.
   - What changes in play:
     - The press tick charges nothing.
     - A one-tick tap sends 0. wi.w then jumps at 0.4 and starts the rear.
     - The bar keeps the released fill until the -10 cooldown reaches 0 (10 ticks).
     - A press inside the cooldown starts again at a = 0 at once.
     - The value is sent even when it is 0.
     - mount and dismount no longer reset `a`.
   - `heldJumpPower` (`horse.js`) is now float-exact.
2. **isRidingHorse is any EntityHorse** (blk.u: `m instanceof wi`, with no saddle or tame test). In multiplayer the counter, the bar and C0B 6 now run on an unsaddled horse too. Before, the bar was hidden and nothing was sent. GuiIngame (bbv) draws the jump bar whenever isRidingHorse holds.
3. **wi.w(int)** (`horse-live.js` `horseJump`). On an unsaddled horse it now changes nothing. Before, it zeroed jumpPower and jumpHeld.
4. **Server: only C0B 6 jumps a horse** (`server-horses.js`).
   - The b76/b77 fallback is removed. It charged the bar on the server from the held key (`p.input.jump`) and had the `horseJumpWire` / `horseAutoAt` duplicate guard.
   - `jump()` now accepts any 32-bit int, as nh.a(jj) does. The old range was -1..100000.
   - The C0C jump flag stays the rider's `jumping` (EntityPlayerMP.isJumping). Natively nothing on any mount reads it (Evidence), so the server applies nothing more.
5. **Single player's boat lily pad** (`main.js` `boatHooks.clear`). It now goes through `boats.js` `boatClearCell`, the same path as the server:
   - level event 2001, drawn with `multiplayerBreakFx` (the break sound and destroy particles from `id + (meta << 12)`);
   - the pad's own drop through `items.dropBlock` (which honours doTileDrops);
   - then air.
   
   There is no exhaustion, mine stat, tool wear or harvested hook. Before, it went through `breakPlayerBlock`. A snow layer is still set to air with no event.
6. **Creative armour keeps the hand.** The piece goes into the empty armour slot and also stays in the hand in Creative.
   - Single player: `player-edit-simulation.js` equip-armor.
   - Server: `server-air.js` `airUse`. After the equip it also sends the whole window (ServerInventory.resend, `invItems` = S30), as tryUseItem's sendContainerToPlayer does. The client's own sendUseItem prediction (predict86) had emptied the slot, so this puts it back.
   - A worn slot changes nothing and resends nothing. It still ends the click, as before.

## Evidence
- Bytecode-read (`javap -c -p`, 1.7.10 jar):
  - `blk.e` (EntityPlayerSP.onLivingUpdate):
    - 321-328: `flag = bli.c`, read before `bli.a()` at 354.
    - 949-1102: the horse counter block above, with the constants 0.1F, 0.8F, 2.0F, 9, 10 and -10.
    - `blk.u()`: `m instanceof wi`.
    - `blk.v()`: returns bO.
    - `blk.i()` is empty.
  - `bjk.i()`: C0B `jj(this, 6, (int)(v() * 100.0F))`. `bjk.j()`: C0B action 7.
  - `bbv.a(FZII)` 693-798 (GuiIngame): when `bjk.u()` holds, the jump bar is drawn with `(int)(v() * 183)` filled pixels of the 182-pixel track, and drawn only if > 0. Otherwise the xp bar.
  - `nh.a(jj)` 109-158: action 6 calls `wi.w(jj.e())` when `mw.m instanceof wi`. There is no other test.
  - `wi.w(I)`:
    - if `cu()` (saddled):
      - p < 0: p = 0, no bI and no rear;
      - else bI = true and `cU()`;
    - then bt = p >= 90 ? 1 : 0.4F + 0.4F * p / 90F;
    - unsaddled: no field changes.
  - The C0C jump flag: `mw.a(FFZZ)` writes `bc` (isJumping). A scan of all 1782 classes finds a single `getfield bc:Z`, in `sv.e` at 424 (EntityLivingBase.onLivingUpdate):
    - in water or lava (M() / P()): motionY += 0.04;
    - else if onGround and jumpTicks == 0: bj() (jump) and jumpTicks = 10;
    - else jumpTicks = 0.
    
    For a rider this runs inside mw.i() from processPlayer's riding branch. onGround is then the C05's value, which a vanilla riding client never sets (seat86). The branch then puts the position back, and the next updateRidden zeroes the motion. EntityHorse, EntityAIControlledByPlayer, EntityBoat and the minecarts never read `bc` (no other getfield in the jar).
  - `abb.a(add, ahb, yz)` (ItemArmor.onItemRightClick): index = `sw.b(stack) - 1`. If `yz.r(i)` (armorInventory[i]) is null, then `yz.c(i, stack.m())` (armorInventory[i] = copy) and stack.b = 0.
  - `mx.a(yz, ahb, add)` (tryUseItem):
    - size and damage are saved, then the result is taken;
    - unchanged (same stack, same size, no use duration, same damage) -> false;
    - else hand = result; if `mx.d()` (Creative) the size, and the damage if the stack is damageable, are restored;
    - size 0 -> hand = null;
    - `!isUsingItem` -> `mw.a(yz.bn)` (sendContainerToPlayer).
- Port-read: `ServerInventory.resend` is the port's S30 (`invItems`, every main slot plus the armour). The SP `items.dropBlock` spread is Block.dropBlockAsItem's.
- Executed: no new Java probe.

## Verification
- `node --test src/ride87-b87.test.js`: 11/11.
- Neighbours, concurrency 1, all pass:
  - 170/170 across 17 files: mphorse76, mphorseclient77, mphorserules77, mphorse78, horse-world, horse, horse-gear, horse-sounds-b57, horse-copy-b54, horse-items-nbt, pig-saddle, leads2, mphorseview78, mpriding2, player-mount, riders72, ride87.
  - 226/226: player-edit-simulation, mpusesweep-b75, predict86, mpinventory2-b61, mpcauldron76, mpstats2-b64, seat86, mpboat84, boats, lily-pad, boat-ride-b56, spuseorder76, use-hold, block-clicks-b52.
  - 153/153 after the main.js revert: spswing78/79/80, spcauldron77, mpsurvival-b58, mpadventure78, prediction5-b59, fixes68, cakefog72, corpse82, dig-abort-b54, redstone-ore, sounds73, spsounds-b75, player-throw-replay, attributes2, skins73, mpplace84, mppredict85.
- Old tests that encoded the gaps, now updated:
  - `mphorse76-b76` "without a horseJump message the held jump key ... jumps" now asserts that no jump happens.
  - `mphorseclient77-b77`: the counter test (press tick a = 0, the bar kept for 10 ticks), the bar test (an unsaddled horse shows the bar and sends) and the server fallback test (now: only the wire message jumps).
- A send-order change in main.js (C0B 6 before the C0C, as bjk.h does) was reverted. `mpsurvival-b58` source-matches that line (`if (multiplayer) { sendMultiplayerInput`), and the server applies both before its tick anyway.
- `npm run build`: passes (chunk-size warning only).

## Follow-ups
- Browser-only:
  - the jump bar staying full for 10 ticks after a release;
  - the bar on an unsaddled horse;
  - the tap jump (0.4 and the rear);
  - the lily pad sound and particles and the dropped pad in single player;
  - the Creative hotbar flicker (empty, then restored by S30) after equipping armour.
- Single player calls `charge` only while riding and not sneaking (vehicle-simulation.js), so `flag` is not tracked on foot. Mounting a horse with the key already held starts at a = 0 rather than continuing `flag`. This is an edge case and was not changed (not my file).
- The port's client sends C0B 6 after the tick's `input` (C05 / C0C). Natively it goes before. The server applies both before its tick.
- The rider's own isJumping in water (motionY += 0.04 inside the riding branch) is not modelled on the server copy. It is discarded natively too.
- Other successful tryUseItem paths on the server (bottles, eggs, maps and so on) still rely on the slot diff, not a full S30 resend.
