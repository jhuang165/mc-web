// What a Survival player does with the world on the gun server (not 1.7.10 networking): inventory windows and their clicks,
// mining, block use and placement, and the dropped items players throw, break loose and pick up. The server runs the same
// single-player code (Container.click, tickPlayerMining, applyPlayerEdit, ItemEntities) on its own state; a client sends
// only button presses and slot clicks, and shows its own prediction until the server's answer arrives.
import { raycast, PHYSICS, WATER, LAVA, collides } from '../world.js';
import { ITEMS } from '../survival.js';
import { OUTSIDE, StackArray, ChestContainer, copyStack } from '../inventory.js';
import { DispenserContainer } from '../dispenser-container.js';
import { HopperContainer } from '../hopper.js';
import { ItemEntities } from '../item-entities.js';
import { tickPlayerMining } from '../player-mining.js';
import { applyPlayerEdit } from '../player-edit-simulation.js';
import { breakPlayerBlock } from '../block-break-simulation.js';
import { mayHitBlock } from '../adventure.js';
import { eyeInWater } from '../fluids.js';
import { isThrowable } from '../player-throw-simulation.js';
import { ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, ITEM_FIRE_CHARGE } from '../spawn-eggs.js';
import { ITEM_EYE_OF_ENDER } from '../eye-of-ender.js';
import { ITEM_EMPTY_MAP } from '../maps.js';
import { ITEM_FIREWORK_ROCKET } from '../fireworks.js';
import { FISHING_ROD } from '../fishing-content.js';
import { BOAT_ITEM } from '../boats.js';
import { BOW } from '../bow.js';
import { isBook } from '../books.js';

const noop = () => {};
export const MAX_CLICKS = 64; // per message: a drag is start + one per slot + end
// Right-click uses that need an entity or screen this server does not have yet (projectiles, boats, maps, books, ...).
const UNSUPPORTED_USE = new Set([ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, ITEM_FIRE_CHARGE, ITEM_EYE_OF_ENDER, ITEM_EMPTY_MAP, ITEM_FIREWORK_ROCKET, FISHING_ROD, BOAT_ITEM, BOW]);
export const unsupportedUse = id => UNSUPPORTED_USE.has(id) || isThrowable(id) || isBook(id);
// The windows a block can open here; the client builds the same container around its own copy (main.js remoteWindow).
export const WINDOW_KINDS = new Set(['workbench', 'furnace', 'chest', 'dispenser', 'hopper']);

const lookDir = p => ({ x: -Math.sin(p.yaw) * Math.cos(p.pitch), y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * Math.cos(p.pitch) });
export const playerEye = p => ({ x: p.position.x, y: p.position.y + PHYSICS.eye - (p.motion?.ySize ?? 0), z: p.position.z });
// The block under player p's crosshair, from the server's own position and look (PlayerControllerMP reach: 5 in Creative, else 4.5).
export function serverTarget(world, p) {
  return raycast(world, playerEye(p), lookDir(p), p.survival.creative ? 5 : 4.5);
}
// A container's own slots (not the player's inventory) as [slot number, stack] pairs: what the client cannot work out itself.
export function windowSlots(container, inv) {
  const out = [];
  container.slots.forEach((slot, i) => { if (slot.inventory !== inv) out.push([i, copyStack(slot.stack)]); });
  return out;
}

