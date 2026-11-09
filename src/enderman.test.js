import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JavaRandom } from "./java-random.js";
import * as E from "./enderman.js";

// tools/probes/EndermanProbe.java (tools/verify-enderman.mjs): the unchanged EntityEnderman (ya) of 1.7.10 on a block-map
// world double. Every row below replays one probe row; the Random rows replay the exact draw order of the original.
const reference = JSON.parse(await readFile(new URL("../public/research/enderman-reference.json", import.meta.url)));
const f = Math.fround;
const rng = (seed) => new JavaRandom(BigInt.asIntN(64, BigInt(seed) * 0x9e3779b97f4a7c15n));
const key = (x, y, z) => `${x},${y},${z}`;
const LIQUID = new Set([8, 9, 10, 11]);

// The probe's world double: stone below y 0, a settable block map, switches for daylight, sky, rain, line of sight.
function makeWorld(opts = {}) {
  const w = {
    blocks: new Map(), metas: new Map(), day: false, sky: false, light: 0, raining: false, blocked: false, exists: true,
    sounds: [], particles: 0, attempts: 0,
    block: (x, y, z) => w.blocks.get(key(x, y, z)) ?? (y < 0 ? 1 : 0),
    blockId: (x, y, z) => w.block(x, y, z),
    blockMeta: (x, y, z) => w.metas.get(key(x, y, z)) ?? 0,
    blockExists: () => { w.attempts++; return w.exists; },
    blocksMovement: (x, y, z) => { const b = w.block(x, y, z); return b !== 0 && !LIQUID.has(b); },
    isNormalCube: (x, y, z) => w.block(x, y, z) !== 0 && !LIQUID.has(w.block(x, y, z)),
    collides: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY) - 1; y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++)
            if (w.blocksMovement(x, y, z) && x + 1 > b.minX && x < b.maxX && y + 1 > b.minY && y < b.maxY && z + 1 > b.minZ && z < b.maxZ) return true;
      return false;
    },
    liquidIn: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY); y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++) if (LIQUID.has(w.block(x, y, z))) return true;
      return false;
    },
    setBlock: (x, y, z, id, meta) => { w.blocks.set(key(x, y, z), id); w.metas.set(key(x, y, z), meta); },
    canSeeSky: () => w.sky, brightness: () => w.light, isDaytime: () => w.day, rainingAt: () => w.raining,
    lineBlocked: () => w.blocked, mobGriefing: () => true,
    sound: (name, x, y, z, volume, pitch) => w.sounds.push({ name, x, y, z, volume, pitch }),
    particle: (name) => { if (name === "portal") w.particles++; },
    ...opts,
  };
  return w;
}
const slab = (w) => { for (let x = -40; x <= 40; x++) for (let z = -40; z <= 40; z++) w.blocks.set(key(x, 0, z), 1); };
const ender = (x, y, z, extra = {}) => ({ ...E.endermanFields(), x, y, z, health: 40, ...extra });
const far = { x: 5000, y: 1.62, z: 5000, yaw: 0, pitch: 0, helmet: 0 };
const dist = (e, x, y, z) => Math.hypot(e.x - x, e.y - y, e.z - z);
const parseSound = (s) => { const [name, volume, pitch, at] = s.split("|"); return { name, volume: Number(volume), pitch: Number(pitch), at: at ? at.split(",").map(Number) : null }; };

test("the constants are the original's", () => {
  const r = reference.facts;
  assert.equal(E.ENDERMAN_WIDTH, f(r.width));
  assert.equal(E.ENDERMAN_HEIGHT, f(r.height));
  assert.equal(E.ENDERMAN_STEP_HEIGHT, r.stepHeight);
  assert.equal(E.ENDERMAN_HEALTH, r.maxHealth);
  assert.equal(r.health, 40);
  assert.equal(E.ENDERMAN_SPEED, r.speed);
  assert.equal(E.ENDERMAN_ATTACK, r.attack);
  assert.equal(E.ENDERMAN_XP, r.experience);
  assert.equal(E.ENDERMAN_EYE_HEIGHT, f(r.enderEyeHeight));
  assert.equal(E.PLAYER_EYE_OFFSET, f(r.playerEyeHeight));
  assert.deepEqual([...E.CARRIABLE].sort((a, b) => a - b), r.carriable);
  assert.equal(r.carried, 0);
  assert.equal(r.screaming, false);
  assert.equal(reference.dropItem.id, 368);
});

