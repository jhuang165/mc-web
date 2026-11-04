// Minecraft Java 1.7.10 InventoryPlayer (yx), Container (zs), Slot (aay),
// SlotCrafting (aax), SlotFurnace (aak), ContainerPlayer (aap),
// ContainerWorkbench (aaf), ContainerFurnace (aaj) and GuiContainer (bex).
// Stacks are mutable {id,count,damage} objects, so splits, merges and shared
// references behave like ItemStack. tools/verify-inventory.mjs replays the same
// scripts through the unchanged original classes.
import { copyStored, normalizeStored } from "./enchanted-books.js";
import { JavaRandom } from "./java-random.js";
import { damageLiveItemStack } from "./item-durability.js";
export const OUTSIDE = -999, STACK_LIMIT = 64, DOUBLE_CLICK_MS = 250;
// Legacy enchanted books carry `stored` (StoredEnchantments, enchanted-books.js). Native item tags
// use enchantments/storedEnchantments, displayName, repairCost and unbreakable. Copies and splits
// deep-copy the tag lists; `stored` stays accepted for old saves and creative-book call sites.
const TAG_LISTS = ["enchantments", "storedEnchantments"];
const clonePairs = (pairs) => Array.isArray(pairs) ? pairs.map((e) => ({ ...e })) : pairs;
// Keep the old fourth `stored` argument for enchanted-book call sites; the optional fifth argument
// carries the remaining native ItemStack tag fields introduced by enchanting/anvil persistence.
export const makeStack = (id, count = 1, damage = 0, stored, metadata = {}) => {
  const stack = { ...metadata, id, count, damage };
  if (stored !== undefined) stack.stored = copyStored(stored);
  for (const key of TAG_LISTS) if (Array.isArray(stack[key])) stack[key] = clonePairs(stack[key]);
  return stack;
};
export const copyStack = (s) => (s ? makeStack(s.id, s.count, s.damage, s.stored, s) : null);
const split = (s, n) => { s.count -= n; return copyStack({ ...s, count: n }); };
const samePairs = (a, b) => Array.isArray(a) === Array.isArray(b) && (!Array.isArray(a) || (a.length === b.length && a.every((e, i) => e?.id === b[i]?.id && e?.lvl === b[i]?.lvl)));
const storedTag = (s) => Array.isArray(s.storedEnchantments) ? s.storedEnchantments : s.stored?.length ? s.stored : undefined;
const sameTag = (a, b) => a.repairCost === b.repairCost && a.displayName === b.displayName && a.unbreakable === b.unbreakable && a.color === b.color &&
  samePairs(a.enchantments, b.enchantments) && samePairs(storedTag(a), storedTag(b));
// ItemStack.areItemStackTagsEqual: every supported NBT tag participates in merge identity.
export const sameStackItem = (a, b) => !!a && !!b && a.id === b.id && (a.damage ?? 0) === (b.damage ?? 0) && sameTag(a, b);
export const dragButton = (event, mode) => (event & 3) | ((mode & 3) << 2);

