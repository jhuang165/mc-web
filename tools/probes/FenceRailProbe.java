import java.util.*;

// Unchanged BlockFence (akz), BlockRailBase (aje) + BlockRailBase$Rail (ajf) + BlockRail (amy),
// BlockMobSpawner (ama) and BlockTorch (aoc), Minecraft Java 1.7.10, on a world double: a sparse
// cell map over an optional stone floor (y < 0). setBlockMetadataWithNotify stores the metadata
// (its neighbour notifications only reach BlockRail.func_150048_a, which acts on power sources,
// and the torches here), setBlockToAir removes the cell, World.getGameRules has doTileDrops off
// so no item entity is spawned, and isBlockIndirectlyGettingPowered is false (no redstone).
// isBlockNormalCubeDefault reads the cell's Block.isNormalCube as World does for loaded chunks.
// The spawner XP is read from a subclass that only overrides Block.dropXpOnBlockBreak (the sink);
// BlockMobSpawner.dropBlockAsItemWithChance itself is unchanged.
public class FenceRailProbe {
  static final Map<Long, int[]> cells = new HashMap<>();
  static boolean floor = true;
  static int removed = 0;
  static final List<Integer> xp = new ArrayList<>();

  static long key(int x, int y, int z) { return ((long) (x + 1000) * 4096 + (y + 1000)) * 4096 + (z + 1000); }
  static void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
  static int[] cell(int x, int y, int z) { return cells.get(key(x, y, z)); }

  public static class World extends MobMoveProbe.ProbeWorld {
    public aji a(int x, int y, int z) {
      int[] c = cell(x, y, z);
      if (c != null) return aji.e(c[0]);
      return floor && y < 0 ? aji.e(1) : aji.e(0);
    }
    public int e(int x, int y, int z) { int[] c = cell(x, y, z); return c == null ? 0 : c[1]; }
    public boolean a(int x, int y, int z, int meta, int flags) { int[] c = cell(x, y, z); if (c == null) return false; c[1] = meta; return true; }
    public boolean f(int x, int y, int z) { removed++; cells.remove(key(x, y, z)); return true; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { put(x, y, z, aji.b(b), meta); return true; }
    public boolean v(int x, int y, int z) { return false; }
    public boolean c(int x, int y, int z, boolean def) { return a(x, y, z).r(); }
    public void d(int x, int y, int z, aji b) {}
    public agy O() { agy g = new agy(); g.b("doTileDrops", "false"); return g; }
  }

  public static class Spy extends ama {
    public Spy() { super(); }
    public void c(ahb w, int x, int y, int z, int value) { xp.add(value); }
  }

  static String box(azt b) { return b == null ? "null" : "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
  static String bounds(aji b) throws Exception {
    String[] f = {"B", "C", "D", "E", "F", "G"};
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < 6; i++) s.append(i > 0 ? "," : "").append(MobMoveProbe.field(aji.class, f[i]).getDouble(b));
    return s.append("]").toString();
  }
  static String material(awt m) {
    return m == awt.d ? "wood" : m == awt.e ? "rock" : m == awt.q ? "circuits" : m == awt.a ? "air" : "other";
  }
  static String facts(World w, String name, aji b) throws Exception {
    adb drop = b.a(0, new Random(1), 0);
    return "{\"case\":\"facts\",\"block\":\"" + name + "\",\"id\":" + aji.b(b) + ",\"hardness\":" + b.f(w, 0, 0, 0) + ",\"opacity\":" + b.k() + ",\"light\":" + b.m()
      + ",\"render\":" + b.b() + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r() + ",\"material\":\"" + material(b.o()) + "\""
      + ",\"materialOpaque\":" + b.o().k() + ",\"blocksMovement\":" + b.o().c() + ",\"requiresTool\":" + !b.o().l()
      + ",\"drop\":" + (drop == null ? "null" : String.valueOf(adb.b(drop))) + ",\"quantity\":" + b.a(new Random(1)) + "}";
  }
  static String list(List<String> l) { return "[" + String.join(",", l) + "]"; }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    World w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    akz fence = (akz) aji.e(85);
    aje rail = (aje) aji.e(66);
    aji spawner = aji.e(52), torch = aji.e(50);
    System.out.println(facts(w, "fence", fence));
    System.out.println(facts(w, "rail", rail));
    System.out.println(facts(w, "mob_spawner", spawner));
    System.out.println(facts(w, "torch", torch));

