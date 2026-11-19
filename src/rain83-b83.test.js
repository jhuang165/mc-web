// Batch 83 rain83: rain as part of Entity.isWet (sa.L, bytecode-read) for rockets, primed TNT, items, minecarts, endermen and wolves, and the wiring of the
// rain test (World.canLightningStrikeAt) in single player, the away run and the dedicated server.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./java-random.js";
import { rainedOn, entityWet, wetFizz } from "./entity-wet.js";
import { createRocket, tickRocket } from "./firework-rocket.js";
import { FireworkRockets } from "./fireworks-live.js";
import { primeTnt, tickTnt, TNT_Y_OFFSET } from "./explosion.js";
import { tickOneTnt } from "./entity-simulation.js";
import { ItemEntities } from "./item-entities.js";
import { Minecarts } from "./minecarts.js";
import { copyWolfShake } from "./copy-status.js";
import { FIRE } from "./world.js";

const f = Math.fround;
const AIR = { get: () => 0, getMeta: () => 0, set() {}, solid: () => false };
const FIRE_ALL = { get: () => FIRE, getMeta: () => 0, set() {}, solid: () => false };
const RAIN = () => true, DRY = () => false;
const src = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("isWet: water, or canLightningStrikeAt at floor posY or floor(posY + height)", () => {
  const cells = [];
  const at = (hit) => (x, y, z) => { cells.push([x, y, z]); return hit(x, y, z); };
  assert.equal(rainedOn(at(() => false), 1.7, 63.9, -0.2, f(0.98)), false);
  assert.deepEqual(cells, [[1, 63, -1], [1, 64, -1]], "feet cell, then head cell; x and z floored");
  assert.equal(rainedOn((x, y) => y === 64, 1.7, 63.9, -0.2, f(0.98)), true, "the head cell alone is enough");
  assert.equal(rainedOn(null, 0, 0, 0, 1), false, "no rain test: dry");
  assert.equal(entityWet(true, null, 0, 0, 0, 1), true);
  // the fizz: 0.7, 1.6 + (r - r) * 0.4 with two draws
  const s = wetFizz(new JavaRandom(3).nextFloat.bind(new JavaRandom(3)));
  const r = new JavaRandom(3), a = r.nextFloat(), b = r.nextFloat();
  assert.deepEqual(s, { name: "random.fizz", volume: f(0.7), pitch: f(f(1.6) + f(f(a - b) * f(0.4))) });
});

test("a burning rocket in the rain fizzes and rests at -1; a dry one counts down; rain stops a fire block lighting it", () => {
  const rand = new JavaRandom(11);
  const hot = createRocket(0.5, 100, 0.5, null, rand);
  hot.fire = 300;
  const dry = tickRocket(hot, AIR, rand, { rain: DRY });
  assert.equal(hot.fire, 299);
  assert.equal(dry.fizz, undefined);
  const copy = new JavaRandom(77), mine = new JavaRandom(77);
  const out = tickRocket(hot, AIR, copy, { rain: RAIN });
  assert.equal(hot.fire, -1, "moveEntity's tail: wet and burning -> -fireResistance");
  const a = mine.nextFloat(), b = mine.nextFloat();
  assert.deepEqual(out.fizz, { name: "random.fizz", volume: f(0.7), pitch: f(f(1.6) + f(f(a - b) * f(0.4))) });
  // in a fire block while rained on: dealFireDamage only, no ++fire
  const lit = createRocket(0.5, 64.1, 0.5, null, rand);
  lit.mx = lit.mz = 0; lit.fire = -1;
  tickRocket(lit, FIRE_ALL, rand, { rain: RAIN });
  assert.equal(lit.fire, -1);
  assert.equal(lit.velocityChanged, true);
  // the client copy zeroes its counter first, so it never fizzes
  const c = createRocket(0.5, 100, 0.5, null, rand); c.fire = 50;
  assert.equal(tickRocket(c, AIR, rand, { remote: true, server: false, rain: RAIN }).fizz, undefined);
  // the live list plays it through hooks.sound
  const rockets = new FireworkRockets(new JavaRandom(4)), sounds = [];
  const r = rockets.launch(0.5, 100, 0.5, null); r.fire = 40;
  rockets.tick(AIR, { rain: RAIN, sound: (...s) => sounds.push(s) });
  assert.equal(sounds[0][0], "random.fizz");
  assert.equal(sounds[0][4], f(0.7));
  assert.equal(r.fire, -1);
});

