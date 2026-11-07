# Hardcore mode and save-folder import (batch 14)

Evidence label: bytecode-read, not probed. The GUI classes (bdb GuiCreateWorld, bdc GuiGameOver, bdm GuiOptions, bdy GuiSelectWorld.List), `MinecraftServer.func_147139_a` and `NetHandlerPlayServer.processClientStatus` (nh) were read with javap from the 1.7.10 jar; no native probe was run. Do not read this as full parity.

## What the native game does (as read)
- Create World: the game mode button cycles Survival, Hardcore, Creative. In Hardcore the Allow Cheats and Bonus Chest buttons are disabled and the created WorldSettings drops both. The mode lines are `selectWorld.gameMode.hardcore.line1/line2`. "hardcore" is not a GameType name, so the world is Survival with the WorldInfo hardcore flag.
- Difficulty: a hardcore world runs on Hard; the Options difficulty button is disabled and reads "Difficulty: Hardcore". The GameSettings value is untouched, so it applies again in other worlds.
- Select World: a hardcore world shows `gameMode.hardcore` in dark red in place of its game mode.
- Game over: hardcore on the integrated server shows a single button, id 1 "Delete world" (y = h/4 + 96), with the `deathScreen.hardcoreInfo` line; other worlds show Respawn (id 0) and Title screen (id 1). All buttons enable after 20 ticks. Delete world opens "Are you sure you want to quit?" with Title screen (leave, keep the world) and Respawn. In a hardcore world, Respawn sends the respawn packet and the server kicks the player ("You have died. Game over, man, it's game over!") and deletes the world.

## Browser implementation
- `src/hardcore.js` holds the pure rules (mode cycle, flags, game over view, `deleteWorldStorage`); `main.js`, `menus.js` and `menu-screens.js` call it.
- The flag is saved on the world record (`hardcore: true`, mode survival). Difficulty is forced to Hard through `worldDifficulty`; `/difficulty` is a no-op on the effective value because `updateDifficulty` reads the same function.
- Hearts use the existing `hardcore` parameter of `heartLayout`.
- Game over: "Game over!", score, info line and "Delete world" (enabled after 1000 ms = 20 ticks), then the confirm view. Title screen saves and leaves. Respawn leaves without saving and deletes the shelf entry plus the stored data of `id`, `id~-1` and `id~1`, then shows the kick text as a toast.
- Browser divergence: the non-hardcore death screen is unchanged (its Title screen button has no confirm dialog).

## Import
- `hardcore` in level.dat carries to the record and is played as hardcore (it used to be played as Survival).
- `abilities.flying` applies to a Creative player; `SpawnForced` becomes the browser's /spawnpoint (`playerSpawn`), an unforced spawn stays a bed spawn; `Sleeping` is applied as native does (the player is woken at once; the bed's occupied bit is cleared and the player stands beside it, `wakeFromBed`, applied at launch).
- Import screen: "Java save folder..." uses `showDirectoryPicker` where present, else an `<input webkitdirectory>`. Batch 15: a save with Anvil region files is imported whole (see [region-import](region-import.md#whole-save-import-batch-15)); a save without them still reads the 8x8 chunk area around the player (else the world spawn). level.dat, the player and stats are read either way. Nothing is uploaded.

## Limits
- Superseded in batch 15: all three dimensions' region files are imported as stored full columns (a separate IndexedDB store, not a diff against the generator). Pre-Anvil `.mcr` files are ignored.
- Several player files: the most recently modified one is taken, and the choice is reported.
- Sleeping and the hardcore kick sequence are bytecode-read only.
