// Batch 71 mpreach71: pvp reach from posY, vehicle posY reach, hoppers in the away run find carts, the minecart tracker cadence on the dedicated server.
// Facts: .shared-memory/notes/mpreach71-b71-track.md. No browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World } from "./world.js";
import { populationBlockMapperReady } from "./population-world.js";
import { runAway, stateColumns, awayPlan } from "./away-world.js";
import { Minecarts } from "./minecarts.js";
import { Boats } from "./boats.js";
import { ServerPvp } from "./multiplayer/server-pvp.js";
import { CartTracker } from "./multiplayer/server-cart-track.js";
import { ServerVehicles, vehicleState } from "./multiplayer/server-vehicles.js";
import { RemoteVehicles } from "./multiplayer/remote-vehicles.js";

await populationBlockMapperReady;

// ---- (1) server-pvp inReach from posY ----
test("pvp inReach: a sleeper's posY is minY + 0.2 on either side of the distance", () => {
  const world = new World("b71-pvp");
  for (let x = 0; x <= 30; x++) for (let z = 0; z <= 30; z++) for (let y = 0; y <= 20; y++) world.put(x, y, z, y === 0 ? 3 : 0, 0, false);
  const pvp = new ServerPvp({});
  const mk = (x, y, z, sleeping = false) => ({ world, position: { x, y, z }, dimension: 0, sleeping, dead: false, survival: { health: 20 } });
  const a = mk(5.5, 1, 5.5);
  // target 5.95 above: standing 5.95^2 = 35.4 < 36 in reach; the sleeper attacker's posY is 1.2, so 5.75 above: even closer
  assert.equal(pvp.inReach(a, mk(5.5, 1 + 5.95, 5.5)), true);
  assert.equal(pvp.inReach(a, mk(5.5, 1 + 6.05, 5.5)), false);
  const lying = mk(5.5, 1, 5.5, true);
  assert.equal(pvp.inReach(lying, mk(5.5, 1 + 6.05, 5.5)), true, "6.05 above minY is 5.85 above posY: 34.2 < 36");
  assert.equal(pvp.inReach(a, mk(5.5, 1 + 5.85, 5.5)), true, "a standing victim 5.85 above: in reach");
  assert.equal(pvp.inReach(a, mk(5.5, 1 + 5.85, 5.5, true)), false, "a sleeping victim's posY is 0.2 higher: 6.05 apart, 36.6");
  assert.equal(pvp.inReach(lying, mk(5.5, 1 + 6.25, 5.5)), false, "6.05 from posY: 36.6");
});

// ---- (2) vehicle posY for the click reach ----
test("boat and cart posY: the box bottom is posY - yOffset (height / 2, ySize 0), so the old box centre equalled posY", () => {
  const carts = new Minecarts(), boats = new Boats();
  const c = carts.spawnEmpty({ x: 5.5, y: 3, z: 5.5 }), b = boats.spawnBoat({ x: 5.5, y: 3, z: 5.5, yaw: 0 });
  assert.ok(Math.abs(c.posY - c.bb[1] - Math.fround(Math.fround(0.7) / 2)) < 1e-6, "cart yOffset 0.35");
  assert.ok(Math.abs(b.posY - b.bb[1] - Math.fround(Math.fround(0.6) / 2)) < 1e-6, "boat yOffset 0.3");
  assert.ok(Math.abs(c.posY - (c.bb[1] + c.bb[4]) / 2) < 1e-6 && Math.abs(b.posY - (b.bb[1] + b.bb[4]) / 2) < 1e-6);
});

// ---- (3) away-run block hoppers find chest carts ----
const STONE = 3, HOPPER = 133;
const floorChunks = (cols) => cols.map(([x, z]) => {
  const blocks = new Uint8Array(65536), meta = new Uint8Array(65536);
  for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) for (let y = 0; y <= 10; y++) blocks[(lx * 16 + lz) * 256 + y] = STONE;
  return { x, z, blocks, meta };
});
const setBlock = (chunks, x, y, z, b) => { const c = chunks.find((k) => k.x === x >> 4 && k.z === z >> 4); c.blocks[((x & 15) * 16 + (z & 15)) * 256 + y] = b; };
const base = { seed: "away", biome: "javaStreamed", worldType: "flat", worldSpawn: [0, 64, 0], player: { time: 6000 } };
test("an away-run hopper pushes into a chest minecart in the cell below (cartAt)", async () => {
  const carts = new Minecarts(); carts.spawnCart(1, { x: 5.5, y: 11, z: 5.5, items: [] });
  const hopper = { items: [{ id: 4, count: 3, damage: 0 }, null, null, null, null], cooldown: 0, name: null };
  const root = { ...base, minecarts: carts.toJSON(), player: { time: 6000, hoppers: { "5,12,5": hopper } } };
  const cols = stateColumns(root), plan = { ...awayPlan(root, cols, 40, 2), chunks: floorChunks(cols), records: [] };
  setBlock(plan.chunks, 5, 12, 5, HOPPER);
  const r = await runAway(plan);
  const cart = r.entities.minecarts.carts[0], held = (cart.items ?? []).filter(Boolean).reduce((n, s) => n + s.count, 0);
  assert.ok(held > 0, `the cart received items (${JSON.stringify(cart.items?.filter(Boolean))})`);
});

