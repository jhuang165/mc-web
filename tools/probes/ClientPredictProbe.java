import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 CLIENT-side block changes of a click, from the unchanged original classes, on a world double whose
// isRemote flag is TRUE (ahb.E): what PlayerControllerMP applies to the client world before the server's S23 arrives.
//  - break: PlayerControllerMP.onPlayerDestroyBlock (bje.a(IIII), bytecode-read order: playAuxSFX 2001, setBlockToAir (flags 3),
//    then Block.onBlockDestroyedByPlayer) replayed call by call. The block's breakBlock and the six-neighbour onNeighborBlockChange
//    chain run for real (DoorPaneProbe.DW dispatches them in World's order). onBlockHarvested / removedByPlayer / harvestBlock are server-only.
//  - use: Item.onItemUse (PlayerControllerMP.onPlayerRightClick -> ItemStack.tryPlaceItemIntoWorld) for doors, bed, sign, skull, cake,
//    reeds, seeds, redstone, repeater and the ItemReed family.
//  - activate: Block.onBlockActivated (the first half of onPlayerRightClick) for doors, trapdoors, gates, levers, buttons, bed, cake, repeater.
// Light is stubbed as full daylight (getFullBlockLightValue 15, canBlockSeeTheSky true) so BlockBush.canBlockStay depends on the block below only.
// Records give the cells that differ afterwards as [x, y, z, id, meta] (original ids).
public class ClientPredictProbe {
  static final int X = 8, Y = 64, Z = 8;

  public static class CW extends DoorPaneProbe.DW {
    public int j(int x, int y, int z) { return 15; }
    public int k(int x, int y, int z) { return 15; }
    public boolean i(int x, int y, int z) { return true; }
    public aor o(int x, int y, int z) { return null; }
    public void p(int x, int y, int z) {}
    public void g(int x, int y, int z) {}
  }

