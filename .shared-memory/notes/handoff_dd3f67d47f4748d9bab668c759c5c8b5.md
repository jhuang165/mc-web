Batch 3 (five Sonnet tracks), merged to main and pushed in commits 0d3cddb..a4380de. Five tracks, each with a native probe:
- colored and storage blocks 140-148
- nether, End and quartz blocks 150-158
- shaped blocks 165-169 (wood slabs, fence gate, trapdoor, cobblestone wall)
- signs 175/176 with item 480: editor, renderer, Text1-4 persistence
- note block 177 and jukebox 178 with discs 530-541
Placeholders: the unused ids up to 176 stay `reserved`, and new blocks overwrite them in world.js. Recipe audit: 286 checked rows, 2,576 checks. Tests: npm test 2033 pass / 0 fail; npm run build ok. Browser check on localhost with audio muted: all new blocks render; the sign editor and the sign's save/reload work. It found and fixed a white sign text plane (entityMaterial needs the map at creation). Remaining: record music silent, no Nether/End dimensions, sign text in the browser font, gate/wall/trapdoor models are this build's own boxes, silk touch on double wood slabs.