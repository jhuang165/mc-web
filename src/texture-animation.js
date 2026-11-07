// Texture animation from ".png.mcmeta" (AnimationMetadataSectionSerializer, TextureAtlasSprite.loadSprite and
// TextureAtlasSprite.updateAnimation of Minecraft 1.7.10; public/research/texture-animation-reference.json holds the
// TextureAnimationProbe replay). 1.7.10 reads `frametime` (default 1), `frames` (ints or { index, time }), `width` and
// `height` (the last two are parsed and ignored by the sprite loader). There is NO `interpolate` key in this version.
// A strip is a column of square frames of the image width; the sprite ticks at 20 Hz (one client tick per update).

export const NO_TIME = -1;

const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
const int = (v) => Math.trunc(v);

// AnimationMetadataSectionSerializer.deserialize. `text` is the whole mcmeta file. Returns null when there is no "animation"
// section (the sprite is then a plain square texture); throws (JsonParseException / IllegalArgumentException analogues) on
// invalid data.
export function parseAnimationMcmeta(text) {
  const root = JSON.parse(String(text).replace(/^﻿/, ""));
  if (!root || typeof root !== "object" || Array.isArray(root) || !("animation" in root)) return null;
  const section = root.animation;
  if (!section || typeof section !== "object" || Array.isArray(section)) throw new Error("Expected metadata section to be a JsonObject");
  const optionalInt = (key, fallback) => {
    if (!(key in section)) return fallback;
    if (!isNumber(section[key])) throw new Error(`Expected ${key} to be a Int`);
    return int(section[key]);
  };
  const frametime = optionalInt("frametime", 1);
  if (frametime !== 1 && frametime < 1) throw new Error("Invalid default frame time");
  const frames = [];
  if ("frames" in section) {
    if (!Array.isArray(section.frames)) throw new Error("Invalid animation->frames: expected array");
    section.frames.forEach((entry, i) => {
      if (isNumber(entry)) frames.push({ index: int(entry), time: NO_TIME });
      else if (entry !== null && typeof entry === "object" && !Array.isArray(entry)) {
        let time = NO_TIME;
        if ("time" in entry) {
          if (!isNumber(entry.time)) throw new Error(`Expected frames[${i}].time to be a Int`);
          time = int(entry.time);
          if (time < 1) throw new Error("Invalid frame time");
        }
        if (!isNumber(entry.index)) throw new Error("Missing index, expected to find a Int");
        const index = int(entry.index);
        if (index < 0) throw new Error("Invalid frame index");
        frames.push({ index, time });
      } else if (entry !== null && !Array.isArray(entry)) throw new Error(`Expected frames[${i}] to be a Int`);
      // arrays and null are skipped (brz a(int, JsonElement) returns null)
    });
  }
  const width = optionalInt("width", -1), height = optionalInt("height", -1);
  if (width !== -1 && width < 1) throw new Error("Invalid width");
  if (height !== -1 && height < 1) throw new Error("Invalid height");
  return { frametime, frames, width, height };
}

// TextureAtlasSprite.loadSprite for the frame list: `meta` null means no animation section. The strip is `floor(h / w)` square
// frames of `w`; the list defaults to every frame once. Throws like the native loader (a missing texture there).
export function spriteFrames(meta, imageWidth, imageHeight) {
  if (!meta) {
    if (imageHeight !== imageWidth) throw new Error("broken aspect ratio and not an animation");
    return { frameSize: imageWidth, count: 1, defaultTime: 1, list: [{ index: 0, time: NO_TIME }] };
  }
  const count = Math.floor(imageHeight / imageWidth);
  let list;
  if (meta.frames.length > 0) {
    for (const f of meta.frames) if (f.index >= count || f.index < 0) throw new Error("invalid frameindex " + f.index);
    list = meta.frames;
  } else list = Array.from({ length: count }, (_, index) => ({ index, time: NO_TIME }));
  return { frameSize: imageWidth, count, defaultTime: meta.frametime, list };
}

// TextureAtlasSprite.updateAnimation state: tickCounter / frameCounter and the shown frame index. `step()` is one client tick.
export class SpriteAnimation {
  constructor({ list, defaultTime = 1, count = list.length, frameSize = 16 }) {
    this.list = list;
    this.defaultTime = defaultTime;
    this.count = count;
    this.frameSize = frameSize;
    this.times = list.map((f) => (f.time === NO_TIME ? defaultTime : f.time));
    this.cycle = this.times.reduce((a, b) => a + b, 0);
    this.reset();
  }
  reset() { this.tickCounter = 0; this.frameCounter = 0; }
  get frame() { return this.list[this.frameCounter]?.index ?? 0; }
  // bqd.j(): ++tickCounter; at the frame's time the counter moves on (modulo the list) and the tick counter restarts.
  step() {
    this.tickCounter++;
    if (this.tickCounter >= this.times[this.frameCounter]) {
      const before = this.frame;
      this.frameCounter = (this.frameCounter + 1) % this.list.length;
      this.tickCounter = 0;
      return this.frame !== before;
    }
    return false;
  }
  // The frame index shown after `n` ticks without stepping (closed form of step()).
  frameAtTick(n) {
    if (!(this.cycle > 0)) return 0;
    let r = ((Math.floor(n) % this.cycle) + this.cycle) % this.cycle;
    for (let i = 0; i < this.times.length; i++) {
      if (r < this.times[i]) return this.list[i].index;
      r -= this.times[i];
    }
    return this.list[0].index;
  }
  get animated() { return this.list.length > 1 && new Set(this.list.map((f) => f.index)).size > 1; }
}

// mcmeta text (or null) plus the image size -> a SpriteAnimation. A texture the native loader would reject (bad json, an invalid
// frame index, a non-square image without an animation section) falls back to the whole strip at one tick per frame so a pack
// error never breaks the screen (native shows the missing texture there). `error` carries the reason.
export function resolveAnimation(mcmetaText, imageWidth, imageHeight) {
  let meta = null, error = null;
  if (mcmetaText != null) {
    try { meta = parseAnimationMcmeta(mcmetaText); } catch (e) { error = e.message; }
  }
  try {
    return Object.assign(new SpriteAnimation(spriteFrames(meta, imageWidth, imageHeight)), { error });
  } catch (e) {
    const count = Math.max(1, Math.floor(imageHeight / Math.max(1, imageWidth)));
    return Object.assign(new SpriteAnimation({ list: Array.from({ length: count }, (_, index) => ({ index, time: NO_TIME })), defaultTime: 1, count, frameSize: imageWidth }), { error: error ?? e.message });
  }
}

// The strips' ticks per second (Minecraft.runTick, TextureManager.tick) and the uv offset of frame `f` of `count` frames
// (a bottom-up v offset into a vertical strip, as the scene's uvTransform uses it).
export const TICKS_PER_SECOND = 20;
export const stripOffset = (frame, count) => 1 - (frame + 1) / count;

// mcmeta text of a texture url, or null (404, network error). `fetchImpl` is injectable for tests.
export async function fetchMcmeta(pngUrl, fetchImpl = globalThis.fetch) {
  try {
    const r = await fetchImpl(pngUrl + ".mcmeta", { cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}