    // Per original block id (meta 0..15 bit masks): BlockFence.canConnectFenceTo on the neighbour,
    // BlockTorch.canPlaceBlockAt with only that block below, BlockRailBase.canPlaceBlockAt on it,
    // World.doesBlockHaveSolidTopSurface and the Block flags.
    for (int id = 0; id < 176; id++) {
      if (id >= 165 && id <= 169) continue;
      aji b = aji.e(id);
      int fenceMask = 0, torchMask = 0, railMask = 0, topMask = 0;
      for (int meta = 0; meta < 16; meta++) {
        cells.clear(); floor = false;
        put(1, 0, 0, id, meta);
        if (fence.e(w, 1, 0, 0)) fenceMask |= 1 << meta;
        cells.clear();
        put(0, 0, 0, id, meta);
        if (torch.c(w, 0, 1, 0)) torchMask |= 1 << meta;
        if (rail.c(w, 0, 1, 0)) railMask |= 1 << meta;
        if (ahb.a(w, 0, 0, 0)) topMask |= 1 << meta;
      }
      System.out.println("{\"case\":\"block\",\"id\":" + id + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r()
        + ",\"fence\":" + fenceMask + ",\"torchBelow\":" + torchMask + ",\"railBelow\":" + railMask + ",\"solidTop\":" + topMask + "}");
    }

    // BlockFence: collision boxes (addCollisionBoxesToList over a covering mask) and the
    // setBlockBoundsBasedOnState selection box with stone neighbours from a 4-bit mask
    // (z-1, z+1, x-1, x+1), at (0,0,0).
    for (int mask = 0; mask < 16; mask++) {
      cells.clear(); floor = false;
      put(0, 0, 0, 85, 0);
      if ((mask & 1) != 0) put(0, 0, -1, 1, 0);
      if ((mask & 2) != 0) put(0, 0, 1, 1, 0);
      if ((mask & 4) != 0) put(-1, 0, 0, 1, 0);
      if ((mask & 8) != 0) put(1, 0, 0, 1, 0);
      List<azt> out = new ArrayList<>();
      fence.a(w, 0, 0, 0, azt.a(-1, -1, -1, 2, 3, 2), out, null);
      List<String> boxes = new ArrayList<>();
      for (azt b : out) boxes.add(box(b));
      fence.a((ahl) w, 0, 0, 0);
      System.out.println("{\"case\":\"fence\",\"mask\":" + mask + ",\"collision\":" + list(boxes) + ",\"bounds\":" + bounds(fence) + ",\"selection\":" + box(fence.g(w, 0, 0, 0)) + "}");
    }

