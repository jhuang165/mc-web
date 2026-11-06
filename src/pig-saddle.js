// Minecraft Java 1.7.10 saddled pigs: EntityPig (wo) saddle flag, interact and drops, EntityAIControlledByPlayer (ub),
// ItemSaddle (adt) and ItemCarrotOnAStick (abp). Pure rules; ai.js runs the task, entities.js / horse-live.js the seat,
// player-edit-simulation.js the interaction. public/research/pig-saddle-reference.json (tools/verify-pig-saddle.mjs)
// is the native evidence; pig-saddle.md lists what is ported.
import { isStair } from "./stairs.js";
import { isSlab } from "./stone-utility.js";
import { isWoodSlab } from "./shaped-blocks.js";
import { getVerticalOffset } from "./pathfinding.js";
import { slipperiness } from "./world.js";

const f = Math.fround;
export const CARROT_ON_A_STICK = 2100, CARROT_ON_A_STICK_ORIGINAL = 398, STICK_DURABILITY = 25, BOOST_COST = 7;
export const SADDLE = 363, FISHING_ROD = 700, CARROT = 322;
// new ub(pig, 0.3F); Entity.getMountedYOffset: (double) height * 0.75.
export const MAX_SPEED = f(0.3);
export const PIG_MOUNTED_OFFSET = f(0.9) * 0.75;
// Native task list (facts row): swim 0, panic 1, ControlledByPlayer 2, mate 3, tempt 4 (carrot on a stick) and 4 (carrot),
// follow parent 5, wander 6, watch the player (6 blocks) 7, look idle 8.
export const PIG_TASK_PRIORITIES = { swim: 0, panic: 1, control: 2, mate: 3, tempt: 4, follow: 5, wander: 6, watch: 7, idle: 8 };

// MathHelper.sin / cos: the 65536-entry float table.
const SIN = Float32Array.from({ length: 65536 }, (_, i) => f(Math.sin((i * Math.PI * 2) / 65536)));
const sin = (x) => SIN[Math.trunc(f(x * f(10430.378))) & 65535];
const cos = (x) => SIN[Math.trunc(f(f(x * f(10430.378)) + 16384)) & 65535];
// MathHelper.wrapAngleTo180_float.
const wrap = (a) => {
  a = f(a % 360);
  if (a >= 180) a = f(a - 360);
  if (a < -180) a = f(a + 360);
  return a;
};
// ub.a(aji): render type 10 (stairs) or a BlockSlab (single and double slabs).
export const stairOrSlab = (id) => isStair(id) || isSlab(id) || isWoodSlab(id);

// wo.bE: the rider holds a carrot on a stick.
export const canBeSteered = (heldId) => heldId === CARROT_ON_A_STICK;
// ub.a (shouldExecute; continueExecuting is the same): alive, a player rider, and boosted or steerable.
export const controlShouldExecute = ({ alive, playerRider, boosted, heldId }) => !!alive && !!playerRider && (!!boosted || canBeSteered(heldId));
export const controlState = () => ({ speed: 0, boosted: false, boostTime: 0, maxBoostTime: 0 });
// ub.c (startExecuting) and ub.d (resetTask).
export const controlStart = (t) => { t.speed = 0; };
export const controlReset = (t) => { t.boosted = false; t.speed = 0; };
// ub.h (isControlledByPlayer): not boosting and faster than 30 % of the top speed.
export const controlledByPlayer = (t) => !t.boosted && t.speed > f(MAX_SPEED * f(0.3));
// ub.g: a boost lasting nextInt(841) + 140 ticks on the pig's Random.
export function controlBoost(t, rand) {
  t.boosted = true;
  t.boostTime = 0;
  t.maxBoostTime = rand.nextInt(841) + 140;
}

