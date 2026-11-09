// What a Survival player does with the world on the gun server (not 1.7.10 networking): inventory windows and their clicks,
// mining, block use and placement, and the dropped items players throw, break loose and pick up. The server runs the same
// single-player code (Container.click, tickPlayerMining, applyPlayerEdit, ItemEntities) on its own state; a client sends
// only button presses and slot clicks, and shows its own prediction until the server's answer arrives.
import { watchCrafting, furnaceTaken, pickedUp } from './server-stats.js';
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
import { playerBox, rayBox } from './combat.js';
import { heldAttackDamage } from '../entities.js';
import { isCritical, criticalDamage } from '../player-movement.js';
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
import { MerchantContainer } from '../merchant-ui.js';
import { villagerInteract, villagerClearCustomer, villagerOffers, villagerUseRecipe, villagerHover } from '../villager.js';
import { JavaRandom } from '../java-random.js';
import { pickMinecart } from '../structure-simulation.js';
import { placeHeldMinecart } from '../vehicle-simulation.js';
import { horseSeatsFor } from '../horse-live.js';
import { useVehicle } from './server-riding.js';
import { useRod } from './server-fishing.js';
import { HorseContainer, canInteract as horseReach } from '../horse-gear.js';
import { PAINTING_ITEM, FRAME_ITEM } from '../hanging.js';
import { ServerStations, STATION_KINDS } from './server-stations.js';

