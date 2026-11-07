# Batch 20 lead (claude-b20-lead, 2026-11-07)

## Summary
Eight Sonnet worktree tracks merged with `--no-ff` into main: uifix, pistons, loading, audio4, deaths2, villagers3, interchange, lightengine. No merge conflicts and no lead code fixes were needed. Version 0.50.0; `PROJECT.md` Batch 20 section and `remaining-gaps.md` "Done in batch 20" plus updated lines (books, bonus chest, audio 14, natural spawning, villager, riders, block audit, light engine, world loading, level.dat player UUID, font clause).

## Verification
- `npm test`: 4158 pass, 0 fail on merged main; `npm run build` ok.
- Muted headless Chrome on :5181: the native-style "Loading world" / "Building terrain" screen showed, a new default world reached generation 18 in about 0.7 s, the player spawned at (69.5, 98, 67.5) on a mountain (spawn fuzz), the tutorial toast fits its box, no console errors, frame median 16.7 ms.

## Remaining gaps (follow-ups)
- World constructor population and `launch` still block about 1 s each during "Building terrain" (loading track).
- `modal()` DOM dialogs still use the page font.
- Bonus chest placed on first open rather than at world creation; owner/leash UUIDs placeholders; Attributes only for horses/zombies/pigmen.
- Unprobed piston stored-block pool boxes; player velocity during pushes.
- PvP/team-formatted death names; Thorns wear with Unbreaking.
