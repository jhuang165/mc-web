// Live inventory adapter around the native-ID ContainerRepair rules in anvil.js.
// The game stores item ids in its browser registry; the calculation module uses 1.7.10 ids.
import { updateRepairOutput as calculateRepair } from './anvil.js';
import { Container, Slot, StackArray, copyStack, makeStack, sameStackItem } from './inventory.js';
import { ORIGINAL_ITEMS, itemFromOriginal } from './region-import.js';
import { ENCHANTED_BOOK_ITEM } from './enchanted-books.js';

const ORIGINAL_BY_LIVE = new Map();
for (const [key, liveId] of Object.entries(ORIGINAL_ITEMS)) {
  const [id, damage] = key.split(':').map(Number);
  if (!ORIGINAL_BY_LIVE.has(liveId) || damage === undefined) ORIGINAL_BY_LIVE.set(liveId, { id, ...(damage === undefined ? {} : { damage }) });
}
const pairs = (value) => Array.isArray(value) ? value.map((e) => ({ id: e.id, lvl: e.lvl })) : undefined;

/** Convert a supported live stack to the original numeric item ids used by anvil.js. */
export function liveStackToNative(stack) {
  if (!stack) return null;
  const original = ORIGINAL_BY_LIVE.get(stack.id);
  if (!original) return null;
  const native = { id: original.id, count: stack.count, damage: original.damage ?? stack.damage ?? 0 };
  if (Array.isArray(stack.enchantments)) native.enchantments = pairs(stack.enchantments);
  const stored = stack.storedEnchantments ?? stack.stored;
  if (Array.isArray(stored)) native.storedEnchantments = pairs(stored);
  if (Number.isFinite(stack.repairCost)) native.repairCost = stack.repairCost | 0;
  if (typeof stack.displayName === 'string') native.displayName = stack.displayName;
  if (typeof stack.unbreakable === 'boolean') native.unbreakable = stack.unbreakable;
  return native;
}

/** Convert an anvil.js stack back to the supported live id and tag representation. */
export function nativeStackToLive(stack) {
  if (!stack) return null;
  const mapped = itemFromOriginal(stack.id, stack.damage ?? 0);
  if (!mapped) return null;
  const metadata = {};
  if (Array.isArray(stack.enchantments)) metadata.enchantments = pairs(stack.enchantments);
  if (Array.isArray(stack.storedEnchantments)) metadata.storedEnchantments = pairs(stack.storedEnchantments);
  if (Number.isFinite(stack.repairCost)) metadata.repairCost = stack.repairCost | 0;
  if (typeof stack.displayName === 'string') metadata.displayName = stack.displayName;
  if (typeof stack.unbreakable === 'boolean') metadata.unbreakable = stack.unbreakable;
  const isBook = mapped.id === ENCHANTED_BOOK_ITEM;
  return makeStack(mapped.id, stack.count ?? 1, mapped.damage, isBook ? (stack.storedEnchantments ?? []) : undefined, metadata);
}

class InputSlot extends Slot {
  constructor(container, index, x, y) { super(container.inputs, index, x, y); this.container = container; }
  changed() { this.container.inputsChanged(); }
  decr(n) {
    const stack = super.decr(n);
    this.container.inputsChanged();
    return stack;
  }
}

class RepairOutputSlot extends Slot {
  constructor(container, x, y) { super({ getStack: () => container.output, setStack() {}, decr: () => null, get limit() { return 64; } }, 0, x, y); this.container = container; }
  get stack() { return this.container.output; }
  get has() { return !!this.container.output; }
  canTake() { return this.container.canTake(); }
  valid() { return false; }
  decr() { return this.container.takeOutput(); }
  put() { /* ContainerRepair owns this result slot. */ }
}

/**
 * ContainerRepair-compatible inventory layout: two inputs, one result, then 36 player slots.
 * `payExperienceLevels` receives a positive level cost; `onUse` runs after every successful take.
 */
