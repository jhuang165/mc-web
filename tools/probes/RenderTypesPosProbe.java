import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 41 position coverage for RenderTypesProbe and LightFloatProbe (compiled together with them: reuses their centre lists, neighbour list, cell-map World
// and the RenderTypesProbe icon table). The two older probes sample the block at (8, 8, 8) only; here every fixture sits at a chosen world position, so the
// position-hashed parts of the unchanged 1.7.10 RenderBlocks (blm.b(aji, x, y, z)) are exercised: the crossed-squares offset, the lily pad's rotation (aji.b
// hash of x, y, z), negative coordinates (the hash takes the signed products), chunk edges (Chunk.getSavedLightValue sees chunk-local x/z, one chunk object per
// chunk coordinate here) and heights up to 255. Fixtures: the RenderTypesProbe and LightFloatProbe centre lists at random positions from POSITIONS, then
// sweeps over a grid of positions for the lily pad, tall grass, a red flower and the double plant. Output format = RenderTypesProbe plus "pos" per fixture.
// Arguments: grass colormap PNG, foliage colormap PNG, seed. Prints one JSON line.
public class RenderTypesPosProbe {
  // Hand picked: chunk edges (x or z & 15 = 0 or 15), negative coordinates on both axes, chunk corners, the world origin, big coordinates, extreme heights.
  static final int[][] POSITIONS = {
    {8, 8, 8}, {0, 64, 0}, {15, 64, 15}, {16, 70, 16}, {-1, 64, -1}, {-16, 3, -17}, {-17, 100, -15}, {31, 200, -33}, {-100, 64, 57}, {1000, 64, -1000},
    {-1000, 64, 1000}, {12345, 12, -6789}, {-12345, 90, 6789}, {47, 64, -48}, {-48, 64, 47}, {255, 1, 255}, {-256, 254, -256}, {17, 128, 31}, {-15, 40, 1},
    {2, 5, -2}, {33, 253, 14}, {-64, 64, -64}, {63, 77, 64}, {-9, 31, 9},
  };
  static final int[][] SWEEP_BLOCKS = {{111, 0}, {31, 1}, {38, 0}, {37, 0}, {175, 2}, {175, 8}, {106, 0}};

  public static class C3 extends apx {
    C3() { super((ahb) null, 0, 0); }
    public int a(ahn type, int x, int y, int z) { return world.b(type, cx * 16 + x, y, cz * 16 + z); }
    LightFloatProbe.W world; int cx, cz;
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
    rg register = name -> new RenderTypesProbe.Icon(String.valueOf(name));
    for (int id = 0; id < 256; id++) { aji b = aji.e(id); if (b != null && id != 0) try { b.a(register); } catch (Throwable e) {} }
    bbj settings = new bbj();
    bao.M = new bao();
    bao.M.u = settings;
    int N = LightFloatProbe.N;
    LightFloatProbe.W w = (LightFloatProbe.W) unsafe.allocateInstance(RenderTypes2PosProbe.W2.class) /* batch 42: clamps y to 0..255 in getSavedLightValue and has no blocks outside 0..255, as the unchanged World does */;
    LightFloatProbe.set(w, "t", unsafe.allocateInstance(aqq.class));
    w.ids = new int[N * N * N]; w.metas = new int[N * N * N]; w.sky = new int[N * N * N]; w.blk = new int[N * N * N];
    java.util.Map<Long, C3> chunks = new java.util.HashMap<>();
    w.chunkAt = (cx, cz) -> chunks.computeIfAbsent(((long) cx << 32) ^ (cz & 0xffffffffL), k -> {
      try {
        C3 c = (C3) unsafe.allocateInstance(C3.class);
        c.world = w; c.cx = cx; c.cz = cz;
        return c;
      } catch (Exception e) { throw new RuntimeException(e); }
    });
    blm rb = (blm) unsafe.allocateInstance(blm.class);
    LightFloatProbe.set(rb, "a", w);
    LightFloatProbe.set(rb, "q", bao.M);
    bmh t = bmh.a;
    java.lang.reflect.Method reset = bmh.class.getDeclaredMethod("d");
    reset.setAccessible(true);
    int centre = LightFloatProbe.slot(0, 0, 0);

    // Fixture list: {id, meta, x, y, z, density index}.
    List<int[]> list = new ArrayList<>();
    double[] densities = {0.2, 0.55};
    for (int pass = 0; pass < 2; pass++) {
      for (int[] c : RenderTypesProbe.CENTRES) { int[] p = POSITIONS[g.nextInt(POSITIONS.length)]; list.add(new int[] {c[0], c[1], p[0], p[1], p[2], pass}); }
      for (int[] c : LightFloatProbe.CENTRES) { int[] p = POSITIONS[g.nextInt(POSITIONS.length)]; list.add(new int[] {c[0], c[1], p[0], p[1], p[2], pass}); }
    }
    // Sweeps: a 10 x 10 grid of x/z around the origin (negative and positive, the hash products change sign) at two heights for the lily pad, and
    // a 6 x 6 grid for the other hashed plants, so every rotation and offset of the hash shows up.
    for (int[] c : SWEEP_BLOCKS) {
      int span = c[0] == 111 ? 10 : 6;
      for (int ix = 0; ix < span; ix++) for (int iz = 0; iz < span; iz++)
        list.add(new int[] {c[0], c[1], ix - span / 2 + (c[0] == 106 ? 14 : 0), c[0] == 111 && (ix + iz) % 2 == 1 ? 63 : 64, iz - span / 2 - (c[0] == 111 ? 0 : 20), 0});
    }

    // Vines under each kind of block (the top quad's rule is a block property, so one position is enough): {106, meta, x, y, z, pass, above id, above meta}.
    for (int above : new int[] {1, 5, 17, 18, 20, 79, 89, 95, 44, 53, 46, 52, 54, 62, 64, 81, 82, 86, 98, 102, 103, 110, 123, 130, 138, 152, 154, 155, 172, 12, 13, 19, 29, 33, 34, 35, 41, 61, 120, 125})
      list.add(new int[] {106, above % 2 == 0 ? 0 : 3, 3 + above % 5, 64, -3, 0, above, 0});

    StringBuilder out = new StringBuilder("{\"fixtures\":[");
    int count = 0;
    for (int[] fx : list) {
      int[] c = {fx[0], fx[1]};
      int px = fx[2], py = fx[3], pz = fx[4];
      w.bx = px; w.by = py; w.bz = pz;
      double density = densities[fx[5]];
      for (int i = 0; i < N * N * N; i++) {
        boolean air = g.nextDouble() > density;
        int[] n = air ? RenderTypesProbe.NEIGHBOURS[g.nextInt(7)] : RenderTypesProbe.NEIGHBOURS[g.nextInt(RenderTypesProbe.NEIGHBOURS.length)];
        w.ids[i] = n[0]; w.metas[i] = n[1];
        boolean dark = aji.e(n[0]).k() >= 15 && g.nextInt(3) != 0;
        w.sky[i] = dark ? 0 : g.nextInt(16);
        w.blk[i] = dark ? 0 : (g.nextInt(3) == 0 ? g.nextInt(16) : 0);
        if (g.nextInt(6) == 0) w.sky[i] = 15;
      }
      if (fx.length > 7) { int up = LightFloatProbe.slot(0, 1, 0); w.ids[up] = fx[6]; w.metas[up] = fx[7]; }
      w.ids[centre] = c[0]; w.metas[centre] = c[1];
      w.sky[centre] = g.nextInt(16); w.blk[centre] = g.nextInt(4) == 0 ? g.nextInt(16) : 0;
      w.biomeSeed = g.nextInt(1000);
      if (c[0] == 64 || c[0] == 71) {
        boolean upper = (c[1] & 8) != 0;
        int other = LightFloatProbe.slot(0, upper ? -1 : 1, 0);
        w.ids[other] = c[0]; w.metas[other] = upper ? g.nextInt(8) : 8 | g.nextInt(2);
      }
      if (c[0] == 175 && (c[1] & 8) != 0) { int below = LightFloatProbe.slot(0, -1, 0); w.ids[below] = 175; w.metas[below] = (g.nextInt(2) == 0) ? 0 : g.nextInt(6); }
      aji block = aji.e(c[0]);
      StringBuilder rec = new StringBuilder("{\"id\":").append(c[0]).append(",\"meta\":").append(c[1]).append(",\"pos\":[").append(px).append(",").append(py).append(",").append(pz)
        .append("],\"type\":").append(block.b()).append(",\"tint\":").append(block.d((ahl) w, px, py, pz) & 0xffffff).append(",\"ids\":[");
      for (int i = 0; i < w.ids.length; i++) rec.append(i > 0 ? "," : "").append(w.ids[i]);
      rec.append("],\"metas\":[");
      for (int i = 0; i < w.ids.length; i++) rec.append(i > 0 ? "," : "").append(w.metas[i]);
      rec.append("],\"light\":[");
      for (int i = 0; i < w.ids.length; i++) rec.append(i > 0 ? "," : "").append(w.sky[i] * 16 + w.blk[i]);
      rec.append("],\"ao\":[");
      boolean failed = false;
      for (int ao = 0; ao < 3; ao++) {
        settings.j = ao;
        LightFloatProbe.field(bmh.class, "x").setBoolean(t, false);
        t.b();
        try { rb.b(block, px, py, pz); } catch (Throwable e) { failed = true; System.err.println("render failed " + c[0] + ":" + c[1] + " " + e); }
        int[] raw = (int[]) LightFloatProbe.get(t, "f");
        int used = (Integer) LightFloatProbe.get(t, "q");
        rec.append(ao > 0 ? "," : "");
        RenderTypesProbe.entry(rec, raw, used);
        reset.invoke(t);
        LightFloatProbe.field(bmh.class, "x").setBoolean(t, false);
      }
      if (failed) { System.err.println("fixture dropped"); continue; }
      out.append(count++ > 0 ? "," : "").append(rec).append("]}");
    }
    out.append("],\"icons\":[");
    for (int i = 0; i < RenderTypesProbe.names.size(); i++) out.append(i > 0 ? "," : "").append("\"").append(RenderTypesProbe.names.get(i)).append("\"");
    System.out.println(out.append("]}"));
  }
}
