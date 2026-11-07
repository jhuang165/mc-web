# Hardcore track (batch 14, branch b14-hardcore)

Owner: claude-b14-hardcore. Evidence for GUI behaviour is bytecode-read, not probed (public/research/hardcore.md).

Done: Hardcore in the Create World cycle (cheats and bonus chest disabled), saved `hardcore` flag, Hard lock (options button disabled, `worldDifficulty`), hardcore hearts, Game over screen with the single Delete world button and the quit confirm, deletion of all storage ids (`id`, `id~-1`, `id~1`), red Select World line, imported hardcore levels played as hardcore. Import applies abilities.flying, SpawnForced and Sleeping. In-browser Java save-folder import (`src/save-folder-import.js`, `src/import-screen.js`).

Tests: src/hardcore.test.js, src/save-folder-import.test.js (fixture: src/level-dat-fixture.js).

Open: whole-save import (one 8x8 area only), DIM-1/DIM1 regions, non-hardcore death screen has no quit confirm, no native probe of the GUI.
