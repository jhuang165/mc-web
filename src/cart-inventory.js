// TileEntityHopper.func_145893_b (getInventoryAtPosition), entity half (bytecode-read, api.b(ahb, DDD)): when the block cell holds no inventory
// tile (or a chest closed from above, ajx.m -> null), the world's entities in the cell box (x, y, z, x + 1, y + 1, z + 1) are searched with
// IEntitySelector.selectInventories (sm: `instanceof IInventory && isEntityAlive`); one is picked with World.rand.nextInt(size) when there
// are several. Only EntityMinecartContainer is an IInventory in 1.7.10, so that is the chest minecart (type 1) and the hopper minecart (type 5).
// The same lookup serves hoppers (the pull from above and the push out), droppers and the hopper cart's own pull. `containerAt` calls it
// through `host.cartAt(x, y, z)`.
const CONTAINER_TYPES = new Set([1, 5]), STACK_LIMIT = 64;
const clamp = (s) => { if (s && s.count > STACK_LIMIT) s.count = STACK_LIMIT; return s; };

// Entity.boundingBox.intersectsWith(cell box): strict overlap on every axis.
export const cartInCell = (cart, x, y, z) => {
  const b = cart.bb;
  return !cart.dead && !!b && CONTAINER_TYPES.has(cart.type) && b[3] > x && b[0] < x + 1 && b[4] > y && b[1] < y + 1 && b[5] > z && b[2] < z + 1;
};

// The cart's slots as an inventory adapter (inventory-transfer.js). A slot holding an item the browser cannot show (`unmapped`) is closed to
// insertion and unreadable; it has no block key, so comparators beside the cart read it through the cart system, not through `changed`.
export function cartAdapter(cart) {
  return {
    key: `cart${cart.id ?? ""}`, keys: [], size: cart.slots.length, sides: null, cart,
    get: (i) => cart.slots[i] ?? null,
    set: (i, s) => { cart.slots[i] = clamp(s); },
    valid: (i) => !cart.unmapped?.[i],
  };
}

// `carts`: the dimension's cart list; `pick(n)`: World.rand.nextInt(n) (defaults to Math.random).
export function cartInventoryAt(carts, x, y, z, pick = (n) => Math.floor(Math.random() * n)) {
  const found = (carts ?? []).filter((c) => cartInCell(c, x, y, z));
  if (!found.length) return null;
  return cartAdapter(found.length === 1 ? found[0] : found[pick(found.length)]);
}
