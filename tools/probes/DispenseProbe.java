import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged 1.7.10 BlockDispenser (akm, id 23) and BlockDropper (id 158) dispensing paths: updateTick ->
// dispense -> TileEntityDispenser.func_146017_i (own Random) -> the BehaviorDefaultDispenseItem registry that
// Bootstrap.registerDispenseBehaviors fills (kl.a), through a constructor-less World double (block/metadata/tile maps,
// recorded setBlock, aux effects, sounds, scheduled ticks and spawned entities). Projectile headings use the entity's
// own unseeded Entity.rand, so for those cases the probe reseeds sa.Z on the spawned entity and re-runs the original
// setThrowableHeading (zh.c) exactly as BehaviorProjectileDispense.dispenseStack calls it. Records are one JSON per line.
public class DispenseProbe {
  static sun.misc.Unsafe U;

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String num(double d) { return Double.toString(d); }

  static class Provider extends aqo { public String l() { return "probe"; } }

  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    Map<String, Integer> blocks = new HashMap<>(), metas = new HashMap<>();
    Map<String, aor> tiles = new HashMap<>();
    List<String> log = new ArrayList<>();
    List<sa> spawned = new ArrayList<>();
    agy rules = new agy();
    Set<String> powered = new HashSet<>();
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    static String key(int x, int y, int z) { return x + "," + y + "," + z; }
    public aji a(int x, int y, int z) { Integer id = blocks.get(key(x, y, z)); return aji.e(id == null ? 0 : id); }
    public int e(int x, int y, int z) { Integer m = metas.get(key(x, y, z)); return m == null ? 0 : m; }
    public boolean a(int x, int y, int z, int meta, int flags) { log.add("meta," + x + "," + y + "," + z + "," + meta + "," + flags); metas.put(key(x, y, z), meta); return true; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) { log.add("set," + x + "," + y + "," + z + "," + aji.b(b) + "," + meta + "," + flags); blocks.put(key(x, y, z), aji.b(b)); metas.put(key(x, y, z), meta); return true; }
    public boolean b(int x, int y, int z, aji b) { return d(x, y, z, b, 0, 3); }
    public boolean f(int x, int y, int z) { log.add("air," + x + "," + y + "," + z); blocks.put(key(x, y, z), 0); metas.put(key(x, y, z), 0); return true; }
    public boolean a(int x, int y, int z, boolean drop) { log.add("break," + x + "," + y + "," + z + "," + drop); blocks.put(key(x, y, z), 0); metas.put(key(x, y, z), 0); return true; }
    public aor o(int x, int y, int z) { return tiles.get(key(x, y, z)); }
    public void p(int x, int y, int z) { tiles.remove(key(x, y, z)); }
    public boolean d(sa e) { spawned.add(e); return true; }
    public void f(int x, int y, int z, aji b) {}
    public void d(int x, int y, int z, int a, int b) {}
    public void c(int x, int y, int z, aji b, int ev, int param) { log.add("event," + x + "," + y + "," + z + "," + aji.b(b) + "," + ev + "," + param); }
    public void c(int id, int x, int y, int z, int data) { log.add("aux," + id + "," + x + "," + y + "," + z + "," + data); }
    public void a(int x, int y, int z, aji b, int delay) { log.add("tick," + x + "," + y + "," + z + "," + aji.b(b) + "," + delay); }
    public void a(double x, double y, double z, String s, float v, float p) { log.add("sound," + x + "," + y + "," + z + "," + s + "," + v + "," + p); }
    public boolean v(int x, int y, int z) { return powered.contains(key(x, y, z)); }
    public List a(Class c, azt b, sj s) { return new ArrayList(); }
    public List a(sa c, azt b, sj s) { return new ArrayList(); }
    public void a(sa e, String s, float v, float p) { log.add("entitySound," + s + "," + v + "," + p); }
    public agy O() { return rules; }
    public boolean t(int x, int y, int z) { return false; }
    void put(int x, int y, int z, int id, int meta) { blocks.put(key(x, y, z), id); metas.put(key(x, y, z), meta); }
  }
  static W world(long seed) throws Exception {
    W w = (W) U.allocateInstance(W.class);
    w.blocks = new HashMap<>(); w.metas = new HashMap<>(); w.tiles = new HashMap<>(); w.log = new ArrayList<>(); w.spawned = new ArrayList<>(); w.rules = new agy(); w.powered = new HashSet<>();
    field(ahb.class, "t").set(w, new Provider());
    field(ahb.class, "s").set(w, new Random(seed));
    return w;
  }

  static final int X = 10, Y = 64, Z = 10;
  static final int[][] FACE = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
  static String enc(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }

  static add stack(String spec) {
    String[] p = spec.split(":");
    int id = Integer.parseInt(p[0]), count = Integer.parseInt(p[1]), dmg = Integer.parseInt(p[2]);
    if (id == 46 || id == 66) return new add(aji.e(id), count, dmg); // block items: TNT, rail
    return new add(adb.d(id), count, dmg);
  }

  static String entity(sa e) throws Exception {
    StringBuilder o = new StringBuilder("{\"class\":" + q(e.getClass().getName()) + ",\"x\":" + num(e.s) + ",\"y\":" + num(e.t) + ",\"z\":" + num(e.u)
      + ",\"mx\":" + num(e.v) + ",\"my\":" + num(e.w) + ",\"mz\":" + num(e.x) + ",\"yaw\":" + e.y + ",\"pitch\":" + e.z);
    if (e instanceof xk) o.append(",\"stack\":").append(enc(((xk) e).f()));
    if (e instanceof xw) o.append(",\"fuse\":").append(field(xw.class, "a").getInt(e));
    return o.append('}').toString();
  }

  static apb tile(W w, int blockId, String... slots) throws Exception {
    apb t = blockId == 158 ? new apc() : new apb();
    for (int i = 0; i < slots.length; i++) if (slots[i] != null) t.a(i, stack(slots[i]));
    field(apb.class, "j").set(t, new Random(555));
    return t;
  }

  // One dispense: a dispenser (or dropper) at (X, Y, Z) with `facing`, `slots` in the tile, `cells` placed first as
  // "dx,dy,dz,id,meta" relative to the target cell (the cell the dispenser faces).
  static void dispense(String name, int blockId, int facing, long seed, String[] slots, String... cells) throws Exception {
    W w = world(seed);
    w.put(X, Y, Z, blockId, facing);
    apb t = tile(w, blockId, slots);
    w.tiles.put(W.key(X, Y, Z), t);
    int tx = X + FACE[facing][0], ty = Y + FACE[facing][1], tz = Z + FACE[facing][2];
    for (String c : cells) { String[] p = c.split(","); w.put(tx + Integer.parseInt(p[0]), ty + Integer.parseInt(p[1]), tz + Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); }
    aji b = aji.e(blockId);
    b.a(w, X, Y, Z, new Random(1));
    StringBuilder o = new StringBuilder("{\"kind\":\"dispense\",\"name\":" + q(name) + ",\"block\":" + blockId + ",\"facing\":" + facing + ",\"seed\":\"" + seed + "\",\"slots\":[");
    for (int i = 0; i < slots.length; i++) { if (i > 0) o.append(','); o.append(slots[i] == null ? "null" : q(slots[i])); }
    o.append("],\"cells\":[");
    for (int i = 0; i < cells.length; i++) { if (i > 0) o.append(','); o.append(q(cells[i])); }
    o.append("],\"after\":[");
    for (int i = 0; i < t.a(); i++) { if (i > 0) o.append(','); o.append(enc(t.a(i))); }
    o.append("],\"log\":[");
    for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
    o.append("],\"spawned\":[");
    for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) o.append(','); o.append(entity(w.spawned.get(i))); }
    o.append("],\"worldNext\":").append(w.s.nextInt(1000000));
    o.append("}");
    System.out.println(o);
  }
  // BlockDropper into an inventory ahead: the neighbour tile (func_145893_b) gets one item through func_145889_a.
  static void dropperInto(String name, int facing, int targetBlock, aor target, String[] targetSlots, String[] slots, String... cells) throws Exception {
    W w = world(4);
    w.put(X, Y, Z, 158, facing);
    apb t = tile(w, 158, slots);
    w.tiles.put(W.key(X, Y, Z), t);
    int tx = X + FACE[facing][0], ty = Y + FACE[facing][1], tz = Z + FACE[facing][2];
    w.put(tx, ty, tz, targetBlock, 0);
    for (String c : cells) { String[] p = c.split(","); w.put(tx + Integer.parseInt(p[0]), ty + Integer.parseInt(p[1]), tz + Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); }
    for (int i = 0; i < targetSlots.length; i++) if (targetSlots[i] != null) ((rb) target).a(i, stack(targetSlots[i]));
    w.tiles.put(W.key(tx, ty, tz), target);
    aji.e(158).a(w, X, Y, Z, new Random(1));
    StringBuilder o = new StringBuilder("{\"kind\":\"dropperInto\",\"name\":" + q(name) + ",\"facing\":" + facing + ",\"target\":" + targetBlock + ",\"slots\":[");
    for (int i = 0; i < slots.length; i++) { if (i > 0) o.append(','); o.append(slots[i] == null ? "null" : q(slots[i])); }
    o.append("],\"targetSlots\":[");
    for (int i = 0; i < targetSlots.length; i++) { if (i > 0) o.append(','); o.append(targetSlots[i] == null ? "null" : q(targetSlots[i])); }
    o.append("],\"after\":[");
    for (int i = 0; i < t.a(); i++) { if (i > 0) o.append(','); o.append(enc(t.a(i))); }
    o.append("],\"targetAfter\":[");
    rb inv = (rb) target;
    for (int i = 0; i < inv.a(); i++) { if (i > 0) o.append(','); o.append(enc(inv.a(i))); }
    o.append("],\"log\":[");
    for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
    o.append("],\"spawned\":[");
    for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) o.append(','); o.append(entity(w.spawned.get(i))); }
    System.out.println(o.append("]}"));
  }

  // Slot choice: func_146017_i over fill patterns with the tile's own Random.
  static void slotChoice() throws Exception {
    long[] seeds = {1, 2, 3, 99, 12345};
    String[][] patterns = {
      {}, {"280:1:0"}, {null, "280:1:0"}, {"280:1:0", "280:1:0", "280:1:0"},
      {"280:1:0", null, "280:1:0", null, "280:1:0", null, "280:1:0", null, "280:1:0"},
      {"280:1:0", "280:1:0", "280:1:0", "280:1:0", "280:1:0", "280:1:0", "280:1:0", "280:1:0", "280:1:0"},
    };
    for (String[] pat : patterns) for (long s : seeds) {
      apb t = new apb();
      for (int i = 0; i < pat.length; i++) if (pat[i] != null) t.a(i, stack(pat[i]));
      field(apb.class, "j").set(t, new Random(s));
      StringBuilder o = new StringBuilder("{\"kind\":\"slotChoice\",\"seed\":\"" + s + "\",\"pattern\":[");
      for (int i = 0; i < pat.length; i++) { if (i > 0) o.append(','); o.append(pat[i] == null ? "null" : "1"); }
      o.append("],\"picks\":[");
      for (int n = 0; n < 12; n++) { if (n > 0) o.append(','); o.append(t.i()); }
      System.out.println(o.append("]}"));
    }
    // addItemStack: first empty slot, -1 when full.
    for (int fill = 0; fill <= 9; fill++) {
      apb t = new apb();
      for (int i = 0; i < fill; i++) t.a(i, stack("280:1:0"));
      int r = t.a(stack("281:1:0"));
      System.out.println("{\"kind\":\"addItemStack\",\"filled\":" + fill + ",\"slot\":" + r + "}");
    }
  }

  // Neighbour change / updateTick scheduling (BlockDispenser.onNeighborBlockChange) and the metadata flag.
  static void neighbour() throws Exception {
    for (int blockId : new int[]{23, 158}) for (int meta = 0; meta < 16; meta++) for (int mode = 0; mode < 4; mode++) {
      W w = world(1);
      w.put(X, Y, Z, blockId, meta);
      if ((mode & 1) != 0) w.powered.add(W.key(X, Y, Z));
      if ((mode & 2) != 0) w.powered.add(W.key(X, Y + 1, Z));
      aji b = aji.e(blockId);
      b.a(w, X, Y, Z, aji.e(1));
      StringBuilder o = new StringBuilder("{\"kind\":\"neighbour\",\"block\":" + blockId + ",\"meta\":" + meta + ",\"mode\":" + mode + ",\"metaAfter\":" + w.e(X, Y, Z) + ",\"log\":[");
      for (int i = 0; i < w.log.size(); i++) { if (i > 0) o.append(','); o.append(q(w.log.get(i))); }
      System.out.println(o.append("]}"));
    }
    // tickRate and BlockDispenser.func_149937_b (facing from metadata) via the static helper.
    System.out.println("{\"kind\":\"tickRate\",\"dispenser\":" + aji.e(23).a((ahb) null) + ",\"dropper\":" + aji.e(158).a((ahb) null) + "}");
    // onBlockAdded facing choice (func_149938_m): opaque neighbours at z-1, z+1, x-1, x+1 (stone) around the cell.
    for (int mask = 0; mask < 16; mask++) for (int blockId : new int[]{23, 158}) {
      W w = world(1);
      w.put(X, Y, Z, blockId, 0);
      if ((mask & 1) != 0) w.put(X, Y, Z - 1, 1, 0);
      if ((mask & 2) != 0) w.put(X, Y, Z + 1, 1, 0);
      if ((mask & 4) != 0) w.put(X - 1, Y, Z, 1, 0);
      if ((mask & 8) != 0) w.put(X + 1, Y, Z, 1, 0);
      aji.e(blockId).b(w, X, Y, Z);
      System.out.println("{\"kind\":\"added\",\"block\":" + blockId + ",\"mask\":" + mask + ",\"meta\":" + w.e(X, Y, Z) + "}");
    }
  }

  // BehaviorProjectileDispense: the entity the behaviour makes at the dispenser position, headed with a seeded Entity.rand.
  static void projectileHeading() throws Exception {
    // Re-run the exact dispenseStack heading call: setThrowableHeading(dx, dy + 0.1, dz, velocity b(), inaccuracy a()).
    String[] items = {"262:1:0", "344:1:0", "332:1:0", "373:1:16396"};
    for (String it : items) for (int facing = 0; facing < 6; facing++) {
      W w = world(7);
      w.put(X, Y, Z, 23, facing);
      add s = stack(it);
      Object beh = akm.a.a(s.b());
      field(sa.class, "Z").getClass();
      Class<?> pd = Class.forName("kk");
      if (!pd.isInstance(beh)) { System.out.println("{\"kind\":\"heading\",\"item\":" + q(it) + ",\"facing\":" + facing + ",\"projectile\":false}"); continue; }
      cl src = new cl(w, X, Y, Z);
      cr f = cr.a(w.e(X, Y, Z) & 7);
      cx pos = akm.a(src);
      Method make = pd.getDeclaredMethod("a", ahb.class, cx.class); make.setAccessible(true);
      Method vel = pd.getDeclaredMethod("b"); vel.setAccessible(true);
      Method inacc = pd.getDeclaredMethod("a"); inacc.setAccessible(true);
      long[] seeds = {1, 2, 3};
      for (long seed : seeds) {
        zh e = (zh) make.invoke(beh, w, pos);
        field(sa.class, "Z").set(e, new Random(seed));
        e.c((double) f.c(), (double) ((float) f.d() + 0.1F), (double) f.e(), (Float) vel.invoke(beh), (Float) inacc.invoke(beh));
        System.out.println("{\"kind\":\"heading\",\"item\":" + q(it) + ",\"facing\":" + facing + ",\"seed\":\"" + seed + "\",\"projectile\":true,\"velocity\":" + vel.invoke(beh) + ",\"inaccuracy\":" + inacc.invoke(beh) + ",\"entity\":" + entity((sa) e) + "}");
      }
    }
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    kl.a();
    slotChoice();
    neighbour();
    String[] ITEMS = {"280:3:0", "280:1:0"};
    for (int block : new int[]{23, 158}) for (int f = 0; f < 6; f++) for (long seed : new long[]{11, 12}) {
      dispense("default", block, f, seed, new String[]{"280:3:0"});
    }
    for (int f = 0; f < 6; f++) dispense("empty", 23, f, 5, new String[]{null, null});
    for (int f = 0; f < 6; f++) dispense("slotPick", 23, f, 5, new String[]{"280:1:0", null, "281:2:0", "282:4:0"});
    for (int f = 0; f < 6; f++) for (String it : new String[]{"262:5:0", "344:5:0", "332:5:0", "373:2:16396", "373:2:8193"}) dispense("projectile", 23, f, 21, new String[]{it});
    for (int f = 0; f < 6; f++) dispense("tnt", 23, f, 21, new String[]{"46:2:0"});
    // Minecarts: rail ahead, rail below the empty cell ahead, nothing, water ahead.
    for (int f = 2; f < 6; f++) {
      dispense("cartRail", 23, f, 3, new String[]{"328:2:0"}, "0,0,0,66,0");
      dispense("cartPoweredRail", 23, f, 3, new String[]{"328:2:0"}, "0,0,0,27,0");
      dispense("cartBelow", 23, f, 3, new String[]{"328:2:0"}, "0,-1,0,66,0");
      dispense("cartNone", 23, f, 3, new String[]{"328:2:0"});
      dispense("cartWater", 23, f, 3, new String[]{"328:2:0"}, "0,0,0,9,0", "0,-1,0,66,0");
      dispense("cartChest", 23, f, 3, new String[]{"342:1:0"}, "0,0,0,66,0");
    }
    // Buckets.
    for (int f = 0; f < 6; f++) {
      dispense("waterBucket", 23, f, 9, new String[]{"326:1:0"}, "0,0,0,0,0");
      dispense("waterBucket2", 23, f, 9, new String[]{"326:2:0"}, "0,0,0,0,0");
      dispense("lavaBucket", 23, f, 9, new String[]{"327:1:0"}, "0,0,0,0,0");
      dispense("waterBlocked", 23, f, 9, new String[]{"326:1:0"}, "0,0,0,1,0");
      dispense("waterBucketFull", 23, f, 9, new String[]{"326:2:0", "280:1:0"}, "0,0,0,0,0");
      dispense("emptyWater", 23, f, 9, new String[]{"325:1:0"}, "0,0,0,9,0");
      dispense("emptyWater2", 23, f, 9, new String[]{"325:3:0"}, "0,0,0,9,0");
      dispense("emptyFlowing", 23, f, 9, new String[]{"325:1:0"}, "0,0,0,9,3");
      dispense("emptyLava", 23, f, 9, new String[]{"325:1:0"}, "0,0,0,11,0");
      dispense("emptyStone", 23, f, 9, new String[]{"325:1:0"}, "0,0,0,1,0");
    }
    // Flint and steel, bone meal.
    for (int f = 0; f < 6; f++) {
      dispense("flintAir", 23, f, 4, new String[]{"259:1:0"}, "0,0,0,0,0");
      dispense("flintAirWorn", 23, f, 4, new String[]{"259:1:63"}, "0,0,0,0,0");
      dispense("flintTnt", 23, f, 4, new String[]{"259:1:0"}, "0,0,0,46,0");
      dispense("flintStone", 23, f, 4, new String[]{"259:1:0"}, "0,0,0,1,0");
      dispense("boneWheat", 23, f, 4, new String[]{"351:3:15"}, "0,0,0,59,2");
      dispense("boneWheatRipe", 23, f, 4, new String[]{"351:3:15"}, "0,0,0,59,7");
      dispense("boneStone", 23, f, 4, new String[]{"351:3:15"}, "0,0,0,1,0");
      dispense("dyeRed", 23, f, 4, new String[]{"351:3:1"}, "0,0,0,59,2");
    }
    // Dropper into a container ahead (BlockDropper.dispense -> IInventory).
    for (int f = 0; f < 6; f++) {
      dispense("dropperAir", 158, f, 4, new String[]{"280:3:0"}, "0,0,0,0,0");
      dispense("dropperSlots", 158, f, 4, new String[]{"280:1:0", null, "281:2:0", "282:4:0"}, "0,0,0,0,0");
      dropperInto("intoDispenser", f, 23, new apb(), new String[]{"280:63:0"}, new String[]{"280:3:0"});
      dropperInto("intoDispenserFull", f, 23, new apb(), new String[]{"280:64:0", "280:64:0", "280:64:0", "280:64:0", "280:64:0", "280:64:0", "280:64:0", "280:64:0", "280:64:0"}, new String[]{"280:3:0"});
      dropperInto("intoFurnace", f, 61, new apg(), new String[]{null}, new String[]{"4:3:0"});
      dropperInto("intoFurnaceFuel", f, 61, new apg(), new String[]{null}, new String[]{"263:3:0"});
      dropperInto("intoChest", f, 54, new aow(), new String[]{"280:1:0"}, new String[]{"280:3:0"});
      dropperInto("intoHopper", f, 154, new api(), new String[]{null}, new String[]{"280:3:0"});
    }
    projectileHeading();
  }
}
