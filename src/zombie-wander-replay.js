import { readFileSync } from "node:fs";
import { JavaRandom } from "./lighting.js";
import { EntityWorld, setEntityRandom } from "./entities.js";
import { Survival } from "./survival.js";
import { setGameRuleSource } from "./game-rules.js";
import { plain, LogRandom } from "./legacy-ai-replay.js";

// Replays one ZombieWanderProbe record (public/research/zombie-wander-reference.json, tools/probes/ZombieWanderProbe.java): a bare EntityZombie ticked whole on
// the unchanged 1.7.10 classes against the port's EntityWorld zombie (Brain, tasks, PathNavigate, MoveHelper, LookHelper). The probe world answers light
// brightness 15 for every cell, below the floor too, so the replay's brightness hook does the same (a hook missing there made the port's wander weigh a try
// under the floor as dark and pick another target than the native first try: the batch 41 seed 4109 "turn from tick 19").
export const zombieWanderReference = JSON.parse(readFileSync(new URL("../public/research/zombie-wander-reference.json", import.meta.url))).records;
const TASK = { vc: "Wander", vb: "LookIdle", un: "WatchClosest", uf: "Swim" };

export function replayZombieWander(r) {
  setGameRuleSource(() => true);
  const ew = new EntityWorld(plain(r.blocks), [], () => 0.5);
  ew.difficulty = 2;
  ew.brightnessLevel = () => 15;
  ew.worldRandom = new JavaRandom(r.zseed);
  ew.isDaytime = () => r.day;
  const e = ew.create("zombie", r.zombie[0], r.zombie[2] ?? 0, r.zombie[1]);
  ew.entities.push(e);
  e.growingAge = 0; e.onGround = true;
  for (const k of ["rotationYaw", "prevRotationYaw", "renderYawOffset", "prevRenderYawOffset", "rotationYawHead", "prevRotationYawHead", "bodyHeadYaw"]) e[k] = 0;
  e.yaw = 0;
  const rand = new LogRandom(BigInt(r.zseed));
  setEntityRandom(e, rand);
  const survival = new Survival({}, "survival");
  survival.difficulty = 2; survival.protection = 0; survival.health = 1000;
  const player = { x: r.player[0], y: 0, z: r.player[1], health: 1000, alive: true, width: 0.6, height: 1.8, isPlayer: true };
  ew.ai.player.unticked = true;
  const rows = [];
  let lastPath = "";
  for (let t = 0; t < r.ticks; t++) {
    for (const op of r.script) {
      const p = op.split(" ");
      if (Number(p[0]) === t && p[1] === "fire") e.fire = Number(p[2]) * 20;
    }
    ew.ai.beginTick(player, survival, 0);
    ew.events.length = 0;
    ew.tick(player, survival, 0);
    const b = ew.ai.brains.get(e), nav = b.navigator, cp = nav.currentPath, mh = b.moveHelper, lh = b.lookHelper;
    let path = null;
    if (cp) {
      const pts = cp.points.slice(0, cp.length).map((q) => [q.x, q.y, q.z]);
      const same = JSON.stringify(pts) === lastPath;
      lastPath = JSON.stringify(pts);
      path = same ? [cp.index] : [cp.index, ...pts];
    } else lastPath = "";
    rows.push([e.x, e.y, e.z, e.vx, e.vy, e.vz, e.rotationYaw, e.rotationPitch ?? 0, e.rotationYawHead, e.renderYawOffset, e.onGround ? 1 : 0, e.fire ?? 0, e.health,
      rand.log.splice(0), path, [mh.x, mh.y, mh.z, mh.speed, mh.update ? 1 : 0], [lh.looking ? 1 : 0, lh.x, lh.y, lh.z, lh.deltaYaw, lh.deltaPitch], b.tasks.running.map((x) => x.action.constructor.name)]);
  }
  return { ew, e, rows };
}

const near = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < 1e-9 : JSON.stringify(a) === JSON.stringify(b));
const FIELDS = ["x", "y", "z", "vx", "vy", "vz", "yaw", "pitch", "yawHead", "renderYawOffset", "onGround", "fire", "health", "draws", "path", "moveHelper", "lookHelper", "tasks"];
// First tick and field where a replay differs from the record (null when exact).
export function zombieWanderDivergence(r, got) {
  for (let t = 0; t < r.ticks; t++) {
    const want = r.rows[t], g = got.rows[t];
    for (let k = 0; k < FIELDS.length; k++) {
      const w = k === 17 ? want[17].map((c) => TASK[c] ?? c) : want[k];
      if (k === 15 && w.every((v) => v === 0)) continue; // a move helper never given a target: the native one was built with the zombie at (0, 0, 0) (the probe places it afterwards), the port's at its start; neither is read
      if (k === 14 || k === 15 || k === 16) { if (JSON.stringify(w) !== JSON.stringify(g[k]) && !(Array.isArray(w) && w.every((v, i) => near(v, g[k][i])))) return [t, FIELDS[k], w, g[k]]; continue; }
      if (!near(w, g[k])) return [t, FIELDS[k], w, g[k]];
    }
  }
  return null;
}
