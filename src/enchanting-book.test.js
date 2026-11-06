import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JavaRandom } from './java-random.js';
import {
  BookTile, closestPlayer, ENCHANT_NAME_WORDS, enchantNames, BOOK_PARTS, BOOK_PART_ORDER, bookAngles, modelBoxQuads,
  GuiBook, tilePose, pageAngles, guiBookPose, tileRandom,
} from './enchanting-book.js';

const ref = JSON.parse(readFileSync(new URL('../public/research/enchanting-book-reference.json', import.meta.url)));
const f = Math.fround;

test('the word list and the three galactic names of every probed nameSeed match EnchantmentNameParts', () => {
  assert.deepEqual([...ENCHANT_NAME_WORDS], ref.words);
  for (const r of ref.names) assert.deepEqual(enchantNames(BigInt(r.seed)), r.names, `seed ${r.seed}`);
  assert.equal(enchantNames(5n).length, 3);
});

test('ModelBook boxes, rotation points and quad UVs match the unchanged model', () => {
  assert.deepEqual([ref.model.textureWidth, ref.model.textureHeight], [64, 32]);
  for (const name of BOOK_PART_ORDER) {
    const part = BOOK_PARTS[name], native = ref.model.parts[name];
    assert.deepEqual(part.point.map(f), native.point.map(f), `${name} point`);
    assert.deepEqual((part.angle ?? [0, 0, 0]).map(f), native.angle.map(f), `${name} angle`);
    assert.equal(native.boxes.length, 1);
    const [x, y, z, dx, dy, dz] = part.box;
    assert.deepEqual(native.boxes[0].min.map(f), [x, y, z].map(f), `${name} min`);
    assert.deepEqual(native.boxes[0].max.map(f), [x + dx, y + dy, z + dz].map(f), `${name} max`);
    assert.deepEqual(modelBoxQuads(part.uv, part.box), native.boxes[0].quads.map((q) => q.map((v) => v.map(f))), `${name} quads`);
  }
});

test('ModelBook.setRotationAngles matches for 60 probed (tick, page, page, spread) inputs', () => {
  for (const { in: [tick, right, left, spread], angles } of ref.poses) {
    const mine = bookAngles(f(tick), f(right), f(left), f(spread));
    BOOK_PART_ORDER.forEach((name, i) => assert.deepEqual(mine[name].map((v) => f(v) + 0), angles[i].map((v) => f(v) + 0), `${name} at ${tick}`));
  }
});

test('TileEntityEnchantmentTable.updateEntity replays 12 scripted approach-and-leave scenarios exactly', () => {
  assert.equal(ref.tiles.length, 12);
  let opened = 0;
  for (const sc of ref.tiles) {
    const random = new JavaRandom(BigInt(sc.seed)), tile = new BookTile(4, 64, 4);
    if (sc.start) Object.assign(tile, { bookRotation: sc.start[0], bookRotationPrev: sc.start[0], targetRotation: sc.start[1], flipT: sc.start[2], pageFlip: sc.start[3] });
    sc.ticks.forEach((row, k) => {
      const [x, y, z] = sc.player[k];
      tile.update(closestPlayer([{ x, y, z }], 4, 64, 4), random);
      const got = [tile.tickCount, tile.pageFlip, tile.pageFlipPrev, tile.flipT, tile.flipA, tile.bookSpread, tile.bookSpreadPrev, tile.bookRotation, tile.bookRotationPrev, tile.targetRotation];
      assert.deepEqual(got.map((v, i) => (i === 0 ? v : f(v))), row.map((v, i) => (i === 0 ? v : f(v))), `scenario ${sc.scenario} tick ${k}`);
      if (tile.bookSpread === 1) opened++;
    });
    assert.equal(random.nextInt(1000000), sc.next, `scenario ${sc.scenario} consumed the same random draws`);
  }
  assert.ok(opened > 100, 'the book fully opened in the probed scenarios');
});

test('World.getClosestPlayer reaches strictly less than 3 blocks from the table centre', () => {
  assert.equal(closestPlayer([{ x: 4.5 + 3, y: 64.5, z: 4.5 }], 4, 64, 4), null);
  assert.ok(closestPlayer([{ x: 4.5 + 2.99, y: 64.5, z: 4.5 }], 4, 64, 4));
  const near = { x: 5, y: 64.5, z: 4.5 }, far = { x: 6.5, y: 64.5, z: 4.5 };
  assert.equal(closestPlayer([far, near], 4, 64, 4), near);
});

test('GuiEnchantment.updateScreen replays the book step for 6 scripted container sequences', () => {
  for (const sc of ref.gui) {
    const book = new GuiBook(new JavaRandom(BigInt(sc.seed)));
    let item = null, levels = [0, 0, 0];
    const events = new Map(sc.events.map(([k, has, a, b, c]) => [k, { has, levels: [a, b, c] }]));
    sc.ticks.forEach((row, k) => {
      if (events.has(k)) { const e = events.get(k); item = e.has ? { id: 276, count: 1, damage: 0 } : null; levels = e.levels; }
      book.tick(item, levels);
      const got = [book.tickCount, book.pageFlip, book.pageFlipPrev, book.flipT, book.flipA, book.bookSpread, book.bookSpreadPrev];
      assert.deepEqual(got.map((v, i) => (i === 0 ? v : f(v))), row.map((v, i) => (i === 0 ? v : f(v))), `gui ${sc.scenario} tick ${k}`);
    });
  }
});

test('the world and GUI book poses follow the transcribed renderer arithmetic', () => {
  const t = new BookTile(0, 0, 0);
  Object.assign(t, { tickCount: 10, bookRotation: 3.0, bookRotationPrev: -3.0, pageFlip: 1.5, pageFlipPrev: 1.0, bookSpread: 1, bookSpreadPrev: 0.8 });
  const p = tilePose(t, 0.5);
  assert.ok(Math.abs(p.translate[1] - (0.85 + Math.sin(10.5 * 0.1) * 0.01)) < 1e-3);
  // from -3.0 to 3.0 the book turns the short way through +-pi, so the interpolated yaw is near -pi
  assert.ok(Math.abs(Math.abs(p.yawDegrees) - 180) < 20, `${p.yawDegrees}`);
  assert.equal(p.tiltDegrees, 80);
  assert.equal(f(p.spread), f(0.9));
  const pages = pageAngles(0.5);
  assert.ok(Math.abs(pages.right - 0.9) < 1e-6 && Math.abs(pages.left - 0.1) < 1e-6);
  const closed = guiBookPose(Object.assign(new GuiBook(), { bookSpread: 0, bookSpreadPrev: 0 }), 0);
  assert.equal(closed.yawDegrees, -180);
  const open = guiBookPose(Object.assign(new GuiBook(), { bookSpread: 1, bookSpreadPrev: 1 }), 0);
  assert.deepEqual([open.yawDegrees, ...open.shift], [-90, 0, 0, 0]);
  assert.equal(typeof tileRandom.random.nextInt(4), 'number');
});
