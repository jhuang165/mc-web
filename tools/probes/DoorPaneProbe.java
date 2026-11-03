import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 doors, iron bars and glass panes from the unchanged original classes:
// BlockDoor (akn) registered as ids 64 (wood) and 71 (iron), BlockPane (aoa) as ids 101 (iron bars) and
// 102 (glass pane), ItemDoor (ach) as items 324/330, plus World.doesBlockHaveSolidTopSurface and
// ItemInWorldManager's removal order (onBlockHarvested, setBlockToAir, dropBlockAsItem). The world is a
// map-backed double (PlantProbe.W) that really dispatches neighbour notifications: setBlock with flag 1
// calls breakBlock/onBlockAdded and notifies the six neighbours with the previous block in World's order
// (x-1, x+1, y-1, y+1, z-1, z+1), setBlockMetadataWithNotify notifies only for flag 1, setBlockToAir is
// flags 3. Drops are real EntityItems recorded by spawnEntityInWorld; sounds and aux effects are logged.
// Redstone is not simulated: isBlockIndirectlyGettingPowered reads an explicit set of powered cells.
// Records: facts (properties, drops, tool speeds), connect (canPaneConnectTo for every registered block),
// door (all 32 lower/upper metadata combinations), toggle, place, break, neighbour, pane, paneRender.
public class DoorPaneProbe {
  static final int X = 8, Y = 64, Z = 8;
  static final int[] IDS = {64, 71, 101, 102};

