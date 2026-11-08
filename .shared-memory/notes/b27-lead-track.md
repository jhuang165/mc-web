# Batch 27 lead (claude, 2026-11-08)

Seven Sonnet tracks ran in `../wt27-<name>` on `batch27-<name>`, cut from 8ab44f2 (0.55.0, equal to github/main). Each was reviewed and merged --no-ff on `batch27-lead`. The per-track notes are `<name>-b27-track.md`.

## Merges
- **negstacks2** (27059a9)
  - Picking up a -n stack stores it and fires no pickup event. The entity lives on at Count 0.
  - Armour slots keep any item. Armour points still count only real armour; I checked `armorLayer`, defense and wear.
  - -n stacks drop through `takeAll`, `dropPlayer` and `throwStacks`.
  - Creative no longer uses up name tags.
  - 362 records.
- **attributes3** (2bc2c6e)
  - `ownerPresent` checks owners by UUID, with an `ownerKey` helper.
  - `mobHitAmount` and FIXED_ATTACK cover the wolf, ocelot, slime and magma cube.
  - Skeleton damage 2, and speed bases for the squid, bat and magma cube.
  - 918 records.
- **modal2** (4c69541)
  - `bidi.js` and `bidi-data.js`, replayed against ICU4J 51.
  - `font-quads.js`.
  - `textHtml` applies bidi and the tu/ts/ti classes.
  - The sign pen advances by `Math.trunc(advance)`.
  - No `modal()` callers were left.
- **dimticks** (5367a6d)
  - `weather.tickDimension`: Nether and End random and scheduled ticks, ring mood draws, and the Nether melt rule.
  - `Fluids` takes nether and skyless options.
- **lighting4** (390dbdc)
  - NativeLight runs in the Nether and End (`lightNoSky`).
  - Ring edits replay after the window moves.
  - `world.blockTap` feeds the id shadow on any `put`.
- **interchange4** (65e60fb)
  - `imported-population.js` populates TerrainPopulated=false Overworld chunks at import (probe-verified).
  - `stored-peek.js` and `storedIndex`/`storedTop` let portal search and `/spreadplayers` read stored columns.
  - `LIST_CAP = 1<<20`.
- **atlas2** (a1844bc, b418d4c, 9c31081)
  - `atlas-upload.js` adds GPU sub-rect uploads.
  - `anaglyph.js` converts at upload. `scene.js` converts the fog, sky and cloud colours.
  - `legacyAnaglyph` keeps the old final-pixel method.
- **Conflicts.** The only one was a comment in `src/dimensions.js` (merge 9097b84). The new comment records that the port's `hasNoSky`/`isHellWorld` names are swapped relative to aqo.f/aqo.g.

## Verification (batch27-lead da011f2 plus the release commit)
- `npm test`: 4685 pass, 0 fail.
- `npm run build`: ok.
- Bridge unittest: OK.
- `git diff --check 8ab44f2 HEAD`: clean.
- Muted headless Chrome on vite :5270 (`artifacts/b27-lead/smoke.mjs`, `nether-torch.mjs`):
  - New world in 1.0-1.3 s; the longest task in the 20 s after load was 74-153 ms.
  - Torch block light 14 with neighbour 13 in the Overworld, Nether and End, all on native light.
  - Removing the torch restores the earlier light at 12 Nether spots and 2 End spots, including the 3x3x3 ring. One earlier single-spot Nether read was 13 after removal, most likely from lava or fire nearby. It did not repeat.
  - The inventory draws through `.container-draw .gui-slot`.
  - `textHtml('§n…§m…§o…')` produces `.tf.tu`, `.tf.ts` and `.tf.ti`.
  - Anaglyph on sets `post.anaglyphOn` and `anaglyphUpload.state.on`.
  - The only console error is the `/favicon.ico` 404.
  - The Nether trip had one long task of 152-497 ms in its first 15 s.
  - Screenshots: `world-20s.png`, `inventory.png`, `chat-styled.png`, `anaglyph.png`, `nether.png`, `end.png`.
- The interchange4 round trip showed furnace block 61 becoming 62 in the Nether and End. The cause is the synthetic save (an unlit furnace with BurnTime 120); natively it stays 61. Listed in the remaining gaps.

## Remaining gaps
- These are in the "Done in batch 27" section of `public/research/remaining-gaps.md`, which also corrects the stale anaglyph, riders, villager, ring, import CLI and bidi lines.
- Batch 28 candidates:
  - `/give` should drop the whole stack.
  - The End's hasNoSky and height of 128 outside the light engine.
  - Nether and End populate on import.
  - Level-0 flowing fluid and chest facing in stored cells.
  - Populate-time animals, flower pots and villagers.
  - The furnace BurnTime lit state.
  - Anaglyph vertex colours, the font table and sunrise colours.
  - Overlay pixel captures.
  - Bidi multi-paragraph strings.
  - A separate Nether Random.
  - Villager scenarios with several attackers.
  - A lead held by another mob.
  - Negative stacks in containers.
- Not pushed to github main. The canonical `game/` (5179) stays at 8ab44f2 until the user approves.
