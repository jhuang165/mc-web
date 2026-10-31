// Minecraft Java 1.7.10 creative inventory: CreativeTabs (abt),
// GuiContainerCreative (bfl), its ContainerCreative (bfm) and CreativeSlot (bfn).
// Tab lists keep the original order (CreativeTabs.displayAllReleventItems and the
// search tab's registry walk); tools/verify-creative.mjs regenerates the
// original lists in public/research/creative-reference.json.
import { DYE, RED_FLOWER, YELLOW_FLOWER, SNOW_LAYER, ICE, SAPLING } from "./world.js";
import { Container, ContainerScreen, Slot, StackArray, copyStack, makeStack, OUTSIDE } from "./inventory.js";

// A list entry is an item id, or [id, damage] for a metadata subtype: BlockColored
// (aka).func_149666_a lists the 16 wool colours in metadata order.
// BlockFlower.getSubBlocks and ItemDye.getSubItems list metadata in order.
const RED_FLOWERS = [RED_FLOWER, ...Array.from({ length: 8 }, (_, i) => [RED_FLOWER, i + 1])];
const DYES = [DYE, ...Array.from({ length: 15 }, (_, i) => [DYE, i + 1])];
const WOOLS = [19, ...Array.from({ length: 15 }, (_, i) => [19, i + 1])];
export const entryId = (e) => (Array.isArray(e) ? e[0] : e);
const tab = (index, label, name, icon, items, extra = {}) => ({ index, label, name, icon, items, column: index % 6, topRow: index < 6, background: "items.png", scrollbar: true, title: true, ...extra });
// Game item IDs in original order; icons are the tab's getIconItemStack.
export const CREATIVE_TABS = [
  tab(0, "buildingBlocks", "Building Blocks", { id: 8 }, [3, 1, 2, 12, 7, 11, 6, 25, 18, 16, 15, 4, 9, ...WOOLS, 27, 26, 8, 21, 22, 17, 28, ICE, 23, 24, 40]),
  tab(1, "decorations", "Decoration Blocks", { texture: "blocks/double_plant_paeonia_top" }, [SAPLING, 5, 39, YELLOW_FLOWER, ...RED_FLOWERS, 20, 41, 13, 14, SNOW_LAYER]),
  tab(2, "redstone", "Redstone", { texture: "items/redstone_dust" }, []),
  tab(3, "transportation", "Transportation", { texture: "blocks/rail_golden" }, []),
  tab(4, "misc", "Miscellaneous", { texture: "items/bucket_lava" }, [340, 341, 342, 312, 343, 314, 311]),
  tab(5, "search", "Search Items", { texture: "items/compass", frames: 32 }, [], { background: "item_search.png" }),
  tab(6, "food", "Foodstuffs", { id: 200 }, [200, 201, 202, 203, 204, 205, 318, 319, 206]),
  tab(7, "tools", "Tools", { id: 106 }, [110, 102, 106, 126, 108, 100, 104, 109, 101, 105, 111, 103, 107, 118, 116, 117, 120, 121, 122, 123, 124, 125]),
  tab(8, "combat", "Combat", { id: 119 }, [127, 320, 114, 112, 113, 115, 119, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 416, 417, 418, 419, 412, 413, 414, 415]),
  tab(9, "brewing", "Brewing", { potion: 0x385dc6 }, []),
  tab(10, "materials", "Materials", { id: 300 }, [301, 308, 303, 302, 304, 300, 321, 317, 309, 305, 313, 315, 306, 307, 316, ...DYES]),
  tab(11, "inventory", "Survival Inventory", { id: 41 }, [], { background: "inventory.png", scrollbar: false, title: false }),
];
export const SEARCH = CREATIVE_TABS[5], SURVIVAL_TAB = CREATIVE_TABS[11];
// updateCreativeSearch walks Item.itemRegistry: items with a creative tab, by ID.
export const SEARCH_ORDER = [3, 1, 2, 12, 7, SAPLING, 11, 6, 25, 18, 16, 15, 4, 5, 9, 39, ...WOOLS, YELLOW_FLOWER, ...RED_FLOWERS, 27, 26, 8, 21, 22, 20, 41, 17, 28, 13, 14, SNOW_LAYER, ICE, 23, 24, 40, 110, 102, 106, 126, 200, 127, 320, 301, 308, 303, 302, 304, 114, 112, 108, 100, 104, 113, 109, 101, 105, 115, 111, 103, 107, 300, 119, 118, 116, 117, 321, 317, 120, 121, 122, 123, 124, 309, 305, 201, 400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 416, 417, 418, 419, 412, 413, 414, 415, 313, 202, 203, 340, 341, 342, 312, 315, 343, 306, 307, 314, 316, ...DYES, 311, 125, 204, 205, 318, 319, 206];
// Item.getCreativeTab, for the search tab's tooltip line.
export const itemTab = (id) => CREATIVE_TABS.find((t) => t.items.some((e) => entryId(e) === id)) ?? null;
export const GUI_WIDTH = 195, GUI_HEIGHT = 136, SEARCH_MAX = 15;

