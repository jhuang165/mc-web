import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { World, BLOCKS, BED, blockBounds, selectionBounds } from "./world.js";
import { fromOriginal, toOriginal } from "./block-registry.js";
import { itemFromOriginal } from "./region-import.js";
import { ITEMS, MATERIALS } from "./survival.js";
import { explosionResistance } from "./explosion.js";
import { lightOpacity, celestialAngle, skylightSubtracted } from "./lighting.js";
import { populationDrops, POPULATION_ITEMS } from "./population-content.js";
import { CREATIVE_TABS } from "./creative.js";
import { BOOST_BLOCKS } from "./zombie-villager.js";
import { rayBounds } from "./projectiles.js";
import {
  ITEM_BED, BED_DIR, BED_TEXT, Beds, BedSleep, activateBed, bedHarvested, bedNeighbourChange, bedPlacedFacing, bedSpawnSpot, bedTexture,
  bedDrops, isDaytime, nextMorning, useBedItem, verifyRespawn,
} from "./bed.js";

const ref = JSON.parse(await readFile(new URL("../public/research/bed-reference.json", import.meta.url)));
const by = (c, kind) => ref.records.filter((r) => r.case === c && (kind === undefined || r.kind === kind));
// The probe stands the bed at (8, 64, 8); the test world uses a lower level.
const X = 8, Y = 30, Z = 8, SHIFT = 64 - Y, f = Math.fround;
const world = new World("bed", "meadow", 1);
const dropped = [];
new Beds(world, { drop: (stacks, x, y, z) => dropped.push(...stacks.map((s) => ({ ...s, x, y, z }))) }).watch();
const clear = () => { for (let x = 1; x <= 15; x++) for (let y = Y - 4; y <= Y + 5; y++) for (let z = 1; z <= 15; z++) world.put(x, y, z, 0, 0, false); dropped.length = 0; };
const exact = (id, meta = 0) => { const m = fromOriginal(id, meta); return m?.exact ? m : null; };
const put = (x, y, z, id, meta = 0) => { const m = exact(id, meta); if (!m) return false; world.put(x, y, z, m.id, m.meta, false); return true; };
const cell = (x, y, z) => { const o = toOriginal(world.get(x, y, z), world.getMeta(x, y, z)); return o ? [o[0], o[1]] : [-1, -1]; };
const cells = (list) => list.map((p) => cell(...p));
const near = (a, b, m) => { assert.equal(a.length, b.length, m); a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-6, `${m}: ${a} vs ${b}`)); };
const floor = (r = 4) => { for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) put(X + dx, Y - 1, Z + dz, 1, 0); };
const putBed = (facing) => {
  const [dx, dz] = BED_DIR[facing];
  put(X, Y - 1, Z, 1); put(X + dx, Y - 1, Z + dz, 1);
  put(X, Y, Z, 26, facing); put(X + dx, Y, Z + dz, 26, facing + 8);
};
const bedCells = () => cells([[X, Y, Z], ...BED_DIR.map(([dx, dz]) => [X + dx, Y, Z + dz])]);
const shiftY = (c) => (c ? [c[0], c[1] - SHIFT, c[2]] : null);
const unshift = (c) => (c ? [c[0], c[1] + SHIFT, c[2]] : null);
const count = { tested: 0, skipped: 0 };
const must = (ok) => { if (ok) count.tested++; else count.skipped++; return ok; };

