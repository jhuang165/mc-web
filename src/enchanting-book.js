// The enchanting table's book, Java 1.7.10. Replayed against public/research/enchanting-book-reference.json.
//   TileEntityEnchantmentTable (apd).updateEntity: the book of a world table (BookTile).
//   RenderEnchantmentTable (bmn).renderTileEntityAt: its pose (tilePose), transcribed from bytecode.
//   ModelBook (bhf): seven flat boxes (BOOK_PARTS, modelBoxQuads) and setRotationAngles (bookAngles).
//   GuiEnchantment (bfq): updateScreen's book step (GuiBook), drawGuiContainerBackgroundLayer's pose (guiBookPose),
//   and the three random "galactic" names from EnchantmentNameParts (bfp, enchantNames).
import { JavaRandom } from './java-random.js';
import { mhSin } from './lighting.js';

const f = Math.fround, PI = f(Math.PI), TWO_PI = f(Math.PI * 2);

// TileEntityEnchantmentTable.r: one static Random shared by every table, unseeded in the original.
export const tileRandom = { random: new JavaRandom(Math.floor(Math.random() * 2 ** 48)) };

// EnchantmentNameParts.c: "the elder scrolls klaatu ..." split on spaces.
export const ENCHANT_NAME_WORDS = Object.freeze(
  'the elder scrolls klaatu berata niktu xyzzy bless curse light darkness fire air earth water hot dry cold wet ignite snuff embiggen twist shorten stretch fiddle destroy imbue galvanize enchant free limited range of towards inside sphere cube self other ball mental physical grow shrink demon elemental spirit animal creature beast humanoid undead fresh stale'.split(' '));

/** EnchantmentNameParts.getRandomEnchantName: nextInt(2) + 3 words joined by spaces. */
export function randomEnchantName(random) {
  const count = random.nextInt(2) + 3;
  let name = '';
  for (let i = 0; i < count; i++) {
    if (i > 0) name += ' ';
    name += ENCHANT_NAME_WORDS[random.nextInt(ENCHANT_NAME_WORDS.length)];
  }
  return name;
}

/** GuiEnchantment: setSeed(container.nameSeed), then one name per button (3 draws in a row), every frame. */
export function enchantNames(nameSeed, count = 3) {
  const random = new JavaRandom(BigInt(nameSeed));
  return Array.from({ length: count }, () => randomEnchantName(random));
}

// ModelRenderer.rotateAngle wraps and the clamp helpers used below.
const wrap = (v) => { while (v >= PI) v = f(v - TWO_PI); while (v < -PI) v = f(v + TWO_PI); return v; };
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * The book state of one TileEntityEnchantmentTable (fields a, i..q). `closest` is World.getClosestPlayer(x + 0.5,
 * y + 0.5, z + 0.5, 3.0): {x, z} of the player in range or null. All arithmetic is float, as in the original.
 */
export class BookTile {
  constructor(x = 0, y = 0, z = 0) {
    Object.assign(this, { x, y, z, tickCount: 0, pageFlip: 0, pageFlipPrev: 0, flipT: 0, flipA: 0, bookSpread: 0, bookSpreadPrev: 0, bookRotation: 0, bookRotationPrev: 0, targetRotation: 0 });
  }
  update(closest, random = tileRandom.random) {
    this.bookSpreadPrev = this.bookSpread;
    this.bookRotationPrev = this.bookRotation;
    if (closest) {
      const dx = closest.x - f(this.x + 0.5), dz = closest.z - f(this.z + 0.5);
      this.targetRotation = f(Math.atan2(dz, dx));
      this.bookSpread = f(this.bookSpread + f(0.1));
      if (this.bookSpread < f(0.5) || random.nextInt(40) === 0) {
        const before = this.flipT;
        do this.flipT = f(this.flipT + (random.nextInt(4) - random.nextInt(4))); while (before === this.flipT);
      }
    } else {
      this.targetRotation = f(this.targetRotation + f(0.02));
      this.bookSpread = f(this.bookSpread - f(0.1));
    }
    this.bookRotation = wrap(this.bookRotation);
    this.targetRotation = wrap(this.targetRotation);
    const turn = wrap(f(this.targetRotation - this.bookRotation));
    this.bookRotation = f(this.bookRotation + f(turn * f(0.4)));
    this.bookSpread = clamp(this.bookSpread, 0, 1);
    this.tickCount++;
    this.pageFlipPrev = this.pageFlip;
    const flip = clamp(f(f(this.flipT - this.pageFlip) * f(0.4)), f(-0.2), f(0.2));
    this.flipA = f(this.flipA + f(f(flip - this.flipA) * f(0.9)));
    this.pageFlip = f(this.pageFlip + this.flipA);
  }
}

// TileEntity.getMaxRenderDistanceSquared.
export const BOOK_RENDER_DISTANCE_SQUARED = 4096;
// The tile entity reaches a player at most this far (World.getClosestPlayer(..., 3.0)).
export const BOOK_PLAYER_RANGE = 3;

