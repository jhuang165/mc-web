# Batch 50 legacybody track

## Summary

Branch `batch50-legacybody`, cut from ca6a447bf.

- **isAIEnabled audit (bytecode-read, `javap -p -c` over every class of the jar extending `sw`, EntityLiving).** `sw.bk()` returns false. Overrides that return true: bat (we), chicken (wg), cow (wh; mooshroom inherits), horse (wi), ocelot (wn), pig (wo), sheep (wp), snow golem (wr), iron golem (wt), wolf (wv), wither (xc), creeper (xz), skeleton (yl), witch (yp), zombie (yq), villager (yv). `yh` (EntityPigZombie) overrides it back to false. Never overridden (false): enderman, spider, cave spider, slime, magma cube, silverfish, giant, blaze, ghast, squid, the dragon, and pigman. The body turn (`sv.f(FF)`) is overridden only in `sw` (`bk` ? EntityBodyHelper : super); no mob class overrides `sv.f(FF)`, and `updateEntityActionState` (bq) is overridden only by squid (ws), ghast (yd), silverfish (yk), slime (ym), EntityCreature (td) and EntityPlayer (yz).
- **`LEGACY_BODY` now matches** (`src/entities.js`, exported): added silverfish, giant, pigman, blaze, ghast. The client copy table (`LEGACY_MOVE` plus `CLIENT_LEGACY_TURN`) already listed exactly the false set. The squid has its own `legacyBodyTurn`; the dragon sets its own yaws (not probed).
- **Two further per-mob fixes the records showed.** Silverfish: `EntitySilverfish.onUpdate` (yk.h) sets `renderYawOffset = rotationYaw` before the living update (done at the tick's start in the walk, before the prev copy). Silverfish, giant and blaze did not run `rotationYawHead = rotationYaw` after the action state (EntityLiving.onLivingUpdate without AI, sw.e); only spider and pigman did.
- **New executed set `b50lb`** (`EW_SET=b50lb`, `EndermanWolfScenarios.run50`, `public/research/enderman-wolf-b50lb-reference.json`, 23 records, replay export `reference50`): silverfish, giant, zombie pigman and blaze pushed east, north, into a wall and pulled by a retracting block; a witch and a creeper (isAIEnabled true) as controls. Each row records motion, yaw, pitch, rotationYawHead and renderYawOffset per tick. Mutation: with the five names removed from `LEGACY_BODY` 13 records diverge in bodyYaw.
- **Ghast: bytecode-read only.** In the probe world double the ghast never starts a flight course (the native ghast sits still where the port flies), so no ghast record is usable; a unit test pins that `turnBody` runs the legacy turn for it.
- **b46mp regenerated under the b47 harness.** With the probe unchanged, `EW_SET=b46mp` reproduced the committed file byte for byte, so the workarounds could not be removed by regenerating alone: they come from the b46mp harness (ticksExisted counted only by `mw.i`, server copy snapped to the client's x and z, y following its own fall). `B47` is now also true for `b46mp` (client position, C03 packet rule, ticksExisted counted by the world tick, copy put back after its update), `run46` is chosen first. Result: 15 of 19 records unchanged apart from row element 4 (player ticks, 0 -> 1 on tick 0) and the new element 8 (copy position); 4 differ: `zombie-touch-8011` (player push x -0.1498 vs -0.2496 from tick 1), `zombie-hit-8012` (zombie pitch toward the player's eyes), `witch-knocked-8016` and `witch-knocked-poison-8018` (witch pitch). The cause is the harness only: the old probe left the copy's y at its own fall step each tick, the new one puts the copy back at the client's reported place like `NetHandlerPlayServer.processPlayer` (the model batch 47 bytecode-read and executed). The port replays all 19 new records with the old workarounds removed (`hurtByTime = clock + 1`, `sent = null` for b46mp), the two workarounds are removed; the port needed no change for it. The b46mp test (`mobpush-b46.test.js`) is unchanged and passes.

## Evidence

- Executed: b50lb (23 records), regenerated b46mp (19 records, unchanged scenario set), both on the unchanged obfuscated classes.
- Bytecode-read: the `bk` table above, `sw.f`/`sv.f(FF)`, `yk.h`, the ghast.

## Verification

- `EW_SET=b50lb node tools/verify-endermanwolf.mjs` -> 23 records; `EW_SET=b46mp` -> 19.
- `node --test src/legacy-body-b50.test.js`: 28 pass.
- 63 neighbouring test files (everything mentioning renderYawOffset, bodyYaw, rotationYawHead, turnBody or the replay, plus blaze, fireballs, giant, legacy, silverfish, spider, pigman, piston, away, squid, entities, entity-tracker, tracker): 1,374 pass, 0 fail.
- `npm run build`: ok. No full `npm test`; no browser check (a few degrees of body yaw).

## Follow-ups

- The ghast has no executed body or flight record (the probe double never lets it start a course); the dragon's `renderYawOffset = rotationYaw` and the squid's turn are bytecode-read only.
- A silverfish pulled into a retracting block suffocates earlier in the port than natively (health 7 and a death at tick 14 natively); not body related, not investigated.
- `EndermanWolfProbe` blaze crackle (`fire.fire`) is recorded by the probe world double as a server sound; the replay drops it (the port plays it on the client copy).
