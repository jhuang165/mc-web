import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 bed from the unchanged original classes: BlockBed (ajh, block 26), ItemBed (abg, item 355),
// EntityPlayer.sleepInBedAt (yz.a(III)), wakeUpPlayer (yz.a(ZZZ)), onUpdate's sleep timer (yz.h) via isInBed (yz.j),
// BlockBed.func_149977_a (bed spawn search), EntityPlayer.verifyRespawnCoordinates (yz.a(ahb, r, Z)) and
// World.isDaytime (ahb.w) over real skylightSubtracted (ahb.a(F)). The world is DoorPaneProbe.DW (map-backed, with the
// original neighbour-notification order) plus a chunk-provider proxy, a monster list for the "monsters nearby" box and a
// players list. Remote worlds are not simulated (the first line of onBlockActivated/onItemUse returns early).
// Records: facts, place (yaw/side/support/occupied/height), neighbour, break, activate, wake, tick, spawn, verify, daytime.
public class BedProbe {
  static final int X = 8, Y = 64, Z = 8;
  static final int BED = 26;
  static final int[][] DIR = {{0, 1}, {-1, 0}, {0, -1}, {1, 0}};

  public static class BW extends DoorPaneProbe.DW {
    List<sa> mobs = new ArrayList<>();
    public List a(Class c, azt box) {
      List out = new ArrayList();
      for (sa e : mobs) if (c.isInstance(e)) {
        azt b = e.C;
        if (b.d > box.a && b.a < box.d && b.e > box.b && b.b < box.e && b.f > box.c && b.c < box.f) out.add(e);
      }
      return out;
    }
  }

  public static class Player extends yz {
    List<String> msgs = new ArrayList<>();
    Player() { super(null, null); }
    public void a(fj message) {}
    public void b(fj message) { msgs.add(((fr) message).i()); }
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  static BW w;
  static Player player;

  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static String num(double d) { return DoorPaneProbe.num(d); }
  static void line(String s) { System.out.println(s); }
  static String join(List<String> l) { return DoorPaneProbe.join(l); }

  public static class Ch extends apx {
    Ch() { super(null, 0, 0); }
    public ahu a(int x, int z, aib manager) { return ahu.p; }
  }
  static Object chunk;

  static apu chunkProvider() throws Exception {
    chunk = PlantProbe.unsafe.allocateInstance(Ch.class);
    return (apu) Proxy.newProxyInstance(BedProbe.class.getClassLoader(), new Class[] {apu.class}, (p, m, a) -> {
      Class<?> r = m.getReturnType();
      if (r == boolean.class) return true;
      if (r == int.class) return 0;
      if (r == apx.class) return chunk;
      return null;
    });
  }