// ---- (4) the minecart tracker cadence, replayed against the executed EntityTrackerEntry (tracker-vehicles-reference.json) ----
const ref = JSON.parse(readFileSync(new URL("../public/research/tracker-vehicles-reference.json", import.meta.url)));
const POSITION = new Set(["S14", "S15", "S16", "S17", "S18"]);
for (const name of ["cart0", "cart1", "cart3", "cartTeleport", "cartPush"]) {
  test(`cart tracker releases a position on exactly the ticks the executed entry sends one (${name})`, () => {
    const rec = ref[name], want = rec.rows.filter(([, ps]) => ps.some((p) => POSITION.has(p[0]))).map(([t]) => t), got = [];
    const tracker = new CartTracker(), cart = { id: 1, x: 0, posY: 0, z: 0, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0 };
    rec.inputs.forEach((inp, t) => {
      Object.assign(cart, { x: inp[0], posY: inp[1], z: inp[2], vx: inp[3], vy: inp[4], vz: inp[5], yaw: inp[6], pitch: inp[7], airBorne: name === "cartPush" && t === 4 /* the probe's addVelocity (e.g(0.12, 0, 0.05)) at tick 4: isAirBorne is not in the inputs */, velocityChanged: inp[9] === 1 /* setBeenAttacked at tick 8 */ });
      tracker.tick(cart, { x: cart.x, y: cart.posY, z: cart.z, yaw: cart.yaw, pitch: cart.pitch });
      if (tracker.entries.get(cart).released) got.push(t);
    });
    assert.ok(want.length > 0, "the reference sends positions");
    assert.deepEqual(got, want);
  });
}

// ---- (5) the dedicated server sends a moving cart at that cadence; the client takes it at once ----
test("ServerVehicles.track releases a creeping cart every 3 ticks with a 4/32 step, and data changes at once as cartMeta", () => {
  const host = { players: new Map([["a", { position: { x: 0, y: 0, z: 0 } }]]), rules: {} };
  const sv = Object.create(ServerVehicles.prototype);
  const cart = { id: 7, x: 5, posY: 1, z: 5, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, type: 0, rolling: 0, rollingDir: 1, damage: 0, dead: false };
  Object.assign(sv, { host, views: new Map([["a", { known: new Map() }]]), carts: { carts: [cart], reap() {} }, boats: { carts: [], reap() {} }, hanging: { track: () => [] } });
  const sent = [];
  for (let t = 0; t < 40; t++) {
    cart.x += 0.02; // 0.64 block per 32 ticks: far under 4/32 per 3 ticks, so only the 4/32 step releases
    if (t === 20) cart.damage = 5;
    sv.track();
    const m = host.players.get("a").vehPackets; host.players.get("a").vehPackets = null;
    if (m?.set) sent.push([t, m.set[0].x, !!m.set[0].cartMeta, m.cartCadence]);
  }
  assert.equal(sent[0][0], 0, "the spawn goes out at once");
  const moves = sent.filter((s) => !s[2]);
  assert.ok(moves.length < 40 / 3, `fewer states than ticks: ${moves.length}`);
  for (const [t] of moves.slice(1)) assert.equal(t % 3, 0, `a released position is on a multiple of 3 (tick ${t})`);
  const meta = sent.find((s) => s[2]);
  assert.ok(meta && meta[0] === 20 && meta[3] === true, "damage went out at its own tick with cartMeta");
  assert.equal(meta[1], moves.filter(([t]) => t < 20).at(-1)[1], "cartMeta carries the position last released");
});

test("RemoteVehicles: a cartCadence state is taken at once, a cartMeta state does not re-aim", () => {
  const rv = new RemoteVehicles(null);
  const st = (x, extra = {}) => ({ v: "c1", x, y: 1, z: 5, yaw: 0, pitch: 0, t: 0, rl: 0, rd: 1, dm: 0, ...extra });
  rv.apply({ type: "vehicles", set: [st(5)], cartCadence: true });
  rv.tick();
  rv.apply({ type: "vehicles", set: [st(6)], cartCadence: true });
  const c = rv.copies.get("c1");
  assert.equal(c.pending?.x, 6);
  c.since = 0; rv.apply({ type: "vehicles", set: [st(7)], cartCadence: true });
  rv.tick();
  assert.equal(c.turn, 4, "turn started at 5 on the very next tick: no 3 tick wait");
  const before = c.turn;
  rv.apply({ type: "vehicles", set: [st(7, { dm: 3, cartMeta: 1 })], cartCadence: true });
  assert.equal(c.pending, null, "cartMeta sets no pending position");
  assert.equal(c.v.damage, 3);
  assert.equal(c.turn, before);
});
