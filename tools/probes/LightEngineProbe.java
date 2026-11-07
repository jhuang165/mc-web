import java.lang.reflect.Field;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

// Runs the unchanged 1.7.10 light engine over real Chunk (apx) / ExtendedBlockStorage (apz) objects: World.setBlock (d) ->
// Chunk.setBlockIDWithMetadata (func_150807_a, relightBlock/propagateSkylightOcclusion inside) -> World.updateAllLightTypes
// (func_147451_t) -> updateLightByType (c) / computeLightValue (a). Fresh chunks go through Chunk.generateSkylightMap (func_76603_b);
// "settled" ticks every chunk with isTerrainPopulated set (Chunk.func_150804_b -> func_150809_p -> checkLight of the gaps).
// World is allocated without its constructor (sun.misc.Unsafe) over a WorldProviderSurface; isRemote is true so block add/break
// callbacks are skipped. The loaded area is chunks -2..2 (x, z -32..47); World.func_72873_a (doChunksNearChunkExist) works on the
// provider's chunk map. Output: one JSON record per scenario.
public class LightEngineProbe {
  static sun.misc.Unsafe unsafe;
  static final int R = 2, LO = -16, HI = 32; // digest area: x, z in [LO, HI)

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
  public static class Provider implements apu {
    HashMap<Long, apx> chunks = new HashMap<>();
    ahb world;
    public boolean a(int x, int z) { return chunks.containsKey(agu.a(x, z)); }
    public apx d(int x, int z) { apx c = chunks.get(agu.a(x, z)); return c != null ? c : new apw(world, x, z); }
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

  static W world;
  static Provider prov;
  static List<int[]> fills; // x0,y0,z0,x1,y1,z1,id,meta (inclusive)
  static List<int[]> steps;

  static void fill(int x0, int y0, int z0, int x1, int y1, int z1, int id, int meta) { fills.add(new int[] {x0, y0, z0, x1, y1, z1, id, meta}); }
  static void step(int x, int y, int z, int id, int meta) { steps.add(new int[] {x, y, z, id, meta}); }

  static boolean nether = false; // WorldProviderHell with hasNoSky (aqo.g) set, as WorldProviderHell.registerWorldChunkManager does
  static void newWorld() throws Exception {
    world = (W) unsafe.allocateInstance(W.class);
    Object provider = unsafe.allocateInstance(nether ? aqp.class : aqq.class);
    if (nether) set(provider, "g", true);
    set(world, "t", provider);
    set(world, "C", new qi());
    set(world, "I", new int[32768]);
    set(world, "E", true);
    set(world, "u", new ArrayList<Object>());
    prov = new Provider();
    prov.world = world;
    set(world, "v", prov);
  }

  static void generate() throws Exception {
    for (int cx = -R; cx <= R; cx++)
      for (int cz = -R; cz <= R; cz++) {
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
        prov.chunks.put(agu.a(cx, cz), new apx(world, blocks, meta, cx, cz));
      }
    for (apx c : prov.chunks.values()) c.b(); // generateSkylightMap
  }

  // One server tick's chunk work: WorldServer.func_147456_g calls Chunk.func_150804_b(false) on every ticking chunk (recheckGaps,
  // then func_150809_p for chunks not yet light-populated). isRemote is false for it: recheckGaps stops after one column when true.
  static void tick() throws Exception {
    set(world, "E", false);
    for (apx c : prov.chunks.values()) c.b(false);
    set(world, "E", true);
  }
  static void settle() throws Exception {
    for (apx c : prov.chunks.values()) set(c, "k", true);
    tick();
    tick();
  }

  static String sha(byte[] b) throws Exception {
    byte[] d = MessageDigest.getInstance("SHA-256").digest(b);
    StringBuilder s = new StringBuilder();
    for (byte v : d) s.append(String.format("%02x", v & 255));
    return s.toString();
  }

