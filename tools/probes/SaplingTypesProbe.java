import java.util.ArrayList;
import java.util.List;

// Records BlockSapling.func_149878_d (anj.d, the growth call behind random ticks and bone meal) for all six sapling
// types on the unchanged original classes, reusing TreeProbe's fake World. Each row plants saplings at the listed
// cells (x, z, metadata) on one fixture, calls anj.d at (0, ground + 1, 0) with a seeded java.util.Random, and records
// the digest of every cell that changed, the number of setBlock calls and the next Random int. Covers: the 1-in-10
// WorldGenBigTree roll for oak, spruce (WorldGenTaiga2 or the 2x2 WorldGenMegaPineTree), birch (WorldGenForest),
// jungle (WorldGenTrees with vines/cocoa config, or the 2x2 WorldGenMegaJungle), acacia (WorldGenSavannaTree), dark oak
// (needs 2x2, WorldGenCanopyTree), with the clicked cell in each corner of a square, L shapes, mixed types, a roof
// and unsuitable soil. Fixtures reuse TreeProbe.Fx: grass, dirt, sand, and a roof.
public class SaplingTypesProbe {
  // BlockNewLeaf (acacia, dark oak) logging its dropped stacks like TreeProbe.PLeaves does for BlockOldLeaf.
  public static class PNewLeaves extends amh {
    TreeProbe.W w;
    protected void a(ahb world, int x, int y, int z, add stack) { w.dropped(x, y, z, stack); }
  }

  static String cells(List<int[]> l) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) b.append(i > 0 ? "," : "").append("[").append(l.get(i)[0]).append(",").append(l.get(i)[1]).append(",").append(l.get(i)[2]).append("]");
    return b.append("]").toString();
  }
  public static void main(String[] args) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    TreeProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p();
    adb.l();
    int G = TreeProbe.G;
    List<int[]> roof = new ArrayList<>();
    for (int x = -5; x <= 6; x++) for (int z = -5; z <= 6; z++) roof.add(new int[] {x, G + 9, z, 1, 0});
    TreeProbe.Fx[] fx = {
      new TreeProbe.Fx("grass", G, 2, new int[][] {}),
      new TreeProbe.Fx("dirt", G, 3, new int[][] {}),
      new TreeProbe.Fx("sand", G, 12, new int[][] {}),
      new TreeProbe.Fx("roof", G, 2, roof.toArray(new int[0][])),
    };
    StringBuilder out = new StringBuilder("{\"fixtures\":[");
    for (int i = 0; i < fx.length; i++)
      out.append(i > 0 ? "," : "").append("{\"name\":\"").append(fx[i].name).append("\",\"ground\":").append(fx[i].ground).append(",\"top\":").append(fx[i].top).append(",\"edits\":").append(TreeProbe.edits(fx[i].edits)).append("}");
    out.append("],\"rows\":[");
    boolean first = true;
    int rows = 0, changed = 0;
    for (int f = 0; f < fx.length; f++)
      for (int type = 0; type < 6; type++) {
        List<List<int[]>> layouts = new ArrayList<>();
        layouts.add(List.of(new int[] {0, 0, type | 8}));
        for (int a = 0; a <= 1; a++) for (int b = 0; b <= 1; b++) { // 2x2 with the clicked cell at (0,0)
          List<int[]> l = new ArrayList<>();
          for (int i = 0; i <= 1; i++) for (int j = 0; j <= 1; j++) l.add(new int[] {i - a, j - b, i == a && j == b ? type | 8 : (i + j) % 2 == 0 ? type : type | 8});
          layouts.add(l);
        }
        layouts.add(List.of(new int[] {0, 0, type | 8}, new int[] {1, 0, type}, new int[] {0, 1, type}));
        layouts.add(List.of(new int[] {0, 0, type | 8}, new int[] {-1, 0, type}, new int[] {0, -1, type}));
        layouts.add(List.of(new int[] {0, 0, type | 8}, new int[] {1, 0, type}, new int[] {0, 1, type}, new int[] {1, 1, (type + 1) % 6}));
        layouts.add(List.of(new int[] {0, 0, type | 8}, new int[] {1, 0, type}, new int[] {0, 1, type}, new int[] {1, 1, type}, new int[] {2, 0, type}, new int[] {2, 1, type}));
        for (int li = 0; li < layouts.size(); li++)
          for (int seed = 0; seed < 6; seed++) {
            List<int[]> l = layouts.get(li);
            long s = seed * 7919L + li * 31L + type * 101L + 3;
            TreeProbe.W w = TreeProbe.world(fx[f], s);
            for (int[] c : l) w.fixed.put(TreeProbe.W.key(c[0], G + 1, c[1]), new int[] {6, c[2]});
            TreeProbe.Rnd r = TreeProbe.rnd(w);
            w.sapling.d(w, 0, G + 1, 0, r);
            if (w.sets.size() > 4) changed++;
            out.append(first ? "" : ",").append("{\"f\":").append(f).append(",\"type\":").append(type).append(",\"cells\":").append(cells(l)).append(",\"seed\":").append(s)
              .append(",\"sets\":").append(w.sets.size()).append(",\"state\":\"").append(w.state()).append("\",\"next\":").append(r.nextInt(1000000)).append("}");
            first = false;
            rows++;
          }
      }
    out.append("],\"count\":").append(rows).append(",\"grew\":").append(changed);
    // BlockLeaves.dropBlockAsItemWithChance (alt.a(w, x, y, z, meta, 1.0F, fortune)) for BlockOldLeaf and BlockNewLeaf.
    out.append(",\"leafDrops\":[");
    first = true;
    for (int block : new int[] {18, 161})
      for (int meta : new int[] {0, 1, 2, 3, 12})
        for (int fortune = 0; fortune <= 3; fortune++) {
          TreeProbe.W w = TreeProbe.world(fx[0], 900L + block + meta * 10 + fortune);
          alt leaves = block == 18 ? w.leaves : new PNewLeaves();
          if (block == 161) ((PNewLeaves) leaves).w = w;
          for (int i = 0; i < 3000; i++) { w.tick = i; leaves.a(w, 3, 70, 3, meta, 1.0f, fortune); }
          int saplings = 0, apples = 0, other = 0;
          StringBuilder b = new StringBuilder();
          for (int[] d : w.drops) {
            b.append(d[0]).append(',').append(d[1]).append(',').append(d[2]).append('\n');
            if (d[1] == 6) saplings++; else if (d[1] == 260) apples++; else other++;
          }
          out.append(first ? "" : ",").append("{\"block\":").append(block).append(",\"meta\":").append(meta).append(",\"fortune\":").append(fortune).append(",\"seed\":").append(900L + block + meta * 10 + fortune)
            .append(",\"calls\":3000,\"saplings\":").append(saplings).append(",\"apples\":").append(apples).append(",\"other\":").append(other)
            .append(",\"digest\":\"").append(TreeProbe.sha(b.toString())).append("\",\"head\":").append(TreeProbe.dropsJson(w.drops.subList(0, Math.min(8, w.drops.size())))).append(",\"next\":").append(TreeProbe.rnd(w).nextInt(1000000)).append("}");
          first = false;
        }
    out.append("]}");
    System.out.println(out);
  }
}
