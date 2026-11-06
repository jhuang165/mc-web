// Live wiring of the enchanting table's book (TileEntityEnchantmentTable) and the GuiEnchantment extras: the tile entities
// of every resident table, their 20 Hz updateEntity, and the screen's book and galactic option names. The rules are in
// enchanting-book.js, the drawing in enchanting-book-renderer.js and enchanting-glyphs.js.
import { BookTile, closestPlayer, GuiBook, enchantNames } from './enchanting-book.js';
import { galacticMaskUrl, BUTTON_TEXT_WIDTH } from './enchanting-glyphs.js';

const SCAN_INTERVAL = 20;

export class EnchantingBooks {
  constructor(tableId) { Object.assign(this, { tableId, tiles: new Map(), ticks: 0 }); }
  static key(x, y, z) { return `${x},${y},${z}`; }
  /** Tile entities exist for every table block of a resident column: add new tables, drop tables that are gone. */
  scan(world) {
    const seen = new Set(), { height } = world;
    for (const chunk of world.chunks.values()) {
      const blocks = chunk.blocks;
      for (let i = blocks.indexOf(this.tableId); i !== -1; i = blocks.indexOf(this.tableId, i + 1)) {
        const y = i % height, column = (i - y) / height, x = chunk.x * 16 + (column >> 4), z = chunk.z * 16 + (column & 15), key = EnchantingBooks.key(x, y, z);
        seen.add(key);
        if (!this.tiles.has(key)) this.tiles.set(key, new BookTile(x, y, z));
      }
    }
    for (const key of this.tiles.keys()) if (!seen.has(key)) this.tiles.delete(key);
  }
  /** A block change: a placed table gets its tile at once, a removed one loses it (TileEntity goes with its block). */
  changed(x, y, z, now) {
    const key = EnchantingBooks.key(x, y, z);
    if (now === this.tableId) { if (!this.tiles.has(key)) this.tiles.set(key, new BookTile(x, y, z)); }
    else this.tiles.delete(key);
  }
  /** One client tick of every table; `players` are [{x, y, z}] (the local player). */
  tick(world, players) {
    if (this.world !== world) { this.world = world; this.tiles.clear(); this.ticks = 0; } // another dimension or a loaded save
    if (this.ticks++ % SCAN_INTERVAL === 0) this.scan(world);
    for (const t of this.tiles.values()) t.update(closestPlayer(players, t.x, t.y, t.z));
  }
  clear() { this.tiles.clear(); this.ticks = 0; }
}

/**
 * The book and the three galactic names inside the open enchanting screen (`modal` is the .enchanting-modal element).
 * `tick(container)` is GuiEnchantment.updateScreen, `frame(partial)` the book drawn in drawGuiContainerBackgroundLayer and
 * `names(container)` the text of the buttons.
 */
export class EnchantingScreenExtras {
  constructor(modal, createView) {
    this.modal = modal;
    this.book = new GuiBook();
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'enchant-book-canvas';
    this.canvas.width = 640; this.canvas.height = 480; // twice the 320 x 240 GUI viewport
    modal.prepend(this.canvas);
    try { this.view = createView(this.canvas); } catch { this.view = null; this.canvas.remove(); } // no WebGL: the book stays out
    this.maskKey = ['', '', ''];
  }
  tick(container) { this.book.tick(container.item, container.levels); }
  frame(partial) { this.view?.render(this.book, partial); }
  names(container) {
    const names = enchantNames(container.nameSeed), key = `${container.nameSeed}`;
    this.modal.querySelectorAll('[data-enchant-option]').forEach((button, i) => {
      const slot = button.querySelector('.enchant-name');
      if (!slot || this.maskKey[i] === `${key}:${names[i]}`) return;
      const { url, height } = galacticMaskUrl(names[i], BUTTON_TEXT_WIDTH);
      slot.style.setProperty('--name-mask', `url(${url})`);
      slot.style.height = `calc(${height}*var(--u))`;
      slot.dataset.galactic = names[i];
      this.maskKey[i] = `${key}:${names[i]}`;
    });
  }
  dispose() { this.view?.dispose(); this.canvas.remove(); }
}
