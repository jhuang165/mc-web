import java.lang.reflect.*;
import java.util.*;

// Batch 71 mpchunks: the REAL PlayerManager (mq) with its PlayerInstance (mr) and S21 (gx), driven without a server. The WorldServer (mt), the chunk provider (ms), the
// Chunk (apx) and the player's NetHandler (nh) are tiny subclasses made with Unsafe.allocateInstance (no constructor runs); PlayerManager's own code is unchanged.
//   * addPlayer(mq.a(mw)): the player's pending chunk list (EntityPlayerMP.loadedChunks, mw.f) after the x-outer / z-inner fill and PlayerManager.func_72691_b's spiral reorder
//   * updatePlayerInstances(mq.d(mw)): the S21 unload packets sent (coordinates in order) and the pending list afterwards
//   * a player's first chunks are drained from the front (as EntityPlayerMP.onUpdate would send them) before a move, so the reorder of the remainder is shown
// gz.c() is the S26 per-packet column cap. Prints one JSON line per case.
public class ChunkViewProbe {
  static sun.misc.Unsafe U;
  static List<int[]> sent = new ArrayList<>();
  @SuppressWarnings("unchecked") static <T> T make(Class<T> c) throws Exception { return (T) U.allocateInstance(c); }
  static void set(Object o, Class<?> c, String f, Object v) throws Exception { Field x = c.getDeclaredField(f); x.setAccessible(true); x.set(o, v); }
  static Object get(Object o, Class<?> c, String f) throws Exception { Field x = c.getDeclaredField(f); x.setAccessible(true); return x.get(o); }

  public static class FakeChunk extends apx { public FakeChunk() { super(null, 0, 0); } @Override public boolean k() { return true; } @Override public apz[] i() { return new apz[16]; } @Override public byte[] m() { return new byte[256]; } }
  public static class FakeProvider extends ms { public FakeProvider() { super(null, null, null); } @Override public apx c(int x, int z) { return null; } @Override public void b(int x, int z) { } }
  public static class FakeWorld extends mt { public FakeWorld() { super(null, null, null, 0, null, null); } @Override public apx e(int x, int z) { try { FakeChunk c = make(FakeChunk.class); set(c, apx.class, "e", this); set(c, apx.class, "g", x); set(c, apx.class, "h", z); return c; } catch (Exception e) { throw new RuntimeException(e); } } @Override public long I() { return 0; } }
  public static class FakeNet extends nh { public FakeNet() { super(null, null, null); }
    @Override public void a(ft packet) {
      try { if (packet instanceof gx) sent.add(new int[]{ (Integer) get(packet, gx.class, "a"), (Integer) get(packet, gx.class, "b"), ((Boolean) get(packet, gx.class, "g")) ? 1 : 0, (Integer) get(packet, gx.class, "c") }); } catch (Exception e) { throw new RuntimeException(e); }
    } }

  static mq manager(int radius) throws Exception {
    mq m = make(mq.class);
    FakeWorld w = make(FakeWorld.class); w.b = make(FakeProvider.class); set(w, ahb.class, "t", make(aqr.class));
    set(m, mq.class, "b", w); set(m, mq.class, "c", new ArrayList<>()); set(m, mq.class, "d", new qd()); set(m, mq.class, "e", new ArrayList<>()); set(m, mq.class, "f", new ArrayList<>());
    set(m, mq.class, "i", new int[][]{ {1, 0}, {0, 1}, {-1, 0}, {0, -1} });
    m.a(radius);
    return m;
  }
  static mw player(double x, double z) throws Exception {
    mw p = make(mw.class);
    set(p, mw.class, "f", new ArrayList<agu>()); p.a = make(FakeNet.class); p.s = x; p.u = z;
    return p;
  }
  static String queue(mw p) { StringBuilder s = new StringBuilder("["); boolean first = true; for (Object o : p.f) { agu a = (agu) o; if (!first) s.append(','); first = false; s.append(a.a + "," + a.b); } return s.append("]").toString(); }
  static String sentJson() { StringBuilder s = new StringBuilder("["); boolean first = true; for (int[] a : sent) { if (!first) s.append(','); first = false; s.append("[" + a[0] + "," + a[1] + "," + a[2] + "," + a[3] + "]"); } sent.clear(); return s.append("]").toString(); }

  // steps: {x, z, drain}: set the player there, drain `drain` chunks from the front of the pending list first, call mq.d
  static void run(String name, int radius, double sx, double sz, double[][] steps) throws Exception {
    mq m = manager(radius); mw p = player(sx, sz); sent.clear();
    m.a(p);
    StringBuilder out = new StringBuilder("{\"case\":\"" + name + "\",\"radius\":" + radius + ",\"start\":[" + sx + "," + sz + "],\"queue\":" + queue(p) + ",\"managed\":[" + p.d + "," + p.e + "],\"steps\":[");
    for (int i = 0; i < steps.length; i++) {
      for (int k = 0; k < (int) steps[i][2] && !p.f.isEmpty(); k++) p.f.remove(0);
      p.s = steps[i][0]; p.u = steps[i][1]; sent.clear();
      m.d(p);
      if (i > 0) out.append(',');
      out.append("{\"to\":[" + steps[i][0] + "," + steps[i][1] + "],\"drained\":" + (int) steps[i][2] + ",\"unload\":" + sentJson() + ",\"queue\":" + queue(p) + ",\"managed\":[" + p.d + "," + p.e + "]}");
    }
    System.out.println(out.append("]}"));
  }
  public static void main(String[] a) throws Exception {
    Field f = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); f.setAccessible(true); U = (sun.misc.Unsafe) f.get(null);
    System.out.println("{\"case\":\"constants\",\"javaVersion\":\"" + System.getProperty("java.version") + "\",\"bulk\":" + gz.c() + ",\"trackerLimit10\":" + mq.b(10) + "}");
    run("join3", 3, 8.5, 8.5, new double[][]{});
    run("join1clamp", 1, 40.5, -20.5, new double[][]{});
    run("negative", 3, -0.5, -0.5, new double[][]{});
    // under 8 blocks of movement: nothing; 8 blocks inside the same chunk: nothing and the managed position stays; a chunk step: unloads and loads
    run("moves", 3, 8.5, 8.5, new double[][]{ {15.9, 8.5, 0}, {16.4, 8.5, 0}, {16.6, 8.5, 0}, {24.6, 8.5, 0}, {24.6, 24.6, 7} });
    run("same-chunk-far", 3, 0.5, 8.5, new double[][]{ {8.6, 8.5, 0}, {8.6, 8.5, 0}, {16.5, 8.5, 0} });
    run("diagonal", 2, 8.5, 8.5, new double[][]{ {24.6, 24.6, 4}, {40.7, 8.5, 0} });
    run("negative-moves", 3, 3.5, 3.5, new double[][]{ {-8.5, 3.5, 0}, {-20.5, -12.5, 10} });
    run("jump", 3, 8.5, 8.5, new double[][]{ {200.5, 200.5, 3}, {-100.5, 8.5, 0} });
  }
}