test("registry, item, names and block facts match the native classes", () => {
  assert.equal(BED, 138);
  assert.equal(fromOriginal(26, 0).id, BED);
  assert.equal(itemFromOriginal(355, 0).id, ITEM_BED);
  assert.equal(POPULATION_ITEMS[355], ITEM_BED);
  const facts = by("facts")[0], item = by("item")[0];
  assert.equal(f(MATERIALS[BED].hardness), f(facts.hardness));
  assert.equal(explosionResistance(BED), f(facts.resistance));
  assert.equal(lightOpacity(BED), facts.lightOpacity);
  assert.equal(ITEMS[ITEM_BED].stack, item.stackLimit);
  assert.equal(BLOCKS[BED].name, ref.names["tile.bed.name"]);
  assert.equal(ITEMS[ITEM_BED].name, ref.names["item.bed.name"]);
  assert.equal(BED_TEXT.noSleep, ref.names["tile.bed.noSleep"]);
  assert.equal(BED_TEXT.occupied, ref.names["tile.bed.occupied"]);
  assert.equal(BED_TEXT.notSafe, ref.names["tile.bed.notSafe"]);
  assert.equal(BED_TEXT.notValid, ref.names["tile.bed.notValid"]);
  assert.equal(BED_TEXT.leave, ref.names["multiplayer.stopSleeping"]);
  for (let meta = 0; meta < 16; meta++) {
    const want = facts.drops[meta] ? 1 : 0;
    const got = populationDrops(BED, meta) ?? bedDrops(meta);
    assert.deepEqual(got.map((s) => s.id), want ? [ITEM_BED] : [], `drops ${meta}`);
  }
  const tab = CREATIVE_TABS[item.tab].items.map((s) => (Array.isArray(s) ? s[0] : s));
  assert.ok(tab.includes(ITEM_BED), "Decoration tab lists the bed");
  assert.ok(BOOST_BLOCKS.has(BED), "EntityZombie.getConversionTimeBoost counts beds");
  clear(); putBed(0);
  near(blockBounds(world, X, Y, Z), facts.bounds, "bounds");
  near(selectionBounds(world, X, Y, Z), facts.bounds, "selection");
  near(rayBounds(world, X, Y, Z, BED), facts.bounds, "ray box");
});

test("ItemBed.onItemUse: facing from yaw, top face only, support and air", () => {
  const rows = by("place", "yaw");
  assert.equal(rows.length, 45);
  for (const r of rows) {
    clear(); put(X, Y - 1, Z, 1); for (const [dx, dz] of BED_DIR) put(X + dx, Y - 1, Z + dz, 1);
    const ok = !!useBedItem(world, X, Y - 1, Z, 1, r.yaw);
    assert.equal(ok, r.result, `yaw ${r.yaw}`);
    assert.deepEqual(cells([[X, Y, Z], ...BED_DIR.map(([dx, dz]) => [X + dx, Y, Z + dz])]), r.cells, `yaw ${r.yaw} cells`);
    assert.equal(bedPlacedFacing(r.yaw), r.sets[0][4] & 3, `facing ${r.yaw}`);
  }
  for (const r of by("place", "side")) {
    clear(); put(X, Y - 1, Z, 1); for (const [dx, dz] of BED_DIR) put(X + dx, Y - 1, Z + dz, 1);
    assert.equal(!!useBedItem(world, X, Y - 1, Z, r.side, 0), r.result, `side ${r.side}`);
    assert.deepEqual(cells([[X, Y, Z], ...BED_DIR.map(([dx, dz]) => [X + dx, Y, Z + dz])]), r.cells);
  }
  for (const r of by("place", "support")) {
    clear(); put(X, Y - 2, Z, 1); put(X, Y - 2, Z + 1, 1); put(X, Y - 1, Z, 1); put(X, Y - 1, Z + 1, 1);
    if (!must(put(X, Y - 1, Z + r.which, r.below, r.belowMeta))) continue;
    assert.equal(!!useBedItem(world, X, Y - 1, Z, 1, 0), r.result, `support ${r.which}/${r.below}:${r.belowMeta}`);
    assert.deepEqual(cells([[X, Y, Z], [X, Y, Z + 1]]), r.cells, `support cells ${r.below}`);
  }
  for (const r of by("place", "occupied")) {
    clear(); put(X, Y - 1, Z, 1); put(X, Y - 1, Z + 1, 1);
    if (!must(put(X, Y, Z + r.which, r.block, r.meta))) continue;
    assert.equal(!!useBedItem(world, X, Y - 1, Z, 1, 0), r.result, `occupied ${r.which}/${r.block}:${r.meta}`);
    if (r.block < 8 || r.block > 11) assert.deepEqual(cells([[X, Y, Z], [X, Y, Z + 1]]), r.cells, `occupied cells ${r.block}`); // liquids read back as their other state
  }
  // The native test world is 256 high (records 252..255); this one is HEIGHT tall, so the same distances from the top apply.
  for (const r of by("place", "height")) {
    clear();
    const y = r.y - 256 + world.height;
    put(X, y - 1, Z, 1); put(X, y - 1, Z + 1, 1);
    assert.equal(!!useBedItem(world, X, y - 1, Z, 1, 0), r.result, `height ${r.y}`);
    for (let yy = y - 1; yy <= y; yy++) { world.put(X, yy, Z, 0, 0, false); world.put(X, yy, Z + 1, 0, 0, false); }
  }
  assert.ok(count.tested > 100, `replayed ${count.tested} exact-mapped cases (${count.skipped} skipped)`);
});

