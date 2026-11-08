import java.util.Random;

// Random ticks in the Nether and End (batch 28). Runs on the LightEngine3Probe harness (unchanged World/Chunk light code over real chunks -3..3, real
// WorldProviderHell/End), settles the light, then calls the unchanged BlockMushroom.updateTick (amc.a) with seeded java.util.Random on mushrooms at
// several cells and records, per trial, getFullBlockLightValue (ahb.j) at the cell and getBlockLightValue (ahb.k) one above it, the cells written (World.setBlock),
// and the next int of the Random (its consumption). Each trial's writes are undone (flag 2) before the next. Output: one JSON line per scenario
// {case, fills, ops, snaps, provider (LightEngine3Probe record format), trials}. Compile together with LightEngine3Probe.
public class DimRandomTickProbe {
  static final int[][] SITES = {{0, 41, 0}, {3, 41, 1}, {-6, 41, -4}, {12, 41, 3}, {5, 41, -9}, {-2, 41, 8}};

  public static void main(String[] a) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    LightEngine3Probe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    for (String k : new String[] {"nether", "end"}) {
      int floor = k.equals("nether") ? 87 : 121;
      LightEngine3Probe.begin(k);
      LightEngine3Probe.fill(-48, 0, -48, 63, 0, 63, 7, 0);
      LightEngine3Probe.fill(-48, 1, -48, 63, 40, 63, floor, 0);
      LightEngine3Probe.fill(-20, 41, -20, 20, 70, 20, 0, 0);
      if (k.equals("nether")) { LightEngine3Probe.fill(-48, 127, -48, 63, 127, 63, 7, 0); LightEngine3Probe.fill(7, 41, 3, 9, 42, 5, 10, 0); }
      LightEngine3Probe.anchors();
      LightEngine3Probe.gen(); LightEngine3Probe.op("[\"terrain\"]"); LightEngine3Probe.tick(); LightEngine3Probe.tick();
      // glowstone and torch near some sites so the full light value crosses the 13 threshold
      LightEngine3Probe.edit(4, 42, 1, 89, 0, "glowstone near site");
      LightEngine3Probe.edit(-6, 43, -3, 50, 5, "torch near site");
      LightEngine3Probe.snap("settled");
      ahb w = LightEngine3Probe.world;
      for (int[] s : SITES) LightEngine3Probe.set(s[0], s[1], s[2], 39, 0);
      LightEngine3Probe.tick();
      StringBuilder trials = new StringBuilder("[");
      boolean first = true;
      aji mush = aji.e(39);
      for (int[] s : SITES) {
        for (int seed = 0; seed < 120; seed++) {
          Random r = new Random(seed);
          int[][] before = new int[9 * 5 * 9][];
          int n = 0;
          for (int x = s[0] - 4; x <= s[0] + 4; x++) for (int y = s[1] - 2; y <= s[1] + 2; y++) for (int z = s[2] - 4; z <= s[2] + 4; z++) before[n++] = new int[] {x, y, z, aji.b(w.a(x, y, z)), w.e(x, y, z)};
          int full = w.j(s[0], s[1], s[2]), blk = w.k(s[0], s[1] + 1, s[2]); // the cell above: BlockSapling.updateTick reads getBlockLightValue(x, y + 1, z)
          mush.a(w, s[0], s[1], s[2], r);
          StringBuilder sets = new StringBuilder("[");
          boolean f2 = true;
          for (int[] b : before) {
            int id = aji.b(w.a(b[0], b[1], b[2])), meta = w.e(b[0], b[1], b[2]);
            if (id != b[3] || meta != b[4]) {
              sets.append(f2 ? "" : ",").append("[").append(b[0]).append(",").append(b[1]).append(",").append(b[2]).append(",").append(id).append(",").append(meta).append("]");
              f2 = false;
              w.d(b[0], b[1], b[2], aji.e(b[3]), b[4], 2);
            }
          }
          sets.append("]");
          trials.append(first ? "" : ",").append("{\"pos\":[").append(s[0]).append(",").append(s[1]).append(",").append(s[2]).append("],\"seed\":").append(seed)
            .append(",\"full\":").append(full).append(",\"block\":").append(blk).append(",\"sets\":").append(sets).append(",\"next\":").append(r.nextInt()).append("}");
          first = false;
        }
      }
      trials.append("]");
      String line = LightEngine3Probe.endLine("mushroom-" + k);
      System.out.println(line.substring(0, line.length() - 1) + ",\"trials\":" + trials + "}");
    }
  }
}