// GuiContainerCreative.drawTab: tab art position and texture offset.
export function tabArea(t, selected = false) {
  let x = 28 * t.column;
  if (t.column === 5) x = GUI_WIDTH - 28;
  else if (t.column > 0) x += t.column;
  const y = t.topRow ? -28 : GUI_HEIGHT - 4;
  return { x, y, u: 28 * t.column, v: (selected ? 32 : 0) + (t.topRow ? 0 : 64), iconX: x + 6, iconY: y + 8 + (t.topRow ? 1 : -1) };
}
// func_147049_a's click box is two pixels right of the art for the last column.
function tabHit(t) {
  let x = 28 * t.column;
  if (t.column === 5) x = GUI_WIDTH - 28 + 2;
  else if (t.column > 0) x += t.column;
  return { x, y: t.topRow ? -32 : GUI_HEIGHT };
}
export const overTab = (t, x, y) => { const h = tabHit(t); return x >= h.x && x <= h.x + 28 && y >= h.y && y <= h.y + 32; };
// func_147052_b shows the name over func_146978_c(x + 3, y + 3, 23, 27).
export const overTabLabel = (t, x, y) => { const h = tabHit(t); return x >= h.x + 2 && x < h.x + 27 && y >= h.y + 2 && y < h.y + 31; };

// GuiTextField (bcd) typing as the search box uses it: always focused, no
// background, 15 characters, ChatAllowedCharacters filtering.
export class TextField {
  text = "";
  cursor = 0;
  constructor(max = SEARCH_MAX) { this.max = max; }
  set(text) { this.text = text.slice(0, this.max); this.cursor = this.text.length; }
  write(chars) {
    const allowed = [...chars].filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127 && c !== "§").join(""),
      room = this.max - this.text.length,
      add = allowed.slice(0, Math.max(0, room));
    this.text = this.text.slice(0, this.cursor) + add + this.text.slice(this.cursor);
    this.cursor += add.length;
  }
  // Returns whether textboxKeyTyped handled the key.
  key({ key, ctrl = false }) {
    if (key === "Backspace") { if (this.cursor > 0) { this.text = this.text.slice(0, this.cursor - 1) + this.text.slice(this.cursor); this.cursor--; } return true; }
    if (key === "Delete") { this.text = this.text.slice(0, this.cursor) + this.text.slice(this.cursor + 1); return true; }
    if (key === "ArrowLeft") { this.cursor = Math.max(0, this.cursor - 1); return true; }
    if (key === "ArrowRight") { this.cursor = Math.min(this.text.length, this.cursor + 1); return true; }
    if (key === "Home") { this.cursor = 0; return true; }
    if (key === "End") { this.cursor = this.text.length; return true; }
    if (key.length !== 1 || ctrl) return false;
    const c = key.charCodeAt(0);
    if (c < 32 || c === 127 || key === "§") return false;
    this.write(key);
    return true;
  }
}

// CreativeSlot: shows a ContainerPlayer slot at a creative position.
class CreativeSlot extends Slot {
  // Added to the list directly, so slotNumber keeps Java's default 0.
  constructor(base, index) { super(base.inventory, index, 0, 0); Object.assign(this, { base, type: base.type, number: 0 }); }
  get stack() { return this.base.stack; }
  get has() { return this.base.has; }
  get limit() { return this.base.limit; }
  put(s) { this.base.put(s); }
  changed() { this.base.changed(); }
  valid(s) { return this.base.valid(s); }
  decr(n) { return this.base.decr(n); }
  onPickup(s) { this.base.onPickup(s); }
}

