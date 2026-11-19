// Batch 82 pots82: every port path that removes a flower pot drops its stored ItemStack(Item, 1, Data) the native way (BlockFlowerPot.breakBlock on the
// server's setBlock), rawDamage picks / placement / persistence / wire, and the Mining Fatigue V crack stage and meter.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { World, FLOWER_POT, WATER, LAVA, RED_FLOWER, SAPLING, YELLOW_FLOWER } from "./world.js";
import { potFromNbt, potContents, setPotContents, potBreakDrop, potHeldDrop, potPick, ITEM_FLOWER_POT } from "./stone-utility.js";
import { itemFromOriginal } from "./region-import.js";
import { JavaRandom } from "./java-random.js";
import { explosionOutcome, explosionDrops } from "./explosion.js";
import { Fluids } from "./fluids.js";
import { washStacks, burnStacks } from "./fluid-wash.js";
import { placeContainedLiquid } from "./buckets.js";
import { LiveRedstone } from "./redstone-live.js";
import { createCommandHost } from "./command-host.js";
import { PlayerInventory as Inventory, makeStack } from "./inventory.js";
import { cleanStack } from "./multiplayer/server-containers.js";
import { ItemEntities } from "./item-entities.js";
import { plantDropDamage } from "./plant-damage.js";
import { clientCrackStage, meterPercent } from "./mining-crack.js";
import { placeHeldBlock } from "./block-placement-simulation.js";
import { Survival, ITEMS } from "./survival.js";
import { blockTile } from "./block-textures.js";

const src = (f) => readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
const f = Math.fround;
// A pot holding poppy Data 12 (red_flower at a damage the catalogue has no variant for: rawDamage 12).
const ROSE12 = () => potFromNbt({ Item: 38, Data: 12 }, itemFromOriginal);
const PLANT12 = { id: RED_FLOWER, count: 1, damage: 0, tags: { rawDamage: 12 } };
const cleared = (name = "pots82") => {
  const w = new World(name, "meadow");
  for (let x = 4; x < 14; x++) for (let z = 4; z < 14; z++) for (let y = 9; y < 16; y++) w.put(x, y, z, y === 9 ? 3 : 0, 0, false);
  return w;
};
const potAt = (w, x, y, z, content = ROSE12()) => { w.set(x, y, z, FLOWER_POT, false, 0); setPotContents(w, x, y, z, content); return w; };

test("Block.dropBlockAsItem(stack) of the pot's tile: three world.rand floats, rand * 0.7F + 0.15, nothing without doTileDrops", () => {
  const w = potAt(cleared(), 6, 10, 6);
  const a = new JavaRandom(5n), b = new JavaRandom(5n);
  const held = potBreakDrop(w, 6, 10, 6, a);
  const at = () => f(b.nextFloat() * f(0.7)) + f(0.3) * 0.5;
  assert.deepEqual(held, { ...PLANT12, x: 6 + at(), y: 10 + at(), z: 6 + at() });
  assert.equal(a.nextInt(1000), b.nextInt(1000), "exactly three draws");
  assert.equal(potBreakDrop(w, 6, 10, 6, new JavaRandom(1n), false), null);
  assert.deepEqual(potHeldDrop(potContents(w, 6, 10, 6), 0, 0, 0), PLANT12);
  const empty = cleared(); empty.set(6, 10, 6, FLOWER_POT, false, 0);
  assert.equal(potBreakDrop(empty, 6, 10, 6, new JavaRandom(1n)), null, "an empty pot drops no plant and draws nothing");
});

