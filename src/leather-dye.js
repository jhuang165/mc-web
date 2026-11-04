// ItemArmor leather dyeing (ItemArmor.getColor / RecipeArmorDyes).
// Dye damage follows ItemDye's item order (black, red, green, brown, blue, ... white).
import { DYE } from "./world.js";
import { copyStack } from "./inventory.js";

export const LEATHER_ARMOR = Object.freeze([400, 401, 402, 403]);
const DYE_RGB = Object.freeze([
  [25, 25, 25], [153, 51, 51], [102, 127, 51], [102, 76, 51],
  [51, 76, 178], [127, 63, 178], [76, 127, 153], [153, 153, 153],
  [76, 76, 76], [242, 127, 165], [127, 204, 25], [229, 229, 51],
  [102, 153, 216], [178, 76, 216], [216, 127, 51], [255, 255, 255],
]);

const colorChannels = (color) => [(color >> 16) & 255, (color >> 8) & 255, color & 255];
const pack = ([r, g, b]) => (r << 16) | (g << 8) | b;

// RecipeArmorDyes averages channels, then scales them by the average maximum-channel brightness.
export function mixLeatherColors(colors) {
  if (!colors.length) return null;
  const channels = [0, 0, 0];
  let maxChannelTotal = 0;
  for (const color of colors) {
    const rgb = colorChannels(color);
    maxChannelTotal += Math.max(...rgb);
    for (let i = 0; i < 3; i++) channels[i] += rgb[i];
  }
  const count = colors.length, averaged = channels.map((n) => Math.floor(n / count)),
    targetBrightness = Math.fround(maxChannelTotal / count), mixBrightness = Math.max(...averaged);
  return pack(averaged.map((v) => Math.max(0, Math.min(255, mixBrightness > 0 ? Math.trunc(Math.fround(Math.fround(v * targetBrightness) / mixBrightness)) : v))));
}

export function leatherDyeResult(cells) {
  let armor = null;
  const colors = [];
  for (const stack of cells) {
    if (!stack) continue;
    if (LEATHER_ARMOR.includes(stack.id) && stack.count > 0) {
      if (armor) return null;
      armor = stack;
    } else if (stack.id === DYE && Number.isInteger(stack.damage) && stack.damage >= 0 && stack.damage < 16) {
      colors.push(DYE_RGB[stack.damage]);
    } else return null;
  }
  if (!armor || colors.length === 0) return null;
  const prior = Number.isInteger(armor.color) && armor.color >= 0 && armor.color <= 0xFFFFFF ? [armor.color] : [];
  const mixed = mixLeatherColors([...prior, ...colors.map(pack)]);
  const result = copyStack(armor);
  result.count = 1;
  result.color = mixed;
  return result;
}
