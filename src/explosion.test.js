// Replays public/research/creeper-reference.json (tools/verify-creepers.mjs): the
// unchanged 1.7.10 Explosion, Block.dropBlockAsItemWithChance, BlockTNT and
// EntityTNTPrimed classes against explosion.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { MC_IDS } from "../tools/inventory-replay.mjs";
import { explosionBlocks, explosionResistance, explodeBlocks, explosionImpact, explosionDrops, blockDensity, chainFuse, primeTnt, tickTnt, tntRender, PositionSet, TNT_Y_OFFSET } from "./explosion.js";
import { knockBack } from "./entities.js";
import { TNT, WOOL, RED_FLOWER, SAPLING, SNOW_LAYER, ICE, FIRE, CARROTS, POTATOES, WEB, LADDER, YELLOW_FLOWER, opaqueCube } from "./world.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/creeper-reference.json", import.meta.url)));
const records = (c) => ref.records.filter((r) => r.case === c);
const f = Math.fround;

// Original block id (and metadata) -> internal block id and metadata.
const BLOCK = { 1: 3, 2: 1, 3: 2, 4: 12, 5: 7, 6: SAPLING, 7: 11, 9: 10, 11: 42, 12: 6, 13: 25, 14: 18, 15: 16, 16: 15, 17: 4, 18: 5, 20: 9, 30: WEB, 35: WOOL, 37: YELLOW_FLOWER, 38: RED_FLOWER, 41: 27, 42: 26, 45: 8, 46: TNT, 47: 21, 49: 22, 50: 20, 51: FIRE, 54: 41, 56: 17, 57: 28, 58: 13, 61: 14, 65: LADDER, 78: SNOW_LAYER, 79: ICE, 80: 23, 82: 24, 141: CARROTS, 142: POTATOES, 172: 40 };
export function toGame(id, meta) {
  if (id === 0) return [0, 0];
  if (id === 59) return [31 + meta, 0];
  if (id === 60) return [meta > 0 ? 30 : 29, 0];
  if (id === 31) return [39, 0];
  const g = BLOCK[id];
  if (g === undefined) throw new Error("no block " + id);
  return [g, [WOOL, RED_FLOWER, CARROTS, POTATOES, SNOW_LAYER, LADDER].includes(g) ? meta : 0];
}
const mcItem = Object.fromEntries(Object.entries(MC_IDS).map(([mc, id]) => [id, Number(String(mc).split(":")[0])]));
export const itemToMc = (id) => mcItem[id] ?? (() => { throw new Error("no item " + id); })();

// Java's mix(seed) in CreeperProbe: seed * 0x9E3779B97F4A7C15 + 0x2545F4914F6CDD1D (64-bit).
export const mix = (seed) => BigInt.asIntN(64, BigInt(seed) * 0x9e3779b97f4a7c15n + 0x2545f4914f6cdd1dn);
const nextLong = (r) => BigInt.asIntN(64, (BigInt(r.next(32)) << 32n) + BigInt(r.next(32)));

export function fixtureWorld() {
  const blocks = new Map(), key = (x, y, z) => x + "," + y + "," + z;
  const raw = records("fixture")[0].blocks;
  for (let i = 0; i < raw.length; i += 5) {
    const [id, meta] = toGame(raw[i + 3], raw[i + 4]);
    blocks.set(key(raw[i], raw[i + 1], raw[i + 2]), [id, meta]);
  }
  return {
    get: (x, y, z) => blocks.get(key(x, y, z))?.[0] ?? (y < 0 ? 3 : 0),
    getMeta: (x, y, z) => blocks.get(key(x, y, z))?.[1] ?? 0,
    solid: (x, y, z) => opaqueCube(blocks.get(key(x, y, z))?.[0] ?? 0),
  };
}

