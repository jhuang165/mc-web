import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Sibling of LightFloatProbe (compiled together, reuses its World/Chunk cell-map scaffolding and the unchanged Block/Tessellator classes): runs the
// unchanged 1.7.10 RenderBlocks (blm.b(aji, x, y, z)) for render types other than 0 over random 5x5x5 neighbourhoods at the three ambient-occlusion
// settings (bbj.j 0/1/2) and records every vertex the real Tessellator (bmh) received, in emission order, as raw ints:
// x, y, z, u, v (Float.floatToRawIntBits of the stored floats), colour int, brightness int. Icons are distinct per registered name: an icon's u
// range is [2 * index, 2 * index + 1] and v is [0, 1], so a vertex's tile is floor(u / 2) and its in-tile fraction is u - 2 * index.
// Arguments: grass colormap PNG, foliage colormap PNG, seed. Prints one JSON line.
public class RenderTypesProbe {
  static final List<String> names = new ArrayList<>();
  public static class Icon implements rf {
    final String name; final int idx;
    Icon(String n) { name = n; idx = names.size(); names.add(n); }
    public int a() { return 16; }
    public int b() { return 16; }
    public float c() { return 2f * idx; }
    public float d() { return 2f * idx + 1f; }
    public float a(double d) { return 2f * idx + (float) d / 16f; }
    public float e() { return 0f; }
    public float f() { return 1f; }
    public float b(double d) { return (float) d / 16f; }
    public String g() { return name; }
  }

