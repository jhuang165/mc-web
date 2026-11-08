# Music, records and cave ambience (1.7.10)

Target: Minecraft Java 1.7.10. Class names are the obfuscated names of the unchanged client JAR (SHA-1
`e80d9b3bf5085002218d4be59e668bac718abbc6`, `tools/research/`, not shipped), with MCP names from `joined-1.7.10.srg`.
Full parity is not claimed.

Code: `src/music.js` (MusicTicker, MusicType, getAmbientMusicType, the record sound), `src/cave-ambience.js` (the mood
sound), `src/audio.js` (streams, records, pause/stop, nested event weights), wiring in `src/main.js` and `src/weather.js`.
Evidence: `tools/probes/MusicProbe.java`, run by `node tools/verify-music.mjs` (JDK, the client JAR, the guava,
log4j-api, commons-lang3, authlib, gson and LWJGL 2 library JARs from the launcher), writes `music-reference.json`;
`src/music.test.js` replays it.

## MusicType (bth) and MusicTicker (btg)

| Type | Event | Min delay | Max delay |
| --- | --- | --- | --- |
| MENU | `music.menu` | 20 | 600 |
| GAME | `music.game` | 12000 | 24000 |
| CREATIVE | `music.game.creative` | 1200 | 3600 |
| CREDITS | `music.game.end.credits` | 2147483647 | 2147483647 |
| NETHER | `music.game.nether` | 1200 | 3600 |
| END_BOSS | `music.game.end.dragon` | 0 | 0 |
| END | `music.game.end` | 6000 | 24000 |

Delays are client ticks. `MusicTicker.update` (btg.a), with an unseeded `Random` and `timeUntilNextMusic` starting at 100:

```
type = mc.getAmbientMusicType()
if current != null:
  if type.location != current.location: stop(current); timer = randInt(0, type.min / 2)
  if !isSoundPlaying(current): current = null; timer = min(randInt(type.min, type.max), timer)
if current == null && timer-- <= 0: current = PositionedSoundRecord.func_147673_a(type.location); play(current); timer = MAX_INT
```

`randInt` is `MathHelper.getRandomIntegerInRange` (qh.a): `min >= max ? min : rand.nextInt(max - min + 1) + min`. The
first song starts on tick 100 (5 s) whatever the type. A type change stops the song and the next one comes within half
of the new type's minimum; an ended song waits `randInt(min, max)`. END_BOSS (0/0) starts on the next tick. CREDITS
never starts: its delays are MAX_INT. `music-reference.json` "ticker" holds three scripted runs (seeds 1, 42, 7: menu
to game, every type in turn, credits) whose plays, stops and timers the port matches tick for tick.

`Minecraft.runTick` calls `update` only while `!isGamePaused`. `isGamePaused` is single player, a screen that pauses
the game and a LAN server that is not public. GuiIngameMenu pauses, and so does GuiWinGame (`doesGuiPauseGame` returns
true). So in single player the credits screen freezes the ticker, and the song already playing goes on. The inventory,
the death screen and the title screen do not pause, so the ticker runs there.

`Minecraft.getAmbientMusicType` (bao.Y):
- GuiWinGame open: CREDITS.
- With a player: the Nether (provider HellProvider) gives NETHER. The End (WorldProviderEnd) gives END_BOSS while
  `BossStatus.bossName != null && statusBarTime > 0`, else END. Otherwise CREATIVE if `capabilities.isCreativeMode &&
  allowFlying`, else GAME.
- No player: MENU.

The port reads `boss-bar.js` `status` (name and frames left) for the dragon test.

## Sound handling

- `PositionedSoundRecord.func_147673_a(location)` (music): volume 1, pitch 1, no repeat, attenuation NONE at 0, 0, 0.
  The GUI factory (`func_147674_a`) is volume 0.25, NONE.
- sounds.json (SHA-1 `fce0bb3e14ade7b292a7c1d5fa785533d8106d82`): every `music.*` event has category `music` and every
  entry `stream: true`: menu1-4, calm1-3/hal1-4/nuance1-2/piano1-3, nether1-4, end/end, end/boss, end/credits.
  `music.game.creative` is `[{type: event, name: music.game}, creative1..6]`. `records.<name>` (11, 13, blocks, cat,
  chirp, far, mall, mellohi, stal, strad, wait, ward) is category `record`, a single `records/<name>` stream.
- Nested event weight: SoundHandler wraps a `type: event` entry in an accessor whose weight is the referenced
  composite's total weight (0 when the event is missing), not the entry's `weight`. Creative music is therefore 12/18
  a `music.game` song and 1/18 each creative track. `audio.js` `weight()` and `entryWeight()` now do this for every
  event; before this change the nested entry weighed 1.
- `SoundManager.playSound` skips a sound when master volume is 0 or its normalized volume (`volume * category level`,
  clamped to 0..1) is 0, so `isSoundPlaying` is false on the next tick and the ticker rolls a new delay. Moving the Music
  slider (Options > Music & Sounds, `soundLevels.music`) regains the playing song, and setting it to 0 stops it
  (`setSoundCategoryVolume`). The port does the same for streams in `updateVolumes`.
- `Minecraft.displayInGameMenu` calls `SoundHandler.pauseSounds` in single player (not on a public LAN game);
  `displayGuiScreen(null)` calls `resumeSounds`. `Minecraft.loadWorld` always calls `stopSounds`: opening, leaving and
  changing dimension stop music and records. The port pauses and resumes only the streams (music and records); short
  effects are left to finish.

## Records

