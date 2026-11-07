import { soundTypeOf } from "./block-sounds.js";
import { soundLevel, normalizedVolume, normalizedPitch } from "./settings.js";
import { applySoundLayers } from "./pack-sounds.js";
import { packStore } from "./resource-packs.js";
// The sound family of a block's Block.SoundType: its break event is "dig." + family and its step event "step." + stepSound.
// One native table (block-sounds.js, public/research/block-sounds.md) replaces the old per-block choices.
export const blockSound = (id) => soundTypeOf(id).break.slice(4);
export const stepSound = (id) => soundTypeOf(id).step.slice(5);
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
    this.streams = new Set(); // playing stream handles: music and records (HTMLAudioElement through the graph)
    this.records = new Map(); // "x,y,z" -> the jukebox's record handle (RenderGlobal.mapSoundPositions)
    this.streaming = false;
    // The music and record streams are optional: npm run music:fetch installs them under the Git-ignored
    // /audio/1.7.10-streams/ (public/research/music.md). Without that manifest, music and records stay silent.
    const streams = fetch("/audio/1.7.10-streams/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (m && m.files && m.events ? m : null))
      .catch(() => null);
    this.ready = fetch("/audio/1.7.10/manifest.json")
      .then((r) => {
        if (!r.ok) throw Error("Sound manifest unavailable");
        return r.json();
      })
      .then(async (m) => {
        this.manifest = m;
        this.status = `${Object.keys(m.files).length} original 1.7.10 effects ready`;
        const s = await streams;
        if (s) {
          Object.assign(m.files, s.files);
          Object.assign(m.events, s.events);
          this.streaming = true;
          this.status += `, ${Object.keys(s.files).length} music and record streams`;
        }
        // The vanilla table is kept apart so selected resource packs' sounds.json can be layered over it again on each refresh.
        this.base = { ...m, files: { ...m.files }, events: { ...m.events } };
        await this.loadPackSounds();
        return this.manifest;
      })
      .catch((e) => {
        this.status = e.message;
        return null;
      });
  }
  // SoundHandler.onResourceManagerReload with the selected packs: sounds.json of each pack layered over the vanilla events
  // (pack-sounds.js). Pack ogg files replace same-named bundled ones through the service worker.
  async loadPackSounds() {
    let meta = null;
    try { if (this.options().resourcePacks?.length && typeof indexedDB !== "undefined") meta = await packStore().getMeta("sounds"); } catch {}
    const { manifest, warnings } = applySoundLayers(this.base, meta?.layers ?? [], meta?.files ?? []);
    this.manifest = manifest;
    for (const w of [...(meta?.warnings ?? []), ...warnings]) console.warn(w);
  }
  // Minecraft.refreshResources: re-read the pack sound tables and drop the decoded clips (their files may have changed).
  async refreshPacks() {
    await this.ready;
    if (!this.base) return;
    await this.loadPackSounds();
    this.cache.clear();
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
    let n = Math.random() * this.weight(event);
    for (const value of sounds) {
      const s = typeof value === "string" ? { name: value } : value;
      n -= this.entryWeight(s, depth);
      if (n < 0) {
        if (s.type === "event") return this.resolve(s.name, depth + 1, category);
        return { volume: 1, pitch: 1, ...s, category };
      }
    }
    return null;
  }
  // SoundEventAccessorComposite.getWeight: the sum of its entries. A plain entry weighs its "weight" (1 by default); a
  // nested "event" entry (SoundHandler's accessor for type "event") weighs the whole referenced event, 0 if it is missing.
  // So music.game.creative's pool is the 12 music.game songs (weight 12) against 6 creative songs (1 each).
  weight(event, depth = 0) {
    const definition = this.manifest?.events[event];
    if (!definition || depth > 5) return 0;
    return (definition.sounds || []).reduce((sum, s) => sum + this.entryWeight(typeof s === "string" ? { name: s } : s, depth), 0);
  }
  entryWeight(s, depth) {
    return s.type === "event" ? this.weight(s.name, depth + 1) : (s.weight ?? 1);
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
      const { attenuation, pan } = this.spatial(position, volume);
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
  // LINEAR attenuation at a position: SoundManager.playSound passes 16 blocks, or 16 * volume above volume 1, as the
  // attenuation distance; the linear falloff over it is assumed (paulscode, not in the JAR). No position: NONE.
  spatial(position, volume) {
    if (!position) return { attenuation: 1, pan: 0 };
    const listener = this.listener(),
      dx = position.x - listener.x,
      dz = position.z - listener.z,
      dy = (position.y || 0) - listener.y,
      distance = Math.hypot(dx, dy, dz);
    return {
      attenuation: Math.max(0, 1 - distance / attenuationDistance(volume)),
      pan: Math.max(-1, Math.min(1, (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / 12)),
    };
  }
  // A streamed sound (sounds.json "stream": music and records). The handle comes back at once, as SoundHandler.playSound
  // registers the ISound; isPlaying(handle) turns false when it ends, fails or is stopped, or when it was skipped (sound
  // off, master or category volume 0, streams not installed), so MusicTicker then rolls its next delay.
  playStream(event, { volume = 1, pitch = 1, position = null } = {}) {
    const handle = { event, volume, pitch, position, playing: false, paused: false, audio: null };
    if (!this.options().sound || this.master() <= 0) return handle;
    // Before the page's first gesture (which calls unlock) there is no running context and the browser refuses playback:
    // skipped, like a sound the sound system could not start (the menu music then retries after its next delay).
    if (!this.context || this.context.state !== "running") return handle;
    handle.playing = true;
    this.ready.then(() => this.startStream(handle)).catch(() => this.stop(handle));
    return handle;
  }
  startStream(handle) {
    if (!handle.playing) return;
    const clip = this.resolve(handle.event), file = clip && this.manifest?.files[clip.name];
    const entryVolume = clip?.volume ?? 1;
    if (!file || !(file.stream || clip.stream) || !this.options().sound || this.master() <= 0
      || normalizedVolume(handle.volume, entryVolume, this.options().soundLevels, clip.category) === 0) return this.stop(handle);
    const audio = new Audio(file.url);
    audio.preload = "auto";
    audio.preservesPitch = false;
    audio.playbackRate = normalizedPitch(handle.pitch, clip.pitch ?? 1);
    const source = this.context.createMediaElementSource(audio), gain = this.context.createGain();
    const { attenuation, pan } = this.spatial(handle.position, handle.volume);
    Object.assign(handle, { audio, source, gain, entryVolume, category: clip.category, attenuation });
    gain.gain.value = this.gainOf(handle);
    source.connect(gain);
    if (handle.position && this.context.createStereoPanner) {
      handle.panner = this.context.createStereoPanner();
      handle.panner.pan.value = pan;
      gain.connect(handle.panner).connect(this.context.destination);
    } else gain.connect(this.context.destination);
    this.streams.add(handle);
    const end = () => this.stop(handle);
    audio.onended = end;
    audio.onerror = end;
    if (!handle.paused) audio.play().catch(end);
  }
  isPlaying(handle) {
    return !!handle?.playing;
  }
  stop(handle) {
    if (!handle) return;
    handle.playing = false;
    this.streams.delete(handle);
    const audio = handle.audio;
    if (!audio) return;
    handle.audio = null;
    audio.onended = audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    try {
      handle.source.disconnect();
      handle.gain.disconnect();
      handle.panner?.disconnect();
    } catch {}
  }
  // SoundHandler.pauseSounds / resumeSounds (the game menu in single player) and stopSounds (Minecraft.loadWorld:
  // opening, leaving or changing the world), applied to the streams.
  pauseStreams() {
    for (const h of this.streams) {
      h.paused = true;
      h.audio?.pause();
    }
  }
  resumeStreams() {
    for (const h of this.streams)
      if (h.paused) {
        h.paused = false;
        h.audio?.play().catch(() => this.stop(h));
      }
  }
  stopStreams() {
    for (const h of [...this.streams]) this.stop(h);
    this.records.clear();
  }
  // RenderGlobal.playRecord: stop the record at that jukebox, then (given a record sound from music.js recordSound)
  // play it there.
  playRecord(sound, x, y, z) {
    const key = `${x},${y},${z}`;
    this.stop(this.records.get(key));
    this.records.delete(key);
    if (sound) this.records.set(key, this.playStream(sound.event, sound));
  }
  // Once per tick: the listener has moved, so positioned streams (records) take their new falloff and pan.
  updateStreams() {
    for (const h of this.streams) {
      if (!h.position) continue;
      const { attenuation, pan } = this.spatial(h.position, h.volume);
      h.attenuation = attenuation;
      h.gain.gain.value = this.gainOf(h);
      if (h.panner) h.panner.pan.value = pan;
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
    for (const h of [...this.streams]) {
      if (!this.options().sound
        || (h.category && h.category !== "master" && normalizedVolume(h.volume, h.entryVolume, this.options().soundLevels, h.category) <= 0)) this.stop(h);
      else h.gain.gain.value = this.gainOf(h);
    }
  }
}
