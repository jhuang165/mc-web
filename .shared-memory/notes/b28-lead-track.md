# Batch 28 lead (claude, 2026-11-08)

Eight Sonnet tracks ran in `../wt28-<name>` on `batch28-<name>`, cut from 7b67a97 (0.56.0, equal to github/main). Each was reviewed and merged --no-ff on `batch28-lead`. The per-track notes are `<name>-b28-track.md`. All tracks hit the rate limit once and were resumed.

## Merges
- **anaglyph2**: `meshAnaglyph` and `anaglyphMultiplier` in `anaglyph.js`; `Mesher.tint(color, native)` with water and vines raw; stem tint; sunrise fan centre; remesh on toggle.
- **village3**: `reputationNames()` TreeMap order; golem kill -5 when not player-made and recently hit; `source.playerName` honoured; reputation and fight probes.
- **dimrules**: `PROVIDERS` uses the native `hasNoSky` (aqo.g, Nether and End) and `isHellWorld` (aqo.f, Nether); `actualHeight` 128 for both; readers in buckets, dimension-live, maps-clock-live, redstone-runtime, streaming-light fixed; `simulationKey(d)` gives Nether/End their own Random.
- **text2**: bidi later paragraphs; `randomGlyphIndex` over 256 cells; `.kr` spans re-picked per frame; `colorCodeTable(anaglyph)` and `setFontAnaglyph` at startup.
- **leads2**: mob-held leads (live, import, export, `relinkMobs`); `clearSpentStack`; size <= 0 feeding; Creative leads kept.
- **negstacks3**: `env.giveDrop` (whole stack, delay 0, owner) replaces `dropStack`; item entities save `owner`; dispenser slot pick and result keep negatives; `Container.drop` refuses only 0.
- **interchange5**: `imported-population-dims.js`; `orig` overlay (`stored-overlay.js`, `whole-save-columns.js`, JSON `o`); kept populate records; furnace `lit`.
- **dimperf**: `createDimensionWorker` in `streaming-generator.js`; `ringPorts` ring workers; `units()` guard before centring; arrival warm-up lanes.
- **Conflicts**: none. Auto-merges in `src/main.js` (text2, negstacks3, dimperf), `src/entities.js` (leads2), `src/region-export.js` and `src/scene.js` (interchange5).
- Review notes: the dimension worker relies on `DimensionWorld.netherChunk/endChunk` being stateless per column (fresh RNG and bridge per call; checked). Any new generator state must be mirrored in `createDimensionWorker`.

## Verification (batch28-lead caf7021 plus the release commit)
- `npm test`: 4741 pass, 0 fail (the spawner timing test that flaked in track runs under load passed).
- `npm run build`: ok. Bridge unittest: OK. `git diff --check 7b67a97 HEAD`: clean.
- Muted headless Chrome on vite :5281 (`artifacts/b28-lead/smoke.mjs`, `nether-torch.mjs`):
  - New world in 1.0 s; one long task (50 ms) in the 20 s after load.
  - Torch block light 14, neighbour 13 in the Overworld and End; removal restores the earlier light at 12 Nether and 2 End spots. The smoke's single Nether spot sat next to lava (light 14 before and after).
  - Inventory draws through `.container-draw .gui-slot`; `textHtml` styled classes present; anaglyph on sets `post.anaglyphOn` and `anaglyphUpload.state.on`.
  - No long tasks in the first 15 s after arriving in the Nether or the End (batch 27: one of 152-497 ms in the Nether).
  - The only console error is the `/favicon.ico` 404. Screenshots: `world-20s.png`, `inventory.png`, `chat-styled.png`, `anaglyph.png`, `nether.png` (arrival inside the portal, as in batch 27), `end.png`.

## Remaining gaps
- In the "Done in batch 28" section of `public/research/remaining-gaps.md`; the batch 27 open list was trimmed to what is still open.
- Batch 29 candidates: anaglyph DOM GUI and chunk-update skip; bidi embedding codes across paragraphs; village fight mob targets (mob-on-mob revenge); Nether/End sapling and leaf ticks; world-import `simulation` stream; leashed mob death and unusable Leash tags; Creative drop filter; saved TileTicks import; End-to-Overworld return task train; worker memory.
- Not pushed to github main. The canonical `game/` (5179) stays at 7b67a97 until the user approves.
