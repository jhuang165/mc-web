import java.awt.image.BufferedImage;
import java.io.File;
import java.lang.reflect.Field;
import java.util.HashMap;
import java.util.Random;
import javax.imageio.ImageIO;

// Runs the unchanged 1.7.10 RenderBlocks (blm) block renderer, render type 0 (blm.b(aji, x, y, z) -> q = renderStandardBlock), over random
// block neighbourhoods and records what it hands the real Tessellator (bmh): per vertex the position, the packed colour int
// (setColorOpaque_F: (int)(c * 255.0f) per channel) and the brightness int (setBrightness). The three ambient-occlusion settings
// (GameSettings.ambientOcclusion bbj.j = 0 off, 1 minimum, 2 maximum) take the colour-multiplier path (blm.d), the full AO path (blm.a) and the
// partial AO path (blm.b(..., float, float, float)). Light comes from an unchanged World (ahb) subclass whose raw sky/block values live in a
// cell map (World.getLightBrightnessForSkyBlocks, including the use-neighbour-brightness blocks, is the original code).
// Arguments: grass colormap PNG, foliage colormap PNG, seed. Prints one JSON line.
public class LightFloatProbe {
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
    public apx e(int cx, int cz) { return chunkAt != null ? chunkAt.apply(cx, cz) : chunk; }
    apx chunk;
    java.util.function.BiFunction<Integer, Integer, apx> chunkAt; // optional: one chunk object per chunk coordinate (blocks away from chunk 0)
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

  // {id, meta}: render type 0 blocks with full and partial bounds, translucent and tinted ones, light emitters.
  static final int[][] CENTRES = {
    {1, 0}, {2, 0}, {3, 0}, {3, 2}, {4, 0}, {12, 0}, {20, 0}, {18, 0}, {18, 1}, {18, 2}, {18, 3}, {161, 0}, {79, 0}, {95, 3}, {95, 0}, {95, 14}, {44, 0}, {44, 8}, {44, 3},
    {44, 11}, {126, 0}, {126, 8}, {89, 0}, {62, 2}, {78, 0}, {78, 3}, {78, 7}, {171, 0}, {171, 7}, {88, 0}, {60, 0}, {46, 0}, {80, 0}, {82, 0}, {17, 0}, {17, 4}, {17, 8},
    {98, 0}, {5, 0}, {35, 5}, {92, 0}, {92, 3}, {45, 0}, {49, 0}, {41, 0}, {42, 0}, {47, 0}, {57, 0}, {19, 0}, {103, 0}, {86, 0}, {99, 0}, {21, 0}, {73, 0}, {152, 0}, {173, 0},
  };
  static final int[][] NEIGHBOURS = {
    {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {1, 0}, {1, 0}, {1, 0}, {1, 0}, {3, 0}, {2, 0}, {20, 0}, {18, 0}, {79, 0}, {31, 1}, {38, 0}, {37, 0}, {66, 0}, {51, 0},
    {145, 0}, {46, 0}, {9, 0}, {44, 0}, {44, 8}, {89, 0}, {60, 0}, {111, 0}, {85, 0}, {50, 5}, {65, 2}, {106, 0}, {78, 0}, {171, 0}, {95, 3}, {81, 0}, {54, 0}, {96, 0},
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
    for (int f = 0; f < 3 * CENTRES.length; f++) {
      int[] c = CENTRES[f % CENTRES.length];
      double density = new double[] {0.15, 0.4, 0.7}[(f / CENTRES.length) % 3];
      for (int i = 0; i < N * N * N; i++) {
        boolean air = g.nextDouble() > density;
        int[] n = air ? NEIGHBOURS[g.nextInt(6)] : NEIGHBOURS[g.nextInt(NEIGHBOURS.length)];
        w.ids[i] = n[0]; w.metas[i] = n[1];
        boolean dark = aji.e(n[0]).k() >= 15 && g.nextInt(3) != 0; // opaque cells mostly store 0
        w.sky[i] = dark ? 0 : g.nextInt(16);
        w.blk[i] = dark ? 0 : (g.nextInt(3) == 0 ? g.nextInt(16) : 0);
        if (g.nextInt(6) == 0) w.sky[i] = 15;
      }
      int centre = slot(0, 0, 0);
      w.ids[centre] = c[0]; w.metas[centre] = c[1];
      w.sky[centre] = g.nextInt(16); w.blk[centre] = g.nextInt(4) == 0 ? g.nextInt(16) : 0;
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