  static BW world() throws Exception {
    BW b = (BW) PlantProbe.unsafe.allocateInstance(BW.class);
    set(b, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    set(b, "s", new Random(2));
    set(b, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(b, PlantProbe.unsafe.allocateInstance(ays.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(b, false);
    set(b, "h", new ArrayList());
    set(b, "u", new ArrayList());
    set(b, "v", chunkProvider());
    b.cells = new HashMap<>();
    b.spawned = new ArrayList<>();
    b.scheduled = new ArrayList<>();
    b.sets = new ArrayList<>();
    b.log = new ArrayList<>();
    b.power = new HashSet<>();
    b.mobs = new ArrayList<>();
    b.base = (x, y, z) -> new int[] {y < 0 ? 1 : 0, 0};
    return b;
  }

  static void skylight(int v) throws Exception { MobMoveProbe.field(ahb.class, "j").setInt(w, v); }

  static Player makePlayer(double x, double y, double z) throws Exception {
    Player p = (Player) PlantProbe.unsafe.allocateInstance(Player.class);
    set(p, "o", w); set(p, "Z", new Random(0)); set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(p); set(p, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(p);
    MobMoveProbe.field(sv.class, "f").set(p, new HashMap());
    set(p, "bE", new yw());
    set(p, "bm", new yx(p));
    MobMoveProbe.method(yz.class, "aD").invoke(p);
    p.g(20.0f);
    p.msgs = new ArrayList<>();
    // Entity size and yOffset as the constructor leaves them (EntityPlayer: 0.6 x 1.8, yOffset 1.62); setPosition builds the box.
    MobMoveProbe.method(sa.class, "a", float.class, float.class).invoke(p, 0.6f, 1.8f);
    MobMoveProbe.field(sa.class, "L").setFloat(p, 1.62f);
    p.b(x, y, z);
    ((List) MobMoveProbe.field(ahb.class, "h").get(w)).add(p);
    return p;
  }

  static sa zombie(double x, double y, double z) throws Exception {
    sa z0 = (sa) PlantProbe.unsafe.allocateInstance(yq.class);
    set(z0, "C", azt.a(x - 0.3, y, z - 0.3, x + 0.3, y + 1.8, z + 0.3));
    return z0;
  }

  static String cells(int[][] pos) { return DoorPaneProbe.cellsJson(w, pos); }
  static String bedCells() { return cells(new int[][] {{X, Y, Z}, {X + DIR[0][0], Y, Z + DIR[0][1]}, {X + DIR[1][0], Y, Z + DIR[1][1]}, {X + DIR[2][0], Y, Z + DIR[2][1]}, {X + DIR[3][0], Y, Z + DIR[3][1]}}); }
  static String drops() { return DoorPaneProbe.drops(w); }
  static String pstate(Player p) throws Exception {
    return "{\"sleeping\":" + p.bm() + ",\"x\":" + num(MobMoveProbe.d(p, "s")) + ",\"y\":" + num(MobMoveProbe.d(p, "t")) + ",\"z\":" + num(MobMoveProbe.d(p, "u"))
      + ",\"width\":" + num(MobMoveProbe.fl(p, "M")) + ",\"height\":" + num(MobMoveProbe.fl(p, "N")) + ",\"yOffset\":" + num(MobMoveProbe.fl(p, "L"))
      + ",\"timer\":" + MobMoveProbe.field(yz.class, "b").getInt(p) + ",\"bed\":" + (p.bB == null ? "null" : "[" + p.bB.a + "," + p.bB.b + "," + p.bB.c + "]")
      + ",\"spawn\":" + (p.bN() == null ? "null" : "[" + p.bN().a + "," + p.bN().b + "," + p.bN().c + "]")
      + ",\"forced\":" + MobMoveProbe.field(yz.class, "d").getBoolean(p)
      + ",\"offset\":[" + num(MobMoveProbe.fl(p, "bC")) + "," + num(MobMoveProbe.fl(p, "cc")) + "," + num(MobMoveProbe.fl(p, "bD")) + "]"
      + ",\"motion\":[" + num(MobMoveProbe.d(p, "v")) + "," + num(MobMoveProbe.d(p, "w")) + "," + num(MobMoveProbe.d(p, "x")) + "]}";
  }
  static String msgs(Player p) { List<String> l = new ArrayList<>(); for (String s : p.msgs) l.add(q(s)); return join(l); }

  static void putBed(int facing) {
    w.put(X, Y - 1, Z, 1, 0);
    w.put(X + DIR[facing][0], Y - 1, Z + DIR[facing][1], 1, 0);
    w.put(X, Y, Z, BED, facing);
    w.put(X + DIR[facing][0], Y, Z + DIR[facing][1], BED, facing + 8);
  }

  // ---- facts ----
  static void facts() throws Exception {
    aji b = ajn.C;
    adb item = ade.aV;
    List<String> d = new ArrayList<>();
    for (int m = 0; m < 16; m++) {
      adb it = b.a(m, new Random(1), 0);
      d.add(it == null ? "null" : "[" + adb.b(it) + "," + b.a(m) + "," + b.a(new Random(1)) + "]");
    }
    List<String> pick = new ArrayList<>();
    for (int m : new int[] {0, 8}) { w = world(); w.put(X, Y, Z, BED, m); adb it = b.d(w, X, Y, Z); pick.add(it == null ? "null" : String.valueOf(adb.b(it))); }
    ajm snd = (ajm) MobMoveProbe.field(aji.class, "H").get(b);
    w = world(); w.put(X, Y, Z, BED, 0);
    line("{\"case\":\"facts\",\"id\":" + aji.b(b) + ",\"class\":" + q(b.getClass().getName()) + ",\"hardness\":" + num(b.f(w, X, Y, Z)) + ",\"resistance\":" + num(b.a((sa) null))
      + ",\"material\":" + q(DoorPaneProbe.material(b.o())) + ",\"materialName\":\"cloth\",\"materialOpaque\":" + b.o().k() + ",\"blocksMovement\":" + b.o().c() + ",\"requiresTool\":" + !b.o().l()
      + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r() + ",\"lightOpacity\":" + b.k() + ",\"light\":" + b.m() + ",\"render\":" + b.b()
      + ",\"sound\":[" + q(snd.a) + "," + num(snd.b) + "," + num(snd.c) + "],\"mobility\":" + b.h() + ",\"tab\":" + (b.J() == null ? "null" : String.valueOf(b.J().a()))
      + ",\"bounds\":" + DoorPaneProbe.bounds(b) + ",\"drops\":" + join(d) + ",\"pick\":" + join(pick) + "}");
    line("{\"case\":\"item\",\"id\":" + adb.b(item) + ",\"stackLimit\":" + MobMoveProbe.field(adb.class, "h").getInt(item) + ",\"tab\":" + (item.n_() == null ? "null" : String.valueOf(item.n_().a())) + "}");
  }

  // ---- ItemBed.onItemUse ----
  static String place(float yaw, int side, int px, int py, int pz) throws Exception {
    set(player, "y", yaw);
    add st = new add(ade.aV, 1);
    boolean r = ade.aV.a(st, player, w, px, py, pz, side, 0.5f, 1.0f, 0.5f);
    return "\"result\":" + r + ",\"stack\":" + st.b + ",\"sets\":" + sets();
  }
  static String sets() {
    List<String> l = new ArrayList<>();
    for (int[] s : w.sets) l.add("[" + s[0] + "," + s[1] + "," + s[2] + "," + s[3] + "," + s[4] + "," + s[5] + "]");
    return join(l);
  }
  static String around(int level) {
    List<int[]> p = new ArrayList<>();
    p.add(new int[] {X, Y + level, Z});
    for (int[] d : DIR) p.add(new int[] {X + d[0], Y + level, Z + d[1]});
    return cells(p.toArray(new int[0][]));
  }

  static void placements() throws Exception {
    float[] yaws = new float[33 + 12];
    int n = 0;
    for (int k = -16; k <= 16; k++) yaws[n++] = k * 22.5f;
    for (float y : new float[] {44.9f, 45.0f, 45.1f, 134.9f, 135.1f, -45.1f, -44.9f, 0.01f, 89.99f, 359.9f, 360f, 720.5f}) yaws[n++] = y;
    for (float yaw : yaws) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 1, Z, 1, 0);
      for (int[] d : DIR) w.put(X + d[0], Y - 1, Z + d[1], 1, 0);
      String r = place(yaw, 1, X, Y - 1, Z);
      line("{\"case\":\"place\",\"kind\":\"yaw\",\"yaw\":" + num(yaw) + "," + r + ",\"cells\":" + around(0) + "}");
    }
    for (int side = 0; side < 6; side++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 1, Z, 1, 0);
      for (int[] d : DIR) w.put(X + d[0], Y - 1, Z + d[1], 1, 0);
      String r = place(0, side, X, Y - 1, Z);
      line("{\"case\":\"place\",\"kind\":\"side\",\"side\":" + side + "," + r + ",\"cells\":" + around(0) + "}");
    }
    // Support under the foot cell and under the head cell (yaw 0: head at +z).
    int[][] below = {{0, 0}, {1, 0}, {20, 0}, {18, 0}, {85, 0}, {44, 0}, {44, 8}, {53, 0}, {53, 4}, {78, 0}, {78, 7}, {60, 0}, {3, 0}, {12, 0}, {79, 0}, {154, 0}, {64, 0}, {101, 0}, {102, 0}, {81, 0}, {50, 1}, {96, 0}, {95, 0}, {130, 0}, {54, 2}, {58, 0}, {61, 2}, {88, 0}, {116, 0}, {145, 0}, {26, 0}, {26, 8}, {132, 0}, {133, 0}, {134, 0}, {135, 0}, {9, 0}, {10, 0}, {8, 0}, {11, 0}, {65, 3}, {66, 0}, {55, 0}, {38, 0}, {31, 1}, {37, 0}, {111, 0}, {19, 0}, {45, 0}, {17, 0}, {5, 0}, {95, 0}, {89, 0}, {79, 0}, {12, 0}, {13, 0}};
    for (int[] bm : below) for (int which = 0; which < 2; which++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 2, Z, 1, 0); w.put(X, Y - 2, Z + 1, 1, 0);
      w.put(X, Y - 1, Z, 1, 0); w.put(X, Y - 1, Z + 1, 1, 0);
      if (which == 0) w.put(X, Y - 1, Z, bm[0], bm[1]); else w.put(X, Y - 1, Z + 1, bm[0], bm[1]);
      String r = place(0, 1, X, Y - 1, Z);
      line("{\"case\":\"place\",\"kind\":\"support\",\"which\":" + which + ",\"below\":" + bm[0] + ",\"belowMeta\":" + bm[1] + "," + r + ",\"cells\":" + cells(new int[][] {{X, Y, Z}, {X, Y, Z + 1}}) + "}");
    }
    // Occupancy of the foot cell and the head cell: any non-air block refuses (ItemBed uses isAirBlock, not isReplaceable).
    int[][] occ = {{0, 0}, {1, 0}, {8, 0}, {9, 0}, {10, 0}, {11, 0}, {31, 1}, {31, 2}, {37, 0}, {50, 1}, {51, 0}, {78, 0}, {78, 3}, {106, 0}, {20, 0}, {6, 0}, {65, 2}, {66, 0}, {55, 0}, {70, 0}, {132, 0}, {111, 0}, {32, 0}, {175, 2}, {83, 0}, {59, 0}, {64, 0}, {101, 0}, {106, 0}, {51, 0}, {106, 0}, {26, 0}};
    for (int which = 0; which < 2; which++) for (int[] bm : occ) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 1, Z, 1, 0); w.put(X, Y - 1, Z + 1, 1, 0);
      w.put(X, Y, Z + which, bm[0], bm[1]);
      String r = place(0, 1, X, Y - 1, Z);
      line("{\"case\":\"place\",\"kind\":\"occupied\",\"which\":" + which + ",\"block\":" + bm[0] + ",\"meta\":" + bm[1] + "," + r + ",\"cells\":" + cells(new int[][] {{X, Y, Z}, {X, Y, Z + 1}}) + "}");
    }
    // Clicking a non-top face of a block at a different position than the cell below: ItemBed always uses y + 1 of the clicked cell.
    for (int y = 252; y <= 255; y++) {
      w = world(); player = makePlayer(X + 0.5, y + 1.62, Z + 0.5);
      w.put(X, y - 1, Z, 1, 0); w.put(X, y - 1, Z + 1, 1, 0);
      String r = place(0, 1, X, y - 1, Z);
      line("{\"case\":\"place\",\"kind\":\"height\",\"y\":" + y + "," + r + ",\"cells\":" + cells(new int[][] {{X, y, Z}, {X, y, Z + 1}}) + "}");
    }
    // canPlayerEdit: adventure mode refuses (mayBuild false).
    for (int build = 0; build < 2; build++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      ((yw) MobMoveProbe.field(yz.class, "bE").get(player)).e = build == 1;
      w.put(X, Y - 1, Z, 1, 0); w.put(X, Y - 1, Z + 1, 1, 0);
      String r = place(0, 1, X, Y - 1, Z);
      line("{\"case\":\"place\",\"kind\":\"edit\",\"mayBuild\":" + (build == 1) + "," + r + ",\"cells\":" + cells(new int[][] {{X, Y, Z}, {X, Y, Z + 1}}) + "}");
    }
  }

