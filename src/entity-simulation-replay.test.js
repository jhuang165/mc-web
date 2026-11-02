import { test } from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { JavaRandom } from "./java-random.js";
import { Weather } from "./weather.js";
import { Survival } from "./survival.js";
import { ItemEntities } from "./item-entities.js";
import { Projectiles } from "./projectiles.js";
import { Arrows } from "./bow.js";
import { explodeBlocks, primeTnt, TNT_Y_OFFSET } from "./explosion.js";
import { tickEntitySimulation } from "./entity-simulation.js";

const copy = value => JSON.parse(JSON.stringify(value));
// A deterministic entity-local seed for which the first layEggs roll succeeds.
// Browser saves do not persist this RNG; reconstruction intentionally reseeds it.
// All projectile impacts occur before reloads; no active-projectile RNG continuity
// is claimed. The later checks compare only the serialized fields below.
const HATCH_SEED = 277679859659783;
const entityRandom = () => HATCH_SEED / 2 ** 48;

function makeInitialRecord() {
  const world = new World("entity-replay", "meadow", 1);
  // A small authored test arena: flat floor, separate collision targets and a
  // TNT blast target. Every override enters the same edit map the browser saves.
  for (let x = 1; x <= 24; x++) for (let z = 1; z <= 9; z++) {
    world.set(x, 0, z, 3);
    for (let y = 1; y <= 4; y++) world.set(x, y, z, 0);
  }
  for (const z of [2, 4]) for (let y = 1; y <= 3; y++) world.set(5, y, z, 3);
  world.set(6, 1, 6, 3);
  world.set(3, 1, 3, 3);
  world.set(19, 1, 7, 3);

  const survival = new Survival();
  const items = new ItemEntities(entityRandom);
  items.spawn({ id: 320, count: 3 }, 2.15, 1.32, 3.15, { delay: 0, motion: [0, 0, 0] });

  const projectiles = new Projectiles(entityRandom);
  const egg = projectiles.throwEgg({ x: 2.5, y: 1.5, z: 2.5 }, 0, 0);
  Object.assign(egg, { x: 2.5, y: 1.5, z: 2.5, mx: 3, my: 0, mz: 0 });
  const snowball = projectiles.throwSnowball({ x: 2.5, y: 1.5, z: 4.5 }, 0, 0);
  Object.assign(snowball, { x: 2.5, y: 1.5, z: 4.5, mx: 3, my: 0, mz: 0 });

  const arrows = new Arrows(entityRandom);
  // One native-format stuck arrow is in pickup range; the other flies into the
  // wall and remains away from the player so its post-impact RNG is not treated
  // as persisted state (1.7.10 saves do not write Entity.rand).
  arrows.load([
    { x: 2.95, y: 1, z: 3, mx: 0, my: 0, mz: 0, xTile: 3, yTile: 1, zTile: 3,
      inTile: 3, inData: 0, life: 0, shake: 0, inGround: true, pickup: 1, damage: 2 },
    { x: 4, y: 1.5, z: 6, mx: 3, my: 0, mz: 0, yaw: 90, pitch: 0,
      xTile: -1, yTile: -1, zTile: -1, inTile: 0, inData: 0, life: 0, shake: 0,
      inGround: false, pickup: 1, damage: 2 },
  ]);

  const tnt = primeTnt(18.5, 1 + TNT_Y_OFFSET, 7.5, { fuse: 7, random: entityRandom });
  Object.assign(tnt, { vx: 0, vy: 0, vz: 0 });
  return copy({
    edits: [...world.edits], player: survival.serialize(), position: { x: 2.15, y: 1, z: 3.15 },
    drops: items.serialize(), projectiles: projectiles.serialize(), arrows: arrows.serialize(),
    tnt: [{ x: tnt.x, y: tnt.y, z: tnt.z, vx: tnt.vx, vy: tnt.vy, vz: tnt.vz, fuse: tnt.fuse }],
    worldRandom: new Weather({ random: new JavaRandom(9981) }).saveSimulation(),
  });
}

function create(record) {
  const world = new World("entity-replay", "meadow", 1);
  world.restore(record.edits);
  const survival = new Survival(record.player);
  const position = { ...record.position };
  const items = new ItemEntities(entityRandom);
  items.load(record.drops, stack => survival.inventory.read(stack));
  const projectiles = new Projectiles(entityRandom);
  projectiles.load(record.projectiles);
  const arrows = new Arrows(entityRandom);
  arrows.load(record.arrows);
  const primed = record.tnt.map(t => Object.assign(
    primeTnt(t.x, t.y + TNT_Y_OFFSET, t.z, { fuse: t.fuse, random: entityRandom }),
    { vx: t.vx, vy: t.vy, vz: t.vz },
  ));
  const weather = new Weather({ random: new JavaRandom(9981) });
  weather.restoreSimulation(record.worldRandom);
  return { world, survival, position, items, projectiles, arrows, primed, weather };
}

