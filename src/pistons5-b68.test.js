// Batch 68 pistons5: carts and riders under a piston, replayed against tools/probes/PistonCartProbe.java (public/research/piston-cart-reference.json,
// tools/verify-piston-cart.mjs): the unchanged 1.7.10 classes with World.updateEntities running entity onUpdate (EntityMinecart rail snapping, updateRidden)
// before the tile entity loop's TileEntityPiston.func_145863_a pushes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fromOriginal } from "./block-registry.js";
import { pistonPushExtras } from "./piston-push.js";
import { setMovingBoxes, EntityWorld, setEntityBoxes } from "./entities.js";
import { Minecarts, Y_OFFSET } from "./minecarts.js";
import { Boats } from "./boats.js";
import { boatBoxProvider } from "./entity-collision.js";
import { solidBlock } from "./world.js";
import { RedstoneWorld, blockProperties } from "./redstone.js";
import { installShapedBlocks, trapdoorSupportOriginal } from "./shaped-blocks.js";
import { installPistons } from "./piston-live.js";
import { PISTON_HEAD, PISTON, STICKY_PISTON } from "./dispenser-piston.js";
import { mountMobOnVehicle } from "./vehicle-riders.js";
import { endRidden } from "./mob-riding.js";

const ref = JSON.parse(readFileSync(new URL("../public/research/piston-cart-reference.json", import.meta.url)));
const [ox, oy, oz] = ref.origin, [sx, sy, sz] = ref.size;
const INTERNAL = { 1: 1, 29: STICKY_PISTON, 33: PISTON, 34: PISTON_HEAD };
const blocks = { toInternal: (id, meta) => (id === 0 ? null : { id: INTERNAL[id] ?? fromOriginal(id, meta)?.id ?? id, meta: fromOriginal(id, meta)?.meta ?? meta }) };
const rand = { nextFloat: () => 0.5, nextInt: () => 0, nextDouble: () => 0.5, nextGaussian: () => 0 };

export function replay(s) {
  const w = new RedstoneWorld({ seed: s.seed }), cells = s.grid.split(",");
  installShapedBlocks(w, trapdoorSupportOriginal(blockProperties()));
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const [id, meta = 0] = cells[(x * sy + y) * sz + z].split(":").map(Number);
    if (id) w.setRaw(ox + x, oy + y, oz + z, id, meta);
  }
  const cell = (x, y, z) => blocks.toInternal(w.getBlock(x, y, z), w.getBlockMetadata(x, y, z));
  const view = { get: (x, y, z) => cell(x, y, z)?.id ?? 0, getMeta: (x, y, z) => cell(x, y, z)?.meta ?? 0, solid: (x, y, z) => { const c = cell(x, y, z); return !!c && solidBlock(c.id, c.meta); }, set() {} };
  const sys = { mobs: new EntityWorld(view, [], () => 0.5), carts: new Minecarts({ random: () => rand }), boats: new Boats(), lives: [], tick: 0 };
  const game = { minecarts: () => sys.carts, boatSystem: () => sys.boats, mobs: () => sys.mobs, player: () => null };
  const p = installPistons({ redstone: w, world: view, blocks, entities: { mobs: sys.mobs, extra: () => pistonPushExtras(view, game) } });
  setMovingBoxes((b) => p.collisionBoxes(b));
  setEntityBoxes(boatBoxProvider({ get carts() { return sys.boats.carts; } }));
  const rows = [];
  try {
    for (let tick = 1; tick <= s.ticks; tick++) {
      sys.tick = tick;
      for (const [t, op, x0, y0, z0, label, kind, vx, vy, vz] of s.events) {
        if (t !== tick) continue;
        const x = ox + x0, y = oy + y0, z = oz + z0;
        if (op === "place") w.setBlock(x, y, z, label, kind, 3);
        else if (op === "air") w.setBlockToAir(x, y, z);
        else if (op === "live") {
          const px = x + 0.5, pz = z + 0.5;
          let e;
          if (kind === 1 || kind === 8) { e = sys.carts.spawnEmpty({ x: px, y: y + Y_OFFSET, z: pz }, { seed: 1 }); Object.assign(e, { vx, vy, vz, onGround: true }); w.entities.push({ kind: "minecart", get box() { return e.bb; } }); }
          else { e = sys.boats.spawnBoat({ x: px, y, z: pz, vx, vy, vz }, { seed: 1 }); e.onGround = true; }
          e.label = label; sys.lives.push(e);
          if (kind === 8 || kind === 9) {
            const g = { id: sys.mobs.nextId++, type: "pig", x: px, y: y + 1, z: pz, vx: 0, vy: 0, vz: 0, onGround: true, fallDistance: 0, health: 10, growingAge: 0, rotationYaw: 0, label: label + 100, mount: e };
            sys.mobs.entities.push(g); sys.lives.push(g);
            assert.ok(mountMobOnVehicle(e, g, () => 0));
          }
        }
      }
      w.time++; w.tickUpdates(); w.sendQueuedBlockEvents();
      // World.updateEntities: the entity loop first (a vehicle, then its rider), the tile entity loop after.
      for (const e of sys.lives) {
        if (e.mount) endRidden(e, () => 0);
        else if (sys.carts.carts.includes(e)) sys.carts.tickOne(view, e, []);
        else sys.boats.tickOne(view, e, []);
      }
      for (const e of sys.lives) if (e.mount) endRidden(e, () => 0);
      w.updateTileEntities(); p.tick();
      rows.push(sys.lives.map((e) => [e.label, e.x - ox, (e.bb ? e.bb[1] : e.y) - oy, e.z - oz, e.vx, e.vy, e.vz, e.onGround ? 1 : 0, e.collidedH ? 1 : 0, e.fallDistance ?? 0, e.mount ? e.mount.label : -1]));
    }
  } finally { setMovingBoxes(null); setEntityBoxes(null); }
  return rows;
}
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);
// Carts and boats: every field the probe records. A pig rider: position and the mount link only (the probe's rider also runs its own gravity and flags, which this replay does not model).
for (const s of ref.scenarios) test(`native replay: ${s.name}`, () => {
  const mine = replay(s);
  for (let t = 0; t < s.ticks; t++) {
    assert.equal(mine[t].length, s.live[t].length, `entity count at tick ${t + 1}`);
    mine[t].forEach((row, k) => {
      const want = s.live[t][k], rider = row[0] >= 100;
      (rider ? [1, 2, 3, 10] : row.map((_, j) => j)).forEach((j) => close(row[j], want[j], `${s.name} entity ${row[0]} field ${j} tick ${t + 1}`));
    });
  }
});