// ub.e (updateTask). `pig` has x, y, z, rotationYaw (degrees), onGround, width, height and aiMoveSpeed
// (EntityLivingBase.getAIMoveSpeed, the last move helper speed). `env`: riderYaw, riderHeight, creative, world (get),
// rand (the pig's Random), jump() (the jump helper), wear() (damage the held stick by 1; ub replaces a broken one with
// a fishing rod) and move(forward) (moveEntityWithHeading(0, forward)). Returns the forward value it moved with.
export function controlTick(t, pig, env) {
  let turn = f(wrap(f(env.riderYaw - pig.rotationYaw)) * f(0.5));
  if (turn > 5) turn = 5;
  if (turn < -5) turn = -5;
  pig.rotationYaw = wrap(f(pig.rotationYaw + turn));
  if (t.speed < MAX_SPEED) t.speed = f(t.speed + f(f(MAX_SPEED - t.speed) * f(0.01)));
  if (t.speed > MAX_SPEED) t.speed = MAX_SPEED;
  const x = Math.floor(pig.x), y = Math.floor(pig.y), z = Math.floor(pig.z), world = env.world;
  let speed = t.speed;
  if (t.boosted) {
    if (t.boostTime++ > t.maxBoostTime) t.boosted = false;
    speed = f(speed + f(f(speed * f(1.15)) * sin(f(f(f(t.boostTime) / f(t.maxBoostTime)) * f(3.1415927)))));
  }
  let slip = f(0.91);
  if (pig.onGround) slip = f(slipperiness(world.get(x, y - 1, z)) * f(0.91));
  const accel = f(f(0.16277136) / f(f(slip * slip) * slip));
  const yaw = f(f(pig.rotationYaw * f(3.1415927)) / f(180)), s = sin(yaw), c = cos(yaw);
  const base = f(f(pig.aiMoveSpeed ?? 0) * accel), step = f(speed * f(base / Math.max(speed, 1)));
  let dx = f(-f(step * s)), dz = f(step * c);
  const half = f(f(pig.width) / 2);
  if (Math.abs(dx) > Math.abs(dz)) {
    if (dx < 0) dx = f(dx - half);
    if (dx > 0) dx = f(dx + half);
    dz = 0;
  } else {
    dx = 0;
    if (dz < 0) dz = f(dz - half);
    if (dz > 0) dz = f(dz + half);
  }
  const nx = Math.floor(pig.x + dx), nz = Math.floor(pig.z + dz);
  const foot = Math.floor(f(f(pig.width) + 1)), size = { x: foot, y: Math.floor(f(f(f(pig.height) + f(env.riderHeight)) + 1)), z: foot };
  if (x !== nx || z !== nz) {
    const b = world.get(x, y, z), clear = !stairOrSlab(b) && (b !== 0 || !stairOrSlab(world.get(x, y - 1, z)));
    const offset = (px, py, pz) => getVerticalOffset(pig, px, py, pz, size, false, false, true, world, env.classify);
    if (clear && offset(nx, y, nz) === 0 && offset(x, y + 1, z) === 1 && offset(nx, y + 1, nz) === 1) env.jump();
  }
  if (!env.creative && t.speed >= f(MAX_SPEED * f(0.5)) && env.rand.nextFloat() < f(0.006) && !t.boosted) env.wear();
  env.move(speed);
  return speed;
}

// ItemCarrotOnAStick.onItemRightClick: riding a pig that is controlled (ub.h) with at least 7 durability left boosts
// and costs 7; a stick broken by it becomes a fishing rod with the old tag. `damage` is the stick's item damage.
export function stickUse({ ridingPig, controlled, damage }) {
  if (!ridingPig || !controlled || STICK_DURABILITY - damage < BOOST_COST) return { boost: false, cost: 0 };
  return { boost: true, cost: BOOST_COST };
}

// ItemSaddle.itemInteractionForEntity (adt.a(add, yz, sv)): true for any pig; an adult unsaddled pig is saddled,
// plays mob.horse.leather at 0.5 / 1.0 and takes one saddle. hitEntity calls it and always returns true.
export function saddleUse({ pig, saddled, child }) {
  if (!pig) return { result: false, saddle: false };
  if (saddled || child) return { result: true, saddle: false };
  return { result: true, saddle: true, sound: { name: "mob.horse.leather", volume: 0.5, pitch: 1 } };
}
export const saddleHit = (target) => ({ ...saddleUse(target), result: true });

// wo.a(yz) after EntityAnimal.interact declined: a saddled pig with a free seat (or this player in it) mounts the player.
export const pigMounts = ({ saddled, riderFree, riderIsPlayer }) => !!saddled && (riderFree || riderIsPlayer);

// wo.b(boolean, int): a saddled pig also drops its saddle, after the porkchops.
export const saddleDrops = (saddled) => (saddled ? [SADDLE] : []);
