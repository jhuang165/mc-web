import java.lang.reflect.Field;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Batch 31 (rimlight3): the rim of the loaded chunk set, from the unchanged 1.7.10 World (ahb) and Chunk (apx) light code, with the same
// Provider / ChunkProviderServer.populate / server tick model as RimLightProbe (ops "gen", "load", "tick", "set"). Terrain over chunks
// -7..7 is loaded chunk by chunk, with one server tick (Chunk.o(), Chunk.func_150804_b(false), isRemote false) after each load, in stages
// so the chunks at the edge of the loaded set can be read before and after their neighbours load. A snapshot is, for each of the 15 x 15
// chunks, the sha256 of its sky light, block light and height map (an unloaded chunk reads the EnumSkyBlock default).
public class RimLightProbe {
  static sun.misc.Unsafe unsafe;
  static final int R = 7, LO = -R * 16, HI = R * 16 + 16;

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }

  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
  }
  static Map<Long, List<int[]>> decorations = new HashMap<>();
  public static class Provider implements apu {
    LinkedHashMap<Long, apx> chunks = new LinkedHashMap<>();
    ahb world;
    public boolean a(int x, int z) { return chunks.containsKey(agu.a(x, z)); }
    public apx d(int x, int z) { apx c = chunks.get(agu.a(x, z)); return c != null ? c : new apw(world, x, z); }
    public apx c(int x, int z) { return d(x, z); }
    // ChunkProviderServer.populate
    public void a(apu p, int x, int z) {
      apx c = d(x, z);
      if (!c.k) {
        c.p();
        List<int[]> list = decorations.get(agu.a(x, z));
        if (list != null) for (int[] s : list) world.d(s[0], s[1], s[2], aji.e(s[3]), s[4], 2);
        c.e();
      }
    }
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

  static W world;
  static Provider prov;
  static List<int[]> fills;
  static List<String> ops;
  static List<String> snaps;

  static void fill(int x0, int y0, int z0, int x1, int y1, int z1, int id, int meta) { fills.add(new int[] {x0, y0, z0, x1, y1, z1, id, meta}); }
  static void deco(int x, int y, int z, int id, int meta) { // into the population area of the chunk whose +8 offset square holds it
    long k = agu.a((x - 8) >> 4, (z - 8) >> 4);
    decorations.computeIfAbsent(k, q -> new ArrayList<>()).add(new int[] {x, y, z, id, meta});
  }

  static boolean nether = false;
  static void newWorld() throws Exception {
    world = (W) unsafe.allocateInstance(W.class);
    Object provider = unsafe.allocateInstance(nether ? aqp.class : aqq.class);
    if (nether) ((aqo) provider).b(); // registerWorldChunkManager: hasNoSky and isHellWorld from the real WorldProviderHell
    set(world, "t", provider);
    set(world, "C", new qi());
    set(world, "I", new int[32768]);
    set(world, "E", true);
    set(world, "u", new ArrayList<Object>());
    prov = new Provider();
    prov.world = world;
    set(world, "v", prov);
  }

  static apx gen(int cx, int cz) {
    aji[] blocks = new aji[65536];
    byte[] meta = new byte[65536];
    for (int[] f : fills) {
      int xa = Math.max(f[0], cx * 16), xb = Math.min(f[3], cx * 16 + 15), za = Math.max(f[2], cz * 16), zb = Math.min(f[5], cz * 16 + 15);
      for (int x = xa; x <= xb; x++) for (int z = za; z <= zb; z++) for (int y = f[1]; y <= f[4]; y++) {
        int i = ((x & 15) * 16 + (z & 15)) * 256 + y;
        blocks[i] = f[6] == 0 ? null : aji.e(f[6]);
        meta[i] = (byte) f[7];
      }
    }
    apx c = new apx(world, blocks, meta, cx, cz);
    c.b();
    if (nether) c.n(); // ChunkProviderHell.provideChunk: resetRelightChecks
    prov.chunks.put(agu.a(cx, cz), c);
    return c;
  }

  static String sha(byte[] b) throws Exception {
    byte[] d = MessageDigest.getInstance("SHA-256").digest(b);
    StringBuilder s = new StringBuilder();
    for (byte v : d) s.append(String.format("%02x", v & 255));
    return s.toString();
  }
  static String digests() throws Exception {
    StringBuilder out = new StringBuilder("\"chunks\":[");
    for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) {
      byte[] sky = new byte[65536], blk = new byte[65536], hm = new byte[512];
      int k = 0, h = 0;
      for (int x = cx * 16; x < cx * 16 + 16; x++) for (int z = cz * 16; z < cz * 16 + 16; z++) {
        for (int y = 0; y < 256; y++, k++) { sky[k] = (byte) world.b(ahn.a, x, y, z); blk[k] = (byte) world.b(ahn.b, x, y, z); }
        int hv = world.f(x, z);
        hm[h++] = (byte) (hv >> 8);
        hm[h++] = (byte) hv;
      }
      out.append(out.charAt(out.length() - 1) == '[' ? "" : ",").append("[").append(cx).append(",").append(cz).append(",\"").append(sha(sky).substring(0, 16)).append("\",\"").append(sha(blk).substring(0, 16)).append("\",\"").append(sha(hm).substring(0, 8)).append("\"]");
    }
    return out.append("]").toString();
  }

  static void op(String json) throws Exception {
    ops.add(json);
    String[] p = json.substring(1, json.length() - 1).split(",");
    String name = p[0].replace("\"", "");
    int[] a = new int[p.length - 1];
    if (!name.equals("snap")) for (int i = 1; i < p.length; i++) a[i - 1] = Integer.parseInt(p[i].trim());
    switch (name) {
      case "queue": set(world, "I", new int[a[0]]); break;
      case "gen": gen(a[0], a[1]); break;
      case "load": gen(a[0], a[1]).a(prov, prov, a[0], a[1]); break;
      case "terrain": for (apx c : prov.chunks.values()) c.k = true; break;
      case "tick":
        set(world, "E", false);
        for (apx c : new ArrayList<>(prov.chunks.values())) { c.o(); c.b(false); }
        set(world, "E", true);
        break;
      case "reset": for (apx c : prov.chunks.values()) c.n(); break;
      case "set": world.d(a[0], a[1], a[2], aji.e(a[3]), a[4], 2); break;
      case "snap": snaps.add("{\"label\":" + p[1] + "," + digests() + "}"); break;
      default: throw new IllegalArgumentException(name);
    }
  }
  static void gen() throws Exception { for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) op("[\"gen\"," + cx + "," + cz + "]"); }
  static void set(int x, int y, int z, int id, int meta) throws Exception { op("[\"set\"," + x + "," + y + "," + z + "," + id + "," + meta + "]"); }
  static void tick() throws Exception { op("[\"tick\"]"); }
  static void snap(String label) throws Exception { op("[\"snap\",\"" + label + "\"]"); }
  static void edit(int x, int y, int z, int id, int meta, String label) throws Exception { set(x, y, z, id, meta); tick(); snap(label); }

  static void begin() throws Exception {
    fills = new ArrayList<>(); ops = new ArrayList<>(); snaps = new ArrayList<>(); decorations = new HashMap<>();
    newWorld();
  }
  static String ints(int[] f) { StringBuilder s = new StringBuilder("["); for (int j = 0; j < f.length; j++) s.append(j > 0 ? "," : "").append(f[j]); return s.append("]").toString(); }
  static void end(String name) {
    StringBuilder s = new StringBuilder("{\"case\":\"" + name + "\",\"fills\":[");
    for (int i = 0; i < fills.size(); i++) s.append(i > 0 ? "," : "").append(ints(fills.get(i)));
    s.append("],\"decorations\":[");
    boolean first = true;
    for (Map.Entry<Long, List<int[]>> e : decorations.entrySet())
      for (int[] d : e.getValue()) { s.append(first ? "" : ",").append(ints(d)); first = false; }
    s.append("],\"ops\":[").append(String.join(",", ops)).append("],\"snaps\":[").append(String.join(",", snaps)).append("]}");
    System.out.println(s);
  }

  static void flat() {
    fill(-32, 0, -32, 47, 0, 47, 7, 0);
    fill(-32, 1, -32, 47, 58, 47, 1, 0);
    fill(-32, 59, -32, 47, 59, 47, 3, 0);
    fill(-32, 60, -32, 47, 60, 47, 2, 0);
  }
  // The Nether: bedrock floor and ceiling, netherrack with large caverns, a lava sea at y <= 31 in them; glowstone clusters and lava
  // sources (population) inside the caverns.
  static void terrainNether(long seed) {
    Random r = new Random(seed);
    fill(LO, 0, LO, HI - 1, 0, HI - 1, 7, 0);
    fill(LO, 1, LO, HI - 1, 126, HI - 1, 87, 0);
    fill(LO, 127, LO, HI - 1, 127, HI - 1, 7, 0);
    for (int k = 0; k < 150; k++) {
      int x = LO + 2 + r.nextInt(HI - LO - 30), z = LO + 2 + r.nextInt(HI - LO - 30), y = 4 + r.nextInt(90);
      fill(x, y, z, x + 6 + r.nextInt(20), y + 6 + r.nextInt(20), z + 6 + r.nextInt(20), 0, 0);
    }
    fill(LO, 1, LO, HI - 1, 31, HI - 1, 11, 0); // sea: replaces netherrack and air alike below y 32; keep the walls solid
    for (int k = 0; k < 40; k++) { int x = LO + r.nextInt(HI - LO - 10), z = LO + r.nextInt(HI - LO - 10); fill(x, 1, z, x + 8, 20, z + 8, 87, 0); }
    int span = (R * 2) * 16 - 24;
    for (int k = 0; k < 200; k++) {
      int x = LO + 8 + r.nextInt(span), z = LO + 8 + r.nextInt(span), y = 33 + r.nextInt(80), t = r.nextInt(3);
      deco(x, y, z, t == 0 ? 11 : 89, 0);
      if (t == 1) for (int d = 0; d < 6; d++) deco(x + r.nextInt(3) - 1, y + r.nextInt(3) - 1, z + r.nextInt(3) - 1, 89, 0);
    }
  }
  static void anchors() { for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) fill(cx * 16 + 15, 100, cz * 16 + 15, cx * 16 + 15, 100, cz * 16 + 15, 1, 0); }
  // A cavern under the grass (y 30..58 over x, z -12..28) with sky holes through the roof.
  static void cavern(Random r) {
    fill(-12, 30, -12, 28, 58, 28, 0, 0);
    int holes = 6 + r.nextInt(8);
    for (int k = 0; k < holes; k++) { int x = -10 + r.nextInt(36), z = -10 + r.nextInt(36); fill(x, 59, z, x + r.nextInt(3), 60, z + r.nextInt(3), 0, 0); }
  }
  static final int[] EDIT = {0, 0, 1, 1, 89, 89, 50, 20, 9, 18};

  // Seeded terrain over the whole area: 4 x 4 columns of stone/dirt/grass (some below sea level, so water), caves, floating slabs; trees,
  // torches, glowstone and lava go into the decoration lists (World.setBlock during population, only inside chunks -R..R-1 so they land in
  // loaded chunks).
  static void terrain(long seed) {
    Random r = new Random(seed);
    int n = (HI - LO) / 4;
    fill(LO, 0, LO, HI - 1, 0, HI - 1, 7, 0);
    int[][] h = new int[n][n];
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) h[i][j] = 52 + r.nextInt(14) + (((i / 6) + (j / 5)) % 3 == 0 ? r.nextInt(18) : 0);
    for (int i = 0; i < n; i++) for (int j = 0; j < n; j++) {
      int x0 = LO + i * 4, z0 = LO + j * 4;
      fill(x0, 1, z0, x0 + 3, h[i][j] - 2, z0 + 3, 1, 0);
      fill(x0, h[i][j] - 1, z0, x0 + 3, h[i][j] - 1, z0 + 3, 3, 0);
      fill(x0, h[i][j], z0, x0 + 3, h[i][j], z0 + 3, 2, 0);
      if (h[i][j] < 60) fill(x0, h[i][j] + 1, z0, x0 + 3, 60, z0 + 3, 9, 0);
    }
    for (int k = 0; k < 120; k++) {
      int x = LO + 4 + r.nextInt(HI - LO - 24), z = LO + 4 + r.nextInt(HI - LO - 12), y = 20 + r.nextInt(40);
      fill(x, y, z, x + 2 + r.nextInt(8), y + 1 + r.nextInt(3), z + 1 + r.nextInt(3), 0, 0);
    }
    for (int k = 0; k < 40; k++) {
      int x = LO + 4 + r.nextInt(HI - LO - 24), z = LO + 4 + r.nextInt(HI - LO - 24), y = 64 + r.nextInt(12);
      fill(x, y, z, x + 3 + r.nextInt(6), y + r.nextInt(2), z + 3 + r.nextInt(6), 1, 0);
    }
    int span = (R * 2) * 16 - 24;
    for (int k = 0; k < 260; k++) { // trees: trunk 5, a 5 x 5 canopy of two layers, a 3 x 3 cap
      int x = LO + 8 + r.nextInt(span), z = LO + 8 + r.nextInt(span), y = h[(x - LO) / 4][(z - LO) / 4] + 1;
      if (y < 61) continue;
      for (int dy = 0; dy <= 4; dy++) deco(x, y + dy, z, 17, 0);
      for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++) for (int dy = 3; dy <= 4; dy++) if (dx != 0 || dz != 0) deco(x + dx, y + dy, z + dz, 18, 0);
      for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) deco(x + dx, y + 5, z + dz, 18, 0);
    }
    for (int k = 0; k < 120; k++) {
      int x = LO + 8 + r.nextInt(span), z = LO + 8 + r.nextInt(span), y = 30 + r.nextInt(30), t = r.nextInt(3);
      deco(x, y, z, t == 0 ? 50 : t == 1 ? 89 : 11, t == 0 ? 5 : 0);
    }
    for (int k = 0; k < 60; k++) { // torches and glowstone on the surface, as villages and lamp posts would
      int x = LO + 8 + r.nextInt(span), z = LO + 8 + r.nextInt(span), y = h[(x - LO) / 4][(z - LO) / 4] + 1;
      deco(x, y, z, k % 2 == 0 ? 50 : 89, k % 2 == 0 ? 5 : 0);
    }
  }
  static void load(int lo, int hi, boolean spiralOrder) throws Exception { // chunks max(|cx|,|cz|) in lo..hi
    if (spiralOrder) {
      for (int ring = lo; ring <= hi; ring++) for (int cx = -ring; cx <= ring; cx++) for (int cz = -ring; cz <= ring; cz++)
        if (Math.max(Math.abs(cx), Math.abs(cz)) == ring) { op("[\"load\"," + cx + "," + cz + "]"); tick(); }
    } else {
      for (int cx = -hi; cx <= hi; cx++) for (int cz = -hi; cz <= hi; cz++)
        if (Math.max(Math.abs(cx), Math.abs(cz)) >= lo) { op("[\"load\"," + cx + "," + cz + "]"); tick(); }
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    for (long seed : new long[] {311, 312}) for (boolean spiral : new boolean[] {true, false}) {
      begin(); terrain(seed); anchors();
      load(0, 4, spiral);       // a 9 x 9 set, ticked after every load
      snap("loaded 4");
      for (int t = 0; t < 4; t++) tick();
      snap("ticked 4");
      load(5, 6, spiral);       // the set grows by two rings: the old rim gains neighbours
      snap("loaded 6");
      for (int t = 0; t < 4; t++) tick();
      snap("ticked 6");
      load(7, 7, spiral);
      snap("loaded 7");
      end("rim-" + seed + (spiral ? "-spiral" : "-xmajor"));
    }
    nether = true;
    for (boolean spiral : new boolean[] {true}) {
      begin(); terrainNether(313);
      load(0, 4, spiral); snap("loaded 4");
      load(5, 6, spiral); snap("loaded 6");
      load(7, 7, spiral); snap("loaded 7");
      for (int t = 0; t < 600; t++) tick();
      snap("aged 600");
      end("rim-313-nether-" + (spiral ? "spiral" : "xmajor"));
    }
  }
}