  // x-major, then z, then y: sky bytes, block bytes, heightMap shorts over the digest area.
  static String digests() throws Exception {
    int n = (HI - LO) * (HI - LO);
    byte[] sky = new byte[n * 256], blk = new byte[n * 256], hm = new byte[n * 2];
    int k = 0, h = 0;
    for (int x = LO; x < HI; x++) for (int z = LO; z < HI; z++) {
      if ((x & 15) == 15 && (z & 15) == 15) { k += 256; h += 2; continue; } // the anchor columns are not digested
      apx c = prov.chunks.get(agu.a(x >> 4, z >> 4));
      for (int y = 0; y < 256; y++, k++) { sky[k] = (byte) world.b(ahn.a, x, y, z); blk[k] = (byte) world.b(ahn.b, x, y, z); }
      int hv = c.b(x & 15, z & 15);
      hm[h++] = (byte) (hv >> 8);
      hm[h++] = (byte) hv;
    }
    return "\"sky\":\"" + sha(sky) + "\",\"block\":\"" + sha(blk) + "\",\"heights\":\"" + sha(hm) + "\"";
  }

  static String region(int[] r) {
    StringBuilder s = new StringBuilder("\"region\":{\"box\":[" + r[0] + "," + r[1] + "," + r[2] + "," + r[3] + "," + r[4] + "," + r[5] + "],\"sky\":\"");
    for (int x = r[0]; x <= r[3]; x++) for (int z = r[2]; z <= r[5]; z++) for (int y = r[1]; y <= r[4]; y++) s.append(Integer.toHexString(world.b(ahn.a, x, y, z)));
    s.append("\",\"block\":\"");
    for (int x = r[0]; x <= r[3]; x++) for (int z = r[2]; z <= r[5]; z++) for (int y = r[1]; y <= r[4]; y++) s.append(Integer.toHexString(world.b(ahn.b, x, y, z)));
    return s.append("\"}").toString();
  }

  static String snap(String label, int[] r) throws Exception {
    return "{\"label\":\"" + label + "\"," + digests() + (r == null ? "" : "," + region(r)) + "}";
  }