test("the speed attribute: 0.3, plus the 6.2 attacking boost while it has a target", () => {
  assert.equal(E.moveSpeed({ speedBoost: false }), f(0.30000001192092896));
  assert.equal(E.moveSpeed({ speedBoost: true }), f(6.5));
  const sanitized = E.endermanFieldsFrom({ carried: 3, carriedData: 2, screaming: true });
  assert.deepEqual(sanitized, { ...E.endermanFields(), carried: 3, carriedData: 2 });
  assert.deepEqual(E.endermanFieldsFrom({ carried: 300, carriedData: 2 }), E.endermanFields());
  assert.deepEqual(E.endermanFieldsFrom({ carried: 0, carriedData: 7 }), E.endermanFields());
});

test("shouldAttackPlayer matches the original over distances, aim offsets, looks, helmets and line of sight", () => {
  assert.equal(reference.stare.length, 1626);
  let stares = 0;
  for (const row of reference.stare) {
    const w = makeWorld({ blocked: row.blocked });
    const e = ender(...row.ender);
    const p = { x: row.player[0], y: row.player[1], z: row.player[2], yaw: row.yaw, pitch: row.pitch, helmet: row.helmet };
    assert.equal(E.staresAt(e, p, w), row.result, JSON.stringify(row));
    stares += row.result;
  }
  assert.ok(stares > 300 && stares < reference.stare.length - 300, "the grid straddles the threshold");
  assert.ok(reference.stare.some((r) => r.helmet === 86 && !r.result) && reference.stare.some((r) => r.helmet === 91 && r.result), "pumpkin exempts, jack-o-lantern does not");
  assert.ok(reference.stare.some((r) => r.blocked && !r.result));
});

test("findPlayerToAttack: stare sound on the first tick, scream and target on the sixth", () => {
  assert.equal(reference.stareSeq.length, 3);
  for (const seq of reference.stareSeq) {
    const w = makeWorld();
    const e = ender(0.5, 0, 6.5);
    const p = { x: 0.5, y: 1.62, z: 0.5, yaw: seq.variant === 2 ? 90 : 0, pitch: 0, helmet: 0 };
    seq.ticks.forEach((row, t) => {
      w.sounds.length = 0;
      if (seq.variant === 1 && t === 3) p.yaw = 90;
      const found = E.findPlayerToAttack(e, p, w) !== null;
      assert.deepEqual([found, e.stareCount, e.aggressive, e.screaming], [row.found, row.counter, row.aggressive, row.screaming], `variant ${seq.variant} tick ${t}`);
      assert.deepEqual(w.sounds.map((s) => [s.name, s.volume, s.pitch, s.x, s.y, s.z]), row.sounds.map(parseSound).map((s) => [s.name, s.volume, s.pitch, ...s.at]));
    });
  }
  assert.equal(E.findPlayerToAttack(ender(0, 0, 0), null, makeWorld()), null);
});

function terrain() {
  const w = makeWorld();
  slab(w);
  for (let y = 1; y <= 7; y++) w.blocks.set(key(3, y, 3), 1);
  w.blocks.set(key(5, 1, 5), 9);
  w.blocks.set(key(7, 3, 7), 1);
  w.blocks.set(key(9, 5, -10), 1);
  return w;
}

test("teleportTo: lands on solid ground, rejects solids and liquid, 128 particles and two portal sounds", () => {
  assert.equal(reference.teleportTo.length, 9);
  for (const row of reference.teleportTo) {
    const w = terrain();
    const e = ender(0.5, 1, 0.5);
    const ok = E.teleportTo(e, ...row.target, w, rng(1));
    assert.equal(ok, row.success, row.name);
    assert.deepEqual([e.x, e.y, e.z], row.pos, row.name);
    assert.equal(w.particles, row.particles, row.name);
    assert.equal(w.sounds.length, row.sounds.length, row.name);
    if (ok) {
      const first = parseSound(row.sounds[0]);
      assert.deepEqual([w.sounds[0].name, w.sounds[0].x, w.sounds[0].y, w.sounds[0].z, w.sounds[0].volume, w.sounds[0].pitch], [first.name, ...first.at, first.volume, first.pitch]);
      assert.equal(w.sounds[1].name, "mob.endermen.portal");
    }
  }
  assert.ok(reference.teleportTo.some((r) => r.success) && reference.teleportTo.some((r) => !r.success));
  assert.deepEqual(reference.teleportTo.filter((r) => !r.success).map((r) => r.name), ["inside stone column", "over water", "under low ceiling", "below floor"]);
});

