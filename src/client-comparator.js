// Batch 60 (smallchecks2): BlockRedstoneComparator.onBlockActivated on the client world. Natively it runs on WorldClient with no isRemote guard (executed, ClientPredictProbe,
// 149 / 150 records), reading the neighbour power from the block ids and metadata the client holds (wire power level in its metadata, lever / button / plate metadata,
// repeater and torch block ids) and the comparator tile's output signal (from the description packet). The server then corrects with its own state.
// This builds a RedstoneWorld (the engine src/redstone.js, native-verified) whose storage is the client's world, so the input and side powers are computed from client data only:
//   world: the client view (get / getMeta / inside, internal ids); lit(x, y, z): the repeater is powered (the client knows block 94 from chunk data);
//   signal(x, y, z): the comparator tile's output the client was sent (optional; the steady state, the value the engine would settle on, is the stand-in).
// Tile-held inputs (chests, furnaces, jukeboxes, brewing stands) read 0 here, as on a client that has not opened them (tile contents are not in the description packets).
import { RedstoneWorld, comparatorReadings, AIR } from "./redstone.js";
import { toOriginal } from "./block-registry.js";
import { comparatorToggle } from "./comparator-toggle.js";

const REPEATER = 112;
const infoCache = new Map();
function info(id) {
  let c = infoCache.get(id);
  if (!c) {
    const a = toOriginal(id, 0, {});
    let fixed = a ? a[1] : null;
    for (let m = 1; a && m < 16; m++) if (toOriginal(id, m, {})[1] !== fixed) fixed = null;
    c = { orig: a ? a[0] : 0, fixed };
    infoCache.set(id, c);
  }
  return c;
}

class ClientRedstoneView extends RedstoneWorld {
  constructor(world, { lit = () => false, signal = null } = {}) {
    super({ seed: 0, log: false });
    this.view = world;
    this.litAt = lit;
    this.signalAt = signal;
    this.depth = 0;
  }
  getBlock(x, y, z) {
    const w = this.view;
    if (!w.inside(x, y, z) || (w.isLoaded && !w.isLoaded(x, z))) return AIR;
    const id = w.get(x, y, z);
    if (id === 0) return AIR;
    if (id === REPEATER) return this.litAt(x, y, z) ? 94 : 93;
    return info(id).orig;
  }
  getBlockMetadata(x, y, z) {
    const w = this.view;
    if (!w.inside(x, y, z) || (w.isLoaded && !w.isLoaded(x, z))) return 0;
    const id = w.get(x, y, z);
    if (id === 0) return 0;
    const c = info(id);
    return c.fixed !== null ? c.fixed : toOriginal(id, w.getMeta(x, y, z), {})[1];
  }
  // another comparator feeding this one: the tile output the client knows, else the steady-state output of that cell
  comparatorTile(x, y, z) {
    const known = this.signalAt?.(x, y, z);
    if (Number.isInteger(known)) return { signal: known };
    if (this.depth > 4) return { signal: 0 };
    this.depth++;
    try { return { signal: comparatorReadings(this, x, y, z, this.getBlockMetadata(x, y, z)).target }; } finally { this.depth--; }
  }
}

// The client's reading of the comparator at (x, y, z): the rear input, the larger side input, the output signal its tile holds, and the output after a mode toggle.
export function clientComparatorReadings(world, x, y, z, hooks = {}) {
  const view = new ClientRedstoneView(world, hooks), meta = view.getBlockMetadata(x, y, z), r = comparatorReadings(view, x, y, z, meta);
  const known = hooks.signal?.(x, y, z);
  return { input: r.input, side: r.side, tileOutput: Number.isInteger(known) ? known : r.target, view };
}

// The new metadata of a right-clicked comparator (block 149 / 150, internal ids as world.js) and the click sound, as the client draws them.
export function clientComparatorToggle(world, x, y, z, hooks = {}) {
  const block = world.get(x, y, z), meta = world.getMeta(x, y, z), { input, side, tileOutput, view } = clientComparatorReadings(world, x, y, z, hooks);
  const toggled = meta ^ 4; // the mode after the click; the output j(m') is the comparator output for that mode
  const output = comparatorReadings(view, x, y, z, toggled & 7).target;
  return { ...comparatorToggle(info(block).orig, meta, { input, side, tileOutput, output }), output }; // output: the OutputSignal the tile ends with (c() stores it)
}
