// Live inventory adapter around ContainerEnchantment (EnchantingTable in enchantments.js).
// One item slot, three level options, then the 36 player slots. 1.7.10 has no lapis cost and no
// per-player seed: the options come from the container's own Random (here the saved player
// inventory JavaRandom) and are rerolled on every change of the item slot.
import { hasItemTags } from './item-tags.js';
import { EnchantingTable } from './enchantments.js';
import { Container, Slot, StackArray, copyStack, makeStack } from './inventory.js';
import { liveStackToNative, nativeStackToLive } from './anvil-container.js';
import { ENCHANT_SLOT, ENCHANT_PLAYER_SLOTS, liveBookshelfWorld, liveBookshelfPower } from './enchanting-table.js';

const hasTag = (s) => Array.isArray(s.enchantments) || Array.isArray(s.storedEnchantments) || !!s.stored?.length ||
  Number.isFinite(s.repairCost) || typeof s.displayName === 'string' || typeof s.unbreakable === 'boolean' || hasItemTags(s);

// The anonymous InventoryBasic in ContainerEnchantment: getInventoryStackLimit is 1, and
// setInventorySlotContents cuts the very same stack object to that limit (the rest is lost).
class SingleStack extends StackArray {
  get limit() { return 1; }
}

// The anonymous Slot in ContainerEnchantment: any item, limit one. The tableInventory's markDirty
// (InventoryBasic.markDirty -> onCraftMatrixChanged) runs on every set, take and onSlotChanged, so
// a Slot.putStack rolls twice, a decrStackSize once and a pickup once.
class EnchantSlot extends Slot {
  constructor(container, x, y) { super(container.inputs, 0, x, y); this.container = container; }
  put(stack) {
    this.inventory.setStack(this.index, stack);
    this.container.markDirty(); // InventoryBasic.setInventorySlotContents
    this.container.markDirty(); // Slot.onSlotChanged
  }
  changed() { this.container.markDirty(); }
  decr(n) {
    const taken = super.decr(n);
    this.container.markDirty(); // InventoryBasic.decrStackSize
    return taken;
  }
}

export class EnchantingContainer extends Container {
  constructor({ inventory, world, x, y, z, random = inventory?.random, creative = () => !!inventory?.creative,
    experienceLevel = () => 0, payExperienceLevels = () => {}, onUse = () => {}, remote = false } = {}) {
    if (!inventory) throw new TypeError('EnchantingContainer needs a PlayerInventory');
    super(inventory);
    Object.assign(this, { world, x, y, z, creative, experienceLevel, payExperienceLevels, onUse });
    this.inputs = new SingleStack([null]);
    this.table = new EnchantingTable({ world: liveBookshelfWorld(world), x, y, z, random, remote });
    this.addSlot(new EnchantSlot(this, ENCHANT_SLOT.x, ENCHANT_SLOT.y));
    this.addPlayerSlots(ENCHANT_PLAYER_SLOTS.x, ENCHANT_PLAYER_SLOTS.y);
  }
  get item() { return this.inputs.getStack(0); }
  /** Slot levels shown on the three buttons; 0 means the option is unavailable. */
  get levels() { return this.table.enchantLevels.slice(); }
  /** ContainerEnchantment.nameSeed: only seeds the client's galactic name text. */
  get nameSeed() { return this.table.nameSeed; }
  /** Bookshelves counted around the live table right now (0..32, air gaps respected). */
  get bookshelves() { return liveBookshelfPower(this.world, this.x, this.y, this.z); }
  canEnchant(slot) {
    const cost = this.table.enchantLevels[slot];
    return cost > 0 && !!this.item && (this.creative() || this.experienceLevel() >= cost);
  }
  // InventoryBasic.markDirty -> ContainerEnchantment.onCraftMatrixChanged.
  markDirty() {
    const native = liveStackToNative(this.item);
    this.table.item = native ? { ...native, count: 1 } : null;
    this.table.onCraftMatrixChanged();
  }
  /** Programmatic InventoryBasic.setInventorySlotContents: a stack of any size is cut to one. */
  setItem(stack) {
    this.inputs.setStack(0, stack ? copyStack(stack) : null);
    this.markDirty();
  }
  /** ContainerEnchantment.enchantItem for option 0..2; true when the click was accepted. */
  enchant(slot) {
    if (!(slot >= 0 && slot < 3) || !this.canEnchant(slot)) return false;
    let level = this.experienceLevel(), paid = 0;
    // The original charges through EntityPlayer.addExperienceLevel(-cost) only when a list was built.
    const player = {
      creative: !!this.creative(), experience: 0, experienceTotal: 0,
      get experienceLevel() { return level; },
      set experienceLevel(v) { if (!paid) paid = level - v; level = v; },
    };
    if (!this.table.enchantItem(player, slot)) return false;
    if (paid > 0) {
      this.payExperienceLevels(paid);
      this.inputs.stacks[0] = nativeStackToLive({ ...this.table.item, count: 1 });
      this.onUse({ stack: copyStack(this.item), cost: paid, slot, creative: player.creative });
    }
    return true;
  }
  // ContainerEnchantment.transferStackInSlot.
  transfer(index) {
    return this.move(index, (stack) => {
      if (index === 0) return this.merge(stack, 1, 37, true);
      if (index < 1 || index >= 37 || this.slots[0].has) return false;
      if (hasTag(stack) && stack.count === 1) {
        this.slots[0].put(copyStack(stack));
        stack.count = 0;
      } else if (stack.count >= 1) {
        this.slots[0].put(makeStack(stack.id, 1, stack.damage));
        stack.count -= 1;
      }
      return true;
    });
  }
  close() {
    super.close();
    const stack = this.inputs.takeOnClose(0);
    if (stack) this.drop(stack);
    this.table.item = null;
    this.table.enchantLevels = [0, 0, 0];
  }
}
