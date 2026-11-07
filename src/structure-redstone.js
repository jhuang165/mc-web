// The redstone half of a generation-time structure world: RedstoneWorld (src/redstone.js, native-replayed) with the
// generation area's own block store as storage, so the jungle temple's wire, lever, repeater, sticky piston and tripwire
// blocks run their original onBlockAdded / onNeighborBlockChange / breakBlock while the temple is populated
// (StructurePopulationArea without relaxRedstone). Everything that reaches the store goes through the area world, so
// its write and call streams see the same setBlock / setBlockMetadata calls the native world would make; a rule the
// area cannot honour (an item drop, a pending tick it does not model) fails loudly rather than being skipped.
import { RedstoneWorld } from "./redstone.js";

export class StructureRedstone extends RedstoneWorld {
  constructor(area) {
    super({ seed: 0, log: false });
    this.area = area;
  }
  getBlock(x, y, z) { return this.area.getBlock(x, y, z); }
  getBlockMetadata(x, y, z) { return this.area.getBlockMetadata(x, y, z); }
  setBlock(x, y, z, id, meta, flags) { return this.area.setBlock(x, y, z, id, meta, flags); }
  setBlockMetadataWithNotify(x, y, z, meta, flags) { return this.area.setBlockMetadata(x, y, z, meta, flags); }
  notifyBlockOfNeighborChange(x, y, z, source) { this.area.notifyNeighbor(x, y, z, source); }
  scheduleBlockUpdate(x, y, z, id, delay, priority = 0) { this.area.scheduleBlockUpdate(x, y, z, id, delay, priority); }
  dropBlockAsItem(x, y, z, id, meta) { this.area.dropBlockAsItem(id, x, y, z, meta, 0); }
  playSoundEffect(x, y, z, name, volume, pitch) { this.area.playSound(x, y, z, name, volume, pitch); }
  setRaw() { throw new Error("structure redstone: raw writes are not part of generation"); }
}
