import java.lang.reflect.Field;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// The third light-engine probe (batch 27). Same driver as LightEngine2Probe (read its header for the ops), with a 7 x 7 chunk square (R = 3,
// digests over x, z -48..63) so edits near the outer ring run with every chunk within 17 blocks loaded, as the native server has them, and with
// the real provider classes: WorldProviderSurface (aqq), WorldProviderHell (aqp) and WorldProviderEnd (aqr), each registered through its own
// registerWorldChunkManager (b()), so the hasNoSky / isHellWorld flags and lightBrightnessTable come from the unchanged classes.
//
// (batch 25 header follows) The second light-engine probe (batch 25): the unchanged 1.7.10 World / Chunk light code, as in LightEngineProbe, driven by a script of
// operations so chunks can be loaded one at a time:
//   ["queue", n]        World.lightUpdateBlockList = new int[n] (updateLightByType reads its length; both World constructors use 32768)
//   ["gen", cx, cz]     the generator's provideChunk: new Chunk(world, blocks, meta, cx, cz) from the fills, then generateSkylightMap
//   ["load", cx, cz]    ChunkProviderServer.loadChunk: "gen", then Chunk.populateChunk(provider, provider, cx, cz); the provider's
//                       populate is ChunkProviderServer.populate: Chunk.func_150809_p, then the chunk's decoration list through
//                       World.setBlock (flag 2), standing in for the generator's populate
//   ["terrain"]         isTerrainPopulated = true on every loaded chunk (LightEngineProbe's settle)
//   ["tick"]            WorldServer.func_147456_g's light work on every loaded chunk in load order: func_147467_a's
//                       enqueueRelightChecks (Chunk.o()), then func_150804_b(false), with isRemote false
//   ["reset"]           Chunk.resetRelightChecks (n()) on every loaded chunk (NetHandlerPlayClient and the End provider call it)
//   ["set", x, y, z, id, meta]  World.setBlock(x, y, z, block, meta, 2) with isRemote true (no block callbacks)
//   ["snap", label]     digests of World.getSavedLightValue (sky, block) over x, z -32..47 and y 0..255, and World.getHeightValue
// isRemote is true outside "tick" (setBlock then skips onBlockAdded / breakBlock). Chunks live in a LinkedHashMap, so ticks run in load
// order. One JSON record per scenario: {case, fills, decorations, ops, snaps}.
public class LightEngine3Probe {
  static sun.misc.Unsafe unsafe;
  static final int R = 3, LO = -48, HI = 64;

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