test("neighbour changes and breaking: both halves go, one bed drops from the foot half", () => {
  for (const r of by("neighbour", "remove")) {
    clear(); putBed(r.facing);
    const [dx, dz] = BED_DIR[r.facing];
    if (r.removed === "foot") world.set(X, Y, Z, 0); else world.set(X + dx, Y, Z + dz, 0);
    assert.deepEqual(bedCells(), r.cells, `remove ${r.removed} ${r.facing}`);
    assert.equal(dropped.length, r.drops.length, `drops ${r.removed} ${r.facing}`);
  }
  for (const r of by("neighbour", "lone")) {
    clear(); put(X, Y - 1, Z, 1); put(X, Y, Z, 26, r.facing + (r.half === "head" ? 8 : 0));
    const out = bedNeighbourChange(world, X, Y, Z);
    assert.deepEqual(cells([[X, Y, Z]]), r.cells, `lone ${r.half}`);
    assert.equal(out.length, r.drops.length, `lone drops ${r.half} ${r.facing}`);
  }
  for (const r of by("neighbour", "support")) {
    clear(); putBed(r.facing);
    const [dx, dz] = BED_DIR[r.facing];
    if (r.removed === "foot") world.set(X, Y - 1, Z, 0); else world.set(X + dx, Y - 1, Z + dz, 0);
    assert.deepEqual(bedCells(), r.cells, `support ${r.removed}`);
    assert.equal(dropped.length, 0);
  }
  for (const r of by("break")) {
    clear(); putBed(r.facing);
    const [dx, dz] = BED_DIR[r.facing], [bx, bz] = r.half === "foot" ? [X, Z] : [X + dx, Z + dz];
    const meta = world.getMeta(bx, Y, bz);
    bedHarvested(world, bx, Y, bz, r.creative);
    const flag = world.get(bx, Y, bz) === BED;
    if (flag) world.set(bx, Y, bz, 0);
    const own = flag && !r.creative ? bedDrops(meta).length : 0;
    assert.deepEqual(bedCells(), r.cells, `break ${r.half} ${r.facing} ${r.creative}`);
    assert.equal(own + dropped.length, r.drops.length, `break drops ${r.half} ${r.facing} ${r.creative}`);
  }
});

const names = (msgs) => msgs.map((k) => ref.names[k]);
function sleepWorld(facing, { floorUnder = false } = {}) { clear(); if (floorUnder) floor(); putBed(facing); }
const ctxFor = (p, sky, monsters = [], other = false) => ({
  player: { x: p[0], y: p[1], z: p[2], alive: true },
  daytime: isDaytime(sky),
  monsterNear: (b) => monsters.some((m) => m.maxX > b[0] && m.minX < b[3] && m.maxY > b[1] && m.minY < b[4] && m.maxZ > b[2] && m.minZ < b[5]),
  otherSleeperAt: () => other,
});
const checkPlayer = (sleep, want, label) => {
  assert.equal(sleep.sleeping, want.sleeping, `${label} sleeping`);
  assert.equal(sleep.timer, want.timer, `${label} timer`);
  if (want.sleeping) {
    near([sleep.pos.x, sleep.pos.y, sleep.pos.z], [want.x, want.y - SHIFT, want.z], `${label} pose`);
    near(sleep.offset, want.offset, `${label} offset`);
    assert.deepEqual(sleep.bed, shiftY(want.bed), `${label} bed`);
  }
};

