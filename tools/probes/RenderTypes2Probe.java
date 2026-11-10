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


  // Batch 40 fixtures: {id, meta, x, y, z, density index, then forced neighbour cells as groups of dx, dy, dz, id, meta}.
  static final java.util.List<int[]> EXTRA_LIST = new ArrayList<>();
  static void add(int id, int meta, int x, int y, int z, int d, int... forced) {
    int[] e = new int[6 + forced.length];
    e[0] = id; e[1] = meta; e[2] = x; e[3] = y; e[4] = z; e[5] = d;
    System.arraycopy(forced, 0, e, 6, forced.length);
    EXTRA_LIST.add(e);
  }
  static final int[][] POSITIONS = {{37, 70, -22}, {-5, 3, 129}, {1000, 64, -1000}, {-33, 200, 17}, {12345, 12, -6789}, {0, 0, 0}};
  static int[][] extras() {
    // Iron bars (101, type 18): the sixteen masks of the four horizontal neighbours (north -z, south +z, west -x, east +x) as stone or air, then bars, panes and glass next to bars.
    int[][] dirs = {{0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
    for (int mask = 0; mask < 16; mask++) {
      int[] forced = new int[20];
      for (int k = 0; k < 4; k++) { forced[k * 5] = dirs[k][0]; forced[k * 5 + 1] = dirs[k][1]; forced[k * 5 + 2] = dirs[k][2]; forced[k * 5 + 3] = (mask >> k & 1) != 0 ? 1 : 0; forced[k * 5 + 4] = 0; }
      add(101, 0, 8, 8, 8, mask % 3, forced);
    }
    int[] linked = {101, 102, 20, 95, 160, 18, 53, 44};
    for (int k = 0; k < linked.length; k++) add(101, 0, 8, 8, 8, k % 3, 1, 0, 0, linked[k], linked[k] == 95 || linked[k] == 160 ? 5 : 0, -1, 0, 0, linked[(k + 3) % linked.length], 0, 0, 1, 0, 101, 0);
    // Stems (104 pumpkin, 105 melon): fully grown (7) next to the fruit in each direction (-x, +x, -z, +z), two fruits (the first direction wins), the other stem's fruit, and age 6 with fruit.
    int[][] fruitDir = {{-1, 0, 0}, {1, 0, 0}, {0, 0, -1}, {0, 0, 1}};
    for (int stem = 104; stem <= 105; stem++) {
      int fruit = stem == 104 ? 86 : 103, other = stem == 104 ? 103 : 86;
      for (int k = 0; k < 4; k++) add(stem, 7, 8, 8, 8, k % 3, fruitDir[k][0], 0, fruitDir[k][2], fruit, 0);
      add(stem, 7, 8, 8, 8, 1, 1, 0, 0, fruit, 0, 0, 0, 1, fruit, 0);
      add(stem, 7, 8, 8, 8, 2, 0, 0, -1, fruit, 0, -1, 0, 0, fruit, 0);
      add(stem, 7, 8, 8, 8, 0, -1, 0, 0, other, 0);
      add(stem, 6, 8, 8, 8, 1, 1, 0, 0, fruit, 0);
      add(stem, 7, 37, 70, -22, 2, 0, 0, 1, fruit, 0);
      add(stem, 3, -5, 3, 129, 0, -1, 0, 0, fruit, 0);
    }
    // Position hashed drawing: tall grass (31 grass 1, fern 2, dead shrub 0), dandelion 37, red flowers 38, double plants 175 (lower and upper halves), lily pad 111, fire 51, and the unhashed plants beside them.
    for (int i = 0; i < POSITIONS.length; i++) {
      int[] q = POSITIONS[i];
      int[] metas31 = {0, 1, 2};
      for (int m : metas31) if (i < 4) add(31, m, q[0], q[1], q[2], (i + m) % 3);
      add(37, 0, q[0], q[1], q[2], i % 3);
      add(38, i % 9, q[0], q[1], q[2], (i + 1) % 3);
      add(175, new int[] {0, 2, 3, 8, 9, 10}[i], q[0], q[1], q[2], (i + 2) % 3);
      add(111, 0, q[0], q[1], q[2], i % 3);
      add(51, i % 2 == 0 ? 0 : 5, q[0], q[1], q[2], (i + 1) % 3);
      if (i < 3) { add(32, 0, q[0], q[1], q[2], i); add(6, i, q[0], q[1], q[2], i); add(39, 0, q[0], q[1], q[2], i); add(40, 0, q[0], q[1], q[2], i); add(83, 0, q[0], q[1], q[2], i); add(140, 11, q[0], q[1], q[2], i); }
    }
    add(111, 0, 41, 66, 7, 1); add(111, 0, 42, 66, 7, 1); add(111, 0, 41, 66, 8, 1); add(111, 0, -17, 62, -9, 0);
    add(51, 0, 9, 8, 8, 2); add(51, 3, 8, 9, 8, 1); add(51, 15, 8, 8, 9, 0);
    return EXTRA_LIST.toArray(new int[0][]);
  }
  static final int[][] EXTRAS = extras();

  // Chunk.getSavedLightValue (apx.a(ahn, x, y, z)) with chunk-local x and z, answered from the world's cell map.
  public static class C2 extends apx {
    C2() { super((ahb) null, 0, 0); }
    public int a(ahn type, int x, int y, int z) { return world.b(type, cx * 16 + x, y, cz * 16 + z); }
    LightFloatProbe.W world; int cx, cz;
  }

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
    adb.l(); // Item.registerItems: the ItemBlocks the pot's plant lookup goes through (Item.getItemFromBlock, Block.getBlockFromItem)
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
    // One Chunk per chunk coordinate: the light of a block that does not read its neighbours' brightness goes Chunk.getSavedLightValue with chunk-local
    // x and z, so the stand-in maps them back to world cells; the tile entity map is the chunk's (key = chunk-local position).
    java.util.Map<Long, C2> chunks = new java.util.HashMap<>();
    w.chunkAt = (cx, cz) -> chunks.computeIfAbsent(((long) cx << 32) ^ (cz & 0xffffffffL), k -> {
      try {
        C2 c = (C2) unsafe.allocateInstance(C2.class);
        c.world = w; c.cx = cx; c.cz = cz;
        LightFloatProbe.set(c, "i", new java.util.HashMap<agt, aor>()); // Chunk.chunkTileEntityMap: the flower pot render reads its plant from the tile entity (TileEntityFlowerPot, apf)
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

    StringBuilder out = new StringBuilder("{\"fixtures\":[");
    int count = 0;
    for (int f = 0; f < 3 * CENTRES.length + EXTRAS.length; f++) {
      boolean extra = f >= 3 * CENTRES.length;
      int[] ex = extra ? EXTRAS[f - 3 * CENTRES.length] : null;
      int[] c = extra ? ex : CENTRES[f % CENTRES.length];
      // Batch 40 additions: fixtures at other positions (ex[2..4]) and with forced neighbour cells (ex[6..], groups of dx, dy, dz, id, meta), drawn after
      // every batch 38 fixture so the earlier records keep their random draws.
      int px = extra ? ex[2] : 8, py = extra ? ex[3] : 8, pz = extra ? ex[4] : 8;
      w.bx = px; w.by = py; w.bz = pz;
      double density = new double[] {0.12, 0.35, 0.65}[extra ? ex[5] : (f / CENTRES.length) % 3];
      for (int i = 0; i < N * N * N; i++) {
        boolean air = g.nextDouble() > density;
        int[] n = air ? NEIGHBOURS[g.nextInt(7)] : NEIGHBOURS[g.nextInt(NEIGHBOURS.length)];
        w.ids[i] = n[0]; w.metas[i] = n[1];
        boolean dark = aji.e(n[0]).k() >= 15 && g.nextInt(3) != 0;
        w.sky[i] = dark ? 0 : g.nextInt(16);
        w.blk[i] = dark ? 0 : (g.nextInt(3) == 0 ? g.nextInt(16) : 0);
        if (g.nextInt(6) == 0) w.sky[i] = 15;
      }
      if (extra) for (int k = 6; k + 4 < ex.length; k += 5) { int fs = LightFloatProbe.slot(ex[k], ex[k + 1], ex[k + 2]); w.ids[fs] = ex[k + 3]; w.metas[fs] = ex[k + 4]; w.sky[fs] = 15; w.blk[fs] = 0; }
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
      chunks.values().forEach(k -> { try { ((java.util.Map<agt, aor>) LightFloatProbe.get(k, "i")).clear(); } catch (Exception e) { throw new RuntimeException(e); } });
      if (c[0] == 140) ((java.util.Map<agt, aor>) LightFloatProbe.get(w.e(px >> 4, pz >> 4), "i")).put(new agt(px & 15, py, pz & 15), POT[c[1]] != null ? new apf(adb.a(aji.e(POT[c[1]][0])), POT[c[1]][1]) : new apf());
      aji block = aji.e(c[0]);
      StringBuilder rec = new StringBuilder("{\"id\":").append(c[0]).append(",\"meta\":").append(c[1])
        .append(c[0] == 140 && POT[c[1]] != null ? ",\"pot\":[" + POT[c[1]][0] + "," + POT[c[1]][1] + "]" : "").append(c[0] == 140 && POT[c[1]] != null ? ",\"plantTint\":" + (aji.e(POT[c[1]][0]).d((ahl) w, px, py, pz) & 0xffffff) : "").append(extra ? ",\"pos\":[" + px + "," + py + "," + pz + "]" : "").append(",\"type\":").append(block.b()).append(",\"tint\":").append(block.d((ahl) w, px, py, pz) & 0xffffff).append(",\"ids\":[");
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
        try { rb.b(block, px, py, pz); } catch (Throwable e) { failed = true; System.err.println("render failed " + c[0] + ":" + c[1] + " " + e + " at " + e.getStackTrace()[0] + " " + e.getStackTrace()[1] + " " + e.getStackTrace()[2] + " " + e.getStackTrace()[3] + " " + e.getStackTrace()[4]); }
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
