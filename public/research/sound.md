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


## Round 3 (batch 19): listener, bookkeeping, panning
Evidence: `tools/probes/AudioProbe3.java`, run by `node tools/verify-audio3.mjs` (compiles into an `audio3-probe/` folder of the
research directory, writes `audio3-reference.json`); `src/audio3.test.js` replays it. Code: `sound-channels.js` (listener, pan,
S29), `sound-bookkeeping.js`, `moving-sounds.js`, `audio.js`.

Probed (original `btj` SoundManager and minecart sound classes executed natively on Unsafe-allocated entities, no audio device):
- `SoundManager.setListener`, 40 cases: position is `prev + (cur - prev) * (double) partial` per axis, rounded to float; yaw and pitch
  interpolate in float; orientation vectors go through MathHelper's table. Replayed bit for bit (`nativeListener`).
- Sneaking: no sneak code in the listener; it reads `posY`, which moveEntity lowers by `ySize` (0.08 sneaking). The port's listener now
  interpolates `previous -> position`, adds `eye - motion.drop(t)`, and passes yaw and pitch (before: standing eye, no pitch).
- `update` / `isSoundPlaying` / `stopSound` / playSound bookkeeping, 2100 operations over three traces (plain, tickable, repeat-delay
  sounds) against a fake paulscode library: `playTime`, playing, stop-time, delayed and tickable counts and every `isSoundPlaying`
  answer replay (`SoundBookkeeping`). A started sound gets `stopTime = playTime + 20`; `isSoundPlaying` is
  `playing(name) || (stopTime <= playTime)`: a source that is not playing reads false for 20 ticks, then true until the update pass
  removes it. Tickable sounds are updated each tick, stopped when done; repeat sounds are requeued at `playTime + delay`.
- `MovingSoundMinecart` / `...Riding`, 160 ticks: volume `clamp(speed,0,0.5)*0.7` (riding `clamp(speed,0,1)*0.75`) when speed >= 0.01
  else 0; distance +0.0025; done when the cart is dead or the player no longer rides it. Formulas in `moving-sounds.js`; not started
  because the manifest has no minecart clips.

Read from bytecode (javap), not probed:
- `runTick` calls MusicTicker.update before SoundHandler.update, so end of stream is seen one tick late, and a MusicTicker type-change
  stop leaves the music reading "playing" so the new delay is rolled on two consecutive ticks. `SoundBank.isPlaying` now follows the
  probed rule, so MusicTicker inherits it.
- paulscode never sets `AL_SOURCE_RELATIVE`: positions are absolute. An ATTENUATION_NONE source (GUI click) sits at 0,0,0 and is panned
  toward the world origin with gain 1; the port does this for `gui.button.press` while a world is open.
- S29PacketSoundEffect: sent to same-dimension players with `d^2 < range^2`, range `volume > 1 ? 16 * volume : 16`;
  `playSoundToNearExcept` skips the source player (who plays it client-side). In single player this changes nothing audible beyond the
  strict `<` (the linear gain is already zero there). `broadcastRange` / `receivesBroadcast` encode it, unit-tested, not wired.
- paulscode's StreamThread/CommandThread start a stream well inside one tick; the port treats a started stream as playing at once.
  Not timed.
- OpenAL spatialises only mono buffers; stereo buffers (music, discs) follow only the distance gain. The port pans only mono clips.

Assumption, not verified: the OpenAL Soft behind the LWJGL natives (no native library in the JAR set, no version constant read).
`stereoPan` assumes speakers at -90/+90 degrees, azimuth in the listener frame (right = at x up, rear folded to the front) and a
constant-power pair, i.e. a Web Audio StereoPanner position of azimuth / 90 degrees (before: the sine). Checked only as maths, never
against an OpenAL device.

## Approximate or open
- The pan constants are an assumption; the Web Audio panner stands in for OpenAL Soft's mixer.
- The listener yaw/pitch are the port's per-frame look, not previous-tick-to-tick rotations.
- Positions are the port's doubles, cast to float only in the gain; the S29 filter is not wired into call sites.
- Minecart moving sounds are not started (no clips). Stream start timing and `World` Random draws between mood draws remain open.
- Sounds.json random choice uses `Math.random` (the original's unseeded Random).
