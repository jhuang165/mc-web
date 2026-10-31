import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EntityWorld, ENTITY_TYPES, mobPose, sheepHeadDrop, sheepHeadPitch } from "./entities.js";
import { FLEECE_COLORS, sheepColor, childColor } from "./sheep.js";
import { JavaRandom } from "./lighting.js";
import { Survival, ITEMS } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { makeStack } from "./inventory.js";
import { WOOL, WOOL_COLORS } from "./world.js";
import { blockTile } from "./block-textures.js";

const reference = JSON.parse(await readFile(new URL("../public/research/sheep-reference.json", import.meta.url)));
// java.util.Random.nextInt(bound) on the shared 48-bit generator.
const javaRandom = (seed) => {
  const r = new JavaRandom(seed);
  return {
    nextInt(bound) {
      if ((bound & -bound) === bound) return Number((BigInt(bound) * BigInt(r.next(31))) >> 31n);
      let bits, value;
      do {
        bits = r.next(31);
        value = bits % bound;
      } while (bits - value + (bound - 1) < 0 || bits - value + (bound - 1) > 2147483647);
      return value;
    },
  };
};
const grass = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const sheepWorld = (extra = {}, world = grass, random) => new EntityWorld(world, [{ id: "mob-1", type: "sheep", x: 64, y: 0, z: 64, health: 8, color: 0, ...extra }], random);
const far = { x: 64, y: 0, z: 100 };

test("sheep use the 1.7.10 size, health, speed and AI multipliers", () => {
  const t = ENTITY_TYPES.sheep;
  assert.deepEqual([t.width, t.height, t.health, t.movement], [0.9, 1.3, 8, Math.fround(0.23)]);
  assert.deepEqual(t.ai, { wander: 1, mate: 1, panic: 1.25, tempt: 1.1, follow: 1.1 });
});

test("fleece colours match EntitySheep: the table, and wp.a(Random) rolls from java.util.Random(42)", () => {
  assert.deepEqual(FLEECE_COLORS, reference.fleeceColors.map((c) => c.map(Math.fround)));
  const rng = javaRandom(42);
  assert.deepEqual(Array.from({ length: reference.colorRolls.count }, () => sheepColor(rng)), reference.colorRolls.values);
});

test("a lamb's colour is the dye mix of 256 parent pairs, else a random parent", () => {
  for (let a = 0; a < 16; a++)
    for (let b = 0; b < 16; b++) {
      const mix = reference.mix[a * 16 + b];
      if (mix >= 0) assert.equal(childColor(a, b, () => 0.9), mix, `${a},${b}`);
      else {
        assert.equal(childColor(a, b, () => 0.1), a);
        assert.equal(childColor(a, b, () => 0.9), b);
      }
    }
});

test("shears take 1 to 3 wool of the fleece colour once, wear 1 durability and leave a bare sheep", () => {
  const w = sheepWorld({ color: 14 }, grass, () => 0.5), e = w.entities[0], p = new Survival({ inventory: { 125: 1 } });
  assert.equal(w.shear(e, 120, p), false);
  assert.equal(w.shear(e, 125, p), true);
  const events = w.drain(), drops = events.filter((x) => x.drop);
  assert.equal(drops.length, 2);
  assert.ok(drops.every((d) => d.drop === WOOL && d.damage === 14 && d.count === 1 && d.offsetY === 1));
  assert.deepEqual(events.find((x) => x.sound), { sound: "mob.sheep.shear", volume: 1, position: { x: 64, y: 0, z: 64 } });
  assert.equal(e.sheared, true);
  assert.equal(p.inventory.main[p.inventory.find(125)].damage, 1);
  assert.equal(w.shear(e, 125, p), false);
  // Killing a sheared sheep drops no wool; an unsheared one drops its colour.
  w.kill(e);
  assert.ok(!w.drain().some((x) => x.drop));
  const fresh = sheepWorld({ color: 3 });
  fresh.kill(fresh.entities[0]);
  const wool = fresh.drain().filter((x) => x.drop === WOOL);
  assert.deepEqual(wool.map((x) => [x.count, x.damage]), [[1, 3]]);
});

test("lambs and dead sheep cannot be sheared, and Creative shearing keeps the shears whole", () => {
  const w = sheepWorld({ growingAge: -100 }), p = new Survival({ inventory: { 125: 1 } });
  assert.equal(w.shear(w.entities[0], 125, p), false);
  const c = sheepWorld(), q = new Survival({}, "creative");
  assert.equal(c.shear(c.entities[0], 125, q), true);
  assert.equal(c.shear(sheepWorld().entities[0], 125, q), false);
});

