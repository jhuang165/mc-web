// Batch 60 (mpstations): the crafting table, the enchanting table and the anvil as server windows (ContainerWorkbench, ContainerEnchantment,
// ContainerRepair). They ride the batch 59 window protocol of server-containers.js (S2D open, S30 items, S2F slot, S32 confirm, S31 property, S2E close,
// C0E click, C0D close) and add two client packets: `stationEnchant` (C11 EnchantItem) and `stationItemName` (the MC|ItemName custom payload).
// The server runs the same port classes as single player (WorkbenchContainer, EnchantingContainer, AnvilContainer) over the player's server inventory.
// Bytecode-read (1.7.10 jar): ContainerEnchantment (aag) sends S31 ids 0..2 (the three costs) and nothing else (the name seed stays client side);
// ContainerRepair (zu) sends S31 id 0 (maximumCost); NetHandlerPlayServer MC|ItemName: an empty payload sets "", else the UTF-8 text goes through
// ChatAllowedCharacters.filterAllowedCharacters and is applied only when it is at most 30 characters long (the GUI field allows 40).
import { WorkbenchContainer } from '../inventory.js';
import { AnvilContainer } from '../anvil-container.js';
import { EnchantingContainer } from '../enchanting-container.js';
import { ANVIL, ENCHANTING_TABLE } from '../world.js';
import { ANVIL_DAMAGE_CHANCE, SFX_ANVIL_USE, SFX_ANVIL_BREAK, damagedAnvilMetadata } from '../anvil.js';
import { ITEMS } from '../survival.js';
import { stackName } from '../item-names.js';
import { nativeStackToLive } from '../anvil-container.js';

export const CRAFTING_TABLE = 13; // the port's id of the crafting table (original 58)
export const STATION_BLOCKS = new Set([CRAFTING_TABLE, ANVIL, ENCHANTING_TABLE]);
const AUX_RANGE_SQ = 64 * 64, NAME_LIMIT = 30;
// ChatAllowedCharacters.isAllowedCharacter: not the section sign, at least 32, not DEL.
export const filterName = text => String(text).replace(/[\u0000-\u001f\u007f§]/g, '');

export class ServerStations {
  constructor(sim) {
    this.sim = sim;
    // Called with (player, stack, count) after a take from a crafting result slot: the hook for crafting achievements and statistics.
    this.onCrafted = (p, stack, n) => { sim.achievements?.onCrafted(p, stack); sim.stats?.crafted(p, stack, n); /* b63 mpstats */ }; // b60 lead: SlotCrafting.onCrafting awards (server-achievements.js)
  }
  // Builds the container for a right click on a station block. Returns { container, kind, title, props } or null for any other block.
  open(p, block, x, y, z) {
    const s = p.survival, world = this.sim.world;
    if (block === CRAFTING_TABLE) {
      const container = s.openWorkbench();
      container.onCraft = (stack, n) => this.crafted(p, stack, n);
      return { container, kind: 'workbench', title: 'Crafting', props: () => [] };
    }
    const common = { inventory: s.inventory, creative: () => s.creative, experienceLevel: () => p.experience?.level ?? 0, payExperienceLevels: cost => this.pay(p, cost) };
    if (block === ENCHANTING_TABLE) {
      // ContainerEnchantment rolls the three costs from its own Random: here the player's server inventory Random.
      const container = new EnchantingContainer({ ...common, world, x, y, z, onUse: () => {} });
      return { container, kind: 'enchanting', title: 'Enchant', props: () => container.levels };
    }
    if (block === ANVIL) {
      const itemName = native => { const live = nativeStackToLive(native); return live ? stackName(live, ITEMS) : ''; };
      const container = new AnvilContainer({ ...common, itemName, onUse: ({ creative }) => this.anvilUsed(p, x, y, z, creative) });
      return { container, kind: 'anvil', title: 'Repair & Name', props: () => [container.maximumCost | 0] };
    }
    return null;
  }
  crafted(p, stack, count) {
    if (!stack) return;
    (this.sim.events ??= []).push({ type: 'crafted', id: p.id, item: stack.id, count });
    this.onCrafted(p, stack, count);
  }
  // EntityPlayer.addExperienceLevel(-cost) on the server, then the same op to the client (S1F).
  pay(p, cost) {
    if (!p.experience || !(cost > 0)) return;
    p.experience.addLevels(-cost);
    (p.itemsOut ??= []).push({ type: 'playerOp', op: 'addLevels', args: [-cost] });
  }
  // SlotRepair.onPickupFromSlot: outside Creative a 12% chance to damage the anvil (or break it), then aux 1021 (used) or 1020 (broken) to everyone within 64 blocks.
  anvilUsed(p, x, y, z, creative) {
    const world = this.sim.world;
    let broken = false;
    if (!creative && world.get(x, y, z) === ANVIL && p.survival.inventory.random.nextFloat() < ANVIL_DAMAGE_CHANCE) {
      const meta = damagedAnvilMetadata(world.getMeta(x, y, z));
      broken = meta < 0;
      world.put(x, y, z, broken ? 0 : ANVIL, broken ? 0 : meta, true);
    }
    this.aux(broken ? SFX_ANVIL_BREAK : SFX_ANVIL_USE, x, y, z);
  }
  aux(id, x, y, z) {
    const event = { id, x, y, z, data: 0 };
    for (const o of this.sim.players.values()) {
      const dx = o.position.x - x - 0.5, dy = o.position.y - y - 0.5, dz = o.position.z - z - 0.5;
      if (dx * dx + dy * dy + dz * dz < AUX_RANGE_SQ) (o.itemsOut ??= []).push({ type: 'aux', events: [event] });
    }
  }
  // C11 EnchantItem: the window id and option must match the open enchanting window; the container re-checks cost and XP.
  enchant(p, m) {
    const win = p.window;
    if (!win || win.kind !== 'enchanting' || m?.windowId !== win.id || !win.ready || win.pending || !Number.isInteger(m.slot) || m.slot < 0 || m.slot > 2) return false;
    if (!win.container.enchant(m.slot)) return false;
    this.sim.containers.afterServerChange(p);
    return true;
  }
  // MC|ItemName while an anvil window is open.
  rename(p, m) {
    const win = p.window;
    if (!win || win.kind !== 'anvil' || typeof m?.name !== 'string' || m.name.length > 200) return false;
    if (m.name.length === 0) { win.container.setName(''); return true; }
    const name = filterName(m.name);
    if (name.length > NAME_LIMIT) return false;
    win.container.setName(name);
    this.sim.containers.afterServerChange(p);
    return true;
  }
}