export class PlayerInventory {
  constructor(items, saved = [], armor = [], randomState) {
    this.items = items;
    this.main = Array(36).fill(null);
    this.armor = Array(4).fill(null);
    this.cursor = null;
    this.current = 0;
    this.creative = false;
    this.random = new JavaRandom(0);
    if (randomState) this.random.restore(randomState);
    if (Array.isArray(saved)) saved.slice(0, 36).forEach((s, i) => (this.main[i] = this.read(s)));
    // armor[0] boots ... armor[3] helmet, as InventoryPlayer.armorInventory.
    if (Array.isArray(armor)) armor.slice(0, 4).forEach((s, i) => { const a = this.read(s); if (a && items[a.id]?.armor === 3 - i) this.armor[i] = a; });
  }
  read(s) {
    // Saves from before ItemDye (id 351) kept bone meal as internal item 310.
    if (s && typeof s === "object" && s.id === 310) s = { ...s, id: 351, damage: 15 };
    const item = s && typeof s === "object" && s.id ? this.items[s.id] : null,
      count = Math.floor(Number(s?.count));
    if (!item || !(count > 0)) return null;
    const metadata = {};
    for (const key of TAG_LISTS) if (Array.isArray(s[key])) metadata[key] = s[key].filter((e) => Number.isFinite(e?.id) && Number.isFinite(e?.lvl)).slice(0, 64).map((e) => ({ id: (Math.trunc(e.id) << 16) >> 16, lvl: (Math.trunc(e.lvl) << 16) >> 16 }));
    if (Number.isFinite(s.repairCost)) metadata.repairCost = s.repairCost | 0;
    if (typeof s.displayName === "string") metadata.displayName = s.displayName;
    if (typeof s.unbreakable === "boolean") metadata.unbreakable = s.unbreakable;
    if (Number.isInteger(s.color) && s.color >= 0 && s.color <= 0xFFFFFF) metadata.color = s.color;
    const storedList = item.storesEnchantments ? normalizeStored(s.storedEnchantments ?? s.stored) ?? [] : s.stored;
    return makeStack(s.id, Math.min(count, item.stack ?? STACK_LIMIT), Math.max(0, Math.min(item.durability || (item.variants?.length ?? 1) - 1, Math.floor(Number(s.damage) || 0))), storedList, metadata);
  }
  maxStack(s) { return this.items[s.id]?.stack ?? STACK_LIMIT; }
  maxDamage(s) { return this.items[s.id]?.durability || 0; }
  damaged(s) { return this.maxDamage(s) > 0 && s.damage > 0; }
  stackable(s) { return this.maxStack(s) > 1 && !this.damaged(s); }
  get limit() { return STACK_LIMIT; }
  getStack(i) { return (i < 36 ? this.main[i] : this.armor[i - 36]) ?? null; }
  setStack(i, s) { if (i < 36) this.main[i] = s; else this.armor[i - 36] = s; }
  decr(i, n) {
    const s = this.getStack(i);
    if (!s) return null;
    if (s.count <= n) { this.setStack(i, null); return s; }
    const out = split(s, n);
    if (s.count === 0) this.setStack(i, null);
    return out;
  }
  get held() { return this.main[this.current] ?? null; }
  count(id) { return this.main.reduce((n, s) => n + (s?.id === id ? s.count : 0), 0); }
  firstEmpty() { return this.main.findIndex((s) => !s); }
  find(id, damage) { return this.main.findIndex((s) => s?.id === id && (damage === undefined || s.damage === damage)); }
  storeItemStack(s) {
    return this.main.findIndex((m) => m && sameStackItem(m, s) && this.stackable(m) && m.count < this.maxStack(m) && m.count < this.limit);
  }
  storePartial(s) {
    if (this.maxStack(s) === 1) {
      const j = this.firstEmpty();
      if (j < 0) return s.count;
      this.main[j] ??= copyStack(s);
      return 0;
    }
    let j = this.storeItemStack(s);
    if (j < 0) j = this.firstEmpty();
    if (j < 0) return s.count;
    const m = (this.main[j] ??= copyStack({ ...s, count: 0 }));
    const k = Math.min(s.count, this.maxStack(m) - m.count, this.limit - m.count);
    if (k === 0) return s.count;
    m.count += k;
    return s.count - k;
  }
  // addItemStackToInventory: shrinks s and reports progress on the last pass only.
  add(s) {
    if (!s || s.count === 0 || !this.items[s.id]) return false;
    if (this.damaged(s)) {
      const i = this.firstEmpty();
      if (i >= 0) { this.main[i] = copyStack(s); s.count = 0; return true; }
      if (this.creative) { s.count = 0; return true; }
      return false;
    }
    let before;
    do { before = s.count; s.count = this.storePartial(s); } while (s.count > 0 && s.count < before);
    if (s.count === before && this.creative) { s.count = 0; return true; }
    return s.count < before;
  }
  consume(id) {
    const i = this.find(id);
    if (i < 0) return false;
    if (--this.main[i].count <= 0) this.main[i] = null;
    return true;
  }
  // ItemStack.damageItem, then destroyCurrentEquippedItem for an emptied stack.
  damage(i, amount = 1) {
    const s = this.getStack(i);
    if (!s || this.creative || s.unbreakable === true || amount <= 0 || !this.maxDamage(s)) return false;
    const item = this.items[s.id];
    if (!damageLiveItemStack(s, item, amount, this.random)) return false;
    s.count = Math.max(0, s.count - 1);
    s.damage = 0;
    if (s.count === 0) this.setStack(i, null);
    return true;
  }
  // Middle-click pick block (func_146030_a); `damage` is the block's metadata
  // for subtype items such as wool, otherwise any stack of the item matches.
  pick(id, creative = this.creative, damage) {
    const previous = this.held, k = this.find(id, damage);
    if (k >= 0 && k < 9) { this.current = k; return; }
    if (!creative || !this.items[id]) return;
    const j = this.firstEmpty();
    if (j >= 0 && j < 9) this.current = j;
    if (previous && this.maxStack(previous) === 1 && this.maxDamage(previous) && this.find(previous.id, previous.damage) === this.current) return;
    const found = this.find(id, damage ?? 0);
    if (found >= 0) {
      const n = this.main[found].count;
      this.main[found] = this.main[this.current];
      this.main[this.current] = makeStack(id, n, damage ?? 0);
    } else this.main[this.current] = makeStack(id, 1, damage ?? 0);
  }
  takeAll() {
    const out = [...this.main, ...this.armor].filter(Boolean);
    this.main.fill(null);
    this.armor.fill(null);
    return out;
  }
  serialize() { return this.main.map(copyStack); }
  serializeArmor() { return this.armor.map(copyStack); }
  serializeRandom() { return this.random.save(); }
}

