import { isFlower, isCrop, LADDER, CACTUS, REEDS, TNT } from "./world.js";
import { soundLevel, normalizedVolume, normalizedPitch } from "./settings.js";
export function blockSound(id) {
  // BlockReed and BlockTNT: soundTypeGrass; BlockCactus: soundTypeCloth.
  if ([1, 5, 39, REEDS, TNT].includes(id)||isCrop(id)||isFlower(id)) return "grass";
  if ([2, 24, 25,29,30].includes(id)) return "gravel";
  if (id === 6) return "sand";
  if ([4, 7, 13, 20, 21, 133, LADDER, 108, 110, 112, 87, 91, 92, 93, 95, 96, 97, 119, 120, 124, 125, 126, 127, 128, 129].includes(id)) return "wood"; // 119-129: redstone torches, button, plates, comparators and sensor (redstone-blocks-2.js SOUND2) // 97: the wooden door // 87-96: stairs share the base block sound (wood ones here)
  if (id === 19 || id === CACTUS) return "cloth";
  if (id === 23 || id === 46) return "snow";
  return "stone";
}
// Block.soundTypeLadder: digging and placing say dig.wood, steps say step.ladder.
export const stepSound = (id) => (id === LADDER ? "ladder" : blockSound(id));
export const attenuationDistance = (volume) => (Math.fround(volume) > 1 ? Math.fround(16 * Math.fround(volume)) : 16);
export class SoundBank {
  constructor(options, listener) {
    this.options = options;
    // Local browser verification can silence this tab without touching saved options.
    this.tabSilent = !!import.meta.env?.DEV && new URLSearchParams(globalThis.location?.search ?? '').has('silent');
    this.listener = listener;
    this.cache = new Map();
    this.active = new Map();
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
    if (this.tabSilent) return;
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
  // SoundEventAccessorComposite: the clip carries the category of the event that was played
  // (sounds.json "category"); nested "event" entries keep the outer event's category.
  resolve(event, depth = 0, category) {
    if (depth > 5) return null;
    const definition = this.manifest?.events[event];
    if (!definition)
      return this.manifest?.files[event]
        ? { name: event, volume: 1, pitch: 1, category: category ?? null }
        : null;
    category ??= definition.category ?? null;
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
        if (s.type === "event") return this.resolve(s.name, depth + 1, category);
        return { volume: 1, pitch: 1, ...s, category };
      }
    }
    return null;
  }
  // Master level: SoundManager.playSound skips everything at master volume 0 and the sound system
  // applies it as master gain. Category volume: getNormalizedVolume, which skips a 0 result.
  master() {
    if (this.tabSilent) return 0;
    return soundLevel(this.options().soundLevels, "master");
  }
  async play(event, { volume = 1, pitch = 1, position = null } = {}) {
    if (!this.options().sound || this.master() <= 0) return;
    this.unlock();
    if (!this.context) return;
    await this.ready;
    const clip = this.resolve(event);
    if (!clip) return;
    const entryVolume = clip.volume ?? 1;
    if (normalizedVolume(volume, entryVolume, this.options().soundLevels, clip.category) === 0) return;
    const buffer = await this.buffer(clip.name);
    if (!buffer || !this.options().sound || this.master() <= 0 || this.active.size >= 18) return;
    try {
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = normalizedPitch(pitch, clip.pitch ?? 1);
      let attenuation = 1,
        pan = 0;
      if (position) {
        const listener = this.listener(),
          dx = position.x - listener.x,
          dz = position.z - listener.z,
          dy = (position.y || 0) - listener.y,
          distance = Math.hypot(dx, dy, dz);
        // SoundManager.playSound passes 16 blocks, or 16 * volume above volume 1, as the
        // attenuation distance; the linear falloff over it is assumed (paulscode, not in the JAR).
        attenuation = Math.max(0, 1 - distance / attenuationDistance(volume));
        pan = Math.max(
          -1,
          Math.min(
            1,
            (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / 12,
          ),
        );
      }
      const playing = { gain, volume, entryVolume, category: clip.category, attenuation };
      gain.gain.value = this.gainOf(playing);
      source.connect(gain);
      if (position && this.context.createStereoPanner) {
        const p = this.context.createStereoPanner();
        p.pan.value = pan;
        gain.connect(p).connect(this.context.destination);
      } else gain.connect(this.context.destination);
      this.active.set(source, playing);
      source.onended = () => this.active.delete(source);
      source.start();
      return true;
    } catch (e) {
      this.status = e.message;
    }
  }
  gainOf(p) {
    return normalizedVolume(p.volume, p.entryVolume, this.options().soundLevels, p.category) * this.master() * p.attenuation;
  }
  // SoundManager.setSoundCategoryVolume: a master change regains every playing sound; another
  // category regains its sounds and stops those whose normalized volume drops to 0.
  updateVolumes() {
    for (const [source, p] of this.active) {
      if (p.category && p.category !== "master" && normalizedVolume(p.volume, p.entryVolume, this.options().soundLevels, p.category) <= 0) {
        try { source.stop(); } catch {}
        this.active.delete(source);
      } else p.gain.gain.value = this.gainOf(p);
    }
  }
}