// ContainerCreative: a 9 x 5 window onto `list` over the shared 45-slot
// "tmp" inventory, then the hotbar.
export class CreativeContainer extends Container {
  constructor(inv, grid = new StackArray(Array(45).fill(null))) {
    super(inv);
    this.tmp = grid;
    this.list = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 9; col++) this.addSlot(new Slot(grid, row * 9 + col, 9 + col * 18, 18 + row * 18));
    for (let col = 0; col < 9; col++) this.addSlot(new Slot(inv, col, 9 + col * 18, 112));
    this.scrollTo(0);
  }
  rows() { return Math.floor(this.list.length / 9) - 5 + 1; }
  scrollTo(f) {
    const offset = Math.max(0, Math.trunc(Math.fround(f * this.rows()) + 0.5));
    for (let row = 0; row < 5; row++)
      for (let col = 0; col < 9; col++) {
        const k = col + (row + offset) * 9;
        this.tmp.stacks[col + row * 9] = k >= 0 && k < this.list.length ? this.list[k] : null;
      }
  }
  canScroll() { return this.list.length > 45; }
  // Shift-clicking a hotbar slot clears it; nothing else moves.
  transfer(index) {
    if (index >= this.slots.length - 9 && index < this.slots.length) { const slot = this.slots[index]; if (slot?.has) slot.put(null); }
    return null;
  }
  canMerge(stack, slot) { return slot.y > 90; }
  canDrag(slot) { return slot.inventory === this.inv || (slot.y > 90 && slot.x <= 162); }
}

let selectedTab = 0; // GuiContainerCreative.selectedTabIndex is static
export const resetCreativeTab = () => (selectedTab = 0);

