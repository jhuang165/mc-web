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
- Positions are the port's doubles, cast to float only in the gain.
- Stream start timing (see Round 4) and `World` Random draws between mood draws remain open.
- The S29 filter drops a world sound beyond range of the feet; the port applies it by event name (`sound-origin.js`), not per call site.
- Sounds.json random choice uses `Math.random` (the original's unseeded Random).

## Round 4 (batch 20): minecart clips, S29 range, category volumes
Code: `cart-sounds.js`, `sound-origin.js`, `audio.js` (`playMoving`, `updateVolumes`), `tools/import-vanilla-media.mjs`; tests
`src/audio4.test.js` (7 tests). Nothing new was run natively; this round is bytecode-read plus the manifest/asset-index diff.

Imported: `minecart.base` (`minecart/base.ogg`, category neutral) and `minecart.inside` (`minecart/inside.ogg`, category player), the
only two sound events the 1.7.10 port triggers (`bsm`, `bsn`) that the manifest lacked. The diff of the 1.7.10 `sounds.json` (229
events) against the manifest also lists `random.wood_click` (no class of the JAR references the string, so not imported) and the
streamed `records.*` / `music.*` events (the untracked stream set, `npm run music:fetch`). The importer got the `minecart/` prefix
and the `ambient/cave` clips that earlier batches had added by hand, and a `MC_ASSET_OBJECTS` option to read the objects of a local
launcher `assets/objects` folder instead of downloading. The two entries were added to the committed manifest in place (a full
importer run reproduces the same entries but in a different key order); the clips are original Mojang assets under the manifest's credit.

Minecart sounds, bytecode-read: `WorldClient.spawnEntityInWorld` (`bjf.d`) plays `new MovingSoundMinecart` when the entity was added and
is an `EntityMinecart`; `EntityClientPlayerMP.mountEntity` (`bjk.a`) plays `MovingSoundMinecartRiding` for a mounted `EntityMinecart`.
`CartSounds` mirrors both once per client tick (a cart seen for the first time; `rider.vehicle` turning into a cart; boats and horses
are not carts). `SoundBank.playMoving` loops the clip (paulscode toLoop) through `SoundBookkeeping`, so the tick update sets volume
and position (cart source: LINEAR, distance 16 as started, mono clip panned; riding: attenuation NONE). The sound starts at the
constructor volume 1 for the first tick, as natively, and a world change (`stopStreams`) restarts them.

S29 and doubled sounds (bytecode-read): `RenderGlobal` (`bma`) implements `IWorldAccess.playSound` and `playSoundToNearExcept` as empty
methods, and `World.playSoundAtEntity` / `playSoundEffect` only iterate the world's accessors. On the client world they are silent;
on the server `WorldManager` (`mp`) sends S29, `playSound` to everyone within 16 blocks (16 * volume above 1, as `broadcastRange`)
of the feet, `playSoundToNearExcept` skipping its player, who plays its own `EntityPlayer.playSound` locally
(`EntityPlayerSP.playSound` -> `World.playSound` at the feet). So a player action is heard once either way, and the port, which has one
`play` call per action (step, swim, splash, dig, break, place, eat, burp, bow, pop, orb, fall), cannot double them; no site mirrored
a server copy. The one observable effect of the filter is the band where a sound is within 16 blocks of the eye but not the feet:
natively dropped. `play` now applies `receivesBroadcast` (feet from the listener) to positioned sounds except the client-made ones
(`gui.`, `music.`, `records.`, `minecart.`, `fireworks.`, client thunder and cave mood). Not re-verified per call site: whether each
call site's event is server- or client-made; the list is by event name.

Category volumes (bytecode): `getNormalizedVolume` is `(float) clamp(sound.volume * entry.volume * categoryVolume, 0, 1)` in
doubles (already matched), MASTER or no category gives 1. `setSoundCategoryVolume(category, v)`: MASTER only sets the master gain;
another category visits only the sounds registered under that category and stops one whose normalized volume is <= 0. The port
visited every playing sound on any slider move; `updateVolumes` now stops only sounds of the categories whose level moved.

Stream start delay: the JAR configures no paulscode streaming (its `SoundSystemConfig` calls are `addLibrary` and `setCodec` only) and
the paulscode jar is not among the local libraries, so there is no concrete buffer count or size to model. Not modelled: streams
start at once.
