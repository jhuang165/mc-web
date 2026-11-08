// Hopper scenarios with negative and zero stacks, shared by tools/verify-neg-stacks3.mjs (native HopperProbe run) and src/neg-stacks3.test.js.
// Slot count convention: 0 is an empty slot, -999 is a size-0 stack, any other count is the stack size (may be negative).
const CHEST = 54, FURNACE = 61, DISPENSER = 23, DROPPER = 158, HOPPER = 154;
const IRON = 265, COAL = 263, STICK = 280, SWORD = 276;
const fill = (x, y, z, items) => items.map(([item, count, damage = 0], slot) => [x, y, z, slot, item, count, damage]);
const list = [];
function scenario(name, { ticks = 40, set = [], slots = [], entities = [], events = [] }) {
  const lines = [...set.map((v) => `set ${v.join(" ")}`), ...slots.map((v) => `slot ${v.join(" ")}`), ...entities.map((v) => `entity ${v.join(" ")}`), ...events.map((v) => `event ${v.join(" ")}`)];
  list.push({ name, ticks, set, slots, entities, events, lines });
}
const Z = -999;
scenario("push-neg-chest", { ticks: 60, set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: fill(1, 3, 1, [[IRON, -3], [COAL, Z], [STICK, 2], [SWORD, -1]]) });
scenario("push-neg-into-neg-stack", { ticks: 60, set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: [...fill(1, 3, 1, [[IRON, 3], [IRON, -2]]), ...fill(1, 2, 1, [[IRON, -5], [IRON, Z], [COAL, 1]])] });
scenario("push-onto-zero-stack", { ticks: 40, set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, CHEST, 2]], slots: [...fill(1, 3, 1, [[IRON, 4]]), ...fill(1, 2, 1, [[IRON, Z]])] });
scenario("pull-neg-chest", { ticks: 60, set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, CHEST, 2]], slots: fill(1, 3, 1, [[IRON, -4], [COAL, Z], [STICK, -64], [SWORD, 1]]) });
scenario("pull-into-neg-hopper", { ticks: 50, set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, CHEST, 2]], slots: [...fill(1, 3, 1, [[IRON, 6], [IRON, 3]]), ...fill(1, 2, 1, [[IRON, -7], [IRON, Z]])] });
scenario("horizontal-neg-chest", { ticks: 40, set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, CHEST, 2]], slots: [...fill(1, 1, 1, [[IRON, -2], [COAL, Z]]), ...fill(2, 1, 1, [[IRON, -1]])] });
scenario("neg-into-dropper", { ticks: 40, set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, DROPPER, 3]], slots: fill(1, 1, 1, [[IRON, -2], [COAL, Z], [STICK, 2]]) });
scenario("neg-into-dispenser", { ticks: 40, set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, DISPENSER, 3]], slots: [...fill(1, 1, 1, [[IRON, -2], [STICK, 2]]), ...fill(2, 1, 1, [[IRON, 1]])] });
scenario("neg-furnace-input", { ticks: 40, set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, FURNACE, 2]], slots: [...fill(1, 3, 1, [[IRON, -3], [COAL, 3]]), ...fill(1, 2, 1, [[IRON, -5]])] });
scenario("neg-furnace-empty-input", { ticks: 40, set: [[1, 3, 1, HOPPER, 0], [1, 2, 1, FURNACE, 2]], slots: fill(1, 3, 1, [[IRON, -3], [COAL, Z]]) });
scenario("neg-furnace-side-fuel", { ticks: 40, set: [[1, 1, 1, HOPPER, 5], [2, 1, 1, FURNACE, 4]], slots: [...fill(1, 1, 1, [[COAL, -2], [COAL, Z], [COAL, 2]]), ...fill(2, 1, 1, [[0, 0], [COAL, -9]])] });
scenario("neg-furnace-output-pull", { ticks: 50, set: [[1, 2, 1, HOPPER, 0], [1, 3, 1, FURNACE, 2]], slots: fill(1, 3, 1, [[IRON, 2], [COAL, -4], [IRON, -3]]) });
scenario("pickup-merge-neg", { ticks: 40, set: [[1, 1, 1, HOPPER, 0]], slots: fill(1, 1, 1, [[IRON, -3], [IRON, Z], [COAL, 5]]), entities: [[1.5, 2.2, 1.5, IRON, 4, 0], [1.5, 2.2, 1.5, COAL, 3, 0]] });
export const hopperScenarios = list;