// A fixed array of stacks (InventoryCrafting, TileEntityFurnace).
export class StackArray {
  constructor(stacks, onChange) { this.stacks = stacks; this.onChange = onChange; }
  get size() { return this.stacks.length; }
  get limit() { return STACK_LIMIT; }
  getStack(i) { return this.stacks[i] ?? null; }
  setStack(i, s) { this.stacks[i] = s; if (s && s.count > this.limit) s.count = this.limit; this.onChange?.(); }
  decr(i, n) {
    const s = this.stacks[i];
    if (!s) return null;
    if (s.count <= n) { this.stacks[i] = null; this.onChange?.(); return s; }
    const out = split(s, n);
    if (s.count === 0) this.stacks[i] = null;
    this.onChange?.();
    return out;
  }
  takeOnClose(i) { const s = this.stacks[i] ?? null; this.stacks[i] = null; return s; }
}
// InventoryCraftResult hands over its whole stack whatever amount is requested.
class ResultInventory {
  stack = null;
  get limit() { return STACK_LIMIT; }
  getStack() { return this.stack; }
  setStack(i, s) { this.stack = s; }
  decr() { const s = this.stack; this.stack = null; return s; }
}

export class Slot {
  constructor(inventory, index, x, y) { Object.assign(this, { inventory, index, x, y, number: -1 }); }
  get stack() { return this.inventory.getStack(this.index); }
  get has() { return !!this.stack; }
  get limit() { return this.inventory.limit; }
  put(s) { this.inventory.setStack(this.index, s); this.changed(); }
  changed() {}
  valid() { return true; }
  canTake() { return true; }
  decr(n) { return this.inventory.decr(this.index, n); }
  onPickup() { this.changed(); }
  onSlotChange(now, before) {
    if (now && before && now.id === before.id && before.count > now.count) this.crafted(before, before.count - now.count);
  }
  crafted() {}
}
class ArmorSlot extends Slot {
  constructor(inventory, index, x, y, type) { super(inventory, index, x, y); this.type = type; }
  get limit() { return 1; }
  valid(s) { return !!s && this.inventory.items[s.id]?.armor === this.type; }
}
class CraftingSlot extends Slot {
  constructor(result, grid, x, y, onCraft) { super(result, 0, x, y); Object.assign(this, { grid, onCraft, amount: 0 }); }
  valid() { return false; }
  decr(n) { if (this.has) this.amount += Math.min(n, this.stack.count); return super.decr(n); }
  crafted(s, n) { this.amount += n; this.finish(s); }
  finish(s) { this.onCraft?.(s, this.amount); this.amount = 0; }
  onPickup(s) {
    this.finish(s);
    for (let i = 0; i < this.grid.size; i++) if (this.grid.getStack(i)) this.grid.decr(i, 1);
  }
}
class FurnaceOutputSlot extends Slot {
  constructor(inventory, index, x, y, onSmelt) { super(inventory, index, x, y); Object.assign(this, { onSmelt, amount: 0 }); }
  valid() { return false; }
  decr(n) { if (this.has) this.amount += Math.min(n, this.stack.count); return super.decr(n); }
  crafted(s, n) { this.amount += n; this.finish(s); }
  finish(s) { this.onSmelt?.(s, this.amount); this.amount = 0; }
  onPickup(s) { this.finish(s); super.onPickup(s); }
}

