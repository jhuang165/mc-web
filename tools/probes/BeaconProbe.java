import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Runs the unchanged TileEntityBeacon (aoq), ContainerBeacon (zx) with its payment slot (zy), BlockBeacon (ajg) properties,
// ItemStack (add) and the item registry of the 1.7.10 JAR on a minimal World double (block map, sky visibility, world time,
// player list) and a recording EntityPlayer double. Nothing is patched. The server half of MC|Beacon (NetHandlerPlayServer.nh,
// bytecode-read) is replayed here with the same three calls it makes: slot(0).decrStackSize(1), setPrimary (aoq.d), setSecondary (aoq.e).
// Prints one JSON object per line: facts, levels, tick, effects, setter, nbt, slot, shift, server.
public class BeaconProbe {
  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    static Map<String, Integer> cells = new HashMap<>();
    static boolean sky = true;
    static long time = 0;
    static List<P> players = new ArrayList<>();
    static azt lastBox = null;
    public aji a(int x, int y, int z) { Integer id = cells.get(x + "," + y + "," + z); return aji.e(id == null ? 0 : id); }
    public boolean i(int x, int y, int z) { return sky; }
    public int e(int x, int y, int z) { return 0; }
    public void e(int x, int y, int z, aor tile) {}
    public void b(int x, int y, int z, aor tile) {}
    public long I() { return time; }
    public int R() { return 256; }
    public List a(Class c, azt box) {
      lastBox = box;
      List out = new ArrayList();
      if (c == yz.class) for (P p : players) if (p.C.b(box)) out.add(p);
      return out;
    }
  }
  public static class P extends yz {
    List<String> got = new ArrayList<>();
    List<String> removed = new ArrayList<>();
    P() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return new r(0, 0, 0); }
    public void c(rw effect) { got.add("[" + effect.a() + "," + effect.b() + "," + effect.c() + "," + effect.e() + "]"); }
  }

  static sun.misc.Unsafe u;
  static W w;
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static Field fd(Class<?> c, String n) throws Exception { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; }
  static String ints(int... v) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < v.length; i++) s.append(i > 0 ? "," : "").append(v[i]); return s.append("]").toString(); }
  static String bool(boolean b) { return b ? "true" : "false"; }
  static void out(String s) { System.out.println(s); }

  static aoq tile(int x, int y, int z) throws Exception {
    aoq t = new aoq();
    t.a(w);
    t.c = x; t.d = y; t.e = z;
    return t;
  }
  static int get(aoq t, String n) throws Exception { return fd(aoq.class, n).getInt(t); }
  static boolean getB(aoq t, String n) throws Exception { return fd(aoq.class, n).getBoolean(t); }
  static void set(aoq t, String n, int v) throws Exception { fd(aoq.class, n).setInt(t, v); }
  static void call(aoq t, String n) throws Exception { Method m = aoq.class.getDeclaredMethod(n); m.setAccessible(true); m.invoke(t); }
  static P player(double x, double y, double z) {
    P p;
    try { p = (P) u.allocateInstance(P.class); } catch (Exception e) { throw new RuntimeException(e); }
    p.got = new ArrayList<>(); p.removed = new ArrayList<>();
    p.s = x; p.t = y; p.u = z;
    try { fd(sa.class, "C").set(p, azt.a(x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3)); } catch (Exception e) { throw new RuntimeException(e); }
    return p;
  }
  static void reset() { W.cells.clear(); W.sky = true; W.time = 0; W.players.clear(); W.lastBox = null; }
  static final int[] PYRAMID = { 42, 41, 133, 57 };
  static void pyramid(int x, int y, int z, int layers, int block) {
    for (int l = 1; l <= layers; l++)
      for (int dx = -l; dx <= l; dx++) for (int dz = -l; dz <= l; dz++) W.cells.put((x + dx) + "," + (y - l) + "," + (z + dz), block);
  }
  static String blockFacts(aji b) throws Exception {
    return "{\"id\":" + aji.b(b) + ",\"light\":" + b.m() + ",\"opacity\":" + b.k() + ",\"opaque\":" + bool(b.c()) + ",\"normal\":" + bool(b.d())
      + ",\"renderType\":" + b.b() + ",\"hardness\":" + fd(aji.class, "v").getFloat(b) + ",\"resistance\":" + fd(aji.class, "w").getFloat(b)
      + ",\"bounds\":[" + fd(aji.class, "B").getDouble(b) + "," + fd(aji.class, "C").getDouble(b) + "," + fd(aji.class, "D").getDouble(b) + "," + fd(aji.class, "E").getDouble(b) + "," + fd(aji.class, "F").getDouble(b) + "," + fd(aji.class, "G").getDouble(b) + "]}";
  }
  static String effect(rw e) { return e == null ? "null" : "[" + e.a() + "," + e.b() + "," + e.c() + "," + e.e() + "]"; }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); u = (sun.misc.Unsafe) uf.get(null);
    w = (W) u.allocateInstance(W.class);

    // facts: tier table (potion ids), block and item properties.
    StringBuilder tiers = new StringBuilder("[");
    for (int i = 0; i < aoq.a.length; i++) {
      tiers.append(i > 0 ? "," : "").append("[");
      for (int j = 0; j < aoq.a[i].length; j++) tiers.append(j > 0 ? "," : "").append(aoq.a[i][j].H);
      tiers.append("]");
    }
    tiers.append("]");
    adb star = adb.d(399);
    aji beacon = aji.e(138);
    add starStack = new add(star);
    out("{\"case\":\"facts\",\"tiers\":" + tiers + ",\"block\":" + blockFacts(beacon) + ",\"blockClass\":" + q(beacon.getClass().getSimpleName())
      + ",\"pyramidBlocks\":" + ints(PYRAMID) + ",\"payments\":" + ints(adb.b(ade.bC), adb.b(ade.i), adb.b(ade.j), adb.b(ade.k))
      + ",\"star\":{\"id\":" + adb.b(star) + ",\"maxStack\":" + fd(adb.class, "h").getInt(star) + ",\"glint\":" + bool(star.e(starStack)) + ",\"rarity\":" + star.f(starStack).ordinal()
      + ",\"rarityRef\":[" + adb.d(322).f(new add(adb.d(322), 1, 1)).ordinal() + "," + adb.d(322).f(new add(adb.d(322), 1, 0)).ordinal() + "," + adb.d(264).f(new add(adb.d(264))).ordinal() + "]},\"tileTitle\":" + q(new aoq().b()) + ",\"tileRange\":" + new aoq().n() + ",\"tileRenderDistance\":" + new aoq().n() + ",\"tileSize\":" + new aoq().a() + "}");

    // levels: the pyramid check (aoq.y) at every layer count, with a mixed-material layer, missing sky, and a hole.
    for (int layers = 0; layers <= 5; layers++) {
      for (int block : PYRAMID) {
        reset();
        pyramid(10, 70, 10, Math.min(layers, 4), block);
        aoq t = tile(10, 70, 10);
        call(t, "y");
        out("{\"case\":\"levels\",\"layers\":" + layers + ",\"block\":" + block + ",\"sky\":true,\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}");
      }
    }
    for (boolean sky : new boolean[] { true, false }) {
      reset(); W.sky = sky; pyramid(10, 70, 10, 4, 41);
      aoq t = tile(10, 70, 10); call(t, "y");
      out("{\"case\":\"levels\",\"layers\":4,\"block\":41,\"sky\":" + sky + ",\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}");
    }
    // mixed layers: layer 1 iron, layer 2 gold, layer 3 emerald, layer 4 diamond (any of the four counts)
    reset(); for (int l = 1; l <= 4; l++) pyramid(10, 70, 10, l, PYRAMID[l - 1]);
    // pyramid() above stacks later layers over earlier ones at the same cells only for the same depth; rebuild per depth exactly:
    reset();
    for (int l = 1; l <= 4; l++) for (int dx = -l; dx <= l; dx++) for (int dz = -l; dz <= l; dz++) W.cells.put((10 + dx) + "," + (70 - l) + "," + (10 + dz), PYRAMID[l - 1]);
    { aoq t = tile(10, 70, 10); call(t, "y"); out("{\"case\":\"levels\",\"layers\":\"mixed\",\"block\":0,\"sky\":true,\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}"); }
    // a hole at each layer, at the corner and at the centre column
    for (int hole = 1; hole <= 4; hole++) for (int[] off : new int[][] { { 0, 0 }, { -hole, -hole }, { hole, 0 } }) {
      reset(); pyramid(10, 70, 10, 4, 42);
      W.cells.remove((10 + off[0]) + "," + (70 - hole) + "," + (10 + off[1]));
      aoq t = tile(10, 70, 10); call(t, "y");
      out("{\"case\":\"levels\",\"layers\":\"hole" + hole + "@" + off[0] + "," + off[1] + "\",\"block\":42,\"sky\":true,\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}");
    }
    // a wider layer is not required nor penalised: a 5-wide extra ring beyond the layer
    reset(); pyramid(10, 70, 10, 4, 41); for (int dx = -6; dx <= 6; dx++) W.cells.put((10 + dx) + ",69," + 10, 41);
    { aoq t = tile(10, 70, 10); call(t, "y"); out("{\"case\":\"levels\",\"layers\":\"extra\",\"block\":41,\"sky\":true,\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}"); }
    // y near the floor: beacon at y=3 can only see 3 layers
    reset(); pyramid(10, 3, 10, 3, 41);
    { aoq t = tile(10, 3, 10); call(t, "y"); out("{\"case\":\"levels\",\"layers\":\"floor3\",\"block\":41,\"sky\":true,\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}"); }
    reset(); pyramid(10, 4, 10, 4, 41);
    { aoq t = tile(10, 4, 10); call(t, "y"); out("{\"case\":\"levels\",\"layers\":\"floor4\",\"block\":41,\"sky\":true,\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}"); }

    // tick: h() runs y() and x() only when the world time is a multiple of 80 (checked over 0..240 plus offsets).
    for (long time : new long[] { 0, 1, 79, 80, 81, 159, 160, 161, 240, 24000, 24001, 23920 }) {
      reset(); W.time = time; pyramid(10, 70, 10, 2, 41);
      aoq t = tile(10, 70, 10);
      t.h();
      out("{\"case\":\"tick\",\"time\":" + time + ",\"levels\":" + get(t, "l") + ",\"active\":" + bool(getB(t, "k")) + "}");
    }

    // effects: x() at each level with each (primary, secondary), a player at distances along x, and a player outside.
    int[] primaries = { 0, 1, 3, 5, 8, 10, 11 };
    for (int lv = 0; lv <= 4; lv++) for (int pr : primaries) for (int sec : new int[] { 0, 1, 3, 5, 8, 10, 11 }) {
      reset();
      aoq t = tile(10, 70, 10);
      fd(aoq.class, "k").setBoolean(t, true); set(t, "l", lv); set(t, "m", pr); set(t, "n", sec);
      P near = player(10.5, 70, 10.5); W.players.add(near);
      call(t, "x");
      List<String> ex = near.got;
      azt box = W.lastBox;
      out("{\"case\":\"effects\",\"levels\":" + lv + ",\"primary\":" + pr + ",\"secondary\":" + sec + ",\"applied\":" + ex + ",\"box\":" + (box == null ? "null" : "[" + box.a + "," + box.b + "," + box.c + "," + box.d + "," + box.e + "," + box.f + "]") + "}");
    }
    // not active, remote world and distances
    for (int lv : new int[] { 1, 2, 3, 4 }) {
      for (double dist : new double[] { 0, 10, 10.6, 19.5, 20, 20.5, 30, 30.6, 40, 40.5, 40.7, 50, 50.7 }) {
        reset();
        aoq t = tile(10, 70, 10);
        fd(aoq.class, "k").setBoolean(t, true); set(t, "l", lv); set(t, "m", 1); set(t, "n", 0);
        P p = player(10.5 + dist, 70, 10.5); W.players.add(p);
        P high = player(10.5, 70 + 300, 10.5); W.players.add(high);
        P below = player(10.5, 70 - (lv * 10 + 10) - 5, 10.5); W.players.add(below);
        call(t, "x");
        out("{\"case\":\"range\",\"levels\":" + lv + ",\"dx\":" + dist + ",\"got\":" + p.got + ",\"gotHigh\":" + high.got + ",\"gotBelow\":" + below.got + "}");
      }
    }
    for (int mode = 0; mode < 4; mode++) {
      reset();
      aoq t = tile(10, 70, 10);
      fd(aoq.class, "k").setBoolean(t, mode != 0); set(t, "l", mode == 1 ? 0 : 2); set(t, "m", mode == 2 ? 0 : 1); set(t, "n", 0);
      fd(ahb.class, "E").setBoolean(w, mode == 3);
      P p = player(10.5, 70, 10.5); W.players.add(p);
      call(t, "x");
      fd(ahb.class, "E").setBoolean(w, false);
      out("{\"case\":\"gate\",\"mode\":" + mode + ",\"got\":" + p.got + "}");
    }

    // setter: d(primary) and e(secondary) validation at every level for every potion id 0..32.
    for (int lv = 0; lv <= 4; lv++) for (int id = 0; id <= 32; id++) {
      reset();
      aoq t = tile(10, 70, 10); set(t, "l", lv); set(t, "m", 99); set(t, "n", 99);
      t.d(id); int primary = t.j();
      t.e(id); int secondary = t.k();
      out("{\"case\":\"setter\",\"levels\":" + lv + ",\"id\":" + id + ",\"primary\":" + primary + ",\"secondary\":" + secondary + "}");
    }
    // the setters reset to 0 first
    { reset(); aoq t = tile(10, 70, 10); set(t, "l", 2); set(t, "m", 1); set(t, "n", 1); t.d(99); t.e(99);
      out("{\"case\":\"setterReset\",\"primary\":" + t.j() + ",\"secondary\":" + t.k() + "}"); }

    // nbt: write (b) and read (a) round trip; defaults of a new tile.
    {
      reset(); aoq t = tile(10, 70, 10); set(t, "l", 4); set(t, "m", 5); set(t, "n", 10);
      dh tag = new dh(); t.b(tag);
      List<String> keys = new ArrayList<>(tag.c());
      Collections.sort(keys);
      aoq r = tile(10, 70, 10); r.a(tag);
      out("{\"case\":\"nbt\",\"keys\":" + keysJson(keys) + ",\"id\":" + q(tag.j("id")) + ",\"primary\":" + tag.f("Primary") + ",\"secondary\":" + tag.f("Secondary") + ",\"levels\":" + tag.f("Levels")
        + ",\"readLevels\":" + r.l() + ",\"readPrimary\":" + r.j() + ",\"readSecondary\":" + r.k() + ",\"readActive\":" + bool(getB(r, "k")) + ",\"fresh\":" + new aoq().l() + "}");
      aoq e = tile(10, 70, 10); dh empty = new dh(); e.a(empty);
      out("{\"case\":\"nbt\",\"readEmptyLevels\":" + e.l() + ",\"readEmptyPrimary\":" + e.j() + ",\"readEmptySecondary\":" + e.k() + "}");
    }

    // slot: the payment slot (zy.a(add)) validity for a spread of items, and its stack limit; and aoq's inventory (size, limit).
    for (int id : new int[] { 0, 1, 264, 265, 266, 388, 399, 4, 41, 42, 133, 57, 331, 260, 322, 351, 371, 388 }) {
      adb item = id == 0 ? null : adb.d(id);
      add stack = item == null ? null : new add(item);
      aoq t = tile(10, 70, 10);
      zx c = new zx(inventory(), t);
      aay slot = c.a(0);
      out("{\"case\":\"slot\",\"item\":" + id + ",\"valid\":" + bool(slot.a(stack)) + ",\"slotLimit\":" + slot.a() + ",\"tileLimit\":" + t.a() + "}");
    }
    // slot layout: the container's slot positions and the tile's decrStackSize/getStackInSlotOnClosing.
    {
      aoq t = tile(10, 70, 10);
      zx c = new zx(inventory(), t);
      StringBuilder pos = new StringBuilder("[");
      for (int i = 0; i < c.c.size(); i++) { aay s = (aay) c.c.get(i); pos.append(i > 0 ? "," : "").append("[").append(s.h).append(",").append(s.i).append("]"); }
      pos.append("]");
      out("{\"case\":\"layout\",\"count\":" + c.c.size() + ",\"positions\":" + pos + "}");
    }

    // shift: shift-click (zx.b(yz,int)) from each slot with the payment slot empty/full and a valid/invalid item. Player slots 1..27 main, 28..36 hotbar.
    for (int from : new int[] { 0, 1, 20, 27, 28, 36 }) for (int id : new int[] { 266, 264, 4 }) for (int count : new int[] { 1, 5 }) for (boolean full : new boolean[] { false, true }) {
      aoq t = tile(10, 70, 10);
      yx inv = inventory();
      zx c = new zx(inv, t);
      if (full) t.a(0, new add(adb.d(265)));
      add moved = new add(adb.d(id), count, 0);
      if (from == 0) { if (full) t.a(0, moved); else t.a(0, moved); }
      else c.a(from).c(moved);
      P p = player(10.5, 70, 10.5);
      add res = c.b(p, from);
      List<String> after = new ArrayList<>();
      for (int i = 0; i < c.c.size(); i++) { aay s = (aay) c.c.get(i); add st = s.d(); if (st != null) after.add("[" + i + "," + adb.b(st.b()) + "," + st.b + "]"); }
      out("{\"case\":\"shift\",\"from\":" + from + ",\"item\":" + id + ",\"count\":" + count + ",\"payFull\":" + bool(full) + ",\"result\":" + (res == null ? "null" : "[" + adb.b(res.b()) + "," + res.b + "]") + ",\"after\":" + after + "}");
    }

    // server: replay of NetHandlerPlayServer MC|Beacon with a stack of 3 payment in slot 0.
    for (int lv : new int[] { 0, 1, 2, 3, 4 }) for (int[] pick : new int[][] { { 1, 0 }, { 3, 0 }, { 10, 0 }, { 5, 5 }, { 1, 1 }, { 11, 1 }, { 1, 10 }, { 10, 10 }, { 5, 0 }, { 99, 99 } }) for (boolean paid : new boolean[] { true, false }) {
      aoq t = tile(10, 70, 10); set(t, "l", lv);
      zx c = new zx(inventory(), t);
      if (paid) t.a(0, new add(adb.d(266), 3, 0));
      aay slot = c.a(0);
      if (slot.e()) { slot.a(1); t.d(pick[0]); t.e(pick[1]); t.e(); }
      add left = t.a(0);
      out("{\"case\":\"server\",\"levels\":" + lv + ",\"pick\":" + ints(pick) + ",\"paid\":" + bool(paid) + ",\"primary\":" + t.j() + ",\"secondary\":" + t.k() + ",\"left\":" + (left == null ? 0 : left.b) + "}");
    }

    // closing: aoq.a_(0) returns and clears the slot (ContainerBeacon does not override onContainerClosed).
    {
      aoq t = tile(10, 70, 10); t.a(0, new add(adb.d(264), 1, 0));
      add r = t.a_(0);
      out("{\"case\":\"close\",\"returned\":" + (r == null ? 0 : r.b) + ",\"after\":" + (t.a(0) == null) + ",\"containerOverridesClose\":" + hasMethod(zx.class, "b", yz.class) + "}");
    }
  }
  static boolean hasMethod(Class<?> c, String name, Class<?>... params) {
    try { c.getDeclaredMethod(name, params); return true; } catch (NoSuchMethodException e) { return false; }
  }
  static String keysJson(List<String> k) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < k.size(); i++) s.append(i > 0 ? "," : "").append(q(k.get(i))); return s.append("]").toString(); }
  static yx inventory() throws Exception {
    yx inv = (yx) u.allocateInstance(yx.class);
    fd(yx.class, "a").set(inv, new add[36]);
    fd(yx.class, "b").set(inv, new add[4]);
    return inv;
  }
}
