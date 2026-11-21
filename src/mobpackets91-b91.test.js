// Batch 91 mobpackets91: (1) watcher 8 (potion ambient flag) travels in S1C / S0F with the potion colour (bytecode-read sv.bo: aen.b = every effect ambient, 0 without effects);
// (2) a mob spawned in an entity's turn is updated in the same pass (World.spawnEntityInWorld adds to loadedEntityList at once, updateEntities walks it by index).
import test from "node:test";
import assert from "node:assert/strict";
import { copyMetaOf, copyMetaDiff } from "./copy-meta.js";
import { fast85 } from "./mpperf85-fast.js";
import { World } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";

const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
function flat() {
  const w = new World("mobpackets91");
  for (let x = 20; x <= 110; x++) for (let z = 20; z <= 110; z++) for (let y = 9; y <= 24; y++) w.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  w.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return w;
}

test("ambient is watched: all effects ambient, none otherwise, and it is diffed in every mode", () => {
  const mob = (effects) => ({ type: "pig", health: 10, effects });
  assert.equal(copyMetaOf(mob(undefined)).ambient, false);
  assert.equal(copyMetaOf(mob([{ id: 1, amplifier: 0, duration: 9, ambient: true }])).ambient, true);
  assert.equal(copyMetaOf(mob([{ id: 1, amplifier: 0, duration: 9, ambient: true }, { id: 3, amplifier: 0, duration: 9 }])).ambient, false);
  const real = fast85.mode;
  try {
    for (const mode of ["off", "on", "verify"]) {
      fast85.mode = mode;
      const e = mob(undefined), last = copyMetaOf(e);
      e.effects = [{ id: 1, amplifier: 0, duration: 9, ambient: true }];
      const d = copyMetaDiff(last, e);
      assert.equal(d.ambient, true, mode);
      assert.equal(copyMetaDiff(last, e), null, mode);
      delete e.effects[0].ambient;
      assert.deepEqual(copyMetaDiff(last, e), { ambient: false }, mode);
      e.effects = [];
      assert.deepEqual(copyMetaDiff(last, e), { potion: 0 }, mode);
    }
  } finally { fast85.mode = real; }
});

test("a mob spawned in an entity's turn is updated in the same pass", { timeout: 180000 }, () => {
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("p", "px", key(1)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("p", input());
  const ew = s.mobs.mobs;
  const a = ew.create("pig", 66.5, 10, 70.5); ew.entities.push(a);
  for (let k = 0; k < 3; k++) s.tick();
  let baby = null;
  const hook = ew.beforeMob;
  ew.beforeMob = (e) => { hook?.call(ew, e); if (!baby && e === a) { baby = ew.create("pig", 68.5, 10, 70.5); ew.entities.push(baby); } };
  s.tick();
  assert.ok(baby);
  assert.equal(baby.age, 1, "its first update ran in the tick that made it");
  ew.beforeMob = hook;
});

// Executed (public/research/mobpackets91-reference.json, tools/probes/MobPackets91Probe.java): the real EntityTrackerEntry sends S1C, S20, head S19, then the knockback S12 in one gated pass.
import { readFileSync } from "node:fs";
import { addMobEffect } from "./mob-effects.js";

test("the executed gated pass is S1C, S20, S19, S12, and the port sends the same order", { timeout: 180000 }, () => {
  const ref = JSON.parse(readFileSync(new URL("../public/research/mobpackets91-reference.json", import.meta.url)));
  const row = ref.case.rows.find((r) => r[0] === 10)[1].map((p) => p[0]);
  assert.deepEqual(row, ["S1C", "il", "S19", "S12"]);
  const s = new DedicatedSimulation({}, { world: flat(), gameMode: "creative", mobs: true });
  s.mobs.spawning = false; s.mobs.mobs.entities.length = 0;
  const p = s.addPlayer("p", "px", key(2)); p.position.copy({ x: 64.5, y: 10, z: 64.5 }); p.previous.copy(p.position); s.input("p", input());
  const m = s.mobs.mobs.create("pig", 66.5, 10, 70.5); s.mobs.mobs.entities.push(m);
  const mine = () => { const o = JSON.parse(JSON.stringify(p.mobPackets ?? [])); p.mobPackets = null; return o.filter((x) => x.i === Number(String(m.id).replace("mob-", ""))); };
  for (let k = 0; k < 14; k++) { s.tick(); mine(); }
  m.rotationYawHead = (m.rotationYawHead ?? 0) + 90; m.rotationYaw = (m.rotationYaw ?? 0) + 90;
  m.velocityChanged = true;
  addMobEffect(m, 1, 600, 0);
  s.tick();
  const got = mine().map((x) => x.type).filter((t) => ["meta", "attributes", "head", "velocity"].includes(t));
  assert.deepEqual(got, ["meta", "attributes", "head", "velocity"], got.join(","));
});