test("BlockBed.onBlockActivated and sleepInBedAt", () => {
  for (const r of by("activate", "time")) {
    sleepWorld(r.facing);
    const sleep = new BedSleep(), [dx, dz] = BED_DIR[r.facing];
    const c = r.click === "foot" ? [X, Y, Z] : [X + dx, Y, Z + dz];
    const out = activateBed(world, ...c, sleep, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], r.sky));
    assert.deepEqual(out.message ? [out.message] : [], names(r.msgs), `time ${r.sky} ${r.facing} ${r.click}`);
    checkPlayer(sleep, r.player, `time ${r.sky}`);
    assert.deepEqual(bedCells(), r.cells);
  }
  for (const r of by("activate", "distance")) {
    sleepWorld(0);
    const sleep = new BedSleep();
    activateBed(world, X, Y, Z, sleep, ctxFor([X + 0.5 + r.dx, Y + r.dy, Z + 0.5 + r.dz], 11));
    assert.equal(sleep.sleeping, r.player.sleeping, `distance ${r.dx},${r.dy},${r.dz}`);
  }
  for (const r of by("activate", "monster")) {
    sleepWorld(0);
    const mx = X + 0.5 + r.dx, my = Y + r.dy, mz = Z + 1.5 + r.dz;
    const mob = { minX: mx - 0.3, maxX: mx + 0.3, minY: my, maxY: my + 1.8, minZ: mz - 0.3, maxZ: mz + 0.3 };
    const sleep = new BedSleep();
    const out = activateBed(world, X, Y, Z, sleep, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11, [mob]));
    assert.deepEqual(out.message ? [out.message] : [], names(r.msgs), `monster ${r.dx},${r.dy},${r.dz}`);
    assert.equal(sleep.sleeping, r.player.sleeping);
  }
  for (const r of by("activate", "occupied")) {
    sleepWorld(0);
    if (r.mode >= 1) { world.put(X, Y, Z, BED, 4, false); world.put(X, Y, Z + 1, BED, 12, false); }
    const sleep = new BedSleep();
    const out = activateBed(world, X, Y, Z + (r.click === "foot" ? 0 : 1), sleep, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11, [], r.mode === 2));
    assert.deepEqual(out.message ? [out.message] : [], names(r.msgs), `occupied ${r.mode} ${r.click}`);
    checkPlayer(sleep, r.player, `occupied ${r.mode}`);
    assert.deepEqual(bedCells(), r.cells, `occupied cells ${r.mode} ${r.click}`);
  }
  for (const r of by("activate", "pose")) {
    sleepWorld(r.facing);
    const sleep = new BedSleep(), [dx, dz] = BED_DIR[r.facing];
    activateBed(world, X + dx, Y, Z + dz, sleep, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11));
    checkPlayer(sleep, r.player, `pose ${r.facing}`);
    assert.deepEqual(bedCells(), r.cells);
  }
  sleepWorld(0);
  const ctx = ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11), s = new BedSleep();
  s.sleeping = true;
  assert.equal(s.begin(world, X, Y, Z + 1, ctx), by("activate", "alreadySleeping")[0].status);
  s.sleeping = false;
  ctx.player.alive = false;
  assert.equal(s.begin(world, X, Y, Z + 1, ctx), by("activate", "dead")[0].status);
  clear(); put(X, Y - 1, Z, 1);
  const lone = new BedSleep(), noBed = by("activate", "noBed")[0];
  assert.equal(lone.begin(world, X, Y, Z, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11)), noBed.status);
  checkPlayer(lone, noBed.player, "noBed");
});

test("wakeUpPlayer, the per-tick sleep timer and World.isDaytime", () => {
  for (const r of by("wake")) {
    sleepWorld(r.facing);
    const sleep = new BedSleep(), [dx, dz] = BED_DIR[r.facing], click = r.bedGone ? [X, Y, Z + 1] : [X + dx, Y, Z + dz];
    activateBed(world, ...click, sleep, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11));
    assert.equal(sleep.sleeping, true);
    if (r.bedGone) { world.put(X, Y, Z, 0, 0, false); world.put(X, Y, Z + 1, 0, 0, false); }
    const feet = sleep.wake(world, r.flags[0], r.flags[2]);
    const tag = `wake ${r.facing} ${r.flags} ${!!r.bedGone}`;
    assert.equal(sleep.sleeping, false, tag);
    assert.equal(sleep.timer, r.after.timer, tag);
    assert.deepEqual(sleep.spawn, r.flags[2] ? (r.bedGone ? [X, Y, Z + 1] : [X + dx, Y, Z + dz]) : null, `${tag} spawn`);
    if (r.bedGone) near([feet.x, feet.y, feet.z], [r.after.x, r.after.y - SHIFT, r.after.z], tag);
    else {
      near([feet.x, feet.y + 1.62, feet.z], [r.after.x, r.after.y - SHIFT, r.after.z], tag);
      assert.deepEqual(bedCells(), r.cells, `${tag} occupied bit`);
    }
  }
  for (const r of by("tick")) {
    sleepWorld(0);
    const sleep = new BedSleep();
    activateBed(world, X, Y, Z + 1, sleep, ctxFor([X + 0.5, Y + 1.62, Z - 1.5], 11));
    let day = false;
    for (const [tick, sleeping, timer, fully] of r.rows) {
      if (tick === 105) day = r.daytime;
      if (tick === 110 && !r.bedPresent) { world.put(X, Y, Z, 0, 0, false); world.put(X, Y, Z + 1, 0, 0, false); }
      const call = sleep.tick(world, day);
      if (call) sleep.wake(world, call[0], call[2]);
      assert.deepEqual([sleep.sleeping, sleep.timer, sleep.fullyAsleep], [sleeping, timer, fully], `tick ${tick} day ${r.daytime} bed ${r.bedPresent}`);
    }
  }
  for (const [t, sub, day] of by("daytime")[0].rows) {
    assert.equal(skylightSubtracted(celestialAngle(t, 1), 0, 0), sub, `subtracted at ${t}`);
    assert.equal(isDaytime(sub), day, `daytime at ${t}`);
  }
  assert.equal(nextMorning(0), 24000);
  assert.equal(nextMorning(13000), 24000);
  assert.equal(nextMorning(24000), 48000);
});

