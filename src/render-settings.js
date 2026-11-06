// Video settings that change what the renderer draws (public/research/render-settings.md).
// GameSettings fields in the 1.7.10 JAR: fancyGraphics (bbj.i), ambientOcclusion (bbj.j, 0..2),
// clouds (bbj.k), mipmapLevels (bbj.H) and anisotropicFiltering (bbj.I). The fields are kept in
// the saved device settings as `graphics`, `ao`, `clouds`, `mipmapLevels` and `anisotropic`.
const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.trunc(v)));
const num = (v) => typeof v === "number" && Number.isFinite(v);

export const RENDER_DEFAULTS = { graphics: true, ao: 2, clouds: true, mipmapLevels: 4, anisotropic: 1 };
export const MIPMAP_RANGE = [0, 4];
export const ANISOTROPIC_RANGE = [1, 16];

// GameSettings.Options.ANISOTROPIC_FILTERING.snapToStep: MathHelper.roundUpToPowerOfTwo((int) value).
export function roundUpToPowerOfTwo(n) {
  let j = n - 1;
  j |= j >> 1; j |= j >> 2; j |= j >> 4; j |= j >> 8; j |= j >> 16;
  return j + 1;
}

// A saved or partial options object reduced to valid render settings (missing values take the
// GameSettings defaults).
export function normalizeRender(o = {}) {
  return {
    graphics: typeof o.graphics === "boolean" ? o.graphics : RENDER_DEFAULTS.graphics,
    ao: num(o.ao) ? clampInt(o.ao, 0, 2) : RENDER_DEFAULTS.ao,
    clouds: typeof o.clouds === "boolean" ? o.clouds : RENDER_DEFAULTS.clouds,
    mipmapLevels: num(o.mipmapLevels) ? clampInt(o.mipmapLevels, ...MIPMAP_RANGE) : RENDER_DEFAULTS.mipmapLevels,
    anisotropic: num(o.anisotropic) ? clampInt(roundUpToPowerOfTwo(Math.max(1, Math.trunc(o.anisotropic))), ...ANISOTROPIC_RANGE) : RENDER_DEFAULTS.anisotropic,
  };
}

// The values the mesher and the per-frame code read. `fancy` is GameSettings.fancyGraphics.
export const render = { fancy: true, ao: 2, clouds: true, mipmapLevels: 4, anisotropic: 1 };
export function setRender(o) {
  const n = normalizeRender(o);
  Object.assign(render, { fancy: n.graphics, ao: n.ao, clouds: n.clouds, mipmapLevels: n.mipmapLevels, anisotropic: n.anisotropic });
  return render;
}

// BlockLeaves.isOpaqueCube is !fancyGraphics (setGraphicsLevel), and BlockLeaves.shouldSideBeRendered
// hides a face against another leaf block in Fast.
export const leavesOpaque = (fancy = render.fancy) => !fancy;
// EntityRenderer.renderRainSnow: radius 5 blocks, 10 with fancy graphics.
export const rainRadius = (fancy = render.fancy) => (fancy ? 10 : 5);
// EntityRenderer.addRainParticles: the rain strength is halved without fancy graphics.
export const rainParticleStrength = (strength, fancy = render.fancy) => (fancy ? strength : Math.fround(strength / 2));
// GameSettings.shouldRenderClouds: renderDistanceChunks >= 4 and the clouds option.
export const shouldRenderClouds = (chunks, clouds = render.clouds) => chunks >= 4 && !!clouds;
// Render.doRenderShadowAndFire draws the entity shadow only with fancy graphics.
export const shadowsEnabled = (fancy = render.fancy) => !!fancy;
// RenderItem draws a sprite item as an extruded 3D slab with fancy graphics and as flat quads facing the
// player's yaw without; block items stay 3D either way.
export const flatItemSprites = (fancy = render.fancy) => !fancy;
// BlockLeaves textures: the *_opaque icons are used when leaves are opaque.
export const leafTextureName = (name, fancy = render.fancy) => (name.startsWith("leaves_") && !fancy ? name + "_opaque" : name);
// A translucent chunk layer (water, ice, portal) is drawn as a depth-only pass and then a colour pass
// with fancy graphics (EntityRenderer.renderWorld), a single blended pass otherwise.
export const translucentPasses = (fancy = render.fancy) => (fancy ? 2 : 1);
// RenderBlocks.setRenderBounds: the partial-bounds path needs ambientOcclusion >= 2 and bounds that
// are not the whole cell; RenderBlocks.renderStandardBlock picks flat lighting when ambientOcclusion is 0.
export const usePartialAo = (ao, fullCube) => ao >= 2 && !fullCube;

