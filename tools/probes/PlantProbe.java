import java.security.MessageDigest;
import java.util.*;

// Records 1.7.10 sugar cane, cactus and falling sand/gravel from the unchanged original classes:
// BlockReed (ane), BlockCactus (ajt), BlockFalling (akx), BlockSand (anh), BlockGravel (ali),
// EntityFallingBlock (xj), ItemReed (abi), WorldGenReed (ash), WorldGenCactus (arh), WorldGenSand (asj),
// EntityItem/EntityXPOrb.attackEntityFrom (xk.a/sq.a), DamageSource.cactus (ro.g), FurnaceRecipes (afa)
// and CraftingManager (afe). The world is a map-backed double allocated without its constructor (like
// TreeProbe): block ids are the original ones, cells outside the map come from a fixture function.
// World.setBlock is replaced by a plain map write (no neighbour notifications, no light); everything
// else (canPlaceEntityOnSide, func_147480_a, Entity.moveEntity, dropBlockAsItem) is the original code.
// Spawned entities and scheduled updates are recorded instead of being added to a world.
public class PlantProbe {
  static sun.misc.Unsafe unsafe;

  interface Base { int[] at(int x, int y, int z); }

  public static class W extends MobMoveProbe.ProbeWorld {
    Map<Long, int[]> cells = new HashMap<>();
    Base base = (x, y, z) -> new int[] {y < 0 ? 1 : 0, 0};
    List<sa> spawned = new ArrayList<>();
    List<String> scheduled = new ArrayList<>();
    List<int[]> sets = new ArrayList<>();
    static long key(int x, int y, int z) { return ((long) (x + 1000) * 100000L + (y + 1000)) * 100000L + (z + 1000); }
    int[] cell(int x, int y, int z) { int[] c = cells.get(key(x, y, z)); return c != null ? c : base.at(x, y, z); }
    void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
    public aji a(int x, int y, int z) { return y > 255 ? aji.e(0) : aji.e(cell(x, y, z)[0]); }
    public int e(int x, int y, int z) { return y > 255 ? 0 : cell(x, y, z)[1]; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      if (y < 0 || y > 255) return false;
      sets.add(new int[] {x, y, z, aji.b(b), meta, flags});
      put(x, y, z, aji.b(b), meta);
      return true;
    }
    public boolean f(int x, int y, int z) { return d(x, y, z, aji.e(0), 0, 3); }
    public boolean a(int x, int y, int z, int meta, int flags) {
      if (y < 0 || y > 255) return false;
      put(x, y, z, cell(x, y, z)[0], meta);
      return true;
    }
    public void a(int x, int y, int z, aji b, int delay) { scheduled.add(x + "," + y + "," + z + "," + aji.b(b) + "," + delay); }
    public boolean d(sa e) { spawned.add(e); return true; }
    public boolean b(int x0, int y0, int z0, int x1, int y1, int z1) { return true; }
    public void c(int type, int x, int y, int z, int data) {}
    public void a(double x, double y, double z, String sound, float volume, float pitch) {}
    public void a(double x, double y, double z, String sound, float volume, float pitch, boolean delay) {}
    public void a(sa entity, String sound, float volume, float pitch) {}
    public void a(sa entity, byte state) {}
    public agy O() { return new agy(); }
    public List b(sa entity, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
    public List a(sa entity, azt box) {
      List<azt> out = new ArrayList<>();
      for (int x = (int) Math.floor(box.a); x < (int) Math.floor(box.d + 1); x++)
        for (int y = (int) Math.floor(box.b) - 1; y < (int) Math.floor(box.e + 1); y++)
          for (int z = (int) Math.floor(box.c); z < (int) Math.floor(box.f + 1); z++)
            a(x, y, z).a(this, x, y, z, box, out, entity);
      return out;
    }
  }

