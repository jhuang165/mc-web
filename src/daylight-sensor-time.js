// b88 tiles88: the clock inputs of BlockDaylightDetector.func_149957_e (akg.e) as the native server feeds them (bytecode-read; executed by
// tools/probes/Tiles88Probe.java, records in public/research/tiles88-reference.json):
//  * TileEntityDaylightDetector.updateEntity (apa.h) refreshes only when World.getTotalWorldTime() % 20 == 0 (ahb.I, the total time /time set
//    and doDaylightCycle do not move), not the world time.
//  * WorldServer.tick (mt.b) computes skylightSubtracted (ahb.j = ahb.a(1.0F)) from the world time before it adds 1, then the tile entities
//    read getCelestialAngleRadians(1.0F) (ahb.d: getCelestialAngle * 3.1415927F * 2.0F, in float) at the new world time.
import { celestialAngle } from "./clock.js";
import { skylightSubtracted } from "./lighting.js";
import { refreshDaylightSensor } from "./redstone.js";

const f = Math.fround, PI_F = f(Math.PI);
// World.getCelestialAngleRadians (ahb.d(F)F) of a celestial angle in [0, 1): two float products.
export const celestialRadians = (angle) => f(f(f(angle) * PI_F) * 2);
// TileEntityDaylightDetector.updateEntity's gate, on the total world time.
export const sensorDue = (totalTime) => Number.isFinite(totalTime) && totalTime % 20 === 0;
// The angle (in [0, 1)) and skylightSubtracted a sensor reads during the tile entity pass of the tick whose world time is now `worldTime`
// (after WorldServer.tick's increment; `cycling` is gamerule doDaylightCycle, false when the clock did not move). `rain` and `thunder` are
// getRainStrength(1.0F) and getWeightedThunderStrength(1.0F) after this tick's weather update.
export function sensorSky(worldTime, cycling = true, rain = 0, thunder = 0) {
  return { angle: celestialAngle(worldTime, 1), subtracted: skylightSubtracted(celestialAngle(cycling ? worldTime - 1 : worldTime, 1), rain, thunder) };
}
// One Tiles88Probe record [t, rain, thunder (the raw strength; getWeightedThunderStrength is thunder * rain), skylightSubtracted, radians float bits, signal at sky 15, 12, 7, 4] rebuilt by the port:
// sensorSky for the tick that ends at world time t + 1, then redstone.js refreshDaylightSensor on a one-cell stub.
export function replaySensorRecord([t, rain, thunder]) {
  const { angle, subtracted } = sensorSky(t + 1, true, rain, f(thunder * rain)), radians = celestialRadians(angle), bits = new DataView(new ArrayBuffer(4));
  bits.setFloat32(0, radians);
  const signals = [15, 12, 7, 4].map((sky) => {
    const w = { sky, skylightSubtracted: subtracted, celestialAngle: radians, noSky: false, meta: -1, getBlockMetadata: () => w.meta, setBlockMetadataWithNotify: (_x, _y, _z, m) => { w.meta = m; } };
    refreshDaylightSensor(w, 0, 64, 0);
    return w.meta;
  });
  return [t, rain, thunder, subtracted, bits.getInt32(0), ...signals];
}
