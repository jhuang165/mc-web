// Batch 84 rain84: rain for the remaining moveEntity users (boats, falling blocks, the fishing hook), the item and orb sounds at the feet, and the replay of
// tools/probes/RainFireProbe.java (public/research/rain-fire-reference.json): a burning primed TNT and a burning minecart in rain, executed on the 1.7.10 jar.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { primeTnt, tickTnt } from "./explosion.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { FallingBlocks, spawnFalling } from "./falling.js";
import { FishHook } from "./fishing.js";
import { ItemEntities } from "./item-entities.js";
import { FIRE, LAVA } from "./world.js";

const f = Math.fround;
const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const ref = JSON.parse(readFileSync(new URL("../public/research/rain-fire-reference.json", import.meta.url), "utf8"));
const STONE = 1;

// The probe's world: entities come to rest with the box bottom at 63.0 (cells 0..62 solid), fire placed in cell (10, 63, 10) from tick `fireAt` to `fireOff`, a roof block over the column.
function worldFor(rec, state) {
  return { get: (x, y, z) => (x === 10 && z === 10 && y === 63 && state.fire ? FIRE : x === 10 && z === 10 && y === 70 && state.roof ? STONE : y <= 62 ? STONE : 0), getMeta: () => 0, set() {}, solid: (x, y, z) => y <= 62 };
}
const rainTest = (state) => (x, y, z) => state.rain && !(x === 10 && z === 10 && state.roof && y < 70);

function replay(rec, step) {
  const state = { fire: false, rain: false, roof: false }, world = worldFor(rec, state), out = [];
  for (const row of rec.rows) {
    const tick = row[0];
    if (tick === rec.fireAt) state.fire = true;
    if (tick === rec.fireOff) state.fire = false;
    if (tick === rec.roofAt) state.roof = true;
    if (tick === rec.rainAt) state.rain = true;
    out.push({ row, ...step(world, state, tick) });
  }
  return out;
}

for (const rec of ref.records) {
  test(`executed ${rec.name}: fire counter, fizz tick, feet and rest tick match the jar`, () => {
    const heard = [];
    let after;
    if (rec.kind === "tnt") {
      const t = primeTnt(rec.start[0], rec.start[1], rec.start[2], { random: () => 0 });
      t.vx = t.vy = t.vz = 0;
      const rnd = new JavaRandom(9);
      after = replay(rec, (world, state) => {
        heard.length = 0;
        tickTnt(world, t, null, { rain: rainTest(state), fizz: (s, x, y, z) => heard.push([s, x, y, z]), random: () => rnd.nextFloat() });
        return { fire: t.fire, posY: t.y + f(0.49), ground: t.onGround, heard: heard.map((h) => h) };
      });
    } else {
      const carts = new Minecarts({ random: () => new JavaRandom(5) });
      const cart = carts.spawnEmpty({ x: rec.start[0], y: rec.start[1], z: rec.start[2] });
      let st;
      carts.host = { sound: (name, c, volume, pitch) => heard.push([{ name, volume, pitch }, c.x, c.posY - 0.35, c.z]) };
      after = replay(rec, (world, state) => {
        heard.length = 0;
        carts.host.rain = rainTest(state);
        carts.tickOne(world, cart, [], carts.host);
        return { fire: cart.fire, posY: cart.posY, ground: cart.onGround, heard: heard.map((h) => h) };
      });
    }
    for (const { row, fire, ground, heard: h } of after) {
      const [tick, , execFire, , , execGround, execSounds] = row;
      assert.equal(fire, execFire, `${rec.name} tick ${tick}: fire counter`);
      assert.equal(ground ? 1 : 0, execGround, `${rec.name} tick ${tick}: onGround`);
      assert.equal(h.length, execSounds.length, `${rec.name} tick ${tick}: fizz count`);
      for (let k = 0; k < h.length; k++) {
        assert.equal(h[k][0].name, execSounds[k][0]);
        assert.equal(h[k][0].volume, f(execSounds[k][1]));
        assert.ok(h[k][0].pitch >= 1.2 && h[k][0].pitch <= 2.0 && execSounds[k][2] >= 1.2 && execSounds[k][2] <= 2.0, "1.6 + (r - r) * 0.4 is within 1.2..2.0 (the jar's Entity.rand is unseeded)");
        assert.ok(Math.abs(h[k][2] - execSounds[k][4]) < 1e-6, `${rec.name}: the fizz is at the feet (posY - yOffset)`);
      }
    }
  });
}

test("the executed reference holds the expected shapes", () => {
  const by = Object.fromEntries(ref.records.map((r) => [r.name, r]));
  assert.equal(Object.keys(by).length, 8);
  for (const kind of ["tnt", "cart"]) {
    const sounds = (n) => by[`${kind}-${n}`].rows.flatMap((r) => r[6]);
    assert.equal(sounds("fire-then-rain").length, 1, `${kind}: one fizz when rain starts on a burning entity`);
    assert.equal(sounds("rain-then-fire").length, 0, `${kind}: wet before the fire: no ++fire, no fizz`);
    assert.equal(sounds("roofed").length, 0);
    assert.equal(sounds("dry-fire").length, 0);
    assert.equal(by[`${kind}-fire-then-rain`].rows.at(-1)[2], -1);
    assert.ok(by[`${kind}-dry-fire`].rows.at(-1)[2] >= 160, `${kind}: no count-down while it burns`);
  }
});

