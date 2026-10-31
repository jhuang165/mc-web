import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Records 1.7.10 snow and ice behaviour from the unchanged original classes, on a fake World
// (allocated without its constructor, like WeatherProbe):
//   biomes    BiomeGenBase facts: getFloatTemperature(5, 40, 5) (ao), rainfall (ap), canSpawnLightningBolt (e),
//             getEnableSnow (d), for every biome id.
//   blocks    Block facts for snow layer (78), ice (79), snow block (80), packed ice (174) and reference blocks:
//             getLightOpacity (k), renderAsNormalBlock (d), isOpaqueCube (c), slipperiness (K), getTickRandomly (t),
//             Material.blocksMovement (c), Material.isLiquid (d), getBlockHardness (f).
//   bounds    BlockSnow.setBlockBoundsBasedOnState + getCollisionBoundingBoxFromPool (a) and the selection box (g)
//             for metadata 0-15, relative to the block.
//   freeze    World.canBlockFreeze (d) with noWaterAdj false/true (r and s are those two), over biomes, block light,
//             the block at the cell, its metadata and its four horizontal neighbours; plus the y range.
//   snowAt    World.func_147478_e (e) = canSnowAt over biomes, block light, the block below, flag; and
//             BlockSnow.canPlaceBlockAt (c).
//   melt      BlockSnow.updateTick (a) and BlockIce.updateTick (a) for every block light 0-15: what the block
//             becomes (-1 stays, otherwise block id).
//   neighbor  BlockSnow.onNeighborBlockChange (a) over the block below.
//   tick      WorldServer.func_147456_g (mt.g) per-chunk loop, transcribed from its bytecode, over a fixture terrain
//             with the rule methods and the Block.updateTick calls running the original classes.
//   populate  ChunkProviderGenerate.populate's final freeze/snow pass (aqz.a), also transcribed.
public class SnowProbe {
  static sun.misc.Unsafe unsafe;

  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try {
        Field f = c.getDeclaredField(name);
        f.setAccessible(true);
        return f;
      } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static String num(float v) { return Float.toString(v); }
  static String num(double v) { return Double.toString(v); }
  static int id(aji b) { return aji.b(b); }

  // ---- fixture terrain, in 1.7.10 block ids. Columns 0..31; outside is stone up to y 30.
  static final int N = 32;
  static int[][] ground = new int[N][N];
  static int[][] surface = new int[N][N]; // 2 grass, 12 sand, 3 dirt (pond bed)
  static boolean[][] pond = new boolean[N][N];
  static int[][] leaf = new int[N][N]; // y of a floating leaf block or 0
  static int[][] glass = new int[N][N]; // y of a floating glass block or 0
  static final int POND_FLOOR = 36, POND_TOP = 41;
  static {
    for (int x = 0; x < N; x++)
      for (int z = 0; z < N; z++) {
        ground[x][z] = 40 + ((x * 7 + z * 13) % 5);
        surface[x][z] = (x * 3 + z * 5) % 17 == 0 ? 12 : 2;
        pond[x][z] = x >= 20 && x <= 27 && z >= 4 && z <= 11;
        if (pond[x][z]) { ground[x][z] = POND_FLOOR; surface[x][z] = 3; }
        leaf[x][z] = !pond[x][z] && (x * 31 + z * 17) % 29 == 0 ? ground[x][z] + 4 : 0;
        glass[x][z] = !pond[x][z] && (x * 13 + z * 29) % 53 == 0 ? ground[x][z] + 3 : 0;
      }
  }
  static int[] base(int x, int y, int z) {
    if (x < 0 || z < 0 || x >= N || z >= N) return new int[] {y <= 30 ? 1 : 0, 0};
    int g = ground[x][z];
    if (y > g) {
      if (pond[x][z] && y <= POND_TOP) return new int[] {9, 0};
      if (y == leaf[x][z]) return new int[] {18, 0};
      if (y == glass[x][z]) return new int[] {20, 0};
      return new int[] {0, 0};
    }
    if (y == g) return new int[] {surface[x][z], 0};
    if (y > g - 3) return new int[] {3, 0};
    return new int[] {1, 0};
  }
  // Two block light sources whose light falls off by manhattan distance: a torch (14) and a lava-ish 15.
  static int lightAt(int x, int y, int z) {
    int a = 14 - (Math.abs(x - 8) + Math.abs(y - 45) + Math.abs(z - 8));
    int b = 15 - (Math.abs(x - 26) + Math.abs(y - 42) + Math.abs(z - 6));
    return Math.max(0, Math.max(a, b));
  }

