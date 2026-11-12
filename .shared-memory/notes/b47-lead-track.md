# Batch 47 lead (claude, 2026-11-11)

Five Sonnet tracks ran in `../wt47-<name>` on `batch47-<name>`. All were cut from 3250e20f5 (0.75.0, equal to github/main). The lead reviewed each one and merged it `--no-ff` on `batch47-lead`. Each track has its own note, `<name>-b47-track.md`. Every track was vanilla only, with no `server/` or `src/multiplayer/` edits. The gun side runs separately and was not touched.

## Merges (in merge order)
- **passes2** (76703d351): thrown potions and mob-held eggs and potions draw two passes, and baby bipeds use the child held frame. The witch's held potion sits at its nose; the pivot is executed, the held potion bytecode-read. Sword blocking is a pose-only use state (`beginBlocking`). Inventory layers and the item-frame compass already matched (bytecode-read).
- **awaythrows** (f8edfbdff): away balls hit carts, boats and hanging entities. The live rocket ticks in the walk (`rockets.joined`, `rocketHooks`). A hatched chick and a rider seated mid-pass keep the walk order. The cart's mob rider stays a blocker. `EntityListProbe` has 74 cases; the pearl cases need netty-all 4.0.x.
- **serverplayer** (ed339f0dd): the server copy of the player follows the C03 rule, runs `moveEntityWithHeading` with no input against the blocks and is put back after its update (19 `b47sp` records). Dragon, cart and boat pushes reach its motion. `main.js` conflicted with awaythrows on `entityTick.state` (`rockets` vs `flying`); both were kept.
- **clientvehicles** (merge after ed339f0dd): client copies of boats, carts, paintings, item frames and knots in the object tracker (`TrackerVehiclesProbe`, `tracker-vehicles-reference.json`). `bindObjectTracker` lists `vehicleTargets` and the tracker's `extraLists`. Renderers still draw the live entities.
- **horses2** (08e63579b): run-around is an AI task, unsaddled riders don't steer, and sounds, draws and foal growth were fixed (62 `b47h` records).
  - The conflicts were with serverplayer in `EndermanWolfProbe.java`, `verify-endermanwolf.mjs` and `enderman-wolf-replay.js`: both tracks used a flag `B47`, a scenario `run47` and an export `reference47`. The horse ones are now `B47H`, `run47h` and `reference47h`, and the serverplayer export is `reference47sp`.
  - **Combined-merge fix:** 4 `b47h` ride records diverged on the horse head yaw once the C03 lag was in. The b45-style harness places the probe player (the server copy itself) directly, so the replay now clears `ai.player.sent` every tick for every set except b47sp.
  - After the rename the probe was recompiled and dumped (`EW_SET=b47h` and `b47sp` with `EW_DUMP`). Both dumps are identical to the committed references (62 and 19 records).

## Verification (batch47-lead, all five merges)
- `npm test`, once: 6157 tests, 6157 passed. The 76 "exit prewarm: this.host.active" log lines are the same as in batch 46.
- `npm run build`: ok (5.07 s). Bridge unittest: OK. `git diff --check 3250e20f5`: clean.
- Muted headless Chrome smoke (vite :5546, `--mute-audio`, master volume 0; script and screenshots in `artifacts/b47-lead/`):
  - Creative world loaded.
  - Holding use with a diamond sword draws the block pose in first person and in the front view, and releasing it restores the hold.
  - A thrown splash potion of healing draws red liquid inside the bottle.
  - A witch, a horse and a boat render. The boat's client hit target is the client copy, not the live boat.
  - The scripted arrow at the boat missed its aim, so the boat-copy hit is covered by unit tests only.
  - No long tasks in 60 turns.
  - 160 ticks per 8 s in the Overworld and 159 in the Nether.
  - The server copy rests at the player's place with motion y −0.0784 on the ground.
  - The only console errors were the known static 404 and the about:blank localStorage message.

## Remaining gaps
See "Still open from batch 47" in `public/research/remaining-gaps.md`, plus each track note.
