// Batch 85 convert85: a live squid pushing and being pushed (sv.bo -> ahb.b(sa, azt) -> Entity.o(sa) applyEntityCollision).
// Executed: tools/probes/SquidPushProbe.java (tools/verify-squid-push.mjs) -> public/research/squid-push-reference.json: two and three squids at close offsets in still water (40 ticks)
// and one squid beside a stub player (30 ticks, the player's motion recorded). Not recorded: a boat (b78-b84 boat push records cover boats).
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Survival } from "./survival.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { JavaRandom } from "./java-random.js";
import { squidStateOf, squidWet } from "./squid-bat.js";
import { WATER } from "./world.js";

const reference = JSON.parse(await readFile(new URL("../public/research/squid-push-reference.json", import.meta.url)));
const f = Math.fround;
const key = (x, y, z) => `${x},${y},${z}`;
const mapWorld = () => {
  const blocks = new Map();
  return { blocks, numericSeed: 1, solid: (x, y, z) => y < 0, get: (x, y, z) => blocks.get(key(x, y, z)) ?? (y < 0 ? 1 : WATER), getMeta: () => 0,
    set: (x, y, z, id) => blocks.set(key(x, y, z), id), surface: () => 0, spawn: () => ({ x: 64.5, y: 0, z: 64.5 }), temperatureAt: () => 0.5 };
};
const FIELDS = ["pitch", "prevPitch", "yaw", "prevYaw", "rotation", "tentacle", "prevTentacle", "motionSpeed", "rotationVelocity", "rotateSpeed", "vecX", "vecY", "vecZ"];
const counted = (r) => { const next = r.next.bind(r); r.calls = 0; r.next = (bits) => (r.calls++, next(bits)); return r; };

for (const rec of reference.records) {
  test(`${rec.name}: ${rec.squids} squid(s)${rec.player ? " and a player" : ""} push apart as sv.bo / applyEntityCollision does`, () => {
    const n = rec.squids;
    const mobs = rec.at.slice(0, n).map(([x, y, z], i) => ({ type: "squid", id: `mob-${i + 1}`, x, y, z, health: 10 }));
    const w = new EntityWorld(mapWorld(), mobs, () => 0.5);
    const p = { x: 64, y: 0, z: 64, alive: true, width: 0.6, height: 1.8, eyeHeight: 1.62, motion: { x: 0, y: 0, z: 0 } };
    // the stub's setPosition puts its box 1.62 (yOffset) below the given y, so the squid leaves its reach at tick 23 in player-1
    if (rec.player) { const [px, py, pz] = rec.at[n]; Object.assign(p, { x: px, y: py - f(1.62), z: pz }); }
    Object.assign(w.ai.player, { x: p.x, y: p.y, z: p.z });
    const rands = [], states = [];
    w.entities.slice(0, n).forEach((e, i) => {
      const seed = rec.seed + 31 * i;
      Object.assign(e, { vx: 0, vy: 0, vz: 0, renderYawOffset: 0, rotationYaw: 0, air: 300, inWater: true, onGround: false });
      states.push(squidStateOf(e, new JavaRandom(seed)));
      const r = counted(new JavaRandom(seed));
      setEntityRandom(e, r);
      rands.push(r);
    });
    w.ai.player.unticked = true; // the probe never ticks its player stub (no serverPlayerUpdate push), as the village-fight replay does
    const surv = new Survival({});
    let dry = false, compared = 0;
    rec.rows.forEach((row, t) => {
      if (dry) return;
      const before = rands.map((r) => r.calls);
      w.tick(p, surv);
      // The probe world is wet at every height; the port reads the blocks, and ws.H's box (expand(0, -0.6, 0)) leaves the water column once y + 0.6 passes a block edge: stop there.
      if (w.entities.slice(0, n).some((e) => !squidWet(w.world, e).wet)) { dry = true; return; }
      compared++;
      for (let i = 0; i < n; i++) {
        const e = w.entities[i], s = states[i], x = row[i], at = `${rec.name} tick ${x.tick} squid ${i}`;
        // The player's own tick is off (`unticked`), as in the probe. The probe logs each squid right after its own update, before the later squids' sv.bo push it: only the last squid's motion is final here (the earlier ones show in the next tick's move).
        for (const k of i === n - 1 ? ["x", "y", "z", "vx", "vy", "vz"] : ["x", "y", "z"]) assert.equal(e[k] + 0, x[k], `${at} ${k}`);
        for (const k of FIELDS) assert.equal(s[k], f(x[k]), `${at} ${k}`);
        assert.equal(rands[i].calls - before[i], x.draws, `${at} draws`);
        assert.equal(rands[i].save().seed, x.random.seed, `${at} random`);
      }
      if (rec.player) {
        const m = row[n];
        assert.equal(w.ai.player.motion.x + 0, m[0], `${rec.name} tick ${t + 1} player vx`);
        assert.equal(w.ai.player.motion.z + 0, m[2], `${rec.name} tick ${t + 1} player vz`);
      }
    });
    assert.ok(compared >= 20, `${rec.name} compared ${compared} ticks`);
  });
}
