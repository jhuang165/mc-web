import { isFlower, isCrop, LADDER } from "./world.js";
export function blockSound(id) {
  if ([1, 5, 39].includes(id)||isCrop(id)||isFlower(id)) return "grass";
  if ([2, 24, 25,29,30].includes(id)) return "gravel";
  if (id === 6) return "sand";
  if ([4, 7, 13, 20, 21, LADDER].includes(id)) return "wood";
  if (id === 19) return "cloth";
  if (id === 23 || id === 46) return "snow";
  return "stone";
}
// Block.soundTypeLadder: digging and placing say dig.wood, steps say step.ladder.
export const stepSound = (id) => (id === LADDER ? "ladder" : blockSound(id));
export class SoundBank {
  constructor(options, listener) {
    this.options = options;
    this.listener = listener;
    this.cache = new Map();
    this.active = new Set();
    this.status = "Loading original effects…";
    this.ready = fetch("/audio/1.7.10/manifest.json")
      .then((r) => {
        if (!r.ok) throw Error("Sound manifest unavailable");
        return r.json();
      })
      .then((m) => {
        this.manifest = m;
        this.status = `${Object.keys(m.files).length} original 1.7.10 effects ready`;
        return m;
      })
      .catch((e) => {
        this.status = e.message;
        return null;
      });
  }
  unlock() {
    try {
      this.context ??= new AudioContext();
      this.context.resume().catch(() => {});
    } catch {
      this.status = "Audio unavailable in this browser";
    }
  }
  async buffer(name) {
    if (!this.manifest?.files[name]) return null;
    if (!this.cache.has(name))
      this.cache.set(
        name,
        fetch(this.manifest.files[name].url)
          .then((r) => {
            if (!r.ok) throw Error("Sound file unavailable");
            return r.arrayBuffer();
          })
          .then((b) => this.context.decodeAudioData(b))
          .catch((e) => {
            this.status = e.message;
            return null;
          }),
      );
    return this.cache.get(name);
  }
  resolve(event, depth = 0) {
    if (depth > 5) return null;
    const definition = this.manifest?.events[event];
    if (!definition)
      return this.manifest?.files[event]
        ? { name: event, volume: 1, pitch: 1 }
        : null;
    const sounds = definition.sounds || [];
    let n =
      Math.random() *
      sounds.reduce(
        (sum, s) => sum + (typeof s === "string" ? 1 : s.weight || 1),
        0,
      );
    for (const value of sounds) {
      const s = typeof value === "string" ? { name: value } : value;
      n -= s.weight || 1;
      if (n <= 0) {
        if (s.type === "event") return this.resolve(s.name, depth + 1);
        return { volume: 1, pitch: 1, ...s };
      }
    }
    return null;
  }
  async play(event, { volume = 1, pitch = 1, position = null } = {}) {
    if (!this.options().sound) return;
    this.unlock();
    if (!this.context) return;
    await this.ready;
    const clip = this.resolve(event);
    if (!clip) return;
    const buffer = await this.buffer(clip.name);
    if (!buffer || !this.options().sound || this.active.size >= 18) return;
    try {
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Math.max(
        0.3,
        Math.min(2, pitch * (clip.pitch || 1)),
      );
      let attenuation = 1,
        pan = 0;
      if (position) {
        const listener = this.listener(),
          dx = position.x - listener.x,
          dz = position.z - listener.z,
          dy = (position.y || 0) - listener.y,
          distance = Math.hypot(dx, dy, dz);
        attenuation = Math.max(0, 1 - distance / 20);
        pan = Math.max(
          -1,
          Math.min(
            1,
            (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / 12,
          ),
        );
      }
      gain.gain.value = Math.min(
        1,
        volume *
          (clip.volume || 1) *
          (this.options().volume ?? 0.65) *
          attenuation,
      );
      source.connect(gain);
      if (position && this.context.createStereoPanner) {
        const p = this.context.createStereoPanner();
        p.pan.value = pan;
        gain.connect(p).connect(this.context.destination);
      } else gain.connect(this.context.destination);
      this.active.add(source);
      source.onended = () => this.active.delete(source);
      source.start();
      return true;
    } catch (e) {
      this.status = e.message;
    }
  }
}