// Container.func_94527_a: whether a drag or collect may add `stack` to `slot`.
export function canAddToSlot(slot, stack, ignoreSize, inv) {
  let ok = !slot || !slot.has;
  if (slot?.has && stack && sameStackItem(stack, slot.stack)) ok ||= slot.stack.count + (ignoreSize ? 0 : stack.count) <= inv.maxStack(stack);
  return ok;
}
// Container.func_94525_a: drag share for one slot, before stack-size caps.
export const dragShare = (count, slots, mode, existing) => (mode === 0 ? Math.floor(Math.fround(count / slots)) : mode === 1 ? 1 : count) + existing;

export class Container {
  constructor(inv) {
    Object.assign(this, { inv, slots: [], drops: [], dragEvent: 0, dragMode: 0, dragSlots: new Set() });
  }
  addSlot(slot) { slot.number = this.slots.length; this.slots.push(slot); return slot; }
  addPlayerSlots(left, top) {
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) this.addSlot(new Slot(this.inv, col + row * 9 + 9, left + col * 18, top + row * 18));
    for (let col = 0; col < 9; col++) this.addSlot(new Slot(this.inv, col, left + col * 18, top + 58));
  }
  transfer() { return null; }
  canMerge() { return true; }
  canDrag() { return true; }
  drop(s) { if (s?.count > 0) this.drops.push(s); }
  close() { if (this.inv.cursor) { this.drop(this.inv.cursor); this.inv.cursor = null; } }
  resetDrag() { this.dragEvent = 0; this.dragSlots.clear(); }
  // Container.slotClick(slotId, button, mode). Modes: 0 click, 1 shift-click,
  // 2 hotbar key, 3 creative clone, 4 drop key, 5 drag, 6 double-click collect.
  click(slotId, button, mode) {
    const inv = this.inv;
    let result = null;
    if (mode === 5) {
      const previous = this.dragEvent;
      this.dragEvent = button & 3;
      if ((previous !== 1 || this.dragEvent !== 2) && previous !== this.dragEvent) this.resetDrag();
      else if (!inv.cursor) this.resetDrag();
      else if (this.dragEvent === 0) {
        this.dragMode = (button >> 2) & 3;
        if (this.dragMode === 0 || this.dragMode === 1) { this.dragEvent = 1; this.dragSlots.clear(); } else this.resetDrag();
      } else if (this.dragEvent === 1) {
        const slot = this.slots[slotId];
        if (slot && canAddToSlot(slot, inv.cursor, true, inv) && slot.valid(inv.cursor) && inv.cursor.count > this.dragSlots.size && this.canDrag(slot)) this.dragSlots.add(slot);
      } else if (this.dragEvent === 2) {
        if (this.dragSlots.size) {
          const source = copyStack(inv.cursor);
          let left = inv.cursor.count;
          for (const slot of this.dragSlots)
            if (slot && canAddToSlot(slot, inv.cursor, true, inv) && slot.valid(inv.cursor) && inv.cursor.count >= this.dragSlots.size && this.canDrag(slot)) {
              const existing = slot.has ? slot.stack.count : 0,
                placed = makeStack(source.id, Math.min(dragShare(source.count, this.dragSlots.size, this.dragMode, existing), inv.maxStack(source), slot.limit), source.damage, source.stored, source);
              left -= placed.count - existing;
              slot.put(placed);
            }
          source.count = left;
          inv.cursor = left <= 0 ? null : source;
        }
        this.resetDrag();
      } else this.resetDrag();
    } else if (this.dragEvent !== 0) this.resetDrag();
    else if ((mode === 0 || mode === 1) && (button === 0 || button === 1)) {
      if (slotId === OUTSIDE) {
        if (inv.cursor) {
          if (button === 0) { this.drop(inv.cursor); inv.cursor = null; }
          if (button === 1) { this.drop(split(inv.cursor, 1)); if (inv.cursor.count === 0) inv.cursor = null; }
        }
      } else if (mode === 1) {
        if (slotId < 0) return null;
        const slot = this.slots[slotId];
        if (slot?.canTake()) {
          const moved = this.transfer(slotId);
          if (moved) {
            result = copyStack(moved);
            if (slot.stack?.id === moved.id) this.click(slotId, button, 1);
          }
        }
      } else {
        if (slotId < 0) return null;
        const slot = this.slots[slotId];
        if (slot) {
          let here = slot.stack;
          const held = inv.cursor;
          if (here) result = copyStack(here);
          if (!here) {
            if (held && slot.valid(held)) {
              const n = Math.min(button === 0 ? held.count : 1, slot.limit);
              if (held.count >= n) slot.put(split(held, n));
              if (held.count === 0) inv.cursor = null;
            }
          } else if (slot.canTake()) {
            if (!held) {
              inv.cursor = slot.decr(button === 0 ? here.count : Math.floor((here.count + 1) / 2));
              if (here.count === 0) slot.put(null);
              slot.onPickup(inv.cursor);
            } else if (slot.valid(held)) {
              if (sameStackItem(here, held)) {
                const n = Math.min(button === 0 ? held.count : 1, slot.limit - here.count, inv.maxStack(held) - here.count);
                split(held, n);
                if (held.count === 0) inv.cursor = null;
                here.count += n;
              } else if (held.count <= slot.limit) {
                slot.put(held);
                inv.cursor = here;
              }
            } else if (sameStackItem(here, held) && inv.maxStack(held) > 1) {
              const n = here.count;
              if (n > 0 && n + held.count <= inv.maxStack(held)) {
                held.count += n;
                here = slot.decr(n);
                if (here.count === 0) slot.put(null);
                slot.onPickup(inv.cursor);
              }
            }
          }
          slot.changed();
        }
      }
    } else if (mode === 2 && button >= 0 && button < 9) {
      const slot = this.slots[slotId];
      if (slot?.canTake()) {
        const hot = inv.getStack(button);
        let ok = !hot || (slot.inventory === inv && slot.valid(hot)), empty = -1;
        if (!ok) { empty = inv.firstEmpty(); ok = empty > -1; }
        if (slot.has && ok) {
          const moving = slot.stack;
          inv.setStack(button, copyStack(moving));
          if (hot && (slot.inventory !== inv || !slot.valid(hot))) {
            if (empty > -1) { inv.add(hot); slot.decr(moving.count); slot.put(null); slot.onPickup(moving); }
          } else { slot.decr(moving.count); slot.put(hot); slot.onPickup(moving); }
        } else if (!slot.has && hot && slot.valid(hot)) { inv.setStack(button, null); slot.put(hot); }
      }
    } else if (mode === 3 && inv.creative && !inv.cursor && slotId >= 0) {
      const slot = this.slots[slotId];
      if (slot?.has) { const s = copyStack(slot.stack); s.count = inv.maxStack(s); inv.cursor = s; }
    } else if (mode === 4 && !inv.cursor && slotId >= 0) {
      const slot = this.slots[slotId];
      if (slot?.has && slot.canTake()) {
        const s = slot.decr(button === 0 ? 1 : slot.stack.count);
        slot.onPickup(s);
        this.drop(s);
      }
    } else if (mode === 6 && slotId >= 0) {
      const slot = this.slots[slotId], held = inv.cursor;
      if (held && (!slot || !slot.has || !slot.canTake())) {
        const start = button === 0 ? 0 : this.slots.length - 1, step = button === 0 ? 1 : -1;
        for (let pass = 0; pass < 2; pass++)
          for (let j = start; j >= 0 && j < this.slots.length && held.count < inv.maxStack(held); j += step) {
            const other = this.slots[j];
            if (other.has && canAddToSlot(other, held, true, inv) && other.canTake() && this.canMerge(held, other) && (pass !== 0 || other.stack.count !== inv.maxStack(other.stack))) {
              const n = Math.min(inv.maxStack(held) - held.count, other.stack.count), taken = other.decr(n);
              held.count += n;
              if (taken.count <= 0) other.put(null);
              other.onPickup(taken);
            }
          }
      }
    }
    return result;
  }
  // Container.mergeItemStack: fill matching stacks, then the first empty slot.
  merge(stack, start, end, reverse) {
    const inv = this.inv, inRange = (k) => (reverse ? k >= start : k < end), step = reverse ? -1 : 1;
    let merged = false, k = reverse ? end - 1 : start;
    if (inv.stackable(stack))
      for (; stack.count > 0 && inRange(k); k += step) {
        const slot = this.slots[k], here = slot.stack, max = inv.maxStack(stack);
        if (!here || !sameStackItem(here, stack)) continue;
        if (here.count + stack.count <= max) { here.count += stack.count; stack.count = 0; slot.changed(); merged = true; }
        else if (here.count < max) { stack.count -= max - here.count; here.count = max; slot.changed(); merged = true; }
      }
    if (stack.count > 0)
      for (k = reverse ? end - 1 : start; inRange(k); k += step)
        if (!this.slots[k].stack) { this.slots[k].put(copyStack(stack)); stack.count = 0; merged = true; break; }
    return merged;
  }
  // Shared transferStackInSlot tail; `route` merges the stack or returns false.
  move(index, route) {
    const slot = this.slots[index];
    if (!slot?.has) return null;
    const s = slot.stack, moved = copyStack(s);
    if (!route(s, slot, moved)) return null;
    if (s.count === 0) slot.put(null);
    else slot.changed();
    if (s.count === moved.count) return null;
    slot.onPickup(s);
    return moved;
  }
}

