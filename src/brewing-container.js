// ContainerBrewingStand (aby) over a TileEntityBrewingStand, Minecraft Java 1.7.10: ingredient slot 3 at (79, 17), bottle slots 0-2 at
// (56, 46), (79, 53), (102, 46), then the 27 main and 9 hotbar slots at (8 + 18c, 84 + 18r) / y 142 (gui/container/brewing_stand.png).
// SlotBrewingStand (potion slots) accepts potions and glass bottles with a limit of 1; the ingredient slot accepts potion ingredients.
import { Container, Slot, StackArray } from "./inventory.js";
import { isPotionIngredient, isBottleOrPotion, INGREDIENT_SLOT } from "./brewing.js";

export const BREWING_TITLE = "Brewing Stand";
class IngredientSlot extends Slot { valid(s) { return !!s && isPotionIngredient(s); } }
class BottleSlot extends Slot {
  constructor(inv, index, x, y, owner) { super(inv, index, x, y); this.owner = owner; }
  get limit() { return 1; }
  valid(s) { return !!s && isBottleOrPotion(s); }
  // SlotBrewingStandPotion.onPickupFromSlot (zz's aab, bytecode-read): a potion item with damage > 0 (not the water bottle) awards the "potion" achievement, then Slot.onPickupFromSlot.
  onPickup(s) { if (s && s.id === POTION_ITEM && (s.damage ?? 0) > 0) this.owner.onPotionTaken?.(s); super.onPickup(s); }
}
const POTION_ITEM = 385;
export class BrewingContainer extends Container {
  // `view` is a BrewingStand (brewing.js brewingView) sharing the store record's slots.
  constructor(inv, view, onChange, title = BREWING_TITLE) {
    super(inv);
    this.stand = view;
    this.title = view.customName || title;
    this.onPotionTaken = null; // (stack) => void, set by the host: single player main.js, the dedicated server window (server-containers.js)
    this.tile = new StackArray(view.slots, onChange);
    this.addSlot(new BottleSlot(this.tile, 0, 56, 46, this));
    this.addSlot(new BottleSlot(this.tile, 1, 79, 53, this));
    this.addSlot(new BottleSlot(this.tile, 2, 102, 46, this));
    this.addSlot(new IngredientSlot(this.tile, INGREDIENT_SLOT, 79, 17));
    this.addPlayerSlots(8, 84);
  }
  // ContainerBrewingStand.transferStackInSlot: tile -> inventory (reverse 4-40); a potion ingredient goes to slot 3, a potion or bottle to 0-2.
  transfer(index) {
    return this.move(index, (s, slot, moved) => {
      if (index < 4) return this.merge(s, 4, 40, true);
      if (isPotionIngredient(s)) return this.merge(s, INGREDIENT_SLOT, INGREDIENT_SLOT + 1, false);
      if (isBottleOrPotion(s)) return this.merge(s, 0, 3, false);
      if (index >= 4 && index < 31) return this.merge(s, 31, 40, false);
      return !(index >= 31 && index < 40) || this.merge(s, 4, 31, false);
    });
  }
}
