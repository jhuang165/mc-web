// Container titles and GUI labels through the selected language (localization round 2). The port builds container titles as English
// literals (chest.js, dispenser-container.js, hopper.js ...); the default English title of each 1.7.10 container maps to its
// IInventory.getInventoryName lang key (tools/probes/ItemKeyProbe.java did not cover these; the keys are bytecode-read from
// ContainerXxx/GuiXxx and checked against en_US.lang in container-names.test.js). A custom name (anvil name tag, named chest)
// is shown unchanged, except that a custom name identical to a default English title is localized too (known edge).
import { translate } from "./lang.js";

export const CONTAINER_KEYS = Object.freeze({
  "Inventory": "container.inventory", "Crafting": "container.crafting", "Furnace": "container.furnace",
  "Repair & Name": "container.repair", "Enchant": "container.enchant", "Chest": "container.chest", "Large Chest": "container.chestDouble",
  "Ender Chest": "container.enderchest", "Dispenser": "container.dispenser", "Dropper": "container.dropper",
  "Item Hopper": "container.hopper", "Brewing Stand": "container.brewing", "Minecart": "container.minecart",
  "Villager": "entity.Villager.name", "Beacon": "tile.beacon.name", "Item Selection": "container.creative",
});
/** Title shown for a container whose default English title is `title`. */
export const containerTitle = (title) => (CONTAINER_KEYS[title] ? translate(CONTAINER_KEYS[title], title) : title);