function checkpoint(s) {
  return copy({
    edits: [...s.world.edits], player: s.survival.serialize(), position: s.position,
    drops: s.items.serialize(), projectiles: s.projectiles.serialize(), arrows: s.arrows.serialize(),
    tnt: s.primed.map(e => ({ x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, fuse: e.fuse })),
    worldRandom: s.weather.saveSimulation(),
  });
}

function step(s) {
  const output = [];
  const state = { ...s, mobs: null, width: 0.6, height: 1.8 };
  tickEntitySimulation(state, {
    explodeTnt: (x, y, z, power) => {
      const result = explodeBlocks(s.world, x, y, z, power, s.weather.random);
      const changes = [];
      for (const block of result.broken) {
        if (s.world.set(block.x, block.y, block.z, 0)) changes.push([block.x, block.y, block.z, block.id, 0]);
      }
      for (const drop of result.drops) s.items.spawn({ id: drop.id, count: 1, damage: drop.damage || 0 }, drop.x, drop.y, drop.z, { delay: 10 });
      output.push({ type: "tnt-explosion", power, pitch: result.pitch, broken: changes });
    },
    itemPicked: ({ item, count }) => output.push({ type: "item-picked", id: item.stack.id, count }),
    itemsCollected: picked => output.push({ type: "items-collected", count: picked.length }),
    projectileEvent: event => output.push({ type: "projectile-event", ...event }),
    arrowOptions: () => ({ targets: [] }),
    arrowsCollected: () => output.push({ type: "arrows-collected" }),
    flushArrows: () => {
      const events = s.arrows.drain();
      if (events.length) output.push({ type: "arrow-events", events });
    },
  });
  return copy({ output, state: checkpoint(s) });
}

test("real item, egg/snowball, arrow and primed-TNT serialized state replays through JSON checkpoints", () => {
  const initial = makeInitialRecord();
  const uninterrupted = create(copy(initial));
  let resumed = create(JSON.parse(JSON.stringify(initial)));
  let hatchCount = 0, itemPickup = 0, arrowPickup = 0, arrowImpact = false,
    fuseCheckpoint = false, explosionEdits = 0;

  for (let tick = 0; tick < 12; tick++) {
    if ([2, 5, 8].includes(tick)) {
      fuseCheckpoint ||= resumed.primed.some(t => t.fuse > 0 && t.fuse < 7);
      resumed = create(JSON.parse(JSON.stringify(checkpoint(resumed))));
    }
    const expected = step(uninterrupted), actual = step(resumed);
    assert.deepEqual(actual, expected, `ordered outputs and persistent state at tick ${tick}`);
    if (tick === 0) {
      assert.deepEqual(actual.state.projectiles, [], "egg and snowball both impacted the arena wall");
      assert.deepEqual(actual.output.map(e => e.type), [
        "item-picked", "items-collected", "projectile-event", "arrows-collected", "arrow-events",
      ], "pickup, projectile event and arrow callbacks preserve live tick order");
    }
    for (const event of actual.output) {
      if (event.type === "projectile-event" && event.chicks) hatchCount += event.chicks;
      if (event.type === "item-picked") itemPickup += event.count;
      if (event.type === "arrows-collected") arrowPickup++;
      if (event.type === "arrow-events" && event.events.some(e => e.sound === "random.bowhit")) arrowImpact = true;
      if (event.type === "tnt-explosion") explosionEdits += event.broken.length;
    }
  }

  assert.ok(hatchCount > 0, "the real egg impact produced a chick hatch event");
  assert.equal(itemPickup, 3, "the real dropped item stack entered player inventory");
  assert.equal(arrowPickup, 1, "the real stuck arrow was collected");
  assert.ok(arrowImpact, "the moving arrow hit the wall and stuck");
  assert.ok(fuseCheckpoint, "JSON checkpoints retained a partially spent TNT fuse");
  assert.ok(explosionEdits > 0, "the real TNT fuse callback removed blocks and advanced world RNG");
  assert.equal(resumed.world.get(19, 1, 7), 0, "the TNT blast changed its target block");
  assert.deepEqual(resumed.weather.saveSimulation(), uninterrupted.weather.saveSimulation(), "shared explosion RNG stayed aligned");
});
