# worldflags77 (batch 77)

## Summary
- Generate Structures off (generation 21, and 23 for imports) was checked against an executed native ChunkProviderGenerate probe. The port's area generation matches in every sampled chunk, so no generator change was needed.
- Two real gaps fixed: `World.mapFeatures` did not follow the generation for a streamed record (17/19/21/23), and `region-export.js` wrote `MapFeatures:1` for a generation-21/23 world. Both now use `mapFeaturesOn(generationVersion)`.
- The dedicated server snapshot now carries `hardcore` (simulation.js, server-dimensions.js); main.js copies it into the remote record, so the death screen reads "Leave server" and hearts use the hardcore row (v 45).
- GuiMenusProbe records Resource Packs rows and the Multiplayer LAN-scan row with its dots; the port now draws the LAN row (last row, dots by time) and centres short server lists.
- New replay: src/worldflags77-b77.test.js (9 tests).

## Evidence
- Executed: tools/probes/WorldFlagsProbe.java -> public/research/world-flags-reference.json (26 records: 5 fixtures with mapFeatures true and false, 21 off-only; ordered call/write hashes, tiles, entities, 2x2 chunk hashes).
- Executed: gui-menus-reference.json rows GuiMultiplayer, +t300/+t600/+t900/+t1200, +servers1..4, GuiScreenResourcePacks+packs, +packs+selected (Sys.now is a probe double).
- Executed: native list content is vertically centred when shorter than the view (offsets 52/34/16/0 at 240 high). The bytecode cause is not read.
- Port-read: level-dat.js maps MapFeatures to 22/23 and mapFeaturesOn(21/23) is false, so 21 and 23 agree. main.js hardcore wiring, heartLayout hardcore row.
- Bytecode-read: none new in this track.

## Verification
- node --test src/worldflags77-b77.test.js: 9 pass. The port's structures-off area (gen 21) equals the native mapFeatures=false hashes in all 21+5 off records; the structures-on contrast fixtures differ from off.
- Targeted existing tests (guireplay76-b76, level-dat, serverprops-b69, generation gates, damage-fx, mptabcomplete-b69 and tests that import region-export or the pack/server-list UI): all pass.
- Updated mptabcomplete-b69.test.js: its fake `g.text` now has `set()`, because the server list adds the LAN dots text (not a behaviour change).
- The structures-on (gen 20) replay is partial: the test only requires that at least one fixture matches; the full on-case replay stays in structure-population-area.test.js.

## Follow-ups
- Native cause of the server list centring is not bytecode-read.
- Pack row descriptions carry a trailing "§r" natively (chat-component formatting); the port omits it. The Default row's description is a probe artefact.
- Gen 20 vs native on-fixtures through PopulationArea are not all matched; use StructurePopulationArea for that.
- Hardcore: only the join flag is carried; respawn/ban flow is unchanged (b69).