/** The nearest player of `players` ({x, y, z}) strictly inside 3 blocks of the table centre, as World.getClosestPlayer. */
export function closestPlayer(players, x, y, z, range = BOOK_PLAYER_RANGE) {
  let best = null, bestSq = -1;
  const cx = f(x + 0.5), cy = f(y + 0.5), cz = f(z + 0.5);
  for (const p of players) {
    const sq = (p.x - cx) ** 2 + (p.y - cy) ** 2 + (p.z - cz) ** 2;
    if ((range < 0 || sq < range * range) && (bestSq === -1 || sq < bestSq)) { best = p; bestSq = sq; }
  }
  return best;
}

/** The page positions both the world renderer and the GUI derive from pageFlip (partial-tick interpolated). */
export function pageAngles(flip) {
  let r = f(flip + f(0.25)), l = f(flip + f(0.75));
  r = clamp(f(f(r - Math.floor(r)) * f(1.6) - f(0.3)), 0, 1);
  l = clamp(f(f(l - Math.floor(l)) * f(1.6) - f(0.3)), 0, 1);
  return { right: r, left: l };
}

/**
 * RenderEnchantmentTable.renderTileEntityAt (offsets from the block corner): translate (0.5, 0.75, 0.5), then (0, 0.1 +
 * sin(tick * 0.1) * 0.01, 0), rotate -yaw about y and 80 degrees about z, then ModelBook with (tick, right page, left page,
 * spread). `yaw` is the radian book rotation interpolated over the shortest way, as bytecode does.
 */
export function tilePose(tile, partial) {
  const tick = f(tile.tickCount + partial);
  let turn = f(tile.bookRotation - tile.bookRotationPrev);
  turn = wrap(turn);
  const yaw = f(tile.bookRotationPrev + f(turn * partial));
  const flip = f(tile.pageFlipPrev + f(f(tile.pageFlip - tile.pageFlipPrev) * partial));
  const { right, left } = pageAngles(flip);
  const spread = f(tile.bookSpreadPrev + f(f(tile.bookSpread - tile.bookSpreadPrev) * partial));
  return {
    translate: [f(0.5), f(f(0.75) + f(f(0.1) + f(mhSin(f(tick * f(0.1))) * f(0.01)))), f(0.5)],
    yawDegrees: f(f(f(-yaw) * 180) / PI), tiltDegrees: 80,
    tick, flipRight: right, flipLeft: left, spread,
  };
}

// ModelBook (bhf): parts in render order with their texture offset, box (x, y, z, dx, dy, dz) and rotation point. The
// 64 x 32 model texture is a plain `textures/entity/enchanting_table_book.png`; this build draws its own (see
// enchanting-book-renderer.js). The spine starts turned a quarter turn about y.
export const BOOK_TEXTURE = { width: 64, height: 32 };
export const BOOK_PARTS = Object.freeze({
  coverRight: { uv: [0, 0], box: [-6, -5, 0, 6, 10, 0], point: [0, 0, -1] },
  coverLeft: { uv: [16, 0], box: [0, -5, 0, 6, 10, 0], point: [0, 0, 1] },
  bookSpine: { uv: [12, 0], box: [-1, -5, 0, 2, 10, 0], point: [0, 0, 0], angle: [0, f(Math.PI / 2), 0] },
  pagesRight: { uv: [0, 10], box: [0, -4, f(-0.99), 5, 8, 1], point: [0, 0, 0] },
  pagesLeft: { uv: [12, 10], box: [0, -4, f(-0.01), 5, 8, 1], point: [0, 0, 0] },
  flippingPageRight: { uv: [24, 10], box: [0, -4, 0, 5, 8, 0], point: [0, 0, 0] },
  flippingPageLeft: { uv: [24, 10], box: [0, -4, 0, 5, 8, 0], point: [0, 0, 0] },
});
export const BOOK_PART_ORDER = Object.freeze(['coverRight', 'coverLeft', 'bookSpine', 'pagesRight', 'pagesLeft', 'flippingPageRight', 'flippingPageLeft']);

/** ModelBook.setRotationAngles(tick, flipRight, flipLeft, spread): rotation point x and the three angles of every part. */
export function bookAngles(tick, flipRight, flipLeft, spread) {
  const a = f(f(f(mhSin(f(tick * f(0.02))) * f(0.1)) + f(1.25)) * spread);
  const part = (x, y) => [x, 0, 0, 0, y, 0]; // [pointX, pointY, pointZ, angleX, angleY, angleZ]; point z is set below
  const out = {
    coverRight: part(0, f(PI + a)),
    coverLeft: part(0, f(-a)),
    bookSpine: part(0, f(Math.PI / 2)),
    pagesRight: part(mhSin(a), a),
    pagesLeft: part(mhSin(a), f(-a)),
    flippingPageRight: part(mhSin(a), f(a - f(f(a * 2) * flipRight))),
    flippingPageLeft: part(mhSin(a), f(a - f(f(a * 2) * flipLeft))),
  };
  out.coverRight[2] = -1; out.coverLeft[2] = 1;
  return out;
}

