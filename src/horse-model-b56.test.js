// Batch 56: ModelHorse.setLivingAnimations replayed against the executed class (tools/probes/HorseModelProbe.java -> public/research/horse-model-reference.json).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stepHorseCopy } from "./horse-copy.js";
import { createHorseModel, setHorseAnimations, HORSE_PARTS } from "./horse-model.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horse-model-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const KEYS = ["c", "d", "e", "f", "g", "h"];

test("the rest model matches the unchanged class's rest dump (public/research/horse-reference.json)", async () => {
  const dump = JSON.parse(await readFile(new URL("../public/research/horse-reference.json", import.meta.url), "utf8")).model.parts;
  const m = createHorseModel();
  for (const k of Object.keys(dump)) {
    assert.deepEqual([m[k].c, m[k].d, m[k].e], dump[k].point.map(f), k);
    assert.deepEqual([m[k].f, m[k].g, m[k].h], dump[k].angle.map(f), k);
    assert.ok(HORSE_PARTS[k].b.length === dump[k].boxes.length, k);
  }
  assert.equal(Object.keys(m).length, Object.keys(dump).length);
});

test("240 executed setLivingAnimations rows (39 parts x c d e f g h each) are reproduced exactly, one shared model in order", () => {
  assert.equal(ref.pose.length, 240);
  const model = createHorseModel();
  let saddledRider = 0, rearing = 0, chestedUnsaddled = 0, tail = 0, foals = 0;
  for (const row of ref.pose) {
    const s = {
      prevRenderYawOffset: row.aN, renderYawOffset: row.aM, prevRotationYawHead: row.aP, rotationYawHead: row.aO, prevRotationPitch: row.pitchPrev, rotationPitch: row.pitch,
      ticksExisted: row.ticks, lean: row.p, rear: row.q, mouth: row.r, tail: row.anim.tail, saddled: row.saddled, rider: row.rider,
    };
    setHorseAnimations(model, s, row.swing, row.amount, row.partial);
    for (const [k, v] of Object.entries(row.parts)) KEYS.forEach((key, i) => assert.equal(model[k][key], f(v[i]), `row ${row.i} part ${k}.${key}`));
    if (row.saddled && row.rider) saddledRider++;
    if (row.q > 0) rearing++;
    if (row.chested && !row.saddled) chestedUnsaddled++;
    if (row.anim.tail) tail++;
    if (row.age < 0) foals++;
  }
  assert.ok(saddledRider > 10 && rearing > 40 && chestedUnsaddled > 10 && tail > 30 && foals > 40, JSON.stringify({ saddledRider, rearing, chestedUnsaddled, tail, foals }));
});

// The tail roll (executed, horse-model-reference.json `tail`): the real wi.h() on a logging Random; per tick 1000 (living sound) then 200 (tail roll), bp 2..8 then 0 after a 200:0 hit.
test("the copy draws nextInt(200) once per tick on its own Random and the tail counter follows the executed record", () => {
  const rec = ref.tail;
  const hits = new Set();
  const script = rec.ticks.map((t) => t.draws.find((d) => d.startsWith("200:")));
  const c = {};
  const seen = [];
  c.rand = { nextInt(n) { seen.push(n); return Number(script[seen.length - 1].split(":")[1]); } };
  rec.ticks.forEach((t, i) => {
    const a = stepHorseCopy(c, 0);
    assert.equal(seen.length, i + 1);
    assert.equal(a.tail, t.bp, `tick ${i}`);
    if (script[i] === "200:0") hits.add(i);
  });
  assert.ok(hits.size >= 3);
  assert.deepEqual([...new Set(seen)], [200]);
});
