# Batch 65 mpstats3: use stats, kill credit, fishing findings

## Summary
- `src/multiplayer/server-use.js`: fire charge (ItemFireball.onItemUse) and bone meal (ItemDye, damage 15) now work on the server and count the `use` stat. Before this batch neither item did anything on the server (the click fell through to block placement, which refuses them).
- `src/multiplayer/server-end.js`: an eye of ender set in a frame counts the `use` stat (one line).
- `src/multiplayer/server-combat-tracker.js` (new): `CombatTrackerPort` and `KillCredit`, a port of CombatTracker (rn) and EntityLivingBase.func_94060_bK (sv.aX).
- `src/multiplayer/server-stats.js`: `watchMobs` uses `KillCredit`. mobKills goes to the aX() player; the kill-by-type stat only to the player named by the killing source.
- `src/entities.js`: one line, `this.lastDealt = amount` in `damageEntity` (the amount the tracker records).
- `tools/probes/CombatBestProbe.java`, `tools/verify-combat-best.mjs`, `public/research/combat-best-reference.json` (24 executed records).
- `src/mpstats3-b65.test.js` (7 tests); `src/mpstats2-b64.test.js` updated for the two corrected rules below.

## Evidence
- bytecode-read ItemFireball.onItemUse (acq.a): returns false only if the player may not edit; otherwise sets fire on an air cell, spends the stack outside Creative and returns true even when the cell was not air. ItemStack.tryPlaceItemIntoWorld (add.a) adds objectUseStats when onItemUse is true, so every such click counts.
- bytecode-read ItemDye.onItemUse (acj.a) with damage 15: true only when func_150919_a (IGrowable.canFertilize) accepts; the stack is spent and the stat counted even if the growth roll fails. A full crop or non-growable block returns false: no stat.
- bytecode-read ItemEnderEye: onItemUse returns true only for a frame without an eye (and not editing-denied); that counts. onItemRightClick (the throw) has no addStat, so a thrown eye counts nothing. Found wrong: nothing to add for throws.
- bytecode-read EntityPlayer.attackEntityFrom (yz.a(ro, F)): `if (amount == 0) return false` after the invulnerability and Creative checks. EntityFishHook calls attackEntityFrom(causeThrownDamage(hook, angler), 0) and only sets its hooked entity when that returns true. So a hook never hooks a player (angler included; Creative is refused even earlier). Executed: record `hook-zero` (accepted false, 0 tracker entries) and `thrown-one` (accepted true). Found wrong: the "hook players" gap does not exist natively.
- bytecode-read EntityFishHook and EntityList (sg): the hook has writeEntityToNBT, but EntityList has no entry for it (no name), so Entity.writeToNBTOptional saves nothing and a restart drops every hook. The existing "hooks are not saved" behaviour is right; the test checks saves hold no hook. Found wrong: the "save hooks across a restart" gap.
- bytecode-read CombatTracker: func_94547_a (rn.a) calls g() first, which clears the list when entries exist and the victim is dead, or the age since the last entry exceeds 100 (300 once a living attacker hit while alive). The killing hit is recorded after setHealth, so the victim is dead: the list holds only that hit. func_94550_c (rn.c) compares single entries, not totals: the best EntityPlayer and the best EntityLivingBase (players count as living), first of equals wins, the player when playerAmount >= livingAmount / 3.
- executed (`CombatBestProbe`, real EntityPlayerMP victim): aX() after every hit for 24 scenarios; the port reproduces all of them (test 4). Includes the fallbacks: attackingPlayer while recentlyHit lasts, then the revenge target within 100 ticks.
- bytecode-read sv.a(ro) (onDeath): calls aX() and addToPlayerScore on it (EntityPlayer.b(sa,int): mobKills or playerKills), then Entity.onKillEntity on `DamageSource.getEntity()` (EntityPlayer.a(sv): killEnemy and the per-type kill stat).

Two corrections the above forced (b64 had them wrong): the "most damage within recentlyHit" sum rule is replaced by the exact rule; and the per-type kill stat is no longer given for a death with no source entity (fire, fall).

## Verification
- `node --test src/mpstats3-b65.test.js`: 7 pass, 0 fail.
- `node --test src/mpstats2-b64.test.js`: 10 pass; `src/mpstats-b63.test.js`: 7 pass; `src/stats.test.js`: 13 pass; `src/fishing.test.js`: 13 pass; `src/pvp-b63.test.js`: 14 pass; `src/b64-lead.test.js`: 1 pass.
- `node tools/verify-combat-best.mjs` (one JVM): 24 records.
- `npm run build`: ok. `node --check` on every touched file: ok.
- Full npm test not run (batch rule). No browser checks (batch rule).

## Follow-ups
- Not modelled on the server: bone meal on mushrooms, double plants and cocoa (IGrowable too; single player has none of them either); cocoa planting by dye.
- The revenge fallback keeps only the last living attacker and does not drop it when that attacker dies.
- A bobber touching a sleeping player wakes them natively (EntityPlayer.attackEntityFrom runs wakeUpPlayer before the zero-amount refusal); the server has no sleeping players, so nothing to port yet.
- Fire charge in the Nether and End uses a direct FIRE set, as flint and steel does there.