class CraftingContainer extends Container {
  constructor(inv, size, craft, onCraft) {
    super(inv);
    this.size = size;
    this.craft = craft;
    this.grid = new StackArray(Array(size * size).fill(null), () => this.updateResult());
    this.result = new ResultInventory();
    this.onCraft = onCraft;
  }
  updateResult() { this.result.stack = this.craft(this.grid.stacks, this.size); }
  canMerge(stack, slot) { return slot.inventory !== this.result; }
  close() {
    super.close();
    for (let i = 0; i < this.grid.size; i++) this.drop(this.grid.takeOnClose(i));
  }
}
// ContainerPlayer: 0 result, 1-4 grid, 5-8 armor, 9-35 main, 36-44 hotbar.
export class PlayerContainer extends CraftingContainer {
  constructor(inv, { craft, onCraft } = {}) {
    super(inv, 2, craft, onCraft);
    this.addSlot(new CraftingSlot(this.result, this.grid, 144, 36, (s, n) => this.onCraft?.(s, n)));
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) this.addSlot(new Slot(this.grid, x + y * 2, 88 + x * 18, 26 + y * 18));
    for (let i = 0; i < 4; i++) this.addSlot(new ArmorSlot(inv, 39 - i, 8, 8 + i * 18, i));
    this.addPlayerSlots(8, 84);
    this.updateResult();
  }
  // Only ContainerPlayer clears its result slot; ContainerWorkbench leaves it.
  close() {
    super.close();
    this.result.stack = null;
  }
  transfer(index) {
    return this.move(index, (s, slot, moved) => {
      if (index === 0) { if (!this.merge(s, 9, 45, true)) return false; slot.onSlotChange(s, moved); return true; }
      if (index >= 1 && index < 9) return this.merge(s, 9, 45, false);
      const type = this.inv.items[moved.id]?.armor;
      if (type !== undefined && !this.slots[5 + type].has) return this.merge(s, 5 + type, 6 + type, false);
      if (index >= 9 && index < 36) return this.merge(s, 36, 45, false);
      if (index >= 36 && index < 45) return this.merge(s, 9, 36, false);
      return this.merge(s, 9, 45, false);
    });
  }
}
// ContainerWorkbench: 0 result, 1-9 grid, 10-36 main, 37-45 hotbar.
export class WorkbenchContainer extends CraftingContainer {
  constructor(inv, { craft, onCraft } = {}) {
    super(inv, 3, craft, onCraft);
    this.addSlot(new CraftingSlot(this.result, this.grid, 124, 35, (s, n) => this.onCraft?.(s, n)));
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) this.addSlot(new Slot(this.grid, x + y * 3, 30 + x * 18, 17 + y * 18));
    this.addPlayerSlots(8, 84);
    this.updateResult();
  }
  transfer(index) {
    return this.move(index, (s, slot, moved) => {
      if (index === 0) { if (!this.merge(s, 10, 46, true)) return false; slot.onSlotChange(s, moved); return true; }
      if (index >= 10 && index < 37) return this.merge(s, 37, 46, false);
      if (index >= 37 && index < 46) return this.merge(s, 10, 37, false);
      return this.merge(s, 10, 46, false);
    });
  }
}
// ContainerFurnace: 0 input, 1 fuel, 2 output, 3-29 main, 30-38 hotbar.
// Plain Slots accept any item in input and fuel, as they do in 1.7.10.
export class FurnaceContainer extends Container {
  constructor(inv, stacks, { smelts, burnTime, onSmelt } = {}) {
    super(inv);
    this.furnace = new StackArray(stacks);
    Object.assign(this, { smelts, burnTime });
    this.addSlot(new Slot(this.furnace, 0, 56, 17));
    this.addSlot(new Slot(this.furnace, 1, 56, 53));
    this.addSlot(new FurnaceOutputSlot(this.furnace, 2, 116, 35, onSmelt));
    this.addPlayerSlots(8, 84);
  }
  transfer(index) {
    return this.move(index, (s, slot, moved) => {
      if (index === 2) { if (!this.merge(s, 3, 39, true)) return false; slot.onSlotChange(s, moved); return true; }
      if (index === 0 || index === 1) return this.merge(s, 3, 39, false);
      if (this.smelts(s)) return this.merge(s, 0, 1, false);
      if (this.burnTime(s) > 0) return this.merge(s, 1, 2, false);
      if (index >= 3 && index < 30) return this.merge(s, 30, 39, false);
      return !(index >= 30 && index < 39) || this.merge(s, 3, 30, false);
    });
  }
}