// GuiContainerCreative: tab switching, scrolling, search and handleMouseClick.
export class CreativeScreen extends ContainerScreen {
  constructor(inv, { playerContainer, tooltip = (s) => [], tmp } = {}) {
    super(new CreativeContainer(inv, tmp));
    Object.assign(this, { inv, playerContainer, tooltip, scroll: 0, scrolling: false, clearSearch: false, bin: null, saved: null, player: null });
    this.field = new TextField();
    const start = selectedTab;
    selectedTab = -1;
    this.setTab(CREATIVE_TABS[start]);
  }
  get tab() { return CREATIVE_TABS[selectedTab]; }
  stacks(ids) { return ids.map((e) => (Array.isArray(e) ? makeStack(e[0], 1, e[1]) : makeStack(e, 1))); }
  // setCurrentCreativeTab
  setTab(t) {
    const previous = selectedTab, c = this.container;
    selectedTab = t.index;
    this.dragSlots.clear();
    c.list = t === SEARCH ? [] : this.stacks(t.items);
    if (t === SURVIVAL_TAB) {
      this.player ??= this.playerContainer();
      this.player.drops = c.drops;
      if (!this.saved) this.saved = c.slots;
      c.slots = this.player.slots.map((base, i) => {
        const slot = new CreativeSlot(base, i);
        if (i >= 5 && i < 9) { const j = i - 5; slot.x = 9 + Math.floor(j / 2) * 54; slot.y = 6 + (j % 2) * 27; }
        else if (i < 5) slot.x = slot.y = -2000;
        else if (i < this.player.slots.length) { const j = i - 9; slot.x = 9 + (j % 9) * 18; slot.y = i >= 36 ? 112 : 54 + Math.floor(j / 9) * 18; }
        return slot;
      });
      this.bin = Object.assign(new Slot(c.tmp, 0, 173, 112), { number: 0 });
      c.slots.push(this.bin);
    } else if (previous === SURVIVAL_TAB.index) {
      c.slots = this.saved;
      this.saved = null;
    }
    if (t === SEARCH) { this.field.set(""); this.search(); }
    this.scroll = 0;
    c.scrollTo(0);
  }
  // updateCreativeSearch: the item's tooltip lines must contain the text.
  search() {
    const c = this.container, text = this.field.text.toLowerCase();
    c.list = this.stacks(SEARCH_ORDER).filter((s) => this.tooltip(s).some((line) => line.toLowerCase().includes(text)));
    this.scroll = 0;
    c.scrollTo(0);
  }
  needsScroll() { return this.tab !== SURVIVAL_TAB && this.tab.scrollbar && this.container.canScroll(); }
  setScroll(f) { this.scroll = Math.min(1, Math.max(0, Math.fround(f))); this.container.scrollTo(this.scroll); }
  // handleMouseInput: one row per wheel notch, positive is up.
  wheel(delta) {
    if (!delta || !this.needsScroll()) return;
    const rows = Math.floor(this.container.list.length / 9) - 5 + 1;
    this.setScroll(this.scroll - (delta > 0 ? 1 : -1) / rows);
  }
  // drawScreen: pressing inside the 14 x 112 track at (175, 18) drags the bar.
  press(x, y) { if (x >= 175 && y >= 18 && x < 189 && y < 130) this.scrolling = this.needsScroll(); }
  drag(y) { if (this.scrolling) this.setScroll((y - 18 - 7.5) / (130 - 18 - 15)); }
  release() { this.scrolling = false; }
  scrollbarY() { return 18 + Math.trunc(Math.fround((112 - 17) * this.scroll)); }
  tabAt(x, y) { return CREATIVE_TABS.find((t) => overTab(t, x, y)) ?? null; }
  tabLabelAt(x, y) { return CREATIVE_TABS.find((t) => overTabLabel(t, x, y)) ?? null; }
  overBin(x, y) { return this.tab === SURVIVAL_TAB && x >= 172 && x < 190 && y >= 111 && y < 129; }
  // keyTyped: returns true when the creative screen used the key.
  typed(event, hovered) {
    if (this.tab !== SEARCH) {
      if (event.code === "KeyT") { this.setTab(SEARCH); return true; }
      return false;
    }
    if (this.clearSearch) { this.clearSearch = false; this.field.set(""); }
    const digit = /^Digit([1-9])$/.exec(event.code ?? "");
    if (digit && this.hotbarKey(hovered, +digit[1] - 1)) return true;
    if (this.field.key(event)) { this.search(); return true; }
    return false;
  }
  drop(s) { if (s?.count > 0) this.container.drops.push(s); }
  // handleMouseClick(slot, slotId, button, mode)
  send(slot, id, button, mode) {
    const inv = this.inv, c = this.container, held = inv.cursor, survival = this.tab === SURVIVAL_TAB;
    this.clearSearch = true;
    const shift = mode === 1;
    if (id === OUTSIDE && mode === 0) mode = 4;
    if (!slot && !survival && mode !== 5) {
      if (!held) return null;
      if (button === 0) { this.drop(held); inv.cursor = null; }
      if (button === 1) { held.count--; this.drop(makeStack(held.id, 1, held.damage)); if (held.count === 0) inv.cursor = null; }
      return null;
    }
    if (slot === this.bin && shift) { for (const s of this.player.slots) s.put(null); return null; }
    if (survival) {
      if (slot === this.bin) inv.cursor = null;
      else if (mode === 4 && slot?.has) this.drop(slot.decr(button === 0 ? 1 : inv.maxStack(slot.stack)));
      else if (mode === 4 && held) { this.drop(held); inv.cursor = null; }
      else this.player.click(slot ? slot.base.number : id, button, mode);
      return null;
    }
    if (mode !== 5 && slot.inventory === c.tmp) {
      const here = slot.stack;
      if (mode === 2) {
        if (here && button >= 0 && button < 9) { const s = copyStack(here); s.count = inv.maxStack(s); inv.setStack(button, s); }
        return null;
      }
      if (mode === 3) {
        if (!held && here) { const s = copyStack(here); s.count = inv.maxStack(s); inv.cursor = s; }
        return null;
      }
      if (mode === 4) {
        if (here) { const s = copyStack(here); s.count = button === 0 ? 1 : inv.maxStack(s); this.drop(s); }
        return null;
      }
      if (held && here && held.id === here.id && held.damage === here.damage) {
        if (button === 0) { if (shift) held.count = inv.maxStack(held); else if (held.count < inv.maxStack(held)) held.count++; }
        else if (held.count <= 1) inv.cursor = null;
        else held.count--;
      } else if (here && !held) {
        inv.cursor = copyStack(here);
        if (shift) inv.cursor.count = inv.maxStack(inv.cursor);
      } else inv.cursor = null;
      return null;
    }
    return c.click(slot ? slot.number : id, button, mode);
  }
}
