// The live adapter of EntityEnderman: builds the environment enderman.js (the probe-checked rules) needs from the running
// EntityWorld, and runs one enderman tick, the hurt hook and the night spawn. entities.js and ai.js only call into here.
import { gameRule } from "./game-rules.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { collisionBoxes as cellBoxes, normalCube, raycast, isLiquid, hash, HEIGHT } from "./world.js";
import * as E from "./enderman.js";

const f = Math.fround, RAD = Math.PI / 180;
// Transient per-tick state kept on the record: not saved.
export const ENDERMAN_TRANSIENT = ["stareCount", "chaseTimer", "speedBoost", "prevTarget", "aggressive", "screaming"];

// The player as the stare rules see him: Java yaw (180 - view yaw), Java pitch (positive down), the head slot.
function playerView(mobs, p) {
  const look = mobs.look || { yaw: 0, pitch: 0 }, head = mobs.ai.survival?.inventory?.armor?.[3]; // armor[3] is the helmet slot
  return {
    x: p.x, y: p.y + 1.62, z: p.z, yaw: f(180 - look.yaw / RAD), pitch: f(-look.pitch / RAD),
    helmet: head?.id === 67 ? E.PUMPKIN : 0, // internal id 67 is Blocks.pumpkin (original 86)
  };
}

function environment(mobs, e) {
  const world = mobs.world, ai = mobs.ai;
  const orig = (x, y, z) => toOriginal(world.get(x, y, z), world.getMeta(x, y, z))?.id ?? 0;
  const raining = () => !!mobs.isRaining?.();
  const w = {
    blockExists: (x, y, z) => y >= 0 && y < HEIGHT,
    blocksMovement: (x, y, z) => cellBoxes(world, x, y, z).length > 0,
    blockId: (x, y, z) => (y < 0 || y >= HEIGHT ? 0 : orig(x, y, z)),
    blockMeta: (x, y, z) => toOriginal(world.get(x, y, z), world.getMeta(x, y, z))?.meta ?? 0,
    isNormalCube: (x, y, z) => normalCube(world.get(x, y, z)),
    collides: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY) - 1; y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++)
            for (const [a, c, d, g, h, i] of cellBoxes(world, x, y, z))
              if (x + g > b.minX && x + a < b.maxX && y + h > b.minY && y + c < b.maxY && z + i > b.minZ && z + d < b.maxZ) return true;
      return false;
    },
    liquidIn: (b) => {
      for (let x = Math.floor(b.minX); x < Math.floor(b.maxX + 1); x++)
        for (let y = Math.floor(b.minY); y < Math.floor(b.maxY + 1); y++)
          for (let z = Math.floor(b.minZ); z < Math.floor(b.maxZ + 1); z++) if (isLiquid(world.get(x, y, z))) return true;
      return false;
    },
    setBlock: (x, y, z, id, meta) => {
      const cell = id === 0 ? { id: 0, meta: 0 } : fromOriginal(id, meta);
      if (!cell) return;
      world.set(x, y, z, cell.id, true, cell.meta);
      mobs.events.push({ blockEdit: [[x, y, z]] });
    },
    canSeeSky: (x, y, z) => ai.deps.canSeeSky(x, y, z),
    brightness: (x, y, z) => ai.brightness(x, y, z),
    isDaytime: () => !!mobs.day,
    rainingAt: (x, y, z) => raining() && ai.deps.canSeeSky(x, y, z),
    lineBlocked: (a, b) => {
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
      return len > 1e-9 && !!raycast(world, a, { x: dx / len, y: dy / len, z: dz / len }, len);
    },
    mobGriefing: () => gameRule("mobGriefing"),
    sound: (name, x, y, z, volume, pitch) => mobs.events.push({ sound: name, volume, pitch, position: { x, y, z } }),
    particle: (_name, x, y, z, vx, vy, vz) => mobs.fx?.spawn?.("portal", x, y, z, vx, vy, vz),
  };
  return w;
}

// One tick of EntityEnderman.e() before the shared mob update. Sets the brain's attack target from the stare rule.
export function endermanTick(mobs, e, rng) {
  const ai = mobs.ai, m = ai.brain(e), p = ai.player;
  if (e.carried === undefined) Object.assign(e, E.endermanFields(), { carried: 0 });
  const w = environment(mobs, e);
  // findPlayerToAttack runs inside the task-less legacy flow while there is no target.
  const view = p?.alive && !p.creative ? playerView(mobs, p) : null;
  if (!m.attackTarget && view && ai.closestVulnerablePlayer(e, 64)) {
    if (E.findPlayerToAttack(e, view, w)) m.attackTarget = p;
  }
  const t = m.attackTarget;
  const target = t && t.alive !== false ? { id: "player", x: view?.x ?? t.x, y: view?.y ?? t.y, z: view?.z ?? t.z, player: view } : null;
  if (t && !target) m.attackTarget = null;
  const bx = Math.floor(e.x), bz = Math.floor(e.z);
  const wet = !!e.inWater || (!!mobs.isRaining?.() && (ai.deps.canSeeSky(bx, Math.floor(e.y), bz) || ai.deps.canSeeSky(bx, Math.floor(e.y + E.ENDERMAN_HEIGHT), bz)));
  E.tick(e, w, {
    rng, target, wet, burning: e.fire > 0,
    dropTarget: () => { m.attackTarget = null; m.navigator.clearPathEntity?.(); },
    hurt: () => mobs.attackEntityFrom(e, 1, { name: "drown" }),
    distanceSq: (q) => (e.x - q.x) ** 2 + (e.y - q.y) ** 2 + (e.z - q.z) ** 2,
  });
}

// EntityEnderman.attackEntityFrom: returns true when the normal damage should proceed.
export function endermanHurt(mobs, e, source, rng) {
  const m = mobs.ai.brain(e);
  const src = { name: source.name, projectile: !!source.projectile, direct: !!source.player && !source.projectile, player: !!source.player };
  const r = E.attackEntityFrom(e, src, environment(mobs, e), rng);
  if (r.proceed && source.player && mobs.ai.player?.alive) m.attackTarget = mobs.ai.player;
  return r;
}

// Overworld night ring spawn like the zombie and skeleton clocks (not the weighted SpawnerAnimals pass).
export function endermanSpawn(mobs, player, survival, allowed, { actorCollides, SIZE, ENTITY_TYPES }) {
  mobs.endermanClock = (mobs.endermanClock || 0) + 1;
  if (!allowed || survival.creative || mobs.endermanClock < 700 || mobs.entities.filter((e) => e.type === "enderman").length >= 2) return;
  mobs.endermanClock = 0;
  for (let i = 0; i < 16; i++) {
    const a = hash(i + 400, survival.time, mobs.world.numericSeed) * Math.PI * 2,
      x = Math.floor(player.x + Math.sin(a) * 24), z = Math.floor(player.z + Math.cos(a) * 24);
    if (mobs.world.streaming ? !mobs.world.isTicking(x, z) : x < 2 || z < 2 || x > SIZE - 2 || z > SIZE - 2) continue;
    const y = mobs.world.surface(x, z), t = ENTITY_TYPES.enderman;
    if (mobs.world.get(x, y - 1, z) !== 1 || actorCollides(mobs.world, x + 0.5, y, z + 0.5, t.width, t.height)) continue;
    mobs.spawnNatural("enderman", x + 0.5, y, z + 0.5);
    break;
  }
}
