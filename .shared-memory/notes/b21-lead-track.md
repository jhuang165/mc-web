# Batch 21 lead (claude-b21-lead, 2026-11-07)

## Summary
Seven Sonnet tracks, each in a manual worktree `../wt21-<name>` on branch `batch21-<name>` (cut from 88e1158), merged into main with `--no-ff`: modalfont (ca4d2dd), combat3 (c8f066c), interchange2 (4543aee), loading2 (ad70380), spawning4 (04c8f7d), debugscreen (0a0b360), firefx (0726655). debugscreen and firefx were added mid-batch at the user's request (F3 like the original, fire/lava screen effects and the fizz sound). Per-track notes: `*-b21-track.md`.

Merge conflicts: only the `src/main.js` import block (loading2 vs modalfont, then spawning4); resolved by keeping every import (`presolveWorld` replaces `presolveSpawn`).

Lead commit d0c1ac8 (user request "get rid of those dialog screens"): removed every non-native gameplay hint toast (room to build, gather material, select a block, hoe, tool broke, not hungry, flight on/off, back on solid ground, recovered items, world-open mode hint, pointer-lock fallback hint). Error and import/export notices stay. Boarding any vehicle now shows `mount.onboard` ("Press LSHIFT to dismount", sneak key display string) on the record line (NetHandlerPlayClient.handleEntityAttach -> GuiIngame.func_110326_a(text, false)); bytecode recalled, not re-probed this batch. `player-physics-baseline.json` lost only its toast strings.

Languages: `npm run lang:fetch` was run in the Desktop checkout (73 `.lang` files + manifest in ignored `public/lang/1.7.10/`), so the user's :5179 server offers all languages. Nothing language-related is committed (Mojang files).

Version 0.51.0.

## Verification
- `npm test` 4302 pass, 0 fail on merged main (after the lead commit); `npm run build` ok.
- Muted headless Chrome on :5189 (server stopped afterwards): language manifest 74 entries; a new default world (gen 18) opened in 1.5 s, longest long task 127 ms, spawning ring active (272 columns after 6 s, 142 mobs), no hint toast, native F3 text (`artifacts/b21-lead/f3-merged.png`), no console errors.

## Follow-ups
- Light volume build (~120-150 ms) is the last main-thread block at world creation; portal trips unsliced.
- Container screens still use the DOM `modal()` shell.
- F3+B hitboxes, F3+S/T, F3+C; F3 counts are approximations; overlay not drawn over GUIs.
- Ring mobs frozen until in the ticking window; player edits in ring columns not applied.
- combat3 item 3 (skeleton arrow on villager, player as zombie target through door) not done; zero-size broken armour stack not ported.
- mount.onboard not shown for /summon-mounted or imported rides beyond the edge check.