  public static class Probe extends ahb {
    int biome = 12;
    int fixedLight = -1; // >= 0: every cell has this block light
    boolean terrain = false;
    Map<Long, int[]> cells = new HashMap<>();
    List<String> log = new ArrayList<>();
    int tick = 0;
    Probe() { super((azc) null, null, (aqo) null, (ahj) null, null); } // never run: allocated without a constructor
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    static long key(int x, int y, int z) { return ((long) (x + 1000) * 100000L + (y + 1000)) * 100000L + (z + 1000); }
    int[] cell(int x, int y, int z) {
      int[] c = cells.get(key(x, y, z));
      if (c != null) return c;
      return terrain ? base(x, y, z) : new int[] {0, 0};
    }
    void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
    public ahu a(int x, int z) { return ahu.d(biome); }
    public aji a(int x, int y, int z) { return y < 0 || y > 255 ? aji.e(0) : aji.e(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return y < 0 || y > 255 ? 0 : cell(x, y, z)[1]; }
    public int b(ahn type, int x, int y, int z) {
      if (type != ahn.b) return 15;
      return fixedLight >= 0 ? fixedLight : lightAt(x, y, z);
    }
    // Chunk.getPrecipitationHeight: one above the topmost block whose material blocks movement or is liquid.
    public int h(int x, int z) {
      for (int y = 255; y >= 0; y--) {
        awt m = a(x, y, z).o();
        if (m.c() || m.d()) return y + 1;
      }
      return -1;
    }
    public boolean b(int x, int y, int z, aji b) { return setBlock(x, y, z, b, 0); }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { return setBlock(x, y, z, b, meta); }
    public boolean f(int x, int y, int z) { return setBlock(x, y, z, aji.e(0), 0); }
    public boolean a(int x, int y, int z, int meta, int flags) { cells.put(key(x, y, z), new int[] {cell(x, y, z)[0], meta}); log.add("[" + tick + ",\"meta\"," + x + "," + y + "," + z + "," + meta + "]"); return true; }
    boolean setBlock(int x, int y, int z, aji b, int meta) {
      put(x, y, z, id(b), meta);
      log.add("[" + tick + "," + id(b) + "," + x + "," + y + "," + z + "," + meta + "]");
      return true;
    }
    public void a(double x, double y, double z, String sound, float volume, float pitch) {}
    void rain(float v) { m = v; n = v; o = 0; p = 0; q = 0; }
  }

  static Probe world() throws Exception {
    Probe w = (Probe) unsafe.allocateInstance(Probe.class);
    set(w, "t", unsafe.allocateInstance(aqq.class)); // WorldProviderSurface; hasNoSky (f) is false
    set(w, "s", new Random(1));
    set(w, "C", new qi());
    w.cells = new HashMap<>(); // field initialisers are skipped by allocateInstance
    w.log = new ArrayList<>();
    w.biome = 12;
    w.fixedLight = -1;
    set(w, "E", true); // isRemote: Block.dropBlockAsItem does nothing (it needs GameRules)
    return w;
  }

  static String box(azt b, int x, int y, int z) {
    return b == null ? "null" : "[" + num(b.a - x) + "," + num(b.b - y) + "," + num(b.c - z) + "," + num(b.d - x) + "," + num(b.e - y) + "," + num(b.f - z) + "]";
  }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    StringBuilder out = new StringBuilder("{");
    Probe w = world();

