import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Random;
import javax.imageio.ImageIO;

// Batch 40 slab light: the same unchanged RenderBlocks harness, with fixtures built to hit Block.getMixedBrightnessForBlock (aji.c(ahl,x,y,z)): half and double slabs,
// stairs, farmland, soul sand and other use-neighbour-brightness blocks under opaque cubes, beside torches and in dark cells (a slab at brightness 0 re-queries the
// cell below). Runs the unchanged 1.7.10 RenderBlocks (blm) block renderer, render type 0 (blm.b(aji, x, y, z) -> q = renderStandardBlock), over random
// block neighbourhoods and records what it hands the real Tessellator (bmh): per vertex the position, the packed colour int
// (setColorOpaque_F: (int)(c * 255.0f) per channel) and the brightness int (setBrightness). The three ambient-occlusion settings
// (GameSettings.ambientOcclusion bbj.j = 0 off, 1 minimum, 2 maximum) take the colour-multiplier path (blm.d), the full AO path (blm.a) and the
// partial AO path (blm.b(..., float, float, float)). Light comes from an unchanged World (ahb) subclass whose raw sky/block values live in a
// cell map (World.getLightBrightnessForSkyBlocks, including the use-neighbour-brightness blocks, is the original code).
// Arguments: grass colormap PNG, foliage colormap PNG, seed. Prints one JSON line.
public class SlabLightProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static void set(Object o, String name, Object v) throws Exception { field(o.getClass(), name).set(o, v); }
  static Object get(Object o, String name) throws Exception { return field(o.getClass(), name).get(o); }

  static final int R = 2, N = 5; // cells -2..2 around the block
  static int slot(int dx, int dy, int dz) { return ((dx + R) * N + (dy + R)) * N + (dz + R); }

  public static class W extends ahb {
    int[] ids = new int[N * N * N], metas = new int[N * N * N], sky = new int[N * N * N], blk = new int[N * N * N];
    int bx = 8, by = 8, bz = 8, biomeSeed;
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    int at(int x, int y, int z) {
      int dx = x - bx, dy = y - by, dz = z - bz;
      return Math.abs(dx) > R || Math.abs(dy) > R || Math.abs(dz) > R ? -1 : slot(dx, dy, dz);
    }
    public aji a(int x, int y, int z) { int s = at(x, y, z); return aji.e(s < 0 ? 0 : ids[s]); }
    public int e(int x, int y, int z) { int s = at(x, y, z); return s < 0 ? 0 : metas[s]; }
    public boolean c(int cx, int cz) { return true; } // chunkExists
    // Raw saved light (World.getSavedLightValue through Chunk.getSavedLightValue): the cell map.
    public int b(ahn type, int x, int y, int z) { int s = at(x, y, z); return s < 0 ? 0 : (type == ahn.a ? sky[s] : blk[s]); }
    public apx e(int cx, int cz) { return chunk; }
    apx chunk;
    public ahu a(int x, int z) {
      ahu[] all = ahu.n();
      long h = (long) x * 341873128712L + (long) z * 132897987541L + (long) x * z * 31L + biomeSeed;
      h ^= h >>> 13; h *= 0x9E3779B97F4A7C15L; h ^= h >>> 29;
      int i = (int) Math.floorMod(h, (long) all.length);
      while (all[i] == null) i = (i + 1) % all.length;
      return all[i];
    }
  }

  // Chunk.getSavedLightValue (apx.a(ahn, x, y, z)) with chunk-local x and z: the world's cell map (the block sits inside chunk 0).
  public static class C extends apx {
    C() { super((ahb) null, 0, 0); }
    public int a(ahn type, int x, int y, int z) { return world.b(type, x, y, z); }
    W world;
  }

  public static class Icon implements rf {
    final String name;
    Icon(String n) { name = n; }
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 0f; }
    public float d() { return 1f; }
    public float a(double d) { return (float) d / 16f; }
    public float e() { return 0f; }
    public float f() { return 1f; }
    public float b(double d) { return (float) d / 16f; }
    public String g() { return name; }
  }

  static int[] pixels(String path) throws Exception {
    BufferedImage img = ImageIO.read(new File(path));
    int[] a = new int[65536];
    img.getRGB(0, 0, 256, 256, a, 0, 256);
    return a;
  }

  // {id, meta}: slabs (stone, sandstone, wood, double), stairs of the three half/facing kinds, farmland, soul sand, plants and other use-neighbour blocks.
  static final int[][] CENTRES = {
    {44, 0}, {44, 8}, {44, 1}, {44, 9}, {44, 3}, {126, 0}, {126, 8}, {126, 5}, {43, 0}, {43, 8}, {125, 0}, {125, 2},
    {67, 0}, {67, 2}, {67, 5}, {67, 7}, {53, 1}, {53, 4}, {53, 6}, {108, 3}, {114, 0}, {156, 2}, {128, 1},
    {60, 0}, {60, 7}, {88, 0}, {78, 0}, {78, 3}, {85, 0}, {50, 5}, {20, 0}, {79, 0}, {82, 0}, {171, 0},
  };
  // Surroundings: opaque cubes, air, light sources, other slabs and stairs.
  static final int[][] CAPS = {{1, 0}, {3, 0}, {4, 0}, {17, 0}, {5, 0}};
  static final int[][] NEIGHBOURS = {
    {0, 0}, {0, 0}, {0, 0}, {0, 0}, {1, 0}, {1, 0}, {3, 0}, {2, 0}, {44, 0}, {44, 8}, {67, 0}, {53, 4}, {60, 0}, {50, 5}, {89, 0}, {20, 0}, {18, 0}, {85, 0}, {171, 0}, {88, 0},
  };

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); // Block.registerBlocks
    aha.a(pixels(args[0]));
    agx.a(pixels(args[1]));
    ((alt) aji.e(18)).b(true); ((alt) aji.e(161)).b(true); blm.b = true; // Fancy graphics: BlockLeaves.setGraphicsLevel(true), RenderBlocks.fancyGrass
    Random g = new Random(Long.parseLong(args[2]));
    rg register = name -> new Icon(String.valueOf(name)); // IIconRegister: icons named after their texture, as the grass_side overlay checks need
    for (int id = 0; id < 256; id++) { aji b = aji.e(id); if (b != null && id != 0) try { b.a(register); } catch (Throwable e) {} }
    bbj settings = new bbj();
    bao.M = new bao();
    bao.M.u = settings;
    W w = (W) unsafe.allocateInstance(W.class);
    set(w, "t", unsafe.allocateInstance(aqq.class)); // WorldProviderSurface
    w.ids = new int[N * N * N]; w.metas = new int[N * N * N]; w.sky = new int[N * N * N]; w.blk = new int[N * N * N];
    w.bx = 8; w.by = 8; w.bz = 8;
    C chunk = (C) unsafe.allocateInstance(C.class);
    chunk.world = w;
    w.chunk = chunk;
    blm rb = (blm) unsafe.allocateInstance(blm.class); // blm's constructor needs LWJGL
    set(rb, "a", w);
    set(rb, "q", bao.M);
    bmh t = bmh.a;
    java.lang.reflect.Method reset = bmh.class.getDeclaredMethod("d");
    reset.setAccessible(true);

    StringBuilder out = new StringBuilder("{\"lightValues\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).m());
    out.append("],\"aoValues\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append((double) aji.e(id).I());
    out.append("],\"cornerOpen\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).l() ? 1 : 0);
    out.append("],\"neighborBrightness\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).n() ? 1 : 0);
    out.append("],\"fixtures\":[");
    int count = 0;
    for (int f = 0; f < 12 * CENTRES.length; f++) {
      int[] c = CENTRES[f % CENTRES.length];
      int scen = (f / CENTRES.length) % 6;
      for (int i = 0; i < N * N * N; i++) {
        int[] n = scen == 0 || scen == 1 ? NEIGHBOURS[0] : NEIGHBOURS[g.nextInt(NEIGHBOURS.length)];
        w.ids[i] = n[0]; w.metas[i] = n[1];
        w.sky[i] = 0; w.blk[i] = 0; // dark world; scenarios light selected cells
        if (scen >= 4) { boolean dark = aji.e(n[0]).k() >= 15 && g.nextInt(3) != 0; w.sky[i] = dark ? 0 : g.nextInt(16); w.blk[i] = dark ? 0 : (g.nextInt(3) == 0 ? g.nextInt(16) : 0); }
      }
      int below = slot(0, -1, 0), above = slot(0, 1, 0);
      if (scen == 0) { // everything around dark air; only the cell below holds light
        w.sky[below] = g.nextInt(16); w.blk[below] = g.nextInt(3) == 0 ? g.nextInt(16) : 0;
        if (g.nextInt(3) == 0) { w.ids[below] = 44; w.metas[below] = g.nextInt(2) * 8; }
        if (g.nextInt(4) == 0) { w.ids[below] = 89; w.metas[below] = 0; w.blk[below] = 15; }
        if (g.nextInt(5) == 0) { w.ids[below] = 50; w.metas[below] = 5; w.blk[below] = 14; }
      } else if (scen == 1) { // under an opaque cube (stone and others), below lit, the sides open or capped
        int[] cap = CAPS[g.nextInt(CAPS.length)];
        w.ids[above] = cap[0]; w.metas[above] = cap[1];
        w.sky[below] = g.nextInt(16); w.blk[below] = 0;
        for (int d = 0; d < 4; d++) if (g.nextBoolean()) {
          int s = d == 0 ? slot(1, 0, 0) : d == 1 ? slot(-1, 0, 0) : d == 2 ? slot(0, 0, 1) : slot(0, 0, -1);
          w.ids[s] = cap[0]; w.metas[s] = cap[1];
        }
      } else if (scen == 2) { // a torch or lamp beside the block, darkness elsewhere
        int s = new int[] {slot(1, 0, 0), slot(-1, 0, 0), slot(0, 0, 1), slot(0, 0, -1), slot(1, 1, 0), slot(0, 0, 2), slot(1, 0, 1), slot(0, -1, 1)}[g.nextInt(8)];
        w.ids[s] = g.nextBoolean() ? 50 : 89; w.metas[s] = w.ids[s] == 50 ? 5 : 0; w.blk[s] = w.ids[s] == 50 ? 14 : 15;
        if (g.nextBoolean()) w.sky[slot(0, 1, 0)] = g.nextInt(16);
      } else if (scen == 3) { // an edge: part of the ring stone, part open sky
        for (int dx = -R; dx <= R; dx++) for (int dz = -R; dz <= R; dz++) {
          boolean open = dx + dz * 2 > g.nextInt(3) - 1;
          for (int dy = -R; dy <= R; dy++) {
            int s = slot(dx, dy, dz);
            if (dx == 0 && dy == 0 && dz == 0) continue;
            if (open) { w.ids[s] = dy < 0 ? 3 : 0; w.sky[s] = dy < 0 ? 0 : 15; w.blk[s] = 0; }
            else { w.ids[s] = 1; w.metas[s] = 0; w.sky[s] = 0; w.blk[s] = 0; }
          }
        }
      }
      w.sky[slot(0, 0, 0)] = 0; w.blk[slot(0, 0, 0)] = 0;
      int centre = slot(0, 0, 0);
      w.ids[centre] = c[0]; w.metas[centre] = c[1];
      if (scen >= 4) { w.sky[centre] = g.nextInt(16); w.blk[centre] = g.nextInt(4) == 0 ? g.nextInt(16) : 0; }
      w.biomeSeed = g.nextInt(1000);
      aji block = aji.e(c[0]);
      StringBuilder rec = new StringBuilder("{\"id\":").append(c[0]).append(",\"meta\":").append(c[1])
        .append(",\"type\":").append(block.b()).append(",\"tint\":").append(block.d((ahl) w, 8, 8, 8) & 0xffffff).append(",\"ids\":[");
      for (int i = 0; i < w.ids.length; i++) rec.append(i > 0 ? "," : "").append(w.ids[i]);
      rec.append("],\"metas\":[");
      for (int i = 0; i < w.ids.length; i++) rec.append(i > 0 ? "," : "").append(w.metas[i]);
      rec.append("],\"light\":[");
      for (int i = 0; i < w.ids.length; i++) rec.append(i > 0 ? "," : "").append(w.sky[i] * 16 + w.blk[i]);
      rec.append("],\"ao\":[");
      for (int ao = 0; ao < 3; ao++) {
        settings.j = ao;
        field(bmh.class, "x").setBoolean(t, false);
        t.b(); // startDrawingQuads
        rb.b(block, 8, 8, 8);
        int[] raw = (int[]) get(t, "f");
        int used = (Integer) get(t, "q");
        rec.append(ao > 0 ? "," : "").append("[");
        for (int i = 0; i < used; i++) {
          int o = i * 8;
          int px = Math.round((Float.intBitsToFloat(raw[o]) - 8) * 64), py = Math.round((Float.intBitsToFloat(raw[o + 1]) - 8) * 64), pz = Math.round((Float.intBitsToFloat(raw[o + 2]) - 8) * 64);
          if (Math.abs(Float.intBitsToFloat(raw[o]) - 8 - px / 64f) > 1e-5 || Math.abs(Float.intBitsToFloat(raw[o + 1]) - 8 - py / 64f) > 1e-5 || Math.abs(Float.intBitsToFloat(raw[o + 2]) - 8 - pz / 64f) > 1e-5)
            throw new AssertionError("position not a 1/64 multiple");
          rec.append(i > 0 ? "," : "").append(px).append(",").append(py).append(",").append(pz).append(",").append(raw[o + 5]).append(",").append(raw[o + 7]);
        }
        rec.append("]");
        reset.invoke(t);
        field(bmh.class, "x").setBoolean(t, false);
      }
      out.append(count++ > 0 ? "," : "").append(rec).append("]}");
    }
    System.out.println(out.append("]}"));
  }
}

class bbj { public boolean e; public int j; }
class bao {
  static bao M;
  public bbj u;
  public static bao B() { return M; }
  public static boolean y() { return M != null && M.u.j != 0; }
}
