// Extra 1.7.10 block behaviour the village, stronghold and temple generators reach in a generation world
// (generation versions 14 and 15). Applied on top of mineshaftGenWorldClass(); the older versions never load it.
//
// Ported from the 1.7.10 classes: BlockDoor.onNeighborBlockChange, BlockSnow.onNeighborBlockChange / canPlaceBlockAt,
// BlockDispenser.onBlockAdded (facing from opaque neighbours), BlockChest.breakBlock (contents drop with the
// block's own unseeded Random, never World.rand, so nothing is drawn here).
//
// Inert approximations (limits, listed in the report): the redstone family a jungle temple places (wire, pistons,
// levers, tripwire and hooks) runs no onBlockAdded/neighbour logic. Nothing in a fresh temple is powered, so wire
// levels, piston states and hook "attached" bits stay 0; native tripwire onBlockAdded would set the hooks'
// attached bit.
const DOOR = 64, IRON_DOOR = 71, SNOW = 78, DISPENSER = 23, FURNACE = 61, CHEST = 54, ICE = 79, PACKED_ICE = 174, LEAVES = 18, LEAVES2 = 161;
const DOOR_ITEM = 324, IRON_DOOR_ITEM = 330, SNOWBALL = 332;
// Blocks whose onBlockAdded / onNeighborBlockChange / breakBlock only matter once something is powered.
const QUIET_ADDED = new Set([29, 33, 55, 69, 77, 93, 131, 132, 75, 76, 140]);
const QUIET_NEIGHBOR = new Set([23, 29, 33, 55, 69, 77, 131, 132, 75, 76, 140]);
const QUIET_BROKEN = new Set([23, 29, 33, 55, 69, 77, 131, 132, 64, 71, 78, 140]);

export function structureWorldClass(Base) {
  return class extends Base {
    // BlockDispenser.func_149938_m (checked against the 1.7.10 bytecode, akm.m) and BlockFurnace.func_149930_e: facing 3 (south) unless an opaque neighbour decides otherwise.
    dispenserFacing(x, y, z) {
      const op = (a, b, c) => this.isOpaqueCube(this.getBlock(a, b, c));
      const n = op(x, y, z - 1), s = op(x, y, z + 1), w = op(x - 1, y, z), e = op(x + 1, y, z);
      let facing = 3;
      if (n && !s) facing = 3;
      if (s && !n) facing = 2;
      if (w && !e) facing = 5;
      if (e && !w) facing = 4;
      this.setBlockMetadata(x, y, z, facing, 2);
    }
    blockAdded(id, x, y, z) {
      if (id === DISPENSER || id === FURNACE) return this.dispenserFacing(x, y, z);
      if (QUIET_ADDED.has(id)) return;
      return super.blockAdded(id, x, y, z);
    }
    // BlockSnow.canPlaceBlockAt.
    snowCanStay(x, y, z) {
      const id = this.getBlock(x, y - 1, z);
      if (id === ICE || id === PACKED_ICE) return false;
      if (id === LEAVES || id === LEAVES2) return true;
      if (id === SNOW && (this.getBlockMetadata(x, y - 1, z) & 7) === 7) return true;
      return this.isOpaqueCube(id) && this.blocksMovement(id);
    }
    // BlockDoor.onNeighborBlockChange; the redstone branch is inert (see the header).
    doorNeighbor(x, y, z, source) {
      const door = this.getBlock(x, y, z), meta = this.getBlockMetadata(x, y, z);
      if ((meta & 8) === 0) {
        let gone = false;
        if (this.getBlock(x, y + 1, z) !== door) { this.setBlockToAir(x, y, z); gone = true; }
        if (!this.solidTopAt(x, y - 1, z)) {
          this.setBlockToAir(x, y, z); gone = true;
          if (this.getBlock(x, y + 1, z) === door) this.setBlockToAir(x, y + 1, z);
        }
        if (gone) this.dropBlockAsItem(door, x, y, z, meta, 0);
        // else: a neighbour that can provide power (button, lever) only matters once something is powered; fresh
        // structures are unpowered, so func_150014_a would close an already closed door: nothing changes.
      } else {
        if (this.getBlock(x, y - 1, z) !== door) this.setBlockToAir(x, y, z);
        if (source !== door) this.doorNeighbor(x, y - 1, z, source);
      }
    }
    neighborChanged(id, x, y, z, source) {
      if (id === DOOR || id === IRON_DOOR) return this.doorNeighbor(x, y, z, source);
      if (id === SNOW) {
        if (!this.snowCanStay(x, y, z)) { this.dropBlockAsItem(SNOW, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); }
        return;
      }
      if (QUIET_NEIGHBOR.has(id)) return;
      return super.neighborChanged(id, x, y, z, source);
    }
    // Block.dropBlockAsItemWithChance at chance 1: door item (lower half only), snowballs per layer.
    dropBlockAsItem(id, x, y, z, meta, fortune) {
      if (id === DOOR || id === IRON_DOOR) { if ((meta & 8) === 0 && this.rand.nextFloat() <= 1) this.spawnItem(x, y, z, id === DOOR ? DOOR_ITEM : IRON_DOOR_ITEM, 1, 0); return; }
      if (id === SNOW) { for (let k = (meta & 7) + 1; k > 0; k--) if (this.rand.nextFloat() <= 1) this.spawnItem(x, y, z, SNOWBALL, 1, 0); return; }
      return super.dropBlockAsItem(id, x, y, z, meta, fortune);
    }
    breakBlock(id, x, y, z, meta) {
      if (id === CHEST) {
        const t = this.getTileEntity(x, y, z);
        if (t) this.notifyComparators(x, y, z, id);
        this.removeTileEntity(x, y, z);
        return;
      }
      if (QUIET_BROKEN.has(id)) return;
      return super.breakBlock(id, x, y, z, meta);
    }
  };
}