// TextureUtil.generateMipmapData for one level from `src` (ARGB-less RGBA bytes, width w): every texel of the
// next level averages a 2x2 block. Without a fully transparent texel in level 0 every channel is averaged
// in gamma 2.2 (pow 2.2, mean, pow 1/2.2, truncated); otherwise the colour of a transparent texel counts as 0,
// and an alpha below 96 becomes 0.
export function mipLevel(src, w, h, hasTransparent) {
  const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), out = new Uint8ClampedArray(nw * nh * 4);
  const lin = (v) => Math.pow(v / 255, 2.2), enc = (v) => Math.trunc(Math.pow(v, 1 / 2.2) * 255);
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++) {
      const t = [(2 * y) * w + 2 * x, (2 * y) * w + 2 * x + 1, (2 * y + 1) * w + 2 * x, (2 * y + 1) * w + 2 * x + 1].map((p) => Math.min(p, w * h - 1) * 4);
      const o = (y * nw + x) * 4;
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (const p of t) {
          if (hasTransparent && src[p + 3] === 0) continue;
          sum += lin(Math.fround(src[p + c]));
        }
        out[o + c] = enc(Math.fround(sum / 4));
      }
      if (hasTransparent && out[o + 3] < 96) out[o + 3] = 0;
    }
  return { data: out, width: nw, height: nh };
}
// TextureUtil.generateMipmapData (bqi.a(II[[I)) sets its transparency flag from `data[0][k] >> 24 == 0` for
// k < data.length, and data is the sprite's per-level array of 1 + mipmapLevels entries: only the first
// levels + 1 texels of the top row are looked at. leaves_jungle and grass_side_overlay start with opaque
// texels, so natively they take the plain gamma average (alpha included, no 96 cutoff) despite their holes.
export const hasTransparentTexel = (data, levels = Infinity) => {
  const n = Math.min(data.length >> 2, levels + 1);
  for (let i = 0; i < n; i++) if (data[i * 4 + 3] === 0) return true;
  return false;
};
// The mip chain 0..levels of an RGBA image, levels clamped to what the size allows.
export function mipChain(data, w, h, levels) {
  const out = [{ data, width: w, height: h }], flag = hasTransparentTexel(data, levels);
  for (let i = 1; i <= levels; i++) {
    const prev = out[i - 1];
    if (prev.width < 2 && prev.height < 2) break;
    out.push(mipLevel(prev.data, prev.width, prev.height, flag));
  }
  return out;
}

// TextureMap.loadTextureAtlas mipmaps every sprite on its own and stores level n at (origin >> n); with
// 16-pixel tiles on 16-pixel offsets that equals a per-tile chain written into a grid of halved size, so
// nothing bleeds between neighbours at any level up to 4. `data` is the atlas RGBA, `tile` its tile size.
export function atlasMips(data, w, h, tile, levels) {
  const out = [{ data, width: w, height: h }];
  const max = Math.min(levels, Math.log2(tile));
  for (let l = 1; l <= max; l++) out.push({ data: new Uint8ClampedArray((w >> l) * (h >> l) * 4), width: w >> l, height: h >> l });
  for (let ty = 0; ty < h; ty += tile)
    for (let tx = 0; tx < w; tx += tile) {
      const t = new Uint8ClampedArray(tile * tile * 4);
      for (let y = 0; y < tile; y++) t.set(data.subarray(((ty + y) * w + tx) * 4, ((ty + y) * w + tx + tile) * 4), y * tile * 4);
      const chain = mipChain(t, tile, tile, max);
      for (let l = 1; l < chain.length; l++) {
        const c = chain[l], lv = out[l];
        for (let y = 0; y < c.height; y++) lv.data.set(c.data.subarray(y * c.width * 4, (y + 1) * c.width * 4), (((ty >> l) + y) * lv.width + (tx >> l)) * 4);
      }
    }
  return out;
}