`RenderGlobal.playRecord(name, x, y, z)` (from `playAuxSFX 1005` in `BlockJukebox.func_149926_b`/`dropRecord`) stops and
forgets the sound stored for those coordinates (`mapSoundPositions`). For a non-null name it sets the GuiIngame record
line from `ItemRecord.getRecord(name)` and plays `PositionedSoundRecord.func_147675_a(new ResourceLocation("records." +
name), x, y, z)`: volume 4, pitch 1, no repeat, LINEAR at the integer block coordinates (not the block centre). The
attenuation distance is 16 x volume = 64 blocks. Ejecting the disc and breaking the jukebox go through `dropRecord`, so
both stop the record. The port's `jukebox.js` already called `play(null)` on both. `main.js` now passes
`recordSound(discName(item), x, y, z)` to `SoundBank.playRecord`, which updates the falloff and stereo pan from the
listener every tick. Records do not count toward the 18-sound effect cap. A record never resumes after a reload; the
original starts one only when the disc is inserted.

## Cave mood sound (World.func_147467_a, ahb.a(IILapx;)V)

This step runs first in WorldServer's per-chunk loop (`func_147456_g`). The lightning roll, ice/snow and the random
ticks come after it and share `World.rand` and `updateLCG`. It runs only `if (ambientTickCountdown == 0 && !isRemote)`:

```
updateLCG = updateLCG * 3 + 1013904223; l = updateLCG >> 2
x = l & 15; z = l >> 8 & 15; y = l >> 16 & 255   (in this chunk)
if block(x, y, z).material == air && getFullBlockLightValue(x, y, z) <= rand.nextInt(8) && getSavedLightValue(Sky) <= 0:
  player = getClosestPlayer(x + .5, y + .5, z + .5, 8)            (strictly closer than 8 blocks)
  if player != null && player.getDistanceSq(x + .5, y + .5, z + .5) > 4:
    playSoundEffect(x + .5, y + .5, z + .5, "ambient.cave.cave", 0.7, 0.8 + rand.nextFloat() * 0.2)
    ambientTickCountdown = rand.nextInt(12000) + 6000
```

`ambientTickCountdown` (field `K`) starts at `rand.nextInt(12000)` in the World constructor and drops by one per tick
in `setActivePlayerChunksAndCheckLight` (ahb.C), before the chunk loop. `getFullBlockLightValue` (ahb.j) is the larger
of the stored sky and block light with no daylight subtracted. Saved sky light is 0 in no-sky providers, so caves in
the Nether and End also play. The sound reaches the client as a LINEAR effect: volume 0.7, 16 blocks, category
`ambient` (Ambient/Environment slider). `music-reference.json` "mood" records two runs of 60000 calls over a synthetic
air/stone and light field (seeds 5 and 99, 56 and 43 plays). The port matches every cell pick, roll, pitch, countdown
and the final LCG and Random state.

Port: `MoodSound` is attached to each world's `Weather` (`weather.mood`), which holds World.rand and updateLCG.
`Weather.tick` runs the countdown before the chunk loop, and `tickChunk` calls the mood roll first. The sound goes
through the weather events. In the Nether and End, where `tickWeather` skips the weather, `main.js` runs `Weather.tickDimension`: the same
countdown and the full chunk loop over the window and ring chunks. Since batch 27 ring chunks roll the mood draws too (the roll is server-side and every
active chunk draws while the countdown is 0; only a player within 8 blocks hears it, so ring chunks draw but never play). Since batch 18 `MoodSound.tick` also draws `World.C`'s light-check
numbers (`rand.nextInt(playerCount)`, a full Random step even for one player, then three `nextInt(11)`; probed over 5000
ticks, see [sound.md](sound.md)). The player is the eye position (server `posY`). Other draws between ticks (entities, block
updates) are still not in this stream.

## Assets

- `ambient/cave/cave1..cave13` (13 Ogg files, 524,580 bytes) are imported into `public/audio/1.7.10/ambient/cave/`, SHA-1
  checked against the 1.7.10 asset index (`1863782e33ce7b584fc45b037325a1964e095d3e`). The `ambient.cave.cave` event
  (sounds.json order) was appended to `public/audio/1.7.10/manifest.json` (486 files).
- The 41 music and record streams (100,057,449 bytes) are not in Git. `npm run music:fetch`
  (`tools/fetch-music-streams.mjs`) copies them into the Git-ignored `public/audio/1.7.10-streams/` with their own
  `manifest.json` (19 events copied verbatim from sounds.json). It reads the asset index from `MC_ASSET_INDEX`,
  `tools/research/assets-1.7.10.json` or the launcher, and the objects from `MC_ASSETS`, the launcher's
  `assets/objects` or Mojang's resources host. Every file is SHA-1 checked against the index, and sounds.json may come
  from `MC_SOUNDS_JSON` or a public mirror, hash-checked the same way. `SoundBank` merges that manifest when present.
  Without it, music and records are skipped silently and the ticker keeps rolling delays. `npm run build` copies the
  directory into `dist/` when it exists.

## Verified and approximate

Verified by probe: the seven types and delays; the ticker's timers, plays and stops over scripted type changes and song
lengths; the music, record and GUI factory values; the mood sound's cell choice, light and distance tests, pitch,
countdown reset and Random/LCG consumption. Read from bytecode, not probed: getAmbientMusicType, the
isGamePaused/pause/stop call sites, playRecord, nested event weights, the countdown's constructor and decrement.

Approximate:
- paulscode's stereo model (OpenAL's panner): the port pans by the sine of the azimuth. The LINEAR gain, channel limits and
  the eye-position listener are now probed ([sound.md](sound.md)).
- Stopping a stream is instant, where paulscode queues it, so the ticker never sees a stopped song as still playing.
- Before the page's first click there is no running audio context: the menu music is skipped and comes back after the
  next MENU delay.