    // ---- biomes
    out.append("\"biomes\":[");
    boolean first = true;
    for (int b = 0; b < 40; b++) {
      ahu biome = ahu.d(b);
      if (biome == null) continue;
      out.append(first ? "" : ",").append("[").append(b).append(",\"").append(biome.af).append("\",").append(num(biome.a(5, 40, 5))).append(",").append(num(biome.ap)).append(",").append(biome.e() ? 1 : 0).append(",").append(biome.d() ? 1 : 0).append("]");
      first = false;
    }
    out.append("]");

    // ---- blocks
    out.append(",\"blocks\":[");
    int[] ids = {78, 79, 80, 174, 1, 2, 3, 20, 18, 9, 12, 11};
    for (int i = 0; i < ids.length; i++) {
      aji b = aji.e(ids[i]);
      awt m = b.o();
      out.append(i > 0 ? "," : "").append("[").append(ids[i]).append(",").append(b.k()).append(",").append(b.d() ? 1 : 0).append(",").append(b.c() ? 1 : 0).append(",")
        .append(num(b.K)).append(",").append(b.t() ? 1 : 0).append(",").append(m.c() ? 1 : 0).append(",").append(m.d() ? 1 : 0).append(",").append(num(b.f(w, 0, 0, 0))).append("]");
    }
    out.append("]");

    // ---- bounds (snow layer)
    out.append(",\"bounds\":[");
    ann snow = (ann) ajn.aC;
    for (int meta = 0; meta < 16; meta++) {
      w.cells.clear();
      w.put(5, 40, 5, 78, meta);
      snow.a((ahl) w, 5, 40, 5);
      out.append(meta > 0 ? "," : "").append("[").append(meta).append(",").append(box(snow.a(w, 5, 40, 5), 5, 40, 5)).append(",").append(box(snow.g(w, 5, 40, 5), 5, 40, 5)).append("]");
    }
    out.append("]");

    // ---- freeze (canBlockFreeze)
    out.append(",\"freeze\":{\"states\":[");
    int[] biomes = {1, 3, 12, 5, 10};
    int[] lights = {0, 9, 10, 14};
    int[][] blocks = {{0, 0}, {9, 0}, {8, 0}, {8, 1}, {9, 7}, {79, 0}};
    int[] patterns = {0, 1, 2}; // neighbours: 0 all water, 1 three water and one stone, 2 none (air)
    out.append("],\"rows\":[");
    first = true;
    for (int biome : biomes)
      for (int light : lights)
        for (int bi = 0; bi < blocks.length; bi++)
          for (int pattern : patterns) {
            w.cells.clear();
            w.biome = biome;
            w.fixedLight = light;
            w.put(5, 40, 5, blocks[bi][0], blocks[bi][1]);
            int[][] n = {{4, 5}, {6, 5}, {5, 4}, {5, 6}};
            for (int k = 0; k < 4; k++) {
              if (pattern == 0 || (pattern == 1 && k != 2)) w.put(n[k][0], 40, n[k][1], 9, 0);
              else if (pattern == 1) w.put(n[k][0], 40, n[k][1], 1, 0);
            }
            out.append(first ? "" : ",").append("[").append(biome).append(",").append(light).append(",").append(bi).append(",").append(pattern).append(",")
              .append(w.d(5, 40, 5, false) ? 1 : 0).append(",").append(w.d(5, 40, 5, true) ? 1 : 0).append(",").append(w.r(5, 40, 5) ? 1 : 0).append(",").append(w.s(5, 40, 5) ? 1 : 0).append("]");
            first = false;
          }
    out.append("],\"ys\":[");
    int[] ys = {-1, 0, 1, 40, 255, 256, 300};
    first = true;
    for (int y : ys) {
      w.cells.clear();
      w.biome = 12;
      w.fixedLight = 0;
      w.put(5, y, 5, 9, 0);
      out.append(first ? "" : ",").append("[").append(y).append(",").append(w.d(5, y, 5, false) ? 1 : 0).append(",").append(w.e(5, y, 5, true) ? 1 : 0).append(",").append(w.e(5, y, 5, false) ? 1 : 0);
      w.cells.clear();
      w.put(5, y - 1, 5, 1, 0);
      out.append(",").append(w.e(5, y, 5, true) ? 1 : 0).append("]"); // an air cell over stone
      first = false;
    }
    out.append("]}");

