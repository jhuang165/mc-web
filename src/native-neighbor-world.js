// The generation-time block-callback world (doors, power reads, containers, the redstone family), split from structure-population-area.js so the
// browser population path imports it without that file's node:crypto hashing.
import { mineshaftGenWorldClass, POWER_SOURCES } from "./mineshaft-world.js";
import { StructureRedstone } from "./structure-redstone.js";

const SIDE_DX = [0, 0, 0, 0, -1, 1], SIDE_DY = [-1, 1, 0, 0, 0, 0], SIDE_DZ = [0, 0, -1, 1, 0, 0];
// Jungle temple redstone (sticky piston, wire, lever, repeater, tripwire hook and wire). With relaxRedstone
// their onBlockAdded / onNeighborBlockChange / breakBlock hooks are skipped: block writes stay exact only while
// nothing is powered, and the world-call stream is not claimed (see public/research/structure-area.md).
const REDSTONE_PUZZLE = new Set([29, 55, 69, 93, 131, 132]);
const key = (x, z) => `${x},${z}`;

// The block-callback world of a generation area: doors, power reads, containers and the redstone family run their native onBlockAdded /
// onNeighborBlockChange / breakBlock (see below). `area` supplies `relaxRedstone`, `redstone` (StructureRedstone) and `carts` / `animals` sinks
// through the world. Shared by StructurePopulationArea and the live PopulationArea (neighbours mode).
export function nativeNeighborWorldClass(area, Base = mineshaftGenWorldClass()) {
  return class extends Base {
      chunkExists() { return true; }
      // The web that a water spring washes away drops string in native World.
      dropBlockAsItem(id, x, y, z, meta, fortune) {
        if (id !== 30) return super.dropBlockAsItem(id, x, y, z, meta, fortune);
        if (this.rand.nextFloat() <= 1) this.spawnItem(x, y, z, 287, 1, 0);
      }
      // BlockButton.onNeighborBlockChange (ajs.a, bytecode-read and call-traced natively): canPlaceBlockAt (x-1, x+1, z-1, z+1, first normal cube wins), then the
      // metadata read and all four side reads before the single drop test. A button that would fall is not part of any generated structure.
      buttonNeighbor(x, y, z) {
        const cube = (dx, dz) => this.isNormalCube(this.getBlock(x + dx, y, z + dz));
        if (!(cube(-1, 0) || cube(1, 0) || cube(0, -1) || cube(0, 1))) throw new Error(`structure button fell at ${x},${y},${z}: its drop is unported`);
        const facing = this.getBlockMetadata(x, y, z) & 7;
        let loose = false;
        if (!cube(-1, 0) && facing === 1) loose = true;
        if (!cube(1, 0) && facing === 2) loose = true;
        if (!cube(0, -1) && facing === 3) loose = true;
        if (!cube(0, 1) && facing === 4) loose = true;
        if (loose) throw new Error(`structure button fell at ${x},${y},${z}: its drop is unported`);
      }
      // BlockDoor (64 wooden, 71 iron) onNeighborBlockChange as ItemDoor.func_150924_a triggers it: the
      // neighbour is the door itself, so only the support checks and the power reads run.
      neighborChanged(id, x, y, z, source) {
        if (REDSTONE_PUZZLE.has(id)) return area.relaxRedstone ? undefined : area.redstone.behaviours[id]?.onNeighborBlockChange?.(area.redstone, x, y, z, source);
        if (id === 77) return this.buttonNeighbor(x, y, z);
        if (id !== 64 && id !== 71) return super.neighborChanged(id, x, y, z, source);
        const meta = this.getBlockMetadata(x, y, z);
        if ((meta & 8) === 0) {
          let broke = false;
          if (this.getBlock(x, y + 1, z) !== id) { this.setBlockToAir(x, y, z); broke = true; }
          if (!this.solidTopAt(x, y - 1, z)) {
            this.setBlockToAir(x, y, z); broke = true;
            if (this.getBlock(x, y + 1, z) === id) this.setBlockToAir(x, y + 1, z);
          }
          if (broke) throw new Error(`structure door fell at ${x},${y},${z}: its drop is unported`);
          const powered = this.indirectlyPowered(x, y, z) || this.indirectlyPowered(x, y + 1, z);
          if (source !== id && (powered || POWER_SOURCES.includes(source))) throw new Error("structure door power change is unported");
        } else {
          if (this.getBlock(x, y - 1, z) !== id) this.setBlockToAir(x, y, z);
          if (source !== id) this.neighborChanged(id, x, y - 1, z, source);
        }
      }
      // World.isBlockIndirectlyGettingPowered (v), getIndirectPowerLevelTo (g), getBlockPowerInput (u) and
      // getStrongestIndirectPower side reads (e), with the power functions of the unpressed stone plate
      // (the only provider these structures leave next to a power query). Others stay unported.
      indirectlyPowered(x, y, z) {
        for (let side = 0; side < 6; side++) {
          if (this.indirectPowerLevelTo(x + SIDE_DX[side], y + SIDE_DY[side], z + SIDE_DZ[side], side) > 0) return true;
        }
        return false;
      }
      indirectPowerLevelTo(x, y, z, side) {
        if (this.isNormalCube(this.getBlock(x, y, z))) {
          let power = 0;
          for (let s = 0; s < 6; s++) {
            const ax = x + SIDE_DX[s], ay = y + SIDE_DY[s], az = z + SIDE_DZ[s], id = this.getBlock(ax, ay, az);
            power = Math.max(power, this.providedPower(id, ax, ay, az, s, true));
            if (power >= 15) return power;
          }
          return power;
        }
        return this.providedPower(this.getBlock(x, y, z), x, y, z, side, false);
      }
      providedPower(id, x, y, z, side, strong) {
        if (id === 70) return (!strong || side === 1) && this.getBlockMetadata(x, y, z) > 0 ? 15 : 0;
        // BlockButton.isProvidingWeakPower / StrongPower: a button not yet pressed (metadata bit 8 clear) gives nothing; the stronghold's is never pressed in generation.
        if (id === 77 && (this.getBlockMetadata(x, y, z) & 8) === 0) return 0;
        if (POWER_SOURCES.includes(id)) throw new Error(`structure redstone power from block ${id} is unported`);
        return 0;
      }
      // BlockFurnace.func_149930_e / BlockDispenser.func_149938_m: face away from an opaque side.
      containerFacing(x, y, z) {
        const op = (id) => this.isOpaqueCube(id);
        const north = this.getBlock(x, y, z - 1), south = this.getBlock(x, y, z + 1), west = this.getBlock(x - 1, y, z), east = this.getBlock(x + 1, y, z);
        let meta = 3;
        if (op(north) && !op(south)) meta = 3;
        if (op(south) && !op(north)) meta = 2;
        if (op(west) && !op(east)) meta = 5;
        if (op(east) && !op(west)) meta = 4;
        this.setBlockMetadata(x, y, z, meta, 2);
      }
      blockAdded(id, x, y, z) {
        // BlockContainer.onBlockAdded is only its super call; BlockFlowerPot adds nothing.
        if (id === 140) return undefined;
        if (REDSTONE_PUZZLE.has(id)) return area.relaxRedstone ? undefined : area.redstone.behaviours[id]?.onBlockAdded?.(area.redstone, x, y, z);
        // BlockTNT.onBlockAdded: a powered TNT block would prime itself; none is reachable in these structures.
        if (id === 46) { if (this.indirectlyPowered(x, y, z)) throw new Error("structure TNT power is unported"); return undefined; }
        if (id === 23 || id === 61 || id === 62) return this.containerFacing(x, y, z);
        return super.blockAdded(id, x, y, z);
      }
      // BlockButton.breakBlock only acts on a powered (metadata bit 8) button.
      breakBlock(id, x, y, z, meta) {
        if (id === 77 && (meta & 8) === 0) return undefined;
        if (REDSTONE_PUZZLE.has(id)) return area.relaxRedstone ? undefined : area.redstone.behaviours[id]?.breakBlock?.(area.redstone, x, y, z, id, meta);
        return super.breakBlock(id, x, y, z, meta);
      }
      spawnEntity(e) {
        if (e.type === "MinecartChest") this.carts.push(e); else this.animals.push(e);
        this.onEntity?.(e); return true;
      }
  };
}
