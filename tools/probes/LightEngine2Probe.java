import java.lang.reflect.Field;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// The second light-engine probe (batch 25): the unchanged 1.7.10 World / Chunk light code, as in LightEngineProbe, driven by a script of
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
public class LightEngine2Probe {
  static sun.misc.Unsafe unsafe;
  static final int R = 2, LO = -32, HI = 48;

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

  static void newWorld() throws Exception {
    world = (W) unsafe.allocateInstance(W.class);
    set(world, "t", unsafe.allocateInstance(aqq.class));
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
  static void anchors() { for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) fill(cx * 16 + 15, 100, cz * 16 + 15, cx * 16 + 15, 100, cz * 16 + 15, 1, 0); }
  // A cavern under the grass (y 30..58 over x, z -12..28) with sky holes through the roof.
  static void cavern(Random r) {
    fill(-12, 30, -12, 28, 58, 28, 0, 0);
    int holes = 6 + r.nextInt(8);
    for (int k = 0; k < holes; k++) { int x = -10 + r.nextInt(36), z = -10 + r.nextInt(36); fill(x, 59, z, x + r.nextInt(3), 60, z + r.nextInt(3), 0, 0); }
  }
  static final int[] EDIT = {0, 0, 1, 1, 89, 89, 50, 20, 9, 18};

