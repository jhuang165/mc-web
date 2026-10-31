import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { CACTUS, WEB, FIRE, LAVA } from "./world.js";
import { blockCollisions } from "./block-collisions.js";

const f = Math.fround;
const ref = JSON.parse(await readFile(new URL("../public/research/blockcollide-reference.json", import.meta.url)));
const internal = { 81: CACTUS, 30: WEB, 51: FIRE, 11: LAVA };

test("blockCollisions matches the tail of the original Entity.moveEntity", () => {
  assert.ok(ref.cases.length >= 700);
  const seen = new Set();
  for (const c of ref.cases) {
    const cells = new Map(c.cells.map(([dx, dy, dz, id]) => [`${64 + dx},${dy},${64 + dz}`, internal[id]]));
    const world = { get: (x, y, z) => (y < -1 ? 3 : cells.get(`${x},${y},${z}`) ?? 0) };
    const r = f(0.6) / 2, box = [c.x - r, 0, c.z - r, c.x + r, f(1.8), c.z + r];
    const e = { fire: c.fire, inWeb: false, fallDistance: 1.5 };
    let log;
    const hooks = { hurt: (source, n) => log.push(`${source}:${n.toFixed(1)}`), fizz: () => log.push("random.fizz"), web: () => log.push("web"), wet: c.wet, flying: c.flying, resistance: c.resistance };
    c.ticks.forEach(([events, fire, inWeb, fall], i) => {
      log = [];
      e.inWeb = false;
      e.fallDistance = 1.5;
      blockCollisions(world, box, e, hooks);
      const label = `${JSON.stringify(c.cells)} at ${c.x},${c.z} fire ${c.fire} resistance ${c.resistance} wet ${c.wet} flying ${c.flying} tick ${i}`;
      assert.equal(log.join(" "), events, label);
      assert.equal(e.fire, fire, label + " fire");
      assert.equal(e.inWeb, inWeb, label + " inWeb");
      assert.equal(e.fallDistance, fall, label + " fallDistance");
      seen.add(events);
    });
  }
  // The cases cover two cactus cells, the fizz and the player's 20-tick fire grace.
  assert.ok(seen.has("cactus:1.0 cactus:1.0") && seen.has("inFire:1.0 random.fizz") && seen.has("web inFire:1.0"));
  const grace = ref.cases.find((c) => c.fire === -20 && c.resistance === 20 && !c.wet && c.cells.length === 1 && c.cells[0][3] === 51 && c.x === 64.5 && c.z === 64.5);
  assert.deepEqual(grace.ticks.map((t) => t[1]).slice(18, 21), [-1, 160, 161]);
});

test("without hooks only webs act (falling blocks, primed TNT)", () => {
  const world = { get: (x, y, z) => (x === 0 && y === 0 && z === 0 ? WEB : x === 1 ? FIRE : 0) };
  const e = { fallDistance: 2 };
  blockCollisions(world, [0.2, 0, 0.2, 1.2, 1, 0.8], e);
  assert.deepEqual(e, { fallDistance: 0, inWeb: true });
  const spider = { type: "spider", fallDistance: 2 };
  blockCollisions(world, [0.2, 0, 0.2, 0.8, 1, 0.8], spider);
  assert.equal(spider.inWeb, undefined);
});

test("items, XP orbs and mobs take the tail's cactus and fire hits", async () => {
  const { ItemEntities } = await import("./item-entities.js");
  const { ExperienceOrbs, Experience } = await import("./experience.js");
  const { EntityWorld } = await import("./entities.js");
  const { Survival } = await import("./survival.js");
  const blocks = new Map();
  const world = { get: (x, y, z) => blocks.get(`${x},${y},${z}`) ?? (y < 0 ? 1 : 0), getMeta: () => 0, solid: (x, y, z) => y < 0 || blocks.get(`${x},${y},${z}`) === 1 };
  // An item resting on the 15/16 top of two cactus cells loses 1 per cell: 5 -> 3 -> 1 -> dead.
  // (Inside the cactus box it would be noClip from the push-out, and moveEntity skips the tail.)
  blocks.set("10,0,10", CACTUS);
  blocks.set("11,0,10", CACTUS);
  const items = new ItemEntities(() => 0.5);
  items.spawn({ id: 3, count: 1, damage: 0 }, 11, 0.9375, 10.5, { motion: [0, 0, 0] });
  const item = items.items[0];
  items.tick(world);
  assert.equal(item.health, 3);
  items.tick(world);
  items.tick(world);
  assert.equal(item.dead, true);
  // An XP orb (health 5) on a cactus dies after five ticks.
  const orbs = new ExperienceOrbs([{ x: 10.5, y: 0, z: 10.5, value: 1, life: 200 }]);
  const player = { x: 40, y: 4, z: 40 }, xp = new Experience();
  for (let i = 0; i < 4; i++) orbs.tick(world, player, xp);
  assert.equal(orbs.orbs.length, 1);
  assert.equal(orbs.orbs[0].health, 1);
  orbs.tick(world, player, xp);
  assert.equal(orbs.orbs.length, 0);
  // A mob at rest (-fireResistance, -1) catches on its first tick in fire and takes inFire 1.
  // A new entity starts at 0, so as in the original its first tick there only counts up to 1.
  blocks.clear();
  blocks.set("20,0,20", FIRE);
  const mobs = new EntityWorld(world, [{ id: "mob-1", type: "pig", x: 20.5, y: 0, z: 20.5, health: 10 }]), pig = mobs.entities[0];
  pig.fire = -1;
  mobs.tick({ x: 20.5, y: 0, z: 60 }, new Survival());
  assert.equal(pig.health, 9);
  assert.equal(pig.fire, 160);
});
