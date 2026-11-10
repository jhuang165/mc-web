// The station blocks on the gun server (not 1.7.10 networking): the brewing stand, enchanting table, anvil and beacon windows,
// the buttons their screens send (ContainerEnchantment.enchantItem, MC|ItemName, MC|Beacon), and the two tile ticks the shared
// world needs (TileEntityBrewingStand.updateEntity, TileEntityBeacon.updateEntity). The containers are the single-player ones
// (brewing-container.js, enchanting-container.js, anvil-container.js, pyramid-container.js) over the server's tiles; a tab builds
// the same container around its copy (main.js remoteStation) and draws the levels, costs and progress the server reports here.
import { BrewingContainer } from '../brewing-container.js';
import { brewingView, BREWING_STAND } from '../brewing.js';
import { EnchantingContainer } from '../enchanting-container.js';
import { AnvilContainer, nativeStackToLive } from '../anvil-container.js';
import { ANVIL_DAMAGE_CHANCE, damagedAnvilMetadata } from '../anvil.js';
import { ANVIL, PHYSICS } from '../world.js';
import { ITEMS } from '../survival.js';
import { stackName } from '../item-names.js';
import { anvilName } from '../gui.js';
import { Beacons, BEACON, fullBeaconReach } from '../pyramid.js';
import { BeaconContainer } from '../pyramid-container.js';
import { tickBeacons } from '../pyramid-live.js';
import { trigger } from './server-stats.js';

export const STATION_KINDS = ['brewing', 'enchanting', 'anvil', 'beacon'];
const ITEM_POTION = 385;
const MAX_NAME = 40; // gui.js anvilName