test("bed spawn search and respawn verification", () => {
  let tested = 0;
  for (const r of by("spawn", "open")) {
    clear(); floor(); putBed(r.facing);
    r.cells.forEach((want, idx) => assert.deepEqual(unshift(bedSpawnSpot(world, X, Y, Z, idx)), want, `open ${r.facing} #${idx}`));
  }
  for (const r of by("spawn", "block")) {
    clear(); floor(); putBed(r.facing);
    const hx = X + BED_DIR[r.facing][0], hz = Z + BED_DIR[r.facing][1];
    let ok = true;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const x = X + dx, z = Z + dz;
      if ((x === X && z === Z) || (x === hx && z === hz)) continue;
      if ((((dx * 3 + dz + r.facing) % 4) + 4) % 4 !== (((r.level + 1) % 4) + 4) % 4) continue;
      ok = (r.level === -1 ? put(x, Y - 1, z, r.block, r.meta) : put(x, Y + r.level, z, r.block, r.meta)) && ok;
    }
    if (!ok) continue;
    tested++;
    r.cells.forEach((want, idx) => assert.deepEqual(unshift(bedSpawnSpot(world, X, Y, Z, idx)), want, `block ${r.block}:${r.meta} f${r.facing} l${r.level} #${idx}`));
  }
  assert.ok(tested > 100, `block cases ${tested}`);
  for (const r of ref.records.filter((x) => x.case === "verify" && x.kind === undefined)) {
    clear(); put(X, Y - 1, Z, 1);
    if (!(put(X, Y, Z, r.a[0], r.a[1]) && put(X, Y + 1, Z, r.b[0], r.b[1]))) continue;
    assert.deepEqual(unshift(verifyRespawn(world, [X, Y, Z], r.forced)), r.result, `verify ${r.forced} ${r.a}/${r.b}`);
  }
  for (const r of by("verify", "bed")) {
    clear(); floor(); putBed(r.facing);
    if (r.blocked === 1) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (world.get(X + dx, Y, Z + dz) === 0) put(X + dx, Y, Z + dz, 1, 0);
    if (r.blocked === 2) world.put(X, Y, Z, 0, 0, false);
    const at = r.blocked === 2 ? [X + BED_DIR[r.facing][0], Y, Z + BED_DIR[r.facing][1]] : [X, Y, Z];
    assert.deepEqual(unshift(verifyRespawn(world, at, r.forced)), r.result, `bed verify ${r.facing} ${r.forced} ${r.blocked}`);
  }
});

test("bed textures follow BlockBed.getIcon", () => {
  assert.equal(bedTexture(0, 8), "planks_oak");
  assert.equal(bedTexture(1, 0), "bed_feet_top");
  assert.equal(bedTexture(1, 8), "bed_head_top");
  for (let facing = 0; facing < 4; facing++) {
    const [dx, dz] = BED_DIR[facing];
    const sideOf = (sx, sz) => (sz === 1 ? 3 : sz === -1 ? 2 : sx === 1 ? 5 : 4);
    assert.equal(bedTexture(sideOf(-dx, -dz), facing), "bed_feet_end", `foot end ${facing}`);
    assert.equal(bedTexture(sideOf(dx, dz), facing + 8), "bed_head_end", `head end ${facing}`);
    assert.equal(bedTexture(sideOf(dz, dx), facing), "bed_feet_side".replace("feet_side", bedTexture(sideOf(dz, dx), facing).slice(4)));
  }
});
