// Batch 59 (smallchecks): BlockRedstoneComparator.onBlockActivated (akc.a(ahb,III,yz,IFFF), bytecode-read) in full. src/client-prediction.js has the shortcut that matches the
// executed probe records (input unpowered); this is the whole rule for prediction5 to wire in.
//   m' = (subtract after toggle ? 4 : 0) | ((block is 150 || m & 8) ? 8 : 0) | (m & 3)      setBlockMetadataWithNotify(..., 2); the click plays random.click 0.3, pitch 0.55 into subtract else 0.5
//   then c(): output = j(m'); tileOutput = tile.getOutputSignal(); tile.setOutputSignal(output);
//     if (tileOutput == output && (m' & 4) != 0) stop;                       (entering subtract with an unchanged output keeps the lit bit)
//     else powered = shouldBePowered (a(): input >= 15 true, input 0 false, else sideInput == 0 or input >= sideInput);
//          lit = block is 150 || m' & 8; lit && !powered -> clear bit 8; !lit && powered -> set bit 8.
// input is the comparator input power, side the larger side input (0 when none).
export function comparatorShouldBePowered(input, side) {
  if (input >= 15) return true;
  if (input === 0) return false;
  return side === 0 || input >= side;
}
export function comparatorToggle(block, meta, { input = 0, side = 0, tileOutput = 0, output = 0 } = {}) {
  const subtract = !(meta & 4);
  let m = (subtract ? 4 : 0) | (block === 150 || meta & 8 ? 8 : 0) | (meta & 3);
  if (!(tileOutput === output && m & 4)) {
    const lit = block === 150 || (m & 8) !== 0, powered = comparatorShouldBePowered(input, side);
    if (lit && !powered) m &= ~8;
    else if (!lit && powered) m |= 8;
  }
  return { meta: m, sound: { name: "random.click", volume: 0.3, pitch: subtract ? 0.55 : 0.5 } };
}