test("explosions drop the pot item, then the stored stack (doExplosionB: dropBlockAsItemWithChance, setBlock -> breakBlock)", () => {
  const w = potAt(cleared(), 6, 10, 6);
  const out = explosionOutcome(w, [[6, 10, 6]], 1, new JavaRandom(9n), { smoking: true, own: new JavaRandom(1n) });
  assert.deepEqual(out.drops.map((d) => [d.id, d.damage, d.tags?.rawDamage]), [[ITEM_FLOWER_POT, 0, undefined], [RED_FLOWER, 0, 12]]);
  // Chance 1/size per block: the pot's own roll can fail, the plant (breakBlock) drops whatever the chance.
  const w2 = potAt(cleared(), 6, 10, 6), drops = [];
  for (let s = 0n; s < 40n; s++) drops.push(explosionOutcome(w2, [[6, 10, 6]], 4, new JavaRandom(s), { own: new JavaRandom(1n) }).drops.map((d) => d.id).join());
  assert.ok(drops.includes(`${RED_FLOWER}`) && drops.includes(`${ITEM_FLOWER_POT},${RED_FLOWER}`));
  assert.match(src("explosion-simulation.js"), /makeStack\(drop\.id, 1, drop\.damage \|\| 0, undefined, drop\.tags\)/);
  assert.match(src("multiplayer/server-mobs.js"), /d\.tags/);
});

test("roses keep their metadata as damage, saplings clamp(meta & 7, 0, 5) (alc.a / anj.a damageDropped, bytecode-read)", () => {
  assert.deepEqual(plantDropDamage(RED_FLOWER, 4), { damage: 4 });
  assert.deepEqual(plantDropDamage(RED_FLOWER, 12), { damage: 0, tags: { rawDamage: 12 } });
  assert.deepEqual([0, 5, 6, 7, 13].map((m) => plantDropDamage(SAPLING, m).damage), [0, 5, 5, 5, 5]);
  assert.deepEqual(plantDropDamage(YELLOW_FLOWER, 3), { damage: 0, tags: { rawDamage: 3 } }); // b83 plants83: the dandelion keeps its metadata now (was null)
  const rose = explosionDrops(RED_FLOWER, 12, 0, 0, 0, 1, new JavaRandom(2n)).items[0];
  assert.deepEqual([rose.id, rose.damage, rose.tags], [RED_FLOWER, 0, { rawDamage: 12 }]);
  assert.equal(explosionDrops(SAPLING, 7, 0, 0, 0, 1, new JavaRandom(2n)).items[0].damage, 5);
  assert.equal(explosionDrops(SAPLING, 2, 0, 0, 0, 1, new JavaRandom(2n)).items[0].damage, 2, "a birch sapling no longer explodes into oak");
  const w = cleared(); w.set(6, 10, 6, RED_FLOWER, false, 12);
  assert.deepEqual(washStacks(w, 6, 10, 6, RED_FLOWER).map((s) => [s.id, s.damage, s.rawDamage]), [[RED_FLOWER, 0, 12]]);
  w.set(6, 10, 6, SAPLING, false, 7);
  assert.deepEqual(washStacks(w, 6, 10, 6, SAPLING).map((s) => s.damage), [5]);
});