  static CW world(int[][] setup) throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    CW w = (CW) u.allocateInstance(CW.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(w, u.allocateInstance(ays.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, true); // isRemote: the client world
    MobMoveProbe.set(w, "v", BedProbe.chunkProvider()); // a chunk provider that reports every chunk loaded (BlockTorch's support check asks)
    w.cells = new HashMap<>();
    w.spawned = new ArrayList<>();
    w.scheduled = new ArrayList<>();
    w.sets = new ArrayList<>();
    w.log = new ArrayList<>();
    w.power = new HashSet<>();
    w.base = (x, y, z) -> new int[] {y < 0 ? 1 : (y == 63 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : 0), 0};
    for (int[] c : setup) w.put(c[0], c[1], c[2], c[3], c[4]);
    return w;
  }

  static Map<String, int[]> snapshot(CW w) {
    Map<String, int[]> m = new TreeMap<>();
    for (int x = 2; x <= 14; x++) for (int y = 60; y <= 70; y++) for (int z = 2; z <= 14; z++) {
      int[] c = w.cell(x, y, z);
      m.put(x + "," + y + "," + z, new int[] {x, y, z, c[0], c[1]});
    }
    return m;
  }

  static String diff(Map<String, int[]> before, CW w) {
    List<String> l = new ArrayList<>();
    for (Map.Entry<String, int[]> e : before.entrySet()) {
      int[] b = e.getValue(), c = w.cell(b[0], b[1], b[2]);
      if (c[0] != b[3] || c[1] != b[4]) l.add("[" + b[0] + "," + b[1] + "," + b[2] + "," + c[0] + "," + c[1] + "]");
    }
    return "[" + String.join(",", l) + "]";
  }

  static String setupJson(int[][] s) {
    List<String> l = new ArrayList<>();
    for (int[] c : s) l.add("[" + c[0] + "," + c[1] + "," + c[2] + "," + c[3] + "," + c[4] + "]");
    return "[" + String.join(",", l) + "]";
  }

  static int[] c(int x, int y, int z, int id, int meta) { return new int[] {x, y, z, id, meta}; }
  static int[][] s(int[]... cs) { return cs; }
  static void line(String x) { System.out.println(x); }
  static String q(String x) { return DoorPaneProbe.q(x); }

  static void breaking(String name, int[][] setup, int tx, int ty, int tz) throws Exception {
    CW w = world(setup);
    Map<String, int[]> before = snapshot(w);
    String err = "null";
    boolean flag = false;
    try {
      aji b = w.a(tx, ty, tz);
      // bje.a(IIII): the air test, aux 2001 (logged), the metadata read, setBlockToAir, then onBlockDestroyedByPlayer when it changed.
      if (b != aji.e(0)) {
        int meta = w.e(tx, ty, tz);
        w.c(2001, tx, ty, tz, aji.b(b) + (meta << 12));
        flag = w.f(tx, ty, tz);
        if (flag) b.b(w, tx, ty, tz, meta);
      }
    } catch (Throwable t) { err = q(t.toString()); }
    line("{\"case\":\"break\",\"name\":" + q(name) + ",\"setup\":" + setupJson(setup) + ",\"target\":[" + tx + "," + ty + "," + tz + "],\"changed\":" + flag + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + "}");
  }

  static void using(String name, int item, int damage, int[][] setup, int px, int py, int pz, int side, float yaw) throws Exception {
    CW w = world(setup);
    Map<String, int[]> before = snapshot(w);
    MobMoveProbe.field(sa.class, "y").setFloat(DoorPaneProbe.player, yaw);
    String err = "null", res = "null";
    int count = 0;
    try {
      adb it = adb.d(item);
      add st = new add(it, 3, damage);
      boolean r = it.a(st, (yz) DoorPaneProbe.player, w, px, py, pz, side, 0.5f, 0.5f, 0.5f);
      res = String.valueOf(r);
      count = st.b;
    } catch (Throwable t) { err = q(t.toString()); }
    line("{\"case\":\"use\",\"name\":" + q(name) + ",\"item\":" + item + ",\"damage\":" + damage + ",\"yaw\":" + yaw + ",\"setup\":" + setupJson(setup) + ",\"at\":[" + px + "," + py + "," + pz + "," + side + "],\"result\":" + res + ",\"count\":" + count + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + "}");
  }

  static void activating(String name, int[][] setup, int px, int py, int pz) throws Exception {
    CW w = world(setup);
    Map<String, int[]> before = snapshot(w);
    String err = "null", res = "null";
    try {
      aji b = w.a(px, py, pz);
      res = String.valueOf(b.a(w, px, py, pz, (yz) DoorPaneProbe.player, 1, 0.5f, 0.5f, 0.5f));
    } catch (Throwable t) { err = q(t.toString()); }
    line("{\"case\":\"activate\",\"name\":" + q(name) + ",\"setup\":" + setupJson(setup) + ",\"at\":[" + px + "," + py + "," + pz + "],\"result\":" + res + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + "}");
  }

  static void breaks() throws Exception {
    breaking("torch-floor", s(c(8, 64, 8, 1, 0), c(8, 65, 8, 50, 5)), 8, 64, 8);
    breaking("torch-wall-west", s(c(8, 64, 8, 1, 0), c(9, 64, 8, 50, 1)), 8, 64, 8);
    breaking("torch-wall-east", s(c(8, 64, 8, 1, 0), c(7, 64, 8, 50, 2)), 8, 64, 8);
    breaking("torch-wall-north", s(c(8, 64, 8, 1, 0), c(8, 64, 9, 50, 3)), 8, 64, 8);
    breaking("torch-wall-south", s(c(8, 64, 8, 1, 0), c(8, 64, 7, 50, 4)), 8, 64, 8);
    breaking("torch-other-side-kept", s(c(8, 64, 8, 1, 0), c(9, 64, 8, 50, 2)), 8, 64, 8);
    breaking("rose-on-grass", s(c(8, 64, 8, 2, 0), c(8, 65, 8, 38, 0)), 8, 64, 8);
    breaking("dandelion-on-dirt", s(c(8, 64, 8, 3, 0), c(8, 65, 8, 37, 0)), 8, 64, 8);
    breaking("tallgrass-on-grass", s(c(8, 64, 8, 2, 0), c(8, 65, 8, 31, 1)), 8, 64, 8);
    breaking("sapling-on-dirt", s(c(8, 64, 8, 3, 0), c(8, 65, 8, 6, 0)), 8, 64, 8);
    breaking("wheat-on-farmland", s(c(8, 64, 8, 60, 7), c(8, 65, 8, 59, 5)), 8, 64, 8);
    breaking("carrots-on-farmland", s(c(8, 64, 8, 60, 7), c(8, 65, 8, 141, 3)), 8, 64, 8);
    breaking("wart-on-soulsand", s(c(8, 64, 8, 88, 0), c(8, 65, 8, 115, 2)), 8, 64, 8);
    breaking("reeds-middle", s(c(8, 64, 8, 12, 0), c(7, 64, 8, 9, 0), c(8, 65, 8, 83, 0), c(8, 66, 8, 83, 0), c(8, 67, 8, 83, 0)), 8, 66, 8);
    breaking("reeds-base-sand", s(c(8, 64, 8, 12, 0), c(7, 64, 8, 9, 0), c(8, 65, 8, 83, 0), c(8, 66, 8, 83, 0), c(8, 67, 8, 83, 0)), 8, 64, 8);
    breaking("reeds-bottom", s(c(8, 64, 8, 12, 0), c(7, 64, 8, 9, 0), c(8, 65, 8, 83, 0), c(8, 66, 8, 83, 0), c(8, 67, 8, 83, 0)), 8, 65, 8);
    breaking("cactus-on-sand", s(c(8, 64, 8, 12, 0), c(8, 65, 8, 81, 0), c(8, 66, 8, 81, 0)), 8, 64, 8);
    for (int[] d : new int[][] {{64, 0}, {64, 3}, {71, 0}, {71, 2}}) {
      int id = d[0], f = d[1];
      breaking("door" + id + "-f" + f + "-lower", s(c(8, 64, 8, id, f), c(8, 65, 8, id, 8)), 8, 64, 8);
      breaking("door" + id + "-f" + f + "-upper", s(c(8, 64, 8, id, f), c(8, 65, 8, id, 8)), 8, 65, 8);
      breaking("door" + id + "-f" + f + "-floor", s(c(8, 64, 8, id, f), c(8, 65, 8, id, 8)), 8, 63, 8);
    }
    breaking("door-open-lower", s(c(8, 64, 8, 64, 4), c(8, 65, 8, 64, 8)), 8, 64, 8);
    for (int f = 0; f < 4; f++) {
      int[][] dir = {{0, 1}, {-1, 0}, {0, -1}, {1, 0}};
      int hx = 8 + dir[f][0], hz = 8 + dir[f][1];
      breaking("bed-f" + f + "-foot", s(c(8, 64, 8, 26, f), c(hx, 64, hz, 26, 8 | f)), 8, 64, 8);
      breaking("bed-f" + f + "-head", s(c(8, 64, 8, 26, f), c(hx, 64, hz, 26, 8 | f)), hx, 64, hz);
      breaking("bed-f" + f + "-floor", s(c(8, 64, 8, 26, f), c(hx, 64, hz, 26, 8 | f)), 8, 63, 8);
    }
    breaking("doubleplant-bottom", s(c(8, 63, 8, 2, 0), c(8, 64, 8, 175, 4), c(8, 65, 8, 175, 8)), 8, 64, 8);
    breaking("doubleplant-top", s(c(8, 63, 8, 2, 0), c(8, 64, 8, 175, 4), c(8, 65, 8, 175, 8)), 8, 65, 8);
    breaking("doubleplant-grass", s(c(8, 63, 8, 2, 0), c(8, 64, 8, 175, 4), c(8, 65, 8, 175, 8)), 8, 63, 8);
    breaking("sign-post-floor", s(c(8, 64, 8, 63, 4)), 8, 63, 8);
    breaking("sign-wall", s(c(8, 64, 8, 68, 2), c(8, 64, 9, 1, 0)), 8, 64, 9);
    breaking("ladder", s(c(8, 64, 8, 65, 2), c(8, 64, 9, 1, 0)), 8, 64, 9);
    breaking("snow-layer", s(c(8, 64, 8, 78, 0)), 8, 63, 8);
    breaking("carpet", s(c(8, 64, 8, 171, 3)), 8, 63, 8);
    breaking("rail", s(c(8, 64, 8, 66, 0)), 8, 63, 8);
    breaking("redstone-dust", s(c(8, 64, 8, 55, 0)), 8, 63, 8);
    breaking("repeater", s(c(8, 64, 8, 93, 0)), 8, 63, 8);
    breaking("pressure-plate", s(c(8, 64, 8, 70, 0)), 8, 63, 8);
    breaking("lever-floor", s(c(8, 64, 8, 69, 5)), 8, 63, 8);
    breaking("lever-wall", s(c(8, 64, 8, 69, 1), c(7, 64, 8, 1, 0)), 7, 64, 8);
    breaking("button-wall", s(c(8, 64, 8, 77, 1), c(7, 64, 8, 1, 0)), 7, 64, 8);
    breaking("cake", s(c(8, 64, 8, 92, 0)), 8, 63, 8);
    breaking("trapdoor", s(c(8, 64, 8, 96, 0), c(8, 64, 9, 1, 0)), 8, 64, 9);
    breaking("sand-over-gap", s(c(8, 64, 8, 12, 0), c(8, 65, 8, 12, 0)), 8, 64, 8);
    breaking("piston-head", s(c(8, 64, 8, 33, 9), c(8, 65, 8, 34, 1)), 8, 65, 8);
    breaking("piston-base-extended", s(c(8, 64, 8, 33, 9), c(8, 65, 8, 34, 1)), 8, 64, 8);
    breaking("plain-stone", s(c(8, 64, 8, 1, 0)), 8, 64, 8);
    breaking("two-torches", s(c(8, 64, 8, 1, 0), c(8, 65, 8, 50, 5), c(9, 64, 8, 50, 1), c(7, 64, 8, 50, 2)), 8, 64, 8);
  }

  static void uses() throws Exception {
    for (int id : new int[] {324, 330}) for (float yaw : new float[] {0, 90, 180, 270, -45}) using("door" + id + "-yaw" + (int) yaw, id, 0, s(), 8, 63, 8, 1, yaw);
    using("door324-side", 324, 0, s(), 8, 63, 8, 2, 0);
    using("door324-blocked-above", 324, 0, s(c(8, 65, 8, 1, 0)), 8, 63, 8, 1, 0);
    using("door324-hinge", 324, 0, s(c(7, 64, 8, 64, 0), c(7, 65, 8, 64, 8)), 8, 63, 8, 1, 0);
    using("bed", 355, 0, s(), 8, 63, 8, 1, 0);
    using("sign-top", 323, 0, s(), 8, 63, 8, 1, 0);
    using("sign-wall", 323, 0, s(), 8, 64, 8, 3, 0);
    using("skull", 397, 0, s(), 8, 63, 8, 1, 0);
    using("cake", 354, 0, s(), 8, 63, 8, 1, 0);
    using("reeds-by-water", 338, 0, s(c(8, 63, 8, 12, 0), c(7, 63, 8, 9, 0)), 8, 63, 8, 1, 0);
    using("reeds-dry", 338, 0, s(c(8, 63, 8, 12, 0)), 8, 63, 8, 1, 0);
    using("flowerpot", 390, 0, s(), 8, 63, 8, 1, 0);
    using("brewing", 379, 0, s(), 8, 63, 8, 1, 0);
    using("cauldron", 380, 0, s(), 8, 63, 8, 1, 0);
    using("repeater", 356, 0, s(), 8, 63, 8, 1, 0);
    using("redstone", 331, 0, s(), 8, 63, 8, 1, 0);
    using("redstone-side", 331, 0, s(), 8, 63, 8, 2, 0);
    for (int id : new int[] {295, 361, 362, 391, 392}) {
      using("seeds" + id + "-farmland", id, 0, s(c(8, 63, 8, 60, 7)), 8, 63, 8, 1, 0);
      using("seeds" + id + "-stone", id, 0, s(), 8, 63, 8, 1, 0);
    }
    using("wart-soulsand", 372, 0, s(c(8, 63, 8, 88, 0)), 8, 63, 8, 1, 0);
    using("wart-stone", 372, 0, s(), 8, 63, 8, 1, 0);
    using("cocoa", 351, 3, s(c(8, 64, 8, 17, 3)), 8, 64, 8, 5, 0);
    using("lead-fence", 420, 0, s(c(8, 64, 8, 85, 0)), 8, 64, 8, 1, 0);
  }

  static void activates() throws Exception {
    for (int d : new int[] {64, 71}) {
      activating("door" + d + "-lower", s(c(8, 64, 8, d, 0), c(8, 65, 8, d, 8)), 8, 64, 8);
      activating("door" + d + "-upper", s(c(8, 64, 8, d, 0), c(8, 65, 8, d, 8)), 8, 65, 8);
      activating("door" + d + "-open-lower", s(c(8, 64, 8, d, 4), c(8, 65, 8, d, 8)), 8, 64, 8);
    }
    for (int m : new int[] {0, 4, 8, 12}) activating("trapdoor-m" + m, s(c(8, 64, 8, 96, m)), 8, 64, 8);
    activating("irontrapdoor-absent", s(c(8, 64, 8, 96, 0)), 8, 64, 8);
    for (int m : new int[] {0, 1, 4, 5}) activating("gate-m" + m, s(c(8, 64, 8, 107, m)), 8, 64, 8);
    activating("lever", s(c(8, 64, 8, 69, 5)), 8, 64, 8);
    activating("button", s(c(8, 64, 8, 77, 1), c(7, 64, 8, 1, 0)), 8, 64, 8);
    activating("woodbutton", s(c(8, 64, 8, 143, 1), c(7, 64, 8, 1, 0)), 8, 64, 8);
    activating("bed-foot", s(c(8, 64, 8, 26, 0), c(8, 64, 9, 26, 8)), 8, 64, 8);
    activating("cake", s(c(8, 64, 8, 92, 0)), 8, 64, 8);
    for (int m : new int[] {0, 1, 2, 3, 4, 7, 12}) activating("repeater-m" + m, s(c(8, 64, 8, 93, m)), 8, 64, 8);
    activating("note", s(c(8, 64, 8, 25, 0)), 8, 64, 8);
    activating("anvil", s(c(8, 64, 8, 145, 0)), 8, 64, 8);
    activating("fence", s(c(8, 64, 8, 85, 0)), 8, 64, 8);
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DoorPaneProbe.makePlayer();
    breaks();
    uses();
    activates();
  }
}