test("teleportRandomly and teleportToEntity replay the original draw by draw", () => {
  let ok = 0;
  for (const row of reference.teleportRandom) {
    const w = makeWorld(); slab(w);
    const e = ender(0.5, 20, 0.5);
    const r = E.teleportRandomly(e, w, rng(row.seed));
    assert.equal(r, row.success, `seed ${row.seed}`);
    assert.deepEqual([e.x, e.y, e.z], row.pos, `seed ${row.seed}`);
    assert.equal(w.sounds.length, row.sounds);
    ok += r;
  }
  assert.equal(ok, 67);
  let near = 0;
  for (const row of reference.teleportToEntity) {
    const w = makeWorld(); slab(w);
    const e = ender(10.5, 1, 12.5);
    const r = E.teleportToEntity(e, { x: -4.5, y: 0.12, z: 3.5, eye: E.PLAYER_EYE_OFFSET }, w, rng(row.seed));
    assert.equal(r, row.success, `seed ${row.seed}`);
    assert.deepEqual([e.x, e.y, e.z], row.pos, `seed ${row.seed}`);
    near += r;
  }
  assert.equal(near, 17); // with the server player's 1.62 eye added to the offset (batch 33); 23 with the old 0.12
});

test("attackEntityFrom: projectiles teleport and never hurt, a player hit enrages, the rest scream", () => {
  const sources = {
    player: { direct: true, player: true }, arrow: { direct: true, player: true, projectile: true },
    mob: { direct: true, player: false }, drown: {}, generic: {},
  };
  // sv.a runs the draws of the knockback and hurt-sound path before the pitch: 4 floats for an entity source, 0 for drowning.
  const before = { player: 4, mob: 4, drown: 0 };
  for (const row of reference.hurt) {
    const w = makeWorld(); slab(w);
    const e = ender(0.5, 1, 0.5);
    const r = rng(row.seed), start = { ...e };
    const out = E.attackEntityFrom(e, sources[row.kind], w, r);
    assert.equal(out.result, row.result, `${row.kind} ${row.seed}`);
    if (out.proceed) e.health -= 4;
    assert.deepEqual([e.health, e.screaming, e.aggressive, dist(e, start.x, start.y, start.z) > 3], [row.health, row.screaming, row.aggressive, row.moved], `${row.kind} ${row.seed}`);
    if (out.proceed && row.kind in before) {
      for (let i = 0; i < before[row.kind]; i++) r.nextFloat();
      assert.equal(E.soundPitch(r), f(parseSound(row.sounds[0]).pitch), `${row.kind} ${row.seed} pitch`);
    }
    if (out.proceed) assert.equal(row.sounds[0].split("|")[0], E.SOUNDS.hit);
  }
  // 64 failed teleports: false, no damage.
  const w = makeWorld({ exists: false });
  const e = ender(0, 1, 0);
  assert.deepEqual(E.attackEntityFrom(e, { projectile: true }, w, rng(3)), { result: false, proceed: false });
  assert.equal(w.attempts, 64);
});

test("drops: 0 to 1 + looting ender pearls, and the carried block is not dropped", () => {
  for (const row of reference.drops) {
    const histogram = [0, 0, 0, 0, 0, 0];
    for (let seed = 0; seed < row.seeds; seed++) histogram[E.pearlCount(rng(seed), row.looting)]++;
    assert.deepEqual(histogram, row.histogram, `looting ${row.looting}`);
  }
  assert.equal(E.pearlCount(rng(1), -3), E.pearlCount(rng(1), 0));
  assert.equal(E.livingSound({ screaming: true }), "mob.endermen.scream");
  assert.equal(E.livingSound({ screaming: false }), "mob.endermen.idle");
});

const idle = (r, extra = {}) => ({ rng: r, target: null, dropTarget() {}, wet: false, burning: false, hurt() {}, distanceSq: () => 0, ...extra });

test("picking up: 1/20 per tick, a random cell, only carriable blocks, with their metadata", () => {
  const picks = new Map(reference.pick.map((r) => [r.seed, r]));
  let count = 0;
  for (let seed = 0; seed < reference.pickTotal.seeds; seed++) {
    const w = makeWorld();
    for (let x = -4; x <= 4; x++) for (let y = 0; y <= 6; y++) for (let z = -4; z <= 4; z++) {
      const h = (((x * 31 + y * 17 + z * 13) % 5) + 5) % 5;
      w.blocks.set(key(x, y, z), [3, 12, 1, 86, 0][h]);
      w.metas.set(key(x, y, z), (x + z) & 3);
    }
    const e = ender(0.5, 2, 0.5);
    E.tick(e, w, idle(rng(seed)));
    const want = picks.get(seed);
    assert.deepEqual([e.carried, e.carriedData], want ? [want.carried, want.carriedData] : [0, 0], `seed ${seed}`);
    if (want) {
      count++;
      assert.ok([...w.blocks.values()].filter((b) => b === 0).length > 0, "the cell became air");
    }
  }
  assert.equal(count, reference.pickTotal.picks);
});

