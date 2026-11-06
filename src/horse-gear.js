// The horse's gear in Minecraft Java 1.7.10: ContainerHorseInventory (aam) with its saddle slot (aan) and armour slot (aao)
// over the AnimalChest (zt), the EntityLiving leash rules (sw.c, sw.b, td.bL), ItemLead (adf) with EntityLeashKnot (su),
// ItemNameTag (adm) and the GuiScreenHorseInventory (bft) layout. Pure rules and the Container class: the engine wiring is
// horse-gear-live.js. Replayed against public/research/horse-gear-reference.json (tools/probes/HorseGearProbe.java).
import { Container, Slot, StackArray, copyStack } from "./inventory.js";
import { ORIGINAL_ITEMS } from "./original-items.js";
import { originalOfLive } from "./item-names.js";
import { HORSE_ARMOR_IDS, SADDLE_ID, canWearArmor, canCarryChest } from "./horse.js";

export const SADDLE_SLOT = 0, ARMOR_SLOT = 1, CHEST_FIRST = 2, BASE_SIZE = 2, CHEST_SIZE = 17;
// EntityHorse.func_110226_cD (wi.cN) builds AnimalChest("HorseChest", n) and then renames it to getCommandSenderName (zt.a(String)
// sets the custom-name flag, so GuiScreenHorseInventory shows it untranslated). cN runs in the constructor (type 0 and no
// custom name yet, so "Horse"), when a chest is added (interact) and in readEntityFromNBT only for a chested horse. The title
// is therefore "Horse" for a horse without a chest whatever its type or name, and the horse's name for a chested donkey or mule.
const HORSE_NAMES = ["Horse", "Donkey", "Mule", "Zombie Horse", "Skeleton Horse"]; // en_US.lang entity.<type>.name
export function horseChestTitle(h, customName = "") {
  if (!h?.chested) return HORSE_NAMES[0];
  return customName || (HORSE_NAMES[h.type] ?? HORSE_NAMES[0]);
}
// Item ids: the lead is the one new item (original 420); the name tag is the existing original 421.
export const LEAD_ORIGINAL = 420, LEAD_ITEM = 2020, NAME_TAG_ORIGINAL = 421, NAME_TAG_ITEM = 375, CHEST_ORIGINAL = 54;
export const liveOf = (original) => ORIGINAL_ITEMS[original] ?? original;
export const originalId = (stack) => (stack ? originalOfLive(stack.id)?.id ?? null : null);

// ---- the gear list: e.horse.items holds the real stacks (saddle, armour, then 15 chest slots) ----
export const gearSize = (h) => (h.chested ? CHEST_SIZE : BASE_SIZE);
// A record saved with flags only (older worlds, /summon Saddle) gets the matching stacks the first time its screen opens.
export function ensureItems(h) {
  const size = gearSize(h);
  const items = Array.isArray(h.items) ? h.items.slice(0, size) : [];
  while (items.length < size) items.push(null);
  {
    if (h.saddled && !items[SADDLE_SLOT]) items[SADDLE_SLOT] = { id: liveOf(SADDLE_ID), count: 1, damage: 0 };
    const armour = Object.entries(HORSE_ARMOR_IDS).find(([, v]) => v === h.armor)?.[0];
    if (armour && !items[ARMOR_SLOT]) items[ARMOR_SLOT] = { id: liveOf(+armour), count: 1, damage: 0 };
  }
  h.items = items;
  return items;
}
// A saved stack list, sanitised: {id, count, damage} stacks (or null) in at most 17 slots; anything else is dropped.
export function cleanItems(raw) {
  if (!Array.isArray(raw)) return undefined;
  return raw.slice(0, CHEST_SIZE).map((s) => (s && Number.isInteger(s.id) && Number.isInteger(s.count) && s.count > 0 ? { ...s, count: Math.min(s.count, 64), damage: Number.isInteger(s.damage) ? s.damage : 0 } : null));
}
// EntityHorse.isHorseSaddled and getHorseArmorIndex read the AnimalChest slots; the record keeps them as flags too.
export function syncGear(h) {
  if (!Array.isArray(h.items)) return h;
  h.saddled = originalId(h.items[SADDLE_SLOT]) === SADDLE_ID;
  h.armor = HORSE_ARMOR_IDS[originalId(h.items[ARMOR_SLOT])] ?? 0;
  return h;
}
// wi.cN (setChested then the chest is rebuilt): the new AnimalChest keeps the first slots and adds 15 empty ones.
export function attachChest(h) {
  ensureItems(h);
  h.chested = true;
  ensureItems(h);
  return h;
}

