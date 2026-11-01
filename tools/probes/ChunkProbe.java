import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

// Records unchanged 1.7.10 chunk storage: NibbleArray (apv), ExtendedBlockStorage (apz), Chunk (apx)
// constructors/getters/setBlockMetadata, World.getBlock/getBlockMetadata (ahb) coordinate handling over a
// stub IChunkProvider, ChunkCoordIntPair (agu) keys/hashes and the Block registry's random-tick and
// Material.air flags. World is allocated without its constructor (sun.misc.Unsafe); only the fields the
// tested methods read are set. No game classes are patched. Output: one JSON record per line.
public class ChunkProbe {
  static sun.misc.Unsafe unsafe;

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static int geti(Object o, String name) throws Exception { return field(o.getClass(), name).getInt(o); }

  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); } // never run
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
  }

  // Serves fixed chunks for chunk coordinates in [-2, 1] and an EmptyChunk elsewhere; logs each request.
  public static class Provider implements apu {
    HashMap<Long, apx> chunks = new HashMap<>();
    List<String> requests = new ArrayList<>();
    ahb world;
    public boolean a(int x, int z) { return true; }
    public apx d(int x, int z) {
      requests.add("[" + x + "," + z + "]");
      apx c = chunks.get(agu.a(x, z));
      return c != null ? c : new apw(world, x, z);
    }
    public apx c(int x, int z) { return d(x, z); }
    public void a(apu p, int x, int z) {}
    public boolean a(boolean b, qk q) { return true; }
    public boolean d() { return false; }
    public boolean e() { return false; }
    public String f() { return "probe"; }
    public List a(sx t, int x, int y, int z) { return null; }
    public agt a(ahb w, String s, int x, int y, int z) { return null; }
    public int g() { return chunks.size(); }
    public void e(int x, int z) {}
    public void c() {}
  }

  static String hex(byte[] b) {
    StringBuilder s = new StringBuilder();
    for (byte v : b) s.append(String.format("%02x", v & 255));
    return s.toString();
  }
  static String arr(List<String> items) { return "[" + String.join(",", items) + "]"; }
  static String ints(int... v) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < v.length; i++) s.append(i > 0 ? "," : "").append(v[i]);
    return s.append("]").toString();
  }

  static int[] registered, ticking;
  static boolean isContainer(int id) { return aji.e(id) instanceof akw; }

  static void nibble(Random r, int size, int depth) {
    apv n = new apv(size, depth);
    int span = size >> (depth + 4); // y range
    List<String> ops = new ArrayList<>(), reads = new ArrayList<>();
    for (int i = 0; i < 400; i++) {
      int x = r.nextInt(16), y = r.nextInt(span), z = r.nextInt(1 << depth), v = r.nextInt(40) - 8;
      n.a(x, y, z, v);
      ops.add(ints(x, y, z, v));
    }
    for (int i = 0; i < 200; i++) {
      int x = r.nextInt(16), y = r.nextInt(span), z = r.nextInt(1 << depth);
      reads.add(ints(x, y, z, n.a(x, y, z)));
    }
    System.out.println("{\"kind\":\"nibble\",\"size\":" + size + ",\"depth\":" + depth + ",\"ops\":" + arr(ops) + ",\"reads\":" + arr(reads) + ",\"data\":\"" + hex(n.a) + "\"}");
  }

  static String sectionState(apz s) throws Exception {
    return ints(geti(s, "b"), geti(s, "c"), s.a() ? 1 : 0, s.b() ? 1 : 0);
  }

  // Ops: [0,x,y,z,id] setExtBlock; [1,x,y,z,v] meta; [2,x,y,z,v] skylight; [3,x,y,z,v] blocklight;
  // [4,index,byte] raw LSB array write; [5,x,y,z,v] raw MSB nibble (array created on demand); [6] removeInvalidBlocks.
  static void section(Random r, int yBase, boolean sky, int count, boolean raw) throws Exception {
    apz s = new apz(yBase, sky);
    List<String> ops = new ArrayList<>(), after = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      int x = r.nextInt(16), y = r.nextInt(16), z = r.nextInt(16), kind = r.nextInt(raw ? 8 : 5);
      int[] op;
      if (kind <= 1) {
        int id = r.nextInt(3) == 0 ? 0 : registered[r.nextInt(registered.length)];
        s.a(x, y, z, aji.e(id));
        op = new int[] {0, x, y, z, id};
      } else if (kind == 2) { int v = r.nextInt(20); s.a(x, y, z, v); op = new int[] {1, x, y, z, v}; }
      else if (kind == 3) {
        int v = r.nextInt(16);
        if (sky) { s.b(x, y, z, v); op = new int[] {2, x, y, z, v}; } else { s.c(x, y, z, v); op = new int[] {3, x, y, z, v}; }
      } else if (kind == 4) { int v = r.nextInt(16); s.c(x, y, z, v); op = new int[] {3, x, y, z, v}; }
      else if (kind == 5) { int idx = r.nextInt(4096), b = r.nextInt(256); s.g()[idx] = (byte) b; op = new int[] {4, idx, b}; }
      else if (kind == 6) { int v = r.nextInt(16); apv m = s.i(); if (m == null) m = s.m(); m.a(x, y, z, v); op = new int[] {5, x, y, z, v}; }
      else { s.e(); op = new int[] {6}; }
      ops.add(ints(op));
      String st = sectionState(s);
      after.add("[" + st.substring(1, st.length() - 1) + "," + x + "," + y + "," + z + "," + aji.b(s.a(x, y, z)) + "," + s.b(x, y, z) + "]");
    }
    List<String> reads = new ArrayList<>();
    for (int i = 0; i < 300; i++) {
      int x = r.nextInt(16), y = r.nextInt(16), z = r.nextInt(16);
      reads.add(ints(x, y, z, aji.b(s.a(x, y, z)), s.b(x, y, z), s.d(x, y, z), sky ? s.c(x, y, z) : -1));
    }
    System.out.println("{\"kind\":\"section\",\"yBase\":" + s.d() + ",\"sky\":" + sky + ",\"ops\":" + arr(ops) + ",\"after\":" + arr(after)
      + ",\"reads\":" + arr(reads) + ",\"lsb\":\"" + hex(s.g()) + "\",\"msb\":" + (s.i() == null ? "null" : "\"" + hex(s.i().a) + "\"")
      + ",\"hasSky\":" + (s.l() != null) + "}");
  }

  // Generation-array constructor apx(World, Block[], byte[], x, z): index x * k * 16 | z * k | y, k = length / 256.
  static apx chunkFrom(ahb w, int k, int cx, int cz, long seed, List<String> blocksOut, List<String> metaOut, double fill) {
    Random r = new Random(seed);
    aji[] blocks = new aji[256 * k];
    byte[] meta = new byte[256 * k];
    for (int i = 0; i < blocks.length; i++) {
      int y = i % k;
      boolean solid = r.nextDouble() < fill * (y < 20 ? 1 : 0.15);
      int id = solid ? registered[1 + r.nextInt(registered.length - 1)] : 0;
      if (solid && isContainer(id)) id = 1;
      blocks[i] = r.nextInt(50) == 0 ? null : aji.e(id);
      meta[i] = (byte) r.nextInt(16);
      if (blocksOut != null) { blocksOut.add(String.valueOf(blocks[i] == null ? -1 : id)); metaOut.add(String.valueOf(meta[i])); }
    }
    return new apx(w, blocks, meta, cx, cz);
  }

  static String chunkSummary(apx c) throws Exception {
    apz[] u = (apz[]) get(c, "u");
    List<String> secs = new ArrayList<>();
    for (int i = 0; i < u.length; i++)
      secs.add(u[i] == null ? "null" : "[" + u[i].d() + "," + geti(u[i], "b") + "," + geti(u[i], "c") + "," + (u[i].l() != null) + "]");
    return "\"sections\":" + arr(secs) + ",\"top\":" + c.h();
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();

    // ---- registry flags
    List<Integer> reg = new ArrayList<>(), tick = new ArrayList<>(), matAir = new ArrayList<>(), unregisteredReads = new ArrayList<>();
    for (int id = 0; id < 4096; id++) {
      aji b = aji.e(id);
      if (id == 0 || b != ajn.a) reg.add(id); else if (aji.b(b) != 0) unregisteredReads.add(id);
      if (b.t()) tick.add(id);
      if ((id == 0 || b != ajn.a) && b.o() == awt.a) matAir.add(id);
    }
    registered = reg.stream().mapToInt(Integer::intValue).toArray();
    ticking = tick.stream().mapToInt(Integer::intValue).toArray();
    List<String> containers = new ArrayList<>();
    for (int id : registered) if (isContainer(id)) containers.add(String.valueOf(id));
    System.out.println("{\"kind\":\"registry\",\"registered\":" + ints(registered) + ",\"ticking\":" + ints(ticking) + ",\"materialAir\":"
      + ints(matAir.stream().mapToInt(Integer::intValue).toArray()) + ",\"containers\":" + arr(containers)
      + ",\"unregisteredNonAir\":" + ints(unregisteredReads.stream().mapToInt(Integer::intValue).toArray()) + "}");

    Random r = new Random(17107);
    nibble(r, 4096, 4);
    nibble(r, 4096, 4);
    nibble(r, 32768, 7);

    section(r, 0, true, 600, false);
    section(r, 48, false, 600, false);
    section(r, 240, true, 900, true);
    section(r, 16, true, 2500, true);

    // ---- chunks
    W w = (W) unsafe.allocateInstance(W.class);
    set(w, "t", unsafe.allocateInstance(aqq.class)); // WorldProviderSurface: hasNoSky false
    for (int k : new int[] {64, 128, 256}) {
      List<String> blocks = new ArrayList<>(), meta = new ArrayList<>();
      apx c = chunkFrom(w, k, -3, 5, 900 + k, blocks, meta, k == 256 ? 0.05 : 0.6);
      List<String> reads = new ArrayList<>();
      Random rr = new Random(k);
      for (int i = 0; i < 400; i++) {
        int x = rr.nextInt(16), y = rr.nextInt(300), z = rr.nextInt(16);
        reads.add(ints(x, y, z, aji.b(c.a(x, y, z)), c.c(x, y, z)));
      }
      String negative;
      try { c.a(0, -1, 0); negative = "\"none\""; } catch (Throwable t) { negative = "\"" + t.getClass().getSimpleName() + "\""; }
      // setBlockMetadata: null section, unchanged, changed, masked >15 values; tile-entity blocks are excluded.
      List<String> metaOps = new ArrayList<>();
      for (int i = 0; i < 300; i++) {
        int x = rr.nextInt(16), y = rr.nextInt(k), z = rr.nextInt(16), v = rr.nextInt(24);
        if (isContainer(aji.b(c.a(x, y, z)))) continue;
        boolean res = c.a(x, y, z, v);
        metaOps.add(ints(x, y, z, v, res ? 1 : 0, c.c(x, y, z)));
      }
      System.out.println("{\"kind\":\"chunk\",\"k\":" + k + ",\"x\":" + c.g + ",\"z\":" + c.h + ",\"blocks\":" + arr(blocks) + ",\"meta\":" + arr(meta)
        + "," + chunkSummary(c) + ",\"reads\":" + arr(reads) + ",\"negativeY\":" + negative + ",\"metaOps\":" + arr(metaOps)
        + ",\"heightMap\":" + ints(c.f) + ",\"precipitation\":" + ints(c.b) + ",\"biomes\":\"" + hex(c.m()) + "\"}");
    }
    { // Block-array constructor apx(World, Block[], x, z): index x << 11 | z << 7 | y, skips Material.air blocks.
      Random cr = new Random(4242);
      aji[] blocks = new aji[32768];
      List<String> ids = new ArrayList<>();
      for (int i = 0; i < blocks.length; i++) {
        int id = cr.nextInt(4) == 0 ? registered[cr.nextInt(registered.length)] : 0;
        if (isContainer(id)) id = 4;
        blocks[i] = cr.nextInt(40) == 0 ? null : aji.e(id);
        ids.add(String.valueOf(blocks[i] == null ? -1 : id));
      }
      apx c = new apx(w, blocks, 2, -7);
      List<String> reads = new ArrayList<>();
      for (int i = 0; i < 600; i++) {
        int x = cr.nextInt(16), y = cr.nextInt(140), z = cr.nextInt(16);
        reads.add(ints(x, y, z, aji.b(c.a(x, y, z)), c.c(x, y, z)));
      }
      System.out.println("{\"kind\":\"blockChunk\",\"x\":2,\"z\":-7,\"blocks\":" + arr(ids) + "," + chunkSummary(c) + ",\"reads\":" + arr(reads) + "}");
    }

    // ---- World.getBlock / getBlockMetadata coordinate handling
    Provider prov = new Provider();
    prov.world = w;
    set(w, "v", prov);
    int[][] seeds = new int[4][4];
    for (int cx = -2; cx <= 1; cx++)
      for (int cz = -2; cz <= 1; cz++) prov.chunks.put(agu.a(cx, cz), chunkFrom(w, 64, cx, cz, 7000 + (cx + 2) * 4 + (cz + 2), null, null, 0.6));
    int[] xs = {-30000001, -30000000, -29999999, -33, -32, -17, -16, -15, -1, 0, 1, 15, 16, 17, 31, 29999999, 30000000};
    int[] ys = {-1, 0, 5, 19, 63, 64, 255, 256};
    List<String> lookups = new ArrayList<>();
    for (int x : xs) for (int z : xs) for (int y : ys) {
      prov.requests.clear();
      int id = aji.b(w.a(x, y, z));
      int before = prov.requests.size();
      int meta = w.e(x, y, z);
      lookups.add("[" + x + "," + y + "," + z + "," + id + "," + meta + "," + (prov.requests.isEmpty() ? "null" : prov.requests.get(0)) + "," + before + "]");
    }
    System.out.println("{\"kind\":\"world\",\"chunkSeeds\":7000,\"lookups\":" + arr(lookups) + "}");

    // ---- ChunkCoordIntPair keys and hashes
    int[] cs = {Integer.MIN_VALUE, -1875001, -1875000, -65536, -2, -1, 0, 1, 2, 65535, 1874999, 1875000, Integer.MAX_VALUE};
    List<String> keys = new ArrayList<>();
    for (int x : cs) for (int z : cs) {
      agu p = new agu(x, z);
      keys.add("[" + x + "," + z + ",\"" + agu.a(x, z) + "\"," + p.hashCode() + "]");
    }
    System.out.println("{\"kind\":\"keys\",\"keys\":" + arr(keys) + "}");
  }
}
