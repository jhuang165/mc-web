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
      // BlockButton.onNeighborBlockChange (ajs.a, bytecode-read; the native chain is the 256 button cases of neighbor-chains-reference.json from the unchanged
      // classes): canPlaceBlockAt (x-1, x+1, z-1, z+1, first normal cube wins), then the metadata read and all four side reads before the single drop
      // test. A button that falls drops its item (dropBlockAsItem, chance 1, the three spawn floats) and is then cleared by setBlockToAir (flags 3), so the
      // neighbour notifications and, for a pressed button, BlockButton.breakBlock follow the drop.
      buttonNeighbor(id, x, y, z) {
        const cube = (dx, dz) => this.isNormalCube(this.getBlock(x + dx, y, z + dz));
        const fall = () => { this.dropBlockAsItem(id, x, y, z, this.getBlockMetadata(x, y, z), 0); this.setBlockToAir(x, y, z); };
        if (!(cube(-1, 0) || cube(1, 0) || cube(0, -1) || cube(0, 1))) return fall();
        const facing = this.getBlockMetadata(x, y, z) & 7;
        let loose = false;
        if (!cube(-1, 0) && facing === 1) loose = true;
        if (!cube(1, 0) && facing === 2) loose = true;
        if (!cube(0, -1) && facing === 3) loose = true;
        if (!cube(0, 1) && facing === 4) loose = true;
        if (loose) fall();
        return undefined;
      }
      // BlockTNT.onBlockAdded / onNeighborBlockChange (aob.b / aob.a): when indirectly powered, func_150114_a(meta 1) spawns an EntityTNTPrimed at the
      // block centre (fuse 80, igniter none; the native motion comes from Math.random and is not carried) with the primed sound, then the block is cleared.
      tntPowered(x, y, z) {
        if (!this.indirectlyPowered(x, y, z)) return;
        this.spawnEntity({ type: "PrimedTnt", x: x + 0.5, y: y + 0.5, z: z + 0.5, fuse: 80 });
        this.setBlockToAir(x, y, z);
      }
      // BlockDoor (64 wooden, 71 iron) onNeighborBlockChange as ItemDoor.func_150924_a triggers it: the
      // neighbour is the door itself, so only the support checks and the power reads run.
      neighborChanged(id, x, y, z, source) {
        if (REDSTONE_PUZZLE.has(id)) return area.relaxRedstone ? undefined : area.redstone.behaviours[id]?.onNeighborBlockChange?.(area.redstone, x, y, z, source);
        if (id === 77 || id === 143) return this.buttonNeighbor(id, x, y, z);
        if (id === 46) return this.tntPowered(x, y, z);
        if (id !== 64 && id !== 71) return super.neighborChanged(id, x, y, z, source);
        const meta = this.getBlockMetadata(x, y, z);
        if ((meta & 8) === 0) {
          let broke = false;
          if (this.getBlock(x, y + 1, z) !== id) { this.setBlockToAir(x, y, z); broke = true; }
          if (!this.solidTopAt(x, y - 1, z)) {
            this.setBlockToAir(x, y, z); broke = true;
            if (this.getBlock(x, y + 1, z) === id) this.setBlockToAir(x, y + 1, z);
          }
          // BlockDoor drops the door item (lower half only, chance 1) after the cells are cleared, as ahb.E (isRemote) is false.
          if (broke) { this.dropBlockAsItem(id, x, y, z, meta, 0); return undefined; }
          const powered = this.indirectlyPowered(x, y, z) || this.indirectlyPowered(x, y + 1, z);
          if (source !== id && (powered || POWER_SOURCES.includes(source))) this.doorSetOpen(x, y, z, powered);
        } else {
          if (this.getBlock(x, y - 1, z) !== id) this.setBlockToAir(x, y, z);
          if (source !== id) this.neighborChanged(id, x, y - 1, z, source);
        }
      }
      // BlockDoor.func_150014_a (akn.a(ahb, x, y, z, boolean), bytecode-read; the result is replayed against the native toggle records of
      // doors-panes-reference.json): the combined state (func_150012_g: this half's metadata, then the other half's), nothing when it already
      // matches, else the lower half's metadata with bit 4 flipped (flags 2); the 1003 door sound is a client aux effect.
      doorSetOpen(x, y, z, open) {
        const own = this.getBlockMetadata(x, y, z), upper = (own & 8) !== 0;
        const lowerMeta = upper ? this.getBlockMetadata(x, y - 1, z) : own;
        if (!upper) this.getBlockMetadata(x, y + 1, z);
        if (((lowerMeta & 4) !== 0) === open) return;
        this.setBlockMetadata(x, upper ? y - 1 : y, z, (lowerMeta & 7) ^ 4, 2);
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
        if ((id === 77 || id === 143) && (this.getBlockMetadata(x, y, z) & 8) === 0) return 0;
        // The other providers (lever, wire, torch, repeater, hook, ...) use the native-replayed behaviours of redstone.js on the area's own block store.
        if (POWER_SOURCES.includes(id)) {
          const behaviour = area.redstone?.behaviours[id], read = strong ? behaviour?.strong : behaviour?.weak;
          if (!behaviour) throw new Error(`structure redstone power from block ${id} is unported`);
          return read ? read(area.redstone, x, y, z, side) : 0;
        }
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
        if (id === 46) return this.tntPowered(x, y, z);
        if (id === 23 || id === 61 || id === 62) return this.containerFacing(x, y, z);
        return super.blockAdded(id, x, y, z);
      }
      // BlockButton.breakBlock only acts on a powered (metadata bit 8) button.
      breakBlock(id, x, y, z, meta) {
        // BlockButton.breakBlock (a pressed button only): notify the cell, then the cell it was attached to (func_150042_a).
        if (id === 77 || id === 143) {
          if ((meta & 8) === 0) return undefined;
          this.notifyNeighbors(x, y, z, id);
          const f = meta & 7;
          if (f === 1) this.notifyNeighbors(x - 1, y, z, id);
          else if (f === 2) this.notifyNeighbors(x + 1, y, z, id);
          else if (f === 3) this.notifyNeighbors(x, y, z - 1, id);
          else if (f === 4) this.notifyNeighbors(x, y, z + 1, id);
          else this.notifyNeighbors(x, y - 1, z, id);
          return undefined;
        }
        if (REDSTONE_PUZZLE.has(id)) return area.relaxRedstone ? undefined : area.redstone.behaviours[id]?.breakBlock?.(area.redstone, x, y, z, id, meta);
        return super.breakBlock(id, x, y, z, meta);
      }
      spawnEntity(e) {
        if (e.type === "MinecartChest") this.carts.push(e); else if (e.type === "PrimedTnt") (this.primedTnt ??= []).push(e); else this.animals.push(e);
        this.onEntity?.(e); return true;
      }
  };
}