test("primed TNT in the rain: the burning counter fizzes out and fire blocks no longer light it", () => {
  const t = primeTnt(0.5, 100.49, 0.5, { random: () => 0 });
  t.fire = 161; t.vy = 0;
  const heard = [];
  tickTnt(AIR, t, null, { rain: DRY, fizz: (s) => heard.push(s) });
  assert.equal(t.fire, 161, "dry: kept (no count-down)");
  const cells = [];
  tickTnt(AIR, t, null, { rain: (x, y, z) => { cells.push(y); return true; }, fizz: (s, x, y, z) => heard.push([s, y]), random: () => 0.5 });
  assert.equal(t.fire, -1);
  assert.equal(heard.length, 1);
  assert.deepEqual(heard[0][0], { name: "random.fizz", volume: f(0.7), pitch: f(1.6) });
  assert.equal(heard[0][1], t.y, "playSoundAtEntity: posY - yOffset, the feet");
  assert.equal(cells[0], Math.floor(t.y + TNT_Y_OFFSET), "isWet reads posY = the box bottom + 0.49");
  const fire = { get: (x, y, z) => (y === 100 ? FIRE : 0), getMeta: () => 0, set() {}, solid: () => false };
  const lit = primeTnt(0.5, 100.49, 0.5, { random: () => 0 });
  lit.fire = -1; lit.vy = 0;
  tickTnt(fire, lit, null, { rain: RAIN });
  assert.equal(lit.fire, -1, "wet: no ++fire in a fire block");
  // entity-simulation passes the hooks through
  const p = primeTnt(0.5, 100.49, 0.5, { random: () => 0 }); p.fire = 20; p.vy = 0;
  const list = [p], out = [];
  tickOneTnt(AIR, list, p, { rain: RAIN, fizz: (s) => out.push(s.name) });
  assert.deepEqual(out, ["random.fizz"]);
  assert.equal(p.fire, -1);
});

test("a burning dropped item in the rain fizzes from its own Random and rests at -1", () => {
  const items = new ItemEntities(() => 0.5);
  const e = items.spawn({ id: 1, count: 1, damage: 0 }, 0.5, 100, 0.5, { delay: 0, motion: [0, 0, 0] });
  e.fire = 30;
  items.tick(AIR);
  assert.equal(e.fire, 30 - 1, "dry: onEntityUpdate counts it down");
  items.rain = RAIN;
  items.sounds.length = 0;
  items.tick(AIR);
  assert.equal(e.fire, -1);
  assert.equal(items.sounds.filter((s) => s.name === "random.fizz").length, 1);
});

test("a minecart's fire counter (server side): no count-down, and rain puts it out with a fizz", () => {
  const carts = new Minecarts({ random: () => new JavaRandom(5) });
  const cart = carts.spawnEmpty({ x: 0.5, y: 100, z: 0.5 });
  const heard = [];
  carts.host = { sound: (name, c, volume, pitch) => heard.push([name, volume, pitch]), rain: DRY };
  cart.fire = 160;
  carts.move(AIR, cart, 0, 0, 0, []);
  assert.equal(cart.fire, 160, "xl.h never calls onEntityUpdate: nothing counts it down");
  carts.move(FIRE_ALL, cart, 0, 0, 0, []);
  assert.equal(cart.fire, 161, "a fire or lava cell: ++fire");
  carts.host.rain = RAIN;
  carts.move(AIR, cart, 0, 0, 0, []);
  assert.equal(cart.fire, -1);
  assert.equal(heard.length, 1);
  assert.equal(heard[0][0], "random.fizz");
  assert.equal(heard[0][1], f(0.7));
  carts.move(FIRE_ALL, cart, 0, 0, 0, []);
  assert.equal(cart.fire, -1, "rained on in fire: no ++fire");
});

test("a wolf copy in the rain is wet (wv.h isWet) and its shake stops", () => {
  const c = { x: 0.5, y: 64, z: 0.5, height: 0.8, inWater: false, onGround: true, wolf: { wet: false, shaking: true, shakeTime: 0.5, prevShakeTime: 0.45, headTilt: 0, prevHeadTilt: 0, begging: false } };
  copyWolfShake(c, { type: "wolf" }, new JavaRandom(1), RAIN);
  assert.equal(c.wolf.wet, true);
  assert.equal(c.wolf.shaking, false);
  const d = { ...c, wolf: { ...c.wolf, wet: false, shaking: true } };
  copyWolfShake(d, { type: "wolf" }, new JavaRandom(1), DRY);
  assert.equal(d.wolf.shaking, true, "dry: the shake goes on");
});

test("the rain test is wired: single player, the away run, the dedicated server; the enderman and wolf read isWet", () => {
  const main = src("./main.js");
  assert.match(main, /items\.rain = rainAt/);
  assert.match(main, /tntRain: rainAt/);
  assert.match(main, /clientCopies: true, rain: rainAt/);
  assert.match(main, /rain: rainAt, \/\/ b83 rain83: moveEntity's isWet for carts/);
  assert.match(main, /objectTracker\.hooks\.rained = /);
  const away = src("./away-entities.js");
  assert.match(away, /items\.rain = rain;/);
  assert.match(away, /xp\.wet = /);
  assert.match(away, /tntRain: rain, rocketHooks: \(\) => \(\{ rain \}\)/);
  assert.match(src("./multiplayer/server-dispense.js"), /rain: this\.rainAt, fizz: this\.tntFizz/);
  assert.match(src("./multiplayer/server-dispense.js"), /this\.arrows\.wet = /);
  assert.match(src("./multiplayer/server-items.js"), /this\.xp\.wet = /);
  assert.match(src("./multiplayer/simulation.js"), /this\.items\.rain = /);
  assert.match(src("./multiplayer/server-vehicles.js"), /rain: \(x, y, z\) => !this\.dim/);
  assert.match(src("./enderman-live.js"), /mobs\.wet\?\.\(e, E\.ENDERMAN_HEIGHT\)/);
  assert.doesNotMatch(src("./enderman-live.js"), /canSeeSky\(bx/);
  assert.match(src("./entities.js"), /inWater: !!e\.inWater \|\| !!this\.wet\?\.\(e, t\.height\)/);
});
