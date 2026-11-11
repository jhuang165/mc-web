// EntityMinecartHopper (xr) pickup: TileEntityHopper.suckItemsIntoHopper over the cart (inventory above, else the first item
// entity in the box above) and the cart's own fallback over its box grown 0.25. Transfers use the shared hopper helpers
// (inventory-transfer.js); `host.transfer` is the Hoppers transfer host ({ world, items(), maxStack, chests(), ..., changed }).
// Verified in public/research/carts-reference.json (tools/probes/CartsProbe.java).
import { arrayAdapter, containerAt, containerPending, suckFromInventory, pickUpEntity, touch } from "./inventory-transfer.js";
import { HopperContainer } from "./hopper.js";

// EntityItem box: 0.25 wide and high (`y` is the bottom).
const itemBox = (e) => [e.x - 0.125, e.y, e.z - 0.125, e.x + 0.125, e.y + 0.25, e.z + 0.125];
const overlap = (a, b) => a[3] > b[0] && a[0] < b[3] && a[4] > b[1] && a[1] < b[4] && a[5] > b[2] && a[2] < b[5];
const firstItem = (host, box) => (host.items?.() ?? []).find((e) => !e.dead && e.stack && overlap(itemBox(e), box)) ?? null;

// EntityMinecartHopper.suck: true only when the inventory above gave an item or an item entity in the block above the
// cart was taken whole; the 0.25 fallback takes entities but always answers false.
export function hopperSuck(cart, host) {
  const transfer = host?.transfer;
  if (!transfer) return false;
  // A cart in a headless ring column (carts tick there, ringEntityActive) reaches containers and items there like in the window; a
  // held column whose stored edits are not applied yet would read stale blocks, so the cart waits (natively the chunk is loaded).
  const ring = transfer.world?.ringSink;
  if (ring && transfer.world.ringReads && !ring.writable(cart.x, cart.z)) return false;
  const maxStack = transfer.maxStack, inv = arrayAdapter("", cart.slots, { keys: [], cart });
  const x = Math.floor(cart.x), y = Math.floor(cart.posY) + 1, z = Math.floor(cart.z);
  if (containerPending(transfer, x, y, z, `cart${cart.id ?? ""}@${x},${y},${z}`)) return false; // the saved containers above are still loading: wait, do not fall back to items
  const above = containerAt(transfer, x, y, z);
  let got = false;
  if (above) { got = suckFromInventory(inv, above, maxStack); if (got) touch(transfer, inv, above); }
  else {
    const e = firstItem(transfer, [cart.x, cart.posY + 1, cart.z, cart.x + 1, cart.posY + 2, cart.z + 1]);
    if (e && pickUpEntity(inv, e, maxStack)) { e.dead = true; got = true; touch(transfer, inv); }
  }
  if (got) return true;
  const b = cart.bb, e = firstItem(transfer, [b[0] - 0.25, b[1], b[2] - 0.25, b[3] + 0.25, b[4], b[5] + 0.25]);
  if (e && pickUpEntity(inv, e, maxStack)) { e.dead = true; touch(transfer, inv); }
  return false;
}

// displayGUIHopperMinecart: ContainerHopper over the cart's five slots, titled "Minecart" (container.minecart).
export function hopperCartContainer(cart, playerInventory, onChange) {
  const c = new HopperContainer(playerInventory, { items: cart.slots, name: cart.customName || "Minecart" }, onChange);
  c.cart = cart; c.kind = "hopper";
  return c;
}