test("sheep sounds: say, hurt and death are mob.sheep.say; other mobs keep theirs", () => {
  const w = sheepWorld({ health: 8 });
  w.damage(w.entities[0], 1, 60, 64);
  assert.equal(w.drain()[0].sound, "mob.sheep.say");
  w.damage(w.entities[0], 99, 60, 64);
  assert.ok(w.drain().some((x) => x.sound === "mob.sheep.say"));
  const cow = new EntityWorld(grass, [{ id: "mob-1", type: "cow", x: 64, y: 0, z: 64, health: 10 }]);
  cow.kill(cow.entities[0]);
  assert.equal(cow.drain()[0].sound, "mob.cow.hurt");
  const pig = new EntityWorld(grass, [{ id: "mob-1", type: "pig", x: 64, y: 0, z: 64, health: 10 }]);
  pig.kill(pig.entities[0]);
  assert.equal(pig.drain()[0].sound, "mob.pig.death");
});

test("a sheep eats grass in 40 ticks: dirt below, bare fleece grows back, and the grazing timer drives the head", () => {
  const edits = [], world = { ...grass, get: (x, y, z) => (edits.some((e) => e[0] === x && e[1] === y && e[2] === z) ? edits.find((e) => e[0] === x && e[1] === y && e[2] === z)[3] : grass.get(x, y, z)), set: (x, y, z, b) => edits.push([x, y, z, b]) };
  world.get = (x, y, z) => ([...edits].reverse().find((e) => e[0] === x && e[1] === y && e[2] === z)?.[3] ?? (y < 0 ? 1 : 0));
  // random() = 0 passes the 1-in-1000 roll on a tick divisible by 3.
  const w = sheepWorld({ sheared: true, age: 2 }, world, () => 0), e = w.entities[0], p = new Survival();
  w.tick(far, p);
  assert.equal(e.eatTimer, 39);
  assert.equal(e.age % 3, 0);
  for (let i = 0; i < 34; i++) w.tick(far, p);
  assert.equal(e.eatTimer, 5);
  assert.equal(e.sheared, true);
  assert.equal(edits.length, 0);
  w.tick(far, p);
  assert.equal(e.eatTimer, 4);
  assert.deepEqual(edits, [[64, -1, 64, 2]]);
  assert.equal(e.sheared, false);
  assert.deepEqual(w.drain().filter((x) => x.eatGrass), [{ eatGrass: { x: 64, y: -1, z: 64, block: 1 } }]);
});

test("tall grass is destroyed instead of the dirt, a lamb grows 60 seconds, and panic interrupts grazing", () => {
  const edits = [], world = { ...grass, get: (x, y, z) => (y === 0 ? (edits.length ? 0 : 39) : y < 0 ? 1 : 0), set: (x, y, z, b) => edits.push([x, y, z, b]) },
    w = sheepWorld({ growingAge: -2000, age: 2 }, world, () => 0), e = w.entities[0], p = new Survival();
  for (let i = 0; i < 37; i++) w.tick(far, p);
  assert.deepEqual(edits, [[64, 0, 64, 0]]);
  assert.ok(e.growingAge > -2000 + 1200 - 1 && e.growingAge < -2000 + 1200 + 40);
  const q = sheepWorld({ age: 2 }, grass, () => 0), s = q.entities[0];
  q.tick(far, p);
  assert.ok(s.eatTimer > 0);
  q.damage(s, 1, 60, 64);
  q.tick(far, p);
  assert.equal(s.eatTimer, 0);
});

test("grazing needs grass: no roll on stone, none when the timer cannot start", () => {
  const stone = { ...grass, get: (x, y, z) => (y < 0 ? 3 : 0) }, w = sheepWorld({ age: 2 }, stone, () => 0), p = new Survival();
  for (let i = 0; i < 10; i++) w.tick(far, p);
  assert.equal(w.entities[0].eatTimer, 0);
  const odd = sheepWorld({ age: 0 }, grass, () => 0);
  odd.tick(far, p);
  assert.equal(odd.entities[0].eatTimer, 0);
});

test("head drop and pitch follow wp.p(F) and wp.q(F)", () => {
  assert.equal(sheepHeadDrop(0, 0.5), 0);
  assert.equal(sheepHeadDrop(20, 0.5), 1);
  assert.equal(sheepHeadDrop(2, 0.5), Math.fround(1.5 / 4));
  assert.equal(sheepHeadDrop(38, 0.5), Math.fround(-Math.fround(-2 - 0.5) / 4));
  assert.equal(sheepHeadPitch(0, 0, 57.295776), 1);
  assert.equal(sheepHeadPitch(3, 0), Math.fround(0.62831855));
  const x = Math.fround(Math.fround(20 - 4 - 0.25) / 32);
  assert.equal(sheepHeadPitch(20, 0.25), Math.fround(0.62831855 + Math.fround(0.21991149 * Math.fround(Math.sin(Math.fround(x * 28.7))))));
  const e = sheepWorld({ eatTimer: 20 }).entities[0];
  e.eatTimer = 20;
  const pose = mobPose(e, 0.25);
  assert.equal(pose.headDrop, 1);
  assert.equal(pose.headTilt, sheepHeadPitch(20, 0.25, 0));
});

