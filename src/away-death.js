// A player who dies while away (batch 43, public/research/dimensions.md "Batch 43").
//
// The away run records the first time a command block's effect takes the shadow player to 0 health (away-commands.js `playerDeath`): the tick, the traced dimension and position,
// the shadow's inventory and experience, and the damage reason. Natively the player dies in his own dimension at that tick: EntityPlayer.onDeath drops the inventory
// (unless keepInventory) and EntityLivingBase.onDeathUpdate leaves min(level * 7, 100) experience (not with keepInventory, and only with doMobLoot), both where he stood, and the
// death screen shows there. The run is computed when he returns, so the closest equivalent is: the drops and orbs go into that dimension's saved arrivals (the same inbox a
// portal traveller uses, delivered when the dimension next loads), at the traced position, and the live player dies on return with an empty inventory, through the usual death
// path (death screen, message "killed by magic" or the wither, respawn at the Overworld spawn or bed). Derived, not executed: the place and time are the trace's samples (about
// one a second), and what the live player picked up or used between the death tick and the return is not reproduced.
// Batch 44, when the live player dies: at the return (this file), not at the tick. The run is computed when he comes back (beginAway only copies the departure; the worker ticks
// the whole trip in finishAway), because the shadow reads the live player's inventory, health and effects at each trace sample, and those exist only once the trip is over. A kill
// forwarded as it happens would need the worker to tick alongside the live Nether at 20 ticks a second and read the live player; that is not bounded here. `tick` (the run tick of
// the death) is kept in the result for the log. Natively both dimensions tick in one server and he would die at that tick, in his own dimension.
import { ItemEntities } from "./item-entities.js";
import { ExperienceOrbs, Experience } from "./experience.js";
import { ruleOn } from "./game-rules.js";

export function awayDeathRecords(death, { keepInventory = false, mobLoot = true, random = Math.random } = {}) {
  const items = new ItemEntities(random), pos = { x: death.x, y: death.y, z: death.z };
  if (!keepInventory) for (const s of death.stacks ?? []) items.dropPlayer({ ...s }, pos, 0, 0, true, true);
  const points = keepInventory ? 0 : new Experience(death.experience ?? {}).death();
  const orbs = new ExperienceOrbs([], random);
  if (points > 0 && mobLoot) orbs.spawn(points, pos);
  return { drops: items.serialize(), xpOrbs: orbs.serialize(), points };
}

// Adds the death's drops to the inbox of the dimension he died in. Returns what the main thread needs to finish the death on the live player.
export function placeAwayDeath(root, death, random = Math.random) {
  const keepInventory = ruleOn(root, "keepInventory"), mobLoot = ruleOn(root, "doMobLoot");
  const out = awayDeathRecords(death, { keepInventory, mobLoot, random });
  const dim = Number.isInteger(death.dimension) && death.dimension !== 0 ? death.dimension : null;
  if (dim !== null) {
    const inbox = ((root.portalArrivals ??= {})[dim] ??= { entities: [], drops: [], xpOrbs: [], writes: [] });
    inbox.drops = [...(inbox.drops ?? []), ...out.drops];
    inbox.xpOrbs = [...(inbox.xpOrbs ?? []), ...out.xpOrbs];
  }
  return { keepInventory, cause: death.cause || "magic", tick: death.tick | 0, dimension: dim, drops: out.drops.length, orbs: out.xpOrbs.length, points: out.points };
}
