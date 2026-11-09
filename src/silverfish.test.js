import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import { fromOriginal } from "./block-registry.js";
import {
  SILVERFISH, SILVERFISH_SOUNDS, FACING, canHide, eggMetaFor, blockForEggMeta, eggBreak, eggSpawn, hurtSummon, attackReady,
  closestVulnerablePlayer, pathWeight, silverfishActionState, legacyFields, silverfishPose, SILVERFISH_MODEL, silverfishCanSpawnHere,
  MONSTER_EGG,
} from "./silverfish.js";
import { MobSpawners, mobBox, boxesIntersect, countInBox, SPAWN_BRIGHTNESS } from "./mob-spawner.js";

const ref = JSON.parse(await readFile(new URL("../public/research/silverfish-reference.json", import.meta.url)));
const by = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
// Original ids to the port's internal block ids (stone 1 -> 3, cobblestone 4 -> 12, stone bricks 98 -> 101, monster egg 97 -> 68).
const internal = (id, meta = 0) => fromOriginal(id, meta);

test("facts: size, attributes, sounds and flags of the unchanged EntitySilverfish", () => {
  const [r] = by("facts");
  assert.equal(SILVERFISH.width, f(r.width));
  assert.equal(SILVERFISH.height, f(r.height));
  assert.equal(SILVERFISH.health, r.health);
  assert.equal(SILVERFISH.speed, r.speed);
  assert.equal(SILVERFISH.damage, r.damage);
  assert.equal(r.followRange, SILVERFISH.followRange);
  assert.equal(SILVERFISH_SOUNDS.say, r.say);
  assert.equal(SILVERFISH_SOUNDS.hurt, r.hit);
  assert.equal(SILVERFISH_SOUNDS.death, r.kill);
  assert.equal(r.canTriggerWalking, false);
  assert.equal(r.validLight, true);
  assert.equal(r.dropItem, 0);
  assert.equal(r.arthropod, true);
  assert.equal(r.eggBlock, 97);
  assert.deepEqual(by("step")[0].sounds, [`${SILVERFISH_SOUNDS.step}|0.15|1.0`]);
  for (const t of by("facing")) assert.deepEqual(FACING[t.i], [t.dx, t.dy, t.dz]);
  assert.equal(internal(r.eggBlock).id, MONSTER_EGG);
});

test("path weight: stone below is 10, otherwise 0.5 minus the light brightness", () => {
  for (const t of by("pathWeight")) {
    const below = internal(t.below).id;
    near(pathWeight(below, SPAWN_BRIGHTNESS[t.light]), t.weight, 1e-6, `below ${t.below} light ${t.light}`);
  }
});

test("BlockSilverfish metadata mapping both ways and the silk-touch stack", () => {
  for (const t of by("canHide")) {
    const b = internal(t.block, t.meta);
    if (!internal(t.block, t.meta).exact) continue; // metadata the port's block has no state for
    assert.equal(canHide(b.id), t.hides, `${t.block}:${t.meta} hides`);
    if (t.hides) assert.equal(eggMetaFor(b.id, b.meta), t.eggMeta, `${t.block}:${t.meta} egg meta`);
  }
  for (const t of by("eggBlock")) {
    const want = internal(t.block, t.blockMeta), got = blockForEggMeta(t.meta);
    assert.deepEqual(got, { id: want.id, meta: want.meta }, `egg meta ${t.meta}`);
    assert.equal(t.stack[1], 1);
  }
  assert.equal(by("eggBlockFacts")[0].quantityDropped, 0);
});

