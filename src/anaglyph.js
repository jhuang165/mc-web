// 3D Anaglyph at the native conversion points (TextureUtil.anaglyphColor, bqi.a(int[]), applied to every texture upload;
// RenderGlobal/EntityRenderer sky, cloud and fog colours). The eye merge is then a pure channel mask (eye 0 -> G,B; eye 1 -> R).
// RenderBlocks vertex colours (the 13 blt.a sites) convert the block colour multiplier while the chunk mesher runs (meshAnaglyph);
// the sunrise fan centre converts in sky.js. Not ported: the FontRenderer colour table (bbu constructor) and the DOM GUI.
import { anaglyphColor, anaglyphFog } from "./post-shaders.js";
import { getExactPixels } from "./png-codec.js";

// bqi.a(int[]) on RGBA bytes in place: R' = (30r+59g+11b)/100, G' = (30r+70g)/100, B' = (30r+70b)/100, integer division, alpha kept.
export function anaglyphRgba(d) {
  for (let i = 0; i + 3 < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    d[i] = (r * 30 + g * 59 + b * 11) / 100 | 0; d[i + 1] = (r * 30 + g * 70) / 100 | 0; d[i + 2] = (r * 30 + b * 70) / 100 | 0;
  }
  return d;
}
export { anaglyphColor };

// blt.a (EntityRenderer.anaglyphEnable) is set to GameSettings.anaglyph at the top of each render pass; RenderBlocks reads it at 13 sites to
// convert the colour multiplier before the face shade is applied. The mesher consults this flag, and scene.js remeshes every chunk when
// it changes. Paths that never read it (renderBlockLiquid water tint, vines, lily pads, redstone wire) keep their raw tint.
export const meshAnaglyph = { on: false };
// RenderBlocks conversion of a 0xRRGGBB colour multiplier, as the float triple it feeds the tessellator.
export function anaglyphMultiplier(color, on = meshAnaglyph.on) {
  const f = Math.fround, rgb = [f((color >> 16 & 255) / 255), f((color >> 8 & 255) / 255), f((color & 255) / 255)];
  return on ? anaglyphFog(rgb) : rgb;
}

// Wraps texImage2D / texSubImage2D on a WebGL context so uploads are converted while `state.on` is true. Render-target
// allocations (null data) pass through. Sources that cannot be read (cross-origin, video) pass through unconverted.
export function installAnaglyphUpload(gl, state = { on: false }) {
  if (gl.__anaglyphHooked) return gl.__anaglyphHooked;
  const texImage2D = gl.texImage2D.bind(gl), texSubImage2D = gl.texSubImage2D.bind(gl);
  let scratch = null;
  const stats = { converted: 0, exact: 0, passed: 0 };
  // Sources are converted at upload (TextureUtil.anaglyphColor) unless they are already converted: a canvas flagged `__agDone` holds
  // converted pixels (the item atlas), and an Image whose /media url has exact converted pixels (png-codec.js, straight alpha, no
  // premultiplied rounding) uploads those. Anything else is read through a 2D canvas, which rounds translucent pixels.
  const read = (src) => {
    const w = src.width ?? src.videoWidth, h = src.height ?? src.videoHeight;
    if (!w || !h) return null;
    if (src.__agDone) { stats.passed++; return null; }
    const url = src.currentSrc || src.src, known = typeof url === "string" ? getExactPixels(url) : null;
    if (known && known.width === w && known.height === h) { stats.exact++; return { w, h, px: known.data, done: true }; }
    if (src.data && src.data.length === w * h * 4) return { w, h, px: new Uint8Array(src.data.buffer.slice(src.data.byteOffset, src.data.byteOffset + src.data.byteLength)) };
    if (!scratch) scratch = document.createElement("canvas");
    scratch.width = w; scratch.height = h;
    const c = scratch.getContext("2d", { willReadFrequently: true });
    c.clearRect(0, 0, w, h); c.drawImage(src, 0, 0);
    try { return { w, h, px: new Uint8Array(c.getImageData(0, 0, w, h).data.buffer) }; } catch { return null; }
  };
  const convertedBytes = (px) => { stats.converted++; return anaglyphRgba(px); };
  gl.texImage2D = (...a) => {
    if (!state.on) return texImage2D(...a);
    if (a.length === 6 && a[2] === gl.RGBA && a[3] === gl.RGBA && a[4] === gl.UNSIGNED_BYTE && a[5]) {
      const r = read(a[5]);
      if (r) return texImage2D(a[0], a[1], a[2], r.w, r.h, 0, a[3], a[4], (r.done ? r.px : convertedBytes(r.px)));
    } else if (a.length >= 9 && a[6] === gl.RGBA && a[7] === gl.UNSIGNED_BYTE && a[8] instanceof Uint8Array) {
      return texImage2D(...a.slice(0, 8), convertedBytes(new Uint8Array(a[8])));
    }
    return texImage2D(...a);
  };
  gl.texSubImage2D = (...a) => {
    if (!state.on) return texSubImage2D(...a);
    if (a.length === 7 && a[4] === gl.RGBA && a[5] === gl.UNSIGNED_BYTE && a[6]) {
      const r = read(a[6]);
      if (r) return texSubImage2D(a[0], a[1], a[2], a[3], r.w, r.h, a[4], a[5], (r.done ? r.px : convertedBytes(r.px)));
    } else if (a.length >= 9 && a[6] === gl.RGBA && a[7] === gl.UNSIGNED_BYTE && a[8] instanceof Uint8Array) {
      return texSubImage2D(...a.slice(0, 8), convertedBytes(new Uint8Array(a[8])));
    }
    return texSubImage2D(...a);
  };
  gl.__anaglyphHooked = { state, stats };
  return gl.__anaglyphHooked;
}