test("wheat breeds sheep: the lamb mixes the parents' dye colours and the herd persists", () => {
  const w = new EntityWorld(grass, [
    { id: "mob-1", type: "sheep", x: 64, y: 0, z: 64, health: 8, color: 0 },
    { id: "mob-2", type: "sheep", x: 65, y: 0, z: 64, health: 8, color: 11 },
  ], () => 0.9), p = new Survival({ inventory: { 305: 2 } }), [a, b] = w.entities;
  assert.equal(w.feed(a, 305, p), true);
  assert.equal(w.feed(b, 305, p), true);
  assert.equal(w.feed(a, 309, p), false);
  for (let i = 0; i < 60; i++) w.tick(far, p, 305);
  const lamb = w.entities.find((e) => e.growingAge < 0);
  assert.ok(lamb);
  assert.equal(lamb.type, "sheep");
  assert.equal(lamb.color, 3);
  assert.equal(lamb.sheared, false);
  assert.equal(lamb.growingAge, -24000);
  const again = new EntityWorld(grass, w.serialize());
  assert.equal(again.entities.find((e) => e.id === lamb.id).color, 3);
});

test("holding wheat tempts sheep before they follow a parent; sheared state and colour survive reload", () => {
  const w = sheepWorld({ color: 7, sheared: true }), e = w.entities[0], p = new Survival({ inventory: { 305: 1 } });
  w.tick({ x: 68, y: 0, z: 64 }, p, 305);
  assert.ok(e.x > 64);
  const saved = w.serialize()[0];
  assert.deepEqual([saved.color, saved.sheared], [7, true]);
  assert.equal(saved.eatTimer, 0);
  const junk = new EntityWorld(grass, [{ ...saved, color: 99, sheared: "yes" }]).entities[0];
  assert.deepEqual([junk.color, junk.sheared, junk.eatTimer], [0, false, 0]);
});

test("new worlds spawn sheep among the passive animals and colour them", () => {
  const types = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) for (const e of new EntityWorld({ ...grass, numericSeed: seed }).entities) types.add(e.type);
  assert.ok(types.has("sheep") && types.has("pig") && types.has("cow"));
  const again = (seed) => new EntityWorld({ ...grass, numericSeed: seed }).serialize();
  assert.deepEqual(again(3), again(3));
  for (const e of new EntityWorld(grass).entities) if (e.type === "sheep") assert.ok(e.color >= 0 && e.color < 16);
});

test("sheared wool leaves 1.0 up with the sheep's extra motion, in the colour of the fleece", () => {
  const items = new ItemEntities(() => 0.5), at = { x: 5, y: 10, z: 5 };
  items.dropMob(WOOL, 1, at, 6, { offsetY: 1, kick: [0.01, 0.02, -0.01] });
  const [item] = items.items;
  assert.deepEqual([item.stack.id, item.stack.damage], [WOOL, 6]);
  assert.equal(item.y, 11 - 0.125);
  assert.equal(item.my, Math.fround(0.22));
  assert.equal(item.mx, Math.fround(0.01));
  assert.equal(item.mz, Math.fround(-0.01));
  // Plain mob drops keep their old behaviour.
  const plain = new ItemEntities(() => 0.5);
  plain.dropMob(202, 2, at);
  assert.equal(plain.items.length, 2);
  assert.equal(plain.items[0].y, 10 - 0.125);
});

test("wool is one block with 16 colours: names, face tiles and stack identity", () => {
  assert.equal(ITEMS[WOOL].variants.length, 16);
  assert.deepEqual([ITEMS[WOOL].variants[0], ITEMS[WOOL].variants[8], ITEMS[WOOL].variants[15]], ["White wool", "Light gray wool", "Black wool"]);
  assert.equal(new Set(WOOL_COLORS.map((c, i) => blockTile(WOOL, 0, false, i))).size, 16);
  const inv = new Survival().inventory;
  inv.add(makeStack(WOOL, 5, 14));
  inv.add(makeStack(WOOL, 5, 1));
  assert.deepEqual(inv.main.filter(Boolean).map((s) => [s.damage, s.count]), [[14, 5], [1, 5]]);
  inv.add(makeStack(WOOL, 3, 14));
  assert.equal(inv.main.filter(Boolean).find((s) => s.damage === 14).count, 8);
});