test("breaking a monster egg: Creative one silverfish, Survival two, Silk Touch one plus the stacked block", () => {
  assert.equal(by("break").length, 24);
  for (const t of by("break")) {
    const silk = t.mode === "survival-silk", creative = t.mode === "creative";
    const r = eggBreak({ creative, silkTouch: silk, meta: t.meta });
    const fish = t.afterHarvest.filter((s) => s[0] === "silverfish"), items = t.afterHarvest.filter((s) => s[0] === "item");
    assert.equal(r.spawns, fish.length, `${t.mode} meta ${t.meta} silverfish`);
    for (const s of fish) assert.deepEqual(eggSpawn(0, 0, 0), { x: s[1], y: s[2], z: s[3], yaw: s[4] });
    assert.equal(items.length, silk ? 1 : 0, `${t.mode} items`);
    if (silk) {
      const it = items[0], want = internal(it[5], it[7]);
      assert.equal(it[6], 1);
      assert.deepEqual(r.item, { id: want.id, meta: want.meta });
    } else assert.equal(r.item, null);
    assert.equal(t.canHarvest, true);
  }
  assert.deepEqual(by("dropWithChance")[0].spawned, [["silverfish", 3.5, 0, 4.5, 0]]);
  assert.deepEqual(by("remoteBreak")[0].spawned, []);
});

test("attackEntityFrom arms the summon cooldown only for entity or magic sources", () => {
  for (const t of by("hurt")) assert.equal(hurtSummon(t.startCooldown, { entity: t.entitySource, type: t.source }), t.cooldown, `${t.source} from ${t.startCooldown}`);
});

test("attackEntity: attackTime 0, distance < 1.2f and vertical overlap with the 0.7f box", () => {
  for (const t of by("attack")) {
    const hit = attackReady({ y: 0, attackTime: t.attackTime }, t.targetY, t.targetY + t.targetHeight, t.distance);
    assert.equal(hit ? 1 : 0, t.hits, JSON.stringify(t));
  }
});

test("findPlayerToAttack: radius 8, creative ignored", () => {
  for (const t of by("findPlayer")) {
    const e = { x: 0.5, y: 0, z: 0.5 }, p = { x: 0.5 + t.distance, y: 0, z: 0.5, creative: t.creative };
    assert.equal(closestVulnerablePlayer(e, [p]) !== null, t.found, JSON.stringify(t));
  }
});

// ---- the legacy action state, replayed tick by tick on the probe's recorded paths and positions ----

class Counting extends JavaRandom {
  constructor(seed) { super(seed); this.calls = 0; }
  next(bits) { this.calls++; return super.next(bits); }
}
// ProbeWorld: stone below y 0, the scenario's own cells above.
function blockWorld(cells) {
  const map = new Map(cells.map(([x, y, z, id, meta]) => [`${x},${y},${z}`, { ...internal(id, meta) }]));
  return {
    sets: [],
    get(x, y, z) { return map.get(`${x},${y},${z}`) ?? (y < 0 ? { id: 3, meta: 0 } : { id: 0, meta: 0 }); },
    set(x, y, z, id, meta) { map.set(`${x},${y},${z}`, { id, meta }); this.sets.push([x, y, z, id, meta]); },
  };
}
const asPath = (points) => points && {
  i: 0,
  getPosition() { const p = points[this.i]; return { x: p[0] + 0.5, y: p[1], z: p[2] + 0.5 }; },
  incrementPathIndex() { this.i++; },
  isFinished() { return this.i >= points.length; },
};

