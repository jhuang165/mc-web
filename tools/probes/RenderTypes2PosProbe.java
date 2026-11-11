import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 42: the render types 2 fixtures (RenderTypes2Probe.CENTRES: wire, levers, repeaters, comparators, pistons, tripwire, gates, walls, cauldron, hopper, anvil,
// flower pot, cocoa, stems, end frame, brewing stand, dragon egg, fire, plates, buttons, daylight sensors) at world positions other than the batch 38-40 ones:
// negative and chunk edge coordinates, heights 0, 1, 254 and 255, big magnitudes, so position dependent parts of the unchanged RenderBlocks (hash offsets, the
// pot's tile entity key, chunk-local light reads, signed products) show up. Inherits RenderTypes2Probe's lists, icons and chunk stand-in; same output format
// with "pos" on every fixture. Arguments: grass colormap PNG, foliage colormap PNG, seed. Prints one JSON line.
public class RenderTypes2PosProbe extends RenderTypes2Probe {
  static final int[][] POSITIONS = {
    {0, 64, 0}, {15, 64, 15}, {16, 70, 16}, {-1, 64, -1}, {-16, 3, -17}, {-17, 100, -15}, {31, 200, -33}, {-100, 64, 57}, {1000, 64, -1000}, {-1000, 64, 1000},
    {12345, 12, -6789}, {-12345, 90, 6789}, {47, 64, -48}, {255, 1, 255}, {-256, 254, -256}, {17, 128, 31}, {-15, 40, 1}, {2, 0, -2}, {33, 253, 14}, {-64, 255, -64},
    {63, 77, 64}, {-9, 31, 9}, {-33, 1, 47}, {30000, 64, -30000},
  };
  // LightFloatProbe.W answers ahb.b (World.getSavedLightValue) and ahb.a (getBlock) straight from its cell map, which skips two things the unchanged World code does:
  // getSavedLightValue clamps y to 0..255 (bytecode of ahb.b; the use-neighbour-brightness cells of ahb.a read their cell above through it), and the world has no
  // blocks below 0 or above 255. Fixtures at y 0, 1, 254 and 255 reach those cells, so this subclass restores both (the older probes never sit that close).
  public static class W2 extends LightFloatProbe.W {
    public int b(ahn type, int x, int y, int z) { return super.b(type, x, Math.min(255, Math.max(0, y)), z); }
    public aji a(int x, int y, int z) { return y < 0 || y > 255 ? aji.e(0) : super.a(x, y, z); }
    public int e(int x, int y, int z) { return y < 0 || y > 255 ? 0 : super.e(x, y, z); }
  }
  // Sweeps over a grid of positions (hash products change sign across the origin): fire (flicker/random side choice reads neighbours), flower pots (plant tile
  // entity), stems, cocoa, and the walls/gates (neighbour links), each {id, meta, x, y, z, density}.
  static final int[][] SWEEP = sweep();
  static int[][] sweep() {
    List<int[]> l = new ArrayList<>();
    int[][] blocks = {{51, 0}, {51, 5}, {140, 3}, {140, 11}, {104, 7}, {127, 5}, {127, 9}, {107, 1}, {139, 0}, {154, 2}, {145, 6}, {55, 9}, {117, 0}, {122, 0}};
    for (int bi = 0; bi < blocks.length; bi++) for (int ix = 0; ix < 3; ix++) for (int iz = 0; iz < 3; iz++)
      l.add(new int[] {blocks[bi][0], blocks[bi][1], ix * 7 - 7 + bi, (ix + iz) % 3 == 0 ? 254 : 64 + bi, iz * 7 - 7 - bi, (ix + iz) % 3});
    return l.toArray(new int[0][]);
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
    LightFloatProbe.W w = (LightFloatProbe.W) unsafe.allocateInstance(W2.class);
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
    for (int f = 0; f < CENTRES.length + SWEEP.length; f++) {
      boolean extra = true;
      int[] ex;
      if (f < CENTRES.length) { int[] pp = POSITIONS[g.nextInt(POSITIONS.length)]; ex = new int[] {CENTRES[f % CENTRES.length][0], CENTRES[f % CENTRES.length][1], pp[0], pp[1], pp[2], 1 + (f % 2)}; }
      else ex = SWEEP[f - CENTRES.length];
      int[] c = ex;
      // Batch 40 additions: fixtures at other positions (ex[2..4]) and with forced neighbour cells (ex[6..], groups of dx, dy, dz, id, meta), drawn after
      // every batch 38 fixture so the earlier records keep their random draws.
      int px = extra ? ex[2] : 8, py = extra ? ex[3] : 8, pz = extra ? ex[4] : 8;
      w.bx = px; w.by = py; w.bz = pz;
      double density = new double[] {0.12, 0.35, 0.65}[ex[5] % 3];
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