test("water flows into a pot (Material.circuits does not block movement) and washes out the pot item and the plant; lava only the plant", () => {
  assert.deepEqual(washStacks(potAt(cleared(), 6, 10, 6), 6, 10, 6, FLOWER_POT).map((s) => [s.id, s.damage, s.rawDamage]), [[ITEM_FLOWER_POT, 0, undefined], [RED_FLOWER, 0, 12]]);
  assert.deepEqual(burnStacks(potAt(cleared(), 6, 10, 6), 6, 10, 6, FLOWER_POT).map((s) => [s.id, s.rawDamage]), [[RED_FLOWER, 12]]);
  for (const [kind, want] of [[WATER, [[ITEM_FLOWER_POT], [RED_FLOWER]]], [LAVA, [[RED_FLOWER]]]]) {
    const w = potAt(cleared(), 7, 10, 6), out = [];
    const fl = new Fluids(w, { wash: (x, y, z, b) => out.push(...washStacks(w, x, y, z, b).map((s) => [s.id])), burn: (x, y, z, b) => out.push(...burnStacks(w, x, y, z, b).map((s) => [s.id])) });
    assert.equal(fl.blocked(7, 10, 6), false);
    w.set(6, 10, 6, kind, true, 0);
    for (let i = 0; i < 80; i++) fl.tick();
    assert.equal(w.get(7, 10, 6), kind, `${kind} took the pot cell`);
    assert.equal(w.pots.size, 0, "the record goes with the pot");
    assert.deepEqual(out, want);
  }
  for (const file of ["main.js", "multiplayer/server-bucket.js", "away-world.js"]) assert.match(src(file), /burnStacks\(/, file);
});

test("a bucket replaces a pot (Material.circuits is not solid) and the replaced pot breaks with both drops", () => {
  const w = potAt(cleared(), 6, 10, 6), destroyed = [];
  assert.equal(placeContainedLiquid(w, 6, 10, 6, WATER, (x, y, z, b) => destroyed.push(...washStacks(w, x, y, z, b).map((s) => s.id))), true);
  assert.deepEqual(destroyed, [ITEM_FLOWER_POT, RED_FLOWER]);
  assert.equal(w.get(6, 10, 6), WATER);
});

test("a piston breaking a pot (mobility 1) drops the pot item, then the stored stack on the same Random", () => {
  const w = potAt(cleared(), 6, 10, 6), drops = [];
  const r = new LiveRedstone(w, { drop: (x, y, z, d) => drops.push(d) });
  r.rand = new JavaRandom(3n);
  r.dropBlockAsItem(6, 10, 6, 140, 0);
  assert.deepEqual(drops, [{ id: ITEM_FLOWER_POT, count: 1, damage: 0 }, { id: RED_FLOWER, count: 1, damage: 0, rawDamage: 12 }]);
  r.doTileDrops = false; drops.length = 0;
  r.dropBlockAsItem(6, 10, 6, 140, 0);
  assert.deepEqual(drops, []);
  r.detach?.();
  assert.match(src("main.js"), /d\.rawDamage \? \{ rawDamage: d\.rawDamage \} : undefined/);
});

test("/setblock over a pot drops its plant (setBlock's breakBlock), pot to pot with another meta too; the record goes", () => {
  const w = potAt(cleared(), 6, 10, 6), dropped = [];
  const env = { world: () => w, survival: () => ({}), updateBlock() {}, changed() {}, dropStacks: (stacks) => dropped.push(...stacks.map((s) => [s.id, s.rawDamage])) };
  const host = createCommandHost(env);
  assert.equal(host.setBlock(6, 10, 6, 1, 0, "replace"), true);
  assert.deepEqual(dropped, [[RED_FLOWER, 12]]);
  potAt(w, 6, 10, 6); dropped.length = 0;
  assert.equal(host.setBlock(6, 10, 6, 140, 3, "replace"), true);
  assert.deepEqual(dropped, [[RED_FLOWER, 12]]);
  assert.equal(w.pots.has("6,10,6"), false);
  assert.match(src("multiplayer/server-worldcmds.js"), /dropStacks: \(stacks, x, y, z\) => sim\.serverItems\.stacksDrop/);
  assert.match(src("main.js"), /dropStacks: \(stacks, x, y, z\) => items\.dropBlock\(stacks, x, y, z\)/);
});

test("pick of a rawDamage pot gives the stored stack, found and made with its native damage", () => {
  const w = potAt(cleared(), 6, 10, 6);
  assert.deepEqual(potPick(w, 6, 10, 6), { id: RED_FLOWER, damage: 0, rawDamage: 12 });
  const inv = new Inventory(ITEMS);
  inv.main[3] = makeStack(RED_FLOWER, 5, 0);
  inv.pick(RED_FLOWER, true, 0, 12);
  assert.deepEqual([inv.held.id, inv.held.damage, inv.held.rawDamage], [RED_FLOWER, 0, 12], "the plain poppy is another subtype");
  assert.equal(inv.find(RED_FLOWER, 0), 3);
  assert.equal(inv.find(RED_FLOWER, 0, 12), inv.current);
  inv.current = 3; inv.pick(RED_FLOWER, false, 0, 12);
  assert.equal(inv.current, 0, "Survival selects the slot holding the rawDamage stack");
  assert.match(src("main.js"), /stonePick\?\.rawDamage\)/);
});