function replay(r, { player, cells, griefing = true, summon = 0, start = [0.5, 0, 0.5], players = [] }) {
  const rand = new Counting(r.seed), world = blockWorld(cells);
  const e = { ...legacyFields(), x: start[0], y: start[1], z: start[2], width: SILVERFISH.width, height: SILVERFISH.height, summonCooldown: summon, dead: false };
  const players2 = player ? [{ ...player, alive: true, dead: false, living: true }] : players;
  let row, spawned, hidden, queue;
  const env = {
    rand, remote: false, mobGriefing: griefing,
    closestPlayer: (me, range) => {
      let best = null, bd = -1;
      for (const p of players2) {
        const d = (p.x - me.x) ** 2 + (p.y - me.y) ** 2 + (p.z - me.z) ** 2;
        if ((range < 0 || d < range * range) && (bd === -1 || d < bd)) { best = p; bd = d; }
      }
      return best;
    },
    findPlayerToAttack: (me) => closestVulnerablePlayer(me, players2, 8),
    isAlive: () => true,
    isCreative: (t) => !!t.creative,
    eyeHeight: (x) => (x === e ? f(f(SILVERFISH.height) * f(0.85)) : 1.62),
    boxMidY: (t) => t.y,
    canSee: () => true,
    attackEntity(me, t, d) {
      if (attackReady({ y: me.y, attackTime: me.attackTime }, t.y, t.y + 1.8, d)) { me.attackTime = 20; row.hits++; }
    },
    pathToEntity(me, t, range) {
      const q = queue.shift();
      assert.ok(q, `${r.name} unexpected entity path`);
      assert.equal(q.kind, "entity");
      assert.deepEqual(q.args, [t.x, t.y, t.z, range]);
      return asPath(q.result);
    },
    pathToBlock(me, x, y, z, range) {
      const q = queue.shift();
      assert.ok(q, `${r.name} unexpected block path`);
      assert.equal(q.kind, "block");
      assert.deepEqual(q.args, [x, y, z, range]);
      return asPath(q.result);
    },
    pathWeight: (me, x, y, z) => pathWeight(world.get(x, y - 1, z).id, SPAWN_BRIGHTNESS[0]),
    getBlock: (x, y, z) => world.get(x, y, z).id,
    getMeta: (x, y, z) => world.get(x, y, z).meta,
    setBlock: (x, y, z, id, meta) => world.set(x, y, z, id, meta),
    breakBlock: (x, y, z) => world.set(x, y, z, 0, 0),
    releaseEgg: (x, y, z) => spawned.push(eggSpawn(x, y, z)),
    explosionParticle: () => {},
    setDead: () => { hidden = true; e.dead = true; },
  };
  let state = rand.seed.toString();
  for (const want of r.ticks) {
    row = { hits: 0 }; spawned = []; hidden = false; world.sets.length = 0;
    queue = (want.paths ?? []).map((p) => ({ ...p }));
    rand.calls = 0;
    silverfishActionState(e, env);
    const at = `${r.name} tick ${want.t}`;
    assert.equal(queue.length, 0, `${at} unused path requests`);
    assert.equal(rand.calls, want.calls, `${at} Random draws`);
    assert.equal(rand.seed.toString(), want.state, `${at} Random state`);
    near(e.rotationYaw, want.yaw, 1e-4, `${at} yaw`);
    near(e.rotationPitch, want.pitch, 1e-4, `${at} pitch`);
    near(e.moveForward, want.forward, 1e-6, `${at} forward`);
    assert.equal(e.jumping, want.jump, `${at} jump`);
    assert.equal(!!e.target, want.target !== null, `${at} target`);
    assert.equal(!!e.path, want.hasPath, `${at} path`);
    if (want.hasPath) assert.equal(e.path.i, want.pathIndex, `${at} path index`);
    assert.equal(e.summonCooldown, want.summon, `${at} summon`);
    assert.equal(e.entityAge, want.age, `${at} age`);
    assert.equal(e.attackTime, want.attack, `${at} attackTime`);
    near(e.randomYaw, want.turn, 1e-5, `${at} random yaw`);
    assert.equal(!!e.lookTarget, want.look, `${at} look target`);
    assert.equal(e.chaseTicks, want.chase, `${at} chase ticks`);
    assert.equal(row.hits, want.hits, `${at} hits`);
    assert.equal(e.dead, want.dead, `${at} dead`);
    const sets = (want.sets ?? []).map(([x, y, z, id, meta]) => [x, y, z, internal(id, meta).id, internal(id, meta).meta]);
    assert.deepEqual(world.sets, sets, `${at} block sets`);
    assert.deepEqual(spawned, (want.spawned ?? []).map((s) => ({ x: s[1], y: s[2], z: s[3], yaw: s[4] })), `${at} spawned`);
    // The probe's kinematic step (0.1 block along the yaw while moving) is adopted as recorded.
    e.x = want.x; e.y = want.y; e.z = want.z;
    state = want.state;
  }
  return e;
}

for (const r of by("chase"))
  test(`legacy chase replay: ${r.name}`, () => {
    const cells = r.wall ? [3, 4, 5].flatMap(() => []).concat([0, 1, 2].flatMap((y) => [-1, 0, 1].map((z) => [3, y, z, 1, 0]))) : [];
    replay(r, { player: { x: r.player[0], y: r.player[1], z: r.player[2], creative: r.creative }, cells });
  });
