// Frame counts of the two dynamic sprites, TextureCompass (bqm) and TextureClock (bql) of Minecraft 1.7.10. Both index their frame
// list by `framesTextureData.size()`, not by a hard-coded 32 / 64: the list is what TextureAtlasSprite.loadSprite (bqd.a) builds from
// the strip, so a resource pack's compass.png / clock.png supplies the count.
//   - no animation section: the image must be square (one frame) or loadSprite throws "broken aspect ratio and not an animation"
//     (native shows the missing texture; here the strip is still cut into floor(h / w) frames so a pack made without an mcmeta works);
//   - an animation section without `frames`: floor(h / w) frames;
//   - with a `frames` list: only the listed indices are loaded and the list is padded with null up to the largest index (`bqd.e`), so
//     the size is max(index) + 1 (an index >= floor(h / w) throws "invalid frameindex"; a skipped index stays null, which crashes
//     native updateAnimation: here that frame is still drawn from the strip).
// Frame timing (`frametime`, per-frame `time`) is ignored by both sprites: they pick the frame from the angle every tick.
// Bytecode-read (javap bqd.a, bqd.e, bqm.a, bql.j) and replayed against the unchanged classes with lists of 1..128 entries
// (maps-clock-reference.json, clockFrames / compassFrames records).
import { parseAnimationMcmeta, fetchMcmeta } from "./texture-animation.js";
import { versioned, mediaGeneration } from "./media-version.js";
import { onResourcesRefreshed } from "./resource-refresh.js";

export const VANILLA_FRAMES = Object.freeze({ compass: 32, clock: 64 });
const STRIPS = { compass: "/media/1.7.10/items/compass.png", clock: "/media/1.7.10/items/clock.png" };

// -> { count, rejected }. `rejected` is the reason native loading would reject the texture (it then draws the missing texture).
export function spriteFrameCount(mcmetaText, width, height) {
  let meta = null, rejected = null;
  if (mcmetaText != null) {
    try { meta = parseAnimationMcmeta(mcmetaText); } catch (e) { rejected = e.message; }
  }
  const strip = Math.max(1, Math.floor(height / Math.max(1, width)));
  if (!meta) {
    if (height !== width && !rejected) rejected = "broken aspect ratio and not an animation";
    return { count: height === width ? 1 : strip, rejected };
  }
  if (meta.frames.length > 0) {
    let max = -1;
    for (const f of meta.frames) {
      if (f.index >= Math.floor(height / width)) rejected = "invalid frameindex " + f.index;
      max = Math.max(max, f.index);
    }
    return { count: rejected ? strip : max + 1, rejected };
  }
  return { count: strip, rejected };
}

const counts = { compass: VANILLA_FRAMES.compass, clock: VANILLA_FRAMES.clock };
let epoch = 0;
export const compassFrameCount = () => counts.compass;
export const clockFrameCount = () => counts.clock;
// Bumps whenever a count changes (a pack with another strip was applied): the texture objects are new natively, so the angle and
// velocity restart from 0; callers compare this number with the one they last saw.
export const spriteEpoch = () => epoch;

function measure(name) {
  if (typeof Image === "undefined") return;
  const gen = mediaGeneration(), base = STRIPS[name], img = new Image();
  img.onload = async () => {
    const text = await fetchMcmeta(base);
    if (gen !== mediaGeneration()) return;
    const { count, rejected } = spriteFrameCount(text, img.naturalWidth, img.naturalHeight);
    if (rejected && typeof console !== "undefined") console.warn(`${name}.png: ${rejected} (native shows the missing texture)`);
    if (count !== counts[name]) { counts[name] = count; epoch++; }
  };
  img.src = versioned(base, gen);
}

// Pack change: both strips are re-measured; before the first measurement (or while it loads) the vanilla counts apply.
export function reloadSpriteFrames() { measure("compass"); measure("clock"); }
onResourcesRefreshed(() => reloadSpriteFrames());
if (typeof window !== "undefined") reloadSpriteFrames();