// ---- slot rules (aan, aao and the plain chest slots) ----
// aan.a: a saddle, only while the slot is empty. aao.a: horse armour, whatever the slot holds, and only a horse (cB) wears it.
export function slotValid(h, slot, stack, occupied = false) {
  const id = originalId(stack);
  if (slot === SADDLE_SLOT) return id === SADDLE_ID && !occupied;
  if (slot === ARMOR_SLOT) return !!HORSE_ARMOR_IDS[id] && canWearArmor(h.type);
  return slot < gearSize(h);
}
export const slotEnabled = (h, slot) => (slot === ARMOR_SLOT ? canWearArmor(h.type) : true);
// aam: slots at (8, 18) saddle, (8, 36) armour, then the 3 x 5 chest slots at (80 + 18c, 18 + 18r); 27 + 9 inventory slots at y 84.
export function layout(h) {
  const rows = [{ slot: 0, x: 8, y: 18, enabled: true }, { slot: 1, x: 8, y: 36, enabled: slotEnabled(h, 1) }];
  if (h.chested) for (let i = 0; i < 15; i++) rows.push({ slot: 2 + i, x: 80 + (i % 5) * 18, y: 18 + Math.floor(i / 5) * 18, enabled: true });
  const first = rows.length;
  for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) rows.push({ slot: first + col + row * 9, x: 8 + col * 18, y: 84 + row * 18, enabled: true });
  for (let col = 0; col < 9; col++) rows.push({ slot: first + 27 + col, x: 8 + col * 18, y: 142, enabled: true });
  return rows;
}
// aam.canInteractWith: the horse is alive and within 8 blocks (EntityPlayer.getDistanceToEntity, 3D).
export const canInteract = (alive, distance) => alive && distance < 8;
// wi.cK: every stack from slot 0 up drops, then the chest block of a chested horse.
export function gearDrops(h) {
  const out = [];
  for (const s of h.items ?? []) if (s) out.push(s);
  if (h.chested) out.push({ id: liveOf(CHEST_ORIGINAL), count: 1, damage: 0 });
  return out;
}

class HorseSlot extends Slot {
  constructor(inventory, index, x, y, horse) { super(inventory, index, x, y); this.horse = horse; }
  get limit() { return this.index < CHEST_FIRST ? 1 : this.inventory.limit; }
  get enabled() { return slotEnabled(this.horse, this.index); }
  valid(s) { return !!s && slotValid(this.horse, this.index, s, this.has); }
}
// The armour slot ignores what it holds when validating (aao has no hasStack test), the saddle slot does not.
class ArmourSlot extends HorseSlot { valid(s) { return !!s && slotValid(this.horse, ARMOR_SLOT, s, false); } }

// ContainerHorseInventory. `h` is the horse record (e.horse); every change refreshes its saddled/armor flags.
export class HorseContainer extends Container {
  constructor(inv, h, onChange, customName = "") {
    super(inv);
    this.horse = h;
    this.title = horseChestTitle(h, customName);
    this.tile = new StackArray(ensureItems(h), () => { syncGear(h); onChange?.(); });
    this.addSlot(new HorseSlot(this.tile, SADDLE_SLOT, 8, 18, h));
    this.addSlot(new ArmourSlot(this.tile, ARMOR_SLOT, 8, 36, h));
    if (h.chested) for (let i = 0; i < 15; i++) this.addSlot(new HorseSlot(this.tile, 2 + i, 80 + (i % 5) * 18, 18 + Math.floor(i / 5) * 18, h));
    this.addPlayerSlots(8, 84);
  }
  get size() { return this.tile.size; }
  // aam.b: from the horse into the inventory (reverse); into the horse: armour slot, saddle slot, then the chest slots.
  transfer(index) {
    const slot = this.slots[index];
    if (!slot?.has) return null;
    const n = this.size, s = slot.stack, moved = copyStack(s);
    let ok;
    if (index < n) ok = this.merge(s, n, this.slots.length, true);
    else if (this.slots[ARMOR_SLOT].valid(s) && !this.slots[ARMOR_SLOT].has) ok = this.merge(s, ARMOR_SLOT, ARMOR_SLOT + 1, false);
    else if (this.slots[SADDLE_SLOT].valid(s)) ok = this.merge(s, SADDLE_SLOT, SADDLE_SLOT + 1, false);
    else ok = n > BASE_SIZE && this.merge(s, CHEST_FIRST, n, false);
    if (!ok) return null;
    if (s.count === 0) slot.put(null);
    else slot.changed();
    return moved;
  }
}