test("placing: 1/2000 per tick into an air cell with a normal cube below", () => {
  const placed = new Map(reference.place.map((r) => [r.seed, r]));
  let count = 0;
  for (let seed = 0; seed < reference.placeTotal.seeds; seed++) {
    const w = makeWorld();
    const e = ender(0.5, 0, 0.5, { carried: 3, carriedData: 2 });
    E.tick(e, w, idle(rng(seed)));
    const want = placed.get(seed);
    assert.equal(e.carried === 0, !!want, `seed ${seed}`);
    if (want) {
      count++;
      assert.deepEqual([...w.blocks].map(([k, id]) => [...k.split(",").map(Number), id, w.metas.get(k)]), want.blocks);
      assert.equal(e.carriedData, 0);
    }
  }
  assert.equal(count, reference.placeTotal.placed);
});

const ENVS = {
  night: {}, sun: { day: true, sky: true, light: f(0.9) }, shade: { day: true, light: f(0.9) }, water: { wet: true },
  rain: { raining: true, wet: true }, dimSun: { day: true, sky: true, light: f(0.45) },
};

test("daylight under open sky, water and rain teleport it; water and rain hurt it by 1", () => {
  const moved = {};
  for (const row of reference.tick) {
    const { wet, ...opts } = ENVS[row.env];
    const w = makeWorld(opts); slab(w);
    const e = ender(0.5, 1, 0.5, { screaming: true, aggressive: true });
    const r = rng(row.seed);
    E.tick(e, w, idle(r, { wet: !!wet, hurt: (src) => { const o = E.attackEntityFrom(e, src, w, r); if (o.proceed) { e.health -= 1; r.nextFloat(); r.nextFloat(); } } }));
    assert.deepEqual([dist(e, 0.5, 1, 0.5) > 3, e.health, e.screaming, e.aggressive, e.carried], [row.moved, row.health, row.screaming, row.aggressive, row.carried], `${row.env} ${row.seed}`);
    moved[row.env] = (moved[row.env] ?? 0) + row.moved;
  }
  assert.deepEqual(moved, { night: 0, sun: 7, shade: 0, water: 173, rain: 173, dimSun: 0 });
});

test("chase: a player target that is not staring is followed after 30 ticks beyond 16 blocks; a staring one makes it blink", () => {
  assert.ok(reference.chase.every((c) => c.firstTeleportTick >= 30 && c.firstTeleportTick <= 40));
  const target = { id: "player", x: 0.5, y: 0.12, z: 0.5, eye: E.PLAYER_EYE_OFFSET };
  const attempts = (player, e, ticks, distSq) => {
    const w = makeWorld({ exists: false });
    const t = { ...target, player };
    const log = [];
    for (let i = 1; i <= ticks; i++) {
      const before = w.attempts;
      E.tick(e, w, idle(rng(i), { target: t, distanceSq: () => distSq }));
      log.push(w.attempts - before);
    }
    return log;
  };
  // Feet 0.12: the server player's eye (feet + 1.62) is at 1.74 as these ender positions were laid out for.
  const away = { x: 0.5, y: 0.12, z: 0.5, yaw: 90, pitch: 0, helmet: 0 }, staring = { x: 0.5, y: 0.12, z: 0.5, yaw: 0, pitch: 0, helmet: 0 };
  const log = attempts(away, ender(0.5, 1, 30.5), 33, 900);
  assert.deepEqual(log.slice(0, 29), new Array(29).fill(0));
  assert.deepEqual(log.slice(29), [1, 1, 1, 1], "the first attempt is tick 30 and every later tick retries while it fails");
  assert.deepEqual(attempts(away, ender(0.5, 1, 10.5), 40, 100), new Array(40).fill(0), "within 16 blocks it just walks");
  const e = ender(0.5, 0.29, 6.5);
  assert.deepEqual(attempts(staring, e, 3, 36), [1, 1, 1], "a staring player within 16 blocks: teleportRandomly each tick");
  assert.equal(e.chaseTimer, 0);
  assert.deepEqual(attempts(staring, ender(0.5, 0.29, 30.5), 40, 900), new Array(40).fill(0), "a staring player far away: nothing");
});

test("speed boost follows the target", () => {
  const w = makeWorld(), e = ender(0.5, 1, 0.5);
  E.tick(e, w, idle(rng(1), { target: { id: "a", x: 9, y: 1, z: 9, eye: 0 } }));
  assert.equal(e.speedBoost, true);
  E.tick(e, w, idle(rng(2), { target: { id: "a", x: 9, y: 1, z: 9, eye: 0 } }));
  assert.equal(e.speedBoost, true);
  E.tick(e, w, idle(rng(3)));
  assert.equal(e.speedBoost, false);
});

test("the probe reference is of the unchanged 1.7.10 classes", () => {
  assert.equal(reference.clientSha1, "e80d9b3bf5085002218d4be59e668bac718abbc6");
  assert.deepEqual(Object.keys(reference.classes), ["ya", "yg", "td", "sv", "bhk", "bnm"]);
});
