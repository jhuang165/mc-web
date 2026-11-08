import java.security.MessageDigest;
import java.util.Random;

// Oak saplings and leaves in the Nether and End (batch 29). Runs on the LightEngine3Probe harness (unchanged World/Chunk light code over real chunks -3..3,
// real WorldProviderHell/End). Dirt pedestals carry an oak sapling; a glowstone d blocks to the side sets the block light of the cell above it to 15 - d (8, 9,
// 10, 15) or nothing lights it (dark). Per site and seed the unchanged BlockSapling.updateTick (anj.a) runs up to 60 times on one java.util.Random: per tick one
// event character (. nothing, m marked, g grown, f restored after a failed growth, d the sapling is gone), then sha256 of the cells the trial changed
// ([x,y,z,id,meta] in x, y, z order) and the next Random int. The cell above's ahb.k value is recorded too. Leaves: a log column with a cube of bit-8
// (check-decay) oak leaves, BlockLeaves.updateTick (alt.a) once per leaf per seed; a leaf that stays connected keeps its block and loses bit 8 (a leaf that
// decays would drop items, which needs GameRules and the world Random this harness does not have, so every leaf here touches a log). Each trial's writes are undone (flag 2).
// Compile together with LightEngine3Probe.
public class DimTreeProbe {
  static final int[][] SITES = {{0, 41, 0}, {-12, 41, -9}, {13, 41, 10}, {-5, 41, 12}};
  static final int[] DIST = {-1, 0, 5, 6, 7}; // -1: no glowstone
  static String sha(String s) throws Exception {
    byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes("UTF-8"));
    StringBuilder b = new StringBuilder();
    for (byte v : d) b.append(String.format("%02x", v & 255));
    return b.toString();
  }

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
      LightEngine3Probe.fill(-30, 41, -30, 30, 70, 30, 0, 0);
      if (k.equals("nether")) LightEngine3Probe.fill(-48, 127, -48, 63, 127, 63, 7, 0);
      LightEngine3Probe.anchors();
      LightEngine3Probe.gen(); LightEngine3Probe.op("[\"terrain\"]"); LightEngine3Probe.tick(); LightEngine3Probe.tick();
      int[][] cells = new int[SITES.length * DIST.length][];
      int n = 0;
      for (int[] s : SITES) for (int d : DIST) cells[n++] = new int[] {s[0], s[1], s[2], d};
      LightEngine3Probe.snap("empty");
      // Each (site, d) runs on its own fresh setup: pedestal, glowstone, light settled, trials, then everything undone.
      StringBuilder trials = new StringBuilder("[");
      boolean first = true;
      ahb w = LightEngine3Probe.world;
      aji sapling = aji.e(6), leaves = aji.e(18);
      for (int[] c : cells) {
        int x = c[0], y = c[1], z = c[2], d = c[3];
        LightEngine3Probe.set(x, y - 1, z, 3, 0);
        LightEngine3Probe.set(x, y, z, 6, 0);
        if (d >= 0) LightEngine3Probe.set(x + d + (d == 0 ? 1 : 0), y + 1, z, 89, 0); // d 0 sits beside the cell above (light 14 at the cell, 15 at the glowstone)
        LightEngine3Probe.tick(); LightEngine3Probe.tick();
        LightEngine3Probe.snap("site:" + x + "|" + y + "|" + z + "|" + d);
        int blk = w.k(x, y + 1, z);
        for (int seed = 0; seed < 24; seed++) {
          Random r = new Random(seed * 7919L + 13);
          int[][] before = new int[21 * 24 * 21][];
          int m = 0;
          for (int xx = x - 10; xx <= x + 10; xx++) for (int yy = y - 1; yy <= y + 22; yy++) for (int zz = z - 10; zz <= z + 10; zz++) before[m++] = new int[] {xx, yy, zz, aji.b(w.a(xx, yy, zz)), w.e(xx, yy, zz)};
          StringBuilder ev = new StringBuilder();
          for (int t = 0; t < 60; t++) {
            int id0 = aji.b(w.a(x, y, z)), m0 = w.e(x, y, z);
            if (id0 != 6) { break; }
            LightEngine3Probe.set(w, "E", false); sapling.a(w, x, y, z, r); LightEngine3Probe.set(w, "E", true); // isRemote false: BlockSapling.updateTick acts server-side only
            int id1 = aji.b(w.a(x, y, z)), m1 = w.e(x, y, z);
            char ch = id1 != 6 ? (id1 == 0 ? 'd' : 'g') : ((m0 & 8) == 0 && (m1 & 8) != 0) ? 'm' : ((m0 & 8) != 0 && (m1 & 8) == 0) ? 'f' : '.';
            ev.append(ch);
            if (ch == 'g' || ch == 'd') break;
          }
          StringBuilder sets = new StringBuilder();
          for (int[] b : before) {
            int id = aji.b(w.a(b[0], b[1], b[2])), meta = w.e(b[0], b[1], b[2]);
            if (id != b[3] || meta != b[4]) {
              sets.append(b[0]).append(',').append(b[1]).append(',').append(b[2]).append(',').append(id).append(',').append(meta).append('\n');
              w.d(b[0], b[1], b[2], aji.e(b[3]), b[4], 2);
            }
          }
          trials.append(first ? "" : ",").append("{\"kind\":\"sapling\",\"pos\":[").append(x).append(",").append(y).append(",").append(z).append("],\"d\":").append(d).append(",\"light\":").append(blk)
            .append(",\"seed\":").append(seed * 7919L + 13).append(",\"events\":\"").append(ev).append("\",\"digest\":\"").append(sha(sets.toString())).append("\",\"next\":").append(r.nextInt()).append("}");
          first = false;
        }
        LightEngine3Probe.set(x, y, z, 0, 0);
        LightEngine3Probe.set(x, y - 1, z, floor, 0);
        if (d >= 0) LightEngine3Probe.set(x + d + (d == 0 ? 1 : 0), y + 1, z, 0, 0);
        LightEngine3Probe.tick();
      }
      // leaves: log column (x, y..y+4) in a 5x5x5 cube of oak leaves with bit 8 set (metadata 8)
      int[][] LEAF_SITES = {{0, 60, 0}, {-12, 60, 9}};
      for (int[] s : LEAF_SITES) {
        int x = s[0], y = s[1], z = s[2];
        for (int dx = -2; dx <= 2; dx++) for (int dy = 0; dy <= 4; dy++) for (int dz = -2; dz <= 2; dz++) LightEngine3Probe.set(x + dx, y + dy, z + dz, (dx == 0 && dz == 0) ? 17 : 18, (dx == 0 && dz == 0) ? 0 : 8);
        LightEngine3Probe.tick();
        for (int seed = 0; seed < 8; seed++) {
          Random r = new Random(seed + 101);
          StringBuilder out = new StringBuilder();
          for (int dx = -2; dx <= 2; dx++) for (int dy = 0; dy <= 4; dy++) for (int dz = -2; dz <= 2; dz++) {
            if (dx == 0 && dz == 0) continue;
            LightEngine3Probe.set(w, "E", false); leaves.a(w, x + dx, y + dy, z + dz, r); LightEngine3Probe.set(w, "E", true);
            out.append(aji.b(w.a(x + dx, y + dy, z + dz))).append(':').append(w.e(x + dx, y + dy, z + dz)).append(',');
            w.d(x + dx, y + dy, z + dz, aji.e(18), 8, 2);
          }
          trials.append(",{\"kind\":\"leaves\",\"pos\":[").append(x).append(",").append(y).append(",").append(z).append("],\"seed\":").append(seed + 101).append(",\"digest\":\"").append(sha(out.toString())).append("\",\"cells\":\"").append(out).append("\",\"next\":").append(r.nextInt()).append("}");
        }
        for (int dx = -2; dx <= 2; dx++) for (int dy = 0; dy <= 4; dy++) for (int dz = -2; dz <= 2; dz++) LightEngine3Probe.set(x + dx, y + dy, z + dz, 0, 0);
        LightEngine3Probe.tick();
      }
      trials.append("]");
      String line = LightEngine3Probe.endLine("trees-" + k);
      System.out.println(line.substring(0, line.length() - 1) + ",\"trials\":" + trials + "}");
    }
  }
}