// ---- leads (EntityLiving.c, sw.b/a, td.bL; ItemLead.adf; EntityLeashKnot su) ----
export const LEASH_BREAK = 10, LEASH_PULL = 6, LEASH_PATH = 4, KNOT_REACH = 7;
export const LEASH_HOME_RADIUS = 5, LEASH_PATH_SPEED = 1, LEASH_TASK_PRIORITY = 2, KNOT_CHECK_PERIOD = 100;
const f32 = Math.fround;
// Entity.getDistanceToEntity (sa.e): each axis is narrowed to a float, squared and summed in float, then MathHelper.sqrt_float.
export const leashDistance = (dx, dy, dz) => { const x = f32(dx), y = f32(dy), z = f32(dz); return f32(Math.sqrt(f32(f32(f32(x * x) + f32(y * y)) + f32(z * z)))); };
// td.bL with a holder in the same world (public/research/leash-reference.json `path`): the home area is set around the holder's cell
// (radius 5) on every tick. A sitting EntityTameable (tg.ca) only breaks beyond 10 blocks and does nothing else. Otherwise the first
// leashed tick adds EntityAIMoveTowardsRestriction (priority 2, speed 1) and turns avoid-water off, the horse stops grazing beyond 6,
// a path to the holder (speed 1) starts beyond 4 blocks, the velocity pull (delta / distance * |delta / distance| * 0.4 per axis)
// applies beyond 6 and the lead breaks beyond 10; the last two can happen on the same tick. Distances are floats, compared as such.
export function leashStep(dx, dy, dz, { sitting = false } = {}) {
  const d = leashDistance(dx, dy, dz);
  const unleash = d > LEASH_BREAK;
  if (sitting) return { unleash, pull: null, path: false, home: true, task: false, stopEating: false, distance: d };
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const pull = d > LEASH_PULL ? [ux * Math.abs(ux) * 0.4, uy * Math.abs(uy) * 0.4, uz * Math.abs(uz) * 0.4] : null;
  return { unleash, pull, path: d > LEASH_PATH, home: true, task: true, stopEating: d > LEASH_PULL, distance: d };
}
// EntityHanging.onUpdate (ss.h), run by su for every knot: a counter climbs each tick and on the call after it reads 100 it resets;
// a knot whose block is no longer a fence (onValidSurface, render type 11) then dies without dropping anything. So a knot outlives a
// broken fence by up to 100 ticks and is checked every 101st tick (probe knotLife: death at tick 101, 202 ...).
export function knotAge(age, valid) {
  return age === KNOT_CHECK_PERIOD ? { age: 0, kill: !valid } : { age: age + 1, kill: false };
}
// sw.c(yz): a leashed mob held by this player is freed (the lead drops outside Creative); otherwise a lead in hand ties it (the lead is used up even in Creative, probe heldAfter).
// Monsters (IMob), bats and the dragon refuse the lead.
export const NOT_LEASHABLE = new Set(["zombie", "skeleton", "spider", "cave_spider", "creeper", "enderman", "silverfish", "witch", "slime", "bat", "ghast", "blaze", "magma_cube", "zombie_pigman", "wither", "ender_dragon"]);
export const leashable = (type) => !NOT_LEASHABLE.has(type);
export function leashUse({ leashed, holderIsPlayer, heldLead, creative, type }) {
  if (leashed && holderIsPlayer) return { used: true, action: "free", dropLead: !creative };
  if (heldLead && !leashed && leashable(type)) return { used: true, action: "tie", consume: true };
  return { used: false, action: "none" };
}
// ItemLead.func_150909_a over a fence (box around the block's integer corner) and su.c on a knot (box around the knot, block + 0.5):
// every mob held by the player whose bounding box meets the 7-block box moves to the knot. `centre` is the box centre; a mob may
// carry `halfWidth` / `height` (the probe's point test is halfWidth 0, height 0). The knot exists only once a mob is found.
export function knotAttach(mobs, centre) {
  return mobs.filter((m) => {
    if (m.leash?.holder !== "player") return false;
    const hw = m.halfWidth ?? 0, h = m.height ?? 0;
    return m.x + hw >= centre.x - KNOT_REACH && m.x - hw <= centre.x + KNOT_REACH && m.y + h >= centre.y - KNOT_REACH && m.y <= centre.y + KNOT_REACH
      && m.z + hw >= centre.z - KNOT_REACH && m.z - hw <= centre.z + KNOT_REACH;
  });
}
// su.c(yz) on a knot: with a lead in hand the player's mobs join it; with none to attach the knot dies, and in Creative every
// mob it held is freed without a drop (otherwise they stay tied to a dead holder and lose the lead on the next tick).
export function knotClick({ attached, creative }) {
  return attached > 0 ? { kill: false, freeAll: false } : { kill: true, freeAll: creative };
}
export const knotKey = (x, y, z) => `${x},${y},${z}`;

// ---- name tags (adm.a) ----
// Only a tag that carries a display name works (even an empty one), on a living mob that is not a player; it names the mob and makes
// it persistent. The tag is used up outside Creative.
export function nameTagUse({ stackName, isMob, isPlayer }) {
  if (typeof stackName !== "string" || isPlayer || !isMob) return { used: false };
  return { used: true, name: stackName, persistent: true, consume: 1 };
}
export const hasDisplayName = (stack) => typeof stack?.displayName === "string";
// RendererLivingEntity: the plate shows for CustomNameVisible, or for the mob the player is looking at, nearer than 64 blocks
// (32 sneaking), when nobody rides it.
export function nameplateShown({ name, visible, looked, distance, sneaking = false, ridden = false }) {
  if (!name || ridden) return false;
  const reach = sneaking ? 32 : 64;
  return distance < reach && (!!visible || !!looked);
}
export { SADDLE_ID, HORSE_ARMOR_IDS, canWearArmor, canCarryChest };
