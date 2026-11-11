// RenderItem's sprite-item path for a dropped stack (bny private a(EntityItem, IIcon, int, ...), executed in public/research/item-sprite-reference.json): how many copies are drawn
// and where. doRender passes the block rule's count (1, 2 for more than 1, 3 above 5, 4 above 20, 5 above 40); with fancy graphics the sprite path recomputes its own
// (1, 2 below 16, 3 below 32, else 4) and stacks the copies along z; with fast graphics it keeps the passed count and scatters the copies by random translations.
const F = Math.fround;
export const blockCopyCount = (n) => (n > 40 ? 5 : n > 20 ? 4 : n > 5 ? 3 : n > 1 ? 2 : 1);
export const spriteCopyCount = (n) => (n < 2 ? 1 : n < 16 ? 2 : n < 32 ? 3 : 4);
export const SPRITE_STEP = F(F(0.0625) + F(0.021875)); // thickness + 0.021875
// Fancy graphics: the z translation (in the item's own half-scale space, before the 0.5 scale) at which copy k draws its front face; the first translate is -(step * n / 2)
// and every copy translates by one step more.
export const fancySpriteStart = (n) => F(-F(F(SPRITE_STEP * n) / 2));
export function fancySpriteZ(n) {
  const out = []; let z = fancySpriteStart(n);
  for (let k = 0; k < n; k++) { z = F(z + SPRITE_STEP); out.push(z); }
  return out;
}
// Fast graphics: copy 0 stays, every later copy translates by (nextFloat * 2 - 1) * 0.3 on x, y and z (in that order) from the java.util.Random seeded 187.
export function flatSpriteOffsets(n, random) {
  const out = [[0, 0, 0]];
  for (let k = 1; k < n; k++) { const v = []; for (let a = 0; a < 3; a++) v.push(F(F(F(random.nextFloat() * 2) - 1) * F(0.3))); out.push(v); }
  return out;
}
