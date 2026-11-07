// paulscode SoundSystem 20120107 as 1.7.10 drives it (public/research/sound.md). Replayed against sound-reference.json
// (tools/probes/SoundProbe.java: the unchanged paulscode and original classes, no audio device).
const f = Math.fround;

// SoundSystemConfig defaults, which 1.7.10 never overrides: 28 normal and 4 streaming channels.
export const NORMAL_CHANNELS = 28;
export const STREAMING_CHANNELS = 4;
// ISound.AttenuationType values as handed to paulscode (SoundSystemConfig.ATTENUATION_*).
export const ATTENUATION = Object.freeze({ NONE: 0, ROLLOFF: 1, LINEAR: 2 });
// SoundManager.playSound: 16 blocks, or 16 * volume above volume 1 (the raw ISound volume, not the clamped gain).
export const attenuationDistance = (volume) => (f(volume) > 1 ? f(16 * f(volume)) : 16);

// SourceLWJGLOpenAL.calculateDistance: float coordinates, double arithmetic, one float result.
export function sourceDistance(source, listener) {
  const dx = f(f(source.x) - f(listener.x)), dy = f(f(source.y) - f(listener.y)), dz = f(f(source.z) - f(listener.z));
  return f(Math.sqrt(dx * dx + dy * dy + dz * dz));
}
// SourceLWJGLOpenAL.calculateGain: LINEAR is 1 at distance 0 or less, 0 from distOrRoll on, else 1 - distance / distOrRoll in
// float; every other model gives 1 (OpenAL's own rolloff is switched off, AL_ROLLOFF_FACTOR 0).
export function sourceGain(model, distance, distOrRoll) {
  if (model !== ATTENUATION.LINEAR) return 1;
  if (distance <= 0) return 1;
  if (distance >= distOrRoll) return 0;
  return Math.min(1, Math.max(0, f(1 - f(distance / distOrRoll))));
}
// AL_GAIN of a source: paulscode's gain * sourceVolume (the normalized SoundManager volume), as floats. The master gain is
// the OpenAL listener gain and multiplies on top.
export const alGain = (gain, normalizedVolume) => f(f(gain) * f(normalizedVolume));

// Stereo placement: the source's direction on the listener's right axis. OpenAL's own panner is not in the JAR set, so this is
// the plain sine of the azimuth (the right component over the distance), not a probed value.
export function stereoPan(source, listener, yaw) {
  const dx = source.x - listener.x, dy = (source.y || 0) - listener.y, dz = source.z - listener.z, d = Math.hypot(dx, dy, dz);
  if (!(d > 0)) return 0;
  return Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / d));
}

// WorldClient.playSound(.., distanceDelay): beyond 10 blocks (squared distance above 100 from the view entity) the sound is
// held (int)(sqrt(d2) / 40 * 20) client ticks, as SoundHandler.playDelayedSound. 0 plays at once.
export function distanceDelayTicks(distanceSq) {
  return distanceSq > 100 ? Math.trunc((Math.sqrt(distanceSq) / 40) * 20) : 0;
}

// paulscode Library.getNextChannel for a source without priority (1.7.10 never sets priority): a source already holding a
// channel keeps it; else the first channel from the rotation pointer whose source is gone or no longer playing; else, with every
// channel busy, the channel at the rotation pointer is taken over (its source stops playing). The pointer then moves one past.
export class ChannelPool {
  constructor(size) {
    this.slots = new Array(size).fill(null);
    this.next = 0;
  }
  // Returns { index, prev, prevPlaying }: the channel taken, the handle it held and whether that was still playing.
  acquire(handle, playing = (h) => h.playing) {
    const n = this.slots.length, start = this.next;
    let index = start, found = -1;
    for (let k = 0; k < n; k++, index = (index + 1) % n) {
      const held = this.slots[index];
      if (!held || !playing(held)) { found = index; break; }
    }
    if (found < 0) found = start;
    const prev = this.slots[found];
    this.slots[found] = handle;
    this.next = (found + 1) % n;
    return { index: found, prev, prevPlaying: !!prev && playing(prev) };
  }
  clear() {
    this.slots.fill(null); // SoundManager.stopAllSounds: the rotation pointer stays where it was
  }
}
