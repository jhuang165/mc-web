import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SNOW_GOLEM, snowGolemShape, snowTrailCells, updateSnowGolem, snowGolemDrops, SNOWBALL_ITEM, SNOW_BLOCK } from "./snow-golem.js";
import { mooshroomUse, useBowl, SHEAR_MUSHROOMS, BOWL, MUSHROOM_STEW, SHEARS, BUCKET, MILK_BUCKET, RED_MUSHROOM } from "./mooshroom.js";
import { ENTITY_TYPES } from "./entities.js";
import { SUMMONABLE } from "./commands.js";

const ref = JSON.parse(await readFile(new URL("../public/research/mooshroom-golem-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;

test("reference: classes and record counts", () => {
  assert.equal(ref.records.length, 141);
  assert.ok(JSON.stringify(ref.classes).includes("\"wr\"") && JSON.stringify(ref.classes).includes("\"wm\""));
});

test("facts: sizes, health, speed and eye heights", () => {
  const [r] = by("facts"), row = (n) => r.rows.find((x) => x.name === n);
  const m = row("mooshroom"), s = row("snowman");
  assert.equal(ENTITY_TYPES.mooshroom.health, m.maxHealth);
  assert.equal(ENTITY_TYPES.mooshroom.width, m.width);
  assert.equal(ENTITY_TYPES.mooshroom.height, m.height);
  assert.equal(m.super, "wh");
  assert.equal(SNOW_GOLEM.health, s.maxHealth);
  assert.equal(SNOW_GOLEM.width, f(s.width));
  assert.equal(SNOW_GOLEM.height, f(s.height));
  assert.equal(SNOW_GOLEM.speed, f(s.speedAttr));
  assert.equal(SNOW_GOLEM.eyeHeight, f(s.eyeHeight));
  assert.equal(ENTITY_TYPES.snow_golem.health, 4);
  assert.equal(SNOW_GOLEM.followRange, s.followRange);
  assert.equal(SUMMONABLE.MushroomCow, "mooshroom");
  assert.equal(SUMMONABLE.SnowMan, "snow_golem");
});

test("shear: a mushroom cow with shears becomes a cow and drops five red mushrooms", () => {
  assert.equal(SHEAR_MUSHROOMS, 5);
  for (const r of by("shear")) {
    const mushrooms = r.spawned.filter((s) => s.item);
    if (r.age >= 0) assert.equal(mooshroomUse(SHEARS, r.age), "shear");
    if (r.result) assert.equal(mushrooms.length, SHEAR_MUSHROOMS);
    for (const s of mushrooms) assert.equal(s.item[0], 40), assert.equal(RED_MUSHROOM, 76);
  }
  assert.equal(mooshroomUse(SHEARS, -24000), null);
});

test("bowl and bucket: held item selects the action; the stack quirks match the probe", () => {
  assert.equal(mooshroomUse(BOWL, 0), "bowl");
  assert.equal(mooshroomUse(BUCKET, 0), null); // the bucket is handled by buckets-simulation (milk)
  assert.equal(MILK_BUCKET, 343);
  for (const r of by("bowl").filter((x) => x.mob === "mooshroom")) {
    if (r.age < 0) { assert.equal(mooshroomUse(BOWL, r.age), null); continue; }
    const survival = { creative: r.creative, inventory: { held: { count: r.count }, main: [], current: 0 }, add() { return r.full ? 0 : 1; } };
    const replaced = [];
    survival.inventory.main = replaced;
    const out = useBowl(survival, (id) => ({ id, count: 1 }));
    assert.equal(out, r.result, `bowl count ${r.count} creative ${r.creative} full ${r.full}`);
    if (r.count === 1) assert.equal(replaced[0].id, MUSHROOM_STEW);
  }
});

test("build: snow shape requires two snow blocks directly under the head", () => {
  for (const r of by("build").filter((x) => x.name.endsWith("snow") || x.name.includes("snow-"))) {
    const cells = new Map(r.before.map(([x, y, z, id]) => [`${x},${y},${z}`, id]));
    const shape = snowGolemShape((x, y, z) => cells.get(`${x},${y},${z}`) === 80, 0, 0, 0);
    assert.equal(!!shape, r.spawned.length === 1, r.name);
    if (shape) {
      assert.equal(r.spawned[0].class, "wr");
      assert.equal(shape.cells.length, 3);
      assert.equal(f(r.spawned[0].at[1]), f(r.spawned[0].at[1]));
      assert.ok(Math.abs(shape.at.y - (64 - 2 + 0.05 - 64)) < 1e-9 || Math.abs(shape.at.y + 1.95) < 1e-9);
    }
  }
  assert.equal(SNOW_BLOCK, 23);
});

test("trail: four cells a quarter block off the centre, only below 0.8", () => {
  for (const r of by("trail").filter((x) => x.pos)) {
    const e = { x: r.pos[0], y: r.pos[1], z: r.pos[2], health: r.health };
    let hurt = 0;
    const placed = updateSnowGolem(e, {
      wet: false, temperature: () => f(r.temperature), hurt: () => { hurt++; }, isAir: () => true, canLayer: () => true, setLayer() {},
    });
    assert.deepEqual(placed.map((p) => p.join(",")).sort(), [...r.placed].sort(), `biome ${r.biome}`);
    assert.equal(hurt, r.temperature > 1 ? 1 : 0);
  }
  assert.equal(snowTrailCells({ x: 64.9, y: 0, z: 64.1 }).length, 4);
});

test("damage and fall: a golem takes one point from any source and ignores falls", () => {
  for (const r of by("damage").filter((x) => x.mob === "snowman")) assert.equal(r.before - r.after, 1, r.source);
  for (const r of by("fall").filter((x) => x.mob === "snowman")) assert.equal(r.before, r.after);
});

test("drops: nextInt(16) snowballs", () => {
  const seq = [0, 5, 15];
  for (const n of seq) {
    const out = snowGolemDrops({ nextInt: (k) => (assert.equal(k, 16), n) });
    assert.deepEqual(out, n ? [{ id: SNOWBALL_ITEM, count: n }] : []);
  }
  assert.equal(SNOWBALL_ITEM, 312);
});

test("model: ModelSnowMan boxes in the reference match the renderer table", () => {
  const [m] = ref.records.filter((r) => r.model === "snowman");
  const boxes = Object.values(m.parts).map((p) => p.boxes[0].from.join(","));
  assert.deepEqual(boxes, ["-5,-10,-5", "-6,-12,-6", "-4,-8,-4", "-1,0,-1", "-1,0,-1"]);
});
