# Batch 93 credit93: the shooter's attacker hook on arrow hits (Bane, not Fire Aspect), dimension change keeps the same thrower, single-player Nether/End deaths and dead shooters' potions and arrows

## Summary
- **Arrow attacker hook (bytecode-read zc.h 1065-1100, afv.b, afx.a, afq.a).** `entities.js` `EntityWorld.arrowBane(victim, {mob, armor, held})`; `bow.js` `shooterBane` after `victimThorns` on a landed arrow on a living mob (not dragon parts or crystals). Player shooter (single player `ctx.survival`, server `a.owner.survival`): armour slots plus the item held at the moment of the hit, rolled on the shared player Random (as the melee hit). Mob shooter: its five equipment slots on its own Random, no second held roll. A dead old body: its frozen held item, no armour. Effect: Slowness IV (amplifier 3) for 20 + nextInt(10 * level) on an arthropod.
- **Fire Aspect does nothing on an arrow hit (proved).** Only afq (EnchantmentDamage) overrides `aft.a(sv, sa, int)` and only agj (Thorns) overrides `aft.b(sv, sa, int)`; all 16 `extends aft` classes in the jar were scanned. Fire Aspect is applied by EntityPlayer's melee code only.
- **Dimension change keeps the thrower (bytecode-read oi.a(mw, int)).** No `new mw` in transferPlayerToDimension (`new mw` exists only in oi.f(GameProfile) and the respawn oi.a(mw, int, boolean)): the same EntityPlayerMP object keeps throwing. The thrown entity's thrower is the live player, now in the other world: knockback origin is his current position, a pearl needs `mw.o == o` (zm.a) so it does not teleport him. The server already did exactly this (`ownerOf`, `pearlImpact` dimension test); no code change, test added. The batch 92 follow-up "a ball thrown before a dimension change holds the old EntityPlayerMP" was wrong.
- **Single player deaths in the Nether/End and a dead shooter's potions and arrows.** `main.js` `respawnPlayer`: the dead body is built where the player died, BEFORE `leaveByDeath` moves him (it used to be built after, at the Overworld's position), given to the live Nether/End lists and again to the Overworld lists after the trip (`pendingDeathBody`, `giveDeathBody`). `giveDeathBody` marks balls, the player's potions and bottles in `mobs.potions.projectiles.balls` (owner "player") and arrows with shooter "player". Arrows then read it through the existing `ownerBody` code in bow.js. `projectiles.js` puts `ownerBody` in the potion event; `witch-potions.js` `impact` takes the knockback origin from it and sets `deadAttacker`.
- Tests: `src/credit93-b93.test.js` (5).

## Evidence
- **Bytecode-read:** zc.h 1065-1103 (afv.a then afv.b, local 12 = victim); afv.b/afv.a/private afv.a(afz, add[]); afx.a -> aft.a(shooter, victim, lvl); afq.a(sv, sa, int) (target instanceof sv, a == 2, bd() == arthropod, user.aI().nextInt(10 * lvl)); sv.ak (abstract), sw.ak (EntityLiving equipment `br`), yz.ak (armour inventory); yg.n calls afv.a/afv.b the same way; oi.a(mw, int) full body.
- **Port-read:** server-dispense.js pearlImpact/ownerOf; main.js respawnPlayer, dimension travel saves.
- Not executed: no probe, no JVM run.

## Verification
- `node --test --test-concurrency=2 src/credit93-b93.test.js`: 5/5 pass; with bow.js and witch-potions.js reverted 1 pass (the dimension test) / 4 fail.
- Neighbour run, 96 files naming bow.js, witch-potions, WitchPotions, Arrows, arthropod, thornsOfVictim, expBottle or projectiles.js, `--test-concurrency=2`: 964 tests, 963 pass; the one failure (`cmd-exec-b83` /summon Entity.readFromNBT) passes alone (4/4), a load flake unrelated to these files.
- `main.js` is not importable in node; the respawnPlayer change is read, not run. No full `npm test`, no `npm run build` (no new imports), no browser.

## Found wrong in the batch 92 list
- "A ball thrown before a dimension change also holds the old EntityPlayerMP": wrong, the dimension change keeps the same object (see above).
- Found, not fixed (outside scope): entities.js mob melee (about line 1969) passes `e.equipment[0]` as a separate held item to `arthropodSlowness`; afv.b adds the held item only for an EntityPlayer, so a Bane-wielding mob rolls its Random twice natively once. Fix is one argument (`null`), left to the mob track.

## Follow-ups
- Balls, potions and arrows left in a Nether/End stash when a single-player death happens there go through the away run, which treats every ball as ownerless (no thrower at all); not changed.
- A dead body's armour on the server is never given (a keepInventory body would still wear it natively).
- Browser-only: nothing checked.
