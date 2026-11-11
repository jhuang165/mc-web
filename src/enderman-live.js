// The live adapter of EntityEnderman: builds the environment enderman.js (the probe-checked rules) needs from the running
// EntityWorld, and runs one enderman tick, the hurt hook and the night spawn. entities.js and ai.js only call into here.
import { gameRule } from "./game-rules.js";
import { toOriginal, fromOriginal } from "./block-registry.js";
import { collisionBoxes as cellBoxes, normalCube, raycast, isLiquid, HEIGHT } from "./world.js";
import * as E from "./enderman.js";
import { faceEntity } from "./silverfish.js";

const f = Math.fround, RAD = Math.PI / 180;
// Transient per-tick state kept on the record: not saved.
export const ENDERMAN_TRANSIENT = ["stareCount", "chaseTimer", "speedBoost", "prevTarget", "aggressive", "screaming"];

// The player as the stare rules see him: Java yaw (180 - view yaw), Java pitch (positive down), the head slot.
function playerView(mobs, p) {
  const look = mobs.look || { yaw: 0, pitch: 0 }, head = mobs.ai.survival?.inventory?.armor?.[3]; // armor[3] is the helmet slot
  return {
    x: p.x, y: p.y, z: p.z, yaw: f(180 - look.yaw / RAD), pitch: f(-look.pitch / RAD),
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

// The enderman's entityToAttack (bm) stays the brain's attackTarget (ai.js, tracker and damage code read it); the legacy action state
// (silverfish.js creatureActionState) reads and writes it as `target` of the mob's legacy state.
function legacyState(mobs, e) {
  const st = mobs.silverfishState(e);
  if (!Object.getOwnPropertyDescriptor(st, "target")?.get) {
    const m = mobs.ai.brain(e);
    Object.defineProperty(st, "target", { get: () => m.attackTarget, set: (v) => { m.attackTarget = v; }, configurable: true, enumerable: true });
  }
  return st;
}
const playerOf = (mobs) => { const p = mobs.ai.player; return p?.alive && !p.creative ? playerView(mobs, p) : null; };
const eyeOf = (e, p, x) => (x === e ? E.ENDERMAN_EYE_HEIGHT : x === p || x.isPlayer ? E.PLAYER_EYE_OFFSET : x.eyeHeight ?? 0);

// One tick of EntityEnderman.e() before EntityMob's update (the legacy action state, endermanThink below, comes after it in the same
// onLivingUpdate). The stare test belongs to findPlayerToAttack, which the action state calls when there is no target.
export function endermanTick(mobs, e, rng) {
  const ai = mobs.ai, m = ai.brain(e), p = ai.player, st = legacyState(mobs, e);
  if (e.carried === undefined) Object.assign(e, E.endermanFields(), { carried: 0 });
  const w = environment(mobs, e);
  const view = playerOf(mobs);
  const t = m.attackTarget;
  const target = t ? (t === p ? { id: "player", x: view?.x ?? t.x, y: view?.y ?? t.y, z: view?.z ?? t.z, player: view, eye: E.PLAYER_EYE_OFFSET } : { id: "mob", x: t.x, y: t.y, z: t.z, player: null, eye: t.eyeHeight ?? 0 }) : null; // a mob target is not a yz: no stare test
  const bx = Math.floor(e.x), bz = Math.floor(e.z);
  const wet = !!e.inWater || (!!mobs.isRaining?.() && (ai.deps.canSeeSky(bx, Math.floor(e.y), bz) || ai.deps.canSeeSky(bx, Math.floor(e.y + E.ENDERMAN_HEIGHT), bz)));
  E.tick(e, w, {
    rng, target, wet, burning: e.fire > 0,
    dropTarget: () => { m.attackTarget = null; }, // entityToAttack = null only: the path (pathToEntity) is kept
    hurt: () => mobs.attackEntityFrom(e, 1, { name: "drown" }),
    distanceSq: (q) => (e.x - q.x) ** 2 + (e.y - q.y) ** 2 + (e.z - q.z) ** 2,
    face: (tgt) => {
      st.jumping = false;
      const g = m.attackTarget;
      if (g) faceEntity(e, g, 100, 100, { eyeHeight: (x) => eyeOf(e, p, x), boxMidY: (x) => x.y });
    },
  });
}

// EntityCreature.updateEntityActionState for the enderman (ya extends yg EntityMob): the shared legacy flow with EntityEnderman.findPlayerToAttack
// (bR: the closest vulnerable player within 64 blocks, the gaze test and the stare timer). Same Entity.rand order as the original; a creative target is dropped by
// the flow itself after the tick's work.
export function endermanThink(mobs, e, t, aiMoveSpeed, entityRandom, legacyThink) {
  const ai = mobs.ai, p = ai.player;
  legacyState(mobs, e);
  ai.brain(e).navigator.setCanSwim(true); // EntityCreature paths with World.getEntityPathToXYZ(..., doors true, closed doors false, avoidsWater false, canSwim true)
  legacyThink(mobs, e, t, aiMoveSpeed, entityRandom, {
    findPlayerToAttack: () => {
      const view = playerOf(mobs);
      if (!view || !ai.closestVulnerablePlayer(e, 64)) return null;
      return E.findPlayerToAttack(e, view, environment(mobs, e)) ? p : null;
    },
  });
}

// EntityEnderman.attackEntityFrom: returns true when the normal damage should proceed.
export function endermanHurt(mobs, e, source, rng) {
  const m = mobs.ai.brain(e);
  const src = { name: source.name, projectile: !!source.projectile, direct: !!source.player && !source.projectile, player: !!source.player };
  const r = E.attackEntityFrom(e, src, environment(mobs, e), rng);
  // EntityMob.attackEntityFrom (yg.a, reached through ya.a for every direct hit): entityToAttack becomes whoever hit it, a mob as well as the player.
  if (r.proceed && source.player && mobs.ai.player?.alive) m.attackTarget = mobs.ai.player;
  else if (r.proceed && !source.player && source.attacker && source.attacker !== e && source.attacker.type) m.attackTarget = mobs.ai.brain(source.attacker);
  return r;
}