    // ---- snowAt
    out.append(",\"snowAt\":{\"below\":[");
    int[][] belows = {{0, 0}, {1, 0}, {2, 0}, {18, 0}, {79, 0}, {174, 0}, {78, 7}, {78, 3}, {20, 0}, {9, 0}, {12, 0}, {80, 0}, {85, 0}, {8, 0}};
    int[][] cellsAt = {{0, 0}, {78, 0}, {1, 0}};
    int[] snowBiomes = {1, 12, 3};
    int[] snowLights = {0, 9, 10, 11};
    for (int i = 0; i < belows.length; i++) out.append(i > 0 ? "," : "").append("[").append(belows[i][0]).append(",").append(belows[i][1]).append("]");
    out.append("],\"cells\":[");
    for (int i = 0; i < cellsAt.length; i++) out.append(i > 0 ? "," : "").append("[").append(cellsAt[i][0]).append(",").append(cellsAt[i][1]).append("]");
    out.append("],\"rows\":[");
    first = true;
    for (int biome : snowBiomes)
      for (int light : snowLights)
        for (int bi = 0; bi < belows.length; bi++)
          for (int ci = 0; ci < cellsAt.length; ci++) {
            w.cells.clear();
            w.biome = biome;
            w.fixedLight = light;
            w.put(5, 39, 5, belows[bi][0], belows[bi][1]);
            w.put(5, 40, 5, cellsAt[ci][0], cellsAt[ci][1]);
            out.append(first ? "" : ",").append("[").append(biome).append(",").append(light).append(",").append(bi).append(",").append(ci).append(",")
              .append(w.e(5, 40, 5, true) ? 1 : 0).append(",").append(w.e(5, 40, 5, false) ? 1 : 0).append(",").append(snow.c(w, 5, 40, 5) ? 1 : 0).append("]");
            first = false;
          }
    out.append("]}");

    // ---- melt: BlockSnow.updateTick and BlockIce.updateTick
    out.append(",\"melt\":{\"snow\":[");
    for (int light = 0; light < 16; light++) {
      w.cells.clear();
      w.log.clear();
      w.fixedLight = light;
      w.put(5, 40, 5, 78, 2);
      w.put(5, 39, 5, 1, 0);
      snow.a(w, 5, 40, 5, new Random(1));
      out.append(light > 0 ? "," : "").append("[").append(light).append(",").append(w.cell(5, 40, 5)[0]).append("]");
    }
    out.append("],\"ice\":[");
    aji ice = ajn.aD;
    for (int light = 0; light < 16; light++) {
      w.cells.clear();
      w.log.clear();
      w.fixedLight = light;
      w.put(5, 40, 5, 79, 0);
      w.put(5, 39, 5, 1, 0);
      ice.a(w, 5, 40, 5, new Random(1));
      out.append(light > 0 ? "," : "").append("[").append(light).append(",").append(w.cell(5, 40, 5)[0]).append(",").append(w.cell(5, 40, 5)[1]).append("]");
    }
    out.append("]}");

    // ---- neighbor: BlockSnow.onNeighborBlockChange over the block below
    out.append(",\"neighbor\":[");
    first = true;
    for (int bi = 0; bi < belows.length; bi++) {
      w.cells.clear();
      w.fixedLight = 0;
      w.put(5, 39, 5, belows[bi][0], belows[bi][1]);
      w.put(5, 40, 5, 78, 3);
      snow.a(w, 5, 40, 5, aji.e(1));
      out.append(first ? "" : ",").append("[").append(belows[bi][0]).append(",").append(belows[bi][1]).append(",").append(w.cell(5, 40, 5)[0]).append("]");
      first = false;
    }
    out.append("]");