test("rawDamage survives inventory read (saves, chests, ground items, applySlots) and the server's wire whitelist", () => {
  const inv = new Inventory(ITEMS);
  assert.equal(inv.read({ id: RED_FLOWER, count: 2, damage: 0, rawDamage: 12 }).rawDamage, 12);
  for (const bad of [0, -3, 1.5, 40000, "7"]) assert.equal(inv.read({ id: RED_FLOWER, count: 2, damage: 0, rawDamage: bad }).rawDamage, undefined, `${bad}`);
  assert.equal(cleanStack({ id: RED_FLOWER, count: 1, damage: 0, rawDamage: 12 }).rawDamage, 12);
  assert.equal(cleanStack({ id: RED_FLOWER, count: 1, damage: 0, rawDamage: -1 }).rawDamage, undefined);
});

test("ItemMultiTexture (rose, sapling) places the rawDamage as metadata & 15", () => {
  for (const [id, raw, meta] of [[RED_FLOWER, 12, 12], [SAPLING, 7, 7], [RED_FLOWER, 17, 1]]) {
    const world = new World("block-placement", "meadow", 1), survival = new Survival();
    const here = [10, 20, 10], p = [10, 21, 10];
    world.set(...here, 1); world.set(...p, 0);
    survival.inventory.setStack(0, { id, count: 4, damage: 0, rawDamage: raw });
    const out = placeHeldBlock({ world, survival, position: { x: 30.5, y: 20, z: 30.5 }, flowers: { yellow: YELLOW_FLOWER, red: RED_FLOWER }, yaw: 0, farming: { observe() {} } },
      { id, item: ITEMS[id], target: { block: here, adjacent: p } }, { collides: () => false, updateBlock() {}, renderHotbar() {}, sound() {}, markUnsaved() {} });
    assert.equal(out.placed, true, `${id}:${raw}`);
    assert.equal(world.getMeta(...p), meta, `${id}:${raw}`);
  }
});

test("mob-event drops carry rawDamage; a block-spread event spreads like dropBlock", () => {
  const items = new ItemEntities(() => 0.5), spawned = [];
  items.spawn = (s, x, y, z, o) => spawned.push({ s, x, y, z, o });
  items.dropMob(RED_FLOWER, 1, { x: 1, y: 2, z: 3 }, 0, { rawDamage: 12 });
  items.dropMob(RED_FLOWER, 1, { x: 1, y: 2, z: 3 }, 0, { rawDamage: 12, blockSpread: true });
  assert.deepEqual(spawned.map((e) => e.s.rawDamage), [12, 12]);
  assert.deepEqual([spawned[1].x, spawned[1].y, spawned[1].z], [1.5, 2.5, 3.5]);
  assert.match(src("wither-boss-mobs.js"), /potHeldDrop\(pot, x, y, z, rand\)/);
  assert.match(src("dragon-mobs.js"), /potHeldDrop\(pot, x, y, z\)/);
});

test("Mining Fatigue V: the digger's crack stage is (int)(progress * 10F) - 1 kept only in 0..9; the meter is never NaN", () => {
  const cases = [[0, -1], [NaN, -1], [-0.05, -1], [-0.5, -1], [-Infinity, -1], [Infinity, -1], [0.05, -1], [0.1, 0], [0.19, 0], [0.2, 1], [0.95, 8], [1, 9], [1.2, -1]];
  for (const [p, s] of cases) assert.equal(clientCrackStage(p), s, `${p}`);
  for (const [p, m] of [[NaN, 0], [-0.3, 0], [0, 0], [0.25, 25], [3, 100]]) assert.equal(meterPercent(p), m, `${p}`);
  assert.match(src("effects.js"), /clientCrackStage\(progress\)/);
  assert.doesNotMatch(src("effects.js"), /Math\.floor\(progress \* 10\)/);
  assert.match(src("main.js"), /meterPercent\(mining\.progress\) \+ "%"/);
});

test("rose and sapling metas past the variants draw what 1.7.10 draws (alc / anj getIcon, bytecode-read)", () => {
  assert.equal(blockTile(RED_FLOWER, 0, false, 12), blockTile(RED_FLOWER, 0, false, 0), "a rose past its icons is the poppy");
  assert.notEqual(blockTile(RED_FLOWER, 0, false, 8), blockTile(RED_FLOWER, 0, false, 0));
  for (const m of [6, 7, 13]) assert.equal(blockTile(SAPLING, 0, false, m), blockTile(SAPLING, 0, false, 5), `sapling ${m} is roofed oak`);
});
