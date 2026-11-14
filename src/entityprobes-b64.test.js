import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ItemEntities } from "./item-entities.js";
import { JavaRandom } from "./lighting.js";
import { plain } from "./legacy-ai-replay.js";

// Batch 64 (entityprobes). public/research/entity-flight-reference.json (tools/probes/EntityFlightProbe.java): the unchanged EntityPlayer.func_146097_a runs on a player shell
// with a seeded Entity.rand, then its EntityItem is walked for 30-40 ticks (EntityItem.onUpdate unchanged).
const flight = JSON.parse(readFileSync(new URL("../public/research/entity-flight-reference.json", import.meta.url))).cases;
const HALF = 0.125; // the port keeps the box bottom; the probe row has posY
const browserYaw = (deg) => Math.PI - (deg * Math.PI) / 180;

function replay(c) {
  const [x, y, z, yawDeg, pitchDeg] = c.from, rng = new JavaRandom(c.seed);
  const r = () => rng.nextFloat();
  const items = new ItemEntities(r);
  items.entityRandom = () => new JavaRandom(7);
  const blocks = c.wall ? [[c.wall[0], 0, c.wall[1], c.wall[0], 3, c.wall[1], 1, 0]] : [];
  const world = plain(blocks);
  // the player's eye: the probe's shell stands at feet y with eye height 1.62F (dropPlayer takes feet)
  const e = items.dropPlayer({ id: 1, count: c.count, damage: 0 }, { x, y, z }, browserYaw(yawDeg), (-pitchDeg * Math.PI) / 180, c.scatter);
  const state = (it) => [it.x, it.y + HALF, it.z, it.mx, it.my, it.mz, it.dead ? 1 : 0, it.stack.count, it.ticks, it.delay];
  const rows = [state(e)];
  for (let t = 0; t < c.rows.length; t++) { items.tick(world); rows.push(state(e)); }
  return rows;
}
const close = (a, b) => Math.abs(a - b) <= 1e-9 + 1e-9 * Math.abs(b);
for (const c of flight) {
  test(`native player drop in flight ${c.name}`, () => {
    const rows = replay(c), want = [c.spawn, ...c.rows];
    for (let t = 0; t < want.length; t++) for (let k = 0; k < 10; k++) {
      assert.ok(close(rows[t][k], want[t][k]), `${c.name} tick ${t} field ${k}: port ${rows[t][k]} native ${want[t][k]}`);
    }
  });
}

// The batch 45-47 gaps that the list still showed are already covered by executed records (checked here so the list can drop them): the egg hatch and bottle orbs on a vehicle or
// painting (EntityListProbe, replayed in entity-list.test.js), the EntityPlayerMP pearl at a cart, `cart-cow-mount-ba`, and a piston pushing a real mob (PistonLiveProbe live pigs,
// 12 b49po and 25 b48pp EndermanWolf records). Spawned orbs and potions are recorded in flight by the same list rows (the `extras` column after each tick).
test("earlier executed records already cover gaps 1 to 4 of the list", () => {
  const list = JSON.parse(readFileSync(new URL("../public/research/entity-list-reference.json", import.meta.url))).cases.map((c) => c.name);
  for (const n of ["pthrow-egg-cart-hatch", "pthrow-egg-painting-hatch", "pthrow-expbottle-cart", "pthrow-expbottle-boat", "pthrow-expbottle-painting", "pthrow-pearl-mp-cart", "pthrow-pearl-mp-boat", "cart-cow-mount-ba"]) assert.ok(list.includes(n), n);
  const pistons = JSON.parse(readFileSync(new URL("../public/research/piston-live-reference.json", import.meta.url))).scenarios.map((c) => c.name);
  assert.ok(pistons.some((n) => n.startsWith("live-pig")));
  const cases = JSON.parse(readFileSync(new URL("../public/research/entity-list-reference.json", import.meta.url))).cases;
  for (const n of ["pthrow-egg-cart-hatch", "pthrow-expbottle-cart", "death-fall-cow-hit"]) {
    const c = cases.find((r) => r.name === n);
    assert.ok(c.rows.at(-1)[3].length > 0 && c.rows.length > 4, `${n}: spawned entities are listed every tick after they spawn`);
  }
});