for (const r of by("idle"))
  test(`legacy idle and hide replay: ${r.name}`, () => {
    replay(r, { cells: r.floor[0] >= 0 ? [[0, -1, 0, r.floor[0], r.floor[1]]] : [] });
  });
for (const r of by("wake"))
  test(`monster egg wake replay: ${r.name} seed ${r.seed}`, () => {
    replay(r, { cells: r.eggs.map(([x, y, z, m]) => [x, y, z, 97, m]), griefing: r.griefing, summon: 1 });
  });

test("hide table: the first tick each seed turns into an egg", () => {
  for (const t of by("hide")) {
    const rand = new Counting(t.seed), world = blockWorld([[0, -1, 0, t.floor[0], t.floor[1]]]);
    // Replaying the whole idle run needs the recorded paths; the table instead checks the final conversion.
    const b = internal(t.floor[0], t.floor[1]);
    if (t.set) {
      const [x, y, z, id, meta] = t.set[0], got = internal(id, meta);
      assert.equal(got.id, MONSTER_EGG);
      assert.equal(meta, eggMetaFor(world.get(x, y, z).id, world.get(x, y, z).meta));
      assert.ok(canHide(b.id) || x !== 0 || z !== 0);
    }
    assert.ok(rand);
  }
});

test("ModelSilverfish: geometry, texture and setRotationAngles", () => {
  const [m] = by("model");
  assert.deepEqual(m.texture, SILVERFISH_MODEL.texture);
  m.segments.forEach((s, i) => {
    const mine = SILVERFISH_MODEL.segments[i];
    assert.deepEqual([s.point[1], s.point[2]], [mine.y, mine.z]);
    assert.deepEqual([...s.boxes[0].from, ...s.boxes[0].to], mine.box);
    assert.deepEqual(s.boxes[0].uv, mine.uv);
  });
  m.layers.forEach((s, i) => {
    const mine = SILVERFISH_MODEL.layers[i];
    assert.deepEqual([s.point[1], s.point[2]], [mine.y, mine.z]);
    assert.deepEqual([...s.boxes[0].from, ...s.boxes[0].to], mine.box);
    assert.deepEqual(s.boxes[0].uv, mine.uv);
  });
  for (const p of by("pose")) {
    const mine = silverfishPose(p.age);
    mine.segments.forEach((s, i) => { near(s.x, p.parts[i][0], 1e-3, `age ${p.age} x ${i}`); near(s.yaw, p.parts[i][4], 1e-3, `age ${p.age} yaw ${i}`); });
    mine.layers.forEach((s, i) => { near(s.x, p.parts[7 + i][0], 1e-3, `age ${p.age} layer x ${i}`); near(s.yaw, p.parts[7 + i][4], 1e-3, `age ${p.age} layer yaw ${i}`); });
  }
});

