// Batch 87 boatcheck87: ItemBoat.onItemRightClick's entity checks for every entity kind (boat-place-entities.js, Boats.place, the server's useHeld, the client's
// clientEntityBoxes). Executed evidence: public/research/boat-entity-reference.json (tools/verify-boat-entities.mjs, tools/probes/BoatEntityProbe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { solidBlock, WATER, World } from "./world.js";
import { Boats, BOAT_ITEM, BOAT_Y_OFFSET } from "./boats.js";
import { Fireballs } from "./fireballs.js";
import { boatPlaceEntities, BOAT_ENTITY_SIZES } from "./boat-place-entities.js";
import { clientBoatFits, clientEntityBoxes } from "./client-item-use.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";

const f = Math.fround;
const ref = JSON.parse(readFileSync(new URL("../public/research/boat-entity-reference.json", import.meta.url), "utf8"));
const internal = { 0: 0, 1: 3, 9: WATER };
// The probe's map world: water at the looked-at cell, stone below y 0.
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta = 0]) => [`${x},${y},${z}`, [internal[id], meta]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)), set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}
const near = (a, b, at, tol = 1e-6) => { assert.equal(a.length, b.length, at); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) <= tol, `${at}[${i}] ${v} vs ${b[i]}`)); };
const kindOf = (name) => name.replace(/-(at-start|in-boat-box|border-1|clear)$/, "");
// The port's record for a native entity (posX/posY/posZ), in each list's own y convention, as boatPlaceEntities' arguments.
function portLists(kind, [x, posY, z], box) {
  const ball = (width, large) => ({ list: [{ x, y: posY, z, width, large }], boxOf: Fireballs.prototype.boxOf });
  switch (kind) {
    case "item": return { items: [{ x, y: posY - 0.125, z }] };
    case "orb": return { orbs: [{ x, y: posY - 0.25, z }] };
    case "arrow": return { arrows: [{ x, y: posY, z }] };
    case "snowball": return { balls: [[{ x, y: posY, z }]] };
    case "eye": return { eyes: [{ x, y: posY, z }] };
    case "hook": return { hooks: [{ x, y: posY, z }] };
    case "large-fireball": return { fireballs: [ball(1, true)] };
    case "small-fireball": return { fireballs: [ball(0.3125, false)] };
    case "wither-skull": return { fireballs: [ball(0.3125, false)] };
    case "falling": return { falling: [{ x, y: posY - f(0.49), z }] };
    case "tnt": return { primed: [{ x, y: posY - f(0.49), z }] };
    case "crystal": return { mobs: { entities: [{ type: "ender_crystal", x, y: posY, z, health: 5 }], size: () => [2, 2] } };
    case "boat": return { vehicles: [[new Boats().spawnBoat({ x, y: posY - BOAT_Y_OFFSET, z })]] };
    case "cart": return { vehicles: [[{ bb: box }]] }; // the cart's own box (the minecart record's y convention is the rail's, not checked here)
    case "knot": return { mobs: { entities: [], knotList: [{ x: Math.floor(x), y: Math.floor(posY), z: Math.floor(z) }] } };
    default: throw new Error(kind);
  }
}
// The client copies of the same entity (wire rows: client-item-use.js).
function clientLists(kind, [x, posY, z], box) {
  switch (kind) {
    case "item": return { items: [{ x, y: posY - 0.125, z }] };
    case "orb": return { orbs: [{ x, y: posY - 0.25, z }] };
    case "arrow": return { arrows: [{ x, y: posY, z }] };
    case "snowball": return { balls: [{ kind: "snowball", x, y: posY, z }] };
    case "eye": return { balls: [{ kind: "eyeOfEnder", x, y: posY, z }] };
    case "hook": return { hooks: [{ x, y: posY, z }] };
    case "large-fireball": return { balls: [{ kind: "fireball", x, y: posY, z }] };
    case "small-fireball": return { balls: [{ kind: "smallFireball", x, y: posY, z }] };
    case "wither-skull": return { balls: [{ kind: "witherSkull", x, y: posY, z }] };
    case "falling": return { falling: [{ x, y: posY - f(0.49), z }] };
    case "tnt": return { primed: [{ x, y: posY - f(0.49), z }] };
    case "crystal": return { mobs: { list: () => [{ type: "ender_crystal", x, y: posY, z, health: 5 }], factory: { size: () => [2, 2] } } };
    case "boat": return { vehicles: { boats: { carts: [new Boats().spawnBoat({ x, y: posY - BOAT_Y_OFFSET, z })] } } };
    case "cart": return { vehicles: { carts: { carts: [{ bb: box }] } } };
    case "knot": return { vehicles: { hanging: { copies: new Map([["k1", { bb: box }]]) } } };
    default: throw new Error(kind);
  }
}
const lookOf = (c) => {
  const [px, py, pz, pitch, yaw] = c.player, p = f(pitch * Math.PI / 180), y = f(yaw * Math.PI / 180);
  return { eye: [px, py + f(1.62), pz], dir: [-Math.sin(y) * Math.cos(p), -Math.sin(p), Math.cos(y) * Math.cos(p)], box: [px - 0.3, py, pz - 0.3, px + 0.3, py + f(1.8), pz + 0.3], yaw, cell: [Math.floor(px), 1, Math.floor(pz), 9, 0] };
};

