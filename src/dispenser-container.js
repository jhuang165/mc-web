// ContainerDispenser (aaz) over TileEntityDispenser (apb), Minecraft Java 1.7.10: nine tile slots in a 3 x 3 grid at
// (62 + 18c, 17 + 18r), then the 27 main and 9 hotbar slots at (8 + 18c, 84 + 18r) / y 142 (gui/container/dispenser.png).
// Shift-click moves a dispenser stack to the inventory (reverse: slots 9-44) and anything else into the dispenser (0-8).
import { Container, Slot, StackArray, copyStack } from "./inventory.js";

export const DISPENSER_SLOTS = 9;
export const newDispenser = () => ({ items: Array(DISPENSER_SLOTS).fill(null) });
// Inventory name of an unnamed dispenser (TileEntityDispenser.getInventoryName).
export const DISPENSER_TITLE = "Dispenser";
// TileEntityDropper.getInventoryName: container.dropper (the same ContainerDispenser screen).
export const DROPPER_TITLE = "Dropper";

export class DispenserContainer extends Container {
  constructor(inv, dispenser, onChange) {
    super(inv);
    this.dispenser = dispenser;
    this.tile = new StackArray(dispenser.items, onChange);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) this.addSlot(new Slot(this.tile, col + row * 3, 62 + col * 18, 17 + row * 18));
    this.addPlayerSlots(8, 84);
  }
  // ContainerDispenser.transferStackInSlot: like ContainerChest, the copy is returned without onPickup.
  transfer(index) {
    const slot = this.slots[index];
    if (!slot?.has) return null;
    const s = slot.stack, moved = copyStack(s);
    if (!(index < DISPENSER_SLOTS ? this.merge(s, DISPENSER_SLOTS, this.slots.length, true) : this.merge(s, 0, DISPENSER_SLOTS, false))) return null;
    if (s.count === 0) slot.put(null);
    else slot.changed();
    return moved;
  }
}
