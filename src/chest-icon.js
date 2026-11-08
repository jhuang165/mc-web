import { TRAPPED_CHEST, ENDER_CHEST, ITEM_TRAPPED_CHEST, ITEM_ENDER_CHEST } from './chest-blocks.js';
import { christmas } from './chest.js';

export const CHEST_ICON_TEXTURES = ['normal', 'trapped', 'ender', 'christmas'].map(name => 'entity/chest/' + name);

export function chestIconTexture(id, date = new Date()) {
  if (id === ENDER_CHEST || id === ITEM_ENDER_CHEST) return 'entity/chest/ender';
  if (id === TRAPPED_CHEST || id === ITEM_TRAPPED_CHEST) return 'entity/chest/trapped';
  return id === 41 ? 'entity/chest/' + (christmas(date) ? 'christmas' : 'normal') : null;
}

// Render type 22 uses ModelChest, including its inset sides and projecting latch.
// Paint its three closed boxes in the same inventory projection as the other block icons.
// UV rectangles are ModelBox's +X, +Z and +Y faces, without atlas padding or rescaling to a full block.
export function drawChestIcon(ctx, source) {
  const project = (x, y, z) => [32 + 1.75 * (z - x), 34 + x + z - 2 * y];
  const scale = source.width / 64;
  const face = (u, v, w, h, points, shade) => {
    const [a, b, d] = points;
    ctx.save();
    ctx.setTransform((b[0] - a[0]) / w, (b[1] - a[1]) / w, (d[0] - a[0]) / h, (d[1] - a[1]) / h, a[0], a[1]);
    ctx.drawImage(source, u * scale, v * scale, w * scale, h * scale, 0, 0, w, h);
    if (shade) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(0,0,0,${shade})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.restore();
  };
  const box = (x, y, z, w, h, d, u, v) => {
    const x1 = x + w, y1 = y + h, z1 = z + d;
    face(u + d + w, v + d, d, h, [project(x1, y1, z1), project(x1, y1, z), project(x1, y, z1)], .2);
    face(u + d, v + d, w, h, [project(x, y1, z1), project(x1, y1, z1), project(x, y, z1)], .08);
    face(u + d, v, w, d, [project(x, y1, z), project(x1, y1, z), project(x, y1, z1)], 0);
  };
  box(1, 0, 1, 14, 10, 14, 0, 19);
  box(1, 9, 1, 14, 5, 14, 0, 0);
  box(7, 7, 15, 2, 4, 1, 0, 0);
}
