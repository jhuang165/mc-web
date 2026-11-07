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

// MathHelper.sin / cos (qh.a / qh.b): the 65536-entry float table.
const SIN = new Float32Array(65536);
for (let i = 0; i < 65536; i++) SIN[i] = Math.sin((i * Math.PI * 2) / 65536);
const mhSin = (v) => SIN[Math.trunc(f(v * f(10430.378))) & 65535];
const mhCos = (v) => SIN[Math.trunc(f(f(v * f(10430.378)) + 16384)) & 65535];
const RAD = f(0.017453292);

// SoundManager.setListener (btj.a(yz, float)), probed (audio3-reference.json): the listener position is the player's posY
// interpolated from last tick's position (prev -> cur, double arithmetic with the float partial tick, one float each), and
// the orientation is the look and up vectors from the interpolated float yaw / pitch (Minecraft degrees: yaw 0 looks +z,
// pitch positive looks down) through MathHelper's table. Sneaking is not special: it only lowers the player's posY (ySize).
export function nativeListener(prev, cur, prevYaw, yaw, prevPitch, pitch, partial) {
  const t = f(partial);
  const lerpF = (a, b) => f(f(a) + f(f(f(b) - f(a)) * t));
  const lerpD = (a, b) => f(a + (b - a) * t);
  const p = lerpF(prevPitch, pitch), y = lerpF(prevYaw, yaw);
  const yawArg = f(f(y + 90) * RAD), negPitch = f(f(-p) * RAD), upArg = f(f(f(-p) + 90) * RAD);
  const cy = mhCos(yawArg), sy = mhSin(yawArg), cp = mhCos(negPitch), sp = mhSin(negPitch), cu = mhCos(upArg), su = mhSin(upArg);
  return {
    x: lerpD(prev.x, cur.x), y: lerpD(prev.y, cur.y), z: lerpD(prev.z, cur.z),
    orientation: [f(cy * cp), sp, f(sy * cp), f(cy * cu), su, f(sy * cu)],
  };
}
// This port's yaw (radians, 0 looks -z) and pitch (positive looks up) as the Minecraft degrees nativeListener takes.
export const minecraftAngles = (yaw, pitch) => ({ yaw: f(180 - (yaw * 180) / Math.PI), pitch: f((-pitch * 180) / Math.PI) });
export function portOrientation(yaw, pitch) {
  const a = minecraftAngles(yaw, pitch);
  return nativeListener({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, a.yaw, a.yaw, a.pitch, a.pitch, 0).orientation;
}

// OpenAL stereo placement of a mono source. paulscode never sets AL_SOURCE_RELATIVE (bytecode: no property 0x202 anywhere in
// SourceLWJGLOpenAL / ChannelLWJGLOpenAL), so AL_POSITION is the world position and OpenAL works in listener space: the right
// axis is at x up (the AL spec) and the direction is the source minus the listener. ASSUMPTION, not probed (the OpenAL Soft
// natives are not in the JAR set; the LWJGL 2.9.x natives ship OpenAL Soft, believed 1.15-era): its stereo output pans a
// mono source between speakers at -90 and +90 degrees by azimuth with a constant-power pair law, the elevation ignored and
// a source behind the listener folded onto the front. That is a Web Audio StereoPanner position of azimuth / 90 degrees.
export function stereoPan(source, listener, yaw = 0, pitch = 0) {
  const o = listener.orientation ?? portOrientation(listener.yaw ?? yaw, listener.pitch ?? pitch);
  const ax = o[0], ay = o[1], az = o[2], ux = o[3], uy = o[4], uz = o[5];
  const rx = ay * uz - az * uy, ry = az * ux - ax * uz, rz = ax * uy - ay * ux;
  const dx = source.x - listener.x, dy = (source.y || 0) - listener.y, dz = source.z - listener.z;
  const side = dx * rx + dy * ry + dz * rz, front = dx * ax + dy * ay + dz * az;
  if (side === 0 && front === 0) return 0;
  return Math.max(-1, Math.min(1, Math.atan2(side, Math.abs(front)) / (Math.PI / 2)));
}
// Left and right gains of a mono source at that pan (the equal-power pair: cos and sin of a quarter turn over the span).
export function stereoGains(pan) {
  const a = ((Math.max(-1, Math.min(1, pan)) + 1) * Math.PI) / 4;
  return { left: Math.cos(a), right: Math.sin(a) };
}
// An ATTENUATION_NONE source (the GUI button click, PositionedSoundRecord.func_147674_a) is queued at the world origin, and
// as AL_POSITION is absolute it is placed toward (0, 0, 0) like any mono source: the gain stays 1.
export const UNPOSITIONED = Object.freeze({ x: 0, y: 0, z: 0 });

// S29PacketSoundEffect (MinecraftServer's world access `mp`, bytecode-read): the server sends a sound to the players of the
// same dimension whose server position (EntityPlayerMP posX/Y/Z, the feet) is strictly within 16 blocks, or 16 * volume
// above volume 1 (the raw volume, a double), of the point: dx^2 + dy^2 + dz^2 < range^2. playSoundToNearExcept (a player's
// own EntityPlayer.playSound) skips that player, who plays the sound itself through EntityPlayerSP.playSound at feet.
export const broadcastRange = (volume) => (f(volume) > 1 ? f(16 * f(volume)) : 16);
export function receivesBroadcast(sound, player, { except = null, sameDimension = true } = {}) {
  if (!sameDimension || (except && except === player.id)) return false;
  const range = broadcastRange(sound.volume), dx = sound.x - player.x, dy = sound.y - player.y, dz = sound.z - player.z;
  return dx * dx + dy * dy + dz * dz < range * range;
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