    // ---- tick: WorldServer.func_147456_g (mt.g), per active chunk, over the fixture terrain
    out.append(",\"tick\":[");
    first = true;
    long[] tickSeeds = {20240601L, 777L};
    boolean[] tickRain = {true, false};
    int[][] chunks = {{0, 0}, {1, 0}, {0, 1}, {1, 1}};
    int ticks = 600;
    for (int run = 0; run < 2; run++) {
      Probe tw = world();
      tw.terrain = true;
      tw.biome = 12;
      tw.s = new Random(tickSeeds[run]);
      if (tickRain[run]) tw.rain(1f);
      int lcg = (int) (tickSeeds[run] * 31 + 7);
      int startLcg = lcg;
      for (int t = 1; t <= ticks; t++) {
        tw.tick = t;
        for (int[] c : chunks) {
          int bx = c[0] * 16, bz = c[1] * 16;
          // thunder roll (never succeeds here: not thundering), consuming the same Random draw
          if (tw.s.nextInt(100000) == 0 && tw.Q() && tw.P()) throw new IllegalStateException("thunder in the probe");
          // iceandsnow
          if (tw.s.nextInt(16) == 0) {
            lcg = lcg * 3 + 1013904223;
            int j = lcg >> 2;
            int x = j & 15, z = (j >> 8) & 15;
            int y = tw.h(x + bx, z + bz);
            if (tw.s(x + bx, y - 1, z + bz)) tw.b(x + bx, y - 1, z + bz, ajn.aD);
            if (tw.Q() && tw.e(x + bx, y, z + bz, true)) tw.b(x + bx, y, z + bz, ajn.aC);
          }
          // tickBlocks: three random positions per section that needs random ticks (all four sections here)
          for (int s = 0; s < 4; s++)
            for (int k = 0; k < 3; k++) {
              lcg = lcg * 3 + 1013904223;
              int j = lcg >> 2;
              int x = j & 15, z = (j >> 8) & 15, y = (j >> 16) & 15;
              aji blk = tw.a(x + bx, y + s * 16, z + bz);
              if (blk.t()) blk.a(tw, x + bx, y + s * 16, z + bz, tw.s);
            }
        }
      }
      out.append(first ? "" : ",").append("{\"seed\":").append(tickSeeds[run]).append(",\"lcg\":").append(startLcg).append(",\"raining\":").append(tickRain[run] ? 1 : 0)
        .append(",\"ticks\":").append(ticks).append(",\"events\":[").append(String.join(",", tw.log)).append("]}");
      first = false;
    }
    out.append("]");

    // ---- populate: the freeze/snow pass at the end of ChunkProviderGenerate.populate, one 16 x 16 area
    out.append(",\"populate\":[");
    first = true;
    int[] popBiomes = {12, 1};
    for (int biome : popBiomes) {
      Probe pw = world();
      pw.terrain = true;
      pw.biome = biome;
      int bx = 8, bz = 8;
      for (int k = 0; k < 16; k++)
        for (int l = 0; l < 16; l++) {
          int x = bx + k, z = bz + l;
          int y = pw.h(x, z);
          if (pw.r(x, y - 1, z)) pw.d(x, y - 1, z, ajn.aD, 0, 2);
          if (pw.e(x, y, z, true)) pw.d(x, y, z, ajn.aC, 0, 2);
        }
      out.append(first ? "" : ",").append("{\"biome\":").append(biome).append(",\"origin\":[8,8],\"events\":[").append(String.join(",", pw.log)).append("]}");
      first = false;
    }
    out.append("]");

    // ---- terrain fixture for the JS replay: per column ground y, surface block, pond, leaf y, glass y
    out.append(",\"terrain\":{\"size\":").append(N).append(",\"pondFloor\":").append(POND_FLOOR).append(",\"pondTop\":").append(POND_TOP).append(",\"columns\":[");
    for (int x = 0; x < N; x++)
      for (int z = 0; z < N; z++)
        out.append(x + z > 0 ? "," : "").append("[").append(ground[x][z]).append(",").append(surface[x][z]).append(",").append(pond[x][z] ? 1 : 0).append(",").append(leaf[x][z]).append(",").append(glass[x][z]).append("]");
    out.append("],\"lights\":[[8,45,8,14],[26,42,6,15]]}");

    System.out.println(out.append("}"));
  }
}
