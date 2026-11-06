Batch 8 (five Sonnet worktree agents, merged by the lead), pushed to github main d917ae6..8c17e51.

Merges:
- horse inventory screen with a model preview (dd9b29f)
- mob step sounds for pigman, wither skeleton and horse gallop, from MobStepProbe (27cfd10)
- reddust, enchantment-table and slime particles plus redstone/enchant display ticks (5e4c7a6)
- player detection scaled for sneaking, invisibility and armor via MobAI.closestVulnerablePlayer (a496635)
- projectile and creeper Fuse/ExplosionRadius NBT import and export (a3e3672)

Lead fixes (8c17e51):
- The horse screen title follows wi.cN: "Horse" unless chested, otherwise the custom or type name. The title is HTML-escaped.
- openHorse threw a ReferenceError (syncContainerState) on every open since 90e85b3. Fixed.
- The flaky zombie-villager convert test now seeds Math.random.

Tests: npm test 3177 pass / 0 fail; build OK. Browser-checked (muted) on :5180: donkey/mule screen, reddust and enchant particles.

Gaps:
- The horse preview is a static pose.
- Not browser-checked: opening a horse with sneak-click (covered by a source test).
- The blaze has no detection scaling; the enderman/ghast bR is not run natively.
- Not probed: the small/big fall boundary.
- Fence step rule.
- Cloud and footstep particles have no emitters, and touching redstone ore has no particles.
- Not exported: fireballs, eggs, bobbers, eyes of ender and rockets. Unowned pearls are lost.
- A chested horse renamed mid-session shows its new name; native keeps the old one until reload.
- The agent worktrees under .claude/worktrees were not cleaned up.