  static String fillsJson() {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < fills.size(); i++) {
      if (i > 0) s.append(",");
      int[] f = fills.get(i);
      s.append("[");
      for (int j = 0; j < 8; j++) s.append(j > 0 ? "," : "").append(f[j]);
      s.append("]");
    }
    return s.append("]").toString();
  }
  static String stepsJson() {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < steps.size(); i++) {
      if (i > 0) s.append(",");
      int[] f = steps.get(i);
      s.append("[" + f[0] + "," + f[1] + "," + f[2] + "," + f[3] + "," + f[4] + "]");
    }
    return s.append("]").toString();
  }

  static boolean anchored = true;
  // One stone block high in every chunk so sections 4-6 exist: setting a block into a null ExtendedBlockStorage makes Chunk run
  // generateSkylightMap instead of relightBlock, which leaves stale light under a floating block (the "null-section" scenario).
  static void anchors() {
    if (anchored) for (int cx = -R; cx <= R; cx++) for (int cz = -R; cz <= R; cz++) fill(cx * 16 + 15, 100, cz * 16 + 15, cx * 16 + 15, 100, cz * 16 + 15, 1, 0);
  }
  static void flat() {
    anchors();
    fill(-32, 0, -32, 47, 0, 47, 7, 0);
    fill(-32, 1, -32, 47, 58, 47, 1, 0);
    fill(-32, 59, -32, 47, 59, 47, 3, 0);
    fill(-32, 60, -32, 47, 60, 47, 2, 0);
  }

  static void run(String name, int[] box, int every) throws Exception {
    newWorld();
    generate();
    List<String> snaps = new ArrayList<>();
    snaps.add(snap("generated", box));
    settle();
    snaps.add(snap("settled", box));
    for (int i = 0; i < steps.size(); i++) {
      int[] s = steps.get(i);
      boolean ok = world.d(s[0], s[1], s[2], aji.e(s[3]), s[4], 2);
      tick();
      boolean last = i == steps.size() - 1;
      snaps.add(snap("step" + i + (ok ? "" : "-unchanged"), (every > 0 && (i % every == every - 1)) || last ? box : null));
    }
    System.out.println("{\"case\":\"" + name + "\",\"fills\":" + fillsJson() + ",\"steps\":" + stepsJson() + ",\"snaps\":[" + String.join(",", snaps) + "]}");
  }

  static void terrain(long seed) {
    anchors();
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
      if (h[i][j] < 56 && r.nextInt(3) == 0) fill(x0, 61, z0, x0 + 3, 61, z0 + 3, 79, 0);
    }
    for (int k = 0; k < 14; k++) { // caves: air boxes (some break the surface)
      int x = -28 + r.nextInt(70), z = -28 + r.nextInt(70), y = 20 + r.nextInt(40);
      fill(x, y, z, x + 2 + r.nextInt(8), y + 1 + r.nextInt(3), z + 1 + r.nextInt(3), 0, 0);
    }
    for (int k = 0; k < 6; k++) { // overhang slabs and floating stone
      int x = -28 + r.nextInt(70), z = -28 + r.nextInt(70), y = 64 + r.nextInt(12);
      fill(x, y, z, x + 3 + r.nextInt(6), y + r.nextInt(2), z + 3 + r.nextInt(6), 1, 0);
    }
    for (int k = 0; k < 18; k++) { // trees
      int x = -28 + r.nextInt(70), z = -28 + r.nextInt(70), y = h[(x + 32) / 4][(z + 32) / 4] + 1;
      if (y < 61) continue;
      fill(x, y, z, x, y + 4, z, 17, 0);
      fill(x - 2, y + 3, z - 2, x + 2, y + 4, z + 2, 18, 0);
      fill(x - 1, y + 5, z - 1, x + 1, y + 5, z + 1, 18, 0);
    }
    for (int k = 0; k < 6; k++) { // torches, glowstone, lava
      int x = -24 + r.nextInt(60), z = -24 + r.nextInt(60), y = 30 + r.nextInt(30), t = r.nextInt(3);
      fill(x, y, z, x, y, z, t == 0 ? 50 : t == 1 ? 89 : 11, t == 0 ? 5 : 0);
    }
  }

  static int[] BLOCKS = {0, 0, 1, 1, 5, 9, 18, 20, 50, 89, 11, 79, 3};

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();

    // unanchored flat world: placing opaque blocks into the empty sections above the ground
    anchored = false;
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    step(8, 64, 8, 89, 0); step(8, 64, 8, 0, 0); step(8, 64, 8, 89, 0); step(8, 62, 8, 1, 0); step(8, 62, 8, 0, 0); step(8, 64, 8, 0, 0);
    for (int x = 4; x <= 12; x++) step(x, 66, 8, 5, 0);
    step(8, 66, 8, 0, 0);
    run("null-section", new int[] {0, 58, 0, 16, 70, 16}, 1);
    anchored = true;
    // torch: place, remove, two overlapping torches then remove one
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    step(8, 61, 8, 50, 5); step(8, 61, 8, 0, 0); step(8, 61, 8, 50, 5); step(10, 61, 8, 50, 5); step(8, 61, 8, 0, 0); step(10, 61, 8, 0, 0);
    run("torch", new int[] {0, 55, 0, 16, 70, 16}, 1);
    // glowstone and lava above ground, including an adjacent pair
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    step(8, 64, 8, 89, 0); step(8, 64, 8, 0, 0); step(5, 62, 8, 89, 0); step(6, 62, 8, 89, 0); step(5, 62, 8, 0, 0); step(6, 62, 8, 0, 0);
    step(8, 61, 8, 11, 0); step(8, 61, 8, 0, 0); step(8, 61, 8, 10, 3); step(8, 61, 8, 0, 0);
    run("emitters", new int[] {0, 55, 0, 16, 70, 16}, 3);
    // a closed cave with a torch: emission in a dark volume, then opening/closing it
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    fill(2, 40, 2, 12, 46, 12, 0, 0);
    step(7, 40, 7, 50, 5); step(7, 40, 7, 0, 0); step(7, 40, 7, 89, 0); step(7, 41, 7, 1, 0); step(7, 40, 7, 0, 0); step(7, 41, 7, 0, 0);
    run("cave-torch", new int[] {0, 36, 0, 16, 50, 16}, 1);
    // dig a 1-wide shaft from the surface down, then re-cover it
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    for (int y = 60; y >= 45; y--) step(8, y, 8, 0, 0);
    step(8, 52, 8, 1, 0); step(8, 53, 8, 0, 0); step(8, 60, 8, 3, 0); step(8, 60, 8, 0, 0); step(8, 61, 8, 1, 0);
    run("shaft", new int[] {0, 44, 0, 16, 62, 16}, 4);
    // roof over open ground, then holes
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    for (int x = 4; x <= 12; x++) for (int z = 4; z <= 12; z++) step(x, 66, z, 5, 0);
    step(8, 66, 8, 0, 0); step(4, 66, 4, 0, 0); step(8, 66, 8, 5, 0); step(12, 66, 8, 0, 0); step(12, 66, 7, 0, 0);
    run("roof", new int[] {0, 58, 0, 16, 70, 16}, 20);
    // stacked water/leaves/ice/glass (opacity 3/1/3/0) columns placed block by block over open ground, then edited
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    int[][] cols = {{3, 18}, {7, 9}, {11, 79}, {15, 20}};
    for (int[] c : cols) for (int y = 72; y >= 70; y--) for (int dz = 2; dz <= 4; dz++) for (int dx = -1; dx <= 1; dx++) step(c[0] + dx, y, dz, c[1], 0);
    for (int y = 64; y <= 66; y++) for (int z = 8; z <= 10; z++) for (int x = 6; x <= 8; x++) step(x, y, z, 18, 0);
    for (int x = 10; x <= 12; x++) for (int z = 8; z <= 10; z++) step(x, 62, z, 9, 0);
    step(7, 71, 3, 0, 0); step(7, 70, 3, 0, 0); step(7, 72, 3, 0, 0); step(11, 71, 3, 0, 0); step(11, 70, 3, 0, 0); step(11, 72, 3, 0, 0);
    step(3, 71, 3, 1, 0); step(15, 71, 3, 1, 0); step(15, 70, 3, 0, 0); step(7, 65, 9, 0, 0); step(7, 65, 9, 18, 0);
    run("opacity-columns", new int[] {0, 58, 0, 16, 74, 16}, 40);
    // water basin: sunken water body, then changing its surface
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    fill(4, 52, 4, 12, 60, 12, 9, 0);
    step(8, 60, 8, 0, 0); step(8, 59, 8, 0, 0); step(8, 52, 8, 1, 0); step(8, 60, 8, 79, 0); step(4, 60, 4, 0, 0); step(4, 59, 4, 0, 0);
    run("water-basin", new int[] {0, 48, 0, 16, 64, 16}, 1);
    // cave opening under an overhang: sealed tunnel, plug removed, overhang cut away
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    fill(-4, 55, 6, 14, 57, 10, 0, 0); fill(-4, 58, 8, -4, 59, 8, 0, 0);
    fill(8, 70, 0, 24, 72, 16, 1, 0);
    step(-4, 60, 8, 0, 0); step(-4, 60, 8, 2, 0); step(-4, 59, 8, 3, 0); step(-4, 59, 8, 0, 0);
    step(8, 70, 8, 0, 0); step(8, 71, 8, 0, 0); step(8, 72, 8, 0, 0); step(9, 70, 8, 0, 0); step(12, 70, 0, 0, 0);
    for (int x = 8; x <= 24; x++) step(x, 70, 4, 0, 0);
    run("overhang-cave", new int[] {-6, 52, 0, 14, 74, 16}, 6);
    // chunk boundary x = 16: torch pair, glowstone, roof, shaft and lava across the border
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    step(15, 61, 8, 50, 5); step(16, 61, 8, 50, 5); step(15, 61, 8, 0, 0); step(16, 62, 9, 89, 0); step(16, 62, 9, 0, 0); step(16, 61, 8, 0, 0);
    for (int x = 12; x <= 20; x++) step(x, 66, 8, 5, 0);
    step(16, 66, 8, 0, 0);
    for (int y = 60; y >= 50; y--) step(16, y, 8, 0, 0);
    for (int z = 14; z <= 17; z++) step(15, 61 + z - 14, z, 11, 0);
    for (int z = 14; z <= 17; z++) step(15, 61 + z - 14, z, 0, 0);
    run("chunk-boundary", new int[] {8, 52, 0, 24, 70, 16}, 6);
    // updates close to the loaded square: native skips an update when a chunk within 17 blocks is not loaded
    fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
    step(-14, 61, 8, 50, 5); step(-20, 61, 8, 50, 5); step(-14, 61, 8, 0, 0); step(-20, 61, 8, 0, 0); step(-20, 61, 8, 89, 0); step(-28, 61, 8, 89, 0);
    step(-20, 62, 12, 5, 0); step(-20, 62, 12, 0, 0);
    run("loaded-edge", new int[] {-32, 56, 0, -8, 66, 16}, 1);
    // the Nether (no sky): block light only
    nether = true;
    fills = new ArrayList<>(); steps = new ArrayList<>();
    fill(-32, 0, -32, 47, 0, 47, 7, 0); fill(-32, 1, -32, 47, 40, 47, 87, 0); fill(-32, 41, -32, 47, 46, 47, 0, 0); fill(-32, 47, -32, 47, 255, 47, 87, 0);
    fill(4, 41, 4, 5, 60, 5, 0, 0); fill(14, 30, 14, 20, 44, 20, 87, 0);
    step(8, 41, 8, 11, 0); step(12, 41, 12, 89, 0); step(30, 41, 30, 11, 0);
    step(6, 41, 6, 50, 5); step(6, 41, 6, 0, 0); step(8, 41, 8, 0, 0); step(12, 41, 12, 0, 0); step(5, 41, 8, 89, 0); step(5, 42, 8, 87, 0);
    step(16, 45, 16, 0, 0); step(16, 46, 16, 0, 0); step(9, 41, 9, 11, 0); step(9, 42, 9, 9, 0); step(9, 41, 9, 0, 0); step(9, 42, 9, 0, 0);
    run("nether", new int[] {0, 38, 0, 16, 50, 16}, 1);
    nether = false;
    // fresh chunks: generateSkylightMap only versus the ticked/populated state, on three terrains
    for (long seed : new long[] {101, 102, 103}) {
      fills = new ArrayList<>(); steps = new ArrayList<>(); terrain(seed);
      run("terrain-" + seed, new int[] {0, 52, 0, 16, 76, 16}, 1);
    }
    // seeded random edit stress on a flat world with caves: every edit is digested
    for (long seed : new long[] {201, 202, 203}) {
      fills = new ArrayList<>(); steps = new ArrayList<>(); flat();
      Random r = new Random(seed * 7);
      for (int k = 0; k < 8; k++) { int x = r.nextInt(30) - 4, z = r.nextInt(30) - 4, y = 44 + r.nextInt(12); fill(x, y, z, x + 2 + r.nextInt(6), y + 1 + r.nextInt(3), z + 2 + r.nextInt(6), 0, 0); }
      for (int i = 0; i < 220; i++) {
        int x = r.nextInt(30) - 4, z = r.nextInt(30) - 4, y = 44 + r.nextInt(32), b = BLOCKS[r.nextInt(BLOCKS.length)];
        step(x, y, z, b, b == 50 ? 5 : 0);
      }
      run("stress-" + seed, new int[] {0, 44, 0, 16, 76, 16}, 0);
    }
  }
}