test("explosion resistance matches Block.getExplosionResistance for every palette block", () => {
  for (const b of records("block")) {
    if (b.mc === 0) continue;
    const [id] = toGame(b.mc, b.meta);
    assert.equal(explosionResistance(id), f(b.resistance), "mc " + b.mc);
    assert.equal(b.drops, b.mc !== 46, "canDropFromExplosion " + b.mc);
  }
});

test("explosion rays reproduce the affected ArrayList order, sound pitch and world.rand use", () => {
  const world = fixtureWorld();
  for (const r of records("explode")) {
    const rand = new JavaRandom(mix(r.seed));
    const list = explosionBlocks(world, r.x, r.y, r.z, r.size, rand);
    assert.equal(list.treeified, false);
    assert.deepEqual(list.flat(), r.list, "case " + r.id);
    assert.equal(nextLong(rand), BigInt(r.afterRays), "case " + r.id);
  }
});

test("doExplosionB(false) drops, chained TNT, XP and the final world.rand state match", () => {
  const world = fixtureWorld();
  for (const r of records("explode")) {
    const rand = new JavaRandom(mix(r.seed));
    const out = explodeBlocks(world, r.x, r.y, r.z, r.size, rand, { flaming: r.flaming, opaque: opaqueCube });
    const [name, volume, pitch] = r.sounds[0].split("|");
    assert.equal(r.sounds.length, 1);
    assert.equal(name + volume, "random.explode4.0");
    assert.equal(out.pitch, f(Number(pitch)), "pitch " + r.id);
    assert.deepEqual(out.drops.map((d) => [itemToMc(d.id), d.damage, 1, d.x, d.y, d.z]), r.items, "items " + r.id);
    assert.deepEqual(out.primed.map((t) => [t.x, t.y, t.z, t.fuse]), r.tnt, "tnt " + r.id);
    assert.deepEqual(out.xp.map((o) => o.value), r.xp, "xp " + r.id);
    if (!r.flaming) assert.equal(nextLong(rand), BigInt(r.next), "next " + r.id);
    // fire only lands on air cells of the list above an opaque cube
    for (let i = 0; i < r.fires.length; i += 3) assert.ok(out.list.some(([x, y, z]) => x === r.fires[i] && y === r.fires[i + 1] && z === r.fires[i + 2]));
  }
});

test("removed block counts agree with the original setBlock calls", () => {
  const world = fixtureWorld();
  for (const r of records("explode")) {
    if (r.flaming) continue;
    const out = explodeBlocks(world, r.x, r.y, r.z, r.size, new JavaRandom(mix(r.seed)));
    assert.equal(out.broken.length, r.removed, "case " + r.id);
  }
});

test("Block.dropBlockAsItemWithChance tables replay for every palette block", () => {
  for (const r of records("bdrops")) {
    const [id, meta] = toGame(r.mc, r.meta);
    if (id === TNT) continue; // never called: canDropFromExplosion is false
    r.seeds.forEach((s, seed) => {
      const rand = new JavaRandom(mix(seed));
      const out = explosionDrops(id, meta, 2, 3, 4, f(1 / r.size), rand);
      assert.deepEqual(out.items.map((d) => [itemToMc(d.id), d.damage, 1, d.x, d.y, d.z]), s.items, `mc ${r.mc}:${r.meta} size ${r.size} seed ${seed}`);
      assert.deepEqual(out.xp, s.xp, `xp ${r.mc} seed ${seed}`);
      assert.equal(rand.nextInt(1 << 30), s.next, `rand ${r.mc}:${r.meta} seed ${seed}`);
    });
  }
});