    // BlockRailBase: selection bounds per metadata, no collision box.
    for (int meta = 0; meta < 16; meta++) {
      cells.clear(); floor = true;
      put(0, 0, 0, 66, meta);
      rail.a((ahl) w, 0, 0, 0);
      System.out.println("{\"case\":\"railBounds\",\"meta\":" + meta + ",\"bounds\":" + bounds(rail) + ",\"collision\":" + box(rail.a(w, 0, 0, 0)) + "}");
    }
    // BlockRailBase.onNeighborBlockChange: stone below (bit 0), at x+1 (1), x-1 (2), z-1 (3), z+1 (4).
    for (int meta = 0; meta < 16; meta++) {
      StringBuilder r = new StringBuilder();
      for (int mask = 0; mask < 32; mask++) {
        cells.clear(); floor = false; removed = 0;
        put(0, 1, 0, 66, meta);
        if ((mask & 1) != 0) put(0, 0, 0, 1, 0);
        if ((mask & 2) != 0) put(1, 1, 0, 1, 0);
        if ((mask & 4) != 0) put(-1, 1, 0, 1, 0);
        if ((mask & 8) != 0) put(0, 1, -1, 1, 0);
        if ((mask & 16) != 0) put(0, 1, 1, 1, 0);
        rail.a(w, 0, 1, 0, aji.e(0));
        r.append(mask > 0 ? "," : "").append(removed > 0 ? 1 : 0);
      }
      System.out.println("{\"case\":\"railSupport\",\"meta\":" + meta + ",\"removed\":[" + r + "]}");
    }
    // Rail shapes: ItemBlock placement (setBlock meta 0, then BlockRailBase.onBlockAdded) of fixed
    // and seeded random sequences over a stone floor (y < 0) with optional stone at y 0.
    List<Object[]> scenarios = new ArrayList<>();
    int[][][] fixedRuns = {
      {{0, 0, 0}},
      {{0, 0, 0}, {1, 0, 0}, {2, 0, 0}},
      {{0, 0, 0}, {0, 0, 1}, {0, 0, 2}},
      {{0, 0, 0}, {1, 0, 0}, {0, 0, 1}},
      {{0, 0, 0}, {-1, 0, 0}, {0, 0, 1}},
      {{0, 0, 0}, {-1, 0, 0}, {0, 0, -1}},
      {{0, 0, 0}, {1, 0, 0}, {0, 0, -1}},
      {{0, 0, 0}, {1, 0, 0}, {-1, 0, 0}, {0, 0, 1}},
      {{0, 0, 0}, {0, 0, 1}, {0, 0, -1}, {1, 0, 0}},
      {{1, 0, 0}, {-1, 0, 0}, {0, 0, 1}, {0, 0, -1}, {0, 0, 0}},
      {{0, 0, 1}, {1, 0, 0}, {0, 0, 0}},
      {{0, 0, -1}, {-1, 0, 0}, {0, 0, 0}},
      {{0, 0, 0}, {1, 0, 0}, {1, 0, 1}, {0, 0, 1}},
    };
    for (int[][] run : fixedRuns) scenarios.add(new Object[] {new int[0][], run});
    // Slopes: stone at y 0 under the upper rail.
    scenarios.add(new Object[] {new int[][] {{1, 0, 0}}, new int[][] {{0, 0, 0}, {1, 1, 0}}});
    scenarios.add(new Object[] {new int[][] {{-1, 0, 0}}, new int[][] {{0, 0, 0}, {-1, 1, 0}}});
    scenarios.add(new Object[] {new int[][] {{0, 0, -1}}, new int[][] {{0, 0, 0}, {0, 1, -1}}});
    scenarios.add(new Object[] {new int[][] {{0, 0, 1}}, new int[][] {{0, 0, 0}, {0, 1, 1}}});
    scenarios.add(new Object[] {new int[][] {{1, 0, 0}}, new int[][] {{1, 1, 0}, {0, 0, 0}}});
    scenarios.add(new Object[] {new int[][] {{1, 0, 0}, {2, 0, 0}}, new int[][] {{0, 0, 0}, {1, 1, 0}, {2, 1, 0}, {-1, 0, 0}}});
    scenarios.add(new Object[] {new int[][] {{0, 0, 1}}, new int[][] {{0, 1, 1}, {0, 0, 0}, {1, 0, 0}, {0, 0, -1}}});
    Random rnd = new Random(1710);
    for (int s = 0; s < 60; s++) {
      List<int[]> stones = new ArrayList<>();
      for (int x = -2; x <= 2; x++) for (int z = -2; z <= 2; z++) if (rnd.nextInt(5) == 0) stones.add(new int[] {x, 0, z});
      int n = 4 + rnd.nextInt(9);
      List<int[]> steps = new ArrayList<>();
      Set<Long> used = new HashSet<>();
      for (int i = 0; i < n; i++) {
        int x = rnd.nextInt(5) - 2, z = rnd.nextInt(5) - 2;
        boolean high = false;
        for (int[] st : stones) if (st[0] == x && st[2] == z) high = true;
        int y = high ? 1 : 0;
        if (used.add(key(x, y, z))) steps.add(new int[] {x, y, z});
      }
      scenarios.add(new Object[] {stones.toArray(new int[0][]), steps.toArray(new int[0][])});
    }
    for (Object[] sc : scenarios) {
      int[][] stones = (int[][]) sc[0], steps = (int[][]) sc[1];
      cells.clear(); floor = true;
      for (int[] st : stones) put(st[0], st[1], st[2], 1, 0);
      List<String> stoneOut = new ArrayList<>(), stepOut = new ArrayList<>();
      for (int[] st : stones) stoneOut.add("[" + st[0] + "," + st[1] + "," + st[2] + "]");
      for (int[] p : steps) {
        put(p[0], p[1], p[2], 66, 0);
        rail.b(w, p[0], p[1], p[2]);
        List<String> metas = new ArrayList<>();
        for (int[] q : steps) {
          int[] c = cell(q[0], q[1], q[2]);
          if (c != null && c[0] == 66) metas.add("[" + q[0] + "," + q[1] + "," + q[2] + "," + c[1] + "]");
          if (q == p) break;
        }
        stepOut.add("{\"place\":[" + p[0] + "," + p[1] + "," + p[2] + "],\"rails\":" + list(metas) + "}");
      }
      System.out.println("{\"case\":\"railPlace\",\"stones\":" + list(stoneOut) + ",\"steps\":" + list(stepOut) + "}");
    }

