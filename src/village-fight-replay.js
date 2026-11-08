import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { WOODEN_DOOR } from "./world.js";
import { revengeOf } from "./revenge-target.js"; // the raw field: a dead target is cleared on the target's next own update, as natively

// Replays one VillageFightProbe record (public/research/village-fight-reference.json) through the port's ticked mobs: the same village, the same
// positions, entity Randoms seeded like the probe's (seed * 10 + index) and logging their draws as the probe's Log does (nextInt(bound) "i<bound>", nextFloat
// "f", nextGaussian "g"). Per tick `states[t]` is, per entity, [x, y, z, health, attack target index, revenge target index, draws] (7 = the player, -1 none).
export const fightReference = JSON.parse(readFileSync(new URL("../public/research/village-fight-reference.json", import.meta.url)));
class LogRandom extends JavaRandom {
  log = [];
  nextInt(b) { const r = super.nextInt(b); if (b !== undefined) this.log.push("i" + b); return r; }
  nextFloat() { this.log.push("f"); return super.nextFloat(); }
  nextGaussian() { this.log.push("g"); return super.nextGaussian(); }
}
const key = (x, y, z) => `${x},${y},${z}`;
const TYPES = ["villager", "villager", "zombie", "zombie", "iron_golem", "skeleton", "skeleton"];

function plain() {
  const cells = new Map([[key(50, 0, 50), [WOODEN_DOOR, 0]], [key(50, 1, 50), [WOODEN_DOOR, 8]]]);
  return { numericSeed: 1, height: 256, get: (x, y, z) => (y < 0 ? 1 : cells.get(key(x, y, z))?.[0] ?? 0), getMeta: (x, y, z) => cells.get(key(x, y, z))?.[1] ?? 0,
    set: () => {}, put: (x, y, z, b, m) => cells.set(key(x, y, z), [b, m]), solid: (x, y, z) => y < 0 || cells.has(key(x, y, z)), surface: () => 1, spawn: () => ({ x: 5.5, y: 0, z: 5.5 }) };
}

export function replayFight(r) {
  const ew = new EntityWorld(plain(), [], () => 0.5);
  ew.difficulty = 2;
  ew.worldRandom = new JavaRandom(r.seed);
  ew.isDaytime = () => false;
  ew.lightAt = () => 15; // the probe world's getLightBrightness is 1.0 everywhere
  ew.ai.deps.canSeeSky = (x, y, z) => !(x >= 40 && x <= 49 && z >= 0 && z <= 100);
  const c = ew.villages;
  for (let t = 0; t < 5; t++) { if (t % 60 === 0) c.addVillagerPosition(52, 0, 52); c.tick(); }
  const village = c.villages[0], ents = [], logs = [], states = [];
  TYPES.forEach((type, i) => {
    const [x, z] = r.pos[i], e = type === "iron_golem" ? ew.spawnIronGolem(x, 0, z, false) : ew.create(type, x, 0, z);
    if (type !== "iron_golem") ew.entities.push(e);
    e.growingAge = 0; e.onGround = true;
    if (type === "skeleton") e.unarmed = true; // the probe skeleton holds nothing: EntitySkeleton.setCombatTask picks AttackOnCollide, not the bow

    if (type === "villager") e.profession = i;
    const lr = new LogRandom(BigInt(r.seed * 10 + i)); logs.push(lr); setEntityRandom(e, lr);
    ents.push(e);
  });
  // no village link here: each villager and the golem finds it in its own first updateAITick refresh (nextInt(50) draw), as natively
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.protection = 0; survival.health = 1000;
  const player = { x: r.pos[7][0], y: 0, z: r.pos[7][1], health: 1000, alive: true, isPlayer: true };
  ew.ai.player.unticked = true;
  const vel = [0, 0], script = r.script.map((s) => s.split(" ")), hits = [], rows = [];
  let name = "probe";
  for (let t = 0; t < r.ticks; t++) {
    for (const p of script) {
      if (Number(p[0]) !== t) continue;
      if (p[1] === "hit") {
        const v = ents[Number(p[2])], a = Number(p[3]) === 7 ? player : ents[Number(p[3])];
        const src = p[5] === "player" ? { from: { x: player.x, z: player.z }, player: true, name: "player" } : { from: { x: a.x, z: a.z }, attacker: a, shooter: p[5] === "arrow" ? a : undefined, name: p[5] === "arrow" ? "arrow" : "mob", player: false };
        hits.push([t, ew.attackEntityFrom(v, Number(p[4]), src), v.health]);
      } else if (p[1] === "walk" && p[2] === "7") { vel[0] = Number(p[3]); vel[1] = Number(p[4]); }
      else if (p[1] === "move" && p[2] !== "7") { const e = ents[Number(p[2])]; e.x = Number(p[3]); e.z = Number(p[4]); }
      else if (p[1] === "move") { player.x = Number(p[3]); player.z = Number(p[4]); }
      else if (p[1] === "rename") name = p[2];
    }
    player.x += vel[0]; player.z += vel[1];
    ew.ai.beginTick(player, survival, 0);
    for (const l of logs) l.log.length = 0;
    ew.tick(player, survival, 0);
    survival.health = 1000;
    const agg = village.aggressors.map((a) => [a.entity.isPlayer ? 7 : ents.indexOf(a.entity.e), a.tick]);
    const idx = (b) => (!b ? -1 : b.isPlayer ? 7 : ents.indexOf(b.e));
    states.push(ents.map((e, i) => [e.x, e.y, e.z, e.health, idx(ew.ai.brain(e).attackTarget), (e.revenge ? (revengeOf(e) === "player" ? 7 : ents.indexOf(revengeOf(e))) : -1), logs[i].log.slice()]));
    rows.push([agg, village.playerReputation(name === "alt" ? "Player" : "Player")]);
  }
  return { hits, rows, states };
}
