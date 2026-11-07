# Sound engine rules (1.7.10, batch 18 round 2)

Target: Minecraft Java 1.7.10; full parity is not claimed. Evidence: `tools/probes/SoundProbe.java`, run by
`node tools/verify-sound.mjs` (JDK, the unchanged client JAR, and the paulscode `soundsystem-20120107` and
`librarylwjglopenal-20100824` JARs from the launcher libraries or `MC_PROBE_LIBS`), writes `sound-reference.json`;
`src/sound.test.js` replays it. No audio device is opened: the sound system is allocated bare (its command queue is read),
paulscode's Library runs over fake channels, and OpenAL is never initialised. Code: `src/sound-channels.js`, `src/audio.js`.

## What is probed (against the original classes)
- `SoundManager.playSound` (btj.c), 53 cases: the sound system receives `newSource` / `newStreamingSource` with priority
  false, no loop, attenuation LINEAR (2) at the float position or NONE (0) at the origin, and distance `16`, or
  `16 * volume` when the raw ISound volume is above 1 (record 64, explosion 32, thunder 160000). Then `setPitch(clamp(pitch *
  entryPitch, 0.5, 2))` and `setVolume(clamp(volume * entryVolume * categoryLevel, 0, 1))`; a 0 master gain or a 0 volume
  (including a 0 category slider) queues nothing. The category level is `GameSettings.getSoundLevel` (1 for MASTER).
- paulscode gain (`SourceLWJGLOpenAL.calculateDistance/Gain`), 80 cases: distance is the float sqrt of the squared float
  differences; LINEAR gain is 1 at distance <= 0, 0 from the distance on, else `1 - d / dist` in float; every other model gives
  1. AL_ROLLOFF_FACTOR is 0, so OpenAL adds nothing. AL_GAIN = gain * sourceVolume; the master volume is the listener gain.
- `Library.getNextChannel` (1500+600+800 ops): 28 normal and 4 streaming channels (SoundSystemConfig defaults, which
  1.7.10 never overrides). Round-robin from a pointer: the first channel whose source is gone or stopped; with every channel
  busy and no priority source (1.7.10 never sets priority) the channel at the pointer is taken over and its source stops
  playing. The pointer then moves past the channel used. Ended sources free their channel at once (without waiting for
  `SoundManager`'s removal tick).
- `World.setActivePlayerChunksAndCheckLight` (ahb.C), 3 runs: the mood countdown drops by one per tick; with a player one
  `rand.nextInt(1)` and three `nextInt(11)` follow (cell around the player for `checkLight`, which draws nothing); with no
  player there are no draws.

## Port
- `audio.js` now uses the probed gain (float distance, LINEAR), a 28/4 `ChannelPool` with takeover (replacing the old 18
  effect cap that dropped new sounds), the listener at the interpolated eye (`SoundManager.setListener` uses `posY`, the
  eye), and refreshes the gain of every positioned sound each tick (`Source.listenerMoved`), effects included.
- Thunder was passed with no position; it now passes volume 10000 at its strike point (gain 1 in range, still panned).
- `SoundBank.tick` ports `SoundManager.update`'s counter and `playDelayedSound` (bytecode of `WorldClient.playSound`): with
  distanceDelay (fireworks blast, large blast, twinkle; the other call sites pass false) a sound more than 10 blocks from the
  view entity waits `(int)(sqrt(d2) / 40 * 20)` ticks. `stopStreams` is `SoundManager.stopAllSounds`: every playing sound
  stops and delayed ones are dropped.
- The cave mood player is the eye position (server `posY`), as `getClosestPlayer` uses.

## Read from bytecode, not probed
- Which call sites pass `distanceDelay` true (scan of every `World.playSound(..Z)` / `WorldClient` call: fireworks only).
- `SoundManager.isSoundPlaying`'s 20-tick grace (`playingSoundsStopTime`), the `update` removal pass, `setListener`'s
  orientation vectors and `stopAllSounds`.

## Approximate or open
- OpenAL's stereo panner is not in the JAR set: the port pans by the azimuth sine.
- Positions are the port's doubles, cast to float only in the gain; the 1.7.10 server also filters S29PacketSoundEffect to
  players within `16 * max(volume, 1)` (`sendToAllNear`), which the client gain already zeroes.
- Sneaking changes the real listener height; the port uses the standing eye.
- Streams still start through `HTMLAudioElement`, so the queued stop and start timing of paulscode's StreamThread is not
  modelled. Sounds.json random choice uses `Math.random` (the original's unseeded Random).