// ---- the dedicated server (src/multiplayer/server-pistons.js) ----
import { World, REDSTONE_BLOCK, RAIL } from "./world.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
const key = (n) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
function fixture() {
  const world = new World("b68-pistons5");
  for (let x = 40; x <= 140; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 30; y++) world.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 64.5 });
  return new DedicatedSimulation({}, { world, gameMode: "survival", mobs: false });
}
const join = (s, id, name, n, at) => { const p = s.addPlayer(id, name, key(n)); p.position.copy(at); p.previous.copy(p.position); s.input(id, { type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) }); return p; };
const powered = (s, x, y, z, meta) => { s.world.put(x, y, z, PISTON, meta, false); s.world.put(x - 1, y, z, REDSTONE_BLOCK, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(x - 1, y, z, 0); };

test("server: a pushed player takes the landing damage on the tick after the push (the C03 comes after the tile entity loop)", () => {
  const s = fixture(), p = join(s, "a", "Alice", 1, { x: 60.5, y: 10.5, z: 64.5 });
  s.world.put(60, 13, 64, PISTON, 0, false); s.world.put(61, 13, 64, REDSTONE_BLOCK, 0, false); s.redstone.notifyBlocksOfNeighborChange?.(61, 13, 64, 0);
  p.survival.protection = 0;
  const hp = p.survival.health;
  let landTick = null, hurtTick = null, wasAir = false;
  s.tick(); p.survival.protection = 0;
  for (let i = 0; i < 10; i++) {
    if (!p.grounded) { wasAir = true; p.fallDistance = Math.max(p.fallDistance, 8); }
    const before = p.survival.health;
    s.tick(); p.survival.protection = 0;
    if (wasAir && p.grounded && landTick === null) landTick = s.ticks;
    if (hurtTick === null && p.survival.health < before) hurtTick = s.ticks;
  }
  assert.ok(landTick !== null && hurtTick !== null, `landed ${landTick}, hurt ${hurtTick}, health ${p.survival.health} of ${hp}`);
  assert.equal(hurtTick, landTick + 1, "the damage arrives with the next tick's network phase");
});

test("server: a cart on rails is pushed by the head and snaps to the rail ahead (native replay: cart-rail-head)", () => {
  const s = fixture();
  for (let x = 61; x <= 66; x++) s.world.put(x, 10, 64, RAIL, 1, false);
  powered(s, 60, 10, 64, 5);
  const cart = s.vehicles.carts.spawnEmpty({ x: 61.5, y: 10 + Y_OFFSET, z: 64.5 }, { born: true });
  for (let i = 0; i < 8; i++) s.tick();
  // The probe: the cart ends 1.125 east of its start (x 2.5 -> 3.625, region coordinates) and rests on the rail, 0.15 above the floor.
  close(cart.x, 61.5 + 1.125, "cart x");
  close(cart.bb[1], 10.15, "cart on the rail");
});

test("server: a riding player is pushed on its own and the vehicle puts it back on the next tick (func_145863_a has no rider test)", () => {
  const s = fixture(), p = join(s, "a", "Alice", 1, { x: 61.5, y: 10, z: 64.5 });
  const cart = s.vehicles.spawnVehicle("minecart", 61.5, 10.35, 64.5);
  s.tick(); s.tick();
  assert.ok(s.vehicles.queue("a", { v: `c${cart.id}`, hit: false })); s.tick();
  assert.ok(p.mount, "mounted");
  powered(s, 60, 10, 64, 5);
  s.tick();
  // The seat puts a player's feet 0.45 under the floor top (the cart sits on the floor), so its own push is stopped by the next floor cell at x - 0.3 = 62 - 0.3: the rider moved by itself.
  close(cart.x, 62.0625, "cart pushed");
  close(p.position.x, 61.7, "rider pushed separately, blocked by the floor cell");
  for (let i = 2; i <= 8; i++) { s.tick(); assert.ok(Math.abs(p.position.x - cart.x) < 1e-6 && Math.abs(p.position.z - cart.z) < 1e-6, `rider at the cart on tick ${i}: ${p.position.x} vs ${cart.x}`); }
});
