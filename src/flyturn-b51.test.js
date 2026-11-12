import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EntityWorld, ENTITY_TYPES, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { JavaRandom } from "./java-random.js";
import { replayEndermanWolf, reference51, firstDivergence } from "./enderman-wolf-replay.js";
import { spawnDragonIfAbsent, setDragonRandom } from "./dragon-mobs.js";

// flyturn-b51ft-reference.json: FlyTurnProbe (tools/verify-flyturn.mjs) runs the unchanged EntityGhast (yd.h()) and EntityDragon (xa.h()) of the 1.7.10 jar for 240 full ticks each, so the
// legacy body turn (EntityLivingBase.func_110146_f) follows the action state. Row: [x, y, z, vx, vy, vz, rotationYaw, pitch, prevYaw, prevPitch, renderYawOffset, prevRenderYawOffset, rotationYawHead, prevRotationYawHead].
const ref = JSON.parse(readFileSync(new URL("../public/research/flyturn-b51ft-reference.json", import.meta.url), "utf8"));
const f = Math.fround;
const air = { numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => (y < 0 ? 1 : 0), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }) };
const dragonWorld = { numericSeed: 1, solid: () => false, surface: () => 0, spawn: () => ({ x: 0, y: 64, z: 0 }), get: () => 0, getMeta: () => 0, set: () => true, inside: () => true, streaming: true, isTicking: () => true, height: 256 };
const FIELDS = ["x", "y", "z", "vx", "vy", "vz", "rotationYaw", "rotationPitch", "prevRotationYaw", "prevRotationPitch", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead"];
const NAMES = ["x", "y", "z", "vx", "vy", "vz", "yaw", "pitch", "prevYaw", "prevPitch", "bodyYaw", "prevBodyYaw", "headYaw", "prevHeadYaw"];
const angleDiff = (a, b) => { let d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

function compare(s, e, t, check) {
  const want = s.rows[t];
  FIELDS.forEach((k, i) => {
    const at = `${s.kind} ${s.name} tick ${t + 1} ${NAMES[i]}`;
    if (i < 6) assert.ok(Math.abs(e[k] - want[i]) < 1e-9, `${at}: ${e[k]} vs ${want[i]}`);
    else if (check.has(NAMES[i])) assert.ok(angleDiff(e[k], want[i]) < 1e-3, `${at}: ${e[k]} vs ${want[i]}`);
  });
}

for (const s of ref.scenarios.filter((x) => x.kind === "ghastTurn")) {
  test(`b51ft ghast ${s.name}: yaw, body yaw and head yaw per tick`, () => {
    const w = new EntityWorld(air, [], () => 0.5), surv = new Survival({}), creative = new Survival({}, "creative");
    const e = w.create("ghast", 64.5, 40, 64.5);
    w.entities.push(e); e.health = ENTITY_TYPES[e.type].health;
    for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
    e.yaw = 0;
    setEntityRandom(e, new JavaRandom(s.seed));
    let launched = 0;
    w.fireballs.launch = () => { launched++; }; // the probe never flies the fireball it spawned: the record keeps the launch only
    const p = s.rel.length ? { x: 64.5 + s.rel[0], y: 40 + s.rel[1], z: 64.5 + s.rel[2], alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62, isPlayer: true } : null;
    const near = { x: 64.5 + 20, y: 40, z: 64.5, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62, isPlayer: true }; // a creative player is never a target and never despawns the mob
    for (let t = 0; t < 240; t++) {
      if (!p || (t + 1 > 150 && t + 1 <= 200)) w.tick(near, creative);
      else w.tick(p, surv);
      compare(s, e, t, new Set(["yaw", "bodyYaw", "headYaw", "prevYaw", "prevBodyYaw"]));
      assert.equal(launched, s.fireballs.slice(0, t + 1).reduce((a, b) => a + b, 0), `${s.name} tick ${t + 1} fireballs launched`);
    }
  });
}
for (const s of ref.scenarios.filter((x) => x.kind === "dragonTurn")) {
  test(`b51ft dragon ${s.name}: yaw and body yaw per tick`, () => {
    const w = new EntityWorld(dragonWorld, [], () => 0.5), surv = new Survival({});
    const d = spawnDragonIfAbsent(dragonWorld, w);
    for (const k of ["rotationYaw", "prevRotationYaw"]) d[k] = s.yaw;
    for (const k of ["renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) d[k] = 0;
    Object.assign(d, { x: 0, y: 128, z: 0 });
    setDragonRandom(d, new JavaRandom(s.seed));
    // no player: a dead one, so world.playerEntities is empty for the dragon's target pick (rand.nextInt(2) == 0 && !playerEntities.isEmpty())
    const p = s.rel.length ? { x: s.rel[0], y: s.rel[1], z: s.rel[2], alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 } : { x: 900, y: 70, z: 900, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62 };
    const dead = new Survival({}); dead.health = 0;
    for (let t = 0; t < 240; t++) {
      w.tick(p, s.rel.length ? surv : dead);
      compare(s, d, t, new Set(["yaw", "bodyYaw", "headYaw", "prevBodyYaw"]));
    }
  });
}

// enderman-wolf-b51sf-reference.json (EW_SET=b51sf): a silverfish pulled by a retracting piston block, executed on the unchanged classes. Batch 50 thought the port killed it earlier than the game:
// the original hides it in a block at the same tick (EntitySilverfish.updateEntityActionState: the explosion-particle draws, then setDead at tick 14 of seed 9703). setDead leaves the health
// at 7, which the port keeps as removedHealth since batch 54 (it used to report 0); every position, draw and flag matches.
test("b51sf: the silverfish pulled into a retracting block hides at the native tick (health 7 stays, kept as removedHealth since b54)", () => {
  assert.equal(reference51.records.length, 3);
  const rec = reference51.records[0];
  assert.equal(rec.rows[13][0][0][3], 7);
  assert.ok(rec.rows[14][0][0][7].length > 20, "the hide draws the explosion particles at tick 14");
  assert.equal(rec.rows[15][0][0][7].length, 0, "removed after the hide");
  const got = replayEndermanWolf(rec);
  // Batch 54 (b54so removedHealth audit): the despawn keeps the health setDead leaves (removedHealth 7), so the health now matches and the first difference is the floor cell below.
  // The original's hide writes a monster egg (97, stone) into the floor cell below the mob; the replay arena reports no write to its implicit floor (y < 0), so that one cell is dropped.
  assert.deepEqual(rec.rows[14][5][2], [[70, -1, 63, 97, 0]]);
  assert.equal(firstDivergence(rec, got)[0], 14);
  const floorless = { ...rec, rows: rec.rows.map((row, t) => (t < 14 ? row : [row[0], ...row.slice(1, 5), [row[5][0], row[5][1], [], row[5][3]], ...row.slice(6)])) };
  assert.equal(firstDivergence(floorless, got), null);
});
for (const r of reference51.records.slice(1)) {
  test(`b51sf ${r.name}: the silverfish survives the retract at health 7`, () => {
    assert.equal(firstDivergence(r, replayEndermanWolf(r)), null);
    assert.equal(r.rows.at(-1)[0][0][3], 7);
  });
}
