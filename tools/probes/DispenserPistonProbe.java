import java.lang.reflect.*;
import java.util.*;

// Runs the unchanged 1.7.10 BlockDispenser (akm, id 23), BlockPistonBase (app, ids 33 normal / 29 sticky),
// BlockPistonExtension (apq, id 34), TileEntityDispenser (apb) and ContainerDispenser (aaz), driving the
// real Container.slotClick (zs) and every block method the live port implements. The only test doubles are
// a constructor-less World (block/metadata/tile maps, recorded setBlockMetadata and spawned entities) and a
// constructor-less EntityPlayer. Block bounds, collision/selection boxes, icon names, drops, placement
// orientation (BlockPistonBase.determineOrientation through onBlockPlacedBy), activation, breakBlock spills,
// head/base interplay, TileEntityDispenser NBT and container clicks are printed as one JSON record per line.
// Dispensing/extension/retraction need redstone power and are not exercised.
public class DispenserPistonProbe {
  static sun.misc.Unsafe U;
  static final Random picks = new Random(2329033423L);

  static Field field(Class<?> c, String n) throws Exception {
    for (; c != null; c = c.getSuperclass()) try { Field f = c.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(n);
  }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String ql(long v) { return "\"" + v + "\""; }

  static class Provider extends aqo { public String l() { return "probe"; } }

  public static class ProbePlayer extends yz {
    List<String> opened = new ArrayList<>(), thrown = new ArrayList<>();
    ProbePlayer() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public void a(apb t) { opened.add(t.c + "," + t.d + "," + t.e); }
    public xk a(add s, boolean b) { thrown.add(enc(s)); return null; }
  }

  public static class W extends ahb {
    W() { super((azc) null, null, (aqo) null, (ahj) null, null); }
    Map<String, Integer> blocks = new HashMap<>(), metas = new HashMap<>();
    Map<String, aor> tiles = new HashMap<>();
    List<String> log = new ArrayList<>();
    List<xk> spawned = new ArrayList<>();
    agy rules = new agy();
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    static String key(int x, int y, int z) { return x + "," + y + "," + z; }
    public aji a(int x, int y, int z) { Integer id = blocks.get(key(x, y, z)); return aji.e(id == null ? 0 : id); }
    public int e(int x, int y, int z) { Integer m = metas.get(key(x, y, z)); return m == null ? 0 : m; }
    public boolean a(int x, int y, int z, int meta, int flags) { log.add("meta," + x + "," + y + "," + z + "," + meta + "," + flags); metas.put(key(x, y, z), meta); return true; }
    public boolean f(int x, int y, int z) { log.add("air," + x + "," + y + "," + z); blocks.put(key(x, y, z), 0); metas.put(key(x, y, z), 0); return true; }
    public aor o(int x, int y, int z) { return tiles.get(key(x, y, z)); }
    public void p(int x, int y, int z) { tiles.remove(key(x, y, z)); }
    public boolean d(sa e) { spawned.add((xk) e); return true; }
    public void f(int x, int y, int z, aji b) {}
    // World.addBlockEvent: recorded only; the piston's extend/retract handler needs a full world and power.
    public void c(int x, int y, int z, aji b, int ev, int param) { log.add("event," + x + "," + y + "," + z + "," + aji.b(b) + "," + ev + "," + param); }
    public agy O() { return rules; }
    public boolean t(int x, int y, int z) { return false; }
    void put(int x, int y, int z, int id, int meta) { blocks.put(key(x, y, z), id); metas.put(key(x, y, z), meta); }
  }
  static W world() throws Exception {
    W w = (W) U.allocateInstance(W.class);
    w.blocks = new HashMap<>(); w.metas = new HashMap<>(); w.tiles = new HashMap<>(); w.log = new ArrayList<>(); w.spawned = new ArrayList<>(); w.rules = new agy();
    field(ahb.class, "t").set(w, new Provider());
    field(ahb.class, "s").set(w, new Random(7));
    return w;
  }
  static ProbePlayer player(W w, double x, double y, double z, float yaw, float pitch, float yOffset) throws Exception {
    ProbePlayer p = (ProbePlayer) U.allocateInstance(ProbePlayer.class);
    p.opened = new ArrayList<>(); p.thrown = new ArrayList<>();
    p.o = w; p.bE = new yw(); p.s = x; p.t = y; p.u = z; p.y = yaw; p.z = pitch; p.L = yOffset;
    yx inv = new yx(p); p.bm = inv;
    return p;
  }

  static Object access(int meta) {
    return Proxy.newProxyInstance(ahl.class.getClassLoader(), new Class[]{ahl.class}, (p, m, a) -> {
      if (m.getName().equals("e") && m.getReturnType() == int.class) return meta;
      if (m.getReturnType() == boolean.class) return false;
      if (m.getReturnType() == int.class) return 0;
      if (m.getReturnType() == float.class) return 0F;
      if (m.getReturnType() == double.class) return 0D;
      return null;
    });
  }
  static String bounds(aji b) throws Exception {
    String[] n = {"B", "C", "D", "E", "F", "G"};
    StringBuilder o = new StringBuilder("[");
    for (int i = 0; i < 6; i++) { if (i > 0) o.append(','); o.append(field(aji.class, n[i]).getDouble(b)); }
    return o.append(']').toString();
  }
  static String aabb(azt a) { return a == null ? "null" : "[" + a.a + "," + a.b + "," + a.c + "," + a.d + "," + a.e + "," + a.f + "]"; }
  static String enc(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }

  static final int[] IDS = {23, 29, 33, 34};
  static final String[] CLASS = {"BlockDispenser", "BlockPistonBase", "BlockPistonBase", "BlockPistonExtension"};

  // Icon registry: icons are named proxies, so a/b(side, meta) reports the registered texture name.
  static final List<String> ICON_NAMES = new ArrayList<>();
  // Every icon reports min/max U/V as 4k..4k+1 for its index k, so a vertex U/V recovers both the icon and the texel fraction.
  static rf icon(String name) {
    if (!ICON_NAMES.contains(name)) ICON_NAMES.add(name);
    final float base = 4F * ICON_NAMES.indexOf(name);
    return (rf) Proxy.newProxyInstance(rf.class.getClassLoader(), new Class[]{rf.class}, (p, m, a) -> {
      String n = m.getName();
      if (n.equals("g")) return name;
      if (m.getParameterCount() == 1 && (n.equals("a") || n.equals("b"))) return base + (float) ((Double) a[0] / 16D);
      if (m.getReturnType() == float.class) return n.equals("d") || n.equals("f") ? base + 1F : base;
      if (m.getReturnType() == int.class) return 16;
      if (m.getReturnType() == double.class) return 0D;
      return null;
    });
  }
  static rg registry() {
    return (rg) Proxy.newProxyInstance(rg.class.getClassLoader(), new Class[]{rg.class}, (p, m, a) -> icon((String) a[0]));
  }
  static String name(rf i) { return i == null ? "null" : q(i.g()); }

  static void blocks() throws Exception {
    rg reg = registry();
    for (int id : IDS) aji.e(id).a(reg);
    for (int bi = 0; bi < IDS.length; bi++) {
      int id = IDS[bi];
      aji b = aji.e(id);
      awt m = b.o();
      StringBuilder o = new StringBuilder("{\"kind\":\"block\",\"id\":" + aji.b(b) + ",\"className\":" + q(CLASS[bi]) + ",\"javaClass\":" + q(b.getClass().getName()));
      o.append(",\"renderType\":").append(b.b()).append(",\"renderNormal\":").append(b.d()).append(",\"opaque\":").append(b.c())
        .append(",\"hardness\":").append(b.f(null, 0, 0, 0)).append(",\"explosionResistance\":").append(b.a((sa) null))
        .append(",\"lightOpacity\":").append(b.k()).append(",\"lightValue\":").append(b.m())
        .append(",\"toolNotRequired\":").append(m.l()).append(",\"materialOpaque\":").append(m.k()).append(",\"materialSolid\":").append(m.a())
        .append(",\"stepSound\":[").append(q(b.H.a())).append(',').append(q(b.H.b())).append(',').append(b.H.b).append(',').append(b.H.c).append(']')
        .append(",\"tileEntity\":").append(b instanceof ajc)
        .append(",\"quantityDropped\":").append(b.a(new Random(1)));
      W w = world();
      o.append(",\"damageDropped\":[");
      for (int mt = 0; mt < 16; mt++) { if (mt > 0) o.append(','); o.append(b.a(mt)); }
      o.append("],\"itemDropped\":[");
      for (int mt = 0; mt < 16; mt++) { if (mt > 0) o.append(','); adb d = b.a(mt, new Random(1), 0); o.append(d == null ? -1 : adb.b(d)); }
      o.append("],\"boundsByMeta\":[");
      for (int mt = 0; mt < 16; mt++) { if (mt > 0) o.append(','); b.a((ahl) access(mt), 0, 0, 0); o.append(bounds(b)); }
      o.append("],\"collision\":[");
      for (int mt = 0; mt < 16; mt++) {
        w.put(0, 0, 0, id, mt); b.a((ahl) access(mt), 0, 0, 0);
        List list = new ArrayList();
        b.a((ahb) w, 0, 0, 0, azt.a(-10, -10, -10, 10, 10, 10), list, null);
        if (mt > 0) o.append(',');
        o.append("{\"single\":").append(aabb(b.a((ahb) w, 0, 0, 0))).append(",\"boxes\":[");
        for (int i = 0; i < list.size(); i++) { if (i > 0) o.append(','); o.append(aabb((azt) list.get(i))); }
        o.append("],\"selected\":").append(aabb(b.g((ahb) w, 0, 0, 0))).append(",\"after\":").append(bounds(b)).append('}');
      }
      o.append("],\"collisionAt\":[");
      for (int mt : new int[]{0, 3, 8, 13}) {
        w.put(7, -3, 9, id, mt);
        List list = new ArrayList();
        b.a((ahb) w, 7, -3, 9, azt.a(-100, -100, -100, 100, 100, 100), list, null);
        if (mt > 0) o.append(',');
        o.append("[").append(mt).append(",[");
        for (int i = 0; i < list.size(); i++) { if (i > 0) o.append(','); o.append(aabb((azt) list.get(i))); }
        o.append("],").append(aabb(b.g((ahb) w, 7, -3, 9))).append(']');
      }
      o.append("],\"icons\":[");
      // Icons depend on the bounds the last setBlockBoundsBasedOnState left on the block, as in world rendering.
      for (int mt = 0; mt < 16; mt++) {
        b.a((ahl) access(mt), 0, 0, 0);
        if (mt > 0) o.append(',');
        o.append('[');
        for (int side = 0; side < 6; side++) { if (side > 0) o.append(','); o.append(name(b.a(side, mt))); }
        o.append(']');
      }
      o.append("],\"inventoryIcons\":[");
      b.a((ahl) access(0), 0, 0, 0); // plain full-cube bounds, as the item model is drawn
      for (int side = 0; side < 6; side++) { if (side > 0) o.append(','); o.append(name(b.a(side, id == 23 ? 3 : 1))); }
      o.append("],\"canPlaceAt\":").append(b.c((ahb) w, 0, 0, 0)).append(",\"canPlaceOnSide\":[");
      for (int side = 0; side < 6; side++) { if (side > 0) o.append(','); o.append(b.d((ahb) w, 0, 0, 0, side)); }
      o.append("],\"pickItem\":[");
      for (int mt = 0; mt < 16; mt++) { w.put(0, 0, 0, id, mt); adb d = b.d((ahb) w, 0, 0, 0); if (mt > 0) o.append(','); o.append(d == null ? -1 : adb.b(d)); }
      o.append("]}");
      System.out.println(o);
    }
    StringBuilder pi = new StringBuilder("{\"kind\":\"pistonIcons\",\"names\":{");
    int i = 0;
    for (String n : new String[]{"piston_side", "piston_top_normal", "piston_top_sticky", "piston_bottom", "piston_inner"}) {
      if (i++ > 0) pi.append(',');
      pi.append(q(n)).append(':').append(name(app.e(n)));
    }
    System.out.println(pi.append("}}"));
    // Static metadata helpers: getPistonOrientation (b) and isExtended (c).
    StringBuilder h = new StringBuilder("{\"kind\":\"helpers\",\"orientation\":[");
    for (int mt = 0; mt < 16; mt++) { if (mt > 0) h.append(','); h.append(app.b(mt)); }
    h.append("],\"extended\":[");
    for (int mt = 0; mt < 16; mt++) { if (mt > 0) h.append(','); h.append(app.c(mt)); }
    h.append("],\"headFacing\":[");
    for (int mt = 0; mt < 16; mt++) { if (mt > 0) h.append(','); h.append(apq.b(mt)); }
    System.out.println(h.append("]}"));
  }

  // determineOrientation over a grid of feet positions, yaws and pitches. EntityPlayerMP keeps yOffset 0
  // (posY is the feet); the client player has yOffset 1.62 with posY at the eye. The record holds both.
  static void orientation() throws Exception {
    int bx = 10, by = 64, bz = -6;
    double[] dxs = {-2.5, -1.99, 0.5, 1.99, 2.0}, dys = {-4, -1.83, -1.82, 0, 0.18, 0.19, 1, 2.5};
    double[] yaws = {0, 22.49, 22.5, 22.51, 45, 67.49, 67.51, 90, 135, 180, 202.5, 270, 300, -45, -90, -200, 360, 725};
    double[] pitches = {-90, -45, 0, 45, 90};
    W w = world();
    StringBuilder rows = new StringBuilder("[");
    int n = 0, differ = 0;
    for (double dx : dxs) for (double dz : dxs) for (double dy : dys) for (double yaw : yaws) {
      double pitch = pitches[n % pitches.length];
      ProbePlayer sp = player(w, bx + dx, by + dy, bz + dz, (float) yaw, (float) pitch, 0F);
      ProbePlayer cp = player(w, bx + dx, by + dy + 1.62F, bz + dz, (float) yaw, (float) pitch, 1.62F);
      int s = app.a((ahb) w, bx, by, bz, (sv) sp), c = app.a((ahb) w, bx, by, bz, (sv) cp);
      if (s != c) differ++;
      if (n++ > 0) rows.append(',');
      rows.append('[').append(dx).append(',').append(dy).append(',').append(dz).append(',').append(yaw).append(',').append(pitch).append(',').append(s).append(',').append(c).append(']');
    }
    System.out.println("{\"kind\":\"orientation\",\"block\":[" + bx + "," + by + "," + bz + "],\"count\":" + n + ",\"clientDiffers\":" + differ + ",\"rows\":" + rows + "]}");
  }

  // Placement metadata through onBlockPlacedBy for the dispenser and both pistons, with the calls it makes.
  static void placement() throws Exception {
    StringBuilder rows = new StringBuilder("[");
    int n = 0;
    double[][] pos = {{0.5, 0, 0.5}, {0.5, -2, 0.5}, {0.5, 3, 0.5}, {3.5, 0, 0.5}, {0.5, 0, 3.5}, {2.5, 1, -2.5}, {1.9, 0.18, 1.9}, {-1, 0.19, 0.5}};
    double[] yaws = {0, 44.9, 45.1, 90, 135.1, 180, 224.9, 270, 315.1, -90};
    for (int id : new int[]{23, 29, 33}) for (double[] p : pos) for (double yaw : yaws) {
      W w = world();
      int bx = 4, by = 70, bz = 4;
      w.put(bx, by, bz, id, 0);
      if (id == 23) w.tiles.put(bx + "," + by + "," + bz, new apb());
      ProbePlayer pl = player(w, bx + p[0], by + p[1], bz + p[2], (float) yaw, 0F, 0F);
      aji b = aji.e(id);
      b.a((ahb) w, bx, by, bz, (sv) pl, new add(adb.d(id), 1, 0));
      if (n++ > 0) rows.append(',');
      rows.append('[').append(id).append(',').append(p[0]).append(',').append(p[1]).append(',').append(p[2]).append(',').append(yaw).append(",\"")
        .append(String.join(";", w.log)).append("\",").append(w.e(bx, by, bz)).append(']');
    }
    System.out.println("{\"kind\":\"placement\",\"block\":[4,70,4],\"rows\":" + rows + "]}");
  }

  // Right-click on a dispenser: the server opens the container, the client only reports a hit.
  static void activation() throws Exception {
    aji b = aji.e(23);
    StringBuilder rows = new StringBuilder("[");
    int n = 0;
    for (boolean remote : new boolean[]{false, true}) for (boolean tile : new boolean[]{true, false}) {
      W w = world();
      field(ahb.class, "E").setBoolean(w, remote);
      w.put(3, 4, 5, 23, 2);
      if (tile) { apb t = new apb(); t.c = 3; t.d = 4; t.e = 5; w.tiles.put("3,4,5", t); }
      ProbePlayer pl = player(w, 3.5, 4, 3.5, 0F, 0F, 0F);
      boolean r = b.a((ahb) w, 3, 4, 5, (yz) pl, 1, 0.5F, 0.5F, 0.5F);
      if (n++ > 0) rows.append(',');
      rows.append("[").append(remote).append(',').append(tile).append(',').append(r).append(",\"").append(String.join(";", pl.opened)).append("\"]");
    }
    System.out.println("{\"kind\":\"activation\",\"rows\":" + rows + "]}");
  }

  // BlockDispenser.breakBlock: each stack leaves in pieces of 10-30 with the block's own Random.
  static void spills() throws Exception {
    aji b = aji.e(23);
    int[][][] cases = {
      {{262, 64, 0}, {261, 1, 40}, {4, 13, 0}},
      {{332, 16, 0}, {332, 16, 0}, {280, 64, 0}, {276, 1, 0}, {264, 5, 0}, {344, 9, 0}},
      {{262, 30, 0}},
      {{262, 31, 0}},
      {{1, 1, 0}},
    };
    StringBuilder rows = new StringBuilder("[");
    int n = 0;
    for (int[][] stacks : cases) for (int seed : new int[]{1, 2, 3}) {
      W w = world();
      apb t = new apb(); t.c = 8; t.d = 9; t.e = 10; w.tiles.put("8,9,10", t); w.put(8, 9, 10, 23, 3);
      for (int i = 0; i < stacks.length; i++) t.a(i + (i > 2 ? 1 : 0), new add(adb.d(stacks[i][0]), stacks[i][1], stacks[i][2]));
      field(akm.class, "b").set(b, new Random(seed));
      b.a((ahb) w, 8, 9, 10, b, 3);
      StringBuilder out = new StringBuilder("[");
      for (int i = 0; i < w.spawned.size(); i++) {
        xk e = w.spawned.get(i);
        if (i > 0) out.append(',');
        out.append('[').append(enc(e.f())).append(',').append((float) (e.s - 8)).append(',').append((float) (e.t - 9)).append(',').append((float) (e.u - 10)).append(',').append((float) e.v).append(',').append((float) e.w).append(',').append((float) e.x).append(']');
      }
      out.append(']');
      StringBuilder in = new StringBuilder("[");
      for (int i = 0; i < stacks.length; i++) { if (i > 0) in.append(','); in.append('[').append(stacks[i][0]).append(',').append(stacks[i][1]).append(',').append(stacks[i][2]).append(']'); }
      in.append(']');
      if (n++ > 0) rows.append(',');
      rows.append("{\"stacks\":").append(in).append(",\"seed\":").append(seed).append(",\"pieces\":").append(out).append(",\"tileRemoved\":").append(w.tiles.isEmpty()).append('}');
    }
    System.out.println("{\"kind\":\"spill\",\"rows\":" + rows + "]}");
  }

  // Head and base interplay: breakBlock/onBlockHarvested/onNeighborBlockChange and the base drop.
  static void headBase() throws Exception {
    aji head = aji.e(34);
    int[] fx = {0, 0, 0, 0, -1, 1}, fy = {-1, 1, 0, 0, 0, 0}, fz = {0, 0, -1, 1, 0, 0};
    StringBuilder rows = new StringBuilder("[");
    int n = 0;
    for (int dir = 0; dir < 6; dir++) for (int sticky = 0; sticky < 2; sticky++) for (int mode = 0; mode < 5; mode++) {
      W w = world();
      int hx = 5, hy = 70, hz = 5, headMeta = dir | (sticky << 3);
      int bx = hx - fx[dir], by = hy - fy[dir], bz = hz - fz[dir];
      int baseId = sticky == 1 ? 29 : 33;
      boolean baseThere = mode != 2;
      if (baseThere) w.put(bx, by, bz, baseId, dir | 8);
      // mode 3: a base of the other kind (still a piston); mode 4: stone behind the head
      if (mode == 3) w.put(bx, by, bz, sticky == 1 ? 33 : 29, dir | 8);
      if (mode == 4) w.put(bx, by, bz, 1, 0);
      w.put(hx, hy, hz, 34, headMeta);
      ProbePlayer pl = player(w, hx + 0.5, hy, hz - 3, 0F, 0F, 0F);
      String what;
      if (mode == 0 || mode == 2) { head.a((ahb) w, hx, hy, hz, head, headMeta); what = "breakBlock"; }
      else if (mode == 1) { pl.bE.d = true; head.a((ahb) w, hx, hy, hz, headMeta, (yz) pl); what = "harvestedCreative"; }
      else { head.a((ahb) w, hx, hy, hz, aji.e(1)); what = "neighbor"; }
      StringBuilder dropped = new StringBuilder("[");
      for (int i = 0; i < w.spawned.size(); i++) { if (i > 0) dropped.append(','); dropped.append(enc(w.spawned.get(i).f())); }
      dropped.append(']');
      if (n++ > 0) rows.append(',');
      rows.append("{\"dir\":").append(dir).append(",\"sticky\":").append(sticky).append(",\"mode\":").append(mode).append(",\"what\":").append(q(what))
        .append(",\"log\":").append(q(String.join(";", w.log))).append(",\"drops\":").append(dropped)
        .append(",\"base\":[").append(bx - hx).append(',').append(by - hy).append(',').append(bz - hz).append("]}");
    }
    // onBlockHarvested for a non-creative player does nothing special; record it.
    W w = world(); w.put(5, 70, 5, 34, 3); w.put(5, 70, 4, 33, 11);
    ProbePlayer pl = player(w, 5.5, 70, 2, 0F, 0F, 0F);
    head.a((ahb) w, 5, 70, 5, 3, (yz) pl);
    System.out.println("{\"kind\":\"headBase\",\"harvestedSurvivalLog\":" + q(String.join(";", w.log)) + ",\"rows\":" + rows + "]}");
  }

  static dh tagOf(add s) { if (!s.p()) s.d(new dh()); return s.q(); }

  static void nbt() throws Exception {
    // Write: id/x/y/z and the Items list with Slot bytes, in order.
    StringBuilder rows = new StringBuilder("[");
    int[][][] fills = {
      {},
      {{0, 262, 64, 0}},
      {{0, 262, 64, 0}, {4, 261, 1, 40}, {8, 4, 13, 0}},
      {{1, 332, 16, 0}, {2, 280, 64, 0}, {3, 276, 1, 0}, {5, 264, 5, 0}, {6, 344, 9, 0}, {7, 1, 1, 0}},
    };
    int n = 0;
    for (int[][] f : fills) for (int named = 0; named < 2; named++) {
      apb t = new apb(); t.c = 12; t.d = 34; t.e = -56;
      for (int[] s : f) t.a(s[0], new add(adb.d(s[1]), s[2], s[3]));
      if (named == 1) t.a("Shooter");
      dh tag = new dh(); t.b(tag);
      dq items = tag.c("Items", 10);
      StringBuilder slots = new StringBuilder("[");
      for (int i = 0; i < items.c(); i++) {
        dh e = items.b(i);
        if (i > 0) slots.append(',');
        slots.append("[").append(e.d("Slot")).append(',').append(e.e("id")).append(',').append(e.d("Count")).append(',').append(e.e("Damage")).append(']');
      }
      slots.append(']');
      apb back = new apb(); back.a(tag);
      StringBuilder rt = new StringBuilder("[");
      for (int i = 0; i < 9; i++) { if (i > 0) rt.append(','); rt.append(enc(back.a(i))); }
      rt.append(']');
      if (n++ > 0) rows.append(',');
      rows.append("{\"id\":").append(q(tag.j("id"))).append(",\"x\":").append(tag.f("x")).append(",\"y\":").append(tag.f("y")).append(",\"z\":").append(tag.f("z"))
        .append(",\"hasCustomName\":").append(tag.b("CustomName", 8)).append(",\"customName\":").append(q(tag.b("CustomName", 8) ? tag.j("CustomName") : ""))
        .append(",\"slots\":").append(slots).append(",\"readBack\":").append(rt).append('}');
    }
    System.out.println("{\"kind\":\"nbtWrite\",\"inventoryName\":" + q(new apb().b()) + ",\"stackLimit\":" + new apb().d() + ",\"size\":" + new apb().a() + ",\"rows\":" + rows + "]}");
    // Read: unsigned Slot bytes, out-of-range and duplicate slots.
    int[][] slotsIn = {{0}, {8}, {9}, {255 - 256}, {-1}, {100}, {3, 3}, {2, 5, 2}};
    StringBuilder reads = new StringBuilder("[");
    n = 0;
    for (int[] sl : slotsIn) {
      dh tag = new dh(); dq list = new dq();
      for (int i = 0; i < sl.length; i++) {
        dh e = new dh(); e.a("Slot", (byte) sl[i]); e.a("id", (short) (262 + i)); e.a("Count", (byte) (i + 1)); e.a("Damage", (short) 0); list.a(e);
      }
      tag.a("Items", list);
      apb t = new apb(); t.a(tag);
      StringBuilder out = new StringBuilder("[");
      for (int i = 0; i < 9; i++) { if (i > 0) out.append(','); out.append(enc(t.a(i))); }
      out.append(']');
      StringBuilder in = new StringBuilder("[");
      for (int i = 0; i < sl.length; i++) { if (i > 0) in.append(','); in.append(sl[i]); }
      in.append(']');
      if (n++ > 0) reads.append(',');
      reads.append("{\"slotBytes\":").append(in).append(",\"result\":").append(out).append('}');
    }
    System.out.println("{\"kind\":\"nbtRead\",\"rows\":" + reads + "]}");
  }

  // ContainerDispenser layout, canInteractWith (distance squared 64 from the block centre, and tile identity).
  static void layoutAndReach() throws Exception {
    W w = world(); w.put(10, 64, 10, 23, 0);
    apb t = new apb(); t.b = w; t.c = 10; t.d = 64; t.e = 10; w.tiles.put("10,64,10", t);
    ProbePlayer p = player(w, 10.5, 64.5, 10.5, 0F, 0F, 0F);
    aaz con = new aaz(p.bm, t);
    StringBuilder slots = new StringBuilder("[");
    for (int i = 0; i < con.c.size(); i++) {
      aay s = (aay) con.c.get(i);
      if (i > 0) slots.append(',');
      slots.append('[').append(s.g).append(',').append(s.h).append(',').append(s.i).append(',').append(s.a()).append(',').append(s.f == t ? "\"dispenser\"" : "\"player\"")
        .append(',').append(s.a(new add(adb.d(1), 1, 0))).append(',').append(s.a(new add(adb.d(276), 1, 0))).append(',').append(s.a(new add(adb.d(262), 1, 0))).append(']');
    }
    slots.append(']');
    System.out.println("{\"kind\":\"layout\",\"slotCount\":" + con.c.size() + ",\"slots\":" + slots + "}");
    StringBuilder reach = new StringBuilder("[");
    double[][] offs = {{0, 0, 0}, {7.9, 0, 0}, {8.0, 0, 0}, {8.01, 0, 0}, {0, 7.5, 0}, {0, 8, 0}, {-4, 4, 4}, {-4.9, 4.9, 4.9}, {0, -7.5, 0}, {0, -8.5, 0}, {5.7, 5.7, 0}, {5.66, 5.66, 0}};
    for (int i = 0; i < offs.length; i++) {
      p.s = 10.5 + offs[i][0]; p.t = 64.5 + offs[i][1]; p.u = 10.5 + offs[i][2];
      if (i > 0) reach.append(',');
      reach.append('[').append(offs[i][0]).append(',').append(offs[i][1]).append(',').append(offs[i][2]).append(',').append(con.a(p)).append(']');
    }
    // A different tile at the position (the dispenser was replaced) refuses the container.
    w.tiles.put("10,64,10", new apb()); p.s = 10.5; p.t = 64.5; p.u = 10.5;
    reach.append(",[0,0,0,").append(con.a(p)).append(",\"replaced\"]");
    w.tiles.remove("10,64,10");
    reach.append(",[0,0,0,").append(con.a(p)).append(",\"gone\"]");
    System.out.println("{\"kind\":\"reach\",\"rows\":" + reach + "]}");
  }

  static final int[] ITEMS = {4, 280, 264, 276, 267, 332, 344, 297, 50, 262, 261};
  static add randomStack() {
    int id = ITEMS[picks.nextInt(ITEMS.length)], max = adb.d(id).m();
    int count = max == 1 ? 1 : 1 + picks.nextInt(Math.min(max, picks.nextInt(3) == 0 ? max : 5));
    int damage = adb.d(id).o() > 0 && picks.nextInt(3) == 0 ? picks.nextInt(adb.d(id).o()) : 0;
    return new add(adb.d(id), count, damage);
  }
  static String invState(yx inv, apb t) {
    StringBuilder b = new StringBuilder("[[");
    for (int i = 0; i < 9; i++) { if (i > 0) b.append(','); b.append(enc(t.a(i))); }
    b.append("],[");
    for (int i = 0; i < 36; i++) { if (i > 0) b.append(','); b.append(enc(inv.a[i])); }
    return b.append("],").append(enc(inv.o())).append(']').toString();
  }

  static void container() throws Exception {
    for (int c = 0; c < 150; c++) {
      W w = world();
      apb t = new apb();
      ProbePlayer p = player(w, 0, 0, 0, 0F, 0F, 0F);
      p.bE.d = c % 8 == 3;
      yx inv = p.bm;
      add[] startTile = new add[9];
      for (int i = 0; i < 9; i++) if (picks.nextInt(5) < 2) { startTile[i] = randomStack(); t.a(i, startTile[i]); }
      add[] startMain = new add[36];
      for (int i = 0; i < 36; i++) if (picks.nextInt(5) < 2) { startMain[i] = randomStack(); inv.a[i] = startMain[i]; }
      add held = picks.nextInt(4) == 0 ? randomStack() : null;
      inv.b(held);
      StringBuilder start = new StringBuilder("[[");
      for (int i = 0; i < 9; i++) { if (i > 0) start.append(','); start.append(enc(startTile[i])); }
      start.append("],[");
      for (int i = 0; i < 36; i++) { if (i > 0) start.append(','); start.append(enc(startMain[i])); }
      start.append("],").append(enc(held)).append(']');
      aaz con = new aaz(inv, t);
      StringBuilder steps = new StringBuilder("[");
      int n = 6 + picks.nextInt(10);
      for (int k = 0; k < n; k++) {
        int kind = picks.nextInt(20), slot = picks.nextInt(45);
        // The dispenser's own slots and shift-clicks dominate so both routes see merges.
        if (picks.nextInt(2) == 0) slot = picks.nextInt(9);
        String op;
        p.thrown.clear();
        if (kind < 8) {
          int button = picks.nextInt(2); con.a(slot, button, 0, p); op = "[\"click\"," + slot + "," + button + ",0]";
        } else if (kind < 13) {
          int button = picks.nextInt(2); con.a(slot, button, 1, p); op = "[\"click\"," + slot + "," + button + ",1]";
        } else if (kind < 15) {
          int button = picks.nextInt(9); con.a(slot, button, 2, p); op = "[\"click\"," + slot + "," + button + ",2]";
        } else if (kind < 16) {
          int button = picks.nextInt(2); con.a(slot, button, 4, p); op = "[\"click\"," + slot + "," + button + ",4]";
        } else if (kind < 17) {
          int button = picks.nextInt(2); con.a(-999, button, 0, p); op = "[\"click\",-999," + button + ",0]";
        } else if (kind < 18) {
          con.a(slot, 0, 6, p); op = "[\"click\"," + slot + ",0,6]";
        } else if (kind < 19) {
          con.a(slot, 2, 3, p); op = "[\"click\"," + slot + ",2,3]";
        } else {
          int split = picks.nextInt(2), count = 1 + picks.nextInt(4);
          int[] chosen = new int[count];
          for (int i = 0; i < count; i++) chosen[i] = picks.nextInt(45);
          con.a(-999, zs.d(0, split), 5, p);
          StringBuilder sl = new StringBuilder();
          for (int s : chosen) { con.a(s, zs.d(1, split), 5, p); sl.append(',').append(s); }
          con.a(-999, zs.d(2, split), 5, p);
          op = "[\"drag\"," + split + ",[" + sl.substring(1) + "]]";
        }
        if (k > 0) steps.append(',');
        StringBuilder thrown = new StringBuilder("[");
        for (int i = 0; i < p.thrown.size(); i++) { if (i > 0) thrown.append(','); thrown.append(p.thrown.get(i)); }
        thrown.append(']');
        steps.append('[').append(op).append(',').append(invState(inv, t)).append(',').append(thrown).append(']');
      }
      steps.append(']');
      System.out.println("{\"kind\":\"container\",\"creative\":" + p.bE.d + ",\"start\":" + start + ",\"steps\":" + steps + "}");
    }
    // Shift-click routes, one stack at a time, from every container slot into a part-filled layout.
    for (int pass = 0; pass < 3; pass++) {
      for (int slot = 0; slot < 45; slot++) {
        W w = world(); apb t = new apb(); ProbePlayer p = player(w, 0, 0, 0, 0F, 0F, 0F); yx inv = p.bm;
        aaz con = new aaz(inv, t);
        add stack = pass == 0 ? new add(adb.d(4), 40, 0) : pass == 1 ? new add(adb.d(276), 1, 5) : new add(adb.d(332), 16, 0);
        t.a(2, new add(adb.d(4), 30, 0)); t.a(5, new add(adb.d(1), 7, 0)); t.a(8, new add(adb.d(332), 10, 0));
        inv.a[0] = new add(adb.d(4), 50, 0); inv.a[3] = new add(adb.d(1), 3, 0); inv.a[9] = new add(adb.d(332), 6, 0); inv.a[20] = new add(adb.d(4), 20, 0);
        if (slot < 9) t.a(slot, stack); else inv.a[slot < 36 ? slot - 9 + 9 : slot - 36] = stack;
        String before = invState(inv, t);
        add result = con.a(slot, 0, 1, p);
        System.out.println("{\"kind\":\"shift\",\"slot\":" + slot + ",\"before\":" + before + ",\"result\":" + enc(result) + ",\"after\":" + invState(inv, t) + "}");
      }
    }
  }


  // Runs the unchanged RenderBlocks.renderBlockByRenderType (blm.b: renderPistonBase / renderPistonExtension) over a lone block and records
  // the Tessellator's raw quads: block-relative positions, the icon and texel fraction of every vertex, colour (face shade).
  static void render() throws Exception {
    Class<?> tc = Class.forName("bmh");
    bmh t = bmh.a;
    Field fbuf = field(tc, "f"), fidx = field(tc, "p"), fdraw = field(tc, "x");
    Field fa = field(blm.class, "a");
    registerIcons();
    int bx = 5, by = 64, bz = 5;
    StringBuilder out = new StringBuilder();
    for (int id : new int[]{33, 29, 34}) for (int mt = 0; mt < 16; mt++) {
      final int meta = mt, bid = id;
      ahl acc = (ahl) Proxy.newProxyInstance(ahl.class.getClassLoader(), new Class[]{ahl.class}, (p, m, a) -> {
        if (m.getName().equals("a") && m.getParameterCount() == 3) return (int) a[0] == 5 && (int) a[1] == 64 && (int) a[2] == 5 ? aji.e(bid) : aji.e(0);
        if (m.getName().equals("e") && m.getParameterCount() == 3) return (int) a[0] == 5 && (int) a[1] == 64 && (int) a[2] == 5 ? meta : 0;
        if (m.getReturnType() == boolean.class) return false;
        if (m.getReturnType() == int.class) return 0;
        return null;
      });
      blm r = (blm) U.allocateInstance(blm.class);
      fa.set(r, acc);
      Object mc = U.allocateInstance(bao.class);
      field(bao.class, "u").set(mc, U.allocateInstance(bbj.class)); // GameSettings with ambient occlusion off (0)
      field(blm.class, "q").set(r, mc);
      aji b = aji.e(id);
      fdraw.setBoolean(t, false);
      t.b();
      // RenderBlocks.renderBlockByRenderType: setBlockBoundsBasedOnState, setRenderBoundsFromBlock, then render types 16 / 17.
      r.b(b, bx, by, bz);
      int[] buf = (int[]) fbuf.get(t);
      int n = fidx.getInt(t);
      fdraw.setBoolean(t, false);
      out.append(out.length() > 0 ? "," : "").append("{\"id\":").append(id).append(",\"meta\":").append(mt).append(",\"quads\":[");
      for (int i = 0; i + 7 < n; i += 8) {
        float x = Float.intBitsToFloat(buf[i]) - bx, y = Float.intBitsToFloat(buf[i + 1]) - by, z = Float.intBitsToFloat(buf[i + 2]) - bz;
        float u = Float.intBitsToFloat(buf[i + 3]), v = Float.intBitsToFloat(buf[i + 4]);
        int k = (int) Math.floor(u / 4F);
        if (i > 0) out.append(',');
        out.append('[').append(x).append(',').append(y).append(',').append(z).append(',').append(q(ICON_NAMES.get(k))).append(',')
          .append(u - 4F * k).append(',').append(v - 4F * (int) Math.floor(v / 4F)).append(',').append(buf[i + 5]).append(']');
      }
      out.append("]}");
    }
    System.out.println("{\"kind\":\"render\",\"vertexLayout\":[\"x\",\"y\",\"z\",\"icon\",\"u\",\"v\",\"color\"],\"cases\":[" + out + "]}");
  }
  static void registerIcons() {
    rg reg = registry();
    for (int id : IDS) aji.e(id).a(reg);
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    blocks(); orientation(); placement(); activation(); spills(); headBase(); nbt(); layoutAndReach(); render(); container();
  }
}
