import java.util.*;

// Unchanged redstone-component blocks of Minecraft Java 1.7.10: BlockRedstoneWire (ana, 55),
// BlockLever (alv, 69), BlockPressurePlate (amu, 70 stone / 72 wood), BlockButtonStone (anx, 77),
// BlockRedstoneRepeater (anf, 93 unpowered / 94 powered), BlockTripWireHook (aog, 131) and
// BlockTripWire (aof, 132), plus the unchanged items that place them: ItemRedstone (ads),
// ItemBlock (abh) and ItemReed (abi, string and repeater). The world is a sparse cell map as in
// FenceRailProbe: setBlock stores the cell and then runs Block.onBlockAdded as Chunk does,
// setBlockMetadataWithNotify stores the metadata, setBlockToAir removes the cell and counts it,
// neighbour notifications, block events and scheduled updates are recorded instead of delivered
// (the power network is not run, see public/research/redstone-blocks.md), doTileDrops is off so no
// item entity is spawned, and the entity lists are empty. The player is an EntityPlayer subclass
// that only implements its three abstract ICommandSender methods.
public class RedstoneBlocksProbe {
  static final Map<Long, int[]> cells = new HashMap<>();
  static boolean floor = false;
  static int removed = 0;
  static final List<String> ev = new ArrayList<>();
  static final int[] IDS = {55, 69, 70, 72, 77, 93, 94, 131, 132};

  static long key(int x, int y, int z) { return ((long) (x + 1000) * 4096 + (y + 1000)) * 4096 + (z + 1000); }
  static void put(int x, int y, int z, int id, int meta) { cells.put(key(x, y, z), new int[] {id, meta}); }
  static int[] cell(int x, int y, int z) { return cells.get(key(x, y, z)); }
  static void reset() { cells.clear(); floor = false; removed = 0; ev.clear(); }