test("boats: isWet is inWater or rain at the box; a burning boat in the rain fizzes at its feet and rests at -1 (xi never reads isWet itself)", () => {
  const boats = new Boats();
  const boat = boats.spawnBoat({ x: 0.5, y: 100, z: 0.5 });
  const heard = [], dry = { get: () => 0, getMeta: () => 0, set() {}, solid: () => false };
  boat.fire = 80; boat.vx = boat.vy = boat.vz = 0;
  boats.move(dry, boat, 0, 0, 0, [], { rain: () => false, fizz: (b, v, p) => heard.push([v, p]) });
  assert.equal(boat.fire, 80, "dry: nothing counts it down in moveEntity");
  boats.move(dry, boat, 0, 0, 0, [], { rain: () => true, fizz: (b, v, p) => heard.push([b.y, v, p]) });
  assert.equal(boat.fire, -1);
  assert.equal(heard.length, 1);
  assert.equal(heard[0][0], boat.y, "the feet: posY - yOffset");
  assert.equal(heard[0][1], f(0.7));
  const lit = { get: (x, y, z) => (y === Math.floor(boat.y) ? FIRE : 0), getMeta: () => 0, set() {}, solid: () => false };
  boat.fire = -1;
  boats.move(lit, boat, 0, 0, 0, [], { rain: () => true });
  assert.equal(boat.fire, -1, "wet: no ++fire in a fire cell");
  boats.move(lit, boat, 0, 0, 0, [], { rain: () => false });
  assert.equal(boat.fire, 160, "dry: ++fire from -1 reaches 0 and setFire(8) makes it 160");
});

test("falling blocks: a burning block in the rain fizzes at its feet; a fire cell lights it only when dry", () => {
  const w = { get: (x, y) => (y === 100 ? FIRE : 0), getMeta: () => 0, set() {}, solid: () => false };
  const heard = [];
  const fb = new FallingBlocks(w, { rain: () => false, fizz: (...a) => heard.push(a) });
  const e = spawnFalling(60, 0, 0, 100, 0, new JavaRandom(3));
  e.fire = -1; e.ticks = 1;
  fb.tickEntity(e);
  assert.ok(e.fire > 0, "a fire cell: ++fire to 0 then setFire(8)");
  fb.rain = () => true;
  fb.tickEntity(e);
  assert.equal(e.fire, -1);
  assert.equal(heard.length, 1);
  assert.equal(heard[0][0], "random.fizz");
  assert.equal(heard[0][2], e.y, "at the feet");
  const e2 = spawnFalling(60, 0, 0, 100, 0, new JavaRandom(3));
  e2.fire = -1; e2.ticks = 1;
  fb.tickEntity(e2);
  assert.equal(e2.fire, -1, "wet in a fire cell: no ++fire");
});

test("the fishing hook: a fire cell lights its counter, rain at the hook fizzes it out", () => {
  const lava = { get: (x, y) => (y === 100 ? FIRE : 0), getMeta: () => 0, set() {}, solid: () => false, getBlock: () => 0 };
  const heard = [];
  let raining = false;
  const env = { world: lava, player: { x: 0, y: 100, z: 0, valid: true }, canLightningStrike: () => raining, canSeeSky: () => true, sound: (...a) => heard.push(a), particle() {}, worldRand: new JavaRandom(1), entities: () => [], remote: false };
  const h = FishHook.cast(new JavaRandom(2), { x: 0, y: 99, z: 0, yaw: 0, pitch: 0 });
  h.x = 0.5; h.y = 100.1; h.z = 0.5; h.vx = h.vy = h.vz = 0;
  h.px = h.x; h.py = h.y; h.pz = h.z;
  h.bb = [h.x - 0.125, h.y, h.z - 0.125, h.x + 0.125, h.y + 0.25, h.z + 0.125];
  h.tick(env);
  assert.ok(h.fire > 0, "a fire cell: ++fire (moveEntity tail)");
  h.fire = 50; raining = true;
  h.tick(env);
  assert.equal(heard.filter((s) => s[0] === "random.fizz").length, 1, "rain fizzes the burning hook (count-down first, then the tail)");
  assert.equal(h.fire, -1);
});

test("item and orb fizz and lava sounds are pushed at the feet (posY - yOffset)", () => {
  const items = new ItemEntities(() => 0.5);
  const e = items.spawn({ id: 1, count: 1, damage: 0 }, 0.5, 100, 0.5, { delay: 0, motion: [0, 0, 0] });
  e.fire = 30; items.rain = () => true;
  items.tick({ get: () => 0, getMeta: () => 0, set() {}, solid: () => false });
  const s = items.sounds.find((x) => x.name === "random.fizz");
  assert.ok(s);
  assert.equal(s.y, e.y, "the item's feet");
  assert.match(src("./experience.js"), /y:o\.posY-HALF,z:o\.z\}\); \/\/ b84 rain84/);
  assert.match(src("./experience.js"), /y:o\.bb\[1\],z:o\.z\}\)\}\); \/\/ b84 rain84/);
});

test("wiring: main.js boats and falling blocks, the away run and the dedicated server", () => {
  assert.match(src("./main.js"), /rain: rainAt, fizz: \(b, volume, pitch\) => sounds\.play\("random\.fizz"/);
  assert.match(src("./main.js"), /rain:\(x,y,z\)=>rainAt\(x,y,z\),fizz:/);
  assert.match(src("./away-entities.js"), /boats: \{ drop: dropVehicle, rain \}/);
  assert.match(src("./away-world.js"), /rain: \(x, y, z\) => canLightningStrikeAt\(weather, world, x, y, z\)/);
  assert.match(src("./multiplayer/simulation.js"), /rain: \(x, y, z\) => canLightningStrikeAt\(this\.weather, this\.world, x, y, z\), fizz:/);
});