  // {id, meta}: render type per block (aji.b()); the metadata values cover orientations, heights, ages and the door/bed halves.
  static final int[][] CENTRES = {
    // 1 crossed squares: sapling, tall grass, dead bush, flowers, mushrooms, reeds, double plant
    {6, 0}, {6, 9}, {31, 0}, {31, 1}, {31, 2}, {32, 0}, {37, 0}, {38, 0}, {38, 3}, {39, 0}, {40, 0}, {83, 0}, {175, 2}, {175, 8}, {175, 0}, {175, 8}, {175, 9}, {175, 8},
    // 2 torches
    {50, 1}, {50, 2}, {50, 3}, {50, 4}, {50, 5}, {75, 5}, {75, 2}, {76, 1}, {76, 5},
    // 4 fluids
    {8, 0}, {8, 3}, {8, 7}, {8, 8}, {9, 0}, {10, 0}, {10, 5}, {11, 0},
    // 7 doors
    {64, 0}, {64, 1}, {64, 2}, {64, 3}, {64, 4}, {64, 7}, {64, 8}, {64, 9}, {64, 10}, {71, 0}, {71, 5}, {71, 8}, {71, 9},
    // 10 stairs
    {53, 0}, {53, 1}, {53, 2}, {53, 3}, {53, 4}, {53, 5}, {53, 6}, {53, 7}, {67, 0}, {67, 5}, {108, 2}, {109, 7}, {114, 1}, {128, 3}, {134, 4}, {135, 6}, {136, 0}, {156, 2},
    // 11 fences
    {85, 0}, {113, 0},
    // 13 cactus
    {81, 0}, {81, 5},
    // 6 crops, 8 ladder, 9 rails, 20 vines, 14 bed, 18 panes, 23 lily pad
    {59, 0}, {59, 7}, {141, 3}, {115, 2}, {65, 2}, {65, 3}, {65, 4}, {65, 5}, {66, 0}, {66, 1}, {66, 2}, {66, 5}, {66, 9}, {27, 1}, {157, 8}, {106, 0}, {106, 2}, {106, 8}, {26, 0}, {26, 8}, {26, 11},
    {102, 0}, {160, 4}, {111, 0},
    // 0 cubes (uv orientation of every face), 31 logs, 39 quartz pillars
    {1, 0}, {2, 0}, {3, 2}, {5, 0}, {24, 0}, {47, 0}, {58, 0}, {61, 3}, {86, 0}, {91, 1}, {23, 2}, {98, 1}, {35, 5}, {17, 0}, {17, 4}, {17, 8}, {155, 0}, {155, 1}, {155, 2}, {155, 3}, {155, 4}, {170, 0}, {170, 4}, {170, 8},
  };
  static final int[][] NEIGHBOURS = {
    {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {1, 0}, {1, 0}, {1, 0}, {3, 0}, {2, 0}, {20, 0}, {18, 0}, {79, 0}, {6, 0}, {31, 1}, {38, 0}, {37, 0}, {50, 5}, {75, 5},
    {8, 0}, {9, 0}, {8, 2}, {8, 8}, {10, 0}, {11, 0}, {10, 4}, {44, 0}, {44, 8}, {53, 0}, {53, 6}, {67, 3}, {85, 0}, {113, 0}, {81, 0}, {64, 0}, {64, 8}, {71, 3}, {95, 3}, {95, 0}, {102, 0}, {65, 2},
    {66, 0}, {106, 0}, {26, 0}, {78, 0}, {78, 3}, {89, 0}, {17, 0}, {60, 0}, {111, 0}, {46, 0}, {54, 0}, {96, 0}, {145, 0}, {35, 5}, {160, 4},
  };

  static void entry(StringBuilder out, int[] raw, int used) {
    out.append("[");
    for (int i = 0; i < used; i++) {
      int o = i * 8;
      out.append(i > 0 ? "," : "").append(raw[o]).append(",").append(raw[o + 1]).append(",").append(raw[o + 2]).append(",").append(raw[o + 3]).append(",").append(raw[o + 4]).append(",").append(raw[o + 5]).append(",").append(raw[o + 7]);
    }
    out.append("]");
  }

  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    sun.misc.Unsafe unsafe = (sun.misc.Unsafe) uf.get(null);
    LightFloatProbe.unsafe = unsafe;
    aji.p();
    aha.a(LightFloatProbe.pixels(args[0]));
    agx.a(LightFloatProbe.pixels(args[1]));
    ((alt) aji.e(18)).b(true); ((alt) aji.e(161)).b(true); blm.b = true;
    Random g = new Random(Long.parseLong(args[2]));
    rg register = name -> new Icon(String.valueOf(name));
    for (int id = 0; id < 256; id++) { aji b = aji.e(id); if (b != null && id != 0) try { b.a(register); } catch (Throwable e) {} }
    bbj settings = new bbj();
    bao.M = new bao();
    bao.M.u = settings;
    int R = LightFloatProbe.R, N = LightFloatProbe.N;
    LightFloatProbe.W w = (LightFloatProbe.W) unsafe.allocateInstance(LightFloatProbe.W.class);
    LightFloatProbe.set(w, "t", unsafe.allocateInstance(aqq.class));
    w.ids = new int[N * N * N]; w.metas = new int[N * N * N]; w.sky = new int[N * N * N]; w.blk = new int[N * N * N];
    w.bx = 8; w.by = 8; w.bz = 8;
    LightFloatProbe.C chunk = (LightFloatProbe.C) unsafe.allocateInstance(LightFloatProbe.C.class);
    chunk.world = w;
    w.chunk = chunk;
    blm rb = (blm) unsafe.allocateInstance(blm.class);
    LightFloatProbe.set(rb, "a", w);
    LightFloatProbe.set(rb, "q", bao.M);
    bmh t = bmh.a;
    java.lang.reflect.Method reset = bmh.class.getDeclaredMethod("d");
    reset.setAccessible(true);
    int centre = LightFloatProbe.slot(0, 0, 0);

    StringBuilder out = new StringBuilder("{\"fixtures\":[");
    int count = 0;
    for (int f = 0; f < 3 * CENTRES.length; f++) {
      int[] c = CENTRES[f % CENTRES.length];
      double density = new double[] {0.12, 0.35, 0.65}[(f / CENTRES.length) % 3];
      for (int i = 0; i < N * N * N; i++) {
        boolean air = g.nextDouble() > density;
        int[] n = air ? NEIGHBOURS[g.nextInt(7)] : NEIGHBOURS[g.nextInt(NEIGHBOURS.length)];
        w.ids[i] = n[0]; w.metas[i] = n[1];
        boolean dark = aji.e(n[0]).k() >= 15 && g.nextInt(3) != 0;
        w.sky[i] = dark ? 0 : g.nextInt(16);
        w.blk[i] = dark ? 0 : (g.nextInt(3) == 0 ? g.nextInt(16) : 0);
        if (g.nextInt(6) == 0) w.sky[i] = 15;
      }
      w.ids[centre] = c[0]; w.metas[centre] = c[1];
      w.sky[centre] = g.nextInt(16); w.blk[centre] = g.nextInt(4) == 0 ? g.nextInt(16) : 0;
      w.biomeSeed = g.nextInt(1000);
      // renderBlockDoor (blm.u) draws nothing unless the other half is the same door block: lower halves (metadata bit 8 clear) need it above, upper halves below.
      if (c[0] == 64 || c[0] == 71) {
        boolean upper = (c[1] & 8) != 0;
        int other = LightFloatProbe.slot(0, upper ? -1 : 1, 0);
        w.ids[other] = c[0]; w.metas[other] = upper ? g.nextInt(8) : 8 | g.nextInt(2);
      }
      // The double plant (blm.a(ako, ...)) draws nothing for an upper half without the plant below it.
      if (c[0] == 175 && (c[1] & 8) != 0) { int below = LightFloatProbe.slot(0, -1, 0); w.ids[below] = 175; w.metas[below] = (g.nextInt(2) == 0) ? 0 : g.nextInt(6); }
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
        LightFloatProbe.field(bmh.class, "x").setBoolean(t, false);
        t.b();
        rb.b(block, 8, 8, 8);
        int[] raw = (int[]) LightFloatProbe.get(t, "f");
        int used = (Integer) LightFloatProbe.get(t, "q");
        rec.append(ao > 0 ? "," : "");
        entry(rec, raw, used);
        reset.invoke(t);
        LightFloatProbe.field(bmh.class, "x").setBoolean(t, false);
      }
      out.append(count++ > 0 ? "," : "").append(rec).append("]}");
    }
    // Material.isSolid (awt.a()) of every original id: renderBlockLiquid's corner heights count non-solid materials as open cells.
    out.append("],\"materialSolid\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).o().a() ? 1 : 0);
    out.append("],\"icons\":[");
    for (int i = 0; i < names.size(); i++) out.append(i > 0 ? "," : "").append("\"").append(names.get(i)).append("\"");
    System.out.println(out.append("]}"));
  }
}
