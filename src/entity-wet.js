// b83 rain83: Entity.isWet (sa.L, bytecode-read) for the entity systems that run moveEntity's fire tail or test isWet themselves.
//   isWet = inWater || world.canLightningStrikeAt(floor posX, floor posY, floor posZ) || world.canLightningStrikeAt(floor posX, floor(posY + height), floor posZ)
// posY is the native posY (the box bottom plus yOffset: half the height for items, orbs, primed TNT and minecarts; 0 for rockets, arrows and the
// player), `height` the entity's float height (sa.N). `strike(x, y, z)` is the world's canLightningStrikeAt (weather.js; raining, the cell at or
// above the precipitation height and seeing the sky, a biome that can be struck and is not snowy), or null where nothing rains (a test host,
// the Nether and the End). This module imports nothing, so the entity modules that weather.js cannot reach without a cycle can use it.
// Callers in jar 1.7.10: sa.d (moveEntity's fire tail), sv.C (a living entity's extinguish), wr.e (snow golem), wv.h (wolf), xx.e (blaze),
// ya.e (enderman) and zc.h (arrow). Thrown balls, eyes of ender and fireballs never call moveEntity, so rain does not reach them.
export const rainedOn = (strike, x, posY, z, height) => {
  if (!strike) return false;
  const bx = Math.floor(x), bz = Math.floor(z);
  return !!strike(bx, Math.floor(posY), bz) || !!strike(bx, Math.floor(posY + height), bz);
};
export const entityWet = (inWater, strike, x, posY, z, height) => !!inWater || rainedOn(strike, x, posY, z, height);
// moveEntity's fire tail [sa.d, offset 2026]: a wet entity whose counter is above 0 plays random.fizz 0.7 with pitch 1.6 + (r - r) * 0.4 on its own
// Random (two nextFloat draws), and its counter rests at -fireResistance (block-collisions.js does the counter). `next()` returns a float in [0, 1).
export function wetFizz(next) {
  const f = Math.fround, a = f(next()), b = f(next());
  return { name: "random.fizz", volume: f(0.7), pitch: f(f(1.6) + f(f(a - b) * f(0.4))) };
}
