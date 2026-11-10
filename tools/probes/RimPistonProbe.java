import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;

// Batch 41 (ringpiston): what does a piston at the edge of the loaded area see? Runs the unchanged 1.7.10 World.getBlock (ahb.a(III)),
// ChunkProviderServer (ms) provideChunk/loadChunk and BlockPistonBase.canExtend (app.h(World,x,y,z,facing), private static) with a real
// block registry. Doubles: a constructor-less WorldServer, an IChunkLoader holding one saved chunk, and a generator that builds a chunk
// with a stone block (x 0..15, y 0..63) per chunk. Each scene asks canExtend for a piston at (14, 63, 5) facing +x (5): the line runs over
// the stone top at y 63, 13 cells x 15..27, so a loaded stone chunk (1,0) makes the line too long (false) while air makes it true. Chunk (1,0) starts unloaded. Records the chunk events, the block read through the provider, the canExtend answer and the loaded set after.
public class RimPistonProbe {
  static sun.misc.Unsafe unsafe;
  static List<String> events = new ArrayList<>();
  static mt world;
  static ms provider;
  static aji STONE, AIR;

  static Field field(Class<?> c, String name) throws Exception { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; }

  public static class WS extends mt {
    WS() { super(null, null, null, 0, null, null); }
    protected void a() {}
  }
  public static class Provider extends aqq { public boolean e() { return true; } }

  // Chunk of stone at x in [from, 16) (z 0..15, y 0..63), air elsewhere; `air` leaves the chunk empty.
  static apx chunk(ahb w, int cx, int cz, int from, boolean air) {
    apx c = new apx(w, cx, cz);
    if (!air) for (int x = from; x < 16; x++) for (int z = 0; z < 16; z++) for (int y = 0; y < 64; y++) c.a(x, y, z, STONE, 0);
    return c;
  }
  public static class Loader implements aqc {
    boolean saved; // chunk (1,0) exists on disk: stone from x 0 up (a stone wall at x 16..)
    public apx a(ahb w, int x, int z) {
      boolean hit = saved && x == 1 && z == 0;
      events.add("L " + x + " " + z + " " + (hit ? 1 : 0));
      return hit ? chunk(w, x, z, 0, false) : null;
    }
    public void a(ahb w, apx c) {}
    public void b(ahb w, apx c) {}
    public void a() {}
    public void b() {}
  }
  public static class Gen implements apu {
    public boolean a(int x, int z) { return true; }
    public apx d(int x, int z) { events.add("G " + x + " " + z); return chunk(world, x, z, 0, false); }
    public apx c(int x, int z) { return d(x, z); }
    public void a(apu p, int x, int z) { events.add("P " + x + " " + z); }
    public boolean a(boolean b, qk q) { return true; }
    public boolean d() { return false; }
    public boolean e() { return true; }
    public String f() { return "gen"; }
    public List a(sx t, int x, int y, int z) { return null; }
    public agt a(ahb w, String s, int x, int y, int z) { return null; }
    public int g() { return 0; }
    public void e(int x, int z) { events.add("R " + x + " " + z); }
    public void c() {}
  }

  static String loaded() {
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : provider.a()) { apx c = (apx) o; s.append(first ? "" : ",").append("[").append(c.g).append(",").append(c.h).append("]"); first = false; }
    return s.append("]").toString();
  }
  static String q(String s) { return "\"" + s + "\""; }

  // generated: chunk (1,0) is not on disk; saved: it is; emptyOnProvide: ChunkProviderServer.loadChunkOnProvideRequest = false.
  static String scene(String name, boolean saved, boolean loadOnProvide, boolean readFirst) throws Exception {
    world = (WS) unsafe.allocateInstance(WS.class);
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList<>()); }
    Provider p = new Provider(); p.g = true; p.b = world;
    field(ahb.class, "t").set(world, p);
    ays info = (ays) unsafe.allocateInstance(ays.class);
    field(ays.class, "d").set(info, 0); field(ays.class, "e").set(info, 64); field(ays.class, "f").set(info, 0);
    field(ahb.class, "x").set(world, info);
    Loader loader = new Loader(); loader.saved = saved;
    provider = new ms(world, loader, new Gen());
    field(ahb.class, "v").set(world, provider);
    field(mt.class, "b").set(world, provider);
    provider.a = loadOnProvide;
    events.clear();
    // chunk (0,0): the piston's own chunk, loaded the normal way (a stone floor, piston and line above it)
    provider.c(0, 0);
    apx home = provider.d(0, 0);
    events.clear();
    Method canExtend = app.class.getDeclaredMethod("h", ahb.class, int.class, int.class, int.class, int.class);
    canExtend.setAccessible(true);
    String before = loaded();
    aji seen = readFirst ? world.a(16, 63, 5) : null;
    String seenName = seen == null ? "null" : seen == STONE ? "stone" : seen == AIR ? "air" : "other";
    boolean ext = (boolean) canExtend.invoke(null, world, 14, 63, 5, 5);
    String after = loaded();
    return "{\"name\":" + q(name) + ",\"saved\":" + saved + ",\"loadChunkOnProvideRequest\":" + loadOnProvide + ",\"loadedBefore\":" + before
      + ",\"blockAt16_63_5\":" + q(seenName) + ",\"canExtend\":" + ext + ",\"loadedAfter\":" + after
      + ",\"events\":[" + String.join(",", events.stream().map(RimPistonProbe::q).toList()) + "]}";
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    STONE = aji.e(1); AIR = aji.e(0);
    System.out.println(scene("generated", false, true, true));
    System.out.println(scene("saved", true, true, false));
    System.out.println(scene("providerEmpty", true, false, true));
  }
}
