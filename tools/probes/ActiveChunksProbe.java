import java.util.*;

// Batch 67: World.activeChunkSet (ahb.F, a HashSet<agu>) as ahb.C() (setActivePlayerChunksAndCheckLight) fills it: clear(), then for each player in list order the square
// [-r, r] x [-r, r] around its chunk, x outer, z inner, through the REAL ChunkCoordIntPair `agu` (hashCode bytecode-read) in a real java.util.HashSet. WorldServer.func_147456_g (mt.g)
// iterates that set. One set is reused over a sequence of ticks (clear keeps the table), so the record shows the order after each tick. Prints one JSON line per case.
public class ActiveChunksProbe {
  static String run(String name, int radius, int[][][] ticks) {
    Set<agu> set = new HashSet<>();
    StringBuilder out = new StringBuilder("{\"case\":\"" + name + "\",\"radius\":" + radius + ",\"javaVersion\":\"" + System.getProperty("java.version") + "\",\"ticks\":[");
    for (int t = 0; t < ticks.length; t++) {
      set.clear();
      for (int[] c : ticks[t]) for (int i = -radius; i <= radius; i++) for (int j = -radius; j <= radius; j++) set.add(new agu(i + c[0], j + c[1]));
      if (t > 0) out.append(',');
      out.append("{\"players\":[");
      for (int k = 0; k < ticks[t].length; k++) out.append(k > 0 ? "," : "").append("[" + ticks[t][k][0] + "," + ticks[t][k][1] + "]");
      out.append("],\"order\":[");
      boolean first = true;
      for (agu a : set) { if (!first) out.append(','); first = false; out.append(a.a + "," + a.b); }
      out.append("]}");
    }
    return out.append("]}").toString();
  }
  public static void main(String[] a) {
    System.out.println(run("one", 10, new int[][][]{ {{4, 4}} }));
    System.out.println(run("negative", 10, new int[][][]{ {{-3, 5}} }));
    System.out.println(run("two", 10, new int[][][]{ {{1, 1}, {7, 6}} }));
    System.out.println(run("far", 10, new int[][][]{ {{0, 0}, {40, 40}} }));
    // two players, then one: the table stays at the larger size
    System.out.println(run("shrink", 10, new int[][][]{ {{0, 0}, {40, 40}}, {{3, 2}} }));
    System.out.println(run("small", 3, new int[][][]{ {{2, 2}}, {{2, 2}, {3, 3}}, {{5, 1}} }));
    // b68 chunkscan2: many overlapping players (bins of 9 or more nodes treeify in a table of 64+ buckets, so the order inside them is the tree's), and the retained table across ticks
    System.out.println(run("cluster", 10, new int[][][]{ {{1, 1}, {2, 3}, {4, 2}, {3, 5}}, {{1, 1}, {2, 3}}, {{-6, 4}, {-5, 3}, {-4, 6}, {0, 0}, {1, 2}} }));
    System.out.println(run("crowd", 10, new int[][][]{ {{0, 0}, {1, 0}, {0, 1}, {1, 1}, {2, 2}, {3, 1}, {5, 5}, {6, 4}, {-2, 3}, {-3, -3}}, {{0, 0}}, {{7, 7}, {8, 8}, {9, 6}} }));
    System.out.println(run("negcluster", 10, new int[][][]{ {{-1, -1}, {-2, -3}, {-5, -2}, {-4, -6}, {-3, -1}} }));
    System.out.println(run("radius7", 7, new int[][][]{ {{2, 2}, {5, 4}, {8, 3}, {3, 9}} }));
    System.out.println(run("long", 10, new int[][][]{ {{0, 0}, {3, 4}}, {{0, 0}, {3, 4}, {6, 1}}, {{10, 10}, {11, 12}, {13, 9}, {9, 14}}, {{2, 2}} }));
  }
}
