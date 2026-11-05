import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Hanging, ARTS, FRAME_ITEM, PAINTING_ITEM, hangingGeometry, pickHanging, FACING_TO_DIRECTION } from "./hanging.js";
import { JavaRandom } from "./java-random.js";

// public/research/hanging-reference.json: the unchanged EntityPainting, EntityItemFrame, EntityHanging, EnumArt
// and ItemHangingEntity (tools/verify-hanging.mjs, tools/probes/HangingProbe.java).
const ref = JSON.parse(await readFile(new URL("../public/research/hanging-reference.json", import.meta.url)));
const kind = (k) => ref.cases.filter((c) => c.kind === k);
const num = (v) => (v === "-0" ? -0 : v);
const STONE = 3; // internal id of original stone
// Original ids the probe items use, as browser stacks (the replay only needs identity).
const ORIGINAL = { 321: PAINTING_ITEM, 389: FRAME_ITEM };
const browserId = (id) => ORIGINAL[id] ?? id;

// MinecartProbe.MW-like world: stone below y 0, `cells` stone cells otherwise.
function probeWorld(cells) {
  const map = new Set(cells.map(([x, y, z]) => `${x},${y},${z}`));
  const id = (x, y, z) => (map.has(`${x},${y},${z}`) || y < 0 ? STONE : 0);
  return { get: id, getMeta: () => 0, solid: (x, y, z) => id(x, y, z) !== 0 };
}
// HangingProbe.plane: a 17 x 17 solid plane through the tile.
function plane(dir, tx, ty, tz) {
  const c = [];
  for (let t = -8; t <= 8; t++) for (let y = ty - 8; y <= ty + 8; y++) c.push(dir === 0 || dir === 2 ? [tx + t, y, tz] : [tx, y, tz + t]);
  return c;
}
const state = (e) => [e.dir, e.tx, e.ty, e.tz, e.x, e.y, e.z, e.yaw, e.prevYaw, ...e.bb, ...(e.kind === "painting" ? [ARTS[e.art][1], ARTS[e.art][2]] : [9, 9]), e.dead];
const seeded = (seed) => new Hanging({ random: () => new JavaRandom(seed) });

test("EnumArt table matches the unchanged class", () => {
  const arts = ref.cases.find((c) => c.kind === "arts");
  assert.deepEqual(ARTS, arts.arts);
  assert.equal(ARTS.length, 26);
});

test("setDirection: position, yaw and the (inverted) bounding box for every art and facing", () => {
  const cases = kind("bounds");
  assert.equal(cases.length, 12);
  for (const c of cases) {
    const h = new Hanging();
    c.paintings.forEach((want, i) => assert.deepEqual(state(h.make("painting", c.dir, ...c.tile, { art: i })), want, `${ARTS[i][0]} dir ${c.dir}`));
    assert.deepEqual(state(h.make("frame", c.dir, ...c.tile)), c.frame);
    const g = hangingGeometry(c.dir, ...c.tile, 16, 16);
    assert.ok(g.bb[2] > g.bb[5] || g.bb[0] > g.bb[3], "one axis is inverted");
  }
});

test("onValidSurface against a plane with cells removed, blockers and entities", () => {
  for (const c of kind("surface")) {
    const bit = (v, art) => {
      const cells = plane(c.dir, 0, 64, 0);
      let list = cells;
      if (v >= 3) {
        const dx = ((v - 3) % 5) - 2, dy = Math.floor((v - 3) / 5) - 2;
        const [hx, hz] = c.dir === 0 || c.dir === 2 ? [dx, 0] : [0, dx];
        list = cells.filter(([x, y, z]) => !(x === hx && y === 64 + dy && z === hz));
      }
      if (v === 1) list = [...cells, [[0, 64, 1], [-1, 64, 0], [0, 64, -1], [1, 64, 0]][c.dir]];
      const h = new Hanging();
      const e = art === null ? h.make("frame", c.dir, 0, 64, 0) : h.make("painting", c.dir, 0, 64, 0, { art });
      return h.valid(probeWorld(list), e) ? "1" : "0";
    };
    c.paintings.forEach((bits, art) => assert.equal(Array.from({ length: 28 }, (_, v) => bit(v, art)).join(""), bits, `${ARTS[art][0]} dir ${c.dir}`));
    assert.equal(Array.from({ length: 28 }, (_, v) => bit(v, null)).join(""), c.frame, `frame dir ${c.dir}`);
  }
});

