// Batch 73 mpblocks73: block-placing items on the dedicated server. Cake (ItemReed), bed (ItemBed) and the hoe (ItemHoe) were refused or ignored there;
// the server now calls the single-player modules (bed.js placeBed, stems-cake.js cakePlacement, Farming.till). Skull and sign tiles reach the other players.
// A sweep of every item id (server against applyPlayerEdit on the same flat world) found these three as the only block-changing differences.
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "./world.js";
import { makeStack } from "./inventory.js";
import { DedicatedSimulation } from "./multiplayer/simulation.js";
import { IDLE_INPUT } from "./multiplayer/protocol.js";
import { CAKE, ITEM_CAKE } from "./stems-cake.js";
import { BED, ITEM_BED } from "./bed.js";
import { SKULL, ITEM_SKULL } from "./skull.js";
import { ITEM_SIGN, isSign } from "./signs.js";

const key = n => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const input = () => ({ type: "input", controls: { ...IDLE_INPUT }, yaw: 0, pitch: 0, current: 0, hotbar: Array(9).fill(null) });
const PITCH = -Math.atan(1.72 / 4); // from (64.5, 11.62, 68.5) onto the top of block (64, 9, 64)
function fixture(mode = "survival") {
  const world = new World("mpblocks73");
  for (let x = 50; x <= 80; x++) for (let z = 50; z <= 80; z++) for (let y = 9; y <= 14; y++) world.put(x, y, z, y === 9 ? 1 : 0, 0, false);
  world.spawn = () => ({ x: 64.5, y: 10, z: 68.5 });
  const s = new DedicatedSimulation({}, { world, gameMode: mode, mobs: false });
  s.rules.chunkStream = false;
  const a = s.addPlayer("a", "Alice", key(1)), b = s.addPlayer("b", "Bob", key(2));
  for (const p of [a, b]) { p.position.copy({ x: 64.5, y: 10, z: 68.5 }); p.previous.copy(p.position); }
  s.input("a", input()); s.input("b", input()); s.tick();
  return { s, a, b, world };
}
function click(s, p, id, count = 3, damage = 0, yaw = 0) {
  p.survival.inventory.main[0] = makeStack(id, count, damage); p.survival.inventory.current = 0; p.yaw = yaw; p.pitch = PITCH;
  s.queueEdit(p.id, { place: true });
  return s.tick();
}

test("cake item: ItemReed places a cake on the clicked top face and takes one", () => {
  const { s, a, world } = fixture();
  const msg = click(s, a, ITEM_CAKE, 1);
  assert.equal(world.get(64, 10, 64), CAKE);
  assert.equal(world.getMeta(64, 10, 64), 0);
  assert.equal(a.survival.held, null, "the single cake is spent");
  assert.ok(msg.changes.some(c => c[0] === 64 && c[1] === 10 && c[2] === 64 && c[3] === CAKE), "the change is broadcast");
});

test("cake item: refused on a non-solid support (cake over air next to a cliff) and in Adventure; kept in the stack", () => {
  const { s, a, world } = fixture();
  world.put(64, 9, 64, 0, 0, false); // nothing below the cell
  world.put(64, 8, 64, 0, 0, false);
  click(s, a, ITEM_CAKE, 1);
  assert.equal(world.get(64, 10, 64), 0);
  assert.equal(world.get(64, 9, 64), 0);
  assert.equal(a.survival.held?.count, 1);
  const f = fixture("adventure");
  f.a.survival.mode = "adventure";
  click(f.s, f.a, ITEM_CAKE, 1);
  assert.equal(f.world.get(64, 10, 64), 0);
});

test("cake item: Creative keeps the stack", () => {
  const { s, a, world } = fixture("creative");
  click(s, a, ITEM_CAKE, 1);
  assert.equal(world.get(64, 10, 64), CAKE);
  assert.equal(a.survival.held?.count, 1);
});