export class ServerStations {
  constructor(sim, saved = null) {
    this.sim = sim;
    this.beacons = new Beacons().fromJSON(saved?.beacons ?? []);
  }
  save() { return { beacons: this.beacons.toJSON() }; }
  // The applyPlayerEdit hooks for player p's click on block `at` (server-play.js edit).
  hooks(play, p) {
    const sim = this.sim, s = p.survival, xp = p.experience;
    const level = () => xp?.level ?? 0, pay = cost => { xp?.addLevels(-cost); };
    const where = key => key.split(',').map(Number);
    const extra = at => ({ key: at.join(','), at, block: sim.world.get(...at) });
    return {
      // BlockBrewingStand.onBlockActivated over the world's tile; SlotBrewingStandPotion.onPickupFromSlot: the potion achievement.
      openBrewing: (tile, key, block) => {
        const at = [...block], view = brewingView(tile), c = new BrewingContainer(s.inventory, view, () => sim.redstone?.containerChanged?.(...at));
        for (const slot of c.slots.slice(0, 3)) {
          const taken = slot.onPickup?.bind(slot);
          slot.onPickup = st => { if (st?.id === ITEM_POTION) trigger(p, 'potion'); return taken?.(st); };
        }
        play.open(p, 'brewing', c, { ...extra(at), title: view.customName || null });
      },
      // BlockEnchantmentTable.onBlockActivated: ContainerEnchantment with the player's Random, its levels paid from the server's XP.
      useEnchantingTable: key => {
        const at = where(key);
        play.open(p, 'enchanting', new EnchantingContainer({ inventory: s.inventory, world: sim.world, x: at[0], y: at[1], z: at[2],
          creative: () => s.creative, experienceLevel: level, payExperienceLevels: pay, onUse: () => {} }), extra(at));
      },
      // BlockAnvil.onBlockActivated: ContainerRepair; a take may damage the anvil (ContainerRepair$2.onPickupFromSlot, level events
      // 1020 and 1021 for everyone near).
      useAnvil: key => {
        const at = where(key), [x, y, z] = at;
        const itemName = native => { const stack = nativeStackToLive(native); return stack ? stackName(stack, ITEMS) : ''; };
        let c;
        c = new AnvilContainer({ inventory: s.inventory, creative: () => s.creative, experienceLevel: level, payExperienceLevels: pay, itemName,
          // GuiRepair.sendSlotContents: a new left item resets the name to its custom name (none for a plain item); the tab's
          // MC|ItemName that follows sets what the player typed.
          onInputChanged: ({ current }) => c?.setName(current && typeof current.displayName === 'string' ? anvilName(current.displayName) : ''),
          onUse: ({ creative }) => {
            let broken = false;
            if (!creative && sim.world.get(x, y, z) === ANVIL && s.inventory.random.nextFloat() < ANVIL_DAMAGE_CHANCE) {
              const meta = damagedAnvilMetadata(sim.world.getMeta(x, y, z));
              broken = meta < 0;
              sim.world.set(x, y, z, broken ? 0 : ANVIL, true, broken ? 0 : meta);
            }
            sim.near(p, { type: 'sound', sound: broken ? 'random.anvil_break' : 'random.anvil_use', x: x + .5, y: y + .5, z: z + .5, volume: 1, pitch: 1 }, true);
          } });
        play.open(p, 'anvil', c, extra(at));
      },
      // BlockBeacon.onBlockActivated: ContainerBeacon over the world's tile (its payment stays in the tile, in memory).
      useBeacon: key => {
        const at = where(key);
        play.open(p, 'beacon', new BeaconContainer({ inventory: s.inventory, tile: this.beacons.ensure(...at) }), extra(at));
      },
    };
  }
  // The station buttons: { type: 'enchant', window, option } (C11PacketEnchantItem), { type: 'anvil', window, name } (MC|ItemName),
  // { type: 'beacon', window, primary, secondary } (MC|Beacon). False for a malformed message; a stale window is ignored.
  message(p, m) {
    const w = p.window;
    if (m?.type === 'enchant') {
      if (!Number.isInteger(m.option) || m.option < 0 || m.option > 2) return false;
      if (w?.kind === 'enchanting' && w.id === m.window && !p.dead) w.container.enchant(m.option);
      return true;
    }
    if (m?.type === 'anvil') {
      if (typeof m.name !== 'string' || m.name.length > MAX_NAME * 2) return false;
      if (w?.kind === 'anvil' && w.id === m.window) w.container.setName(anvilName(m.name));
      return true;
    }
    if (m?.type === 'beacon') {
      if (!Number.isInteger(m.primary) || !Number.isInteger(m.secondary) || Math.abs(m.primary) > 255 || Math.abs(m.secondary) > 255) return false;
      if (w?.kind === 'beacon' && w.id === m.window && !p.dead) w.container.confirm(m.primary, m.secondary);
      return true;
    }
    return false;
  }
  // What the tab draws besides the slots (ServerPlay.windowState): the brew's progress, the three level buttons, the anvil's
  // cost and the beacon's pyramid and picks.
  state(w) {
    if (w.kind === 'brewing') return { brew: w.container.stand.brewTime | 0 };
    if (w.kind === 'enchanting') return { levels: w.container.levels };
    if (w.kind === 'anvil') return { cost: w.container.maximumCost | 0 };
    if (w.kind === 'beacon') { const t = w.container.tile; return { beacon: { levels: t.levels, primary: t.primary, secondary: t.secondary } }; }
    return null;
  }
  // Once per world tick: every loaded brewing stand (its bottles shown as metadata) and every beacon (each 80 ticks the pyramid,
  // then the effects for the players in range, and Beaconator when it has just reached 4 levels). New beacons are found in the tick's block changes (BlockContainer.onBlockAdded).
  tick(changes) {
    const sim = this.sim, world = sim.world;
    for (const [x, y, z] of changes) if (world.get(x, y, z) === BEACON) this.beacons.ensure(x, y, z);
    for (const [key, data] of Object.entries(sim.tiles.brewing ?? {})) {
      const [x, y, z] = key.split(',').map(Number);
      if (world.streaming && !world.isTicking(x, z)) continue;
      if (world.get(x, y, z) !== BREWING_STAND) { delete sim.tiles.brewing[key]; continue; }
      const view = brewingView(data), before = data.brewTime | 0, bits = view.tick();
      if (bits !== null || world.getMeta(x, y, z) !== view.bottleBits()) world.set(x, y, z, BREWING_STAND, true, view.bottleBits());
      if (bits !== null || (before > 0 && !(data.brewTime | 0))) sim.redstone?.containerChanged?.(x, y, z);
    }
    const players = [...sim.players.values()].filter(p => !p.dead)
      .map(p => ({ p, x: p.position.x, y: p.position.y, z: p.position.z, width: PHYSICS.width, height: PHYSICS.height }));
    // Beaconator: every player in the world, the dead too (they stay in World.playerEntities until they respawn).
    const full = tile => { for (const p of sim.players.values()) if (fullBeaconReach(tile, p.position, PHYSICS.width, PHYSICS.height)) trigger(p, 'fullBeacon'); };
    tickBeacons(this.beacons, { world, time: sim.time, players, apply: (q, e) => q.p.survival.effects.add(e), full });
  }
}