test("painting art choice: the real constructor loop with a fixed Random against wall sizes", () => {
  const cases = kind("select");
  assert.equal(cases.length, 196);
  for (const c of cases) {
    const [W, H] = c.wall, cells = [];
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) cells.push(c.dir === 0 || c.dir === 2 ? [i, 64 + j, 0] : [0, 64 + j, i]);
    const world = probeWorld(cells), h0 = new Hanging();
    const valid = ARTS.map((_, art) => art).filter((art) => h0.valid(world, h0.make("painting", c.dir, ...c.tile, { art })));
    assert.deepEqual(valid, c.valid, JSON.stringify(c.wall));
    c.picks.forEach(([art, ok, x, y, z], seed) => {
      const p = seeded(seed).createPainting(world, ...c.tile, c.dir);
      assert.deepEqual([p.art, Hanging.prototype.valid.call(new Hanging(), world, p), p.x, p.y, p.z], [art, ok, num(x), num(y), num(z)], `${JSON.stringify(c.wall)} seed ${seed}`);
    });
  }
  const none = ref.cases.find((c) => c.kind === "select-none"), p = seeded(3).createPainting(probeWorld([]), 0, 64, 0, 2);
  assert.deepEqual([p.art, new Hanging().valid(probeWorld([]), p)], [none.art, none.valid]);
});

// Drop records [original id, count, damage, x, y, z, delay, tag] -> Hanging.drain() entries.
const dropsOf = (h) => h.drain().map((d) => [d.stack.id, d.stack.count, d.stack.damage ?? 0, d.x, d.posY, d.z, d.delay]);
const wantDrops = (list) => list.map(([id, count, damage, x, y, z, delay]) => [browserId(id), count, damage, num(x), num(y), num(z), delay]);
const stackOf = (s) => (s ? [s[0] === browserId(s[0]) ? s[0] : s[0], s[1], s[2]] : null);

test("item frame: insert, rotate, hit, drops and the drop chance, against the unchanged class", () => {
  const sources = { "survival-last-item": null, explosion: null };
  for (const c of kind("frame")) {
    const h = seeded(7);
    const e = h.createFrame(0, 64, 0, 2);
    h.entities.push(e);
    if (c.dropChance >= 0) e.dropChance = c.dropChance;
    // The recorded held stack is the state after the scenario; the first insert shows what went in.
    const first = c.steps.find((st) => st[0] === "insert")?.[2];
    let held = first ? { id: first[0], count: 3, damage: first[2] } : null;
    const by = c.name in sources ? null : { player: true, creative: c.creative };
    for (const [name, , item, rotation, dead, , drops] of c.steps) {
      h.drain();
      if (name === "insert" || name === "rotate") {
        const r = h.interact(e, held);
        if (r.action === "insert" && !c.creative) { held.count--; if (held.count <= 0) held = null; }
      } else if (name === "hit") h.attack(e, by);
      else if (name === "force") h.broken(e, null);
      else if (name === "move") h.kill(e, null);
      else continue;
      assert.deepEqual([e.item ? [e.item.id, e.item.count, e.item.damage ?? 0] : null, e.rotation, e.dead], [item ? [item[0], item[1], item[2]] : null, rotation, dead], c.name + " " + name);
      assert.deepEqual(dropsOf(h), wantDrops(drops), c.name + " " + name + " drops");
    }
  }
});

test("painting and frame hits: items drop except for a Creative player", () => {
  for (const c of kind("painting-hit")) {
    const h = seeded(5), p = h.createPainting(probeWorld(plane(2, 0, 64, 0)), 0, 64, 0, 2, { art: c.art });
    for (const [source, ret, dead, drops] of c.steps) {
      h.drain();
      assert.equal(h.attack(p, source === "player" ? { player: true, creative: c.creative } : null), ret);
      assert.equal(p.dead, dead);
      assert.deepEqual(h.drain().map((d) => [d.stack.id, d.stack.count, d.x, d.posY, d.z, d.delay]), drops.map(([id, count, , x, y, z, delay]) => [browserId(id), count, num(x), num(y), num(z), delay]), c.name);
    }
  }
});

test("onUpdate: the surface is re-checked on the 101st update, never client side", () => {
  for (const c of kind("tick")) {
    const cells = plane(2, 0, 64, 0), h = seeded(11);
    const e = c.frame ? h.createFrame(0, 64, 0, 2) : h.createPainting(probeWorld(cells), 0, 64, 0, 2, { art: "Pool" });
    h.entities.push(e);
    if (c.frame) h.interact(e, { id: 4, count: 1, damage: 0 });
    const gone = probeWorld(cells.filter(([x, y]) => !(y === 64 && x >= -2 && x <= 2)));
    let current = probeWorld(cells), deadAt = -1, dropped = [];
    for (let t = 0; t < 130; t++) {
      if (t === c.removeAt) current = gone;
      if (c.remote) continue;
      h.drain();
      h.tick(current);
      if (e.dead && deadAt < 0) { deadAt = t; dropped = dropsOf(h); }
    }
    assert.equal(deadAt, c.deadAt, c.name);
    assert.deepEqual(dropped, wantDrops(c.drops), c.name);
  }
});