test("bed item: both halves, facing from the yaw, broadcast to the other player", () => {
  const { s, a, b, world } = fixture();
  const msg = click(s, a, ITEM_BED, 2, 0, 0); // the aim looks north (-z) from the south; the head goes along the facing from the yaw
  const foot = [64, 10, 64].join(), cells = msg.changes.filter(c => c[3] === BED);
  assert.equal(cells.length, 2, "two edits reach the other players");
  const metas = cells.map(c => c[4]);
  assert.ok(metas.some(m => (m & 8) === 0) && metas.some(m => (m & 8) !== 0), "a foot and a head half");
  assert.equal(world.get(64, 10, 64), BED);
  assert.equal(a.survival.held.count, 1);
  assert.equal(world.getMeta(64, 10, 64) & 8, 0, foot);
  const facing = world.getMeta(64, 10, 64) & 3, dz = [1, 0, -1, 0][facing], dx = [0, -1, 0, 1][facing];
  assert.equal(world.get(64 + dx, 10, 64 + dz), BED);
  assert.equal(world.getMeta(64 + dx, 10, 64 + dz), facing | 8);
  assert.ok(b);
});

test("bed item: no room (the head cell is occupied) places nothing and keeps the bed", () => {
  const { s, a, world } = fixture();
  for (const [x, z] of [[64, 63], [64, 65], [63, 64], [65, 64]]) world.put(x, 10, z, 4, 0, false);
  click(s, a, ITEM_BED, 1);
  assert.equal(world.get(64, 10, 64), 0);
  assert.equal(a.survival.held?.count, 1);
});

test("hoe: tills grass or dirt under air, wears the hoe by one", () => {
  const { s, a, world } = fixture();
  world.put(64, 9, 64, 2, 0, false);
  const id = 120; // wooden hoe
  const msg = click(s, a, id, 1);
  assert.equal(world.get(64, 9, 64), 29, "dry farmland");
  assert.equal(a.survival.held.damage, 1);
  assert.ok(msg.changes.some(c => c[1] === 9 && c[3] === 29));
  // a stone block (internal id 3) is not tilled
  const f = fixture();
  f.world.put(64, 9, 64, 3, 0, false);
  click(f.s, f.a, id, 1);
  assert.equal(f.world.get(64, 9, 64), 3);
});

test("skull: type and floor rotation are placed and described to the other player; a wall skull has rotation 0", () => {
  const { s, a, world } = fixture();
  const msg = click(s, a, ITEM_SKULL, 1, 1, 0);
  assert.equal(world.get(64, 10, 64), SKULL);
  assert.equal(world.getMeta(64, 10, 64), 1, "placed on the top face");
  const tile = s.tileEntities.skulls.tile(64, 10, 64);
  assert.equal(tile.type, 1, "wither skeleton skull");
  const described = (msg.tiles ?? []).find(t => t.x === 64 && t.y === 10 && t.z === 64);
  assert.ok(described, "the tile description is in the tick");
  assert.equal(described.kind, "skull");
  assert.equal(described.type, 1);
  assert.equal(described.rot, tile.rot);
});

test("skull: a player head keeps its SkullOwner profile from the stack", () => {
  const { s, a } = fixture();
  a.survival.inventory.main[0] = { ...makeStack(ITEM_SKULL, 1, 3), skullOwner: "Notch" };
  a.survival.inventory.current = 0; a.yaw = 0; a.pitch = PITCH;
  s.queueEdit("a", { place: true }); s.tick();
  const tile = s.tileEntities.skulls.tile(64, 10, 64);
  assert.equal(tile?.type, 3);
  assert.equal(tile?.profile?.name, "Notch");
});

test("sign: placed with its tile and the placing player as editor", () => {
  const { s, a, world } = fixture();
  click(s, a, ITEM_SIGN, 1);
  const tile = s.tileEntities.signs.tile?.(64, 10, 64) ?? s.tileEntities.signs.get?.(64, 10, 64);
  assert.ok(isSign(world.get(64, 10, 64)), `sign block ${world.get(64, 10, 64)}`);
  assert.ok(tile, "sign tile exists");
  assert.equal(tile.editor, "a");
});