  public static class World extends MobMoveProbe.ProbeWorld {
    public aji a(int x, int y, int z) {
      int[] c = cell(x, y, z);
      if (c != null) return aji.e(c[0]);
      return floor && y < 0 ? aji.e(1) : aji.e(0);
    }
    public int e(int x, int y, int z) { int[] c = cell(x, y, z); return c == null ? 0 : c[1]; }
    public boolean a(int x, int y, int z, int meta, int flags) { int[] c = cell(x, y, z); if (c == null) return false; c[1] = meta; return true; }
    public boolean f(int x, int y, int z) { removed++; cells.remove(key(x, y, z)); return true; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { put(x, y, z, aji.b(b), meta); b.b(this, x, y, z); return true; }
    public boolean v(int x, int y, int z) { return false; }
    public boolean c(int x, int y, int z, boolean def) { return a(x, y, z).r(); }
    public void d(int x, int y, int z, aji b) { ev.add("notify:" + x + "," + y + "," + z); }
    public void e(int x, int y, int z, aji b) { ev.add("notifyAll:" + x + "," + y + "," + z); }
    public void f(int x, int y, int z, aji b) { ev.add("notifyStrong:" + x + "," + y + "," + z); }
    public void c(int x, int y, int z, int x2, int y2, int z2) {}
    public void a(double x, double y, double z, String s, float v, float p) { ev.add("sound:" + s + ":" + v + ":" + p); }
    public void a(int x, int y, int z, aji b, int delay) { ev.add("schedule:" + x + "," + y + "," + z + ":" + aji.b(b) + ":" + delay); }
    public void c(int x, int y, int z, aji b, int a, int d) { ev.add("event:" + x + "," + y + "," + z); }
    public List b(sa e, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public agy O() { agy g = new agy(); g.b("doTileDrops", "false"); return g; }
  }

  public static class Player extends yz {
    Player() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  static World w;
  static Player player;

  static String box(azt b) { return b == null ? "null" : "[" + b.a + "," + b.b + "," + b.c + "," + b.d + "," + b.e + "," + b.f + "]"; }
  static String bounds(aji b) throws Exception {
    String[] f = {"B", "C", "D", "E", "F", "G"};
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < 6; i++) s.append(i > 0 ? "," : "").append(MobMoveProbe.field(aji.class, f[i]).getDouble(b));
    return s.append("]").toString();
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String material(awt m) {
    return m == awt.d ? "wood" : m == awt.e ? "rock" : m == awt.q ? "circuits" : m == awt.a ? "air" : "other";
  }
  static String list(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static String events() { List<String> o = new ArrayList<>(); for (String e : ev) o.add(q(e)); return list(o); }
  static String mask(boolean[] b) { StringBuilder s = new StringBuilder(); for (boolean x : b) s.append(x ? '1' : '0'); return s.toString(); }
  static String itemId(adb i) { return i == null ? "null" : String.valueOf(adb.b(i)); }

  static String facts(String name, aji b) throws Exception {
    adb pick = null;
    List<String> drops = new ArrayList<>(), damage = new ArrayList<>(), picks = new ArrayList<>();
    for (int meta = 0; meta < 16; meta++) {
      reset();
      put(0, 0, 0, aji.b(b), meta);
      adb d = b.a(meta, new Random(1), 0);
      drops.add(itemId(d));
      damage.add(String.valueOf(b.a(meta)));
      adb p = b.d(w, 0, 0, 0);
      picks.add(itemId(p));
    }
    reset();
    ajm s = b.H;
    return "{\"case\":\"facts\",\"block\":" + q(name) + ",\"id\":" + aji.b(b) + ",\"hardness\":" + b.f(w, 0, 0, 0)
      + ",\"resistance\":" + MobMoveProbe.field(aji.class, "w").getFloat(b) + ",\"opacity\":" + b.k() + ",\"light\":" + b.m()
      + ",\"render\":" + b.b() + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r()
      + ",\"material\":" + q(material(b.o())) + ",\"materialOpaque\":" + b.o().k() + ",\"blocksMovement\":" + b.o().c()
      + ",\"requiresTool\":" + !b.o().l() + ",\"canProvidePower\":" + b.f() + ",\"tickRate\":" + b.a((ahb) w)
      + ",\"sound\":{\"break\":" + q(s.a()) + ",\"step\":" + q(s.e()) + ",\"place\":" + q(s.b()) + ",\"volume\":" + s.c() + ",\"pitch\":" + s.d() + "}"
      + ",\"quantity\":" + b.a(new Random(1)) + ",\"drop\":" + list(drops) + ",\"damageDropped\":" + list(damage) + ",\"pick\":" + list(picks) + "}";
  }

  static final double[][] RAY = {{-2, .5, .5, 3, .5, .5}, {3, .5, .5, -2, .5, .5}, {.5, -2, .5, .5, 3, .5}, {.5, 3, .5, .5, -2, .5}, {.5, .5, -2, .5, .5, 3}, {.5, .5, 3, .5, .5, -2}};

  static String boundsRow(aji b, int meta) throws Exception {
    reset(); floor = true;
    put(0, 0, 0, aji.b(b), meta);
    b.a((ahl) w, 0, 0, 0);
    String bnd = bounds(b), col = box(b.a(w, 0, 0, 0)), sel = box(b.g(w, 0, 0, 0));
    List<String> rays = new ArrayList<>();
    for (double[] r : RAY) {
      azu hit = b.a(w, 0, 0, 0, azw.a(r[0], r[1], r[2]), azw.a(r[3], r[4], r[5]));
      rays.add(hit == null ? "null" : "[" + hit.e + "," + hit.f.a + "," + hit.f.b + "," + hit.f.c + "]");
    }
    return "{\"case\":\"bounds\",\"id\":" + aji.b(b) + ",\"meta\":" + meta + ",\"bounds\":" + bnd + ",\"collision\":" + col + ",\"selection\":" + sel + ",\"ray\":" + list(rays) + "}";
  }

  static Player player(float yaw) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    Player p = (Player) u.allocateInstance(Player.class);
    MobMoveProbe.set(p, "o", w);
    MobMoveProbe.set(p, "Z", new Random(0));
    MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.set(p, "y", Float.valueOf(yaw));
    return p;
  }

  static final int[][] SIDE = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
  static final int[][] NEIGH = {{-1, 0, 0}, {1, 0, 0}, {0, 0, -1}, {0, 0, 1}, {0, -1, 0}, {0, 1, 0}};

  // Click side `side` of the stone block Q so that the item lands in P = (0, 1, 0): Q = P - SIDE[side].
  // mode 0: only Q is solid. mode 1: stone on all six neighbours of P.
  static String place(String name, adb item, aji block, int side, float yaw, int mode) throws Exception {
    reset();
    int px = 0, py = 1, pz = 0, qx = px - SIDE[side][0], qy = py - SIDE[side][1], qz = pz - SIDE[side][2];
    put(qx, qy, qz, 1, 0);
    if (mode == 1) for (int[] n : NEIGH) put(px + n[0], py + n[1], pz + n[2], 1, 0);
    int raw = block.a(w, px, py, pz, side, 0.5f, 0.5f, 0.5f, 0);
    Player pl = player(yaw);
    add stack = new add(item, 1, 0);
    boolean ok = item.a(stack, pl, w, qx, qy, qz, side, 0.5f, 0.5f, 0.5f);
    int[] c = cell(px, py, pz);
    return "{\"case\":\"place\",\"item\":" + name + ",\"mode\":" + mode + ",\"side\":" + side + ",\"yaw\":" + yaw + ",\"onBlockPlaced\":" + raw
      + ",\"used\":" + ok + ",\"cell\":" + (c == null ? "null" : "[" + c[0] + "," + c[1] + "]") + ",\"stack\":" + stack.b + ",\"events\":" + events() + "}";
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    w = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    String[] names = {"redstone_wire", "lever", "stone_pressure_plate", "wooden_pressure_plate", "stone_button", "unpowered_repeater", "powered_repeater", "tripwire_hook", "tripwire"};
    for (int i = 0; i < IDS.length; i++) System.out.println(facts(names[i], aji.e(IDS[i])));

    for (int id : IDS) for (int meta = 0; meta < 16; meta++) System.out.println(boundsRow(aji.e(id), meta));

    // Support from a single block below (x 0, y 0, z 0) for the blocks that rest on the floor:
    // canPlaceBlockAt and the removal done by onNeighborBlockChange, per original id and metadata.
    int[] floorBlocks = {55, 70, 72, 93, 94, 132};
    for (int id = 0; id < 176; id++) {
      if (id >= 165 && id <= 169) continue;
      StringBuilder row = new StringBuilder("{\"case\":\"below\",\"id\":" + id);
      StringBuilder can = new StringBuilder(), stay = new StringBuilder();
      for (int fb = 0; fb < floorBlocks.length + 1; fb++) {
        int fid = fb < floorBlocks.length ? floorBlocks[fb] : 132;
        aji b = aji.e(fid);
        int canMask = 0, goneMask = 0;
        for (int meta = 0; meta < 16; meta++) {
          reset();
          put(0, 0, 0, id, meta);
          if (b.c(w, 0, 1, 0)) canMask |= 1 << meta;
          // tripwire: removal checked at meta 0 and meta 2 (the disarmed bit); others at meta 0.
          for (int own : (fb >= floorBlocks.length ? new int[] {2} : fb == floorBlocks.length - 1 ? new int[] {0} : new int[] {0})) {
            reset();
            put(0, 0, 0, id, meta);
            put(0, 1, 0, fid, own);
            b.a(w, 0, 1, 0, aji.e(0));
            if (removed > 0) goneMask |= 1 << meta;
          }
        }
        if (fb < floorBlocks.length) row.append(",\"can").append(fid).append("\":").append(canMask);
        row.append(",\"gone").append(fid).append(fb >= floorBlocks.length ? "d" : "").append("\":").append(goneMask);
      }
      System.out.println(row + "}");
    }

    // Wall/floor/ceiling attachment for the lever, the button and the tripwire hook: stone at x-1 (bit 0),
    // x+1 (1), z-1 (2), z+1 (3), y-1 (4) and y+1 (5) of P = (0,1,0). canPlaceBlockAt, canPlaceBlockOnSide for
    // each side and onNeighborBlockChange per metadata (1 = block removed).
    for (int id : new int[] {69, 77, 131}) {
      aji b = aji.e(id);
      boolean[] can = new boolean[64];
      boolean[][] on = new boolean[6][64], gone = new boolean[16][64];
      for (int m = 0; m < 64; m++) {
        reset();
        for (int n = 0; n < 6; n++) if ((m >> n & 1) != 0) put(NEIGH[n][0], 1 + NEIGH[n][1], NEIGH[n][2], 1, 0);
        can[m] = b.c(w, 0, 1, 0);
        for (int s = 0; s < 6; s++) on[s][m] = b.d(w, 0, 1, 0, s);
        for (int meta = 0; meta < 16; meta++) {
          reset();
          for (int n = 0; n < 6; n++) if ((m >> n & 1) != 0) put(NEIGH[n][0], 1 + NEIGH[n][1], NEIGH[n][2], 1, 0);
          put(0, 1, 0, id, meta);
          b.a(w, 0, 1, 0, aji.e(0));
          gone[meta][m] = removed > 0;
        }
      }
      List<String> o = new ArrayList<>(), g = new ArrayList<>();
      for (int s = 0; s < 6; s++) o.add(q(mask(on[s])));
      for (int meta = 0; meta < 16; meta++) g.add(q(mask(gone[meta])));
      System.out.println("{\"case\":\"sides\",\"id\":" + id + ",\"can\":" + q(mask(can)) + ",\"onSide\":" + list(o) + ",\"gone\":" + list(g) + "}");
    }

    // Item placement through the unchanged ItemBlock / ItemReed / ItemRedstone onItemUse.
    Object[][] items = {
      {"69", adb.a(aji.e(69)), aji.e(69)}, {"70", adb.a(aji.e(70)), aji.e(70)}, {"72", adb.a(aji.e(72)), aji.e(72)},
      {"77", adb.a(aji.e(77)), aji.e(77)}, {"131", adb.a(aji.e(131)), aji.e(131)},
      {"356", adb.d(356), aji.e(93)}, {"287", adb.d(287), aji.e(132)}, {"331", adb.d(331), aji.e(55)}};
    List<Float> yaws = new ArrayList<>();
    for (int k = -16; k <= 16; k++) yaws.add(k * 22.5f);
    yaws.add(44.9f); yaws.add(45.1f);
    for (Object[] it : items) {
      boolean sweeps = it[0].equals("69") || it[0].equals("356");
      for (int side = 0; side < 6; side++) {
        for (float yaw : sweeps ? yaws : Arrays.asList(0f, 90f)) System.out.println(place((String) it[0], (adb) it[1], (aji) it[2], side, yaw, 0));
        System.out.println(place((String) it[0], (adb) it[1], (aji) it[2], side, 0f, 1));
      }
    }

    // Right-click and scheduled-tick transitions of the lever (69), the stone button (77) and the repeater (93, 94).
    for (int id : new int[] {69, 77, 93, 94}) {
      aji b = aji.e(id);
      for (int meta = 0; meta < 16; meta++) {
        reset();
        put(0, 1, 0, id, meta);
        boolean r = b.a(w, 0, 1, 0, player(0f), 1, 0.5f, 0.5f, 0.5f);
        System.out.println("{\"case\":\"activate\",\"id\":" + id + ",\"meta\":" + meta + ",\"result\":" + r + ",\"after\":" + cell(0, 1, 0)[1] + ",\"events\":" + events() + "}");
      }
    }
    aji button = aji.e(77);
    for (int meta = 0; meta < 16; meta++) {
      reset();
      put(0, 1, 0, 77, meta);
      button.a(w, 0, 1, 0, new Random(1));
      System.out.println("{\"case\":\"buttonTick\",\"meta\":" + meta + ",\"after\":" + cell(0, 1, 0)[1] + ",\"events\":" + events() + "}");
    }

    // BlockRedstoneWire.isPowerProviderOrWire (f) and its repeater-aware sibling (g): for each block id and
    // metadata, masks over the metadata with the block at the queried cell, for sides -1..3 (f) and 0..3 (g).
    for (int id = 0; id < 176; id++) {
      if (id >= 165 && id <= 169) continue;
      List<String> f = new ArrayList<>(), g = new ArrayList<>();
      for (int side = -1; side < 4; side++) {
        int fm = 0, gm = 0;
        for (int meta = 0; meta < 16; meta++) {
          reset();
          put(0, 0, 0, id, meta);
          if (ana.f((ahl) w, 0, 0, 0, side)) fm |= 1 << meta;
          if (side >= 0 && ana.g((ahl) w, 0, 0, 0, side)) gm |= 1 << meta;
        }
        f.add(String.valueOf(fm));
        if (side >= 0) g.add(String.valueOf(gm));
      }
      System.out.println("{\"case\":\"wireConnect\",\"id\":" + id + ",\"f\":" + list(f) + ",\"g\":" + list(g) + "}");
    }
  }
}
