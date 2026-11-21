// Batch 88 boatray88: ItemBoat's ray on the server (MathHelper's sin / cos tables, EntityPlayerMP's yOffset 0), a dead player in the boat check until World.updateEntities
// drops it, EntityEnderCrystal's box centred on posY at every site that boxes a crystal, and the single-player client standing on its boat copies. See
// .shared-memory/notes/boatray88-b88-track.md. Executed: public/research/boat-ray-reference.json (tools/verify-boat-ray.mjs, tools/probes/BoatRayProbe.java).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { solidBlock, WATER, World } from "./world.js";
import { Boats, BOAT_ITEM, boatRay } from "./boats.js";
import { traceBucket } from "./buckets.js";
import { boatPlaceEntities, crystalBox as boatCrystalBox, playerListed } from "./boat-place-entities.js";
import { crystalBox } from "./ender-crystal.js";
import { boatRay as clientBoatRay } from "./client-item-use.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { placementEntityBlocker } from "./placement-entities.js";
import { dragonHost } from "./dragon-mobs.js";
import { EntityWorld, entityHit, setEntityBoxes } from "./entities.js";
import { mobTargets } from "./projectiles.js";
import { strikeMobs } from "./weather-simulation.js";
import { boatBoxProvider, clientBoatBoxProvider } from "./entity-collision.js";
import { ObjectTracker } from "./object-tracker.js";
import { Survival } from "./survival.js";
import { movePlayer } from "./player-physics.js";
import { vector } from "./player-physics-fixture.js";
import { PlayerMotion } from "./player-movement.js";
import { finishPlayerMovement } from "./player-environment.js";

const f = Math.fround;
const ref = JSON.parse(readFileSync(new URL("../public/research/boat-ray-reference.json", import.meta.url), "utf8"));
const internal = { 0: 0, 1: 3, 9: WATER };
const CELLS = { x: [[2, 1, 4, 9], [3, 1, 4, 9]], z: [[3, 1, 4, 9], [3, 1, 5, 9]], miss: [[3, 1, 4, 9]], ysize: [[2, 1, 4, 9], [3, 1, 4, 9]] };
const cellsOf = (scene) => CELLS[scene.split("-")[0]];
// BoatProbe's map world: the listed cells, stone below y 0, air elsewhere.
function probeWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id]) => [`${x},${y},${z}`, [internal[id], 0]]));
  const cell = (x, y, z) => map.get(`${x},${y},${z}`) ?? [y < 0 ? 3 : 0, 0];
  return { get: (x, y, z) => cell(x, y, z)[0], getMeta: (x, y, z) => cell(x, y, z)[1], solid: (x, y, z) => solidBlock(...cell(x, y, z)), set: (x, y, z, id) => { map.set(`${x},${y},${z}`, [id, 0]); return true; } };
}
// The port's position.y is the box bottom, posY + ySize (Entity.setPosition), as the player tracker reads it.
const portPos = (c) => ({ x: c.pos[0], y: c.pos[1] + f(c.ySize), z: c.pos[2] });
function place(c, ray) {
  const w = probeWorld(cellsOf(c.scene)), pos = portPos(c), box = [pos.x - 0.3, pos.y, pos.z - 0.3, pos.x + 0.3, pos.y + 1.8, pos.z + 0.3], trace = {};
  traceBucket(w, ray.eye, ray.dir, true, trace);
  const b = new Boats().place(w, { eye: ray.eye, dir: ray.dir, yaw: c.yaw, box }, [{ bb: box }], []);
  return { boat: b ? [b.x, b.posY ?? b.y, b.z] : null, start: trace.start ?? null, count: b ? 1 : 2 };
}
const tableRay = (c) => boatRay(portPos(c), f(c.ySize), c.yaw, c.pitch, 0);
// The server's ray before batch 88: Math.sin / Math.cos in double of the radian rotation.
function oldRay(c) {
  const pos = portPos(c), ry = Math.PI - c.yaw * Math.PI / 180, rp = -c.pitch * Math.PI / 180;
  return { eye: [pos.x, pos.y - f(c.ySize) + 1.62, pos.z], dir: [-Math.sin(ry) * Math.cos(rp), Math.sin(rp), -Math.cos(ry) * Math.cos(rp)] };
}
const cellOf = (b) => (b ? b.map(Math.floor) : null);