test("getBlockDensity, damage and explosion knockback match on creeper targets", () => {
  const world = fixtureWorld();
  const eye = f(f(1.8) * f(0.85)), half = f(0.6) / 2, height = f(1.8);
  let checked = 0;
  for (const r of records("damage")) {
    for (const t of r.targets) {
      const box = [t.x - half, t.y, t.z - half, t.x + half, t.y + height, t.z + half];
      assert.equal(blockDensity(world, [r.x, r.y, r.z], box), f(t.density));
      const hit = explosionImpact(world, r.x, r.y, r.z, r.size, t.x, t.y, t.z, t.y + eye, box);
      const e = { x: t.x, z: t.z, vx: 0.01, vy: -0.0784000015258789, vz: 0 };
      if (!hit) {
        assert.equal(t.health, 20);
        assert.deepEqual([t.vx, t.vy, t.vz], [e.vx, e.vy, e.vz]);
        continue;
      }
      assert.equal(t.health, Math.max(0, 20 - hit.damage));
      if (r.exploder !== "none") {
        const dx = r.x - t.x, dz = r.z - t.z;
        if (dx * dx + dz * dz < 1e-4) continue; // Math.random heading
        const rand = new JavaRandom(11);
        knockBack(e, r.x, r.z, () => rand.nextDouble());
      }
      e.vx += hit.push[0]; e.vy += hit.push[1]; e.vz += hit.push[2];
      assert.deepEqual([e.vx, e.vy, e.vz], [t.vx, t.vy, t.vz], JSON.stringify(t));
      checked++;
    }
  }
  assert.ok(checked > 50);
});

test("chained TNT fuses and BlockTNT priming", () => {
  for (const r of records("chain")) {
    assert.equal(chainFuse(new JavaRandom(r.seed)), r.fuse);
    assert.deepEqual(r.pos, [3.5, 4.5, 5.5]);
  }
  const [plain, lit] = records("prime");
  assert.equal(plain.spawned, 0);
  assert.equal(lit.fuse, 80);
  assert.deepEqual(lit.sounds, ["game.tnt.primed|1.0|1.0"]);
});

test("EntityTNTPrimed motion, bounce and 80-tick fuse", () => {
  const facts = records("facts")[0].tnt;
  assert.equal(f(facts.yOffset), TNT_Y_OFFSET);
  for (const r of records("tnt")) {
    const solid = new Set(r.walls ? ["1,0,0", "0,0,1"] : []);
    const world = { solid: (x, y, z) => y < 0 || solid.has(x + "," + y + "," + z), get: (x, y, z) => (y < 0 || solid.has(x + "," + y + "," + z) ? 3 : 0), getMeta: () => 0 };
    const e = primeTnt(r.start[0], r.start[1], r.start[2]);
    [e.vx, e.vy, e.vz] = r.motion;
    let exploded = -1, at = null;
    r.ticks.forEach((t, i) => {
      if (exploded >= 0) return;
      const boom = tickTnt(world, e);
      // JSON.stringify writes -0.0 (the bounce of a zeroed motion) as 0.
      assert.deepEqual([e.x, e.y + TNT_Y_OFFSET, e.z, e.vx, e.vy, e.vz].map((v) => v + 0).concat([e.onGround, e.fuse]), t, "tick " + i);
      if (boom) { exploded = i; at = boom; }
    });
    assert.equal(exploded, r.explodedAt);
    assert.deepEqual([at.x, at.y, at.z], r.explosion.slice(0, 3));
    assert.equal(r.explosion[3], 4);
  }
  // (fuse / 5) % 2 == 0 draws the white copy: fuse 80 does, 75 does not.
  assert.ok(Math.abs(tntRender(80, 0).flash - 0.152) < 1e-9);
  assert.deepEqual(tntRender(75, 0), { scale: 1, flash: 0 });
  assert.equal(tntRender(0, 1).scale, 1.3);
});

test("PositionSet iterates like a Java 8 HashSet across resizes", () => {
  const s = new PositionSet();
  for (let i = 0; i < 100; i++) s.add(i % 7, i % 5, i % 3);
  assert.equal(s.size, 100); // (i mod 7, 5, 3) is distinct for i < 105
  assert.equal(s.add(1, 1, 1), false);
  assert.equal(s.list().length, 100);
});
