// Batch 91 mpperf91: the S20 change test of a plain mob skips building rows (MC_MPPERF91). Results must not change: the packets a scripted mob sends are the same
// off / on / verify, through every change the quick test has to notice (a max health edit, a potion, a stored modifier, a baby flag, a bump, a type that is never plain).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { addMobEffect } from "./mob-effects.js";
import { fast91, plainAttrs91, newQuick91 } from "./mpperf91-fast.js";
import * as watched from "./mob-tracked-attributes.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("mpperf91");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}
// b91 lead: every Entity.rand and the server's seeded randoms come from Math.random, so the three runs must share one seeded stream; otherwise a zombie's random jump
// (isAirBorne opens the tracker's gated branch) moves an S20 by a tick between modes (seen once in the full run).
const seededMath = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
function script(mode) {
  const was = fast91.mode, rnd = Math.random; fast91.mode = mode; Math.random = seededMath(9101);
  try {
    const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
    s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
    const p = s.addPlayer("p", "px", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("p", input());
    const ms = ["pig", "cow", "zombie", "sheep", "enderman", "wolf"].map((t, i) => { const m = s.mobs.mobs.create(t, 62.5 + i * 2, 10, 70.5); s.mobs.mobs.entities.push(m); return m; });
    const [pig, cow, zombie, , , wolf] = ms, out = [];
    const edits = {
      20: () => { pig.maxHealth = 30; },
      30: () => addMobEffect(cow, 1, 600, 1),
      40: () => { zombie.growingAge = -24000; },
      50: () => { pig.modifiers = [{ attribute: "generic.movementSpeed", name: "x", amount: 0.5, operation: 1, uuid: "11111111-1111-1111-1111-111111111111" }]; },
      60: () => { pig.modifiers = []; },
      70: () => { cow.effects = []; },
      80: () => { cow.attrBumps = { "generic.movementSpeed": 1 }; },
      90: () => { pig.maxHealth = 30; zombie.growingAge = 0; wolf.owner = "p"; },
    };
    for (let t = 0; t < 120; t++) {
      edits[t]?.();
      s.tick();
      out.push(JSON.stringify((p.mobPackets ?? []).filter((x) => x.type === "attributes")));
      p.mobPackets = null; p.chunkOut = null;
    }
    return out;
  } finally { fast91.mode = was; Math.random = rnd; }
}

test("scripted S20 packets are identical off / on / verify and the script does send some", () => {
  const off = script("off");
  assert.deepEqual(script("on"), off);
  assert.deepEqual(script("verify"), off);
  assert.ok(off.filter((x) => x !== "[]").length >= 5, "the script sends several S20 packets");
});

test("plainAttrs91 is false for anything watchedAttributes folds more into", () => {
  const q = newQuick91();
  assert.equal(plainAttrs91({ type: "pig" }, q), true);
  for (const e of [{ type: "horse" }, { type: "wolf" }, { type: "slime" }, { type: "pig", effects: [{ id: 1 }] }, { type: "pig", modifiers: [{}] }, { type: "pig", attributeBases: {} },
    { type: "zombie", growingAge: -1 }, { type: "enderman", speedBoost: true }, { type: "ender_crystal" }, { type: "pig", attrBumps: {} }, { type: "nope" }]) assert.equal(plainAttrs91(e, q), false, e.type);
  for (const type of ["pig", "cow", "sheep", "chicken", "creeper", "skeleton", "spider", "villager", "zombie"]) {
    const e = { type }, rows = watched.watchedAttributes(e);
    assert.equal(plainAttrs91(e, q), true);
    assert.ok(Object.is(rows[0].value, q.hb) && Object.is(rows[1].value, q.sv) && Object.is(rows[1].base, q.sb) && rows.length === 2, type);
  }
});

test("seeded bench scenes hash the same off / on / verify", () => {
  const hash = (m, scene) => spawnSync(process.execPath, ["tools/bench-alloc81.mjs", `--scene=${scene}`, "--state", "--ticks=100", "--mobs=70"], { env: { ...process.env, MC_MPPERF91: m }, encoding: "utf8" }).stdout.trim().split("mobs=").pop();
  for (const scene of ["pen", "travel"]) {
    const off = hash("off", scene);
    assert.match(off, /^\d+ \[/);
    assert.equal(hash("on", scene), off);
    assert.equal(hash("verify", scene), off);
  }
});
