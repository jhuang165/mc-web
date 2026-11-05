// Minecraft Java 1.7.10 EntityOcelot (wn, EntityList "Ozelot", id 98) and the parts of EntityTameable (tg) it shares with the wolf:
// the data and the pure rules. The AI tasks are ocelot-ai.js, the model ocelot-renderer.js, and entities.js hooks these in
// (ocelotInteract, ocelotUpdate, ...). Every rule here is checked against public/research/ocelot-reference.json, which
// tools/probes/OcelotProbe.java records from the unchanged original classes. See public/research/ocelots.md.
const f = Math.fround;
export const OCELOT_WIDTH = f(0.6), OCELOT_HEIGHT = f(0.8);
// applyEntityAttributes: movementSpeed 0.3 (a float); maxHealth 10, tamed or not (the tame effect does not change it).
export const OCELOT_SPEED = f(0.3), OCELOT_HEALTH = 10;
// getSoundVolume (bf): 0.4F. Hurt and death are both mob.cat.hitt (1.7.10's typo); mob.cat.hiss is never played.
export const OCELOT_SOUNDS = { meow: "mob.cat.meow", purr: "mob.cat.purr", purreow: "mob.cat.purreow", hit: "mob.cat.hitt", volume: f(0.4) };
// Raw fish (original item 349, any damage) as the project numbers them: fishing-content.js RAW_COD..PUFFERFISH. The cooked fish
// (350) are not the ocelot's item.
export const RAW_FISH = new Set([701, 702, 703, 704]);
export const isRawFish = (id) => RAW_FISH.has(id);
// Speeds the move helper must have for the sneak and the sprint pose (EntityOcelot.bp): EntityAITempt's 0.6 and the
// attack/sit 1.33.
export const SNEAK_SPEED = 0.6, SPRINT_SPEED = 1.33;
// The skins by datawatcher CatType (RenderOcelot.getEntityTexture); the model is scaled 0.8 once tamed.
export const CAT_TEXTURES = ["ocelot", "black", "red", "siamese"];
export const ocelotFields = () => ({
  // The owner of a tamed ocelot. 1.7.10 stores the owner's UUID (Owner/OwnerUUID); the single player here is the only owner.
  owner: "",
  // datawatcher 16 bit 1 (isSitting): changed only by the Sit tasks. `sitWish` is EntityAISit.isSitting: the click toggle.
  sitting: false, sitWish: false,
  // datawatcher 18: 0 wild ocelot, 1 black, 2 red, 3 siamese cat. datawatcher 16 bits 2 and 4 (sneaking, sprinting) follow the move speed.
  catType: 0, sneaking: false, sprinting: false,
});
export const isTamed = (e) => !!e.owner;
// What a save, an imported Java mob or /summon may contain, sanitised.
export function ocelotFieldsFrom(e) {
  const owner = typeof e.owner === "string" ? e.owner.trim() : "";
  const tamed = owner !== "";
  return {
    owner, sitting: tamed && e.sitting === true, sitWish: tamed && (e.sitWish ?? e.sitting) === true,
    catType: Number.isInteger(e.catType) && e.catType >= 0 && e.catType <= 3 ? e.catType : 0,
    sneaking: false, sprinting: false,
  };
}
// EntityOcelot.getLivingSound (t): a tamed cat in love purrs, else one roll in four purreows and the rest meow; a wild
// ocelot is silent ("" is played). Draws nextInt(4) only for a tamed cat not in love.
export function ocelotSay(e, rand) {
  if (!isTamed(e)) return "";
  if (e.love > 0) return OCELOT_SOUNDS.purr;
  return rand.nextInt(4) === 0 ? OCELOT_SOUNDS.purreow : OCELOT_SOUNDS.meow;
}
// EntityOcelot.canDespawn (v): only a wild ocelot older than 2400 ticks.
export const canDespawn = (e) => !isTamed(e) && e.age > 2400;
// EntityOcelot.canMateWith (a(wf)): another tamed ocelot, both in love. Unlike the wolf, sitting is not checked.
export function canMateWith(a, b) {
  if (a === b || !isTamed(a) || b.type !== "ocelot" || !isTamed(b)) return false;
  return a.love > 0 && b.love > 0;
}
// EntityOcelot.createChild (b(rx)): a kitten; a tamed parent makes it tamed with the same owner and CatType.
export function kittenFields(parent) {
  return isTamed(parent) ? { owner: parent.owner, catType: parent.catType } : {};
}
// EntityOcelot.bp, called by the AI update: the move helper's speed decides the pose while it is updating.
export function movePose(updating, speed) {
  if (!updating) return { sneaking: false, sprinting: false };
  if (speed === SNEAK_SPEED) return { sneaking: true, sprinting: false };
  if (speed === SPRINT_SPEED) return { sneaking: false, sprinting: true };
  return { sneaking: false, sprinting: false };
}
// EntityOcelot.getCanSpawnHere (by): one chance in three fails first (a World.rand draw, whatever follows); then the box must
// be free of entities and of liquid, the feet at y >= 63, and the block below grass or leaves. No light check.
export function canSpawnHere({ rand, collides, liquid, y, below }) {
  if (rand.nextInt(3) === 0) return false;
  if (collides || liquid) return false;
  return !(y < 63) && below;
}
// EntityOcelot.onSpawnWithEgg (a(sy)): one chance in seven of two kittens at the same spot, age -24000, CatType 0.
export const kittenLitter = (worldRand) => (worldRand.nextInt(7) === 0 ? 2 : 0);
// EntityAIOcelotSit.func_151486_a: the blocks a cat sits on: a chest nobody has open, a lit furnace, the foot half of a bed
// (BlockBed.isBlockHeadOfBed is bit 8, so the head never qualifies, occupied or not).
export function sitBlockValid({ chest, furnaceLit, bed, bedMeta = 0, chestUsers = 0 }) {
  if (chest) return chestUsers < 1;
  if (furnaceLit) return true;
  if (bed) return (bedMeta & 8) === 0;
  return false;
}
// EntityAIOcelotSit.func_151485_f: the x, z scan [floor(x) - 8, x + 8) by [floor(z) - 8, z + 8) at the cat's own y (int cast
// of posY); the valid block with air above and the least squared distance (to its corner) wins, the first in x then z order on ties.
export function findSitSpot(x, y, z, { valid, air }) {
  const iy = Math.trunc(y);
  let best = null, bestD = 2147483647;
  for (let bx = Math.trunc(x) - 8; bx < x + 8; bx++)
    for (let bz = Math.trunc(z) - 8; bz < z + 8; bz++) {
      if (!valid(bx, iy, bz) || !air(bx, iy + 1, bz)) continue;
      const d = (x - bx) ** 2 + (y - iy) ** 2 + (z - bz) ** 2;
      if (d < bestD) { bestD = d; best = { x: bx, y: iy, z: bz }; }
    }
  return best;
}
// BlockChest.o: a sitting ocelot whose box meets (x, y + 1, z) to (x + 1, y + 2, z + 1) blocks the chest (and a same-kind
// neighbour's too, BlockChest.m). `box(e)` is the minimum and maximum corner of its collision box.
export function sitsOnChest(cats, x, y, z) {
  return cats.some((c) => c.sitting && c.minX < x + 1 && c.maxX > x && c.minY < y + 2 && c.maxY > y + 1 && c.minZ < z + 1 && c.maxZ > z);
}
// The right click, as EntityOcelot.interact (a(yz)) decides it. `item` is the held stack ({id, count}) or null; ctx:
// isOwner, creative, tempting (the Tempt task is running: field j), distSq (to the clicker), rand (Entity.rand) and
// worldRand (World.rand, which picks the CatType). Mutates the ocelot and returns { handled, consume, status, love, tamed,
// sitToggle }: status 7 hearts after taming or 6 smoke after a failed roll; love: EntityAnimal.interact puts an adult in love
// with the fish (the caller applies its breeding rules; a kitten gets nothing).
export function interact(e, item, { isOwner, creative, tempting, distSq, rand, worldRand }) {
  const out = { handled: false, consume: 0, status: 0, love: false, tamed: false, sitToggle: false };
  const fish = !!item && isRawFish(item.id);
  if (isTamed(e)) {
    // An owner's click that is not a breeding item toggles the sit wish: it becomes "not sitting now". The original
    // goes on to the breeding path and returns false; this build counts the click as used (sitToggle).
    if (isOwner && !fish) {
      e.sitWish = !e.sitting;
      out.sitToggle = true;
    }
  } else if (tempting && fish && distSq < 9) {
    if (!creative) out.consume = 1;
    if (rand.nextInt(3) === 0) {
      e.owner = e.owner || "player";
      e.catType = 1 + worldRand.nextInt(3);
      e.sitWish = true;
      out.status = 7;
      out.tamed = true;
    } else out.status = 6;
    out.handled = true;
    return out;
  }
  if (fish) {
    out.love = true;
    out.handled = true;
  }
  return out;
}