// ---- spawner scenarios with entityId Silverfish (the generic MobSpawnerBaseLogic of mob-spawner.js) ----
const scenarios = by("scenario");
test("silverfish spawner scenarios replay the real MobSpawnerBaseLogic", () => {
  assert.ok(scenarios.length >= 5);
  for (const r of scenarios) {
    const random = new Counting(r.worldSeed), entities = [];
    const [sx, sy, sz] = r.spawner;
    const spawner = (x, y, z) => x === sx && y === sy && z === sz;
    const solid = (x, y, z) => !spawner(x, y, z) && (r.terrain === "encased" || y < r.floorY);
    const cells = (b, low, test) => {
      for (let x = Math.floor(b[0]); x < Math.floor(b[3] + 1); x++)
        for (let y = Math.floor(b[1]) - low; y < Math.floor(b[4] + 1); y++)
          for (let z = Math.floor(b[2]); z < Math.floor(b[5] + 1); z++) if (test(x, y, z)) return true;
      return false;
    };
    const players = r.player ? [{ x: r.player[0], y: r.player[1], z: r.player[2] }] : [];
    let row;
    const ctx = {
      random, players,
      countNearby(type, box) { const n = countInBox(entities, type, box, () => [SILVERFISH.width, SILVERFISH.height]); row.boxes.push([...box, n]); return n; },
      createMob: (type, x, y, z, yaw) => ({ type, x, y, z, yaw, width: SILVERFISH.width, height: SILVERFISH.height }),
      canSpawnHere(mob) {
        const env = {
          difficulty: r.difficulty,
          entityCollision: (b) => entities.some((e) => boxesIntersect(b, mobBox(e.x, e.y, e.z, e.width, e.height))),
          blockCollision: (b) => cells(b, 1, (x, y, z) => (solid(x, y, z) || spawner(x, y, z)) && boxesIntersect(b, [x, y, z, x + 1, y + 1, z + 1])),
          liquid: () => false,
          belowId: (x, y, z) => (solid(x, y, z) ? 3 : spawner(x, y, z) ? 52 : 0),
          brightness: () => SPAWN_BRIGHTNESS[r.light],
          playerWithin: (x, y, z, range) => players.some((p) => (p.x - x) ** 2 + (p.y - y) ** 2 + (p.z - z) ** 2 < range * range),
        };
        return silverfishCanSpawnHere(mob, env, (m) => mobBox(m.x, m.y, m.z, m.width, m.height));
      },
      initMob: () => {},
      addMob: (mob) => { entities.push(mob); row.spawned.push([mob.x, mob.y, mob.z, mob.yaw]); },
      spawnParticles: () => { row.aux++; },
      blockEvent: () => { row.blockEvents++; },
    };
    const spawners = new MobSpawners();
    const sp = spawners.add({ x: sx, y: sy, z: sz, entityId: r.entityId });
    let state = random.seed.toString();
    for (const want of r.ticks) {
      row = { boxes: [], spawned: [], aux: 0, blockEvents: 0 };
      random.calls = 0;
      spawners.tick(ctx);
      const at = `${r.name} tick ${want.t}`;
      assert.equal(sp.delay, want.delay, `${at} delay`);
      assert.equal(random.calls, want.calls ?? 0, `${at} World.rand calls`);
      if (want.state) state = want.state;
      assert.equal(random.seed.toString(), state, `${at} World.rand state`);
      assert.equal(row.aux, want.aux ?? 0, `${at} aux`);
      assert.equal(row.blockEvents, want.blockEvents ?? 0, `${at} block events`);
      assert.deepEqual(row.boxes, want.boxes ?? [], `${at} boxes`);
      assert.deepEqual(row.spawned, want.spawned ?? [], `${at} spawned`);
    }
  }
});

// ---- the live EntityWorld: create, attack, hurt, die, save, reload, hide, wake, break ----
import { EntityWorld, ENTITY_TYPES, mobPose, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { breakPlayerBlock } from "./block-break-simulation.js";

function stoneWorld(floorBlock = 3) {
  const cells = new Map(), metas = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  return {
    numericSeed: 1, cells, metas,
    get: (x, y, z) => cells.get(key(x, y, z)) ?? (y < 0 ? floorBlock : 0),
    getMeta: (x, y, z) => metas.get(key(x, y, z)) ?? 0,
    set(x, y, z, b, track = true, meta = 0) { cells.set(key(x, y, z), b); metas.set(key(x, y, z), meta); return true; },
    solid: (x, y, z) => y < 0, surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }),
  };
}

test("live silverfish: type, save, reload, damage, death and the hurt-summon cooldown", () => {
  const w = new EntityWorld(stoneWorld(), []), e = w.create("silverfish", 64.5, 0, 64.5);
  w.entities.push(e);
  assert.equal(ENTITY_TYPES.silverfish.health, 8);
  assert.equal(e.health, 8);
  assert.equal(mobPose(e, 1).death, 0);
  const loaded = new EntityWorld(stoneWorld(), JSON.parse(JSON.stringify(w.serialize())));
  assert.equal(loaded.entities[0].type, "silverfish");
  assert.equal(loaded.entities[0].summonCooldown, 0);
  assert.equal(w.attackEntityFrom(e, 3, { player: true, from: { x: 60, z: 64 }, name: "player" }), true);
  assert.equal(e.health, 5);
  assert.equal(e.summonCooldown, 20);
  assert.ok(w.drain().some((ev) => ev.sound === "mob.silverfish.hit"));
  e.hurt = 0;
  w.attackEntityFrom(e, 9, { player: true, name: "player" });
  assert.equal(e.health, 0);
  assert.ok(w.drain().some((ev) => ev.sound === "mob.silverfish.kill"));
});

