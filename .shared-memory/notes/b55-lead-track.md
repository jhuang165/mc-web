# Batch 55 lead (2026-11-12)

Five Sonnet tracks were cut from be55d463b (release 0.83.0) in `../wt55-<name>` on `batch55-<name>` and merged --no-ff on `batch55-lead`. The batch was paused at the user's request mid-run and resumed the same day; horserear and effects3 were restarted from their uncommitted work. Release 0.84.0.

## Merges
- chatrarity (12093f15c), instantbreak (bdcd9e7f2), dimtracker (e2785df82), effects3 (5ba8f0c5e), horserear (988b521ca).
- Lead fix 4f39d9878: a record's tooltip name is aqua (its string rarity `'rare'` had been indexed like an array).
- Review notes: the dimtracker early-spawn entries flush before the due destroys and the later `entryOf` is a no-op for them. The effects3 claim that zombie and skeleton horses are not undead was checked with javap: `wi` overrides neither `bd()` (getCreatureAttribute) nor `aR()` (isEntityUndead). horserear removed the live `rearAmount` field; nothing else read it.

## Verification
- Full `npm test` once on the merged branch: 6641/6641. `npm run build` ok. Bridge unittest: 5 tests, OK. `git diff --check be55d463b` clean.
- Targeted tests after each merge: dimtracker + chatrarity 15, effects3 33, horserear 73. All passed.
- Muted headless smoke (`artifacts/b55-lead/smoke.mjs`, vite 5590, killed afterwards; Survival with Allow Cheats on):
  - Instant break: a torch (port id 20) clicked with a real mouse press. The predicted overlay read air 36 ms after the press, the real world 75 ms after (the queued packet). One break sound (`dig.wood`) plus the item pop; no long tasks.
  - Place: a right click placed the held block on the next frame (19 ms) with one place sound and no long tasks. In singleplayer the queued run landed in the same frame, so the overlay was not seen on its own.
  - `/give @p diamond_sword 1 0 {display:{Name:"Edge"},ench:[{id:16,lvl:1}]}` printed `commands.give.success` with an aqua "[Edge]".
  - Death: a skeleton holding the named sword, an arrow hit for 100: `death.attack.arrow.item`, "[Edge]" aqua with a `show_item` hover. The first try used a melee mob hit and got `death.attack.mob` without the item; that is correct, since 1.7.10's en_US.lang has `.item` keys only for player, arrow, fireball, thrown and indirectMagic.
  - Horse: mounted a tame saddled horse and set it rearing; the live horse and the client copy both reached rearAmount 1 from their own counters (copy flags 198).
  - Ticks 160 per 8 s in the Overworld and the Nether, no long tasks while turning; the Nether tracker held 81 copies after the dimension change. The only error was the known 404.
  - Harness notes: port block ids are not vanilla (port 3 sounds like stone, the torch is 20); a synthetic `mousedown` on the canvas does not reach the game's input.

## Follow-ups
See "Still open from batch 55" in `public/research/remaining-gaps.md`.