  static W world(Base base) throws Exception {
    W w = (W) unsafe.allocateInstance(W.class);
    MobMoveProbe.set(w, "t", unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    w.cells = new HashMap<>();
    w.spawned = new ArrayList<>();
    w.scheduled = new ArrayList<>();
    w.sets = new ArrayList<>();
    w.base = base;
    return w;
  }

  static String sha(String s) throws Exception {
    byte[] d = MessageDigest.getInstance("SHA-256").digest(s.getBytes("UTF-8"));
    StringBuilder b = new StringBuilder();
    for (byte x : d) b.append(String.format("%02x", x));
    return b.toString();
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String box(azt b) { return b == null ? "null" : "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
  static String stacks(List<sa> list) {
    StringBuilder b = new StringBuilder("[");
    int n = 0;
    for (sa e : list)
      if (e instanceof xk) {
        add s = ((xk) e).f();
        b.append(n++ > 0 ? "," : "").append("[").append(adb.b(s.b())).append(",").append(s.b).append(",").append(s.k()).append("]");
      }
    return b.append("]").toString();
  }
  static String sets(W w) {
    StringBuilder b = new StringBuilder("[");
    for (int i = 0; i < w.sets.size(); i++) {
      int[] a = w.sets.get(i);
      b.append(i > 0 ? "," : "").append("[").append(a[0]).append(",").append(a[1]).append(",").append(a[2]).append(",").append(a[3]).append(",").append(a[4]).append(",").append(a[5]).append("]");
    }
    return b.append("]").toString();
  }

  static String facts(W w, int id) throws Exception {
    aji l = aji.e(id);
    ajm sound = (ajm) MobMoveProbe.field(aji.class, "H").get(l);
    awt m = l.o();
    return "{\"case\":\"facts\",\"id\":" + id + ",\"hardness\":" + l.f(w, 0, 0, 0) + ",\"resistance\":" + l.a((sa) null) + ",\"opacity\":" + l.k() + ",\"light\":" + l.m()
      + ",\"render\":" + l.b() + ",\"opaque\":" + l.c() + ",\"normal\":" + l.d() + ",\"ticksRandomly\":" + l.t() + ",\"tickRate\":" + l.a((ahb) w)
      + ",\"solid\":" + m.a() + ",\"liquid\":" + m.d() + ",\"blocksMovement\":" + m.c() + ",\"replaceable\":" + m.j() + ",\"requiresTool\":" + !m.l() + ",\"mobility\":" + m.m()
      + ",\"drop\":" + adb.b(l.a(0, new Random(1), 0)) + ",\"quantity\":" + l.a(new Random(1)) + ",\"damageDropped\":[" + l.a(0) + "," + l.a(1) + "]"
      + ",\"stepSound\":\"" + sound.e() + "\",\"breakSound\":\"" + sound.a() + "\",\"placeSound\":\"" + sound.b() + "\",\"volume\":" + sound.c() + ",\"pitch\":" + sound.d() + "}";
  }

  // Reeds on soil at (0, 63, 0) with water (still, id 9) at y 63 on the sides in `mask` (x-1, x+1, z-1, z+1).
  static int[][] SIDES = {{-1, 0}, {1, 0}, {0, -1}, {0, 1}};
  static Base around(int soil, int mask, int liquid) {
    return (x, y, z) -> {
      if (y < 63) return new int[] {1, 0};
      if (y == 63 && x == 0 && z == 0) return new int[] {soil, 0};
      if (y == 63) for (int i = 0; i < 4; i++) if ((mask & 1 << i) != 0 && x == SIDES[i][0] && z == SIDES[i][1]) return new int[] {liquid, 0};
      if (y == 63) return new int[] {1, 0};
      return new int[] {0, 0};
    };
  }
  // Cactus support: soil at (0, 63, 0); `neighbour` at y 64 on the sides in `mask`.
  static Base cactusAround(int soil, int neighbour, int nmeta, int mask) {
    return (x, y, z) -> {
      if (y < 63) return new int[] {1, 0};
      if (y == 63) return new int[] {x == 0 && z == 0 ? soil : 1, 0};
      if (y == 64) for (int i = 0; i < 4; i++) if ((mask & 1 << i) != 0 && x == SIDES[i][0] && z == SIDES[i][1]) return new int[] {neighbour, nmeta};
      return new int[] {0, 0};
    };
  }

  // Growth: ticks updateTick on the listed y levels in turn, recording the column after each.
  static String column(W w) {
    StringBuilder b = new StringBuilder();
    for (int y = 64; y < 68; y++) {
      int[] c = w.cell(0, y, 0);
      if (c[0] == 0) break;
      b.append(b.length() > 0 ? " " : "").append(c[0]).append(":").append(c[1]);
    }
    return b.toString();
  }
  static void growth(String name, int id, Base base, int[] start, int[] order, int ticks) throws Exception {
    W w = world(base);
    for (int i = 0; i < start.length; i++) w.put(0, 64 + i, 0, id, start[i]);
    aji block = aji.e(id);
    StringBuilder out = new StringBuilder();
    for (int t = 0; t < ticks; t++) {
      int y = 64 + order[t % order.length];
      if (w.cell(0, y, 0)[0] == id) block.a(w, 0, y, 0, new Random(t));
      out.append(t > 0 ? "," : "").append(q(column(w)));
    }
    System.out.println("{\"case\":\"growth\",\"name\":" + q(name) + ",\"block\":" + id + ",\"start\":" + Arrays.toString(start) + ",\"order\":" + Arrays.toString(order) + ",\"columns\":[" + out + "],\"drops\":" + stacks(w.spawned) + "}");
  }

  static String fall(String name, int id, int meta, int top, Base base) throws Exception {
    W w = world(base);
    w.put(0, top, 0, id, meta);
    akx block = (akx) aji.e(id);
    block.b(w, 0, top, 0); // onBlockAdded schedules the update
    block.a(w, 0, top, 0, new Random(1));
    StringBuilder ticks = new StringBuilder();
    String start = "null";
    if (!w.spawned.isEmpty() && w.spawned.get(0) instanceof xj) {
      xj e = (xj) w.spawned.get(0);
      start = "[" + e.s + "," + e.t + "," + e.u + "," + e.C.b + "," + e.L + "]";
      for (int i = 0; i < 700 && !e.K; i++) {
        e.h();
        ticks.append(i > 0 ? "," : "").append("[").append(e.t).append(",").append(e.w).append(",").append(e.D).append(",").append(e.K).append("]");
      }
    }
    List<sa> items = new ArrayList<>();
    for (sa e : w.spawned) if (e instanceof xk) items.add(e);
    return "{\"case\":\"fall\",\"name\":" + q(name) + ",\"block\":" + id + ",\"meta\":" + meta + ",\"top\":" + top + ",\"scheduled\":" + q(String.join(";", w.scheduled))
      + ",\"spawned\":" + w.spawned.size() + ",\"start\":" + start + ",\"ticks\":[" + ticks + "],\"sets\":" + sets(w) + ",\"items\":" + stacks(items) + "}";
  }

  // Fixture for the decorators: stone below 60, dirt to 62, grass (or `top`) at 63, a pond of still water
  // at y 63 where x*x + z*z <= 10 (dirt below it), air above.
  static Base pond(int top) {
    return (x, y, z) -> {
      if (y < 60) return new int[] {1, 0};
      if (y < 63) return new int[] {3, 0};
      if (y == 63) return new int[] {x * x + z * z <= 10 ? 9 : top, 0};
      return new int[] {0, 0};
    };
  }

  static add item(int id, int count, int damage) { return new add(adb.d(id), count, damage); }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    unsafe = MobMoveProbe.unsafe();
    W w0 = world((x, y, z) -> new int[] {0, 0});
    for (int id : new int[] {83, 81, 12, 13}) System.out.println(facts(w0, id));

    // Cactus collision and selection boxes, in two cells.
    for (int[] p : new int[][] {{0, 64, 0}, {37, 20, 101}})
      System.out.println("{\"case\":\"cactusBounds\",\"at\":" + Arrays.toString(p) + ",\"collision\":" + box(aji.e(81).a(w0, p[0], p[1], p[2])) + ",\"selection\":" + box(aji.e(81).g(w0, p[0], p[1], p[2]))
        + ",\"reedCollision\":" + box(aji.e(83).a(w0, p[0], p[1], p[2])) + "}");
    aji reeds = aji.e(83), cactus = aji.e(81);
    System.out.println("{\"case\":\"reedBounds\",\"bounds\":[" + reeds.x() + "," + reeds.z() + "," + reeds.B() + "," + reeds.y() + "," + reeds.A() + "," + reeds.C() + "]}");

    // BlockReed.canPlaceBlockAt / canBlockStay / onNeighborBlockChange per soil and water mask.
    for (int soil : new int[] {2, 3, 12, 1, 13, 60, 82, 0, 83})
      for (int liquid : new int[] {9, 8, 11, 79})
        for (int mask = 0; mask < 16; mask++) {
          if (liquid != 9 && mask != 1) continue;
          W w = world(around(soil, mask, liquid));
          w.put(0, 64, 0, 83, 0);
          boolean place = reeds.c(w, 0, 64, 0), stay = reeds.j(w, 0, 64, 0);
          reeds.a(w, 0, 64, 0, aji.e(0));
          System.out.println("{\"case\":\"reedSupport\",\"soil\":" + soil + ",\"liquid\":" + liquid + ",\"mask\":" + mask + ",\"canPlace\":" + place + ",\"canStay\":" + stay
            + ",\"after\":" + w.cell(0, 64, 0)[0] + ",\"drops\":" + stacks(w.spawned) + "}");
        }

    // BlockCactus.canPlaceBlockAt / canBlockStay / onNeighborBlockChange.
    int[][] neighbours = {{1, 0}, {20, 0}, {9, 0}, {50, 5}, {81, 0}, {83, 0}, {31, 1}, {78, 0}, {78, 7}, {65, 2}, {18, 0}, {79, 0}, {54, 0}, {30, 0}, {37, 0}, {51, 0}, {80, 0}};
    for (int soil : new int[] {12, 81, 2, 3, 1, 0, 13})
      System.out.println(cactusSupport(soil, 0, 0, 0, 0));
    for (int[] n : neighbours)
      for (int mask : new int[] {1, 2, 4, 8, 15}) System.out.println(cactusSupport(12, n[0], n[1], mask, 0));
    // The placing cell itself (super.canPlaceBlockAt needs a replaceable material).
    for (int[] c : new int[][] {{9, 0}, {31, 1}, {78, 0}, {1, 0}, {37, 0}})
      System.out.println(cactusSupport(12, 0, 0, 0, c[0] << 4 | c[1]));

    // Growth on support. Order lists the column level (0 = bottom) ticked each time.
    growth("reed-single", 83, around(2, 1, 9), new int[] {0}, new int[] {0}, 20);
    growth("reed-column", 83, around(2, 1, 9), new int[] {0}, new int[] {0, 1, 2, 3}, 140);
    growth("reed-meta", 83, around(3, 8, 9), new int[] {14}, new int[] {0}, 4);
    growth("reed-unsupported", 83, around(2, 0, 9), new int[] {7}, new int[] {0}, 3);
    growth("reed-on-reed-unsupported", 83, around(2, 0, 9), new int[] {3, 15}, new int[] {1, 0}, 4);
    growth("reed-tall", 83, around(12, 4, 9), new int[] {0, 0, 15}, new int[] {2, 1, 0}, 6);
    growth("reed-roof", 83, (x, y, z) -> x == 0 && z == 0 && y == 65 ? new int[] {1, 0} : around(2, 1, 9).at(x, y, z), new int[] {15}, new int[] {0}, 3);
    growth("cactus-single", 81, cactusAround(12, 0, 0, 0), new int[] {0}, new int[] {0}, 20);
    growth("cactus-column", 81, cactusAround(12, 0, 0, 0), new int[] {0}, new int[] {0, 1, 2, 3}, 140);
    growth("cactus-meta", 81, cactusAround(12, 0, 0, 0), new int[] {14}, new int[] {0}, 4);
    growth("cactus-grows-into-stone-neighbour", 81, (x, y, z) -> x == 1 && z == 0 && y == 65 ? new int[] {1, 0} : cactusAround(12, 0, 0, 0).at(x, y, z), new int[] {15}, new int[] {0}, 2);
    growth("cactus-unsupported", 81, cactusAround(2, 0, 0, 0), new int[] {15}, new int[] {0}, 2);
    growth("cactus-tall", 81, cactusAround(12, 0, 0, 0), new int[] {0, 0, 15}, new int[] {2, 1, 0}, 6);

    // BlockCactus.onEntityCollidedWithBlock on a recording entity, an EntityItem and an EntityXPOrb.
    ro src = (ro) MobMoveProbe.field(ro.class, "g").get(null);
    final List<String> hits = new ArrayList<>();
    sa probe = new sa(w0) {
      protected void c() {}
      protected void a(dh tag) {}
      protected void b(dh tag) {}
      public boolean a(ro s, float amount) { hits.add(s.o + "|" + amount); return false; }
    };
    cactus.a(w0, 0, 64, 0, probe);
    xk itemEntity = new xk(w0, 0.5, 65, 0.5, item(81, 1, 0));
    int itemHits = 0;
    while (!itemEntity.K && itemHits < 20) { cactus.a(w0, 0, 64, 0, itemEntity); itemHits++; }
    sq orb = new sq(w0, 0.5, 65, 0.5, 3);
    int orbHits = 0;
    while (!orb.K && orbHits < 20) { cactus.a(w0, 0, 64, 0, orb); orbHits++; }
    System.out.println("{\"case\":\"cactusDamage\",\"hits\":" + q(String.join(";", hits)) + ",\"type\":" + q(src.o) + ",\"unblockable\":" + src.e() + ",\"fire\":" + src.o() + ",\"exhaustion\":" + src.f()
      + ",\"itemHitsToDie\":" + itemHits + ",\"orbHitsToDie\":" + orbHits + "}");

    // BlockFalling.func_149831_e (canFallBelow) on each block below.
    StringBuilder below = new StringBuilder();
    for (int[] b : new int[][] {{0, 0}, {51, 0}, {9, 0}, {8, 3}, {11, 0}, {10, 2}, {31, 1}, {78, 0}, {50, 5}, {83, 0}, {37, 0}, {30, 0}, {65, 2}, {1, 0}, {12, 0}, {81, 0}, {59, 3}, {6, 0}, {18, 0}, {20, 0}}) {
      final int[] bb = b;
      W w = world((x, y, z) -> y == 4 ? new int[] {bb[0], bb[1]} : new int[] {0, 0});
      below.append(below.length() > 0 ? "," : "").append("[").append(b[0]).append(",").append(b[1]).append(",").append(akx.e(w, 0, 4, 0)).append("]");
    }
    System.out.println("{\"case\":\"canFallBelow\",\"results\":[" + below + "]}");

    // Falls from y 5 (or another top) onto a stone floor (y < 1) with something at y 1.
    Object[][] falls = {
      {"stone", 12, 0, 5, 1, 0}, {"supported", 12, 0, 5, 1, 0}, {"torch", 12, 0, 5, 50, 5}, {"tallgrass", 12, 0, 5, 31, 1}, {"water", 12, 0, 5, 9, 0},
      {"flower", 12, 0, 5, 37, 0}, {"snow3", 12, 0, 5, 78, 2}, {"snow0", 12, 0, 5, 78, 0}, {"lava", 12, 0, 5, 11, 0}, {"cactus", 12, 0, 5, 81, 0},
      {"web", 12, 0, 5, 30, 0}, {"reeds", 12, 0, 5, 83, 0}, {"fire-below", 12, 0, 5, 51, 0}, {"gravel-stone", 13, 0, 5, 1, 0}, {"gravel-torch", 13, 0, 5, 50, 5},
      {"red-sand-torch", 12, 1, 5, 50, 5}, {"high", 12, 0, 60, 1, 0}, {"ladder", 12, 0, 5, 65, 3}, {"sapling", 12, 0, 5, 6, 0}, {"wheat", 12, 0, 5, 59, 7},
    };
    for (Object[] f : falls) {
      final String name = (String) f[0];
      final int at = (Integer) f[4], atMeta = (Integer) f[5];
      Base base = (x, y, z) -> {
        if (y < 1) return new int[] {1, 0};
        if (name.equals("supported")) return y == 4 && x == 0 && z == 0 ? new int[] {1, 0} : new int[] {0, 0};
        if (name.equals("fire-below")) return y == 4 && x == 0 && z == 0 ? new int[] {51, 0} : new int[] {0, 0};
        if (name.equals("water")) return x == 0 && z == 0 && y <= 3 ? new int[] {9, 0} : new int[] {0, 0};
        if (name.equals("ladder")) return x == 0 && z == 1 && y <= 2 ? new int[] {1, 0} : x == 0 && z == 0 && y == 1 ? new int[] {65, 2} : new int[] {0, 0};
        if (name.equals("stone") || name.equals("high") || name.equals("gravel-stone")) return new int[] {0, 0};
        return x == 0 && z == 0 && y == 1 ? new int[] {at, atMeta} : new int[] {0, 0};
      };
      System.out.println(fall(name, (Integer) f[1], (Integer) f[2], (Integer) f[3], base));
    }

    // BlockGravel.getItemDropped for fortune 0-4 from seeded Randoms.
    for (int fortune = 0; fortune <= 4; fortune++) {
      Random r = new Random(7 + fortune);
      StringBuilder d = new StringBuilder();
      for (int i = 0; i < 60; i++) d.append(i > 0 ? "," : "").append(adb.b(aji.e(13).a(0, r, fortune)));
      System.out.println("{\"case\":\"gravelDrops\",\"seed\":" + (7 + fortune) + ",\"fortune\":" + fortune + ",\"drops\":[" + d + "]}");
    }

    // ItemReed.onItemUse.
    Object[][] uses = {
      // name, x, y, z, side, fixture extra block at (0,64,0) id, meta
      {"grass-top", 0, 63, 0, 1, 0, 0}, {"stone-top", 1, 63, 0, 1, 0, 0}, {"grass-side", 0, 63, 0, 2, 0, 0}, {"tallgrass", 0, 64, 0, 0, 31, 1}, {"snow0-side", 0, 64, 0, 3, 78, 0},
      {"snow1-top", 0, 64, 0, 1, 78, 1}, {"reed-top", 0, 64, 0, 1, 83, 0}, {"flower", 0, 64, 0, 1, 37, 0}, {"occupied", 0, 63, 0, 1, 1, 0}, {"water-side", -1, 63, 0, 1, 0, 0},
    };
    blk player = (blk) unsafe.allocateInstance(blk.class);
    MobMoveProbe.set(player, "bE", new yw());
    for (Object[] u : uses) {
      final int extra = (Integer) u[5], extraMeta = (Integer) u[6];
      Base b = around(2, 1, 9);
      W w = world((x, y, z) -> x == 0 && z == 0 && y == 64 && extra != 0 ? new int[] {extra, extraMeta} : b.at(x, y, z));
      if (extra == 83) w.put(0, 65, 0, 0, 0);
      add stack = item(338, 3, 0);
      boolean ok = adb.d(338).a(stack, player, w, (Integer) u[1], (Integer) u[2], (Integer) u[3], (Integer) u[4], 0.5f, 1f, 0.5f);
      System.out.println("{\"case\":\"itemReed\",\"name\":" + q((String) u[0]) + ",\"result\":" + ok + ",\"sets\":" + sets(w) + ",\"count\":" + stack.b + "}");
    }

    // Decorators on the pond fixture: WorldGenReed and WorldGenSand at the pond, WorldGenCactus on sand.
    for (long seed = 1; seed <= 6; seed++) {
      W w = world(pond(2));
      Random r = new Random(seed);
      boolean res = new ash().a(w, r, (int) seed - 3, 64, 2 - (int) seed);
      System.out.println("{\"case\":\"genReed\",\"seed\":" + seed + ",\"at\":[" + (seed - 3) + ",64," + (2 - seed) + "],\"result\":" + res + ",\"sets\":" + sets(w) + ",\"next\":" + r.nextInt() + "}");
    }
    for (long seed = 1; seed <= 6; seed++) {
      W w = world(pond(2));
      Random r = new Random(seed);
      int x = seed > 4 ? 6 : (int) seed - 2, z = 1 - (int) (seed % 3);
      boolean res = new asj(aji.e(12), 7).a(w, r, x, 63, z);
      System.out.println("{\"case\":\"genSand\",\"seed\":" + seed + ",\"at\":[" + x + ",63," + z + "],\"result\":" + res + ",\"sets\":" + q(sha(sets(w))) + ",\"count\":" + w.sets.size() + ",\"next\":" + r.nextInt() + "}");
    }
    for (long seed = 1; seed <= 6; seed++) {
      final long sd = seed;
      W w = world((x, y, z) -> y < 63 ? new int[] {12, 0} : y == 63 ? new int[] {(x + z + sd) % 7 == 0 ? 1 : 12, 0} : new int[] {0, 0});
      Random r = new Random(seed);
      boolean res = new arh().a(w, r, 0, 64, 0);
      System.out.println("{\"case\":\"genCactus\",\"seed\":" + seed + ",\"result\":" + res + ",\"sets\":" + sets(w) + ",\"next\":" + r.nextInt() + "}");
    }

    // Smelting and crafting.
    add smelt = afa.a().a(item(81, 1, 0));
    System.out.println("{\"case\":\"smelt\",\"input\":81,\"result\":[" + adb.b(smelt.b()) + "," + smelt.b + "," + smelt.k() + "],\"xp\":" + afa.a().b(smelt) + "}");
    zs container = new zs() { public boolean a(yz p) { return true; } };
    int[][][] grids = {
      {{338, 338, 338}, {0, 0, 0}, {0, 0, 0}}, {{0, 0, 0}, {338, 338, 338}, {0, 0, 0}}, {{338, 0, 0}, {338, 0, 0}, {338, 0, 0}}, {{338, 338, 0}, {0, 0, 0}, {0, 0, 0}},
      {{338, 0, 0}, {0, 0, 0}, {0, 0, 0}}, {{0, 0, 0}, {0, 0, 0}, {0, 0, 338}}, {{338, 0, 0}, {0, 338, 0}, {0, 0, 0}},
      {{339, 339, 339}, {334, 0, 0}, {0, 0, 0}}, {{339, 0, 334}, {0, 339, 0}, {339, 0, 0}}, {{339, 339, 339}, {0, 0, 0}, {0, 0, 0}}, {{339, 339, 334}, {0, 0, 0}, {0, 0, 0}},
      {{339, 339, 339}, {334, 334, 0}, {0, 0, 0}},
    };
    for (int[][] g : grids) {
      aae grid = new aae(container, 3, 3);
      for (int r = 0; r < 3; r++) for (int c = 0; c < 3; c++) if (g[r][c] != 0) grid.a(r * 3 + c, item(g[r][c], 1, 0));
      add res = afe.a().a(grid, null);
      System.out.println("{\"case\":\"craft\",\"grid\":" + Arrays.deepToString(g) + ",\"result\":" + (res == null ? "null" : "[" + adb.b(res.b()) + "," + res.b + "," + res.k() + "]") + "}");
    }
  }

  // onNeighborBlockChange runs with isRemote false, so a broken cactus drops through func_147480_a.
  static String cactusSupport(int soil, int neighbour, int nmeta, int mask, int cellPacked) throws Exception {
    final Base b = cactusAround(soil, neighbour, nmeta, mask);
    final int cell = cellPacked;
    W w = world((x, y, z) -> cell != 0 && x == 0 && z == 0 && y == 64 ? new int[] {cell >> 4, cell & 15} : b.at(x, y, z));
    aji cactus = aji.e(81);
    boolean place = cactus.c(w, 0, 64, 0), stay = cactus.j(w, 0, 64, 0);
    w.put(0, 64, 0, 81, 0);
    cactus.a(w, 0, 64, 0, aji.e(0));
    return "{\"case\":\"cactusSupport\",\"soil\":" + soil + ",\"neighbour\":" + neighbour + ",\"neighbourMeta\":" + nmeta + ",\"mask\":" + mask + ",\"cell\":" + (cell >> 4) + ",\"cellMeta\":" + (cell & 15)
      + ",\"canPlace\":" + place + ",\"canStay\":" + stay + ",\"after\":" + w.cell(0, 64, 0)[0] + ",\"drops\":" + stacks(w.spawned) + "}";
  }
}
