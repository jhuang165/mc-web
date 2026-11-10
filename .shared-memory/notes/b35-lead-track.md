# Batch 35 lead (claude, 2026-11-09)

The five Sonnet tracks ran in `../wt35-<name>` on `batch35-<name>`, cut from 145c0e8c3 (0.63.0, equal to github/main). The lead reviewed each track and merged it --no-ff on `batch35-lead`. Each track has its own note, `<name>-b35-track.md`. The gun side runs separately (`wt-guns`, `guns-prototype`) and was not touched. Its uncommitted PROJECT.md paragraph in `game/` was kept out of these commits.

## Lead fix
- `atlas-pixels.js` was renamed to `atlas-texels.js` (5403c2132). `module-names.test.js` refuses served module names containing "pixel", because ad blockers block such script URLs. It was the only failure in the full suite.

## Merges
- **atlas3** (956835b15):
  - Both GL atlases are `DataTexture`s built from decoded PNG bytes. The canvas is kept only as a fallback and for icons.
  - Mips are built per sprite, with the native float arithmetic in `render-settings.js` `mipLevel`. The probe found an off-by-one in the old port.
  - The item atlas has float tints and converts anaglyph per level; the converted arrays are flagged `__agDone` so they are not converted again on upload.
  - `Mesher.colors()` quantises vertex colours as `setColorOpaque_F` does.
  - `AtlasProbe` hashes match all 349 textures at mip 0, 1 and 4.
- **mobpaths** (c501c144b):
  - Native search sizes: the follow-range spawn bonus puts a Hard zombie's range at about 80 to 130. A range-100 flat search expands about 31000 points; a 7-storey tower 28000.
  - `despawnedHealth`: a mob that despawned earlier in its update still searches with its real health.
  - The cap stays 30000.
  - Jockey chickens and held-item swaps were read only, not ported; the slope doors and gates goal was not started.
- **ticktree3** (42505d43a):
  - `fluids.writers`: redstone (`main.js`) and falling blocks (`attachTickTree`) hear each fluid write.
  - `Fluids.inFlight`: a cell taken from the tree but not yet run is not rescheduled.
  - `FallingBlocks.changed` was split out of `watch`.
  - Executed `TickSequenceProbe` with three scenarios over 1000 entries.
  - Real-piston tree test, plus a browser lever/piston check (head 3 ticks after the lever, retract the next tick).
- **awayrun5** (0defc3802):
  - The shadow player (`host.awayPlayer`) makes away player commands act at fire time; the queue still replays at return.
  - `/spawnpoint` (4 absolute ints), `/difficulty` and `/setworldspawn` are returned from the away run.
  - The live `/spawnpoint` follows the native argument rules.
  - `away-light.js` computes covered sky light.
  - `IdleCounterProbe`.
- **travelperf5** (5c69c2077):
  - `portalColumns` now returns `[x, z, ys]`, and `savedPortalFor` follows the Teleporter scan and tie order (checked against the executed Teleporter on 60 worlds).
  - `RingLight.residentReaches` takes about 60 us down to 5-7 us beside the resident window, with the same hashes.
  - Browser frame times were inconclusive under load; the worker and speculative caps were not measured.
- **Conflicts**: none.

## Machine load
- Three tracks each ran a full `npm test` while another ran browser walks. The load average reached about 160, and the lead killed the three full runs.
- The tracks then ran targeted tests only; their notes say the full suite was not run in-track.
- Future briefs should forbid full suites in tracks.

## Verification (batch35-lead before the release commit)
- `npm test` (run once, before the rename): 5055 pass, 1 fail (the module-name rule). After the rename, `module-names`, `atlas-texels` and `block-textures` pass (9/9).
- Targeted runs after the merges: 442, 158 and 58 pass.
- `npm run build`: ok. Bridge unittest: OK. `git diff --check main`: clean.
- Muted headless Chrome smoke (vite :5339, `artifacts/b32-lead/smoke.mjs`, `nether-torch.mjs`, `artifacts/b33-lead/away.mjs`):
  - Load took 1.27 s with no long tasks.
  - Torch light was 14/13 in all dimensions, and nether-torch found 0 mismatches over 12 Nether and 12 End spots.
  - Inventory, styled chat and anaglyph work.
  - The away trip ran 621 ticks over 57 columns in 239 ms, with no duplicate ids.
  - The only console error was the known static-asset 404.

## Cursor jumps (user report, unresolved)
- The user's cursor moves by itself; the user is not moving it. They say it happens only while the Claude app is open.
- No session made a Browser-pane, computer-use or pointer-moving call in the two hours before a jump. The Claude apps' Accessibility access is denied.
- The ChatGPT app is open with its computer-use service (`SkyComputerUseService`, `cua_node`). ChatGPT has Accessibility access, and it was relaunched within a minute of Claude. The suggested test is to quit ChatGPT.

## Remaining gaps
- See "Done in batch 35" and "Still open from batch 35" in `public/research/remaining-gaps.md`.
- Batch 36 candidates:
  - the path cap against range-100+ searches (raise it or time-slice);
  - jockey chickens;
  - doors and gates on slopes;
  - quiet-machine frame times for ring light;
  - the Overworld speculative cap;
  - DOM icons from exact bytes;
  - float light and AO arithmetic;
  - `/spawnpoint` without coordinates while away.