export class AnvilContainer extends Container {
  constructor({ inventory, creative = () => !!inventory?.creative, experienceLevel = () => 0,
    payExperienceLevels = () => {}, itemName = () => '', onUse = () => {}, onInputChanged = () => {} } = {}) {
    if (!inventory) throw new TypeError('AnvilContainer needs a PlayerInventory');
    super(inventory);
    Object.assign(this, { creative, experienceLevel, payExperienceLevels, itemName, onUse, onInputChanged });
    this.inputs = new StackArray([null, null]);
    this.output = null;
    this.maximumCost = 0;
    this.stackSizeToBeUsedInRepair = 0;
    this.repairedItemName = null;
    this.previousLeft = null;
    this.addSlot(new InputSlot(this, 0, 27, 47));
    this.addSlot(new InputSlot(this, 1, 76, 47));
    this.addSlot(new RepairOutputSlot(this, 134, 47));
    this.addPlayerSlots(8, 84);
    this.inputsChanged();
  }
  get tooExpensive() { return !this.creative() && this.maximumCost >= 40; }
  setInput(index, stack) {
    if (index !== 0 && index !== 1) throw new RangeError('Anvil input slot must be 0 or 1');
    if (stack && stack.count > 64) stack.count = 64;
    this.inputs.setStack(index, stack ?? null);
    this.inputsChanged();
  }
  setName(name) {
    this.repairedItemName = name == null ? null : String(name);
    this.updateRepairOutput();
  }
  inputsChanged() {
    const left = copyStack(this.inputs.getStack(0));
    if ((this.previousLeft || left) && !sameStackItem(this.previousLeft, left)) {
      const previous = this.previousLeft;
      this.previousLeft = copyStack(left);
      this.onInputChanged({ previous: copyStack(previous), current: copyStack(left), previousNative: liveStackToNative(previous), currentNative: liveStackToNative(left) });
    }
    this.updateRepairOutput();
  }
  updateRepairOutput() {
    const left = liveStackToNative(this.inputs.getStack(0)), right = liveStackToNative(this.inputs.getStack(1));
    const result = calculateRepair(left, right, this.repairedItemName, { creative: !!this.creative(), itemName: this.itemName });
    this.output = nativeStackToLive(result.output);
    this.maximumCost = result.maximumCost;
    if (result.stackSizeToBeUsedInRepair !== null) this.stackSizeToBeUsedInRepair = result.stackSizeToBeUsedInRepair;
  }
  canTake() {
    return !!this.output && this.maximumCost > 0 && (this.creative() || this.experienceLevel() >= this.maximumCost);
  }
  takeOutput() {
    if (!this.canTake()) return null;
    const result = copyStack(this.output), cost = this.maximumCost, creative = !!this.creative();
    if (!creative) this.payExperienceLevels(cost);
    this.setInput(0, null);
    if (this.stackSizeToBeUsedInRepair > 0) {
      const material = this.inputs.getStack(1);
      if (material && material.count > this.stackSizeToBeUsedInRepair) {
        material.count -= this.stackSizeToBeUsedInRepair;
        this.inputsChanged();
      } else this.setInput(1, null);
    } else this.setInput(1, null);
    this.maximumCost = 0;
    this.onUse({ stack: copyStack(result), cost, creative });
    return result;
  }
  transfer(index) {
    if (index === 2) {
      if (!this.canTake()) return null;
      const product = copyStack(this.output), moved = copyStack(product);
      // ContainerRepair first merges the result and then calls the output slot's
      // pickup hook if any amount moved. That hook consumes the full operation,
      // even when a stackable renamed result only partly fit.
      if (!this.merge(moved, 3, 39, true)) return null;
      const transferred = product.count - moved.count;
      const taken = this.takeOutput();
      if (!taken || transferred <= 0) return null;
      return product;
    }
    return this.move(index, (stack) => {
      if (index < 2) return this.merge(stack, 3, 39, false);
      if (index >= 3 && index < 39) return this.merge(stack, 0, 2, false);
      return false;
    });
  }
  close() {
    super.close();
    for (let i = 0; i < 2; i++) {
      const stack = this.inputs.takeOnClose(i);
      if (stack) this.drop(stack);
    }
    this.updateRepairOutput();
  }
}
