# audio2 (batch 18) track

Branch b18-audio2. Sound engine round 2.

## Changed
- New: `tools/probes/SoundProbe.java`, `tools/verify-sound.mjs`, `public/research/sound-reference.json`, `src/sound-channels.js`,
  `src/sound.test.js`, `public/research/sound.md`. Edited: `src/audio.js`, `src/cave-ambience.js`, `src/main.js`, `public/research/music.md`.
- Probed against the unchanged jar and the paulscode jars (no audio device): SoundManager.playSound values, LINEAR gain curve,
  Library.getNextChannel (28 normal + 4 streaming, rotation, takeover), World.C light-check draws.
- Port: probed gain, 28/4 channel pool (the old 18-effect cap is gone), eye-height listener, every positioned sound regains
  falloff per tick, thunder positional, distance-delay (fireworks) and `SoundBank.tick`, stopAllSounds also stops effects,
  `MoodSound.tick` draws nextInt(1)+3x nextInt(11), mood player at the eye.

## Tests
`npm test` 3897 pass, `npm run build` ok. `sound.test.js` has 7 tests.

## Remaining gaps
OpenAL stereo panner, sneaking listener height, streams through HTMLAudioElement (no StreamThread timing), isSoundPlaying's 20-tick
grace, S29 server range filter, Random draws of other World ticks between mood draws.

## Proposed remaining-gaps lines
14. Music and music discs/jukebox record audio. Partial: MusicTicker with the seven MusicTypes, the Music slider, pause/stop rules and positional records (volume 4, 64 blocks) are in ([music.md](music.md)); the paulscode LINEAR gain, 28 + 4 channel takeover, eye listener and distance delay are probe-replayed ([sound.md](sound.md)). The 41 streams are not in Git (`npm run music:fetch`); without them music and records are silent. OpenAL's stereo panner and stream timing are approximated.
15. Cave ambience (`ambient.cave.cave`). Done for the World mood sound including World.C's light-check Random draws, probe-replayed ([music.md](music.md), [sound.md](sound.md)); 13 clips shipped. Other World Random draws between ticks are not in the stream.