test("the executed ItemBoat ray: every record's trace start, cell and item count match boatRay with yOffset 0 (MathHelper tables)", () => {
  assert.ok(ref.cases.length >= 100, `${ref.cases.length} records`);
  for (const sc of ["x-edge", "z-edge", "miss-edge", "ysize-edge"]) {
    const edge = ref.cases.filter((c) => c.scene === sc);
    assert.ok(new Set(edge.map((c) => JSON.stringify(c.boat))).size === 2, `${sc}: the window holds both results`);
  }
  for (const c of ref.cases) {
    const at = `${c.scene} yaw ${c.yaw} pitch ${c.pitch}`, got = place(c, tableRay(c));
    assert.equal(got.count, c.count, at);
    if (c.boat) { assert.ok(got.boat, at); got.boat.forEach((v, i) => assert.ok(Math.abs(v - c.boat[i]) < 1e-6, `${at} boat[${i}] ${v} vs ${c.boat[i]}`)); }
    else assert.equal(got.boat, null, at);
    assert.ok(got.start && c.traceStart, at);
    got.start.forEach((v, i) => assert.ok(Math.abs(v - c.traceStart[i]) < 1e-9, `${at} start[${i}] ${v} vs ${c.traceStart[i]}`));
  }
});

test("mutation check: the old Math.sin ray gives another cell (or a miss) inside every edge window", () => {
  for (const sc of ["x-edge", "z-edge", "miss-edge", "ysize-edge"]) {
    const off = ref.cases.filter((c) => c.scene === sc && JSON.stringify(cellOf(place(c, oldRay(c)).boat)) !== JSON.stringify(cellOf(c.boat)));
    assert.ok(off.length >= 1, `${sc}: the double ray disagrees somewhere`);
  }
  // the client's yOffset 1.62 (EntityPlayer) and the server's 0 (EntityPlayerMP) start at the same eye for the same posY
  const c = ref.cases.find((r) => r.scene === "ysize-edge");
  assert.deepEqual(boatRay(portPos(c), f(c.ySize), c.yaw, c.pitch).eye, tableRay(c).eye);
  assert.equal(clientBoatRay, boatRay, "the client and the server share one ray");
});

