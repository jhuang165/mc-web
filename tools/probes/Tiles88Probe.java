// b88 tiles88: the inputs of BlockDaylightDetector.func_149957_e (akg.e) as WorldServer.tick (mt.b) feeds them, run on the unchanged
// 1.7.10 classes. For each world time t: World.calculateSkylightSubtracted(1.0F) (ahb.a(F)I) is computed with the clock at t (it runs
// before the clock moves), then the world time becomes t + 1 and TileEntityDaylightDetector.updateEntity's akg.e reads
// World.getCelestialAngleRadians(1.0F) (ahb.d(F)F -> ahb.c(F)F -> WorldProvider.calculateCelestialAngle, aqo.a(JF)F) and the saved sky light.
// Replaced: getSavedLightValue (a fixed sky value), getBlockMetadata / setBlockMetadataWithNotify (one recorded cell). Real: the World
// (allocated without its constructor), WorldInfo (ays, field h = world time), WorldProvider (aqo), MathHelper, BlockDaylightDetector.
// Output: one JSON line per case [t, rain, thunder, skylightSubtracted, angle radians float bits, signal at sky 15, 12, 7, 4].
// Run by tools/verify-tiles88.mjs; the records are public/research/tiles88-reference.json (src/tiles88-b88.test.js).
import java.lang.reflect.*;

public class Tiles88Probe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String n) throws Exception { for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {} throw new NoSuchFieldException(n); }
  static class Provider extends aqo { public String l() { return "probe"; } }
  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    int sky = 15, meta = -1, written = -1;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public int b(ahn type, int x, int y, int z) { return sky; }
    public int e(int x, int y, int z) { return meta; }
    public boolean a(int x, int y, int z, int m, int flags) { written = m; return true; }
  }
  public static void main(String[] args) throws Exception {
    Field u = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); u.setAccessible(true); unsafe = (sun.misc.Unsafe) u.get(null);
    aji.p(); adb.l(); // Block.registerBlocks, Item.registerItems
    akg sensor = (akg) aji.e(151);
    long[] times = new long[args.length > 0 ? args.length : 0];
    for (int i = 0; i < args.length; i++) times[i] = Long.parseLong(args[i]);
    float[][] weather = {{0f, 0f}, {1f, 0f}, {1f, 1f}, {0.5f, 0.25f}};
    StringBuilder out = new StringBuilder("[");
    boolean first = true;
    for (long t : times) for (float[] wx : weather) {
      W w = (W) unsafe.allocateInstance(W.class);
      Provider provider = new Provider(); provider.g = false;
      field(ahb.class, "t").set(w, provider);
      ays info = (ays) unsafe.allocateInstance(ays.class);
      field(ays.class, "h").setLong(info, t);
      field(ahb.class, "x").set(w, info);
      for (String f : new String[] {"m", "n"}) field(ahb.class, f).setFloat(w, wx[0]); // prevRainingStrength / rainingStrength (getRainStrength, ahb.j(F))
      for (String f : new String[] {"o", "p"}) field(ahb.class, f).setFloat(w, wx[1]); // prevThunderingStrength / thunderingStrength (getWeightedThunderStrength, ahb.h(F), times the rain)
      int sub = w.a(1.0F);
      field(ahb.class, "j").setInt(w, sub);
      field(ays.class, "h").setLong(info, t + 1);
      float rad = w.d(1.0F);
      StringBuilder row = new StringBuilder("[" + t + "," + wx[0] + "," + wx[1] + "," + sub + "," + Float.floatToIntBits(rad));
      for (int sky : new int[] {15, 12, 7, 4}) { w.sky = sky; w.meta = -1; w.written = -1; sensor.e(w, 0, 64, 0); row.append(",").append(w.written); }
      out.append(first ? "" : ",\n").append(row).append("]");
      first = false;
    }
    System.out.println(out.append("]"));
  }
}
