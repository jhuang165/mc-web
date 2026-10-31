// 1.7.10 Potion (rv), PotionEffect (rw) and ItemFood (acx).
// Only food-borne Hunger and Poison are implemented; these use vanilla effect IDs.
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
    if (!effect || ![HUNGER, POISON].includes(effect.id) || !Number.isFinite(effect.duration) || effect.duration < 1) return false;
    const next = {
      id: effect.id,
      duration: Math.min(2147483647, Math.floor(effect.duration)),
      amplifier: Number.isFinite(effect.amplifier) ? Math.max(0, Math.min(255, Math.floor(effect.amplifier))) : 0,
    }, old = this.active.get(next.id);
    // PotionEffect.combine: stronger replaces; equal strength only extends.
    // A weaker effect never extends or resumes behind a stronger effect.
    if (!old || next.amplifier > old.amplifier) this.active.set(next.id, next);
    else if (next.amplifier === old.amplifier && next.duration > old.duration) old.duration = next.duration;
    return true;
  }
  food(id, random = Math.random) {
    const effect = FOOD_EFFECTS[id];
    if (effect && Math.fround(random()) < Math.fround(effect.chance)) this.add(effect);
  }
  tick(player) {
    for (const effect of this.active.values()) {
      if (effect.id === HUNGER) player.exhaust(Math.fround(Math.fround(0.025) * (effect.amplifier + 1)));
      else {
        const interval = 25 >> effect.amplifier;
        if ((interval <= 0 || effect.duration % interval === 0) && player.health > 1) player.damage(1, "poison");
      }
      if (--effect.duration <= 0) this.active.delete(effect.id);
    }
  }
  clear() { this.active.clear(); }
  serialize() { return Array.from(this.active.values(), (effect) => ({ ...effect })); }
}