    // BlockTorch: selection bounds per metadata (collisionRayTrace sets them), no collision box.
    for (int meta = 0; meta < 6; meta++) {
      cells.clear(); floor = true;
      put(0, 0, 0, 50, meta);
      torch.a(w, 0, 0, 0, azw.a(0.5, 2, 0.5), azw.a(0.5, -1, 0.5));
      System.out.println("{\"case\":\"torchBounds\",\"meta\":" + meta + ",\"bounds\":" + bounds(torch) + ",\"collision\":" + box(torch.a(w, 0, 0, 0)) + "}");
    }
    // Placement and support with stone at x-1 (bit 0), x+1 (1), z-1 (2), z+1 (3) and below (4)
    // of (0,1,0): canPlaceBlockAt, onBlockPlaced per clicked side, the metadata after
    // onBlockAdded (-1: dropped), and onNeighborBlockChange per metadata 1..5.
    for (int mask = 0; mask < 32; mask++) {
      List<String> placed = new ArrayList<>(), added = new ArrayList<>(), kept = new ArrayList<>();
      boolean can = false;
      for (int side = 0; side < 6; side++) {
        torchWorld(mask);
        can = torch.c(w, 0, 1, 0);
        int meta = torch.a(w, 0, 1, 0, side, 0.5f, 0.5f, 0.5f, 0);
        placed.add(String.valueOf(meta));
        put(0, 1, 0, 50, meta);
        torch.b(w, 0, 1, 0);
        int[] c = cell(0, 1, 0);
        added.add(String.valueOf(c == null ? -1 : c[1]));
      }
      for (int meta = 1; meta <= 5; meta++) {
        torchWorld(mask);
        put(0, 1, 0, 50, meta);
        torch.a(w, 0, 1, 0, aji.e(0));
        kept.add(cell(0, 1, 0) == null ? "0" : "1");
      }
      System.out.println("{\"case\":\"torch\",\"mask\":" + mask + ",\"canPlace\":" + can + ",\"placed\":" + list(placed) + ",\"added\":" + list(added) + ",\"kept\":" + list(kept) + "}");
    }

    // BlockMobSpawner.dropBlockAsItemWithChance: XP from World.rand seeded 0..31.
    Spy spy = new Spy();
    List<String> values = new ArrayList<>();
    for (int seed = 0; seed < 32; seed++) {
      MobMoveProbe.set(w, "s", new Random(seed));
      xp.clear();
      spy.a(w, 0, 0, 0, 0, 1.0f, 0);
      values.add(String.valueOf(xp.isEmpty() ? -1 : xp.get(0)));
    }
    System.out.println("{\"case\":\"spawnerXp\",\"seeds\":32,\"xp\":" + list(values) + ",\"pick\":" + (spawner.d(w, 0, 0, 0) == null ? "null" : "item") + "}");
  }

  static void torchWorld(int mask) {
    cells.clear(); floor = false;
    if ((mask & 1) != 0) put(-1, 1, 0, 1, 0);
    if ((mask & 2) != 0) put(1, 1, 0, 1, 0);
    if ((mask & 4) != 0) put(0, 1, -1, 1, 0);
    if ((mask & 8) != 0) put(0, 1, 1, 1, 0);
    if ((mask & 16) != 0) put(0, 0, 0, 1, 0);
  }
}
