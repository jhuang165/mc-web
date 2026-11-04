// 1.7.10 Potion (rv), PotionEffect (rw) and ItemFood (acx) on the local player. All 23 potion ids (potions.js) are held, ticked and saved;
// the food-borne Hunger and Poison use the same ids. Attribute modifiers come from potions.js (evidence: potions-reference.json).
import { POTION_TYPES, POTION as PT, modifierAmount } from "./potions.js";
export const HUNGER = 17, POISON = 19;
const FOOD_EFFECTS = {
  326: { id: POISON, duration: 100, chance: 1 },
  318: { id: HUNGER, duration: 600, chance: 0.3 },
  206: { id: HUNGER, duration: 600, chance: 0.8 },
  325: { id: POISON, duration: 100, chance: 0.6 },
};

export class Effects {
  constructor(saved) {
    this.active = new Map();
    if (Array.isArray(saved)) for (const effect of saved) this.add(effect);
  }
  has(id) { return this.active.has(id); }
  get(id) { return this.active.get(id); }
  add(effect) {
    if (!effect || !POTION_TYPES[effect.id] || !Number.isFinite(effect.duration) || effect.duration < 1) return false;
    const next = {
      id: effect.id,
      duration: Math.min(2147483647, Math.floor(effect.duration)),
      amplifier: Number.isFinite(effect.amplifier) ? Math.max(0, Math.min(255, Math.floor(effect.amplifier))) : 0,
    }, old = this.active.get(next.id);
    // PotionEffect.combine: stronger replaces; equal strength only extends.
    // A weaker effect never extends or resumes behind a stronger effect.
    if (!old || next.amplifier > old.amplifier) {
      this.active.set(next.id, next);
      if (next.id === PT.ABSORPTION && this.player) this.player.absorption = Math.fround((this.player.absorption || 0) + 4 * (next.amplifier + 1) - (old ? 4 * (old.amplifier + 1) : 0)); // Potion.applyAttributesModifiersToEntity
    } else if (next.amplifier === old.amplifier && next.duration > old.duration) old.duration = next.duration;
    return true;
  }
  food(id, random = Math.random) {
    const effect = FOOD_EFFECTS[id];
    if (effect && Math.fround(random()) < Math.fround(effect.chance)) this.add(effect);
  }
  // PotionEffect.onUpdate for every effect (EntityLivingBase.updatePotionEffects): performEffect on the ticks Potion.isReady allows, then the
  // duration counts down and a finished effect is removed (Absorption takes its amount back, Health Boost caps the health).
  tick(player) {
    this.player = player;
    for (const effect of [...this.active.values()]) {
      const amp = effect.amplifier;
      switch (effect.id) {
        case PT.HUNGER: player.exhaust(Math.fround(Math.fround(0.025) * (amp + 1))); break;
        case PT.POISON: { const interval = 25 >> amp; if ((interval <= 0 || effect.duration % interval === 0) && player.health > 1) player.damage(1, "poison"); break; }
        case PT.WITHER: { const interval = 40 >> amp; if (interval <= 0 || effect.duration % interval === 0) player.damage(1, "wither"); break; }
        case PT.REGENERATION: { const interval = 50 >> amp; if ((interval <= 0 || effect.duration % interval === 0) && player.health < player.maxHealth) player.heal(1); break; }
        case PT.INSTANT_HEALTH: player.heal(Math.max(4 << amp, 0)); break; // Potion.performEffect (the player is not undead)
        case PT.INSTANT_DAMAGE: player.damage(6 << amp, "magic"); break;
        case PT.SATURATION: if (!player.creative) { player.food = Math.min(20, player.food + amp + 1); player.saturation = Math.min(player.food, Math.fround(player.saturation + Math.fround(Math.fround((amp + 1) * 2) * 1))); } break; // FoodStats.addStats(amp + 1, 1.0F)
        default: break;
      }
      if (--effect.duration <= 0) this.remove(effect.id);
    }
  }
  remove(id) {
    const old = this.active.get(id);
    if (!old) return;
    this.active.delete(id);
    const p = this.player;
    if (id === PT.ABSORPTION && p) p.absorption = Math.max(0, Math.fround((p.absorption || 0) - 4 * (old.amplifier + 1))); // Potion.removeAttributesModifiersFromEntity
    if (id === PT.HEALTH_BOOST && p && p.health > p.maxHealth) p.health = p.maxHealth;
  }
  // generic.movementSpeed: the potion modifiers (operation 2) multiply the value: Speed +20% and Slowness -15% per level.
  moveSpeedMultiplier() {
    let m = 1;
    for (const id of [PT.SPEED, PT.SLOWNESS]) { const e = this.active.get(id); if (e) m *= 1 + modifierAmount(POTION_TYPES[id], e.amplifier); }
    return m;
  }
  // EntityLivingBase.jump: Jump Boost adds 0.1 per level to the upward motion.
  jumpBoost() { const e = this.active.get(PT.JUMP_BOOST); return e ? Math.fround((e.amplifier + 1) * Math.fround(0.1)) : 0; }
  // EntityPlayer.getBreakSpeed: Haste multiplies by 1 + 0.2 per level, Mining Fatigue by 1 - 0.2 per level (1.7.10, not the later 0.3^n).
  digSpeedMultiplier() {
    let m = 1;
    const h = this.active.get(PT.HASTE), f = this.active.get(PT.MINING_FATIGUE);
    if (h) m = Math.fround(m * Math.fround(1 + Math.fround((h.amplifier + 1) * 0.2)));
    if (f) m = Math.fround(m * Math.fround(1 - Math.fround((f.amplifier + 1) * 0.2)));
    return m;
  }
  // generic.attackDamage: Weakness adds -0.5 per level (operation 0) to the item damage, Strength then multiplies the total by 1 + 1.3 per level (operation 2).
  attackDamage(base) {
    let d = base;
    const w = this.active.get(PT.WEAKNESS), st = this.active.get(PT.STRENGTH);
    if (w) d += modifierAmount(POTION_TYPES[PT.WEAKNESS], w.amplifier);
    if (st) d *= 1 + modifierAmount(POTION_TYPES[PT.STRENGTH], st.amplifier);
    return d;
  }
  clear() { this.active.clear(); }
  serialize() { return Array.from(this.active.values(), (effect) => ({ ...effect })); }
}
