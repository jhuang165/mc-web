// Batch 65 clientreplays: replays of the executed probes in public/research/clientreplays-reference.json (tools/verify-clientreplays.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fishingLine, EYE_HEIGHT_OTHER } from "./fishing-line.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/clientreplays-reference.json", import.meta.url), "utf8"));
const near = (a, b, msg, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);

test("RenderFish line endpoint and curve match the executed bytecode-order probe (96 cases)", () => {
  const rows = ref.fishLine.rows.filter((r) => r.case.startsWith("line"));
  assert.equal(rows.length, 96);
  assert.ok(rows.some((r) => r.first) && rows.some((r) => !r.first && r.local) && rows.some((r) => !r.first && !r.local));
  for (const r of rows) {
    const [px, py, pz, x, y, z] = r.angler, [hpx, hpy, hpz, hx, hy, hz] = r.hook;
    const out = fishingLine({
      first: r.first, local: r.local, swing: r.swing, partial: r.pt,
      angler: { px, py, pz, x, y, z, prevYaw: r.prevYaw, yaw: r.yaw, prevPitch: r.prevPitch, pitch: r.pitch, prevRenderYawOffset: r.prevRenderYawOffset, renderYawOffset: r.renderYawOffset },
      hook: { px: hpx, py: hpy, pz: hpz, x: hx, y: hy, z: hz },
    });
    r.tip.forEach((v, i) => near(out.tip[i], v, `${r.case} tip ${i}`));
    r.points.forEach((p, k) => p.forEach((v, i) => near(out.points[k][i], v, `${r.case} point ${k}.${i}`)));
  }
});

test("another player's eye term is the executed EntityPlayer.getEyeHeight, the local player's is 0", () => {
  const eye = ref.fishLine.rows.find((r) => r.case === "eye").getEyeHeight;
  assert.equal(EYE_HEIGHT_OTHER, eye);
  for (const r of ref.fishLine.rows.filter((r) => r.case.startsWith("line") && !r.first)) assert.equal(r.eyeTerm, r.local ? 0 : eye);
});

test("the client half of the mob push does not exist: collideWithNearbyEntities is behind !isRemote, addVelocity sends no S12 flag", async () => {
  const { pushSection, addVelocity, classes } = ref.mobPush;
  assert.match(classes.sv.sha256, /^[0-9a-f]{64}$/);
  const i = pushSection.indexOf("getfield Field ahb.E:Z");
  assert.ok(i > 0 && pushSection[i + 1].startsWith("ifne") && pushSection[i + 3] === "invokevirtual Method bo:()V", "bo() runs only when isRemote is false");
  assert.deepEqual(addVelocity.slice(-1), ["putfield Field al:Z"], "Entity.addVelocity writes isAirBorne (al) last");
  assert.ok(!addVelocity.includes("putfield Field H:Z"), "and never velocityChanged (H), the flag the tracker sends S12 for");
  const { CLIENT_PUSHES_PLAYER } = await import("./client-push.js");
  assert.equal(CLIENT_PUSHES_PLAYER, false);
});

// ---- the Java 7 effect order ----
import { JavaRandom } from "./java-random.js";
import { addMobEffect, tickMobEffects, effectsInMapOrder } from "./mob-effects.js";
import { Java7IntMap, java7Sync } from "./java7-hashmap.js";

test("the effect map in Java 7 HashMap order matches 52 executed sequences (the unchanged classes on a port of the OpenJDK 7 HashMap)", () => {
  const rows = ref.effects7.rows;
  assert.equal(rows.length, 52);
  const rowOf = (x) => [x.id, x.amplifier, x.duration, x.ambient ? 1 : 0], size = { width: 0.6, height: 1.8 };
  let differs = 0, same = 0;
  for (const r of rows) {
    const e = { type: "pig", effects: [], health: 10 }, map = new Java7IntMap();
    for (const [op, a, b, c] of r.ops) {
      if (op === "put") { const at = e.effects.findIndex((x) => x.id === a), entry = { id: a, amplifier: b, duration: c }; if (at >= 0) e.effects[at] = entry; else e.effects.push(entry); }
      else if (op === "add") addMobEffect(e, a, c, b);
      else for (let i = 0; i < a; i++) tickMobEffects(e, size, 10, new JavaRandom(7), undefined, undefined);
      java7Sync(map, e.effects);
    }
    assert.deepEqual(java7Sync(map, e.effects).map(rowOf), r.effects, `seed ${r.seed}`);
    if (JSON.stringify(effectsInMapOrder(e).map(rowOf)) === JSON.stringify(r.effects)) same++; else differs++;
  }
  assert.ok(differs >= 10, `the Java 8 order differs from Java 7 in ${differs} of 52 records`);
  assert.ok(same >= 10, "and agrees in the others (ids below 16 without a collision)");
});

test("the Java 7 map port: front insertion, spread hash for ids 16 to 23, chains reverse on a resize", () => {
  const m = new Java7IntMap();
  [16, 17, 18, 19, 20, 21, 22, 23].forEach((k) => m.put(k));
  assert.deepEqual(m.keys(), [17, 16, 19, 18, 21, 20, 23, 22]);
  const w = new Java7IntMap();
  [1, 17, 33].forEach((k) => w.put(k)); // 1 -> bucket 1, 17 -> spread 16 (bucket 0), 33 -> 33 ^ 2 = 35 (bucket 3)
  assert.deepEqual(w.keys(), [17, 1, 33]);
});

test("the dragon copy's growl is rolled but silent: RenderGlobal.playSound is empty in both overloads, getLivingSound is the growl (dragon-client-b49 covers the crystal search)", async () => {
  const d = ref.dragonSound;
  assert.deepEqual(d.renderGlobalPlaySound, ["return"]);
  assert.deepEqual(d.renderGlobalPlaySoundExcept, ["return"]);
  assert.deepEqual(d.dragonLivingSound, ["ldc String mob.enderdragon.growl", "areturn"]);
  const src = readFileSync(new URL("./entity-tracker.js", import.meta.url), "utf8");
  assert.match(src, /sound: "mob\.enderdragon\.growl", volume: 5,[^\n]*silent: true/);
});