/**
 * ModelBox's six TexturedQuads for a box at texture offset (u, v) on a w x h texture, in model pixels. Each quad is four
 * [x, y, z, u, v] (u and v in 0..1), in the original vertex order. A zero depth gives degenerate side quads.
 */
export function modelBoxQuads([u, v], [x, y, z, dx, dy, dz], w = BOOK_TEXTURE.width, h = BOOK_TEXTURE.height) {
  const x2 = f(x + dx), y2 = f(y + dy), z2 = f(z + dz);
  const P = [[x, y, z], [x2, y, z], [x2, y2, z], [x, y2, z], [x, y, z2], [x2, y, z2], [x2, y2, z2], [x, y2, z2]];
  const quad = (ids, u1, v1, u2, v2) => {
    const uv = [[u2, v1], [u1, v1], [u1, v2], [u2, v2]];
    return ids.map((id, i) => [...P[id], f(uv[i][0] / w), f(uv[i][1] / h)]);
  };
  return [
    quad([5, 1, 2, 6], u + dz + dx, v + dz, u + dz + dx + dz, v + dz + dy),
    quad([0, 4, 7, 3], u, v + dz, u + dz, v + dz + dy),
    quad([5, 4, 0, 1], u + dz, v, u + dz + dx, v + dz),
    quad([2, 3, 7, 6], u + dz + dx, v + dz, u + dz + dx + dx, v),
    quad([1, 0, 3, 2], u + dz, v + dz, u + dz + dx, v + dz + dy),
    quad([4, 5, 6, 7], u + dz + dx + dz, v + dz, u + dz + dx + dz + dx, v + dz + dy),
  ];
}

/**
 * GuiEnchantment.updateScreen's book step (fields u, v, w, x, y, z, A). `levels` are the container's three slot levels
 * (ContainerEnchantment.field_75167_g) and `item` the stack in slot 0; the book turns pages whenever the stack changes.
 */
export class GuiBook {
  constructor(random = new JavaRandom(Math.floor(Math.random() * 2 ** 48))) {
    Object.assign(this, { random, item: null, tickCount: 0, pageFlip: 0, pageFlipPrev: 0, flipT: 0, flipA: 0, bookSpread: 0, bookSpreadPrev: 0 });
  }
  tick(item, levels) {
    if (!sameStack(item, this.item)) {
      this.item = item ? JSON.parse(JSON.stringify(item)) : null;
      do this.flipT = f(this.flipT + (this.random.nextInt(4) - this.random.nextInt(4)));
      while (this.pageFlip <= f(this.flipT + 1) && this.pageFlip >= f(this.flipT - 1));
    }
    this.tickCount++;
    this.pageFlipPrev = this.pageFlip;
    this.bookSpreadPrev = this.bookSpread;
    const any = levels.some((l) => l !== 0);
    this.bookSpread = clamp(f(any ? this.bookSpread + f(0.2) : this.bookSpread - f(0.2)), 0, 1);
    const flip = clamp(f(f(this.flipT - this.pageFlip) * f(0.4)), f(-0.2), f(0.2));
    this.flipA = f(this.flipA + f(f(flip - this.flipA) * f(0.9)));
    this.pageFlip = f(this.pageFlip + this.flipA);
  }
}
/** ItemStack.areItemStacksEqual: both empty, or same item, count, damage and tag. */
export function sameStack(a, b) {
  if (!a || !b) return !a && !b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * GuiEnchantment.drawGuiContainerBackgroundLayer's book (320 x 240 viewport centred on the screen, projection translated by
 * (-0.34, 0.23), gluPerspective(90, 4/3, 9, 80)), modelview: translate (0, 3.3, -16), scale 5, rotate 180 about z and
 * 20 about x, translate ((1 - s) * (0.2, 0.1, 0.25)), rotate -(1 - s) * 90 - 90 about y and 180 about x, then ModelBook
 * with tick 0.
 */
export const GUI_BOOK_VIEW = Object.freeze({ viewport: [320, 240], shift: [-0.34, 0.23], fov: 90, aspect: f(1.3333334), near: 9, far: 80, translate: [0, f(3.3), -16], scale: 5 });
export function guiBookPose(book, partial) {
  const spread = f(book.bookSpreadPrev + f(f(book.bookSpread - book.bookSpreadPrev) * partial));
  const flip = f(book.pageFlipPrev + f(f(book.pageFlip - book.pageFlipPrev) * partial));
  const { right, left } = pageAngles(flip);
  const k = f(1 - spread);
  return { spread, flipRight: right, flipLeft: left, shift: [f(k * f(0.2)), f(k * f(0.1)), f(k * f(0.25))], yawDegrees: f(f(f(-k) * 90) - 90), tick: 0 };
}
