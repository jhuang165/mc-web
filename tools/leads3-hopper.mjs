// Batch 29 leads3: hoppers with negative and zero stacks for every facing, pushing into and pulling from single and double chests.
// Shared by tools/verify-leads3.mjs (native HopperProbe run) and src/leads3.test.js. Same format as tools/neg-stacks3-hopper.mjs:
// slot count 0 is an empty slot, -999 a size-0 stack, any other count the stack size.
const CHEST = 54, HOPPER = 154;
const IRON = 265, COAL = 263, STICK = 280, SWORD = 276;
const Z = -999;
const fill = (x, y, z, items) => items.map(([item, count, damage = 0], slot) => [x, y, z, slot, item, count, damage]);
// BlockHopper metadata: 0 down, 2 north (z - 1), 3 south (z + 1), 4 west (x - 1), 5 east (x + 1).
const FACINGS = [[0, "down", 0, -1, 0], [2, "north", 0, 0, -1], [3, "south", 0, 0, 1], [4, "west", -1, 0, 0], [5, "east", 1, 0, 0]];
const list = [];
const scenario = (name, ticks, set, slots) => list.push({ name, ticks, set, slots, entities: [], events: [], lines: [...set.map((v) => `set ${v.join(" ")}`), ...slots.map((v) => `slot ${v.join(" ")}`)] });
const [HX, HY, HZ] = [5, 3, 5];
for (const [meta, name, dx, dy, dz] of FACINGS) {
  const tx = HX + dx, ty = HY + dy, tz = HZ + dz, partner = dx < 0 ? tx - 1 : tx + 1;
  const own = fill(HX, HY, HZ, [[IRON, -3], [COAL, Z], [STICK, 2], [SWORD, -1], [IRON, 4]]);
  // push into a single chest holding a negative and a size-0 stack, then into a double chest whose second half holds a normal stack
  scenario(`push-single-${name}`, 80, [[HX, HY, HZ, HOPPER, meta], [tx, ty, tz, CHEST, 2]], [...own, ...fill(tx, ty, tz, [[IRON, -5], [IRON, Z], [COAL, 1]])]);
  scenario(`push-double-${name}`, 80, [[HX, HY, HZ, HOPPER, meta], [tx, ty, tz, CHEST, 2], [partner, ty, tz, CHEST, 2]],
    [...own, ...fill(tx, ty, tz, [[IRON, -5], [IRON, Z]]), ...fill(partner, ty, tz, [[IRON, 3], [COAL, -2]])]);
  // pull from the chest above the hopper (every facing pulls from above); the target is air for the sideways facings
  const up = [[HX, HY + 1, HZ, CHEST, 2]];
  scenario(`pull-single-${name}`, 80, [[HX, HY, HZ, HOPPER, meta], ...up], fill(HX, HY + 1, HZ, [[IRON, -4], [COAL, Z], [STICK, -64], [SWORD, 1], [IRON, 6]]));
  scenario(`pull-double-${name}`, 80, [[HX, HY, HZ, HOPPER, meta], ...up, [HX + 1, HY + 1, HZ, CHEST, 2]],
    [...fill(HX, HY + 1, HZ, [[IRON, Z], [COAL, -3]]), ...fill(HX + 1, HY + 1, HZ, [[IRON, -2], [STICK, 5], [IRON, 3]])]);
}
export const leads3HopperScenarios = list;
