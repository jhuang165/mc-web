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
    public void p(int x, int y, int z) {}
    public void g(int x, int y, int z) {}
    Map<String, aor> tiles = new HashMap<>();
    public aor o(int x, int y, int z) { return tiles.get(x + "," + y + "," + z); }
    // World.playSoundEffect on this world: the sound with its volume and pitch (what the client plays at once)
    public void a(double x, double y, double z, String s, float v, float p) { log.add("sound " + s + " " + v + " " + p); }
    // World.spawnParticle: the particle name and the cell its position falls in (the fraction is Math.random, so only the cell is recorded)
    public void a(String s, double x, double y, double z, double a, double b, double c) { log.add("particle " + s + " " + (int) Math.floor(x) + " " + (int) Math.floor(y) + " " + (int) Math.floor(z)); }
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
    MobMoveProbe.set(w, "u", new ArrayList<Object>()); // World.worldAccesses: no listeners (the fizz sound and smoke of a Nether water bucket loop over it)
    w.tiles = new HashMap<>();
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
    int count = 0, dmg = -1;
    try {
      adb it = adb.d(item);
      add st = new add(it, 3, damage);
      boolean r = it.a(st, (yz) DoorPaneProbe.player, w, px, py, pz, side, 0.5f, 0.5f, 0.5f);
      res = String.valueOf(r);
      count = st.b;
      dmg = st.k(); // ItemStack.getItemDamage afterwards (ItemFlintAndSteel.damageItem runs on the client too)
    } catch (Throwable t) { err = q(t.toString()); }
    line("{\"case\":\"use\",\"itemDamage\":" + dmg + ",\"log\":" + logJson(w) + ",\"name\":" + q(name) + ",\"item\":" + item + ",\"damage\":" + damage + ",\"yaw\":" + yaw + ",\"setup\":" + setupJson(setup) + ",\"at\":[" + px + "," + py + "," + pz + "," + side + "],\"result\":" + res + ",\"count\":" + count + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + "}");
  }

  static void activating(String name, int[][] setup, int px, int py, int pz) throws Exception {
    activatingX(name, setup, px, py, pz, new Object[0][], 0, 0, 0, false);
  }

  static String logJson(CW w) {
    List<String> l = new ArrayList<>();
    for (String e : w.log) if (e.startsWith("sound") || e.startsWith("aux") || e.startsWith("particle")) l.add(q(e));
    return "[" + String.join(",", l) + "]";
  }

  // Block.onBlockActivated on the client world with optional tile entities ({x, y, z, Class}) and a held stack (item 0: empty hand).
  // The record has the cells that differ, the sounds and aux effects the call logged (with volume and pitch) and the held stack afterwards.
  static void activatingX(String name, int[][] setup, int px, int py, int pz, Object[][] tiles, int item, int damage, int count, boolean creative) throws Exception {
    CW w = world(setup);
    for (Object[] t : tiles) {
      aor made = (aor) PlantProbe.unsafe.allocateInstance((Class<?>) t[3]);
      if (made instanceof aoz && t.length > 4) ((aoz) made).a((Integer) t[4]); // b60: the comparator tile's OutputSignal the client holds
      w.tiles.put(t[0] + "," + t[1] + "," + t[2], made);
    }
    Map<String, int[]> before = snapshot(w);
    yx inv = ((yz) DoorPaneProbe.player).bm;
    inv.a[inv.c] = item > 0 ? new add(adb.d(item), count, damage) : null;
    MobMoveProbe.field(yw.class, "d").setBoolean(((yz) DoorPaneProbe.player).bE, creative);
    String err = "null", res = "null";
    try {
      aji b = w.a(px, py, pz);
      res = String.valueOf(b.a(w, px, py, pz, (yz) DoorPaneProbe.player, 1, 0.5f, 0.5f, 0.5f));
    } catch (Throwable t) { err = q(t.toString()); }
    String potTile = "null";
    for (Object[] t : tiles) if (t[3] == apf.class) { apf pt = (apf) w.tiles.get(t[0] + "," + t[1] + "," + t[2]); potTile = pt.a() == null ? "[0,0]" : "[" + adb.b(pt.a()) + "," + pt.b() + "]"; } // TileEntityFlowerPot item and data afterwards
    String tileSignal = "null";
    for (Object[] t : tiles) if (t[3] == aoz.class) tileSignal = "[" + (t.length > 4 ? t[4] : 0) + "," + ((aoz) w.tiles.get(t[0] + "," + t[1] + "," + t[2])).a() + "]";
    add held = inv.a[inv.c];
    String heldJson = held == null ? "[0,0]" : "[" + adb.b(held.b()) + "," + held.b + "]";
    inv.a[inv.c] = null;
    MobMoveProbe.field(yw.class, "d").setBoolean(((yz) DoorPaneProbe.player).bE, false);
    line("{\"case\":\"activate\",\"name\":" + q(name) + ",\"setup\":" + setupJson(setup) + ",\"at\":[" + px + "," + py + "," + pz + "],\"result\":" + res + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + ",\"log\":" + logJson(w) + ",\"potTile\":" + potTile + ",\"tileSignal\":" + tileSignal + ",\"held\":" + heldJson + "}");
  }

  // Block.onBlockClicked (aji.a(ahb,III,yz)) on the client world: PlayerControllerMP.clickBlock calls it for a Survival dig start (bytecode-read, bje.b(IIII) offset 217).
  static void blockClick(String name, int[][] setup, int x, int y, int z) throws Exception {
    CW w = world(setup);
    Map<String, int[]> before = snapshot(w);
    String err = "null";
    try { w.a(x, y, z).a(w, x, y, z, (yz) DoorPaneProbe.player); } catch (Throwable t) { err = q(t.toString()); }
    line("{\"case\":\"blockclick\",\"name\":" + q(name) + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + ",\"log\":" + logJson(w) + "}");
  }

  // EntityPlayerSP.a(aor) after BlockCommandBlock.onBlockActivated: the command block's tile entity opens its screen on the client at once (no isRemote guard).
  // The probe has no Minecraft instance or LWJGL, so an error raised below the EntityPlayerSP.a frame (loading or building the screen) is the proof that the call got there.
  static void commandBlock(String name, boolean withTile) throws Exception {
    CW w = world(s(c(8, 64, 8, 137, 0)));
    if (withTile) w.tiles.put("8,64,8", (aor) PlantProbe.unsafe.allocateInstance(aox.class));
    String res = "null", reached = "false", err = "null";
    try {
      res = String.valueOf(w.a(8, 64, 8).a(w, 8, 64, 8, (yz) DoorPaneProbe.player, 1, 0.5f, 0.5f, 0.5f));
    } catch (Throwable t) {
      // the screen's classes need LWJGL and netty, which the probe does not have: the error is raised below the EntityPlayerSP.a frame
      boolean in = false;
      for (StackTraceElement f : t.getStackTrace()) if (f.getClassName().equals("blk") && f.getMethodName().equals("a")) in = true;
      reached = String.valueOf(in);
      if (!reached.equals("true")) err = q(t.toString());
    }
    line("{\"case\":\"commandblock\",\"name\":" + q(name) + ",\"tile\":" + withTile + ",\"result\":" + res + ",\"openedScreen\":" + reached + ",\"error\":" + err + "}");
  }

  // ItemBucket.onItemRightClick (abo.a(add, ahb, yz), class abo) on the client world: Item.getMovingObjectPositionFromPlayer traces 5.0 blocks from the
  // eye (feet + 1.62 - yOffset) along the view, for an empty bucket stopping on liquids; the pick-up and the placement run for real on the isRemote world.
  // `eye` is the eye position, the player's feet are set 1.62 below it. pitch 90 looks straight down, yaw 0 looks along +z. `hell` sets
  // WorldProvider.isHellWorld (aqo.f), `creative` the capabilities flag. The result is the returned stack (item id, count) and the diff.
  static void bucket(String name, int item, int[][] setup, double ex, double ey, double ez, float pitch, float yaw, boolean hell, boolean creative) throws Exception {
    bucketN(name, item, 1, setup, ex, ey, ez, pitch, yaw, hell, creative);
  }

  static boolean fillInventory = false;
  static void bucketN(String name, int item, int count, int[][] setup, double ex, double ey, double ez, float pitch, float yaw, boolean hell, boolean creative) throws Exception {
    CW w = world(setup);
    Map<String, int[]> before = snapshot(w);
    Object p = DoorPaneProbe.player;
    double[] pos = {ex, ey - 1.62, ez};
    String[] pf = {"p", "s"}, qf = {"q", "t"}, rf = {"r", "u"};
    for (String f : pf) MobMoveProbe.set(p, f, pos[0]);
    for (String f : qf) MobMoveProbe.set(p, f, pos[1]);
    for (String f : rf) MobMoveProbe.set(p, f, pos[2]);
    for (String f : new String[] {"z", "B"}) MobMoveProbe.field(sa.class, f).setFloat(p, pitch);
    for (String f : new String[] {"y", "A"}) MobMoveProbe.field(sa.class, f).setFloat(p, yaw);
    MobMoveProbe.field(sa.class, "L").setFloat(p, 0f);
    MobMoveProbe.field(yw.class, "d").setBoolean(((yz) p).bE, creative);
    Object provider = MobMoveProbe.field(ahb.class, "t").get(w);
    MobMoveProbe.field(aqo.class, "f").setBoolean(provider, hell);
    String err = "null";
    int rid = -1, rcount = -1;
    try {
      adb it = adb.d(item);
      add st = new add(it, count, 0);
      yx inv = ((yz) p).bm;
      if (fillInventory) for (int i = 0; i < inv.a.length; i++) inv.a[i] = new add(adb.d(3), 64, 0);
      inv.a[inv.c] = st;
      MobMoveProbe.field(sa.class, "o").set(p, w); // the player's own world (a dropped item needs it)
      add r = it.a(st, w, (yz) p);
      rid = adb.b(r.b()); rcount = r.b;
      // PlayerControllerMP.sendUseItem (bytecode-read): a returned stack that is another object or has another size replaces the held slot (null at 0)
      if (r != st || r.b != count) { inv.a[inv.c] = r.b == 0 ? null : r; }
    } catch (Throwable t) { err = q(t.toString()); }
    List<String> invList = new ArrayList<>();
    yx inv2 = ((yz) p).bm;
    for (int i = 0; i < inv2.a.length; i++) if (inv2.a[i] != null) invList.add("[" + i + "," + adb.b(inv2.a[i].b()) + "," + inv2.a[i].b + "]");
    java.util.Arrays.fill(inv2.a, null);
    MobMoveProbe.field(aqo.class, "f").setBoolean(provider, false);
    MobMoveProbe.field(yw.class, "d").setBoolean(((yz) p).bE, false);
    MobMoveProbe.field(sa.class, "z").setFloat(p, 0f);
    MobMoveProbe.field(sa.class, "B").setFloat(p, 0f);
    MobMoveProbe.set(p, "s", X + 0.5); MobMoveProbe.set(p, "t", (double) Y); MobMoveProbe.set(p, "u", Z - 1.5);
    line("{\"case\":\"bucket\",\"name\":" + q(name) + ",\"item\":" + item + ",\"eye\":[" + ex + "," + ey + "," + ez + "],\"pitch\":" + pitch + ",\"yaw\":" + yaw + ",\"hell\":" + hell + ",\"creative\":" + creative + ",\"count\":" + count + ",\"fullInventory\":" + fillInventory + ",\"spawned\":" + w.spawned.size() + ",\"setup\":" + setupJson(setup) + ",\"resultItem\":" + rid + ",\"resultCount\":" + rcount + ",\"inventory\":[" + String.join(",", invList) + "],\"log\":" + logJson(w) + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + "}");
  }

  static void buckets() throws Exception {
    // empty bucket (325): only a source of water or lava is picked up
    for (int[] l : new int[][] {{8, 0}, {9, 0}, {10, 0}, {11, 0}, {9, 3}, {11, 5}})
      bucket("empty-liquid" + l[0] + "-m" + l[1], 325, s(c(8, 63, 8, 1, 0), c(8, 64, 8, l[0], l[1])), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    bucket("empty-creative-water", 325, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, true);
    bucket("empty-stone", 325, s(c(8, 64, 8, 1, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    bucket("empty-air", 325, s(), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    bucket("empty-reach-4.9", 325, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8.5, 69.9, 8.5, 90f, 0f, false, false);
    bucket("empty-reach-5.1", 325, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8.5, 70.1, 8.5, 90f, 0f, false, false);
    bucket("empty-side", 325, s(c(8, 64, 8, 9, 0)), 8.5, 64.5, 6.0, 0f, 0f, false, false);
    // stacks: a lone bucket is replaced, a stack gives one and adds the filled bucket to the first free slot (ItemBucket.func_150910_a)
    bucketN("empty-stack2-water", 325, 2, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    bucketN("empty-stack16-lava", 325, 16, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 11, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    bucketN("empty-stack2-creative", 325, 2, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, true);
    fillInventory = true; // every slot holds dirt: no free slot for the filled bucket
    bucketN("empty-stack2-water-full-inventory", 325, 2, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    fillInventory = false;
    bucketN("empty-stack2-miss", 325, 2, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 1, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
    // filled water (326) and lava (327): the cell beside the traced face, liquids and boxless blocks skipped by the trace
    for (int item : new int[] {326, 327}) {
      bucket("full" + item + "-top", item, s(c(8, 64, 8, 1, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
      bucket("full" + item + "-top-creative", item, s(c(8, 64, 8, 1, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, true);
      bucket("full" + item + "-side", item, s(c(8, 64, 8, 1, 0)), 8.5, 64.5, 6.0, 0f, 0f, false, false);
      bucket("full" + item + "-bottom", item, s(c(8, 64, 8, 1, 0)), 8.5, 62.0, 8.5, -90f, 0f, false, false);
      bucket("full" + item + "-torch-replaced", item, s(c(8, 64, 8, 1, 0), c(8, 65, 8, 50, 5)), 8.5, 67.0, 8.5, 90f, 0f, false, false);
      bucket("full" + item + "-grass-replaced", item, s(c(8, 64, 8, 1, 0), c(8, 65, 8, 31, 1)), 8.5, 67.0, 8.5, 90f, 0f, false, false);
      bucket("full" + item + "-into-flowing", item, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 8, 3)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
      bucket("full" + item + "-into-source", item, s(c(8, 63, 8, 1, 0), c(8, 64, 8, item == 326 ? 9 : 11, 0)), 8.5, 66.0, 8.5, 90f, 0f, false, false);
      bucketN("full" + item + "-nether-water-x", item, 1, s(c(8, 64, 8, 1, 0)), 8.5, 66.0, 8.5, 90f, 0f, true, true);
      bucket("full" + item + "-nether", item, s(c(8, 64, 8, 1, 0)), 8.5, 66.0, 8.5, 90f, 0f, true, false);
      bucket("full" + item + "-reach-4.9", item, s(c(8, 64, 8, 1, 0)), 8.5, 69.9, 8.5, 90f, 0f, false, false);
      bucket("full" + item + "-reach-5.1", item, s(c(8, 64, 8, 1, 0)), 8.5, 70.1, 8.5, 90f, 0f, false, false);
    }
  }

  // The same ItemBed / ItemSign / ItemSkull.onItemUse on a SERVER world (isRemote false): proof that the early return on the client is the isRemote guard.
  static void serverUses() throws Exception {
    for (Object[] u : new Object[][] {{"bed", 355, 1}, {"sign-top", 323, 1}, {"sign-wall", 323, 3}, {"skull", 397, 1}}) {
      CW w = world(s());
      MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
      Map<String, int[]> before = snapshot(w);
      MobMoveProbe.field(sa.class, "y").setFloat(DoorPaneProbe.player, 0f);
      String err = "null", res = "null";
      try {
        adb it = adb.d((Integer) u[1]);
        add st = new add(it, 3, 0);
        int side = (Integer) u[2];
        res = String.valueOf(it.a(st, (yz) DoorPaneProbe.player, w, 8, side == 1 ? 63 : 64, 8, side, 0.5f, 0.5f, 0.5f));
      } catch (Throwable t) { err = q(t.toString()); }
      line("{\"case\":\"serveruse\",\"name\":" + q((String) u[0]) + ",\"item\":" + u[1] + ",\"result\":" + res + ",\"error\":" + err + ",\"diff\":" + diff(before, w) + "}");
    }
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

  static void fireCases() throws Exception {
    // ItemFlintAndSteel.onItemUse (acw): the cell beside the face; air -> fire.ignite and setBlock fire; the stack is damaged either way
    using("flint-top-stone", 259, 0, s(c(8, 63, 8, 1, 0)), 8, 63, 8, 1, 0f);
    using("flint-side", 259, 0, s(c(8, 64, 8, 1, 0)), 8, 64, 8, 2, 0f);
    using("flint-bottom", 259, 0, s(c(8, 66, 8, 1, 0)), 8, 66, 8, 0, 0f);
    using("flint-top-planks", 259, 0, s(c(8, 63, 8, 5, 0)), 8, 63, 8, 1, 0f);
    using("flint-top-netherrack", 259, 0, s(c(8, 63, 8, 87, 0)), 8, 63, 8, 1, 0f);
    using("flint-into-water", 259, 0, s(c(8, 63, 8, 1, 0), c(8, 64, 8, 9, 0)), 8, 63, 8, 1, 0f);
    using("flint-unsupported-air", 259, 0, s(), 8, 64, 8, 1, 0f);
    using("flint-damaged", 259, 30, s(c(8, 63, 8, 1, 0)), 8, 63, 8, 1, 0f);
    // BlockFire.onNeighborBlockChange on the client world: a fire whose support is broken goes, one with a flammable neighbour stays
    breaking("break-under-fire", s(c(8, 63, 8, 1, 0), c(8, 64, 8, 51, 0)), 8, 63, 8);
    breaking("break-under-fire-flammable-side", s(c(8, 63, 8, 1, 0), c(8, 64, 8, 51, 0), c(9, 64, 8, 5, 0)), 8, 63, 8);
    breaking("break-under-fire-flammable-above", s(c(8, 63, 8, 1, 0), c(8, 64, 8, 51, 0), c(8, 65, 8, 5, 0)), 8, 63, 8);
    breaking("break-beside-fire-supported", s(c(8, 64, 8, 51, 0), c(9, 64, 8, 1, 0)), 9, 64, 8);
    breaking("break-flammable-under-fire", s(c(8, 63, 8, 5, 0), c(8, 64, 8, 51, 0)), 8, 63, 8);
    // BlockDragonEgg (122): onBlockActivated and onBlockClicked both run func_150018_e; on the client only the portal particles
    activating("dragonegg-activate", s(c(8, 64, 8, 122, 0)), 8, 64, 8);
    blockClick("dragonegg-click", s(c(8, 64, 8, 122, 0)), 8, 64, 8);
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
    // BlockRedstoneComparator.onBlockActivated has no isRemote guard: the mode bit (4) toggles and random.click plays (0.3, pitch 0.55 into subtract else 0.5)
    Object[] cmp = {8, 64, 8, aoz.class};
    for (int m : new int[] {0, 1, 2, 3, 4, 5, 8, 12}) activatingX("comparator149-m" + m, s(c(8, 64, 8, 149, m)), 8, 64, 8, new Object[][] {cmp}, 0, 0, 0, false);
    for (int m : new int[] {0, 4, 8, 12}) activatingX("comparator150-m" + m, s(c(8, 64, 8, 150, m)), 8, 64, 8, new Object[][] {cmp}, 0, 0, 0, false);
    // b60: a powered input. The comparator (facing +z when meta & 3 == 0: the rear input is at z + 1, sides at x +- 1) with a wire, a redstone block or a lever source, the tile output set to
    // what the server settled on (the steady state) or left at 0; the client reads the powers from its own blocks.
    int[][][] feeds = {
      {c(8, 64, 9, 55, 12)}, {c(8, 64, 9, 55, 15)}, {c(8, 64, 9, 152, 0)}, {c(8, 64, 9, 55, 5)},
      {c(8, 64, 9, 55, 12), c(7, 64, 8, 55, 9)}, {c(8, 64, 9, 55, 12), c(7, 64, 8, 55, 12)}, {c(8, 64, 9, 55, 5), c(9, 64, 8, 55, 9)},
      {c(8, 64, 9, 55, 12), c(7, 64, 8, 152, 0)}, {c(8, 64, 9, 1, 0), c(8, 64, 10, 69, 9)}, {c(8, 64, 9, 1, 0), c(8, 64, 10, 55, 7)}, {c(8, 64, 9, 94, 0)}, {c(8, 64, 9, 76, 5)}};
    int[] mets = {0, 4, 8, 12};
    for (int f = 0; f < feeds.length; f++) for (int m : mets) for (int tile : new int[] {0, 7, 15}) {
      int[][] setup = new int[feeds[f].length + 1][];
      setup[0] = c(8, 64, 8, 149, m);
      for (int i = 0; i < feeds[f].length; i++) setup[i + 1] = feeds[f][i];
      activatingX("comparator-powered-f" + f + "-m" + m + "-t" + tile, setup, 8, 64, 8, new Object[][] {{8, 64, 8, aoz.class, tile}}, 0, 0, 0, false);
    }
    // the screens of tile entities open from the server's packet: every guard `if (world.isRemote) return true` leaves the client world untouched
    int[][] stations = {{54, 0}, {146, 0}, {130, 0}, {61, 2}, {62, 2}, {23, 0}, {158, 0}, {154, 0}, {117, 0}, {116, 0}, {138, 0}, {58, 0}, {118, 0}, {118, 3}, {151, 0}, {122, 0}};
    for (int[] t : stations) activating("station" + t[0] + "-m" + t[1], s(c(8, 64, 8, t[0], t[1])), 8, 64, 8);
    activating("jukebox-empty", s(c(8, 64, 8, 84, 0)), 8, 64, 8);
    activating("jukebox-disc", s(c(8, 64, 8, 84, 1)), 8, 64, 8);
    activating("jukebox-disc-in-hand-absent", s(c(8, 64, 8, 25, 0)), 8, 64, 8);
    commandBlock("commandblock-no-tile", false);
    commandBlock("commandblock-tile", true);
    // BlockFlowerPot.onBlockActivated has no isRemote guard either: a plant in the hand goes into the pot (damage -> metadata), one is taken outside Creative
    Object[] pot = {8, 64, 8, apf.class};
    for (int[] h : new int[][] {{38, 0, 1}, {37, 0, 2}, {6, 1, 1}, {6, 5, 1}, {81, 0, 1}, {39, 0, 1}, {40, 0, 3}, {31, 2, 1}, {32, 0, 1}, {1, 0, 1}, {6, 6, 1}})
      activatingX("pot-hold" + h[0] + "-d" + h[1], s(c(8, 64, 8, 140, 0)), 8, 64, 8, new Object[][] {pot}, h[0], h[1], h[2], false);
    activatingX("pot-hold38-creative", s(c(8, 64, 8, 140, 0)), 8, 64, 8, new Object[][] {pot}, 38, 0, 2, true);
    activatingX("pot-empty-hand", s(c(8, 64, 8, 140, 0)), 8, 64, 8, new Object[][] {pot}, 0, 0, 0, false);
    // the cauldron returns on the client, a button in the wooden family presses and clicks
    activatingX("cauldron-water-bucket", s(c(8, 64, 8, 118, 0)), 8, 64, 8, new Object[0][], 326, 0, 1, false);
  }

  // Item.onItemRightClick on the client world (PlayerControllerMP.sendUseItem): what the thrown items do to the held stack before the server answers.
  static void throwing(String name, int item, int damage, int count, boolean creative) throws Exception {
    CW w = world(s());
    Object p = DoorPaneProbe.player;
    yx inv = ((yz) p).bm;
    String err = "null";
    int rid = -1, rcount = -1;
    boolean same = false;
    try {
      adb it = adb.d(item);
      add st = new add(it, count, damage);
      inv.a[inv.c] = st;
      MobMoveProbe.field(yw.class, "d").setBoolean(((yz) p).bE, creative);
      MobMoveProbe.field(sa.class, "o").set(p, w);
      add r = it.a(st, w, (yz) p);
      rid = adb.b(r.b()); rcount = r.b; same = r == st;
    } catch (Throwable t) { err = q(t.toString()); }
    MobMoveProbe.field(yw.class, "d").setBoolean(((yz) p).bE, false);
    inv.a[inv.c] = null;
    line("{\"case\":\"throw\",\"name\":" + q(name) + ",\"item\":" + item + ",\"damage\":" + damage + ",\"count\":" + count + ",\"creative\":" + creative + ",\"resultItem\":" + rid + ",\"resultCount\":" + rcount + ",\"sameStack\":" + same + ",\"spawned\":" + w.spawned.size() + ",\"log\":" + logJson(w) + ",\"error\":" + err + "}");
  }

  static void throwsAll() throws Exception {
    throwing("drink373-x5", 373, 8197, 5, false); // a drinkable potion only starts the use animation
    for (int[] t : new int[][] {{332, 0}, {344, 0}, {368, 0}, {384, 0}, {373, 16384 + 16}}) {
      throwing("throw" + t[0] + "-x5", t[0], t[1], 5, false);
      throwing("throw" + t[0] + "-x1", t[0], t[1], 1, false);
      throwing("throw" + t[0] + "-creative", t[0], t[1], 5, true);
    }
  }


  // ---- the click sound reaching the clicker twice (World.playSoundEffect on the client world, then S29PacketSoundEffect from the server) ----
  public static class Rec extends nh {
    List<String> got = new ArrayList<>();
    public Rec() { super(null, null, null); }
    public void a(ft p) { got.add(p instanceof hc ? "S29 " + ((hc) p).c() + " " + ((hc) p).g() + " " + ((hc) p).h() : p.getClass().getName()); }
  }

  public static class Srv extends net.minecraft.server.MinecraftServer {
    public Srv() { super(null, null); }
    protected boolean e() { return false; }
    public boolean h() { return false; }
    public ahk i() { return null; }
    public rd j() { return null; }
    public boolean k() { return false; }
    public int l() { return 0; }
    public boolean m() { return false; }
    public boolean X() { return false; }
    public boolean ad() { return false; }
    public String a(ahk g, boolean b) { return null; }
  }

  public static class Cfg extends oi { public Cfg() { super(null); } }

  public static class Snd extends btp {
    List<String> played = new ArrayList<>();
    public Snd() { super(null, null); }
    public void a(bst sound) { played.add("play " + sound.b().toString()); }
  }

  static mw serverPlayer(double x, double z, int dimension, Rec rec) throws Exception {
    mw m = (mw) PlantProbe.unsafe.allocateInstance(mw.class);
    MobMoveProbe.set(m, "s", x); MobMoveProbe.set(m, "t", 64.0); MobMoveProbe.set(m, "u", z);
    MobMoveProbe.field(mw.class, "ap").setInt(m, dimension);
    MobMoveProbe.set(m, "a", rec);
    return m;
  }

  // WorldManager (mp, the server world's IWorldAccess) turns World.playSoundEffect into oi.sendToAllNear(null, ...): every player of the dimension within 16 blocks
  // gets the S29, the one who clicked included. The packet is then handed to the client's NetHandlerPlayClient.a(hc), which plays it on the client world.
  static void soundChain() throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    String setupErr = "null";
    try { soundChainRun(); } catch (Throwable t) { line("{\"case\":\"soundchain\",\"name\":\"failed\",\"error\":" + q(t.toString()) + "}"); }
  }

  static void soundChainRun() throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    Srv server = (Srv) u.allocateInstance(Srv.class);
    oi cfg = (oi) u.allocateInstance(Cfg.class);
    List<Object> players = new ArrayList<>();
    MobMoveProbe.set(cfg, "e", players);
    MobMoveProbe.set(server, "u", cfg);
    mt serverWorld = (mt) u.allocateInstance(mt.class);
    MobMoveProbe.set(serverWorld, "t", u.allocateInstance(aqq.class));
    mp manager = new mp(server, serverWorld);
    List<Object> accesses = new ArrayList<>();
    accesses.add(manager);
    MobMoveProbe.set(serverWorld, "u", accesses);
    Rec clicker = (Rec) u.allocateInstance(Rec.class), near = (Rec) u.allocateInstance(Rec.class), far = (Rec) u.allocateInstance(Rec.class), nether = (Rec) u.allocateInstance(Rec.class);
    for (Rec r : new Rec[] {clicker, near, far, nether}) r.got = new ArrayList<>();
    players.add(serverPlayer(8.5, 6.5, 0, clicker)); players.add(serverPlayer(10.0, 8.0, 0, near)); players.add(serverPlayer(108.5, 6.5, 0, far)); players.add(serverPlayer(8.5, 6.5, -1, nether));
    ((ahb) serverWorld).a(8.5, 64.5, 8.5, "random.click", 0.3f, 0.6f);
    ((ahb) serverWorld).a(8.5, 64.5, 8.5, "random.fizz", 0.5f, 2.6f);
    // the client half: NetHandlerPlayClient.a(hc) -> WorldClient.playSound(..., false) -> SoundHandler.playSound, for the clicker's packets
    Snd handler = (Snd) u.allocateInstance(Snd.class);
    handler.played = new ArrayList<>();
    String clientErr = "null";
    int playedBefore = 0;
    try {
      bao mc = (bao) u.allocateInstance(bao.class);
      MobMoveProbe.set(mc, "aw", handler);
      bjf cw = (bjf) u.allocateInstance(bjf.class);
      MobMoveProbe.set(cw, "L", mc);
      MobMoveProbe.set(mc, "f", cw);
      MobMoveProbe.set(mc, "i", DoorPaneProbe.player);
      bjb net = (bjb) u.allocateInstance(bjb.class);
      MobMoveProbe.set(net, "f", mc);
      for (Object o : clicker.got) { } // the packets themselves were kept as text: rebuild them from the same arguments the server sent
      net.a(new hc("random.click", 8.5, 64.5, 8.5, 0.3f, 0.6f));
      net.a(new hc("random.fizz", 8.5, 64.5, 8.5, 0.5f, 2.6f));
    } catch (Throwable t) { Throwable c = t; while (c.getCause() != null) c = c.getCause(); clientErr = q(t + " / " + c + " at " + (c.getStackTrace().length > 0 ? c.getStackTrace()[0] : "")); }
    line("{\"case\":\"soundchain\",\"name\":\"click-and-fizz-to-all-near\",\"clicker\":" + jsonList(clicker.got) + ",\"near\":" + jsonList(near.got) + ",\"far\":" + jsonList(far.got) + ",\"otherDimension\":" + jsonList(nether.got) + ",\"clientPlays\":" + jsonList(handler.played) + ",\"error\":" + clientErr + "}");
  }

  static String jsonList(List<String> l) {
    List<String> o = new ArrayList<>();
    for (String e : l) o.add(q(e));
    return "[" + String.join(",", o) + "]";
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); alb.e(); // BlockFire.func_149843_e registers the flammable blocks (Bootstrap does it in the game)
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DoorPaneProbe.makePlayer();
    breaks();
    uses();
    activates();
    buckets();
    serverUses();
    throwsAll();
    fireCases();
    soundChain();
  }
}
