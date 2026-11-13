// Batch 56 (b56dl): the lighting terms behind a display block, replayed against public/research/display-light-reference.json (tools/probes/DisplayLightProbe.java,
// the real Entity.getBrightness / getBrightnessForRender / isBurning in a chunk-backed World stand-in, and the real RenderBlocks.renderBlockAsItem on a recording GL11).
//
// RenderMinecart.func_147910_a (boi.a(xl, F, aji, I), bytecode-read) calls `renderBlockAsItem(block, meta, entity.getBrightness(partial))`; renderBlockAsItem multiplies its glColor
// by that brightness (executed: every sweep row's first glColor4f is tint * 0.37 at brightness 0.37). RenderManager.renderEntityStatic (bnn.a, bytecode-read) then sets the
// lightmap coordinates from Entity.getBrightnessForRender (15728880 while burning) and glColor4f(1, 1, 1, 1) before doRender. So a minecart's display block is darkened twice at night:
// by the lightmap texel at the packed light and by the float World.getLightBrightness of the cart's cell. The chest display (type 22) ignores the float (bls.a never reads it), and
// dropped items, item frames and held blocks pass 1.0 (bytecode-read in bly.a(sv, add, I) and RenderItem).

// RenderManager.renderEntityStatic: a burning entity is drawn at full block and sky light.
export const BURNING_PACKED = 15728880;
export const entityPacked = (packed, burning) => (burning ? BURNING_PACKED : packed);

// Entity.getBrightness / getBrightnessForRender sample the cell (floor posX, floor(posY - yOffset + (maxY - minY) * 0.66), floor posZ); `feetY` is posY - yOffset (the box bottom).
export const SAMPLE_HEIGHT = 0.66;
export const entityLightY = (feetY, height) => Math.floor(feetY + height * SAMPLE_HEIGHT);

// Entity.getBrightness: World.getLightBrightness = provider.lightBrightnessTable[World.getBlockLightValue(x, y, z)] (the larger of the sky light minus skylightSubtracted and the
// block light, with the use-neighbour-brightness rule), 0 in an unloaded column. `level(x, y, z)` is that light level.
export const entityBrightness = (level, table, x, feetY, z, height, loaded = true) => (loaded ? table[level(Math.floor(x), entityLightY(feetY, height), Math.floor(z))] : 0);

// The float is a colour multiplier on the display block's tint. Materials keep their native tint in userData so a frame's brightness never compounds.
export function shadeDisplay(material, brightness) {
  const tint = material.uniforms.tint.value, base = (material.userData.baseTint ??= [tint.x, tint.y, tint.z]);
  tint.set(base[0] * brightness, base[1] * brightness, base[2] * brightness);
}