  // Seeded terrain like LightEngineProbe.terrain: stone/dirt/grass columns, water, caves, floating slabs; its trees, torches and
  // glowstone go into the decoration lists (World.setBlock during population) instead of the fills.
  static void terrain(long seed) {
    Random r = new Random(seed);
    fill(-32, 0, -32, 47, 0, 47, 7, 0);
    int[][] h = new int[20][20];
    for (int i = 0; i < 20; i++) for (int j = 0; j < 20; j++) h[i][j] = 52 + r.nextInt(14) + (i > 8 && i < 14 ? r.nextInt(18) : 0);
    for (int i = 0; i < 20; i++) for (int j = 0; j < 20; j++) {
      int x0 = -32 + i * 4, z0 = -32 + j * 4;
      fill(x0, 1, z0, x0 + 3, h[i][j] - 2, z0 + 3, 1, 0);
      fill(x0, h[i][j] - 1, z0, x0 + 3, h[i][j] - 1, z0 + 3, 3, 0);
      fill(x0, h[i][j], z0, x0 + 3, h[i][j], z0 + 3, 2, 0);
      if (h[i][j] < 60) fill(x0, h[i][j] + 1, z0, x0 + 3, 60, z0 + 3, 9, 0);
    }
    for (int k = 0; k < 14; k++) {
      int x = -28 + r.nextInt(70), z = -28 + r.nextInt(70), y = 20 + r.nextInt(40);
      fill(x, y, z, x + 2 + r.nextInt(8), y + 1 + r.nextInt(3), z + 1 + r.nextInt(3), 0, 0);
    }
    for (int k = 0; k < 6; k++) {
      int x = -28 + r.nextInt(70), z = -28 + r.nextInt(70), y = 64 + r.nextInt(12);
      fill(x, y, z, x + 3 + r.nextInt(6), y + r.nextInt(2), z + 3 + r.nextInt(6), 1, 0);
    }
    for (int k = 0; k < 24; k++) { // trees inside the population squares (chunk origin + 8 .. + 23), so they stay in loaded chunks
      int x = -24 + r.nextInt(56), z = -24 + r.nextInt(56), y = h[(x + 32) / 4][(z + 32) / 4] + 1;
      if (y < 61) continue;
      for (int dy = 0; dy <= 4; dy++) deco(x, y + dy, z, 17, 0);
      for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++) for (int dy = 3; dy <= 4; dy++) if (dx != 0 || dz != 0) deco(x + dx, y + dy, z + dz, 18, 0);
      for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) deco(x + dx, y + 5, z + dz, 18, 0);
    }
    for (int k = 0; k < 10; k++) {
      int x = -24 + r.nextInt(56), z = -24 + r.nextInt(56), y = 30 + r.nextInt(30), t = r.nextInt(3);
      deco(x, y, z, t == 0 ? 50 : t == 1 ? 89 : 11, t == 0 ? 5 : 0);
    }
  }
  static List<int[]> spiral() {
    List<int[]> out = new ArrayList<>();
    out.add(new int[] {0, 0});
    for (int ring = 1; ring <= R; ring++)
      for (int cx = -ring; cx <= ring; cx++) for (int cz = -ring; cz <= ring; cz++) if (Math.max(Math.abs(cx), Math.abs(cz)) == ring) out.add(new int[] {cx, cz});
    return out;
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();

    // (1) the light queue: the same sky-lit cavern edits with World.lightUpdateBlockList at 32768 (native), 4096 and 1024 entries; the
    // shorter queues overflow, so their results pin the removal pass's "j < length" and the addition pass's "j < length - 6" checks.
    for (int n : new int[] {32768, 4096, 1024}) {
      begin(); flat(); anchors();
      Random r = new Random(25);
      cavern(r);
      op("[\"queue\"," + n + "]");
      gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
      for (int i = 0; i < 40; i++) {
        int b = EDIT[r.nextInt(EDIT.length)];
        edit(-10 + r.nextInt(36), 30 + r.nextInt(31), -10 + r.nextInt(36), b, b == 50 ? 5 : 0, "edit" + i);
      }
      end("queue-" + n);
    }

    // (2) unloaded neighbours: only chunks x -2..0 are loaded at first, so updates within 17 blocks of x 16 are skipped
    // (doChunksNearChunkExist); then the x 1 column of chunks loads (populateChunk) and the same edits run again.
    begin(); flat(); anchors();
    for (int cx = -2; cx <= 0; cx++) for (int cz = -2; cz <= 2; cz++) op("[\"gen\"," + cx + "," + cz + "]");
    op("[\"terrain\"]"); tick(); tick(); snap("settled");
    int[][] near = {{8, 61, 8, 50, 5}, {14, 61, 2, 89, 0}, {2, 61, 8, 89, 0}, {12, 66, 4, 1, 0}, {12, 60, 12, 0, 0}, {12, 59, 12, 0, 0}, {-12, 61, 8, 50, 5}};
    for (int[] s : near) edit(s[0], s[1], s[2], s[3], s[4], "edge " + s[0]);
    for (int cz = -2; cz <= 2; cz++) { op("[\"load\",1," + cz + "]"); tick(); snap("load 1 " + cz); }
    for (int[] s : near) edit(s[0], s[1], s[2], 0, 0, "clear " + s[0]);
    edit(8, 61, 8, 50, 5, "torch again");
    end("unloaded-edge");

    // (3) fresh chunks: terrain loaded chunk by chunk (spiral from 0,0) with a server tick after each load, so population
    // (func_150809_p, then decoration through setBlock) happens as the neighbours arrive; then the rest of the ticks.
    for (long seed : new long[] {301, 302}) {
      begin(); terrain(seed); anchors();
      for (int[] c : spiral()) { op("[\"load\"," + c[0] + "," + c[1] + "]"); tick(); }
      snap("loaded");
      for (int i = 0; i < 4; i++) tick();
      snap("ticked");
      end("fresh-spiral-" + seed);
    }
    // the same terrain loaded x-major with no ticks in between (neighbour order of populateChunk)
    begin(); terrain(301); anchors();
    for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) op("[\"load\"," + cx + "," + cz + "]");
    snap("loaded");
    tick(); snap("tick1");
    tick(); snap("tick2");
    end("fresh-xmajor-301");

    // (4) Chunk.enqueueRelightChecks after resetRelightChecks: generated (unpopulated) terrain, then 8 slots per chunk per tick.
    begin(); terrain(303); anchors();
    gen(); snap("generated");
    op("[\"reset\"]");
    for (int t = 1; t <= 520; t++) { tick(); if (t == 1 || t == 64 || t == 256 || t == 511 || t == 520) snap("checks " + t); }
    end("relight-checks-303");

    // (5) missing sections: no anchors, so sections 4+ are null over the flat ground once it has settled. A floating block at y 100
    // (section 6, above the heightMap: generateSkylightMap, no relightBlock) leaves the null sections 4-5 under it reading 0; a block
    // then set into section 5 under it (below the new heightMap) creates that section with zero sky light across the chunk, without
    // generateSkylightMap. Ticks, then resetRelightChecks and enqueueRelightChecks slots; then a platform and more edits.
    begin(); flat();
    gen(); op("[\"terrain\"]"); tick(); tick(); snap("settled");
    edit(12, 100, 12, 1, 0, "floating");
    edit(12, 84, 12, 1, 0, "under floating");
    for (int t = 0; t < 3; t++) tick();
    snap("ticks");
    op("[\"reset\"]");
    for (int t = 1; t <= 512; t++) { tick(); if (t == 32 || t == 512) snap("checks " + t); }
    for (int x = 0; x <= 5; x++) for (int z = 0; z <= 2; z++) { set(x, 100, z, 1, 0); tick(); }
    snap("platform");
    edit(2, 84, 1, 1, 0, "under platform");
    edit(2, 84, 1, 0, 0, "removed");
    edit(10, 86, 10, 1, 0, "open air");
    edit(3, 70, 1, 50, 5, "torch section 4");
    edit(20, 90, 20, 89, 0, "glowstone other chunk");
    edit(2, 84, 2, 20, 0, "glass under platform");
    end("null-sections");
  }
}