const noop = () => {};
const mobId = e => Number(String(e.id).replace('mob-', ''));
export const MAX_CLICKS = 64; // per message: a drag is start + one per slot + end
// Right-click uses the server runs only with its mobs (server-mobs.js: arrows, projectiles, rockets, eyes, orbs, boats, the fishing
// hook's targets and server-maps.js), which every streamed gun world has; the finite test arenas refuse them.
const UNSUPPORTED_USE = new Set();
const MOB_USE = new Set([ITEM_EMPTY_MAP, FISHING_ROD, ITEM_SPAWN_EGG, ITEM_EXP_BOTTLE, ITEM_FIRE_CHARGE, ITEM_EYE_OF_ENDER, ITEM_FIREWORK_ROCKET, BOW, BOAT_ITEM]);
export const unsupportedUse = (id, mobs = false) => UNSUPPORTED_USE.has(id) || (!mobs && (MOB_USE.has(id) || isThrowable(id) || isBook(id)));
// The windows a block can open here; the client builds the same container around its own copy (main.js remoteWindow).
export const WINDOW_KINDS = new Set(['workbench', 'furnace', 'chest', 'dispenser', 'hopper', ...STATION_KINDS]);

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
    this.itemRand = new JavaRandom(Math.floor(sim.random() * 2 ** 48)); // Item.itemRand (the eye's sound, an eye in a frame)
    this.windowCounter = 0;
    this.stations = new ServerStations(sim, saved.stations ?? null); // brewing stands, enchanting tables, anvils, beacons
  }
  save() { return { items: this.items.serialize(), stations: this.stations.save() }; }
  // A joining (or respawned, or mode-changed) player: the always-open inventory window 0, nothing being mined.
  reset(p) {
    p.inventoryWindow = watchCrafting(p, p.survival.openInventory());
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
  // EntityVillager.interact -> displayGUIMerchant: the villager takes this player as its customer; the offers go to the tab with the
  // window, and a trade's sounds and restock run on the server's villager.
  openMerchant(p, e) {
    const ew = this.sim.mobs?.ew, brain = ew?.ai.brain(e);
    if (!brain || !villagerInteract(brain, false, p.name)) return false;
    const merchant = { offers: () => villagerOffers(brain), useRecipe: r => villagerUseRecipe(brain, r), hover: has => villagerHover(brain, has),
      close: () => villagerClearCustomer(e) };
    const container = new MerchantContainer(p.survival.inventory, merchant);
    villagerOffers(brain);
    this.open(p, 'merchant', container, { mob: e, key: e.id, title: e.customName || null });
    return true;
  }
  // GuiMerchant's arrows (MC|TrSel): the offer the payment slots are matched against.
  trade(p, message) {
    const w = p.window, index = message?.index;
    if (!Number.isInteger(index) || index < 0 || index > 99) return false;
    if (w?.kind === 'merchant' && w.id === message.window && index < w.container.offers.length) w.container.select(index);
    return true;
  }
  // EntityHorse.openGUI: the horse's saddle, armour and chest slots (HorseContainer over its gear).
  openHorse(p, e) {
    const ew = this.sim.mobs?.ew;
    if (!ew?.horseGear) return false;
    const gear = ew.horseGear(e);
    if (!gear) return false;
    this.open(p, 'horse', new HorseContainer(p.survival.inventory, gear, noop, e.customName), { mob: e, key: e.id, title: e.customName || null, horse: { chested: !!gear.chested, type: gear.type ?? 0 } });
    return true;
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
    // A villager's or horse's window: the mob alive, still in the world and within 8 blocks (ContainerMerchant / AnimalChest
    // canInteractWith; a villager also drops its customer when it is hurt or leaves, EntityAITradePlayer).
    if (w?.mob) {
      const e = w.mob, alive = e.health > 0 && this.sim.mobs?.ew.entities.includes(e);
      if (!horseReach(alive, Math.hypot(p.position.x - e.x, p.position.y - e.y, p.position.z - e.z)) || (w.kind === 'merchant' && !e.customer)) this.closeWindow(p);
      return;
    }
    if (w?.cart) { if (!this.sim.mobs?.minecarts.usable(w.cart, p.position)) this.closeWindow(p); return; } // EntityMinecartContainer.isUseableByPlayer
    if (!w?.at) return;
    const [x, y, z] = w.at, d = Math.hypot(p.position.x - x - .5, p.position.y - y - .5, p.position.z - z - .5);
    if (d > 8 || this.sim.world.get(x, y, z) !== w.block) this.closeWindow(p);
  }
  state(p, target) {
    const sim = this.sim;
    if (sim.mobs) horseSeatsFor(sim.mobs.ew, p.rider); // a horse or pig this click mounts seats player p
    return { screen: 'playing', heldTool: p.survival.held?.id ?? 0, world: sim.world, survival: p.survival, position: p.position, velocity: p.velocity,
      rider: p.rider ?? null, minecarts: sim.mobs?.minecarts ?? null, boats: sim.mobs?.boats ?? null,
      motion: { ...p.motion, sneaking: !!p.input.sneak }, mobs: sim.mobs?.ew ?? null, farming: sim.farming, trees: sim.trees, fire: sim.fire, fluids: sim.fluids,
      items: this.items, xpOrbs: sim.mobs?.orbs ?? { spawn: noop }, arrows: sim.mobs?.arrows ?? null, projectiles: sim.mobs?.projectiles ?? null,
      rockets: sim.mobs?.rockets ?? null, eyes: sim.mobs?.eyes ?? null, grounded: p.grounded, fallDistance: p.fallDistance, wasInWater: p.inWater, yaw: p.yaw, pitch: p.pitch,
      eating: p.eating, mining: p.mining, mineCooldown: p.mineCooldown, mineHeld: p.mineHeld, flowers: null, boneRandom: sim.random, itemRand: this.itemRand,
      signs: null, difficulty: p.survival.difficulty, target, maps: sim.maps ?? null };
  }
  // BlockBreak with the drops it makes, as the player who broke it; nearby players hear and see it (level event 2001).
  breakBlock(p, block, creative = false) {
    const sim = this.sim, [x, y, z] = block, id = sim.world.get(x, y, z), meta = sim.world.getMeta(x, y, z);
    if (!sim.canBreak(p, block)) return false;
    const done = breakPlayerBlock({ world: sim.world, survival: p.survival, items: this.items, xpOrbs: sim.mobs?.orbs ?? { spawn: noop }, farming: sim.farming, trees: sim.trees,
      heldTool: p.survival.held?.id ?? 0 }, block, { creative, random: sim.random, harvested: info => p.statsLive?.harvested(info) });
    if (sim.world.get(x, y, z) !== id) sim.near(p, { type: 'broke', block: [x, y, z], id, meta }, true);
    return done;
  }
  // A right or left click (Minecraft.clickMouse) with the server's own aim: block activation, item use or placement, or the
  // start of mining. `place` is the use button.
  // EntityRenderer.getMouseOver for player p: the nearest mob, cart, painting or frame, or other player whose box the look crosses
  // within reach (3, 6 in Creative) and before the block it aims at; { entity, distance } for a mob, { cart, distance },
  // { hanging, distance } or { player, distance }, or null.
  aimed(p, target = serverTarget(this.sim.world, p)) {
    const sim = this.sim, eye = playerEye(p), dir = lookDir(p), reach = p.survival.creative ? 6 : 3, wall = Math.min(reach, target?.distance ?? reach);
    let best = sim.mobs?.ew.pick(eye, dir, reach, wall) ?? null;
    // The vehicle p sits in is not under its own crosshair (EntityRenderer.getMouseOver skips the ridden entity).
    const own = p.rider?.vehicle ?? null;
    if (best && own?.horse && best.entity === own.entity) best = null;
    for (const system of sim.mobs ? [sim.mobs.minecarts, sim.mobs.boats] : []) {
      const hit = pickMinecart(system, eye, dir, reach, wall, own);
      if (hit && (!best || hit.distance < best.distance)) best = { cart: hit.cart, distance: hit.distance };
    }
    // A painting or item frame (pickHanging), unless a mob or cart is nearer.
    const hung = sim.hanging?.pick(eye, dir, reach, wall);
    if (hung && (!best || hung.distance < best.distance)) best = hung;
    const o = [eye.x, eye.y, eye.z], d = [dir.x, dir.y, dir.z];
    for (const q of sim.players.values()) {
      if (q === p || q.dead) continue;
      const t = rayBox(o, d, playerBox(q.position), wall);
      if (t !== null && (!best || t < best.distance)) best = { player: q, distance: t };
    }
    return best;
  }
  // EntityPlayer.attackTargetEntityWithCurrentItem on another player (PvP on): the held item's attack damage, a falling critical,
  // the knockback of the swing, sword (1) or tool (2) wear and the 0.3 exhaustion of a landed hit.
  hitPlayer(p, q) {
    const sim = this.sim;
    if (sim.config?.pvp === false || q.dead) return false;
    const s = p.survival, tool = s.held?.id ?? 0, item = ITEMS[tool];
    let amount = heldAttackDamage(tool, s);
    if (!(amount > 0)) return false;
    const critical = isCritical({ fallDistance: p.fallDistance, onGround: p.grounded, inWater: p.inWater, riding: !!p.rider?.vehicle });
    if (critical) amount = criticalDamage(amount);
    if (!sim.damage(q, amount, { attacker: p, kind: 'melee', weapon: null, knockback: true })) return false;
    if (!s.creative && ['sword', 'axe', 'pickaxe', 'shovel'].includes(item?.kind)) s.wear(tool, item.kind === 'sword' ? 1 : 2);
    s.exhaust(0.3);
    sim.send(p, { type: 'hit', target: q.id, head: false, kill: q.survival.health <= 0, melee: true });
    if (critical) sim.near(p, { type: 'fx', kind: 'crit', player: q.id }, true);
    return true;
  }
  // The attack button pressed (Minecraft.clickMouse(0)): a mob or player under the crosshair is hit once per press, as the
  // single-player click does; a block is left to the mining tick.
  attackPress(p) {
    if (p.dead || p.window) return false;
    const aim = this.aimed(p);
    if (!aim) return false;
    p.swing = 6;
    if (aim.player) return this.hitPlayer(p, aim.player);
    return this.edit(p, false, aim);
  }
  edit(p, place, aim = undefined) {
    const sim = this.sim, target = serverTarget(sim.world, p);
    if (p.dead) return false;
    aim ??= this.aimed(p, target);
    if (aim?.player) { if (!place) { p.swing = 6; return this.hitPlayer(p, aim.player); } aim = null; } // EntityPlayer.interactWith another player does nothing
    if (aim?.cart) return this.useCart(p, aim.cart, place);
    if (aim?.hanging) return !!sim.hanging.edit(p, place, target, aim.hanging); // EntityItemFrame.interactFirst / attackEntityFrom
    const aimedEntity = aim?.entity ? aim : null;
    // MinecraftServer.isBlockProtected: near the spawn only operators dig, use or place against blocks (mobs are not protected).
    if (!aimedEntity && target && !sim.canBreak(p, target.block)) return false;
    if (aimedEntity) sim.mobs.see(p); // the hit mob's revenge, its drops' looting and an owner's tame read this player
    if (place && !aimedEntity) {
      const id = p.survival.held?.id ?? 0;
      // A world with server mobs (server-mobs.js) hatches spawn eggs; the other projectile and entity items wait for their entities.
      if (unsupportedUse(id, !!sim.mobs) || id === WATER || id === LAVA) return false;
      // Levers, buttons and the other switches reach the live redstone network, as they do on the single-player server.
      if (target && !p.input.sneak && [108, 111, 112, 124, 126, 127].includes(sim.world.get(...target.block))) { sim.redstone.use(...target.block); p.swing = 6; return true; }
      // ItemMinecart.onItemUse on a rail (player-actions.js runs it before the edit, as here).
      if (target && sim.mobs && ITEMS[id]?.minecartType !== undefined && sim.mobs.minecarts.railKind(sim.world, ...target.block))
        return !!placeHeldMinecart(this.state(p, target), { target }, { swing: () => { p.swing = 6; } }).handled;
      // ItemHangingEntity.onItemUse: a painting or frame on the clicked wall (main.js runs it before the edit too).
      if ((id === PAINTING_ITEM || id === FRAME_ITEM) && sim.hanging) return !!sim.hanging.edit(p, true, target);
    }
    const state = this.state(p, target), made = sim.mobs?.mark(), heldTool = p.survival.held?.id ?? 0;
    let result = null;
    try {
      result = applyPlayerEdit(state, { place, target, aimedEntity, bucket: null }, {
        random: sim.random,
        swing: () => { p.swing = 6; },
        playSound: (sound, { volume = 1, pitch = 1, position = null } = {}) => sim.mobs?.sound({ sound, volume, pitch, position: position ?? { x: p.position.x, y: p.position.y, z: p.position.z } }),
        criticalHit: e => sim.near(p, { type: 'fx', kind: 'crit', mob: mobId(e) }, true),
        enchantmentCriticalHit: e => sim.near(p, { type: 'fx', kind: 'magicCrit', mob: mobId(e) }, true),
        openMerchant: e => this.openMerchant(p, e),
        openHorse: e => this.openHorse(p, e),
        breakBlock: (block, creative) => this.breakBlock(p, block, creative),
        clientEyeInWater: () => eyeInWater(sim.world, ...Object.values(playerEye(p))),
        openInventory: station => { if (station && target) this.open(p, 'workbench', watchCrafting(p, p.survival.openWorkbench()), { at: target.block, block: sim.world.get(...target.block) }); },
        useFurnace: key => this.open(p, 'furnace', p.survival.openFurnace(key, furnaceTaken(sim, p)), { key, at: target.block, block: sim.world.get(...target.block) }),
        openChest: (chest, key, at) => this.open(p, 'chest', chest, { key, at, block: sim.world.get(...at), title: chest.title, rows: chest.rows }),
        openDispenser: (tile, key, at, title) => this.open(p, 'dispenser', new DispenserContainer(p.survival.inventory, tile, noop), { key, at, block: sim.world.get(...at), title }),
        openHopper: (tile, key, at) => this.open(p, 'hopper', new HopperContainer(p.survival.inventory, tile, noop), { key, at, block: sim.world.get(...at) }),
        ...this.stations.hooks(this, p),
        touchRedstoneOre: noop,
        updateBlock: noop, updateBlocks: noop, // the world's own change log reaches the tabs
        particle: (name, x, y, z, vx, vy, vz) => sim.near(p, { type: 'fx', kind: 'particle', name, x, y, z, vx, vy, vz }, true),
        openBook: stack => { if (stack) sim.send(p, { type: 'book' }); },
        collides: w => [...sim.players.values()].some(o => !o.dead && collides(w, o.position.x, o.position.y, o.position.z)),
        placeBoat: () => this.placeBoat(p),
        useFishingRod: () => useRod(sim, p),
      });
    } catch (error) {
      console.error('[gun-server] edit failed', error?.message ?? error);
      return false;
    } finally {
      if (made) sim.mobs.claim(made, p);
    }
    p.eating = state.eating; p.mining = state.mining; p.mineCooldown = state.mineCooldown; p.motion.sprinting = state.motion.sprinting;
    p.statsLive?.placed(result, heldTool); // ItemStack.tryPlaceItemIntoWorld: the placed or applied item's use stat
    return !!result?.handled;
  }
  // A minecart or boat under the crosshair (server-riding.js useVehicle): the use button boards an empty cart or a boat and opens a
  // chest cart's 27 slots as a chest window; the attack hits it (it breaks after enough hits, spilling a chest cart's contents).
  useCart(p, cart, place) {
    const s = p.survival;
    const done = useVehicle(this.sim, p, cart, place, {
      swing: () => { p.swing = 6; },
      damage: () => heldAttackDamage(s.held?.id ?? 0, s),
      openContainer: container => this.open(p, 'chest', container, { cart, key: 'cart-' + cart.id, title: container.title, rows: 3 }),
    });
    return !!done.handled && !done.skipped;
  }
  // ItemBoat.onItemRightClick (boats.js place): along player p's look, refused where the boat would meet a block, a mob, a cart,
  // a boat or a player. Returns whether a boat was placed.
  placeBoat(p) {
    const sim = this.sim, mobs = sim.mobs;
    if (!mobs) return false;
    const box = at => [at.x - PHYSICS.width / 2, at.y, at.z - PHYSICS.width / 2, at.x + PHYSICS.width / 2, at.y + PHYSICS.height, at.z + PHYSICS.width / 2];
    const alive = mobs.ew.entities.filter(e => e.health > 0).map(e => { const [w, h] = mobs.ew.size(e); return { bb: [e.x - w / 2, e.y, e.z - w / 2, e.x + w / 2, e.y + h, e.z + w / 2] }; });
    const solid = [...mobs.boats.carts, ...mobs.minecarts.carts].filter(c => !c.dead && c.bb).map(c => ({ bb: c.bb }));
    const others = [...sim.players.values()].filter(o => o !== p && !o.dead).map(o => ({ bb: box(o.position) }));
    const sight = [...alive, ...solid, ...others], own = box(p.position), eye = playerEye(p), dir = lookDir(p);
    if (!mobs.boats.place(sim.world, { eye: [eye.x, eye.y, eye.z], dir: [dir.x, dir.y, dir.z], yaw: Math.fround(180 - p.yaw * 180 / Math.PI), box: own }, [{ bb: own }, ...sight], sight)) return false;
    if (!p.survival.creative) p.survival.take(BOAT_ITEM, 1);
    p.swing = 6;
    return true;
  }
  // PlayerControllerMP.onPlayerDamageBlock, run by the server each tick for a held attack button.
  tickMining(p) {
    const sim = this.sim;
    if (p.dead) { p.mining = null; return; }
    const target = serverTarget(sim.world, p);
    const state = { playing: !p.window, mineHeld: p.mineHeld, target, aimedEntity: p.mineHeld ? this.aimed(p, target) : null, mining: p.mining, cooldown: p.mineCooldown,
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
      for (const { item, count } of picked) { pickedUp(p, item.stack); sim.near(p, { type: 'pickup', by: p.id, entity: this.entityId(item), count }, true); }
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
    if (w?.kind === 'merchant') { out.offers = w.container.offers.map(r => ({ ...r })); out.recipe = w.container.currentRecipeIndex; }
    if (w) Object.assign(out, this.stations.state(w));
    return out;
  }
  openState(p) {
    const w = p.window;
    return w ? { id: w.id, kind: w.kind, key: w.key ?? null, title: w.title ?? null, rows: w.rows ?? null, ...(w.horse ? { horse: w.horse } : {}) } : null;
  }
}
export { StackArray, ChestContainer };