// The dedicated server's useHeld at the executed edge angles: the probe's scene shifted up 10 blocks (stone at y 9, water at y 11, the player's feet at y 13).
function server(scene, ySize = 0) {
  const world = new World(`b88-ray-${scene}`);
  for (let x = -4; x <= 10; x++) for (let z = -2; z <= 12; z++) for (let y = 5; y <= 24; y++) world.put(x, y, z, y <= 9 ? 3 : 0, 0, false);
  for (const [x, y, z] of CELLS[scene]) world.put(x, y + 10, z, WATER, 0, false);
  world.spawn = () => ({ x: 2.5, y: 13, z: 4.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const p = sim.addPlayer("a", "Alex", "00000000-0000-0000-0000-000000000001");
  p.position.copy({ x: 2.5, y: 13 + f(ySize), z: 4.5 }); p.previous.copy(p.position);
  if (p.motion) p.motion.ySize = f(ySize);
  p.survival.mode = "survival"; p.survival.inventory.main.fill(null); p.survival.add(BOAT_ITEM, 2);
  return { sim, p, boats: () => sim.vehicles.boats.carts.filter((b) => !b.dead) };
}
// Radians whose float conversion in useHeld gives exactly the probe's degrees.
const yawRad = (deg) => { let r = (180 - deg) * Math.PI / 180; for (let i = 0; i < 64 && f(180 - r * 180 / Math.PI) !== deg; i++) r += (f(180 - r * 180 / Math.PI) > deg ? 1 : -1) * 2 ** -50; assert.equal(f(180 - r * 180 / Math.PI), deg); return r; };
const pitchRad = (deg) => { let r = -deg * Math.PI / 180; for (let i = 0; i < 64 && f(-r * 180 / Math.PI) !== deg; i++) r += (f(-r * 180 / Math.PI) > deg ? 1 : -1) * 2 ** -50; assert.equal(f(-r * 180 / Math.PI), deg); return r; };

test("server useHeld at the edge angles: the boat lands in the native cell on both sides of every window (and the miss takes no boat)", () => {
  for (const sc of ["x-edge", "z-edge", "miss-edge", "ysize-edge"]) {
    const edge = ref.cases.filter((c) => c.scene === sc);
    // the two records either side of the change
    const i = edge.findIndex((c, k) => k > 0 && JSON.stringify(c.boat) !== JSON.stringify(edge[k - 1].boat));
    for (const c of [edge[i - 1], edge[i]]) {
      const s = server(sc.split("-")[0], c.ySize);
      s.p.yaw = yawRad(f(c.yaw)); s.p.pitch = pitchRad(f(c.pitch));
      const used = s.sim.vehicles.useHeld(s.p, null), at = `${sc} pitch ${c.pitch} yaw ${c.yaw}`;
      assert.equal(!!used, !!c.boat, at);
      assert.equal(s.p.survival.held?.count ?? 0, c.count, at);
      const b = s.boats()[0];
      if (c.boat) assert.deepEqual([Math.floor(b.x), Math.floor(b.posY ?? b.y) - 10, Math.floor(b.z)], cellOf(c.boat), at);
      else assert.equal(b, undefined, at);
    }
  }
});

test("a dead player stays in the boat check through deathTime 20 and leaves it the tick after (sv.aF setDead, World.updateEntities' removal)", () => {
  assert.equal(playerListed({ dead: false }), true);
  assert.equal(playerListed({ dead: true, deathTime: 0 }), true);
  assert.equal(playerListed({ dead: true, deathTime: 20 }), true);
  assert.equal(playerListed({ dead: true, deathTime: 21 }), false);
  // the dedicated server: player b dies standing in the boat's box (the pond of boatcheck87, the boat at [12, 12.6] under a, who looks down)
  const world = new World("b88-dead");
  for (let x = 56; x <= 70; x++) for (let z = 56; z <= 70; z++) for (let y = 9; y <= 24; y++) world.put(x, y, z, y === 10 ? 3 : y === 11 ? WATER : 0, 0, false);
  world.spawn = () => ({ x: 63.5, y: 13, z: 63.5 });
  const sim = new DedicatedSimulation({}, { world, mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const a = sim.addPlayer("a", "Alex", "00000000-0000-0000-0000-000000000001"), b = sim.addPlayer("b", "Bo", "00000000-0000-0000-0000-000000000002");
  a.position.copy({ x: 63.5, y: 13, z: 63.5 }); a.previous.copy(a.position); a.yaw = 0; a.pitch = -Math.PI / 2;
  a.survival.mode = "survival"; a.survival.inventory.main.fill(null); a.survival.add(BOAT_ITEM, 4);
  b.position.copy({ x: 64.4, y: 12.3, z: 63.5 }); b.previous.copy(b.position);
  sim.serverSurvival.die(b);
  assert.equal(b.deathTime, 0);
  for (let t = 0; t < 20; t++) sim.serverSurvival.tickDeath(b);
  assert.equal(b.deathTime, 20);
  assert.equal(sim.vehicles.useHeld(a, null), false, "deathTime 20: still listed, the boat is refused");
  sim.serverSurvival.tickDeath(b);
  assert.equal(b.deathTime, 21);
  assert.equal(sim.vehicles.useHeld(a, null), true, "deathTime 21: removed, the boat is placed");
});

test("EntityEnderCrystal's box is centred on posY at every port site", () => {
  assert.deepEqual(crystalBox(5, 10, 7), [4, 9, 6, 6, 11, 8]);
  assert.equal(boatCrystalBox, crystalBox, "one definition");
  const crystal = { type: "ender_crystal", x: 5.5, y: 10, z: 5.5, health: 5 };
  // World.checkNoEntityCollision for block placement: the cell below posY is blocked, the cell from posY + 1 is not
  const blocker = placementEntityBlocker({ mobs: { entities: [crystal], size: () => [2, 2] } });
  assert.equal(blocker([5, 9, 5, 6, 10, 6]), true);
  assert.equal(blocker([5, 11, 5, 6, 12, 6]), false);
  // the dragon's crystal query (getEntitiesWithinAABB(EntityEnderCrystal))
  const host = dragonHost({ world: {}, entities: [crystal], events: [] }, { type: "ender_dragon", x: 0, y: 0, z: 0 });
  assert.equal(host.crystals([5, 8.5, 5, 6, 8.9, 6]).length, 0);
  assert.equal(host.crystals([5, 8.5, 5, 6, 9.1, 6]).length, 1);
  assert.equal(host.crystals([5, 11.1, 5, 6, 12, 6]).length, 0);
  // the crosshair ray: from below it meets the box at posY - 1
  const hit = entityHit({ x: 5.5, y: 5, z: 5.5 }, { x: 0, y: 1, z: 0 }, crystal, 10);
  assert.ok(Math.abs(hit - 4) < 1e-9, `hit at ${hit}`);
  // the projectiles' targets
  const t = mobTargets([crystal], null).find((r) => r.ref === crystal);
  assert.deepEqual(t.box, crystalBox(5.5, 10, 5.5));
  // the lightning bolt's box (EntityLightningBolt lists every entity; the crystal's Entity.onStruckByLightning deals 5 fire damage)
  const struck = [];
  strikeMobs({ entities: [{ ...crystal, y: 20.5 }], hazard: (e, d, kind) => struck.push([d, kind]) }, { x: 5.5, y: 11, z: 5.5 });
  assert.equal(struck.length, 1, "the box [19.5, 21.5] reaches the bolt's top at y + 9 = 20");
});

test("the server's vehicles: crystals block boats with their own box, carts pass through them, and nobody pushes them", () => {
  const sim = new DedicatedSimulation({}, { world: new World("b88-crystal-carts"), mobs: true, gameMode: "survival" });
  sim.mobs.mobs.entities.length = 0;
  const crystal = { type: "ender_crystal", x: 0.5, y: 70, z: 0.5, health: 5, vx: 0, vy: 0, vz: 0 };
  sim.mobs.mobs.entities.push(crystal);
  assert.deepEqual(sim.vehicles.boxesOfMobs().map((b) => b.bb), [crystalBox(0.5, 70, 0.5)]);
  // the boat check's own crystal row (boatcheck87) uses the same box
  assert.deepEqual(boatPlaceEntities({ mobs: { entities: [crystal], size: () => [2, 2] } })[0].bb, crystalBox(0.5, 70, 0.5));
  const src = readFileSync(new URL("./multiplayer/server-vehicles.js", import.meta.url), "utf8");
  assert.match(src, /this\.carts\.tick\(world, \{ entities: \[\.\.\.blockers\.filter\(b => b\.ref\?\.type !== 'ender_crystal'\)/);
  assert.match(src, /if \(b\.ref\.type === 'ender_crystal'\) continue;/);
});

test("source pins: the other crystal sites and the server's ray", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(read("./structure-simulation.js"), /const cartBlockers = \(list\) => list\.filter\(\(b\) => b\.ref\?\.type !== "ender_crystal"\);/);
  assert.match(read("./structure-simulation.js"), /if \(e\.type === "ender_crystal"\) return crystalBox\(e\.x, e\.y, e\.z\); const \[w, h\] = mobs\.size\(e\);/);
  assert.match(read("./piston-push.js"), /\.\.\.\(boat \? \[\.\.\.looseBoxes\(\), \.\.\.hangBoxes\(\), \.\.\.crystalBoxes\(\)\] : \[\]\)/);
  assert.match(read("./piston-live.js"), /box: e\.type === "ender_crystal" \? crystalBox\(e\.x, e\.y, e\.z\) : pushBox\(e, width, height\)/);
  assert.match(read("./witch-potions.js"), /if \(e\.type === "ender_crystal"\) continue; \/\/ b88 boatray88: EntityPotion\.onImpact/);
  assert.match(read("./redstone-runtime.js"), /if \(e\.type === "ender_crystal"\) \{ if \(mode === "all" && !collider && inside\(crystalBox\(e\.x, e\.y, e\.z\), box\)\) out\.push\(e\); continue; \}/);
  const ents = read("./entities.js");
  assert.match(ents, /if \(o\.type === "ender_crystal"\) return crystalBox\(o\.x, o\.y, o\.z\); const s = this\.size\(o\);/);
  assert.match(ents, /o\.type === "ender_crystal" \? boxesIntersect\(box, crystalBox\(o\.x, o\.y, o\.z\)\) : meets\(o, s\.width \/ 2, s\.height\)/);
  const main = read("./main.js");
  assert.match(main, /if \(live\.type === "ender_crystal"\) \{ out\.push\(\{ ref: c, box: crystalBox\(c\.x, c\.y, c\.z\) \}\); continue; \}/);
  assert.match(main, /if \(mob\.type === "ender_crystal"\) \{ out\.push\(\{ ref: c, box: crystalBox\(c\.x, c\.y, c\.z\) \}\); continue; \}/);
  assert.match(main, /intersects\(e\.type==="ender_crystal"\?crystalBox\(e\.x,e\.y,e\.z\):pushBox\(e,size\.width,size\.height\)\)/);
  assert.match(main, /setEntityBoxes\(clientBoatBoxProvider\(\(\) => objectTracker\.vehicleTargets\(\)\.filter\(\(t\) => t\.kind === "boat"\)\.map\(\(t\) => t\.box\), boatBoxProvider/);
  const sv = read("./multiplayer/server-vehicles.js");
  assert.match(sv, /boatRay\(pos, p\.motion\?\.ySize \?\? 0, f\(180 - p\.yaw \* 180 \/ Math\.PI\), f\(-p\.pitch \* 180 \/ Math\.PI\), 0\)/);
  assert.ok(!/Math\.(sin|cos)\(/.test(sv.slice(sv.indexOf("useHeld("), sv.indexOf("boatEntities(p) {"))), "no double trig in useHeld");
});

test("the client player collides with the boat copies, every other mover with the live boats", () => {
  const live = [{ bb: [0, 0, 0, 1.5, 0.6, 1.5], dead: false }], copy = [0, -0.2, 0, 1.5, 0.4, 1.5];
  const provider = clientBoatBoxProvider(() => [copy], boatBoxProvider({ carts: live }));
  const q = [0.2, 0.3, 0.2, 0.8, 2, 0.8];
  assert.deepEqual(provider(q, { clientPlayer: true }), [copy]);
  assert.deepEqual(provider(q, { type: "cow" }), [live[0].bb]);
  assert.deepEqual(provider([0.2, 0.5, 0.2, 0.8, 2, 0.8], { clientPlayer: true }), [], "above the copy: nothing");
  assert.match(readFileSync(new URL("./player-physics.js", import.meta.url), "utf8"), /clientPlayer: true, \/\/ b88 boatray88/);
});

// spcopy88's harness: the client steps onto a floating boat and jumps on it for 200 ticks; the integrated server's copy (EntityWorld ai.player) checks every move.
function bobRun(copies) {
  const world = new World(`b88-bob-${copies}`);
  for (let x = 30; x <= 50; x++) for (let z = 26; z <= 54; z++) for (let y = 9; y <= 40; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  for (let x = 36; x <= 44; x++) for (let z = 26; z <= 54; z++) world.put(x, 10, z, z <= 46 ? WATER : 1, 0, false);
  const w = new EntityWorld(world, [], () => 0.5), s = new Survival({}), fixes = [];
  w.serverCorrect = (to) => fixes.push({ ...to });
  const state = { world, position: vector(40.5, 11, 47.4), previous: vector(40.5, 11, 47.4), velocity: vector(0, 0, 0), motion: new PlayerMotion(), grounded: true, collidedH: false, flying: false, fallDistance: 0, landedFall: 0, yaw: 0, survival: s, eating: null };
  const boats = new Boats(), tracker = new ObjectTracker(10, () => 0.5);
  const boat = boats.spawnBoat({ x: 40.5, y: 10.4, z: 45.9 }, { seed: 5 });
  const track = () => tracker.update({ boat: boats.carts }, { x: state.position.x, y: state.position.y, z: state.position.z }, world);
  for (let i = 0; i < 400; i++) { boats.tick(world, {}); track(); }
  const live = boatBoxProvider(boats);
  setEntityBoxes(copies ? clientBoatBoxProvider(() => tracker.vehicleTargets().filter((t) => t.kind === "boat").map((t) => t.box), live) : live);
  const p = w.ai.player, body = { alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
  let lo = Infinity, hi = -Infinity;
  try {
    for (let i = 0; i < 200; i++) {
      const c = { forward: i < 7 ? 1 : 0, strafe: 0, sneak: false, sprint: false, jump: i === 1 || (i > 20 && i % 25 === 0) };
      const r = movePlayer(state, c);
      finishPlayerMovement(state, { inWater: r.inWater, inLavaNow: r.inLavaNow, oldPosition: r.oldPosition });
      boats.tick(world, {}); track();
      Object.assign(p, { sneaking: false, flying: false, riding: false, packetGround: !!state.grounded, sprinting: false, yaw: 0 });
      const before = fixes.length;
      w.tick({ ...body, x: state.position.x, y: state.position.y, z: state.position.z }, s);
      if (fixes.length > before) { Object.assign(state.position, fixes.at(-1)); Object.assign(state.previous, fixes.at(-1)); }
      if (i > 40) { lo = Math.min(lo, boat.bb[4]); hi = Math.max(hi, boat.bb[4]); }
    }
  } finally { setEntityBoxes(null); }
  return { bob: hi - lo, corrected: p.corrected ?? 0 };
}

test("standing on a floating boat: the client on its tracked copy is corrected far less than on the live, bobbing boat", (t) => {
  const live = bobRun(false), copies = bobRun(true);
  assert.ok(live.bob > 0.005 && live.bob < 0.0625, `the live boat bobbed (${live.bob})`);
  assert.ok(live.corrected > 100, `the shared live boat: ${live.corrected} corrections`);
  assert.ok(copies.corrected <= 10, `the copies: ${copies.corrected} corrections`);
  t.diagnostic(`corrections in 200 ticks: live ${live.corrected}, copies ${copies.corrected} (the copy coasts on its last S12 between the tracker's 60-tick moves, so it can sit below the live boat)`);
});