  public static class DW extends PlantProbe.W {
    List<String> log = new ArrayList<>();
    Set<Long> power = new HashSet<>();
    static String at(int x, int y, int z) { return x + "," + y + "," + z; }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      if (y < 0 || y > 255) return false;
      aji old = a(x, y, z);
      int om = e(x, y, z);
      if (old == b && om == meta) return false;
      sets.add(new int[] {x, y, z, aji.b(b), meta, flags});
      if (old != b) old.a(this, x, y, z, old, om);
      put(x, y, z, aji.b(b), meta);
      if (old != b) b.b(this, x, y, z);
      if ((flags & 1) != 0) d(x, y, z, old);
      return true;
    }
    public boolean a(int x, int y, int z, int meta, int flags) {
      if (y < 0 || y > 255) return false;
      int[] c = cell(x, y, z);
      if (c[1] == meta) return false;
      sets.add(new int[] {x, y, z, c[0], meta, flags});
      put(x, y, z, c[0], meta);
      if ((flags & 1) != 0) d(x, y, z, aji.e(c[0]));
      return true;
    }
    public void d(int x, int y, int z, aji b) {
      log.add("notify " + at(x, y, z) + "," + aji.b(b));
      int[][] o = {{-1, 0, 0}, {1, 0, 0}, {0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}};
      for (int[] d : o) {
        int nx = x + d[0], ny = y + d[1], nz = z + d[2];
        a(nx, ny, nz).a(this, nx, ny, nz, b);
      }
    }
    public void c(int a, int b, int c, int d, int e, int f) { log.add("rerender"); }
    public void a(yz pl, int type, int x, int y, int z, int data) { log.add("aux " + type + " " + at(x, y, z) + "," + data); }
    public void c(int type, int x, int y, int z, int data) { log.add("aux " + type + " " + at(x, y, z) + "," + data); }
    public boolean v(int x, int y, int z) { return power.contains(key(x, y, z)); }
    public void a(double x, double y, double z, String s, float v, float p) { log.add("sound " + s); }
  }

  static Object player;

  static DW world() throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    DW w = (DW) u.allocateInstance(DW.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(w, u.allocateInstance(ays.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    w.cells = new HashMap<>();
    w.spawned = new ArrayList<>();
    w.scheduled = new ArrayList<>();
    w.sets = new ArrayList<>();
    w.log = new ArrayList<>();
    w.power = new HashSet<>();
    w.base = (x, y, z) -> new int[] {y < 0 ? 1 : 0, 0};
    return w;
  }

  static void makePlayer() throws Exception {
    player = PlantProbe.unsafe.allocateInstance(blk.class);
    MobMoveProbe.set(player, "Z", new Random(1));
    MobMoveProbe.set(player, "C", azt.a(0, 0, 0, 0, 0, 0));
    MobMoveProbe.set(player, "bE", new yw());
    MobMoveProbe.set(player, "bm", new yx((yz) player));
    MobMoveProbe.set(player, "bp", new zr());
    MobMoveProbe.set(player, "s", X + 0.5);
    MobMoveProbe.set(player, "t", (double) Y);
    MobMoveProbe.set(player, "u", Z - 1.5);
    MobMoveProbe.set(player, "o", null);
  }

  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String num(double d) { return d == Math.rint(d) && Math.abs(d) < 1e9 ? String.valueOf((long) d) : String.valueOf(d); }
  static String arr(double... v) { StringBuilder s = new StringBuilder("["); for (int i = 0; i < v.length; i++) s.append(i > 0 ? "," : "").append(num(v[i])); return s.append("]").toString(); }
  static String box(azt b) { return b == null ? "null" : arr(b.a, b.b, b.c, b.d, b.e, b.f); }
  static String boxLocal(azt b, int x, int y, int z) { return b == null ? "null" : arr(b.a - x, b.b - y, b.c - z, b.d - x, b.e - y, b.f - z); }
  static String bounds(aji b) throws Exception {
    String[] f = {"B", "C", "D", "E", "F", "G"};
    double[] v = new double[6];
    for (int i = 0; i < 6; i++) v[i] = MobMoveProbe.field(aji.class, f[i]).getDouble(b);
    return arr(v);
  }
  static String join(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static String material(awt m) {
    return m == awt.d ? "wood" : m == awt.f ? "iron" : m == awt.s ? "glass" : m == awt.e ? "rock" : "other";
  }
  static String stack(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"; }

  static String cellsJson(DW w, int[][] pos) {
    List<String> l = new ArrayList<>();
    for (int[] p : pos) { int[] c = w.cell(p[0], p[1], p[2]); l.add("[" + c[0] + "," + c[1] + "]"); }
    return join(l);
  }
  static String drops(DW w) {
    List<String> l = new ArrayList<>();
    for (sa e : w.spawned) {
      if (!(e instanceof xk)) continue;
      add st = ((xk) e).f();
      try { l.add("[" + adb.b(st.b()) + "," + st.b + "," + st.k() + "," + num(MobMoveProbe.d(e, "s")) + "," + num(MobMoveProbe.d(e, "t")) + "," + num(MobMoveProbe.d(e, "u")) + "]"); } catch (Exception x) { throw new RuntimeException(x); }
    }
    return join(l);
  }
  static String logJson(DW w) { List<String> l = new ArrayList<>(); for (String s : w.log) l.add(q(s)); return join(l); }
  static List<String> sound(DW w) { return w.log; }

  // Ray set through the cell at (X,Y,Z): axis X/Z at five offsets both ways, and Y at two offsets both ways.
  static double[][] rays() {
    List<double[]> r = new ArrayList<>();
    double[] off = {0.1, 0.3, 0.5, 0.7, 0.9};
    for (double o : off) {
      r.add(new double[] {-1, 0.5, o, 2, 0.5, o});
      r.add(new double[] {2, 0.5, o, -1, 0.5, o});
      r.add(new double[] {o, 0.5, -1, o, 0.5, 2});
      r.add(new double[] {o, 0.5, 2, o, 0.5, -1});
    }
    r.add(new double[] {0.5, -1, 0.5, 0.5, 2, 0.5});
    r.add(new double[] {0.5, 2, 0.5, 0.5, -1, 0.5});
    r.add(new double[] {0.1, 2, 0.5, 0.1, -1, 0.5});
    r.add(new double[] {0.9, 2, 0.5, 0.9, -1, 0.5});
    return r.toArray(new double[0][]);
  }
  static String rayJson(aji b, DW w, int x, int y, int z) {
    List<String> out = new ArrayList<>();
    for (double[] r : rays()) {
      azu h = b.a(w, x, y, z, azw.a(x + r[0], y + r[1], z + r[2]), azw.a(x + r[3], y + r[4], z + r[5]));
      out.add(h == null ? "null" : "[" + h.e + "," + num(Math.round((h.f.a - x) * 1e6) / 1e6) + "," + num(Math.round((h.f.b - y) * 1e6) / 1e6) + "," + num(Math.round((h.f.c - z) * 1e6) / 1e6) + "]");
    }
    return join(out);
  }
  static String boxesJson(aji b, DW w, int x, int y, int z) {
    List<azt> l = new ArrayList<>();
    b.a(w, x, y, z, azt.a(x - 2, y - 2, z - 2, x + 3, y + 3, z + 3), l, null);
    List<String> o = new ArrayList<>();
    for (azt a : l) o.add(boxLocal(a, x, y, z));
    return join(o);
  }
  static String shapeJson(aji b, DW w, int x, int y, int z) throws Exception {
    b.a((ahl) w, x, y, z);
    String bounds = bounds(b);
    String sel = boxLocal(b.g(w, x, y, z), x, y, z);
    String coll = boxLocal(b.a(w, x, y, z), x, y, z);
    return "\"bounds\":" + bounds + ",\"selection\":" + sel + ",\"collision\":" + coll + ",\"boxes\":" + boxesJson(b, w, x, y, z) + ",\"rays\":" + rayJson(b, w, x, y, z);
  }

  static void line(String s) { System.out.println(s); }

  static float toolSpeed(adb tool, aji b) { return tool.a(new add(tool), b); }

  static void facts() throws Exception {
    DW w = world();
    int[] tools = {0, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 256, 257, 258, 359};
    for (int id : IDS) {
      aji b = aji.e(id);
      List<String> d = new ArrayList<>();
      for (int m = 0; m < 16; m++) {
        adb it = b.a(m, new Random(1), 0);
        d.add(it == null ? "null" : "[" + adb.b(it) + "," + b.a(m) + "," + b.a(new Random(1)) + "]");
      }
      List<String> speeds = new ArrayList<>(), harvest = new ArrayList<>();
      for (int t : tools) {
        adb item = t == 0 ? null : adb.d(t);
        if (item == null) { speeds.add("[0," + num(1.0) + "]"); harvest.add("[0," + b.o().l() + "]"); continue; }
        speeds.add("[" + t + "," + num(toolSpeed(item, b)) + "]");
        harvest.add("[" + t + "," + (b.o().l() || item.b(b)) + "]");
      }
      ajm snd = (ajm) MobMoveProbe.field(aji.class, "H").get(b);
      Method sil = null;
      for (Class<?> c = b.getClass(); c != null && sil == null; c = c.getSuperclass()) try { sil = c.getDeclaredMethod("E"); } catch (NoSuchMethodException e) {}
      sil.setAccessible(true);
      List<String> pick = new ArrayList<>();
      for (int m : new int[] {0, 8}) {
        w = world();
        w.put(X, Y, Z, id, m);
        adb it = b.d(w, X, Y, Z);
        pick.add(it == null ? "null" : String.valueOf(adb.b(it)));
      }
      line("{\"case\":\"facts\",\"id\":" + id + ",\"class\":" + q(b.getClass().getName())  + ",\"hardness\":" + num(b.f(w, X, Y, Z)) + ",\"resistance\":" + num(b.a((sa) null))
        + ",\"material\":" + q(material(b.o())) + ",\"materialOpaque\":" + b.o().k() + ",\"blocksMovement\":" + b.o().c() + ",\"requiresTool\":" + !b.o().l()
        + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r() + ",\"lightOpacity\":" + b.k() + ",\"light\":" + b.m() + ",\"render\":" + b.b()
        + ",\"sound\":[" + q(snd.a) + "," + num(snd.b) + "," + num(snd.c) + "],\"tickRate\":" + b.a(w) + ",\"mobility\":" + b.h() + ",\"canSilk\":" + sil.invoke(b)
        + ",\"tab\":" + (b.J() == null ? "null" : String.valueOf(b.J().a())) + ",\"drops\":" + join(d) + ",\"pick\":" + join(pick) + ",\"speeds\":" + join(speeds) + ",\"harvest\":" + join(harvest) + "}");
    }
    for (adb it : new adb[] {ade.aq, ade.aw}) {
      line("{\"case\":\"item\",\"id\":" + adb.b(it) + ",\"stackLimit\":" + MobMoveProbe.field(adb.class, "h").getInt(it) + ",\"tab\":" + (it.n_() == null ? "null" : String.valueOf(it.n_().a())) + "}");
    }
  }

  static void connect() {
    aoa pane = (aoa) aji.e(102);
    for (int i = 0; i < 256; i++) {
      aji b = aji.e(i);
      if (b == null) continue;
      aji air = aji.e(0);
      if (i != 0 && b == air) continue;
      line("{\"case\":\"connect\",\"id\":" + i + ",\"pane\":" + pane.a(b) + ",\"bars\":" + ((aoa) aji.e(101)).a(b) + "}");
    }
  }

  // ---- doors ----
  static DW doorWorld(int id, int lower, int upper) {
    DW w;
    try { w = world(); } catch (Exception e) { throw new RuntimeException(e); }
    w.put(X, Y - 1, Z, 1, 0);
    w.put(X, Y, Z, id, lower);
    w.put(X, Y + 1, Z, id, upper);
    return w;
  }

  static void doors() throws Exception {
    for (int id : new int[] {64, 71}) {
      aji b = aji.e(id);
      for (int lower = 0; lower < 8; lower++) for (int hi = 0; hi < 4; hi++) {
        int upper = 8 | hi;
        DW w = doorWorld(id, lower, upper);
        akn d = (akn) b;
        String low = shapeJson(b, w, X, Y, Z), up = shapeJson(b, w, X, Y + 1, Z);
        line("{\"case\":\"door\",\"id\":" + id + ",\"lower\":" + lower + ",\"upper\":" + upper
          + ",\"combined\":[" + d.g((ahl) w, X, Y, Z) + "," + d.g((ahl) w, X, Y + 1, Z) + "],\"facing\":[" + d.e((ahl) w, X, Y, Z) + "," + d.e((ahl) w, X, Y + 1, Z) + "],\"open\":[" + d.f((ahl) w, X, Y, Z) + "," + d.f((ahl) w, X, Y + 1, Z)
          + "],\"movement\":[" + d.b((ahl) w, X, Y, Z) + "," + d.b((ahl) w, X, Y + 1, Z) + "],\"item\":[" + (b.d(w, X, Y, Z) == null ? "null" : String.valueOf(adb.b(b.d(w, X, Y, Z)))) + "],\"lowerShape\":{" + low + "},\"upperShape\":{" + up + "}}");
      }
    }
    // Door halves alone (the other half missing): func_150012_g reads the neighbouring half's metadata.
    for (int id : new int[] {64}) {
      aji b = aji.e(id);
      for (int meta = 0; meta < 16; meta++) {
        DW w = world();
        w.put(X, Y, Z, id, meta);
        akn d = (akn) b;
        line("{\"case\":\"doorAlone\",\"id\":" + id + ",\"meta\":" + meta + ",\"combined\":" + d.g((ahl) w, X, Y, Z) + ",\"shape\":{" + shapeJson(b, w, X, Y, Z) + "}}");
      }
    }
  }

  // BlockDoor.onBlockActivated through the original class; iron is Material.iron and does nothing.
  static void toggles() throws Exception {
    for (int id : new int[] {64, 71}) {
      aji b = aji.e(id);
      for (int lower = 0; lower < 8; lower++) for (int hi = 0; hi < 4; hi++) for (int half = 0; half < 2; half++) {
        DW w = doorWorld(id, lower, 8 | hi);
        boolean r = b.a(w, X, Y + half, Z, (yz) player, 1, 0.5f, 0.5f, 0.5f);
        line("{\"case\":\"toggle\",\"id\":" + id + ",\"lower\":" + lower + ",\"upper\":" + (8 | hi) + ",\"half\":" + half + ",\"result\":" + r
          + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + ",\"log\":" + logJson(w) + "}");
      }
    }
    // func_150014_a (redstone open/close) on both halves.
    for (int id : new int[] {64, 71}) {
      akn b = (akn) aji.e(id);
      for (int lower : new int[] {0, 1, 4, 5}) for (int half = 0; half < 2; half++) for (int open = 0; open < 2; open++) {
        DW w = doorWorld(id, lower, 8);
        b.a(w, X, Y + half, Z, open == 1);
        line("{\"case\":\"setOpen\",\"id\":" + id + ",\"lower\":" + lower + ",\"half\":" + half + ",\"open\":" + (open == 1) + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + ",\"log\":" + logJson(w) + "}");
      }
    }
  }

  // ---- item placement ----
  static int[] column(int kind, int x, int z, DW w, int id) {
    // kinds: 0 air/air, 1 stone/stone, 2 door column (support below), 3 stone/air, 4 air/stone, 5 glass/air, 6 leaves/air
    switch (kind) {
      case 1: w.put(x, Y, z, 1, 0); w.put(x, Y + 1, z, 1, 0); break;
      case 2: w.put(x, Y - 1, z, 1, 0); w.put(x, Y, z, id == 71 ? 64 : 64, 0); w.put(x, Y + 1, z, 64, 8); break;
      case 3: w.put(x, Y, z, 1, 0); break;
      case 4: w.put(x, Y + 1, z, 1, 0); break;
      case 5: w.put(x, Y, z, 20, 0); break;
      case 6: w.put(x, Y, z, 18, 0); break;
      default: break;
    }
    return new int[] {x, z};
  }

  static String placeJson(DW w, adb item, float yaw, int side, int px, int py, int pz, boolean canPlace) throws Exception {
    MobMoveProbe.field(sa.class, "y").setFloat(player, yaw);
    add st = new add(item, 1);
    boolean r = item.a(st, (yz) player, w, px, py, pz, side, 0.5f, 1.0f, 0.5f);
    return "\"result\":" + r + ",\"stack\":" + st.b + ",\"log\":" + logJson(w);
  }

  static void placements() throws Exception {
    adb[] items = {ade.aq, ade.aw};
    // facing from yaw
    for (adb item : items) for (int k = -16; k <= 16; k++) {
      float yaw = k * 22.5f;
      DW w = world();
      w.put(X, Y - 1, Z, 1, 0);
      String r = placeJson(w, item, yaw, 1, X, Y - 1, Z, true);
      line("{\"case\":\"place\",\"kind\":\"yaw\",\"item\":" + adb.b(item) + ",\"yaw\":" + num(yaw) + "," + r + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + "}");
    }
    for (float yaw : new float[] {44.9f, 45.0f, 45.1f, 134.9f, 135.1f, -45.1f, -44.9f, 0.01f, 89.99f}) {
      DW w = world();
      w.put(X, Y - 1, Z, 1, 0);
      String r = placeJson(w, ade.aq, yaw, 1, X, Y - 1, Z, true);
      line("{\"case\":\"place\",\"kind\":\"yaw\",\"item\":" + adb.b(ade.aq) + ",\"yaw\":" + num(yaw) + "," + r + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + "}");
    }
    // hinge choice from the two neighbouring columns for every facing
    float[] yaws = {0, 90, 180, 270};
    int[][] dir = {{0, 1}, {-1, 0}, {0, -1}, {1, 0}};
    int[] facingOf = {1, 2, 3, 0};
    for (int yi = 0; yi < 4; yi++) {
      int facing = facingOf[yi];
      int dx = dir[facing][0], dz = dir[facing][1];
      for (int lk = 0; lk <= 6; lk++) for (int rk = 0; rk <= 6; rk++) {
        DW w = world();
        w.put(X, Y - 1, Z, 1, 0);
        column(lk, X - dx, Z - dz, w, 64);
        column(rk, X + dx, Z + dz, w, 64);
        String r = placeJson(w, ade.aq, yaws[yi], 1, X, Y - 1, Z, true);
        line("{\"case\":\"place\",\"kind\":\"hinge\",\"item\":" + adb.b(ade.aq) + ",\"yaw\":" + yaws[yi] + ",\"left\":" + lk + ",\"right\":" + rk + "," + r
          + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}, {X - dx, Y, Z - dz}, {X - dx, Y + 1, Z - dz}, {X + dx, Y, Z + dz}, {X + dx, Y + 1, Z + dz}}) + "}");
      }
    }
    // clicked side other than the top face
    for (int side = 0; side < 6; side++) {
      DW w = world();
      w.put(X, Y - 1, Z, 1, 0);
      String r = placeJson(w, ade.aq, 0, side, X, Y - 1, Z, true);
      line("{\"case\":\"place\",\"kind\":\"side\",\"side\":" + side + "," + r + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + "}");
    }
    // support and occupancy: below block, the lower cell and the upper cell
    int[][] below = {{0, 0}, {1, 0}, {20, 0}, {18, 0}, {85, 0}, {44, 0}, {44, 8}, {53, 0}, {53, 4}, {78, 0}, {78, 7}, {60, 0}, {3, 0}, {12, 0}, {79, 0}, {154, 0}, {64, 0}, {101, 0}, {102, 0}, {81, 0}, {50, 1}, {96, 0}, {95, 0}, {130, 0}, {54, 2}, {58, 0}, {61, 2}, {88, 0}, {116, 0}, {145, 0}};
    for (int[] bm : below) {
      DW w = world();
      w.put(X, Y - 2, Z, 1, 0);
      w.put(X, Y - 1, Z, bm[0], bm[1]);
      String r = placeJson(w, ade.aq, 0, 1, X, Y - 1, Z, true);
      line("{\"case\":\"place\",\"kind\":\"support\",\"below\":" + bm[0] + ",\"belowMeta\":" + bm[1] + "," + r + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + "}");
    }
    int[][] occ = {{0, 0}, {1, 0}, {8, 0}, {9, 0}, {10, 0}, {11, 0}, {31, 1}, {31, 2}, {37, 0}, {50, 1}, {51, 0}, {78, 0}, {78, 3}, {106, 0}, {20, 0}, {6, 0}, {65, 2}, {66, 0}, {55, 0}, {70, 0}, {132, 0}, {111, 0}, {32, 0}, {175, 2}, {83, 0}, {59, 0}, {64, 0}, {101, 0}};
    for (int level = 0; level < 2; level++) for (int[] bm : occ) {
      DW w = world();
      w.put(X, Y - 1, Z, 1, 0);
      w.put(X, Y + level, Z, bm[0], bm[1]);
      String r = placeJson(w, ade.aq, 0, 1, X, Y - 1, Z, true);
      line("{\"case\":\"place\",\"kind\":\"occupied\",\"level\":" + level + ",\"block\":" + bm[0] + ",\"meta\":" + bm[1] + "," + r + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + "}");
    }
    // world height: the lower cell at y 253..255
    for (int y = 252; y <= 255; y++) {
      DW w = world();
      w.put(X, y - 1, Z, 1, 0);
      String r = placeJson(w, ade.aq, 0, 1, X, y - 1, Z, true);
      line("{\"case\":\"place\",\"kind\":\"height\",\"y\":" + y + "," + r + ",\"cells\":" + cellsJson(w, new int[][] {{X, y, Z}, {X, y + 1, Z}}) + "}");
    }
  }

  // ---- breaking (ItemInWorldManager.tryHarvestBlock order) ----
  static String harvestJson(DW w, int id, int x, int y, int z, boolean creative, boolean canHarvest) throws Exception {
    aji b = w.a(x, y, z);
    int meta = w.e(x, y, z);
    yw caps = (yw) MobMoveProbe.field(yz.class, "bE").get(player);
    caps.d = creative;
    b.a(w, x, y, z, meta, (yz) player);
    boolean flag = w.f(x, y, z);
    if (flag) b.b(w, x, y, z, meta);
    if (!creative && flag && canHarvest) b.b(w, x, y, z, meta, 0);
    caps.d = false;
    return "\"cells\":" + cellsJson(w, new int[][] {{X, Y - 1, Z}, {X, Y, Z}, {X, Y + 1, Z}}) + ",\"drops\":" + drops(w);
  }

  static void breaks() throws Exception {
    for (int id : new int[] {64, 71}) for (int lower : new int[] {0, 1, 2, 3, 4, 5, 6, 7}) for (int hi : new int[] {0, 1}) for (int half = 0; half < 2; half++) for (int creative = 0; creative < 2; creative++) for (int can = 0; can < 2; can++) {
      DW w = doorWorld(id, lower, 8 | hi);
      String r = harvestJson(w, id, X, Y + half, Z, creative == 1, can == 1);
      line("{\"case\":\"break\",\"id\":" + id + ",\"lower\":" + lower + ",\"upper\":" + (8 | hi) + ",\"half\":" + half + ",\"creative\":" + (creative == 1) + ",\"canHarvest\":" + (can == 1) + "," + r + "}");
    }
    for (int id : new int[] {101, 102}) for (int creative = 0; creative < 2; creative++) for (int can = 0; can < 2; can++) {
      DW w = world();
      w.put(X, Y, Z, id, 0);
      String r = harvestJson(w, id, X, Y, Z, creative == 1, can == 1);
      line("{\"case\":\"break\",\"id\":" + id + ",\"creative\":" + (creative == 1) + ",\"canHarvest\":" + (can == 1) + "," + r + "}");
    }
  }

  // ---- neighbour changes ----
  static void neighbours() throws Exception {
    for (int id : new int[] {64, 71}) {
      aji b = aji.e(id);
      // support removed under the lower half, with the old block each time
      for (int lower : new int[] {0, 4}) for (int[] bm : new int[][] {{0, 0}, {1, 0}, {20, 0}, {44, 0}}) {
        DW w = doorWorld(id, lower, 8);
        w.d(X, Y - 1, Z, aji.e(bm[0]), bm[1], 3);
        line("{\"case\":\"neighbour\",\"kind\":\"support\",\"id\":" + id + ",\"lower\":" + lower + ",\"below\":" + bm[0] + ",\"belowMeta\":" + bm[1] + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y - 1, Z}, {X, Y, Z}, {X, Y + 1, Z}}) + ",\"drops\":" + drops(w) + "}");
      }
      // upper half missing / lower half missing, then the notified half is poked directly
      for (int half = 0; half < 2; half++) for (int meta = 0; meta < 8; meta += 3) {
        DW w = world();
        w.put(X, Y - 1, Z, 1, 0);
        if (half == 0) w.put(X, Y, Z, id, meta); else w.put(X, Y + 1, Z, id, 8 | (meta & 1));
        int py = half == 0 ? Y : Y + 1;
        b.a(w, X, py, Z, aji.e(1));
        line("{\"case\":\"neighbour\",\"kind\":\"lone\",\"id\":" + id + ",\"half\":" + half + ",\"meta\":" + meta + ",\"cells\":" + cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + ",\"drops\":" + drops(w) + "}");
      }
      // lower half missing below the upper half after setBlockToAir of the lower half
      // power: neighbour change with an unpowered/powered column and a power-providing old block
      int[] changed = {1, 55, 69, 76, 77};
      for (int lower : new int[] {0, 4}) for (int cp = 0; cp < 4; cp++) for (int ch : changed) {
        DW w = doorWorld(id, lower, 8);
        if (cp == 1) w.power.add(DW.key(X, Y, Z));
        if (cp == 2) w.power.add(DW.key(X, Y + 1, Z));
        if (cp == 3) { w.power.add(DW.key(X, Y, Z)); w.power.add(DW.key(X, Y + 1, Z)); }
        b.a(w, X, Y, Z, aji.e(ch));
        String lowerResult = cellsJson(w, new int[][] {{X, Y, Z}, {X, Y + 1, Z}});
        DW w2 = doorWorld(id, lower, 8);
        if (cp == 1) w2.power.add(DW.key(X, Y, Z));
        if (cp == 2) w2.power.add(DW.key(X, Y + 1, Z));
        if (cp == 3) { w2.power.add(DW.key(X, Y, Z)); w2.power.add(DW.key(X, Y + 1, Z)); }
        b.a(w2, X, Y + 1, Z, aji.e(ch));
        line("{\"case\":\"neighbour\",\"kind\":\"power\",\"id\":" + id + ",\"lower\":" + lower + ",\"powered\":" + cp + ",\"changed\":" + ch + ",\"fromLower\":" + lowerResult + ",\"fromUpper\":" + cellsJson(w2, new int[][] {{X, Y, Z}, {X, Y + 1, Z}}) + "}");
      }
    }
  }

  // ---- panes and bars ----
  static void panes() throws Exception {
    int[][] arms = {{0, -1}, {0, 1}, {-1, 0}, {1, 0}}; // north, south, west, east
    for (int id : new int[] {101, 102}) {
      aji b = aji.e(id);
      for (int mask = 0; mask < 16; mask++) {
        DW w = world();
        w.put(X, Y, Z, id, 0);
        for (int i = 0; i < 4; i++) if ((mask >> i & 1) != 0) w.put(X + arms[i][0], Y, Z + arms[i][1], 1, 0);
        line("{\"case\":\"pane\",\"id\":" + id + ",\"mask\":" + mask + "," + shapeJson(b, w, X, Y, Z) + "}");
      }
      // connections through other pane/glass/non-opaque neighbours, east side only
      for (int nb : new int[] {20, 101, 102, 85, 44, 18, 95, 160, 8, 50, 64, 65, 78, 54, 53, 58}) {
        DW w = world();
        w.put(X, Y, Z, id, 0);
        w.put(X + 1, Y, Z, nb, 0);
        w.put(X - 1, Y, Z, 1, 0);
        line("{\"case\":\"pane\",\"kind\":\"neighbour\",\"id\":" + id + ",\"neighbour\":" + nb + "," + shapeJson(b, w, X, Y, Z) + "}");
      }
      // item render bounds and shouldSideBeRendered with each neighbour on every side
      b.g();
      List<String> sides = new ArrayList<>();
      for (int nb : new int[] {0, 1, 20, 101, 102, 64}) {
        List<String> row = new ArrayList<>();
        for (int side = 0; side < 6; side++) {
          DW w = world();
          int[][] off = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
          int nx = X + off[side][0], ny = Y + off[side][1], nz = Z + off[side][2];
          w.put(X, Y, Z, id, 0);
          w.put(nx, ny, nz, nb, 0);
          // func_149646_a(world, x, y, z, side) is asked of the block at (x, y, z) = the neighbour side's cell
          row.add(String.valueOf(b.a((ahl) w, nx, ny, nz, side)));
        }
        sides.add("[" + nb + "," + join(row) + "]");
      }
      line("{\"case\":\"paneRender\",\"id\":" + id + ",\"itemBounds\":" + bounds(b) + ",\"sides\":" + join(sides) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    makePlayer();
    facts();
    connect();
    doors();
    toggles();
    placements();
    breaks();
    neighbours();
    panes();
  }
}
