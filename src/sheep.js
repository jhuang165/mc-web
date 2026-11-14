// EntitySheep (wp) rules shared by the simulation and the renderer. Colours are
// BlockColored metadata: 0 white ... 15 black (WOOL_COLORS order). The saved
// fleece colour is the low four bits of datawatcher byte 16 and bit 16 is "sheared".
const f = Math.fround;
// EntitySheep.fleeceColorTable (wp.bp): rgb floats by colour, used to tint sheep_fur.png.
export const FLEECE_COLORS = [
  [1, 1, 1], [0.85, 0.5, 0.2], [0.7, 0.3, 0.85], [0.4, 0.6, 0.85], [0.9, 0.9, 0.2], [0.5, 0.8, 0.1],
  [0.95, 0.5, 0.65], [0.3, 0.3, 0.3], [0.6, 0.6, 0.6], [0.3, 0.5, 0.6], [0.5, 0.25, 0.7], [0.2, 0.3, 0.7],
  [0.4, 0.3, 0.2], [0.4, 0.5, 0.2], [0.6, 0.2, 0.2], [0.1, 0.1, 0.1],
].map((c) => c.map(f));
// Random.nextInt(n) from a [0, 1) function, or from an object that has its own nextInt.
const nextInt = (random, n) => (typeof random === "function" ? Math.floor(random() * n) : random.nextInt(n));
// EntitySheep.func_70895_a (wp.a(Random)): the colour of a naturally spawned sheep.
export function sheepColor(random = Math.random) {
  const i = nextInt(random, 100);
  if (i < 5) return 15;
  if (i < 10) return 7;
  if (i < 15) return 8;
  if (i < 18) return 12;
  return nextInt(random, 500) === 0 ? 6 : 0;
}
// The shapeless two-dye recipes in 1.7.10 as [colourA, colourB, child] (the fleece
// colour is 15 - the dye damage); verified for all 256 pairs by
// tools/verify-sheep.mjs against CraftingManager.findMatchingRecipe.
const MIXES = [[0, 7, 8], [0, 11, 3], [0, 13, 5], [0, 14, 6], [0, 15, 7], [4, 14, 1], [6, 10, 2], [11, 13, 9], [11, 14, 10]];
// EntitySheep.func_90014_a (wp.a(wf, wf)): the dyes (15 - colour) go through the
// crafting grid; a dye result sets the colour, otherwise the child takes either parent's.
export function childColor(a, b, random = Math.random) {
  for (const [x, y, c] of MIXES) if ((a === x && b === y) || (a === y && b === x)) return c;
  return random() < 0.5 ? a : b;
}

// RenderSheep.shouldRenderPass (boq.a(wp, int, float), bytecode-read): a sheep whose custom name is exactly "jeb_" blends two consecutive
// fleece colours instead of its own. i = ticksExisted / 25 + entityId (int); the colours are bp[i % 16] and bp[(i + 1) % 16]; the blend is
// ((ticksExisted % 25) + partial) / 25, each channel c1 * (1 - t) + c2 * t in float arithmetic. Java's % of a negative entity id is negative (an
// array index error natively); the port wraps it.
export const JEB_NAME = "jeb_";
export function jebFleece(ticksExisted, entityId, partial = 0) {
  const ticks = ticksExisted | 0, i = Math.floor(ticks / 25) + (entityId | 0), n = FLEECE_COLORS.length;
  const a = FLEECE_COLORS[((i % n) + n) % n], b = FLEECE_COLORS[(((i + 1) % n) + n) % n];
  const t = f(f((ticks % 25) + f(partial)) / 25);
  return [0, 1, 2].map((k) => f(f(a[k] * f(1 - t)) + f(b[k] * t)));
}
// A mob's numeric entity id: the digits of its "mob-N" id (the port's counter), or a number as given.
export const sheepEntityId = (id) => (typeof id === "number" ? id : Number(String(id).match(/(\d+)$/)?.[1] ?? 0));
// The tint of a sheep's fur pass: jeb_ rainbow (needs the custom name), else the fleece colour.
export const sheepFurTint = (e, partial = 0) => (e.customName === JEB_NAME ? jebFleece(e.age, sheepEntityId(e.id), partial) : FLEECE_COLORS[e.color ?? 0]);
