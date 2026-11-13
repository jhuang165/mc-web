// Batch 57: the horse client copy's living sound draws and the server horse's watcher-16 flag starters.
// Replays public/research/horse-sounds-reference.json (tools/probes/HorseCopyProbe.java `sound`, `flags`, `graze`: the unchanged wi (EntityHorse), executed) against
// horse-copy.js (stepHorseCopy), horse-live.js (horseHurt, horseRear, horseJump, horseTick), horse-gear-live.js (leashTick) and entities.js.
import test from "node:test";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { stepHorseCopy, horseFlagsOf, HORSE_EATING, HORSE_REARING, HORSE_MOUTH } from "./horse-copy.js";
import { EntityWorld, setEntityRandom, entityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";

const ref = JSON.parse(await readFile(new URL("../public/research/horse-sounds-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const MASK = HORSE_EATING | HORSE_REARING | HORSE_MOUTH;

// A JavaRandom that logs its draws as the probe's Log does (bound:result, f for nextFloat).
class Log extends JavaRandom {
  log = [];
  nextInt(n) { const v = super.nextInt(n); if (n !== undefined) this.log.push(`${n}:${v}`); return v; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
}

test("the copy's living sound roll, idle pitch draws and tail roll follow the executed wi.h() on a client world (4 horses x 1500 ticks)", () => {
  assert.equal(ref.sound.length, 4);
  let sounds = 0;
  for (const s of ref.sound) {
    const c = { rand: new Log(s.seed) };
    const live = { alive: true, child: s.age < 0, type: s.type };
    s.ticks.forEach(([draws, played], i) => {
      c.rand.log.length = 0;
      const a = stepHorseCopy(c, 0, live);
      const at = `${s.name} tick ${i}`;
      assert.equal(c.rand.log.join(" "), draws, at);
      if (played) {
        sounds++;
        const [name, volume, pitch] = played[0].split("|");
        assert.deepEqual(a.sound, { sound: name, volume: f(Number(volume)), pitch: f(Number(pitch)) }, at);
      } else assert.equal(a.sound, null, at);
    });
  }
  assert.equal(sounds, ref.sound.reduce((n, s) => n + s.ticks.filter((t) => t[1]).length, 0));
  assert.ok(sounds >= 16);
});

test("a dead horse's copy draws no living sound", () => {
  const c = { rand: new Log(1) };
  stepHorseCopy(c, 0, { alive: false });
  assert.equal(c.rand.log.join(" "), "200:" + c.rand.log[0].split(":")[1]);
});

const terrain = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const horseWorld = (horse = {}) => {
  const w = new EntityWorld(terrain, [{ id: "mob-1", type: "horse", x: 64, y: 0, z: 64, health: 30, horse: { type: 0, ...horse } }], () => 0.5);
  Object.assign(w.ai.player, { x: 64, y: 0, z: 64 });
  const e = w.entities[0];
  e.onGround = true;
  return { w, e };
};
const preset = (e, r) => {
  if (r.preEating) e.horse.eating = true;
  if (r.preRearing) { e.rearing = true; e.rearTicks = 0; }
};
const same = (e, r, at) => {
  assert.equal(horseFlagsOf(e) & MASK, r.flags & MASK, at + " flags");
  assert.equal(e.mouthTicks ?? 0, r.bE, at + " bE");
  assert.equal(e.rearTicks ?? 0, r.bF, at + " bF");
};

test("hurt sound (wi.aT): the mouth opens, nextInt(3) == 0 rears and stops the eating (16 executed rows)", () => {
  const rows = ref.flags.filter((r) => r.kind === "hurt");
  assert.equal(rows.length, 16);
  let rears = 0;
  for (const r of rows) {
    const { w, e } = horseWorld();
    preset(e, r);
    const rand = new Log(r.seed);
    w.horseHurt(e, rand);
    assert.equal(rand.log.join(" "), r.draws.join(" "), `hurt ${r.seed}`);
    same(e, r, `hurt ${r.seed} eat ${r.preEating}`);
    if (e.rearing) rears++;
  }
  assert.ok(rears >= 2 && rears < rows.length);
});

test("angry (wi.cJ): rear, mouth, the angry sound's two draws for a horse, none for a zombie horse or skeleton horse (4 rows)", () => {
  for (const r of ref.flags.filter((x) => x.kind === "angry")) {
    const { w, e } = horseWorld({ type: r.type });
    preset(e, r);
    const rand = new Log(r.seed);
    setEntityRandom(e, rand);
    w.horseRear(e, true);
    assert.equal(rand.log.join(" "), r.draws.join(" "), `angry ${r.type}`);
    same(e, r, `angry type ${r.type} eat ${r.preEating}`);
  }
});

test("jump start (wi.w(I)): a saddled horse rears at any power >= 0 and not at a negative one; unsaddled never (20 rows)", () => {
  const rows = ref.flags.filter((r) => r.kind === "jump");
  assert.equal(rows.length, 20);
  for (const r of rows) {
    const { w, e } = horseWorld({ saddled: r.saddled });
    preset(e, r);
    w.horseJump(e, r.power);
    const at = `jump ${r.power} saddled ${r.saddled} eat ${r.preEating}`;
    assert.equal(!!(horseFlagsOf(e) & HORSE_REARING), !!(r.flags & HORSE_REARING), at);
    assert.equal(!!(horseFlagsOf(e) & HORSE_EATING), !!(r.flags & HORSE_EATING), at + " eating");
    assert.equal(e.rearTicks ?? 0, r.bF, at + " bF");
  }
});

test("the idle sound opens the mouth and keeps the eating or rearing it found (executed wi.t rows)", () => {
  const rows = ref.flags.filter((r) => r.kind === "idle");
  assert.equal(rows.length, 36);
  for (const r of rows) {
    const { w, e } = horseWorld();
    preset(e, r);
    const rand = new Log(r.seed);
    setEntityRandom(e, rand);
    const first = rand.nextInt.bind(rand);
    let rolled = false;
    rand.nextInt = (n) => (!rolled && n === 1000 ? ((rolled = true), 0) : first(n)); // the roll that opens horseTalk (the probe row calls wi.t() directly)
    e.livingSoundTime = 5;
    rand.log.length = 0;
    w.horseTalk(e, (m, rd, interval) => { const t = m.livingSoundTime; m.livingSoundTime = t + 1; if (rd.nextInt(1000) >= t) return false; m.livingSoundTime = -interval; return true; });
    assert.equal(rand.log.slice(0, 1).join(" "), r.draws.join(" "), `idle ${r.seed}`);
    same(e, { ...r, bF: r.preRearing ? 0 : r.bF }, `idle ${r.seed} eat ${r.preEating} rear ${r.preRearing}`);
  }
});

test("the death sound (wi.aU) opens the mouth with no draw; the eating sound (wi.cL) draws two floats and opens it", () => {
  for (const r of ref.flags.filter((x) => x.kind === "death")) { assert.deepEqual(r.draws, []); assert.equal(r.flags & HORSE_MOUTH, HORSE_MOUTH); assert.equal(r.bE, 1); }
  for (const r of ref.flags.filter((x) => x.kind === "feed")) { assert.deepEqual(r.draws, ["f", "f"]); assert.equal(r.flags & HORSE_MOUTH, HORSE_MOUTH); assert.equal(r.sounds.length, 1); }
});

test("a lead longer than 6 stops the grass eating (wi.o(F) from td.bL; executed 4 distances)", () => {
  for (const r of ref.flags.filter((x) => x.kind === "leash")) {
    const { w, e } = horseWorld();
    e.horse.eating = true;
    w.setLeash(e, { holder: "player" }); // a fresh lead, not a restored one (a restore beyond 10 blocks drops it)
    w.ai.player.x = 64 + r.distance;
    w.leashTick(e);
    assert.equal(!!e.horse.eating, !!(r.flags & HORSE_EATING), `distance ${r.distance}`);
  }
});

test("grazing: the 300 roll starts the eating on grass, 50 more ticks stop it (executed wi.e() on a grass world, 2 seeds x 400 ticks)", () => {
  assert.equal(ref.graze.length, 2);
  let starts = 0;
  for (const g of ref.graze) {
    const grass = { ...terrain, get: (x, y, z) => (y < 0 ? 1 : 0) };
    const { w, e } = horseWorld();
    w.world = grass;
    const rand = new Log(g.seed);
    setEntityRandom(e, rand);
    g.ticks.forEach(([bits, bD, draws], i) => {
      rand.log.length = 0;
      rand.nextInt(200); // wi.e's tail roll comes first (entities.js draws it before horseTick)
      w.horseTick(e);
      const at = `graze ${g.seed} tick ${i}`;
      assert.equal(rand.log.join(" "), draws, at);
      assert.equal(!!e.horse.eating, !!(bits & HORSE_EATING), at);
      assert.equal(e.eatTicks ?? 0, bD, at + " bD");
      if (bD === 1) starts++;
    });
  }
  assert.ok(starts >= 4);
});