  static String kind = "overworld";
  static Object provider;
  static void newWorld() throws Exception {
    world = (W) unsafe.allocateInstance(W.class);
    provider = unsafe.allocateInstance(kind.equals("nether") ? aqp.class : kind.equals("end") ? aqr.class : aqq.class);
    if (!kind.equals("overworld")) ((aqo) provider).b(); // registerWorldChunkManager: the flags and dimension id of the real provider
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
    int n = (HI - LO) * (HI - LO);
    byte[] sky = new byte[n * 256], blk = new byte[n * 256], hm = new byte[n * 2];
    int k = 0, h = 0;
    for (int x = LO; x < HI; x++) for (int z = LO; z < HI; z++) {
      for (int y = 0; y < 256; y++, k++) { sky[k] = (byte) world.b(ahn.a, x, y, z); blk[k] = (byte) world.b(ahn.b, x, y, z); }
      int hv = world.f(x, z);
      hm[h++] = (byte) (hv >> 8);
      hm[h++] = (byte) hv;
    }
    return "\"sky\":\"" + sha(sky) + "\",\"block\":\"" + sha(blk) + "\",\"heights\":\"" + sha(hm) + "\"";
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

  static void begin() throws Exception { begin("overworld"); }
  static void begin(String k) throws Exception {
    kind = k;
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
    s.append("],\"ops\":[").append(String.join(",", ops)).append("],\"snaps\":[").append(String.join(",", snaps)).append("],\"provider\":").append(providerJson()).append("}");
    System.out.println(s);
  }
  // The flags and tables of the provider the scenario ran on: aqo.f, aqo.g, dimensionId (aqo.i), World.getActualHeight (S()) and
  // WorldProvider.lightBrightnessTable (aqo.h), which generateLightBrightnessTable (a()) fills.
  // World.getSavedLightValue(sky) down one column of the settled scenario: [y, value] at section boundaries and around the heightMap.
  static String skySamples() throws Exception {
    StringBuilder t = new StringBuilder("[");
    int[][] cols = {{0, 0}, {40, 8}, {-45, -8}, {8, 8}};
    for (int[] c : cols) for (int y : new int[] {0, 1, 40, 41, 50, 70, 100, 126, 127, 128, 129, 150, 200, 255}) t.append(t.length() > 1 ? "," : "").append("[").append(c[0]).append(",").append(y).append(",").append(c[1]).append(",").append(world.b(ahn.a, c[0], y, c[1])).append(",").append(world.f(c[0], c[1])).append("]");
    return t.append("]").toString();
  }
  static String providerJson() {
    try {
      boolean f = (Boolean) field(provider.getClass(), "f").get(provider), g = (Boolean) field(provider.getClass(), "g").get(provider);
      int id = (Integer) field(provider.getClass(), "i").get(provider);
      java.lang.reflect.Method gen = null;
      for (Class<?> c = provider.getClass(); c != null && gen == null; c = c.getSuperclass()) try { gen = c.getDeclaredMethod("a"); } catch (NoSuchMethodException e) {}
      gen.setAccessible(true);
      set(provider, "h", new float[16]);
      gen.invoke(provider);
      float[] h = (float[]) field(provider.getClass(), "h").get(provider);
      StringBuilder t = new StringBuilder("[");
      for (int i = 0; i < 16; i++) t.append(i > 0 ? "," : "").append(Float.floatToIntBits(h[i]));
      return "{\"kind\":\"" + kind + "\",\"f\":" + f + ",\"g\":" + g + ",\"dimensionId\":" + id + ",\"actualHeight\":" + world.S() + ",\"skySamples\":" + skySamples() + ",\"brightnessBits\":" + t + "]}";
    } catch (Exception e) { throw new RuntimeException(e); }
  
  }

  static void flat() {
    fill(LO, 0, LO, HI - 1, 0, HI - 1, 7, 0);
    fill(LO, 1, LO, HI - 1, 58, HI - 1, 1, 0);
    fill(LO, 59, LO, HI - 1, 59, HI - 1, 3, 0);
    fill(LO, 60, LO, HI - 1, 60, HI - 1, 2, 0);
  }
  static void anchors() { for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) fill(cx * 16 + 15, 100, cz * 16 + 15, cx * 16 + 15, 100, cz * 16 + 15, 1, 0); }
  static void cavern() {
    fill(20, 30, -12, 58, 58, 28, 0, 0);
    fill(30, 59, 0, 33, 60, 3, 0, 0); // sky holes through the roof
    fill(44, 59, 8, 47, 60, 11, 0, 0);
  }
  // Edits at x 24..55 (chunks 1..3, the outer ring of the seven-chunk square) with every chunk loaded, as the native server runs them.
  static void ringEdits() throws Exception {
    edit(40, 61, 8, 50, 5, "ring torch");
    edit(45, 61, 8, 89, 0, "ring glowstone");
    edit(46, 61, 40, 10, 0, "ring lava");
    edit(46, 62, 8, 1, 0, "ring roof");
    edit(40, 61, 8, 0, 0, "remove torch");
    edit(45, 61, 8, 0, 0, "remove glowstone");
    edit(46, 62, 8, 0, 0, "remove roof");
    edit(45, 40, 8, 89, 0, "cave glowstone");
    edit(44, 45, 8, 50, 5, "cave torch");
  }
  // Sky edits through the cavern roof holes: the sky light that falls into the cavern is plugged and reopened.
  static void ringHoles() throws Exception {
    edit(31, 59, 1, 1, 0, "plug hole");
    edit(45, 59, 9, 1, 0, "plug hole 2");
    edit(31, 59, 1, 0, 0, "reopen hole");
    edit(45, 59, 9, 0, 0, "reopen hole 2");
    edit(40, 59, 20, 0, 0, "dig ring hole");
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();

    // (1) overworld: the settled square, then edits on the outer ring chunks (all seven x seven chunks loaded)
    begin(); flat(); anchors(); cavern();
    gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
    ringEdits();
    end("ring-overworld");

    // (1b) placements only (no place-and-remove pairs): torch, glowstone, lava, and two lights in the cavern
    begin(); flat(); anchors(); cavern();
    gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
    edit(40, 61, 8, 50, 5, "ring torch");
    edit(45, 61, 8, 89, 0, "ring glowstone");
    edit(46, 61, 40, 10, 0, "ring lava");
    edit(45, 40, 8, 89, 0, "cave glowstone");
    edit(44, 45, 8, 50, 5, "cave torch");
    edit(-30, 61, 8, 89, 0, "west ring glowstone");
    end("ring-lights");

    begin(); flat(); anchors(); cavern();
    gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
    ringHoles();
    end("ring-holes");

    // Natively an edit refuses its light update when a chunk within 17 blocks is missing (doChunksNearChunkExist), so only x -31..46 is lit
    // here; the ring chunks (x < -32, x >= 48) are the ones a streamed window leaves non-resident.
    // (2) the same edits on the opposite ring (x and z negated), so the replay covers both signs of the window offset
    begin(); flat(); anchors(); cavern();
    gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
    edit(-25, 61, -9, 50, 5, "ring torch");
    edit(-30, 61, -9, 89, 0, "ring glowstone");
    edit(-28, 61, -30, 10, 0, "ring lava");
    edit(-25, 62, -9, 1, 0, "ring roof");
    edit(-25, 61, -9, 0, 0, "remove torch");
    edit(-25, 62, -9, 0, 0, "remove roof");
    end("ring-negative");

    // (3) the Nether (WorldProviderHell, registerWorldChunkManager b()): netherrack with a lava sea, ceiling at y 127. hasNoSky: sky nibbles 0.
    for (String k : new String[] {"nether", "end", "nether-ring", "end-ring"}) {
      boolean lava = !k.endsWith("-ring");
      begin(k.replace("-ring", ""));
      int id = k.startsWith("nether") ? 87 : 121;
      fill(LO, 0, LO, HI - 1, 0, HI - 1, 7, 0);
      fill(LO, 1, LO, HI - 1, 40, HI - 1, id, 0);
      fill(-20, 41, -20, 20, 70, 20, 0, 0);
      if (k.startsWith("nether")) { fill(LO, 127, LO, HI - 1, 127, HI - 1, 7, 0); if (lava) { fill(-10, 1, -10, 10, 20, 10, 11, 0); fill(30, 41, 0, 34, 43, 4, 10, 0); } }
      anchors();
      gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
      edit(0, 45, 0, 50, 5, k + " torch");
      edit(12, 41, 3, 89, 0, k + " glowstone");
      edit(40, 45, 8, 89, 0, k + " ring glowstone");
      edit(-25, 45, -8, 50, 5, k + " ring torch");
      edit(0, 45, 0, 0, 0, k + " remove torch");
      edit(5, 41, 5, 10, 0, k + " lava");
      edit(0, 60, 5, 1, 0, k + " roof");
      edit(0, 60, 5, 0, 0, k + " remove roof");
      edit(40, 45, 8, 0, 0, k + " remove ring glowstone");
      end(k.contains("-") ? k : k + "-edits");
    }

    // (4) a 64-cell batch in one chunk of the settled overworld square (the distinct-changed-cells count that makes PlayerInstance
    // send the chunk again, after which the client runs resetRelightChecks), then ticks of enqueueRelightChecks.
    begin(); flat(); anchors();
    gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
    for (int i = 0; i < 64; i++) edit(4 + (i % 8), 61 + (i / 8) % 2, 2 + (i / 16), i % 5 == 0 ? 50 : 1, i % 5 == 0 ? 5 : 0, "batch" + i);
    snap("edited");
    op("[\"reset\"]");
    for (int t = 1; t <= 130; t++) { tick(); if (t == 1 || t == 16 || t == 130) snap("checks " + t); }
    end("resend-64");
  }
}