test("the native records: every kind's canBeCollidedWith, border, yOffset and size", () => {
  assert.ok(ref.cases.length >= 60);
  for (const name of ["abj", "ahb", "sa", "xk", "sq", "zc", "xe", "ze", "zg", "xj", "xw", "wz", "su"]) assert.match(ref.classes[name].sha256, /^[0-9a-f]{64}$/);
  const seen = {};
  for (const c of ref.cases) if (c.entity) seen[kindOf(c.name)] = c.entity;
  const flags = Object.fromEntries(Object.entries(seen).map(([k, e]) => [k, [e.collide, e.border, e.yOffset, e.size[0]]]));
  assert.deepEqual(flags, {
    item: [false, 0.1, 0.125, 0.25], orb: [false, 0.1, 0.25, 0.5], arrow: [false, 0.1, 0, 0.5], snowball: [false, 0.1, 0, 0.25], eye: [false, 0.1, 0, 0.25], hook: [false, 0.1, 0, 0.25],
    "large-fireball": [true, 1, 0, 1], "small-fireball": [false, 1, 0, 0.3125], "wither-skull": [false, 1, 0, 0.3125], falling: [true, 0.1, 0.49, 0.98], tnt: [true, 0.1, 0.49, 0.98],
    crystal: [true, 0.1, 1, 2], boat: [true, 0.1, 0.3, 1.5], cart: [true, 0.1, 0.35, 0.98], knot: [true, 0.1, 0, 0.5], "knot-beside": [true, 0.1, 0, 0.5],
  });
  assert.equal(BOAT_ENTITY_SIZES.falling, f(0.98));
});

for (const c of ref.cases) {
  test(`boat placement with ${c.name}: boat-place-entities rows and Boats.place match the native record`, () => {
    const look = lookOf(c), world = probeWorld([look.cell]), kind = c.entity && (c.name.startsWith("knot") ? "knot" : kindOf(c.name));
    const rows = c.entity ? boatPlaceEntities(portLists(kind, c.entity.pos, c.entity.box)) : [];
    if (c.entity) {
      assert.equal(rows.length, 1);
      near(rows[0].bb, c.entity.box, "box", 1e-6);
      assert.equal(rows[0].collide, c.entity.collide, "collide");
      if (c.entity.collide) assert.ok(Math.abs((rows[0].border ?? 0.1) - c.entity.border) < 1e-7, "border");
    }
    const boat = new Boats().place(world, { eye: look.eye, dir: look.dir, yaw: c.player[4], box: look.box }, [{ bb: look.box }, ...rows], rows);
    assert.equal(!!boat, c.boat !== null, "placed");
    if (boat) near([boat.x, boat.posY, boat.z], c.boat.slice(0, 3), "boat");
  });
  if (c.entity) test(`client copies with ${c.name}: clientEntityBoxes and clientBoatFits match the native record`, () => {
    const look = lookOf(c), kind = c.name.startsWith("knot") ? "knot" : kindOf(c.name);
    const rows = clientEntityBoxes(clientLists(kind, c.entity.pos, c.entity.box));
    assert.equal(rows.length, 1);
    near(rows[0].bb, c.entity.box, "box", 1e-6);
    assert.equal(rows[0].collide, c.entity.collide, "collide");
    assert.equal(clientBoatFits({ world: probeWorld([look.cell]), eye: look.eye, dir: look.dir, yaw: c.player[4], playerBox: look.box, entities: rows }), c.boat !== null);
  });
}

