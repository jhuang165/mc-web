# 0.23.3 fan-out integration (2026-11-01)

Three worktree subagents merged onto main after GEN-04f (e3a80b6), plus a user-reported fix:

- Fall damage (user report, cac38ab): main.js now feeds the player's fallDistance through `moveEntity`'s Entity.updateFallState and uses the returned landing distance, so the clipped landing move no longer counts. Live Survival check: 1/2/3-block drops and a jump off a 2-block ledge 0 damage; 4 → 1, 5 → 2, 8 → 5. Regression in player-movement.test.js.
- PLAYER-01 follow-ups (handoff_player01_followups.md): death-messages.js chat line, fresh-hit-only hurt sound + death sound, Survival.hurtTime for camera/flash on top-ups, void damage past spawn protection/Creative/armour. Live check: suffocation death shows "Player suffocated in a wall".
- PLAN-03i controls (handoff_settings_controls.md): invert mouse, ±90° clamp, MouseFilter cinematic camera, nine SoundCategory volumes, settingsVersion 3. Options screen checked live with native labels.
- PLAN-03b tranche (handoff_plan_03b_metadata_2.md): 1,333 semantic / 933 alias / 2 invalid / 468 unclassified.
- Fixed intermittent `entities.test.js` limb-swing fixture: tick() recomputes `day`, so the fixture now sets `isDaytime`; reproduction went from 125/3000 sun-ignition hurts to 0.

Tests: npm test 728/728, npm run build OK. No Site publish. Browser checks ran on a separate port with all sound levels at 0.

Open: attacker/fall/projectile death messages; reachable void (main.js teleports below y 1, world.get returns lava below 0, Creative die()); looting needs enchantments; key rebinding/options.txt; music/record/ambient sound sources; remaining 468 metadata values need tile-entity/renderer evidence.