// InventoryLargeChest (ra): the first chest's slots, then the second's.
export class LargeChestInventory {
  constructor(upper, lower) { Object.assign(this, { upper, lower }); }
  get size() { return this.upper.size + this.lower.size; }
  get limit() { return this.upper.limit; }
  part(i) { return i >= this.upper.size ? [this.lower, i - this.upper.size] : [this.upper, i]; }
  getStack(i) { const [inv, k] = this.part(i); return inv.getStack(k); }
  setStack(i, s) { const [inv, k] = this.part(i); inv.setStack(k, s); }
  decr(i, n) { const [inv, k] = this.part(i); return inv.decr(k, n); }
  open() { this.upper.open?.(); this.lower.open?.(); }
  closed() { this.upper.closed?.(); this.lower.closed?.(); }
}
// ContainerChest (aad): rows x 9 chest slots, then 27 main and 9 hotbar slots
// shifted by (rows - 4) x 18 pixels, as GuiChest draws generic_54.png.
export class ChestContainer extends Container {
  constructor(inv, chest) {
    super(inv);
    this.chest = chest;
    this.rows = Math.floor(chest.size / 9);
    chest.open?.();
    const shift = (this.rows - 4) * 18;
    for (let row = 0; row < this.rows; row++) for (let col = 0; col < 9; col++) this.addSlot(new Slot(chest, col + row * 9, 8 + col * 18, 18 + row * 18));
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) this.addSlot(new Slot(inv, col + row * 9 + 9, 8 + col * 18, 103 + row * 18 + shift));
    for (let col = 0; col < 9; col++) this.addSlot(new Slot(inv, col, 8 + col * 18, 161 + shift));
  }
  get height() { return 114 + this.rows * 18; }
  // Unlike the other containers it returns the copy without calling onPickup.
  transfer(index) {
    const slot = this.slots[index], n = this.rows * 9;
    if (!slot?.has) return null;
    const s = slot.stack, moved = copyStack(s);
    if (!(index < n ? this.merge(s, n, this.slots.length, true) : this.merge(s, 0, n, false))) return null;
    if (s.count === 0) slot.put(null);
    else slot.changed();
    return moved;
  }
  close() { super.close(); this.chest.closed?.(); }
}