test("the dragon: its body is not collidable but stays in the box test, its parts are both; neither counts while the body is not listed", () => {
  const parts = [{ box: [2, 1.6, 4, 3, 1.95, 5] }], dragon = { type: "ender_dragon", x: 2.5, y: -6, z: 4.5, health: 200, dragon: { parts } };
  const rows = boatPlaceEntities({ mobs: { entities: [dragon], size: () => [16, 8] } });
  assert.deepEqual(rows.map((r) => [r.collide, typeof r.listed]), [[false, "function"], [true, "function"]]);
  near(rows[0].bb, [-5.5, -6, -3.5, 10.5, 2, 12.5], "body");
  const world = () => probeWorld([[2, 1, 4, 9, 0]]), look = { eye: [2.5, 3 + f(1.62), 4.5], dir: [0, -1, 0], box: [2.2, 3, 4.2, 2.8, 4.8, 4.8] };
  // The body box [-6, 2] meets the shrunk boat box [2.1, 2.5]? No (top 2): the part holds the start (y 2) within 0.1, so the sight test refuses.
  assert.equal(new Boats().place(world(), { ...look, yaw: 0 }, [{ bb: look.box }, ...rows], rows), null);
  assert.ok(new Boats().place(world(), { ...look, yaw: 0 }, [{ bb: look.box }, rows[0]], [rows[0]]), "the body alone: not collidable, below the boat");
  // A body far from the look box: the parts are not listed (apx.a lists them only with the body).
  const away = { ...dragon, x: 40.5, y: 30 }, far = boatPlaceEntities({ mobs: { entities: [away], size: () => [16, 8] } });
  assert.ok(new Boats().place(world(), { ...look, yaw: 0 }, [{ bb: look.box }, ...far], far));
  // The client copy: the same rows from mob.dragon.parts, gated by dragonListed on its body box.
  const copy = { type: "ender_dragon", x: 2.5, y: -6, z: 4.5, health: 200, dragon: { parts, bb: [-5.5, -6, -3.5, 10.5, 2, 12.5] } };
  const client = clientEntityBoxes({ mobs: { list: () => [copy], factory: { size: () => [16, 8] } } });
  assert.deepEqual(client.map((r) => r.collide), [false, true]);
  assert.equal(clientBoatFits({ world: world(), eye: look.eye, dir: look.dir, yaw: 0, playerBox: look.box, entities: client }), false);
  copy.dragon.bb = [32.5, 30, 32.5, 48.5, 38, 48.5];
  assert.equal(clientBoatFits({ world: world(), eye: look.eye, dir: look.dir, yaw: 0, playerBox: look.box, entities: clientEntityBoxes({ mobs: { list: () => [copy], factory: { size: () => [16, 8] } } }) }), true);
});

test("a dying mob is collidable until its 20th death tick; dead and frozen entries are left out", () => {
  const cow = (death) => ({ type: "cow", x: 0, y: 0, z: 0, health: 0, death });
  const rows = (list) => boatPlaceEntities({ mobs: { entities: list, size: () => [0.9, 1.3] } });
  assert.equal(rows([cow(19)]).length, 1);
  assert.equal(rows([cow(20)]).length, 0);
  assert.equal(boatPlaceEntities({ items: [{ x: 0, y: 0, z: 0, dead: true }], primed: [{ x: 0, y: 0, z: 0, dead: true }] }).length, 0);
});

// The dedicated server's useHeld over a pond: the player stands at (63.5, 13, 63.5) looking down; the trace start ends at y 12, the boat would sit at [12, 12.6].
function server() {
  const world = new World("b87-boat");
  for (let x = 56; x <= 70; x++) for (let z = 56; z <= 70; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 10 ? 3 : y === 11 ? WATER : 0, 0, false);
  world.spawn = () => ({ x: 63.5, y: 13, z: 63.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const p = sim.addPlayer("a", "Alex", "00000000-0000-0000-0000-000000000001");
  p.position.copy({ x: 63.5, y: 13, z: 63.5 }); p.previous.copy(p.position); p.yaw = 0; p.pitch = -Math.PI / 2;
  p.survival.mode = "survival"; p.survival.inventory.main.fill(null); p.survival.add(BOAT_ITEM, 2);
  const use = () => sim.vehicles.useHeld(p, null);
  return { sim, p, use, boats: () => sim.vehicles.boats.carts.filter((b) => !b.dead).length };
}

test("server useHeld: no entity places the boat and takes one", () => {
  const s = server();
  assert.equal(s.use(), true);
  assert.equal(s.boats(), 1);
  assert.equal(s.p.survival.held.count, 1);
});

test("server useHeld: an item floating in the boat's box refuses (every entity's box counts)", () => {
  const s = server();
  s.sim.items.spawn({ id: 264, count: 1, damage: 0 }, 63.5, 12.2 + 0.125, 63.5, { delay: 10, motion: [0, 0, 0] });
  assert.equal(s.use(), false);
  assert.equal(s.boats(), 0);
  assert.equal(s.p.survival.held.count, 2);
});

test("server useHeld: primed TNT round the trace start refuses (canBeCollidedWith); an orb there does not", () => {
  const s = server();
  s.sim.dispense.primed.push({ x: 63.5, y: 12.05 - f(0.98), z: 63.5, vx: 0, vy: 0, vz: 0, fuse: 40 });
  assert.equal(s.use(), false);
  const t = server();
  t.sim.serverItems.xp.orbs.push({ x: 63.5, y: 11.55, z: 63.5, posY: 11.8, bb: [63.25, 11.55, 63.25, 63.75, 12.05, 63.75] });
  assert.equal(t.use(), true);
});

test("server useHeld: a dying mob in the boat's box still refuses", () => {
  const s = server();
  s.sim.mobs.mobs.entities.push({ type: "cow", x: 63.5, y: 12.2, z: 63.5, health: 0, death: 5 });
  assert.equal(s.use(), false);
});

test("main.js gives the single-player boat and the multiplayer prediction every entity kind", () => {
  const main = readFileSync(new URL("./main.js", import.meta.url), "utf8");
  assert.match(main, /const sight = boatPlaceEntities\(\{ mobs, items: items\.items, orbs: xpOrbs\.orbs, arrows: arrows\.list/);
  assert.match(main, /hooks: remoteFishing\?\.rows \?\? \[\] \}\) : \[\]/);
});
