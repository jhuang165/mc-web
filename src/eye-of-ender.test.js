import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import {
  DIRECTION, hasEye, createEye, moveTowards, tickEye, shatterEffects, portalInterior, useEyeOnFrame, nearestStronghold,
  END_PORTAL, END_PORTAL_FRAME, END_PORTAL_BOUNDS, END_PORTAL_LIGHT, ITEM_EYE_OF_ENDER,
} from "./eye-of-ender.js";

const ref = JSON.parse(await readFile(new URL("../public/research/eye-of-ender-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const one = (c) => by(c)[0];

class Grid {
  constructor() { this.cells = new Map(); }
  key(x, y, z) { return `${x},${y},${z}`; }
  get(x, y, z) { return this.cells.get(this.key(x, y, z))?.[0] ?? 0; }
  getMeta(x, y, z) { return this.cells.get(this.key(x, y, z))?.[1] ?? 0; }
  put(x, y, z, id, meta = 0) { this.cells.set(this.key(x, y, z), [id, meta]); }
}
const ringCells = (cx, cz) => {
  const r = [];
  for (let i = 0; i < 3; i++) r[i] = [cx - 1 + i, cz - 2], r[3 + i] = [cx - 1 + i, cz + 2], r[6 + i] = [cx - 2, cz - 1 + i], r[9 + i] = [cx + 2, cz - 1 + i];
  return r;
};
const FRAME = END_PORTAL_FRAME;
function useAt(grid, x, y, z, seed = 1, remote = false) {
  const log = [];
  const result = useEyeOnFrame(grid, x, y, z, {
    remote,
    setMeta: (px, py, pz, meta) => { grid.put(px, py, pz, grid.get(px, py, pz), meta); log.push(`meta|${px},${py},${pz}|${meta}`); },
    set: (px, py, pz, id) => { grid.put(px, py, pz, id, 0); log.push(`set|${px},${py},${pz}`); },
    particle: (name, px, py, pz) => log.push(["particle", name, px, py, pz]),
  }, new JavaRandom(seed));
  return { result, log };
}
const portals = (grid, cx, cy, cz) => { let n = 0; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (grid.get(cx + dx, cy, cz + dz) === END_PORTAL) n++; return n; };

test("original constants: direction table, eye bit, portal block facts", () => {
  const d = one("direction");
  assert.deepEqual(DIRECTION, { offsetX: d.offsetX, offsetZ: d.offsetZ, rotateRight: d.rotateRight });
  const facts = one("facts");
  assert.deepEqual([...Array(16).keys()].map(hasEye), facts.frameEyeBit);
  assert.equal(facts.portal.light, END_PORTAL_LIGHT);
  assert.equal(facts.portal.opaque, false);
  assert.equal(facts.portal.normal, false);
  assert.equal(facts.portal.renderType, -1);
  assert.equal(facts.portalHardness, -1);
  assert.equal(facts.portalResistance, 18000000);
  assert.equal(facts.portalQuantity, 0);
  assert.equal(facts.item.maxStack, 64);
  assert.equal(facts.eye.width, 0.25);
  assert.equal(facts.eye.yOffset, 0);
  assert.equal(facts.eye.shadowSize, 0);
  assert.deepEqual(END_PORTAL_BOUNDS, [0, 0, 0, 1, 1 / 16, 1]);
  assert.equal(ITEM_EYE_OF_ENDER, 1960);
});

test("moveTowards and the 81-tick flight match EntityEnderEye for every probed start and target", () => {
  const flights = by("flight");
  assert.equal(flights.length, 11);
  for (const rec of flights) {
    const random = new JavaRandom(rec.seed), eye = createEye(...rec.from);
    moveTowards(eye, rec.to[0], rec.to[1], rec.to[2], random);
    assert.deepEqual([eye.tx, eye.ty, eye.tz], rec.start.target, rec.name);
    assert.equal(eye.drops, rec.start.drops, rec.name);
    const events = [];
    for (let t = 0; t < rec.ticks; t++) {
      const step = tickEye(eye, random);
      const row = rec.rows[t], label = `${rec.name} tick ${t + 1}`;
      // The probe prints the float fields (yaw, pitch and their previous values) with Float.toString. Java's Math.sin/cos
      // intrinsics and V8's fdlibm differ in the last bit, so doubles agree to 1e-9 relative, rotations to 1e-3 degrees.
      const got = [eye.x, eye.y, eye.z, eye.vx, eye.vy, eye.vz, eye.yaw, eye.pitch, eye.prevYaw, eye.prevPitch, eye.age, eye.dead ? 1 : 0];
      got.forEach((v, i) => {
        const tolerance = i >= 6 && i <= 9 ? 1e-3 : i >= 10 ? 0 : 1e-9 * Math.max(1, Math.abs(row[i]));
        assert.ok(Math.abs(v - row[i]) <= tolerance, `${label} field ${i}: ${v} vs ${row[i]}`);
      });
      const p = step.particles[0];
      [p.x, p.y, p.z, p.vx, p.vy, p.vz].forEach((v, i) => assert.ok(Math.abs(v - rec.particles[t][i]) <= 1e-9 * Math.max(1, Math.abs(v)), `${label} particle ${i}`));
      if (step.end) {
        const e = step.end;
        events.push(e.drop ? "drop" : `aux|2003,${e.shatter.x},${e.shatter.y},${e.shatter.z},0`);
      }
    }
    assert.equal(eye.dead, true);
    assert.deepEqual(events, rec.events.map((e) => (e.startsWith("spawn|xk") ? "drop" : e)), rec.name);
  }
});

test("the 80% survive roll is the first Entity.rand draw", () => {
  const rec = one("dropRoll");
  let bits = "", survive = 0;
  for (let seed = 0; seed < rec.seeds; seed++) {
    const eye = createEye(0, 64, 0);
    moveTowards(eye, 50, 64, 0, new JavaRandom(seed));
    bits += eye.drops ? "1" : "0";
    if (eye.drops) survive++;
  }
  assert.equal(bits, rec.bits);
  assert.equal(survive, rec.survive);
});

test("ring check: all 256 facing assignments by 12 last frames fill exactly as ItemEnderEye.onItemUse", () => {
  const cx = 10, cy = 40, cz = 20, ring = ringCells(cx, cz);
  for (const rec of by("ring")) {
    let bits = "";
    for (let last = 0; last < 12; last++) {
      const grid = new Grid();
      for (let i = 0; i < 12; i++) grid.put(ring[i][0], cy, ring[i][1], FRAME, rec.facing[Math.floor(i / 3)] + (i === last ? 0 : 4));
      const { result } = useAt(grid, ring[last][0], cy, ring[last][1]);
      const n = portals(grid, cx, cy, cz);
      bits += result ? (n === 9 ? "9" : n === 0 ? "1" : "x") : "0";
    }
    assert.equal(bits, rec.outcome, JSON.stringify(rec.facing));
  }
  assert.deepEqual(one("ringValid").full, [120]);
});

test("ring check with random eye masks: the portal forms only when all twelve frames have eyes", () => {
  const rec = one("ringMask"), cx = 10, cy = 40, cz = 20, ring = ringCells(cx, cz);
  for (const [mask, last, used, count] of rec.rows) {
    const grid = new Grid();
    for (let i = 0; i < 12; i++) grid.put(ring[i][0], cy, ring[i][1], FRAME, rec.facing[Math.floor(i / 3)] + ((mask >> i) & 1 ? 4 : 0));
    const { result } = useAt(grid, ring[last][0], cy, ring[last][1]);
    assert.equal(result ? 1 : 0, used);
    assert.equal(portals(grid, cx, cy, cz), count, `mask ${mask} last ${last}`);
  }
});

test("onItemUse scenarios: eye bit, particle draws, broken rings and non-frames", () => {
  const cx = 10, cy = 40, cz = 20, ring = ringCells(cx, cz), facing = [0, 2, 3, 1];
  for (const rec of by("use")) {
    if (!rec.creative && !rec.remote && ["stone", "air"].includes(rec.name)) continue;
    const grid = new Grid(), last = 4;
    let x = 0, y = 64, z = 0;
    if (rec.name.startsWith("lone-frame")) grid.put(0, 64, 0, FRAME, rec.name === "lone-frame-meta-3" ? 3 : 2);
    else if (rec.name === "eye-already" || ["missing-north-middle", "stone-in-ring", "interior-stone", "ring-one-higher", "full-valid"].includes(rec.name)) {
      for (let i = 0; i < 12; i++) grid.put(ring[i][0], cy, ring[i][1], FRAME, facing[Math.floor(i / 3)] + (i === last ? 0 : 4));
      if (rec.name === "missing-north-middle") grid.cells.delete(grid.key(ring[1][0], cy, ring[1][1]));
      if (rec.name === "stone-in-ring") grid.put(ring[8][0], cy, ring[8][1], 1);
      if (rec.name === "interior-stone") grid.put(cx, cy, cz, 1);
      if (rec.name === "ring-one-higher") { grid.put(ring[10][0], cy + 1, ring[10][1], FRAME, facing[3] + 4); grid.cells.delete(grid.key(ring[10][0], cy, ring[10][1])); }
      if (rec.name === "eye-already") grid.put(ring[last][0], cy, ring[last][1], FRAME, facing[1] + 4);
      [x, y, z] = [ring[last][0], cy, ring[last][1]];
    } else continue;
    const seed = rec.name.startsWith("lone-frame") ? 5 : 11;
    const { result, log } = useAt(grid, x, y, z, seed, rec.remote);
    assert.equal(!!result, rec.used, rec.name);
    assert.equal(grid.getMeta(x, y, z), rec.meta, rec.name);
    const filled = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (grid.get(cx + dx, y, cz + dz) === END_PORTAL) filled.push([cx + dx, y, cz + dz]);
    assert.deepEqual(filled, rec.filled, rec.name);
    // The 16 smoke particles come from Item.itemRand: probe events list them as float values.
    const smoke = rec.events.filter((e) => e.startsWith("particle|smoke"));
    const mine = log.filter((e) => Array.isArray(e));
    assert.equal(mine.length, smoke.length, rec.name);
    smoke.forEach((e, i) => {
      const [, , pos] = e.split("|"), [px, py, pz] = pos.split(",").map(Number);
      assert.deepEqual([mine[i][2], mine[i][3], mine[i][4]], [px, py, pz], `${rec.name} particle ${i}`);
    });
  }
});

test("a stone or air target is not a frame", () => {
  const grid = new Grid();
  grid.put(0, 64, 0, 1);
  assert.equal(useEyeOnFrame(grid, 0, 64, 0, {}, new JavaRandom(1)), null);
  assert.equal(useEyeOnFrame(grid, 5, 64, 5, {}, new JavaRandom(1)), null);
});

test("stronghold target is the nearest coord-list entry by squared integer distance", () => {
  assert.equal(nearestStronghold([], 0, 64, 0), null);
  assert.deepEqual(nearestStronghold([[100, 0], [3, 4]], 0, 64, 0), [56, 64, 72]);
  // A tie keeps the first entry (strict <).
  assert.deepEqual(nearestStronghold([[-3, 0], [3, 0]], 8, 64, 8), [-40, 64, 8]);
  assert.deepEqual(nearestStronghold([[3, 0], [-3, 0]], 8, 64, 8), [56, 64, 8]);
  // The y difference counts (all coord-list entries are at y 64).
  assert.deepEqual(nearestStronghold([[0, 0], [1, 0]], 24, 200, 8), [24, 64, 8]);
  // The right-click records use the stub stronghold (1224, 64, -312) whatever the position; the flight target is derived from it.
  const click = by("rightClick").find((r) => r.name === "survival-miss");
  const eye = createEye(...click.eye.pos);
  moveTowards(eye, 1224, 64, -312, new JavaRandom(0));
  assert.deepEqual([eye.tx, eye.ty, eye.tz], click.eye.target);
});

test("shatter effects: 8 eye particles then 2 rings of 40 portal particles (RenderGlobal 2003, bytecode-derived)", () => {
  const effects = shatterEffects(12, 74, 0, new JavaRandom(1));
  assert.equal(effects.filter((e) => e.name.startsWith("iconcrack_")).length, 8);
  assert.equal(effects.filter((e) => e.name === "portal").length, 80);
  assert.equal(effects[0].name, "iconcrack_1960");
  assert.deepEqual([effects[8].x, effects[8].y, effects[8].z], [17.5, 73.6, 0.5]);
});

test("right-click records: frame, creative and remote rules documented by the probe", () => {
  const rc = Object.fromEntries(by("rightClick").map((r) => [r.name, r]));
  assert.equal(rc["survival-miss"].count, 4);
  assert.equal(rc["creative-miss"].count, 5);
  assert.equal(rc.remote.eye, null);
  assert.equal(rc["no-stronghold"].eye, null);
  assert.equal(rc["no-stronghold"].count, 5);
  assert.equal(rc["ray-frame"].eye, null);
  assert.ok(rc["survival-miss"].events.includes("auxPlayer|1002,2,64,-3,0"));
  assert.ok(rc["survival-miss"].events.some((e) => e.startsWith("sound|random.bow|0.5|")));
});

test("end portal block records: render sides, collision, onBlockAdded", () => {
  assert.deepEqual(one("portalSide").rows.filter((r) => r[2]).map((r) => [r[0], r[1]]), [[0, 0]]);
  assert.deepEqual(one("portalCollide").entity, ["free:travel|1", "riding:none", "ridden:none", "remote:none"]);
  assert.equal(one("portalCollide").collisionBoxes, 0);
  assert.deepEqual(one("portalAdded").rows, ["dimension=0,flag=false:none", "dimension=0,flag=true:none", "dimension=1,flag=false:setAir|5,5,5", "dimension=1,flag=true:none"]);
  assert.equal(by("portalDisplay").length, 3);
});

test("probe references the unchanged client JAR", () => {
  assert.equal(ref.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.equal(Object.keys(ref.classes).length, 11);
});