// GuiContainer mouse/key handling: chooses the slotClick mode from presses,
// drags, releases, double-clicks and modifier keys.
export class ContainerScreen {
  constructor(container) {
    Object.assign(this, { container, dragging: false, dragButton: 0, split: 0, dragSlots: new Set(), ignoreUp: false, doubleClick: false, lastSlot: null, lastTime: 0, lastButton: -1, shiftStack: null });
  }
  send(slot, id, button, mode) { return this.container.click(slot ? slot.number : id, button, mode); }
  down(slot, button, { outside = false, shift = false, time = Date.now() } = {}) {
    const inv = this.container.inv;
    this.doubleClick = this.lastSlot === slot && time - this.lastTime < DOUBLE_CLICK_MS && this.lastButton === button;
    this.ignoreUp = false;
    if (button >= 0 && button <= 2) {
      const id = outside ? OUTSIDE : slot ? slot.number : -1;
      if (id !== -1 && !this.dragging) {
        if (!inv.cursor) {
          if (button === 2) this.send(slot, id, button, 3);
          else {
            const shifted = id !== OUTSIDE && shift;
            if (shifted) this.shiftStack = slot?.has ? slot.stack : null;
            this.send(slot, id, button, shifted ? 1 : id === OUTSIDE ? 4 : 0);
          }
          this.ignoreUp = true;
        } else {
          this.dragging = true;
          this.dragButton = button;
          this.dragSlots.clear();
          if (button < 2) this.split = button;
        }
      }
    }
    this.lastSlot = slot;
    this.lastTime = time;
    this.lastButton = button;
  }
  move(slot) {
    const c = this.container, held = c.inv.cursor;
    if (this.dragging && slot && held && held.count > this.dragSlots.size && canAddToSlot(slot, held, true, c.inv) && slot.valid(held) && c.canDrag(slot)) this.dragSlots.add(slot);
  }
  up(slot, button, { outside = false, shift = false } = {}) {
    const c = this.container, inv = c.inv, id = outside ? OUTSIDE : slot ? slot.number : -1;
    if (this.doubleClick && slot && button === 0 && c.canMerge(null, slot)) {
      if (shift) {
        if (this.shiftStack) for (const other of c.slots) if (other.canTake() && other.has && other.inventory === slot.inventory && canAddToSlot(other, this.shiftStack, true, inv)) this.send(other, other.number, button, 1);
      } else this.send(slot, id, button, 6);
      this.doubleClick = false;
      this.lastTime = 0;
    } else {
      if (this.dragging && this.dragButton !== button) { this.dragging = false; this.dragSlots.clear(); this.ignoreUp = true; return; }
      if (this.ignoreUp) { this.ignoreUp = false; return; }
      if (this.dragging && this.dragSlots.size) {
        this.send(null, OUTSIDE, dragButton(0, this.split), 5);
        for (const s of this.dragSlots) this.send(s, s.number, dragButton(1, this.split), 5);
        this.send(null, OUTSIDE, dragButton(2, this.split), 5);
      } else if (inv.cursor) {
        if (button === 2) this.send(slot, id, button, 3);
        else {
          const shifted = id !== OUTSIDE && shift;
          if (shifted) this.shiftStack = slot?.has ? slot.stack : null;
          this.send(slot, id, button, shifted ? 1 : 0);
        }
      }
    }
    if (!inv.cursor) this.lastTime = 0;
    this.dragging = false;
  }
  hotbarKey(slot, n) { if (this.container.inv.cursor || !slot) return false; this.send(slot, slot.number, n, 2); return true; }
  dropKey(slot, all = false) { if (slot?.has) this.send(slot, slot.number, all ? 1 : 0, 4); }
  // func_146980_g and drawSlot: drag previews and the cursor remainder.
  // Capped slots show their limit in yellow, as an overfilled share does.
  preview() {
    const inv = this.container.inv, held = inv.cursor, slots = new Map(), capped = new Set();
    let cursor = held;
    if (held && this.dragging && this.dragSlots.size > 1) {
      let left = held.count;
      for (const slot of this.dragSlots) {
        if (!canAddToSlot(slot, held, true, inv)) continue;
        const existing = slot.stack?.count || 0,
          want = dragShare(held.count, this.dragSlots.size, this.split, existing),
          count = Math.min(want, inv.maxStack(held), slot.limit);
        if (want > count) capped.add(slot);
        left -= count - existing;
        slots.set(slot, makeStack(held.id, count, held.damage, held.stored, held));
      }
      cursor = makeStack(held.id, left, held.damage, held.stored, held);
    }
    return { slots, cursor, capped };
  }
}