  // ---- neighbour changes and breaking ----
  static void neighbours() throws Exception {
    for (int facing = 0; facing < 4; facing++) for (int which = 0; which < 2; which++) {
      // Remove one half; the other half goes with it. Drops come from the foot half only.
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      putBed(facing);
      int hx = X + DIR[facing][0], hz = Z + DIR[facing][1];
      if (which == 0) w.f(X, Y, Z); else w.f(hx, Y, hz);
      line("{\"case\":\"neighbour\",\"kind\":\"remove\",\"facing\":" + facing + ",\"removed\":" + (which == 0 ? "\"foot\"" : "\"head\"") + ",\"cells\":" + bedCells() + ",\"drops\":" + drops() + ",\"log\":" + DoorPaneProbe.logJson(w) + "}");
    }
    for (int facing = 0; facing < 4; facing++) for (int which = 0; which < 2; which++) {
      // A lone half (no partner): its own neighbour update removes it; only a lone foot drops.
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 1, Z, 1, 0);
      w.put(X, Y, Z, BED, facing + (which == 1 ? 8 : 0));
      aji.e(BED).a(w, X, Y, Z, aji.e(0));
      line("{\"case\":\"neighbour\",\"kind\":\"lone\",\"facing\":" + facing + ",\"half\":" + (which == 0 ? "\"foot\"" : "\"head\"") + ",\"cells\":" + cells(new int[][] {{X, Y, Z}}) + ",\"drops\":" + drops() + "}");
    }
    // Removing the support under either half does nothing (BlockBed has no support check).
    for (int facing = 0; facing < 4; facing++) for (int which = 0; which < 2; which++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      putBed(facing);
      int hx = X + DIR[facing][0], hz = Z + DIR[facing][1];
      if (which == 0) w.f(X, Y - 1, Z); else w.f(hx, Y - 1, hz);
      line("{\"case\":\"neighbour\",\"kind\":\"support\",\"facing\":" + facing + ",\"removed\":" + (which == 0 ? "\"foot\"" : "\"head\"") + ",\"cells\":" + bedCells() + ",\"drops\":" + drops() + "}");
    }
  }

  static void breaks() throws Exception {
    DoorPaneProbe.makePlayer();
    for (int facing = 0; facing < 4; facing++) for (int half = 0; half < 2; half++) for (int creative = 0; creative < 2; creative++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      putBed(facing);
      int hx = X + DIR[facing][0], hz = Z + DIR[facing][1];
      int bx = half == 0 ? X : hx, bz = half == 0 ? Z : hz;
      aji b = w.a(bx, Y, bz);
      int meta = w.e(bx, Y, bz);
      yw caps = (yw) MobMoveProbe.field(yz.class, "bE").get(player);
      caps.d = creative == 1;
      b.a(w, bx, Y, bz, meta, player);
      boolean flag = w.f(bx, Y, bz);
      if (flag) b.b(w, bx, Y, bz, meta);
      if (creative == 0 && flag) b.b(w, bx, Y, bz, meta, 0);
      line("{\"case\":\"break\",\"facing\":" + facing + ",\"half\":" + (half == 0 ? "\"foot\"" : "\"head\"") + ",\"creative\":" + (creative == 1) + ",\"cells\":" + bedCells() + ",\"drops\":" + drops() + "}");
    }
  }

  // ---- BlockBed.onBlockActivated ----
  static String activate(int ax, int ay, int az) throws Exception {
    boolean r = aji.e(BED).a(w, ax, ay, az, player, 1, 0.5f, 0.5f, 0.5f);
    return "\"result\":" + r + ",\"msgs\":" + msgs(player) + ",\"player\":" + pstate(player) + ",\"cells\":" + bedCells() + ",\"sets\":" + sets();
  }

  static void activations() throws Exception {
    // Time of day: the skylightSubtracted threshold (isDaytime is skylightSubtracted < 4), both halves clicked, every facing.
    for (int facing = 0; facing < 4; facing++) for (int sky : new int[] {0, 3, 4, 5, 11}) for (int click = 0; click < 2; click++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(facing); skylight(sky);
      int cx = click == 0 ? X : X + DIR[facing][0], cz = click == 0 ? Z : Z + DIR[facing][1];
      String r = activate(cx, Y, cz);
      line("{\"case\":\"activate\",\"kind\":\"time\",\"facing\":" + facing + ",\"sky\":" + sky + ",\"click\":" + (click == 0 ? "\"foot\"" : "\"head\"") + "," + r + "}");
    }
    // Distance: |dx| <= 3, |dy| <= 2 (feet-level posY, eye height 1.62), |dz| <= 3 are measured from the bed cell clicked (the head).
    int[] offs = {-4, -3, -2, 0, 2, 3, 4};
    for (int dx : offs) for (int dy : new int[] {-4, -3, -2, 0, 2, 3, 4}) for (int dz : new int[] {-4, -3, 0, 3, 4}) {
      w = world();
      player = makePlayer(X + 0.5 + dx, Y + dy + 0.0, Z + 0.5 + dz);
      putBed(0); skylight(11);
      String r = activate(X, Y, Z);
      line("{\"case\":\"activate\",\"kind\":\"distance\",\"dx\":" + dx + ",\"dy\":" + dy + ",\"dz\":" + dz + "," + r + "}");
    }
    // Monsters in the box x +-8, y +-5, z +-8 around the head cell (the cell the sleep call uses).
    int[][] mons = {{0, 0, 0}, {7, 0, 0}, {8, 0, 0}, {9, 0, 0}, {-8, 0, 0}, {0, 4, 0}, {0, 5, 0}, {0, 6, 0}, {0, -5, 0}, {0, -6, 0}, {0, 0, 8}, {0, 0, 9}, {0, 0, -8}, {0, 0, -9}, {7, 4, 7}, {9, 7, 9}};
    for (int[] m : mons) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(0); skylight(11);
      w.mobs.add(zombie(X + 0.5 + m[0], Y + m[1], Z + 1.5 + m[2]));
      String r = activate(X, Y, Z);
      line("{\"case\":\"activate\",\"kind\":\"monster\",\"dx\":" + m[0] + ",\"dy\":" + m[1] + ",\"dz\":" + m[2] + "," + r + "}");
    }
    // Occupied bit: with no sleeper (stale) the bit is cleared and the player sleeps; with another sleeper the message appears.
    for (int mode = 0; mode < 3; mode++) for (int click = 0; click < 2; click++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(0); skylight(11);
      if (mode >= 1) w.put(X, Y, Z, BED, 4);
      if (mode >= 1) w.put(X, Y, Z + 1, BED, 4 + 8);
      if (mode == 2) {
        Player other = makePlayer(X + 0.5, Y + 0.9375, Z + 1.5);
        set(other, "bA", true);
        set(other, "bB", new r(X, Y, Z + 1));
      }
      String r = activate(click == 0 ? X : X, Y, click == 0 ? Z : Z + 1);
      line("{\"case\":\"activate\",\"kind\":\"occupied\",\"mode\":" + mode + ",\"click\":" + (click == 0 ? "\"foot\"" : "\"head\"") + "," + r + "}");
    }
    // The sleeping player's own state afterwards.
    for (int facing = 0; facing < 4; facing++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(facing); skylight(11);
      int hx = X + DIR[facing][0], hz = Z + DIR[facing][1];
      String r = activate(hx, Y, hz);
      line("{\"case\":\"activate\",\"kind\":\"pose\",\"facing\":" + facing + "," + r + "}");
    }
    // Already sleeping, dead and riding: sleepInBedAt refuses (OTHER_PROBLEM) / dismounts.
    w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
    putBed(0); skylight(11);
    set(player, "bA", true);
    String r0 = "\"status\":" + q(player.a(X, Y, Z).toString());
    line("{\"case\":\"activate\",\"kind\":\"alreadySleeping\"," + r0 + "}");
    w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
    putBed(0); skylight(11);
    player.g(0.0f);
    line("{\"case\":\"activate\",\"kind\":\"dead\",\"status\":" + q(player.a(X, Y, Z).toString()) + "}");
    // Without a bed block (sleepInBedAt on plain ground): position X+0.5, Y+0.9375, Z+0.5.
    w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
    w.put(X, Y - 1, Z, 1, 0); skylight(11);
    String st = player.a(X, Y, Z).toString();
    line("{\"case\":\"activate\",\"kind\":\"noBed\",\"status\":" + q(st) + ",\"player\":" + pstate(player) + "}");
  }

  // ---- wakeUpPlayer and the per-tick sleep timer ----
  static void wakes() throws Exception {
    for (int facing = 0; facing < 4; facing++) for (int mask = 0; mask < 8; mask++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(facing); skylight(11);
      int hx = X + DIR[facing][0], hz = Z + DIR[facing][1];
      aji.e(BED).a(w, hx, Y, hz, player, 1, 0.5f, 0.5f, 0.5f);
      String before = pstate(player);
      player.a((mask & 1) != 0, (mask & 2) != 0, (mask & 4) != 0);
      line("{\"case\":\"wake\",\"facing\":" + facing + ",\"flags\":[" + ((mask & 1) != 0) + "," + ((mask & 2) != 0) + "," + ((mask & 4) != 0) + "],\"before\":" + before + ",\"after\":" + pstate(player) + ",\"cells\":" + bedCells() + "}");
    }
    // Wake with the bed gone: the spawn search is skipped and the player is placed above the old location.
    for (int mask : new int[] {0, 7}) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(0); skylight(11);
      aji.e(BED).a(w, X, Y, Z + 1, player, 1, 0.5f, 0.5f, 0.5f);
      w.put(X, Y, Z, 0, 0); w.put(X, Y, Z + 1, 0, 0);
      player.a((mask & 1) != 0, (mask & 2) != 0, (mask & 4) != 0);
      line("{\"case\":\"wake\",\"facing\":0,\"bedGone\":true,\"flags\":[" + ((mask & 1) != 0) + "," + ((mask & 2) != 0) + "," + ((mask & 4) != 0) + "],\"after\":" + pstate(player) + "}");
    }
    // Per-tick sleep timer (EntityPlayer.onUpdate, replayed with the original isInBed (yz.j) and World.isDaytime):
    // sleeping: ++timer capped at 100; if not in a bed wake(true, true, false); else if daytime wake(false, true, true).
    // Not sleeping with a timer > 0: ++timer, reset to 0 at 110.
    Method inBed = MobMoveProbe.method(yz.class, "j");
    for (int daytime = 0; daytime < 2; daytime++) for (int bedPresent = 0; bedPresent < 2; bedPresent++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z - 1.5);
      putBed(0); skylight(11);
      aji.e(BED).a(w, X, Y, Z + 1, player, 1, 0.5f, 0.5f, 0.5f);
      List<String> rows = new ArrayList<>();
      for (int tick = 0; tick < 130; tick++) {
        if (tick == 105) skylight(daytime == 1 ? 0 : 11);
        if (tick == 110 && bedPresent == 0) { w.put(X, Y, Z, 0, 0); w.put(X, Y, Z + 1, 0, 0); }
        int timer = MobMoveProbe.field(yz.class, "b").getInt(player);
        if (player.bm()) {
          timer++; if (timer > 100) timer = 100;
          MobMoveProbe.field(yz.class, "b").setInt(player, timer);
          if (!(boolean) inBed.invoke(player)) player.a(true, true, false);
          else if (w.w()) player.a(false, true, true);
        } else if (timer > 0) {
          timer++; if (timer >= 110) timer = 0;
          MobMoveProbe.field(yz.class, "b").setInt(player, timer);
        }
        rows.add("[" + tick + "," + player.bm() + "," + MobMoveProbe.field(yz.class, "b").getInt(player) + "," + player.bL() + "]");
      }
      line("{\"case\":\"tick\",\"daytime\":" + (daytime == 1) + ",\"bedPresent\":" + (bedPresent == 1) + ",\"rows\":" + join(rows) + ",\"after\":" + pstate(player) + "}");
    }
  }

  // ---- bed spawn search and respawn verification ----
  static void spawns() throws Exception {
    int[][] kinds = {{0, 0}, {1, 0}, {8, 0}, {10, 0}, {20, 0}, {44, 0}, {54, 2}, {85, 0}, {95, 0}, {78, 3}, {51, 0}, {26, 0}, {65, 2}, {31, 1}, {64, 0}, {111, 0}};
    for (int facing = 0; facing < 4; facing++) {
      // Open ground: indexes 0..12 of the search order, plus the block row above the 3x3 / 3x4 neighbourhood.
      w = world();
      for (int dx = -4; dx <= 4; dx++) for (int dz = -4; dz <= 4; dz++) w.put(X + dx, Y - 1, Z + dz, 1, 0);
      putBed(facing);
      List<String> rows = new ArrayList<>();
      for (int idx = 0; idx < 14; idx++) { r c = ajh.a(w, X, Y, Z, idx); rows.add(c == null ? "null" : "[" + c.a + "," + c.b + "," + c.c + "]"); }
      line("{\"case\":\"spawn\",\"kind\":\"open\",\"facing\":" + facing + ",\"cells\":" + join(rows) + "}");
      // Obstruct each of the 12 neighbouring cells in turn (below with air, at the foot level, at the head level) with every kind.
      for (int[] k : kinds) for (int level = -1; level <= 1; level++) {
        w = world();
        for (int dx = -4; dx <= 4; dx++) for (int dz = -4; dz <= 4; dz++) w.put(X + dx, Y - 1, Z + dz, 1, 0);
        putBed(facing);
        int hx = X + DIR[facing][0], hz = Z + DIR[facing][1];
        // Obstruct a rotating handful of cells around the foot: the cell whose offset index is facing + level + 2.
        for (int dx = -1; dx <= 1; dx++) for (int dz = -1; dz <= 1; dz++) {
          int x = X + dx, z = Z + dz;
          if ((x == X && z == Z) || (x == hx && z == hz)) continue;
          if (Math.floorMod(dx * 3 + dz + facing, 4) != Math.floorMod(level + 1, 4)) continue;
          if (level == -1) w.put(x, Y - 1, z, k[0], k[1]); else w.put(x, Y + level, z, k[0], k[1]);
        }
        List<String> r2 = new ArrayList<>();
        for (int idx = 0; idx < 3; idx++) { r c = ajh.a(w, X, Y, Z, idx); r2.add(c == null ? "null" : "[" + c.a + "," + c.b + "," + c.c + "]"); }
        line("{\"case\":\"spawn\",\"kind\":\"block\",\"facing\":" + facing + ",\"block\":" + k[0] + ",\"meta\":" + k[1] + ",\"level\":" + level + ",\"cells\":" + join(r2) + "}");
      }
    }
    // EntityPlayer.verifyRespawnCoordinates(world, coords, forced): bed present => spawn search index 0; otherwise only when forced
    // and both cells are non-solid and non-liquid.
    int[][] cellKinds = {{0, 0}, {1, 0}, {8, 0}, {10, 0}, {20, 0}, {44, 0}, {85, 0}, {78, 3}, {51, 0}, {26, 0}, {26, 8}, {31, 1}, {64, 0}, {111, 0}, {70, 0}};
    for (int forced = 0; forced < 2; forced++) for (int[] a : cellKinds) for (int[] b : cellKinds) {
      w = world();
      w.put(X, Y - 1, Z, 1, 0);
      w.put(X, Y, Z, a[0], a[1]); w.put(X, Y + 1, Z, b[0], b[1]);
      r c = yz.a(w, new r(X, Y, Z), forced == 1);
      line("{\"case\":\"verify\",\"forced\":" + (forced == 1) + ",\"a\":[" + a[0] + "," + a[1] + "],\"b\":[" + b[0] + "," + b[1] + "],\"result\":" + (c == null ? "null" : "[" + c.a + "," + c.b + "," + c.c + "]") + "}");
    }
    for (int facing = 0; facing < 4; facing++) for (int forced = 0; forced < 2; forced++) for (int blocked = 0; blocked < 3; blocked++) {
      w = world();
      for (int dx = -4; dx <= 4; dx++) for (int dz = -4; dz <= 4; dz++) w.put(X + dx, Y - 1, Z + dz, 1, 0);
      putBed(facing);
      if (blocked == 1) // every neighbour cell filled: no spawn cell
        for (int dx = -2; dx <= 2; dx++) for (int dz = -2; dz <= 2; dz++) { if (w.a(X + dx, Y, Z + dz) == aji.e(0)) w.put(X + dx, Y, Z + dz, 1, 0); }
      if (blocked == 2) // bed head only (foot removed)
        w.put(X, Y, Z, 0, 0);
      r c = yz.a(w, new r(X + (blocked == 2 ? DIR[facing][0] : 0), Y, Z + (blocked == 2 ? DIR[facing][1] : 0)), forced == 1);
      line("{\"case\":\"verify\",\"kind\":\"bed\",\"facing\":" + facing + ",\"forced\":" + (forced == 1) + ",\"blocked\":" + blocked + ",\"result\":" + (c == null ? "null" : "[" + c.a + "," + c.b + "," + c.c + "]") + "}");
    }
  }

  // ---- World.isDaytime over the real calculateSkylightSubtracted ----
  static void daytime() throws Exception {
    w = world();
    Object info = MobMoveProbe.field(ahb.class, "x").get(w);
    List<String> rows = new ArrayList<>();
    for (long t = 0; t < 24000; t += (t % 1000 >= 500 && (t / 1000 == 12 || t / 1000 == 13 || t / 1000 == 22 || t / 1000 == 23 || t / 1000 == 0 || t / 1000 == 1)) ? 10 : 100) {
      ((ays) info).c(t);
      int sub = w.a(1.0f);
      MobMoveProbe.field(ahb.class, "j").setInt(w, sub);
      rows.add("[" + t + "," + sub + "," + w.w() + "]");
    }
    line("{\"case\":\"daytime\",\"rows\":" + join(rows) + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    facts();
    placements();
    neighbours();
    breaks();
    activations();
    wakes();
    spawns();
    daytime();
  }
}
