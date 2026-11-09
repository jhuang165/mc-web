import { soundTypeOf } from "./block-sounds.js";
import { soundLevel, normalizedVolume, normalizedPitch } from "./settings.js";
import { applySoundLayers } from "./pack-sounds.js";
import { packStore } from "./resource-packs.js";
import { ATTENUATION, ChannelPool, NORMAL_CHANNELS, STREAMING_CHANNELS, UNPOSITIONED, alGain, attenuationDistance, distanceDelayTicks, sourceDistance, sourceGain, stereoPan } from "./sound-channels.js";
import { SoundBookkeeping } from "./sound-bookkeeping.js";
import { reachesPlayer } from "./sound-origin.js";
// The sound family of a block's Block.SoundType: its break event is "dig." + family and its step event "step." + stepSound.
// One native table (block-sounds.js, public/research/block-sounds.md) replaces the old per-block choices.
export const blockSound = (id) => soundTypeOf(id).break.slice(4);
export const stepSound = (id) => soundTypeOf(id).step.slice(5);
export { attenuationDistance };
// SoundBuffer loads each clip as 16-bit PCM, which caps every sample at full scale. decodeAudioData keeps float samples, and
// Web Audio has no output limiter, so a clip mastered above 0 dBFS (several TaCZ shots peak at +2 to +7 dB) would clip hard
// when sounds overlap. Clamp once at decode, only for a clip that goes over.
export function clampBuffer(buffer) {
  if (!buffer?.getChannelData) return buffer;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    let over = false;
    for (let i = 0; i < data.length; i++) if (data[i] > 1 || data[i] < -1) { over = true; break; }
    if (!over) continue;
    for (let i = 0; i < data.length; i++) data[i] = data[i] > 1 ? 1 : data[i] < -1 ? -1 : data[i];
  }
  return buffer;
}
export class SoundBank {
  constructor(options, listener) {
    this.options = options;
    // Local browser verification can silence this tab without touching saved options.
    this.tabSilent = !!import.meta.env?.DEV && new URLSearchParams(globalThis.location?.search ?? '').has('silent');
    this.listener = listener;
    this.cache = new Map();
    this.active = new Map();
    this.exclusive = new Map(); // play({ exclusive }) key -> its last source
    this.status = "Loading original effects…";
    // paulscode's channels: 28 normal (effects) and 4 streaming (music, records); a fifth source takes over the next in rotation.
    this.normal = new ChannelPool(NORMAL_CHANNELS);
    this.streamChannels = new ChannelPool(STREAMING_CHANNELS); // not `streaming`: that flag says whether the streams are installed
    this.delayed = []; // SoundManager.delayedSounds: { due, event, options }
    this.ticks = 0; // SoundManager.playTime
    this.moving = new Set(); // looping moving sounds' handles (playMoving)
    this.streams = new Set(); // playing stream handles: music and records (HTMLAudioElement through the graph)
    // SoundManager's playingSounds / playingSoundsStopTime for the streams (sound-bookkeeping.js, probe-replayed): isPlaying is
    // SoundManager.isSoundPlaying, including the 20-tick stop time. The source plays from the moment the stream is started,
    // as paulscode's command and stream threads begin a source within a tick (public/research/sound.md).
    this.byName = new Map();
    this.book = new SoundBookkeeping({
      playing: (name) => !!this.byName.get(name)?.playing,
      stop: (name) => this.stop(this.byName.get(name)),
      remove: (name) => this.byName.delete(name),
      start: (sound, name) => this.byName.set(name, sound.handle),
      apply: (name) => this.applyMoving(this.byName.get(name)),
    });
    this.epoch = 0; // bumped by stopAllSounds so the owners of moving sounds (cart-sounds.js) start theirs again
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
          .then(clampBuffer)
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
  // SoundManager.update (btj.d), once per client tick while the game runs: the tick counter and the sounds whose distance
  // delay (WorldClient.playSound with distanceDelay: fireworks) is due.
  tick() {
    this.ticks++;
    this.book.update();
    const due = this.delayed.filter((d) => this.ticks >= d.due);
    if (!due.length) return;
    this.delayed = this.delayed.filter((d) => this.ticks < d.due);
    for (const d of due) this.play(d.event, d.options);
  }
  // `delay`: seconds on the audio clock after this call to start (a gun shot timed inside its tick). `exclusive`: a key whose
  // previous sound this one stops (TaCZ's hit-sound concurrency limit of 1).
  async play(event, { volume = 1, pitch = 1, position = null, distanceDelay = false, local = false, delay = 0, exclusive = null } = {}) {
    // S29 range: the server sends a world sound only to players within 16 blocks (16 * volume above 1) of their feet.
    if (position && !reachesPlayer(event, position, volume, this.listener().feet, { local })) return;
    // The GUI button click is PositionedSoundRecord.func_147674_a: ATTENUATION_NONE at the world origin, which OpenAL still
    // places in the world while a world is open (sound-channels.js UNPOSITIONED).
    const ui = !position && event === "gui.button.press" && !!this.listener().inWorld;
    if (distanceDelay && position) {
      const l = this.listener(), delay = distanceDelayTicks((position.x - l.x) ** 2 + ((position.y || 0) - l.y) ** 2 + (position.z - l.z) ** 2);
      if (delay > 0) {
        this.delayed.push({ due: this.ticks + delay, event, options: { volume, pitch, position } });
        return;
      }
    }
    if (!this.options().sound || this.master() <= 0) return;
    this.unlock();
    if (!this.context) return;
    const startAt = this.context.currentTime + Math.max(0, +delay || 0);
    await this.ready;
    const clip = this.resolve(event);
    if (!clip) return;
    const entryVolume = clip.volume ?? 1;
    if (normalizedVolume(volume, entryVolume, this.options().soundLevels, clip.category) === 0) return;
    const buffer = await this.buffer(clip.name);
    if (!buffer || !this.options().sound || this.master() <= 0) return;
    try {
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = normalizedPitch(pitch, clip.pitch ?? 1);
      const { attenuation, pan } = this.spatial(position ?? (ui ? UNPOSITIONED : null), volume, ui);
      const playing = { gain, volume, entryVolume, category: clip.category, attenuation, position, ui, playing: true, source };
      const { prev, prevPlaying } = this.normal.acquire(playing);
      if (prev && prevPlaying) this.evict(prev);
      gain.gain.value = this.gainOf(playing);
      source.connect(gain);
      // OpenAL places only mono buffers; a stereo clip keeps its own image (only its gain follows the distance).
      if ((position || ui) && buffer.numberOfChannels === 1 && this.context.createStereoPanner) {
        const p = (playing.panner = this.context.createStereoPanner());
        p.pan.value = pan;
        gain.connect(p).connect(this.context.destination);
      } else gain.connect(this.context.destination);
      this.active.set(source, playing);
      source.onended = () => { playing.playing = false; this.active.delete(source); };
      if (exclusive) {
        const previous = this.exclusive.get(exclusive);
        if (previous) try { previous.stop(); } catch {}
        this.exclusive.set(exclusive, source);
      }
      source.start(Math.max(this.context.currentTime, startAt));
      return true;
    } catch (e) {
      this.status = e.message;
    }
  }
  // LINEAR attenuation at a position, as paulscode computes it (sound-channels.js, probed): SoundManager.playSound passes 16
  // blocks, or 16 * volume above volume 1, as the distance; the gain is 1 - distance / distance in floats, with the listener at
  // the player's interpolated eye position. No position: ATTENUATION NONE, gain 1.
  spatial(position, volume, ui = false) {
    if (!position) return { attenuation: 1, pan: 0 };
    if (ui) return { attenuation: 1, pan: stereoPan(position, this.listener()) }; // ATTENUATION_NONE: gain 1
    const listener = this.listener();
    return {
      attenuation: sourceGain(ATTENUATION.LINEAR, sourceDistance(position, listener), attenuationDistance(volume)),
      pan: stereoPan(position, listener),
    };
  }
  // A looping ITickableSound (moving-sounds.js MovingSoundMinecart / ...Riding): SoundManager.playSound starts it at its initial
  // volume 1, then each SoundManager.update tick (sound-bookkeeping.js) refreshes volume and position until it is done, so the
  // source loops (paulscode toLoop) until stopped. Position-less (the riding sound) is ATTENUATION_NONE.
  async playMoving(ms) {
    const handle = { event: ms.event, volume: ms.volume, pitch: 1, position: null, playing: true, moving: ms, sound: ms };
    ms.handle = handle;
    if (!this.options().sound || this.master() <= 0) { handle.playing = false; return handle; }
    this.unlock();
    if (!this.context) { handle.playing = false; return handle; }
    this.book.play(ms);
    await this.ready;
    const clip = this.resolve(ms.event), buffer = clip && handle.playing ? await this.buffer(clip.name) : null;
    if (!buffer || !handle.playing || !this.options().sound || this.master() <= 0) { if (!buffer) handle.playing = false; return handle; }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = normalizedPitch(1, clip.pitch ?? 1);
    Object.assign(handle, { source, gain, entryVolume: clip.volume ?? 1, category: clip.category, attenuation: 1, looping: true });
    this.applyMoving(handle);
    source.connect(gain);
    if (ms.event === "minecart.base" && buffer.numberOfChannels === 1 && this.context.createStereoPanner) {
      const p = (handle.panner = this.context.createStereoPanner());
      gain.connect(p).connect(this.context.destination);
    } else gain.connect(this.context.destination);
    this.moving.add(handle);
    source.start();
    return handle;
  }
  // SoundManager.update's per-sound pass: setVolume / setPosition of a tickable sound (normalized volume, distance 16 as started).
  applyMoving(handle) {
    const ms = handle?.moving;
    if (!ms || !handle.gain) return;
    handle.volume = ms.volume;
    handle.position = ms.event === "minecart.base" ? { x: ms.x, y: ms.y, z: ms.z } : null;
    const { attenuation, pan } = this.spatial(handle.position, 1);
    handle.attenuation = attenuation;
    handle.gain.gain.value = this.gainOf(handle);
    if (handle.panner) handle.panner.pan.value = pan;
  }
  // A sound taken over by the channel rotation (Library.getNextChannel) stops at once.
  evict(h) {
    if (h.source && !h.audio) {
      h.playing = false;
      try { h.source.stop(); } catch {}
      this.active.delete(h.source);
    } else this.stop(h);
  }
  // A streamed sound (sounds.json "stream": music and records). The handle comes back at once, as SoundHandler.playSound
  // registers the ISound; isPlaying(handle) turns false when it ends, fails or is stopped, or when it was skipped (sound
  // off, master or category volume 0, streams not installed), so MusicTicker then rolls its next delay.
  playStream(event, { volume = 1, pitch = 1, position = null } = {}) {
    const handle = { event, volume, pitch, position, playing: false, paused: false, audio: null, sound: null };
    if (!this.options().sound || this.master() <= 0) return handle;
    // Before the page's first gesture (which calls unlock) there is no running context and the browser refuses playback:
    // skipped, like a sound the sound system could not start (the menu music then retries after its next delay).
    if (!this.context || this.context.state !== "running") return handle;
    handle.playing = true;
    handle.sound = { handle, canRepeat: false, repeatDelay: 0 };
    this.book.play(handle.sound);
    this.ready.then(() => this.startStream(handle)).catch(() => this.stop(handle));
    return handle;
  }
  startStream(handle) {
    if (!handle.playing) return;
    const clip = this.resolve(handle.event), file = clip && this.manifest?.files[clip.name];
    const entryVolume = clip?.volume ?? 1;
    if (!file || !(file.stream || clip.stream) || !this.options().sound || this.master() <= 0
      || normalizedVolume(handle.volume, entryVolume, this.options().soundLevels, clip.category) === 0) return this.stop(handle);
    const { prev, prevPlaying } = this.streamChannels.acquire(handle);
    if (prev && prevPlaying) this.evict(prev);
    const audio = new Audio(file.url);
    audio.preload = "auto";
    audio.preservesPitch = false;
    audio.playbackRate = normalizedPitch(handle.pitch, clip.pitch ?? 1);
    const source = this.context.createMediaElementSource(audio), gain = this.context.createGain();
    const { attenuation } = this.spatial(handle.position, handle.volume);
    Object.assign(handle, { audio, source, gain, entryVolume, category: clip.category, attenuation });
    gain.gain.value = this.gainOf(handle);
    // Music and the record discs are stereo ogg files: OpenAL does not place stereo buffers, so only the distance gain applies.
    source.connect(gain);
    gain.connect(this.context.destination);
    this.streams.add(handle);
    const end = () => this.stop(handle);
    audio.onended = end;
    audio.onerror = end;
    if (!handle.paused) audio.play().catch(end);
  }
  // SoundManager.isSoundPlaying (sound-bookkeeping.js): true while the source plays, and for a stopped or ended one until the
  // update pass of the tick drops it once its 20-tick stop time is past; a sound that never started is not playing.
  isPlaying(handle) {
    return !!handle?.sound && this.book.isSoundPlaying(handle.sound);
  }
  stop(handle) {
    if (!handle) return;
    handle.playing = false;
    this.streams.delete(handle);
    if (handle.looping) {
      this.moving.delete(handle);
      try { handle.source.stop(); } catch {}
      try { handle.source.disconnect(); handle.gain.disconnect(); handle.panner?.disconnect(); } catch {}
      return;
    }
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
  // SoundManager.stopAllSounds: every playing sound stops and the delayed ones are dropped.
  stopStreams() {
    for (const h of [...this.streams]) this.stop(h);
    for (const [source, p] of [...this.active]) {
      p.playing = false;
      try { source.stop(); } catch {}
      this.active.delete(source);
    }
    this.delayed.length = 0;
    this.book.stopAll();
    this.epoch++;
    this.moving.clear();
    this.byName.clear();
    this.normal.clear();
    this.streamChannels.clear();
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
  // Once per tick: the listener has moved, so every positioned sound (Source.listenerMoved) takes its new falloff and pan.
  updateStreams() {
    for (const h of [...this.streams, ...this.active.values()]) {
      if (!h.position && !h.ui) continue;
      const { attenuation, pan } = this.spatial(h.position ?? UNPOSITIONED, h.volume, !h.position);
      h.attenuation = attenuation;
      h.gain.gain.value = this.gainOf(h);
      if (h.panner) h.panner.pan.value = pan;
    }
  }
  gainOf(p) {
    // AL_GAIN = paulscode gain * normalized volume (floats); the master level is the listener gain.
    return alGain(p.attenuation, normalizedVolume(p.volume, p.entryVolume, this.options().soundLevels, p.category)) * this.master();
  }
  // SoundManager.setSoundCategoryVolume (btj.a(w, float), bytecode-read): called for the one slider that moved. MASTER only sets
  // the master gain (the port's gainOf multiplies it, so every playing sound is regained). Any other category visits only the
  // sounds registered under that category: getNormalizedVolume(sound, entry, category) <= 0 stops the sound, else its volume is
  // set; sounds of other categories are untouched (a still minecart at volume 0 survives a Music slider change). The port is
  // told levels, not the slider, so the moved categories are found by comparing with the levels seen at the last call.
  updateVolumes() {
    const levels = this.options().soundLevels, before = this.levelsSeen ?? {};
    const moved = new Set();
    for (const k of new Set([...Object.keys(levels ?? {}), ...Object.keys(before)])) {
      if (k !== "master" && soundLevel(levels, k) !== soundLevel(before, k)) moved.add(k);
    }
    this.levelsSeen = { ...(levels ?? {}) };
    const dies = (p) => !this.options().sound
      || (!!p.category && p.category !== "master" && moved.has(p.category)
        && normalizedVolume(p.volume, p.entryVolume, levels, p.category) <= 0);
    for (const [source, p] of [...this.active]) {
      if (dies(p)) {
        p.playing = false;
        try { source.stop(); } catch {}
        this.active.delete(source);
      } else p.gain.gain.value = this.gainOf(p);
    }
    for (const h of [...this.moving]) {
      if (dies(h)) this.stop(h);
      else this.applyMoving(h);
    }
    for (const h of [...this.streams]) {
      if (dies(h)) this.stop(h);
      else h.gain.gain.value = this.gainOf(h);
    }
  }
}
