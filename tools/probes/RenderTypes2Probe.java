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
public class RenderTypes2Probe {
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
    // 5 redstone wire (power 0-15 tints the colour)
    {55, 0}, {55, 1}, {55, 5}, {55, 8}, {55, 15},
    // 12 levers: eight orientations, thrown bit 8
    {69, 0}, {69, 1}, {69, 2}, {69, 3}, {69, 4}, {69, 5}, {69, 6}, {69, 7}, {69, 8}, {69, 9}, {69, 10}, {69, 11}, {69, 12}, {69, 13}, {69, 14}, {69, 15},
    // 15 repeaters (off and on), facing 0-3 x delay 0-3
    {93, 0}, {93, 1}, {93, 2}, {93, 3}, {93, 4}, {93, 6}, {93, 9}, {93, 15}, {94, 0}, {94, 5}, {94, 10}, {94, 15},
    // 37 comparators (off and on), facing and subtract bit, powered bit
    {149, 0}, {149, 1}, {149, 2}, {149, 3}, {149, 4}, {149, 7}, {149, 12}, {150, 0}, {150, 5}, {150, 12},
    // 16 piston bases (retracted and extended), 17 piston heads
    {33, 0}, {33, 1}, {33, 2}, {33, 3}, {33, 4}, {33, 5}, {33, 8}, {33, 9}, {33, 10}, {33, 11}, {33, 12}, {33, 13}, {29, 0}, {29, 1}, {29, 2}, {29, 5}, {29, 8}, {29, 9}, {29, 12}, {29, 13},
    {34, 0}, {34, 1}, {34, 2}, {34, 3}, {34, 4}, {34, 5}, {34, 8}, {34, 9}, {34, 10}, {34, 11}, {34, 12}, {34, 13},
    // 29 tripwire hook, 30 tripwire
    {131, 0}, {131, 1}, {131, 2}, {131, 3}, {131, 4}, {131, 5}, {131, 6}, {131, 7}, {131, 8}, {131, 12}, {131, 15}, {132, 0}, {132, 1}, {132, 4}, {132, 5}, {132, 6}, {132, 7},
    // 21 fence gates, 32 walls, 24 cauldron, 38 hopper
    {107, 0}, {107, 1}, {107, 2}, {107, 3}, {107, 4}, {107, 5}, {107, 6}, {107, 7}, {139, 0}, {139, 1}, {118, 0}, {118, 1}, {118, 2}, {118, 3}, {154, 0}, {154, 2}, {154, 3}, {154, 4}, {154, 5}, {154, 8}, {154, 10},
    // 35 anvil, 33 flower pot, 28 cocoa, 19 stems, 26 end portal frame, 25 brewing stand, 27 dragon egg, 3 fire
    {145, 0}, {145, 1}, {145, 2}, {145, 3}, {145, 4}, {145, 5}, {145, 6}, {145, 7}, {145, 8}, {145, 9}, {145, 10}, {145, 11},
    {140, 0}, {140, 1}, {140, 2}, {140, 3}, {140, 4}, {140, 5}, {140, 6}, {140, 7}, {140, 8}, {140, 9}, {140, 10}, {140, 11}, {140, 12}, {140, 13},
    {127, 0}, {127, 1}, {127, 2}, {127, 3}, {127, 4}, {127, 5}, {127, 6}, {127, 7}, {127, 8}, {127, 9}, {127, 10}, {127, 11},
    {104, 0}, {104, 3}, {104, 7}, {105, 0}, {105, 4}, {105, 7}, {120, 0}, {120, 1}, {120, 2}, {120, 3}, {120, 4}, {120, 5}, {120, 6}, {120, 7}, {117, 0}, {117, 1}, {117, 2}, {117, 3}, {117, 4}, {117, 7}, {122, 0},
    {51, 0}, {51, 3}, {51, 8}, {51, 15},
    // type 0 with bounds: daylight detectors, plates, buttons
    {151, 0}, {151, 8}, {70, 0}, {70, 1}, {72, 0}, {72, 1}, {147, 0}, {147, 1}, {148, 0}, {148, 5}, {77, 1}, {77, 2}, {77, 3}, {77, 4}, {77, 9}, {143, 1}, {143, 3}, {143, 12},
  };
  static final int[][] NEIGHBOURS = {
    {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {0, 0}, {1, 0}, {1, 0}, {1, 0}, {3, 0}, {20, 0}, {55, 0}, {55, 7}, {55, 15}, {55, 3}, {93, 0}, {93, 5}, {94, 2}, {94, 9}, {149, 0}, {149, 6}, {150, 3},
    {69, 5}, {69, 14}, {33, 0}, {33, 9}, {29, 1}, {29, 12}, {34, 2}, {131, 1}, {131, 6}, {132, 0}, {132, 4}, {107, 0}, {107, 5}, {139, 0}, {118, 0}, {154, 0}, {145, 0},
    {44, 0}, {44, 8}, {53, 0}, {85, 0}, {50, 5}, {75, 5}, {76, 3}, {27, 0}, {66, 0}, {64, 0}, {54, 0}, {95, 3}, {89, 0}, {77, 2}, {70, 0}, {151, 0}, {46, 0}, {76, 1}, {152, 0}, {23, 2}, {29, 2}, {33, 3}, {5, 0}, {35, 0}, {47, 0}, {5, 0}, {18, 0},
  };

  // BlockFlowerPot.createNewTileEntity by metadata (func_149929_a): {block id, damage} of the plant, null for empty.
  static final int[][] POT = {null, {38, 0}, {37, 0}, {6, 0}, {6, 1}, {6, 2}, {6, 3}, {40, 0}, {39, 0}, {81, 0}, {32, 0}, {31, 2}, {6, 4}, {6, 5}, null, null};

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
    alb.e(); // BlockFire.func_149843_e: the flammability tables the fire render reads (Bootstrap runs it in the game)
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
    try { LightFloatProbe.set(w, "s", new Random(5)); } catch (Throwable e) { System.err.println("no rand field"); }
    LightFloatProbe.C chunk = (LightFloatProbe.C) unsafe.allocateInstance(LightFloatProbe.C.class);
    chunk.world = w;
    java.util.Map<agt, aor> tiles = new java.util.HashMap<>();
    LightFloatProbe.set(chunk, "i", tiles); // Chunk.chunkTileEntityMap: the flower pot render reads its plant from the tile entity (TileEntityFlowerPot, apf)
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
      tiles.clear();
      if (c[0] == 140) tiles.put(new agt(8, 8, 8), POT[c[1]] != null ? new apf(adb.a(aji.e(POT[c[1]][0])), POT[c[1]][1]) : new apf());
      aji block = aji.e(c[0]);
      StringBuilder rec = new StringBuilder("{\"id\":").append(c[0]).append(",\"meta\":").append(c[1])
        .append(c[0] == 140 && POT[c[1]] != null ? ",\"pot\":[" + POT[c[1]][0] + "," + POT[c[1]][1] + "]" : "").append(",\"type\":").append(block.b()).append(",\"tint\":").append(block.d((ahl) w, 8, 8, 8) & 0xffffff).append(",\"ids\":[");
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
        try { rb.b(block, 8, 8, 8); } catch (Throwable e) { failed = true; System.err.println("render failed " + c[0] + ":" + c[1] + " " + e + " at " + e.getStackTrace()[0] + " " + e.getStackTrace()[1] + " " + e.getStackTrace()[2] + " " + e.getStackTrace()[3] + " " + e.getStackTrace()[4]); }
        int[] raw = (int[]) LightFloatProbe.get(t, "f");
        int used = (Integer) LightFloatProbe.get(t, "q");
        rec.append(ao > 0 ? "," : "");
        entry(rec, raw, used);
        reset.invoke(t);
        LightFloatProbe.field(bmh.class, "x").setBoolean(t, false);
      }
      if (failed) { System.err.println("fixture dropped"); continue; } // a neighbour the unscaffolded world cannot answer for (diode neighbours asking for a tile entity)
      out.append(count++ > 0 ? "," : "").append(rec).append("]}");
    }
    // Material.isSolid (awt.a()) of every original id: renderBlockLiquid's corner heights count non-solid materials as open cells.
    out.append("],\"materialSolid\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).o().a() ? 1 : 0);
    // Block.canProvidePower (aji.f()) and Block.isNormalCube (aji.r()): what the redstone wire render and the diodes ask of their neighbours.
    out.append("],\"canProvidePower\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).f() ? 1 : 0);
    out.append("],\"normalCube\":[");
    for (int id = 0; id < 256; id++) out.append(id > 0 ? "," : "").append(aji.e(id).r() ? 1 : 0);
    out.append("],\"icons\":[");
    for (int i = 0; i < names.size(); i++) out.append(i > 0 ? "," : "").append("\"").append(names.get(i)).append("\"");
    System.out.println(out.append("]}"));
  }
}
