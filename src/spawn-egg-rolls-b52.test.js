import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Dispensing, dispenserBehaviour, ITEM } from "./dispense.js";
import { JavaRandom } from "./java-random.js";
import { spawnEggMob, useEggOnBlock } from "./spawn-egg-use.js";
import { eggYaw } from "./spawn-eggs.js";
import { fleeceColor } from "./population-tail.js";
import { EntityWorld } from "./entities.js";
import { plain } from "./legacy-ai-replay.js";
import { populationBlockMapperReady } from "./population-world.js";

await populationBlockMapperReady;
// Batch 52 (b52se): a dispensed spawn egg runs ItemMonsterPlacer.spawnCreature: the yaw is the first draw of the world Random, then onSpawnWithEgg draws what the mob's own
// override draws from World.rand (sheep colour, spider and zombie jockey rolls, the ocelot litter, ...). Executed rows: away-dispense-reference.json (b51ad), the Random's next value
// after the dispense (`worldNext`) now compared for every egg.
const ref = JSON.parse(readFileSync(new URL("../public/research/away-dispense-reference.json", import.meta.url)));
const X = 10, Y = 64, Z = 10;
const parse = (s) => { const [id, count, damage] = s.split(":").map(Number); return { id: ITEM.SPAWN_EGG, count, damage }; };
class Fake {
  constructor(seed) { this.rand = new JavaRandom(seed); this.blocks = new Map(); this.metas = new Map(); }
  put(x, y, z, id, meta = 0) { this.blocks.set(`${x},${y},${z}`, id); this.metas.set(`${x},${y},${z}`, meta); }
  getBlock(x, y, z) { return this.blocks.get(`${x},${y},${z}`) ?? 0; }
  getBlockMetadata(x, y, z) { return this.metas.get(`${x},${y},${z}`) ?? 0; }
  isBlockIndirectlyGettingPowered() { return false; }
}
function fire(r, difficulty = 0) {
  const w = new Fake(r.seed), tile = { items: Array(9).fill(null) }, mobs = new EntityWorld(plain([]), [], () => 0.5, undefined, undefined);
  mobs.worldRandom = w.rand; // World.rand: the dispenser's world and the mob's onSpawnWithEgg share it
  mobs.difficulty = difficulty;
  mobs.currentDate = () => new Date(2026, 5, 15);
  tile.items[0] = parse(r.item);
  if (r.customName) tile.items[0].displayName = r.customName;
  w.put(X, Y, Z, 23, r.facing);
  const made = [];
  const engine = new Dispensing({ tile: () => tile, aux() {}, spawnEgg: (stack, at, roll) => made.push(spawnEggMob({ mobs }, stack.damage, at, stack.displayName, roll)) });
  engine.slotRandom = new JavaRandom(555);
  dispenserBehaviour(engine, false).updateTick(w, X, Y, Z);
  return { w, made, mobs };
}
const rows = ref.rows.filter((r) => r.kind === "dispense" && r.item.startsWith("383:") && r.spawned?.length);

test("spawn egg dispense: the world Random after the dispense matches the executed rows (yaw, then the mob's own World.rand draws)", () => {
  const bad = [];
  let compared = 0;
  for (const r of rows) {
    const { w, made } = fire(r);
    if (!made[0]) continue; // an egg this build has no mob for
    compared++;
    if (w.rand.nextInt(1000000) !== r.worldNext) bad.push(`${r.name} f${r.facing} s${r.seed} ${r.item} ${r.spawned[0].class}`);
  }
  assert.ok(compared >= 40, `${compared} compared`);
  assert.deepEqual(bad, []);
});

test("the sheep egg rolls its fleece colour from the world Random after the yaw (the real sheep wp: 4 of the rows differ from a yaw-only draw)", () => {
  const sheep = rows.filter((r) => r.spawned[0].class === "wp");
  assert.ok(sheep.length >= 1);
  for (const r of sheep) {
    const { w, made } = fire(r);
    assert.ok(made[0].color !== undefined);
    const mirror = new JavaRandom(r.seed); mirror.nextFloat();
    assert.notEqual(mirror.nextInt(1000000), r.worldNext, "the colour roll draws more than the yaw");
    assert.equal(w.rand.nextInt(1000000), r.worldNext);
  }
});

test("a right click on a block draws the yaw from the world Random, then the sheep colour from it (ItemMonsterPlacer.spawnCreature)", () => {
  const mobs = new EntityWorld(plain([]), [], () => 0.5), seed = 77;
  mobs.worldRandom = new JavaRandom(seed);
  const stack = { id: ITEM.SPAWN_EGG, count: 2, damage: 91 };
  const state = { survival: { creative: false, held: stack, inventory: { current: 0, decr() { stack.count--; } } }, world: { get: () => 1, height: 256, inside: () => true }, mobs };
  assert.equal(useEggOnBlock(state, { block: [5, 0, 5], adjacent: [5, 1, 5] }, {}), true);
  const sheep = mobs.entities.at(-1), mirror = new JavaRandom(seed);
  assert.equal(sheep.type, "sheep");
  assert.equal(sheep.rotationYaw, eggYaw(mirror.nextFloat()));
  assert.equal(sheep.color, fleeceColor(mirror));
  assert.equal(mobs.worldRandom.nextInt(1000000), mirror.nextInt(1000000));
});