export class ServerPlay {
  // sim: the GunSimulation (world, players, tiles, farming, trees, fire, fluids, redstone, random).
  constructor(sim, saved = {}) {
    this.sim = sim;
    this.items = new ItemEntities(sim.random);
    if (Array.isArray(saved.items)) this.items.load(saved.items, s => s && ITEMS[s.id] ? { ...s } : null);
    this.nextEntity = 1;
    this.windowCounter = 0;
  }
  save() { return { items: this.items.serialize() }; }
  // A joining (or respawned, or mode-changed) player: the always-open inventory window 0, nothing being mined.
  reset(p) {
    p.inventoryWindow = p.survival.openInventory();
    p.window = null; p.mining = null; p.mineCooldown = 0; p.mineHeld = false; p.clickAck = p.clickAck ?? 0;
    p.sentWindow = null; p.sentOpen = null;
  }
  windowFor(p, id) { return id === 0 ? p.inventoryWindow : p.window?.id === id ? p.window.container : null; }
  // Container.slotClick for each click a client sent, in order; `seq` acknowledges them so the client can drop its predictions.
  click(p, message) {
    const { window: id, clicks, seq } = message ?? {};
    if (!Number.isInteger(id) || !Number.isInteger(seq) || !Array.isArray(clicks) || clicks.length > MAX_CLICKS) return false;
    p.clickAck = Math.max(p.clickAck, seq);
    const container = this.windowFor(p, id);
    if (!container || p.dead) return true; // a click for a window that closed on the way: Java ignores it too
    for (const c of clicks) {
      if (!Array.isArray(c) || !c.every(Number.isInteger)) return false;
      const [slot, button, mode] = c;
      if (!(slot === OUTSIDE || slot === -1 || (slot >= 0 && slot < container.slots.length)) || button < 0 || button > 10 || mode < 0 || mode > 6) return false;
      if (mode === 3 && !p.survival.creative) continue;
      container.click(slot, button, mode);
    }
    this.throwDrops(p, container);
    return true;
  }
  // C0DPacketCloseWindow: the window's onContainerClosed (the held stack and a crafting grid are thrown), back to window 0.
  close(p, id) {
    if (id === 0) { p.inventoryWindow.close(); this.throwDrops(p, p.inventoryWindow); return; }
    if (p.window?.id !== id) return;
    this.closeWindow(p);
  }
  closeWindow(p) {
    const w = p.window;
    if (!w) return;
    p.window = null;
    w.container.close();
    w.container.chest?.closed?.();
    this.throwDrops(p, w.container);
  }
  open(p, kind, container, extra = {}) {
    this.closeWindow(p);
    this.windowCounter = this.windowCounter % 100 + 1; // EntityPlayerMP.getNextWindowId
    p.window = { id: this.windowCounter, kind, container, ...extra };
  }
  throwDrops(p, container) {
    for (const s of container.drops.splice(0)) if (s?.count) this.items.dropPlayer(copyStack(s), p.position, p.yaw, p.pitch);
  }
  // The Q key: one item, or the stack with Ctrl (EntityPlayer.dropOneItem).
  dropHeld(p, all) {
    const inv = p.survival.inventory, s = inv.held;
    if (!s || p.dead) return false;
    this.items.dropPlayer(inv.decr(inv.current, all ? s.count : 1), p.position, p.yaw, p.pitch);
    p.eating = null;
    return true;
  }
  // EntityPlayer.onDeath without keepInventory: every stack scatters (InventoryPlayer.dropAllItems).
  dropAll(p) {
    const inv = p.survival.inventory;
    this.closeWindow(p);
    p.inventoryWindow.close(); this.throwDrops(p, p.inventoryWindow);
    for (const list of [inv.main, inv.armor]) for (let i = 0; i < list.length; i++) {
      if (list[i]) this.items.dropPlayer(list[i], p.position, p.yaw, p.pitch, true, true);
      list[i] = null;
    }
  }
  // A window whose block is gone or out of reach closes (Container.canInteractWith: 8 blocks from the block centre).
  checkWindow(p) {
    const w = p.window;
    if (!w?.at) return;
    const [x, y, z] = w.at, d = Math.hypot(p.position.x - x - .5, p.position.y - y - .5, p.position.z - z - .5);
    if (d > 8 || this.sim.world.get(x, y, z) !== w.block) this.closeWindow(p);
  }
  state(p, target) {
    const sim = this.sim;
    return { screen: 'playing', heldTool: p.survival.held?.id ?? 0, world: sim.world, survival: p.survival, position: p.position, velocity: p.velocity,
      motion: { ...p.motion, sneaking: !!p.input.sneak }, mobs: null, farming: sim.farming, trees: sim.trees, fire: sim.fire, fluids: sim.fluids,
      items: this.items, xpOrbs: { spawn: noop }, grounded: p.grounded, fallDistance: p.fallDistance, wasInWater: p.inWater, yaw: p.yaw, pitch: p.pitch,
      eating: p.eating, mining: p.mining, mineCooldown: p.mineCooldown, mineHeld: p.mineHeld, flowers: null, boneRandom: sim.random, itemRand: sim.random,
      signs: null, difficulty: p.survival.difficulty, target };
  }
  // BlockBreak with the drops it makes, as the player who broke it; nearby players hear and see it (level event 2001).
  breakBlock(p, block, creative = false) {
    const sim = this.sim, [x, y, z] = block, id = sim.world.get(x, y, z), meta = sim.world.getMeta(x, y, z);
    if (!sim.canBreak(p, block)) return false;
    const done = breakPlayerBlock({ world: sim.world, survival: p.survival, items: this.items, xpOrbs: { spawn: noop }, farming: sim.farming, trees: sim.trees,
      heldTool: p.survival.held?.id ?? 0 }, block, { creative, random: sim.random });
    if (sim.world.get(x, y, z) !== id) sim.near(p, { type: 'broke', block: [x, y, z], id, meta }, true);
    return done;
  }
  // A right or left click (Minecraft.clickMouse) with the server's own aim: block activation, item use or placement, or the
  // start of mining. `place` is the use button.
  edit(p, place) {
    const sim = this.sim, target = serverTarget(sim.world, p);
    if (p.dead) return false;
    // MinecraftServer.isBlockProtected: near the spawn only operators dig, use or place against blocks.
    if (target && !sim.canBreak(p, target.block)) return false;
    if (place) {
      const id = p.survival.held?.id ?? 0;
      if (unsupportedUse(id) || id === WATER || id === LAVA) return false;
      // Levers, buttons and the other switches reach the live redstone network, as they do on the single-player server.
      if (target && !p.input.sneak && [108, 111, 112, 124, 126, 127].includes(sim.world.get(...target.block))) { sim.redstone.use(...target.block); p.swing = 6; return true; }
    }
    const state = this.state(p, target);
    let result = null;
    try {
      result = applyPlayerEdit(state, { place, target, aimedEntity: null, bucket: null }, {
        random: sim.random,
        swing: () => { p.swing = 6; },
        breakBlock: (block, creative) => this.breakBlock(p, block, creative),
        clientEyeInWater: () => eyeInWater(sim.world, ...Object.values(playerEye(p))),
        openInventory: station => { if (station && target) this.open(p, 'workbench', p.survival.openWorkbench(), { at: target.block, block: sim.world.get(...target.block) }); },
        useFurnace: key => this.open(p, 'furnace', p.survival.openFurnace(key), { key, at: target.block, block: sim.world.get(...target.block) }),
        openChest: (chest, key, at) => this.open(p, 'chest', chest, { key, at, block: sim.world.get(...at), title: chest.title, rows: chest.rows }),
        openDispenser: (tile, key, at, title) => this.open(p, 'dispenser', new DispenserContainer(p.survival.inventory, tile, noop), { key, at, block: sim.world.get(...at), title }),
        openHopper: (tile, key, at) => this.open(p, 'hopper', new HopperContainer(p.survival.inventory, tile, noop), { key, at, block: sim.world.get(...at) }),
        touchRedstoneOre: noop,
        collides: w => [...sim.players.values()].some(o => !o.dead && collides(w, o.position.x, o.position.y, o.position.z)),
      });
    } catch (error) {
      console.error('[gun-server] edit failed', error?.message ?? error);
      return false;
    }
    p.eating = state.eating; p.mining = state.mining; p.mineCooldown = state.mineCooldown;
    return !!result?.handled;
  }
  // PlayerControllerMP.onPlayerDamageBlock, run by the server each tick for a held attack button.
  tickMining(p) {
    const sim = this.sim;
    if (p.dead) { p.mining = null; return; }
    const target = serverTarget(sim.world, p);
    const state = { playing: !p.window, mineHeld: p.mineHeld, target, aimedEntity: null, mining: p.mining, cooldown: p.mineCooldown,
      survival: p.survival, heldTool: p.survival.held?.id ?? 0, grounded: p.grounded };
    tickPlayerMining(state, {
      getBlock: (x, y, z) => sim.world.get(x, y, z),
      eyeInWater: () => eyeInWater(sim.world, ...Object.values(playerEye(p))),
      edit: () => { this.edit(p, false); return { mining: p.mining, cooldown: p.mineCooldown }; },
      swing: () => { p.swing = 6; },
      breakBlock: block => this.breakBlock(p, block, false),
      mayHit: (x, y, z) => mayHitBlock(p.survival, sim.world.get(x, y, z), sim.world.getMeta(x, y, z), p.survival.held?.id ?? 0),
    });
    p.mining = state.mining; p.mineCooldown = state.cooldown;
  }
  // EntityItem ticks, then each live player's pickup box (EntityPlayer.onLivingUpdate -> onCollideWithPlayer).
  tickItems() {
    const sim = this.sim;
    this.items.tick(sim.world, s => ITEMS[s.id]?.stack ?? 64);
    for (const p of sim.players.values()) {
      if (p.dead) continue;
      const picked = this.items.collect(p.position, PHYSICS.width, PHYSICS.height, s => p.survival.inventory.add(s));
      for (const { item, count } of picked) sim.near(p, { type: 'pickup', by: p.id, entity: this.entityId(item), count }, true);
    }
    this.items.sounds.length = 0;
  }
  entityId(e) { return (e.eid ??= this.nextEntity++); }
  // The dropped items near player p (EntityTracker range 64 for items): [entity, x, y, z, id, damage, count].
  itemsNear(p) {
    const out = [], r = 64;
    for (const e of this.items.items) {
      if (Math.abs(e.x - p.position.x) > r || Math.abs(e.z - p.position.z) > r) continue;
      out.push([this.entityId(e), +e.x.toFixed(3), +e.y.toFixed(3), +e.z.toFixed(3), e.stack.id, e.stack.damage ?? 0, e.stack.count]);
    }
    return out;
  }
  // What the client needs to mirror the open window: its number and kind when it opens, then its own slots and the held stack.
  windowState(p) {
    const inv = p.survival.inventory, w = p.window, container = w ? w.container : p.inventoryWindow;
    const out = { id: w ? w.id : 0, cursor: copyStack(inv.cursor), slots: windowSlots(container, inv) };
    if (w?.kind === 'furnace') { const f = p.survival.furnace(w.key); out.bars = { burn: f.burn, burnTotal: f.burnTotal, cook: f.cook }; }
    return out;
  }
  openState(p) {
    const w = p.window;
    return w ? { id: w.id, kind: w.kind, key: w.key ?? null, title: w.title ?? null, rows: w.rows ?? null } : null;
  }
}
export { StackArray, ChestContainer };