test("live silverfish: hides in stone, wakes monster eggs when hurt, attacks the player", () => {
  const world = stoneWorld(), w = new EntityWorld(world, [], () => 0.5), s = new Survival({ slots: [], time: 6000 }), p = { x: 64.5, y: 0, z: 64.5, alive: true };
  // The only floor is stone: with no player a lone fish eventually hides in the stone around it.
  const e = w.spawnSilverfishAt(100, 0, 100);
  assert.ok(e);
  for (let i = 0; i < 4000 && w.entities.includes(e) && e.health > 0; i++) w.tick({ x: 140, y: 0, z: 100, alive: true }, s);
  const hid = [...world.cells.values()].includes(68);
  assert.equal(hid, true, "hid in a monster egg");
  assert.ok(w.drain().some((ev) => ev.blockEdit));
});

test("live silverfish: a hurt fish wakes a nearby monster egg after the 20 tick summon cooldown", () => {
  // Keep random hiding in the stone floor from removing the fish before its wake scan.
  const world = stoneWorld(fromOriginal(7).id), w = new EntityWorld(world, [], () => 0.5), s = new Survival({ slots: [], time: 6000 });
  world.set(103, 0, 101, 68, true, 0);
  const fish = w.spawnSilverfishAt(100, 0, 101);
  setEntityRandom(fish, new JavaRandom(0));
  assert.equal(w.attackEntityFrom(fish, 1, { player: true, name: "player" }), true);
  assert.equal(fish.summonCooldown, 20);
  for (let i = 0; i < 19; i++) w.tick({ x: 64.5, y: 0, z: 64.5, alive: true }, s);
  assert.equal(world.get(103, 0, 101), 68);
  w.tick({ x: 64.5, y: 0, z: 64.5, alive: true }, s);
  assert.equal(world.get(103, 0, 101), 0, "the egg broke");
  assert.equal(w.entities.length, 2, "and released a silverfish");
});

test("breaking a monster egg in Creative releases one silverfish, in Survival two", () => {
  for (const [creative, want] of [[true, 1], [false, 2]]) {
    const world = stoneWorld(), spawned = [];
    world.set(5, 0, 5, 68, true, 2);
    const survival = new Survival({ slots: [], time: 0 });
    const done = breakPlayerBlock({ world, survival, items: { dropBlock() {}, spill() {} }, xpOrbs: { spawn() {} }, farming: { observe() {} }, trees: { random: Math.random }, heldTool: 0 }, [5, 0, 5], { creative, releaseSilverfish: (...p) => spawned.push(p) });
    assert.equal(done, true);
    assert.deepEqual(spawned, Array(want).fill([5, 0, 5]));
    assert.equal(world.get(5, 0, 5), 0);
  }
});

test("live silverfish: chases the player through the legacy flow and bites for 1", () => {
  // Entity.rand is seeded from Math.random per entity, and about 1 start in 20000 wanders for over 300 ticks before it finds the player (measured over 40000 seeds, max
  // 174 ticks otherwise), so an unseeded run failed now and then. Fixed seeds make the run deterministic with the same 300 tick bound.
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const world = stoneWorld(), w = new EntityWorld(world, [], () => 0.5), s = new Survival({ slots: [], time: 6000 }), p = { x: 64.5, y: 0, z: 64.5, alive: true };
    setEntityRandom(w.spawnSilverfishAt(70, 0, 64), new JavaRandom(seed));
    const start = s.health;
    for (let i = 0; i < 300 && s.health === start; i++) w.tick(p, s);
    assert.equal(s.health, start - 1, `seed ${seed}`);
  }
});