test("ItemHangingEntity.onItemUse: sides, facing, stack use and position", () => {
  for (const c of kind("place")) {
    const world = probeWorld([[0, 65, 0], ...(c.blocked ? [[0, 65, -1]] : [])]), h = seeded(17);
    const r = h.use(c.frame ? "frame" : "painting", world, 0, 65, 0, c.side);
    assert.equal(c.side < 2 ? false : true, r.used, `${c.name} side ${c.side} return`);
    assert.equal(c.stack, 3 - (r.entity ? 1 : 0), `${c.name} side ${c.side} stack`);
    if (!c.entity) assert.equal(r.entity, null, `${c.name} side ${c.side}`);
    else {
      assert.ok(r.entity, `${c.name} side ${c.side}`);
      const want = c.entity[0];
      // The probe's painting art is random (Entity.rand); the position of a 16 x 16 art is art independent.
      assert.deepEqual(state(r.entity).slice(0, 4), want.slice(0, 4));
      assert.equal(r.entity.dir, FACING_TO_DIRECTION[c.side]);
      if (c.frame) assert.deepEqual(state(r.entity), want);
      else assert.deepEqual(ARTS[r.entity.art].slice(1, 3), [16, 16]);
    }
  }
});

test("saves: records round trip, old saves load, unknown arts become Kebab", () => {
  const h = seeded(1), world = probeWorld(plane(2, 0, 64, 0));
  h.entities.push(h.createPainting(world, 0, 64, 0, 2, { art: "Wither" }));
  const frame = h.createFrame(1, 64, 0, 2);
  h.interact(frame, { id: 276, count: 1, damage: 5 });
  frame.rotation = 3; frame.dropChance = 0.25;
  h.entities.push(frame);
  const json = JSON.parse(JSON.stringify(h.toJSON()));
  const back = Hanging.fromJSON(json);
  assert.deepEqual(back.entities.map(state), h.entities.map(state));
  assert.deepEqual([back.entities[1].item, back.entities[1].rotation, back.entities[1].dropChance], [{ id: 276, count: 1, damage: 5 }, 3, 0.25]);
  assert.equal(Hanging.fromJSON(undefined).entities.length, 0);
  assert.equal(Hanging.fromJSON([{ kind: "painting", dir: 1, tx: 1, ty: 2, tz: 3, art: "Nonsense" }]).entities[0].art, 0);
});

test("pickHanging: the grown box meets the eye ray in front of the wall only", () => {
  const h = new Hanging(), e = h.createFrame(0, 64, 0, 2);
  h.entities.push(e);
  const hit = pickHanging(h, { x: 0.5, y: 64.5, z: -2 }, { x: 0, y: 0, z: 1 }, 3);
  assert.ok(hit && Math.abs(hit.distance - (2 - 0.0625 - 0.1 - 0.0234375 + 0)) < 0.2);
  assert.equal(pickHanging(h, { x: 0.5, y: 64.5, z: -2 }, { x: 0, y: 0, z: 1 }, 1), null);
});

test("explosions break hanging entities within twice the size and drop their items", () => {
  const h = seeded(2), near = h.createFrame(0, 64, 0, 2), far = h.createFrame(10, 64, 0, 2);
  h.entities.push(near, far);
  h.interact(near, { id: 4, count: 1, damage: 0 });
  h.explode(0.5, 64.5, -3, 4); // the item comes out first, the frame stays
  assert.equal(near.dead, false);
  assert.deepEqual(h.drain().map((d) => d.stack.id), [4]);
  h.explode(0.5, 64.5, -3, 4);
  assert.equal(near.dead, true);
  assert.equal(far.dead, false);
  assert.deepEqual(h.drain().map((d) => d.stack.id), [FRAME_ITEM]);
  assert.equal(h.entities.length, 1);
});

test("runtime columns: hanging records split by position and join back; old records stay unchanged", async () => {
  const { splitRuntime, joinRuntime } = await import("./chunk-runtime.js");
  const h = seeded(3), world = probeWorld(plane(2, 0, 64, 0));
  h.entities.push(h.createPainting(world, 0, 64, 0, 2, { art: "Kebab" }), h.createFrame(40, 64, 0, 2));
  const record = { id: "w", entities: [], drops: [], hanging: h.toJSON() };
  const { metadata, columns } = splitRuntime(structuredClone(record));
  assert.equal(columns.length, 2);
  assert.deepEqual(joinRuntime(metadata, columns).hanging, record.hanging);
  const old = splitRuntime({ id: "w", entities: [], drops: [] });
  assert.equal("hanging" in joinRuntime(old.metadata, old.columns), false);
});

test("items, recipes and the original id table", async () => {
  const { ITEMS, RECIPES } = await import("./survival.js");
  const { ORIGINAL_ITEMS } = await import("./original-items.js");
  assert.deepEqual([ITEMS[PAINTING_ITEM].name, ITEMS[FRAME_ITEM].name], ["Painting", "Item Frame"]);
  assert.deepEqual([ORIGINAL_ITEMS[321], ORIGINAL_ITEMS[389]], [PAINTING_ITEM, FRAME_ITEM]);
  const recipe = (id) => RECIPES.find((r) => r.output === id);
  assert.equal(recipe(PAINTING_ITEM).pattern.filter((v) => v === 300).length, 8);
  assert.equal(recipe(FRAME_ITEM).pattern[4], 315);
});
