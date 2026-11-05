import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 signs from the unchanged original classes: BlockSign (ank, standing_sign 63 and wall_sign 68),
// ItemSign (adz, item 323), TileEntitySign (apm, tile id "Sign") and ChatAllowedCharacters (t). The world is BedProbe.BW
// (map-backed, original neighbour-notification order) extended with the tile-entity map a Chunk keeps (a BlockContainer
// creates its tile on setBlock and removes it in breakBlock). The player records EntityPlayer.func_146100_a, which is what
// opens GuiEditSign. Records: facts, item, shape (bounds/selection/collision per metadata), place, neighbour, remove,
// nbt, chars. Client-only GuiEditSign / ModelSign / TileEntitySignRenderer are checked by tools/verify-signs.mjs through javap.
public class SignProbe {
  static final int X = 8, Y = 64, Z = 8;
  static final int STANDING = 63, WALL = 68;

  public static class SW extends BedProbe.BW {
    Map<Long, aor> tiles = new HashMap<>();
    public aor o(int x, int y, int z) { return tiles.get(key(x, y, z)); }
    public void a(int x, int y, int z, aor t) {
      try {
        t.a((ahb) this);
        MobMoveProbe.field(aor.class, "c").setInt(t, x);
        MobMoveProbe.field(aor.class, "d").setInt(t, y);
        MobMoveProbe.field(aor.class, "e").setInt(t, z);
      } catch (Exception e) { throw new RuntimeException(e); }
      tiles.put(key(x, y, z), t);
    }
    public void p(int x, int y, int z) { tiles.remove(key(x, y, z)); }
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
      boolean r = super.d(x, y, z, b, meta, flags);
      if (r && b instanceof akw && tiles.get(key(x, y, z)) == null) a(x, y, z, ((akw) b).a((ahb) this, meta));
      return r;
    }
  }

  public static class SP extends BedProbe.Player {
    List<apm> opened = new ArrayList<>();
    public void a(aor t) { if (t instanceof apm) opened.add((apm) t); }
  }

  // Rails (27, 28, 66, 157) re-notify each other without end in this world double, so they are not used as supports.
  static final Set<Integer> RAILS = new HashSet<>(Arrays.asList(27, 28, 66, 157, 39, 40, 64, 71, 26));
  static SW w;
  static SP player;

  static void line(String s) { System.out.println(s); }
  static String num(double d) { return DoorPaneProbe.num(d); }
  static String join(List<String> l) { return DoorPaneProbe.join(l); }
  static String js(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : s.toCharArray()) {
      if (c == '"') b.append("\\\""); else if (c == '\\') b.append("\\\\"); else if (c < 32 || c > 126) b.append(String.format("\\u%04x", (int) c)); else b.append(c);
    }
    return b.append("\"").toString();
  }
  static String cells(int[][] pos) { return DoorPaneProbe.cellsJson(w, pos); }
  static String drops() { return DoorPaneProbe.drops(w); }

  static SW world() throws Exception {
    SW b = (SW) PlantProbe.unsafe.allocateInstance(SW.class);
    MobMoveProbe.set(b, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(b, "s", new Random(2));
    MobMoveProbe.set(b, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(b, PlantProbe.unsafe.allocateInstance(ays.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(b, false);
    MobMoveProbe.set(b, "h", new ArrayList());
    MobMoveProbe.set(b, "u", new ArrayList());
    MobMoveProbe.set(b, "v", BedProbe.chunkProvider());
    b.cells = new HashMap<>();
    b.spawned = new ArrayList<>();
    b.scheduled = new ArrayList<>();
    b.sets = new ArrayList<>();
    b.log = new ArrayList<>();
    b.power = new HashSet<>();
    b.mobs = new ArrayList<>();
    b.tiles = new HashMap<>();
    b.base = (x, y, z) -> new int[] {y < 0 ? 1 : 0, 0};
    BedProbe.w = b;
    return b;
  }

  static SP makePlayer(double x, double y, double z) throws Exception {
    SP p = (SP) PlantProbe.unsafe.allocateInstance(SP.class);
    MobMoveProbe.set(p, "o", w); MobMoveProbe.set(p, "Z", new Random(0)); MobMoveProbe.set(p, "C", azt.a(0, 0, 0, 0, 0, 0));
    te watcher = new te(p); MobMoveProbe.set(p, "af", watcher);
    watcher.a(0, Byte.valueOf((byte) 0)); watcher.a(1, Short.valueOf((short) 300));
    MobMoveProbe.method(yz.class, "c").invoke(p);
    MobMoveProbe.field(sv.class, "f").set(p, new HashMap());
    MobMoveProbe.set(p, "bE", new yw());
    MobMoveProbe.set(p, "bm", new yx(p));
    MobMoveProbe.method(yz.class, "aD").invoke(p);
    p.g(20.0f);
    p.msgs = new ArrayList<>();
    p.opened = new ArrayList<>();
    MobMoveProbe.method(sa.class, "a", float.class, float.class).invoke(p, 0.6f, 1.8f);
    MobMoveProbe.field(sa.class, "L").setFloat(p, 1.62f);
    p.b(x, y, z);
    ((List) MobMoveProbe.field(ahb.class, "h").get(w)).add(p);
    return p;
  }

  static String tileJson(apm t) throws Exception {
    if (t == null) return "null";
    List<String> l = new ArrayList<>();
    for (String s : t.a) l.add(js(s));
    return "{\"text\":" + join(l) + ",\"editable\":" + t.a() + ",\"editor\":" + (t.b() != null) + ",\"lineBeingEdited\":" + t.i + "}";
  }
  static String tileAt(int x, int y, int z) throws Exception { return tileJson((apm) w.o(x, y, z)); }
  static String sets() {
    List<String> l = new ArrayList<>();
    for (int[] s : w.sets) l.add("[" + s[0] + "," + s[1] + "," + s[2] + "," + s[3] + "," + s[4] + "," + s[5] + "]");
    return join(l);
  }

  static void facts() throws Exception {
    for (int id : new int[] {STANDING, WALL}) {
      aji b = aji.e(id);
      w = world(); w.put(X, Y, Z, id, 0);
      List<String> d = new ArrayList<>(), pick = new ArrayList<>();
      for (int m = 0; m < 16; m++) {
        adb it = b.a(m, new Random(1), 0);
        d.add(it == null ? "null" : "[" + adb.b(it) + "," + b.a(m) + "," + b.a(new Random(1)) + "]");
      }
      for (int m : new int[] {0, 5, 15}) { w = world(); w.put(X, Y, Z, id, m); adb it = b.d(w, X, Y, Z); pick.add(it == null ? "null" : String.valueOf(adb.b(it))); }
      List<String> speeds = new ArrayList<>(), harvest = new ArrayList<>();
      for (int t : new int[] {0, 268, 269, 270, 271, 272, 273, 274, 275, 276, 277, 278, 279, 256, 257, 258, 359}) {
        adb item = t == 0 ? null : adb.d(t);
        if (item == null) { speeds.add("[0,1]"); harvest.add("[0," + b.o().l() + "]"); continue; }
        speeds.add("[" + t + "," + num(item.a(new add(item), b)) + "]");
        harvest.add("[" + t + "," + (b.o().l() || item.b(b)) + "]");
      }
      ajm snd = (ajm) MobMoveProbe.field(aji.class, "H").get(b);
      w = world(); w.put(X, Y, Z, id, 0);
      line("{\"case\":\"facts\",\"id\":" + id + ",\"class\":" + js(b.getClass().getName()) + ",\"hardness\":" + num(b.f(w, X, Y, Z)) + ",\"resistance\":" + num(b.a((sa) null))
        + ",\"material\":" + js(DoorPaneProbe.material(b.o())) + ",\"materialOpaque\":" + b.o().k() + ",\"blocksMovement\":" + b.o().c() + ",\"requiresTool\":" + !b.o().l()
        + ",\"opaque\":" + b.c() + ",\"renderNormal\":" + b.d() + ",\"normalCube\":" + b.r() + ",\"lightOpacity\":" + b.k() + ",\"light\":" + b.m() + ",\"render\":" + b.b()
        + ",\"sound\":[" + js(snd.a) + "," + num(snd.b) + "," + num(snd.c) + "],\"mobility\":" + b.h() + ",\"tab\":" + (b.J() == null ? "null" : String.valueOf(b.J().a()))
        + ",\"hasTile\":" + (b instanceof akw) + ",\"drops\":" + join(d) + ",\"pick\":" + join(pick) + ",\"speeds\":" + join(speeds) + ",\"harvest\":" + join(harvest) + "}");
    }
    adb item = ade.ap;
    line("{\"case\":\"item\",\"id\":" + adb.b(item) + ",\"class\":" + js(item.getClass().getName()) + ",\"stackLimit\":" + MobMoveProbe.field(adb.class, "h").getInt(item) + ",\"tab\":" + (item.n_() == null ? "null" : String.valueOf(item.n_().a())) + "}");
  }

  static void shapes() throws Exception {
    for (int id : new int[] {STANDING, WALL}) for (int m = 0; m < 16; m++) {
      w = world(); w.put(X, Y, Z, id, m);
      aji b = aji.e(id);
      line("{\"case\":\"shape\",\"id\":" + id + ",\"meta\":" + m + "," + DoorPaneProbe.shapeJson(b, w, X, Y, Z) + "}");
    }
  }

  // ---- ItemSign.onItemUse ----
  static String place(float yaw, int side, int px, int py, int pz, int count) throws Exception {
    MobMoveProbe.set(player, "y", yaw);
    add st = new add(ade.ap, count);
    boolean r = ade.ap.a(st, player, w, px, py, pz, side, 0.5f, 1.0f, 0.5f);
    return "\"result\":" + r + ",\"stack\":" + st.b + ",\"sets\":" + sets() + ",\"opened\":" + player.opened.size();
  }
  static int[][] around() {
    int[][] p = new int[7][];
    int[][] d = {{0, 0, 0}, {1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}};
    for (int i = 0; i < 7; i++) p[i] = new int[] {X + d[i][0], Y + d[i][1], Z + d[i][2]};
    return p;
  }
  static String placeLine(String kind, String extra, float yaw, int side, int px, int py, int pz, int count) throws Exception {
    String r = place(yaw, side, px, py, pz, count);
    int[] tx = {px, py, pz};
    // The tile that appeared, wherever the sign went (the clicked cell offset by the side).
    int[][] off = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
    int cx = px + off[side][0], cy = py + off[side][1], cz = pz + off[side][2];
    return "{\"case\":\"place\",\"kind\":\"" + kind + "\"," + extra + "\"yaw\":" + num(yaw) + ",\"side\":" + side + "," + r + ",\"cells\":" + cells(new int[][] {{cx, cy, cz}, {px, py, pz}}) + ",\"tile\":" + tileAt(cx, cy, cz) + "}";
  }

  static void placements() throws Exception {
    float[] yaws = new float[33 + 14];
    int n = 0;
    for (int k = -16; k <= 16; k++) yaws[n++] = k * 22.5f;
    for (float y : new float[] {11.24f, 11.25f, 11.26f, 33.74f, 33.75f, 33.76f, -11.26f, -11.25f, -11.24f, 0.01f, 89.99f, 359.9f, 360f, 720.5f}) yaws[n++] = y;
    for (float yaw : yaws) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 1, Z, 1, 0);
      line(placeLine("yaw", "", yaw, 1, X, Y - 1, Z, 16));
    }
    for (int side = 0; side < 6; side++) for (float yaw : new float[] {0f, 123.4f}) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y, Z, 1, 0);
      line(placeLine("side", "", yaw, side, X, Y, Z, 16));
    }
    // The clicked block's material must be solid (Material.isSolid); every registered block as the clicked one, top face and a side.
    for (int id = 1; id <= 175; id++) {
      if ((id >= 165 && id <= 169) || RAILS.contains(id)) continue;
      for (int side : new int[] {1, 3}) {
        w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
        w.put(X, Y, Z, id, 0);
        line(placeLine("support", "\"block\":" + id + ",", 0f, side, X, Y, Z, 16));
      }
    }
    // Occupancy of the target cell: Block.canPlaceBlockAt = the cell's Material.isReplaceable.
    int[][] occ = {{0, 0}, {1, 0}, {8, 0}, {9, 0}, {10, 0}, {11, 0}, {31, 1}, {31, 2}, {31, 0}, {32, 0}, {37, 0}, {38, 0}, {50, 1}, {51, 0}, {78, 0}, {78, 3}, {106, 0}, {20, 0}, {6, 0}, {55, 0}, {65, 2}, {66, 0}, {70, 0}, {175, 2}, {83, 0}, {59, 0}, {63, 0}, {68, 2}, {64, 0}, {26, 0}, {54, 2}, {77, 1}, {69, 5}, {72, 0}};
    for (int[] bm : occ) for (int side : new int[] {1, 3}) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y - 1, Z, 1, 0); w.put(X, Y, Z, 1, 0);
      int[] off = side == 1 ? new int[] {0, 1, 0} : new int[] {0, 0, 1};
      w.put(X + off[0], Y + off[1], Z + off[2], bm[0], bm[1]);
      line(placeLine("occupied", "\"block\":" + bm[0] + ",\"meta\":" + bm[1] + ",", 0f, side, X, Y, Z, 16));
    }
    for (int y = 253; y <= 255; y++) for (int side : new int[] {1, 3}) {
      w = world(); player = makePlayer(X + 0.5, y + 1.62, Z + 0.5);
      w.put(X, y, Z, 1, 0);
      line(placeLine("height", "\"y\":" + y + ",", 0f, side, X, y, Z, 16));
    }
    for (int count : new int[] {1, 2, 16}) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y, Z, 1, 0);
      line(placeLine("count", "\"count\":" + count + ",", 0f, 1, X, Y, Z, count));
    }
    for (int build = 0; build < 2; build++) for (int side : new int[] {1, 3}) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      ((yw) MobMoveProbe.field(yz.class, "bE").get(player)).e = build == 1;
      w.put(X, Y, Z, 1, 0);
      line(placeLine("edit", "\"mayBuild\":" + (build == 1) + ",", 0f, side, X, Y, Z, 16));
    }
  }

  // ---- BlockSign.onNeighborBlockChange ----
  static void neighbours() throws Exception {
    // Standing sign: the block below must have a solid material (isSolid), whatever the rotation.
    for (int below = 0; below <= 175; below++) {
      if ((below >= 165 && below <= 169) || RAILS.contains(below)) continue;
      for (int meta : new int[] {0, 7, 15}) {
        w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
        w.put(X, Y - 1, Z, below, 0);
        w.put(X, Y, Z, STANDING, meta);
        try { aji.e(STANDING).a(w, X, Y, Z, aji.e(0)); } catch (StackOverflowError | NullPointerException e) { continue; }
        line("{\"case\":\"neighbour\",\"kind\":\"standing\",\"below\":" + below + ",\"meta\":" + meta + ",\"cells\":" + cells(new int[][] {{X, Y, Z}}) + ",\"drops\":" + drops() + "}");
      }
    }
    // Wall sign: only the support block on the side its metadata names matters (2: +z, 3: -z, 4: +x, 5: -x); 0, 1 and 6+ always pop.
    int[][] sup = {{0, 0, 1}, {0, 0, -1}, {0, 0, 0}, {0, 0, 0}};
    int[][] sideOff = {{0, 1}, {0, -1}, {1, 0}, {-1, 0}};
    for (int meta : new int[] {0, 1, 2, 3, 4, 5, 6, 9, 15}) {
      for (int support : new int[] {0, 1, 8, 20, 9, 78, 44, 66, 106, 54, 85, 101, 79, 95, 50, 31}) {
        for (int where = 0; where < 4; where++) {
          // `where` picks which of the four horizontal neighbours holds the support; the others are stone.
          w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
          for (int k = 0; k < 4; k++) w.put(X + sideOff[k][0], Y, Z + sideOff[k][1], k == where ? support : 1, 0);
          w.put(X, Y - 1, Z, 1, 0);
          w.put(X, Y, Z, WALL, meta);
          aji.e(WALL).a(w, X, Y, Z, aji.e(0));
          line("{\"case\":\"neighbour\",\"kind\":\"wall\",\"meta\":" + meta + ",\"support\":" + support + ",\"where\":" + where + ",\"cells\":" + cells(new int[][] {{X, Y, Z}}) + ",\"drops\":" + drops() + "}");
        }
      }
    }
  }

  // ---- placing a sign and removing its support through the real notification path ----
  static void removals() throws Exception {
    for (int side = 1; side <= 5; side++) for (int variant = 0; variant < 3; variant++) {
      w = world(); player = makePlayer(X + 0.5, Y + 1.62, Z + 0.5);
      w.put(X, Y, Z, 1, 0);
      int[][] off = {{0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}, {-1, 0, 0}, {1, 0, 0}};
      int cx = X + off[side][0], cy = Y + off[side][1], cz = Z + off[side][2];
      String r = place(60f, side, X, Y, Z, 16);
      w.log.clear(); w.spawned.clear();
      if (variant == 0) w.f(X, Y, Z);                 // remove the supporting block
      else if (variant == 1) w.f(cx, cy, cz);         // remove the sign itself
      else w.d(X, Y, Z, aji.e(20), 0, 3);             // replace the support by glass (still solid)
      line("{\"case\":\"remove\",\"side\":" + side + ",\"variant\":" + variant + ",\"place\":{" + r + "},\"cells\":" + cells(new int[][] {{cx, cy, cz}, {X, Y, Z}}) + ",\"tile\":" + tileAt(cx, cy, cz) + ",\"drops\":" + drops() + "}");
    }
  }

  // ---- TileEntitySign NBT ----
  static String nbtLine(String name, String[] lines, boolean viaTile) throws Exception {
    w = world();
    apm t = new apm();
    for (int i = 0; i < 4; i++) t.a[i] = lines[i];
    MobMoveProbe.field(aor.class, "c").setInt(t, 3); MobMoveProbe.field(aor.class, "d").setInt(t, 70); MobMoveProbe.field(aor.class, "e").setInt(t, -5);
    dh tag = new dh();
    t.b(tag);
    String written = tag.toString();
    List<String> keys = new ArrayList<>(new TreeSet<String>((Set<String>) MobMoveProbe.method(dh.class, "c").invoke(tag)));
    List<String> ks = new ArrayList<>();
    for (String k : keys) ks.add(js(k));
    // Round trip through TileEntity.createAndLoadEntity and readFromNBT.
    aor back = aor.c(tag);
    String rt = back instanceof apm ? tileJson((apm) back) : "null";
    // A hand-built tag with over-long lines: readFromNBT cuts each to 15 characters.
    dh raw = new dh();
    raw.a("id", "Sign"); raw.a("x", 1); raw.a("y", 2); raw.a("z", 3);
    for (int i = 0; i < 4; i++) raw.a("Text" + (i + 1), lines[i]);
    aor read = aor.c(raw);
    List<String> text = new ArrayList<>();
    for (String s : ((apm) read).a) text.add(js(s));
    return "{\"case\":\"nbt\",\"name\":" + js(name) + ",\"lines\":" + linesJson(lines) + ",\"written\":" + js(written) + ",\"keys\":" + join(ks) + ",\"roundTrip\":" + rt
      + ",\"read\":" + join(text) + ",\"readEditable\":" + ((apm) read).a() + ",\"x\":" + MobMoveProbe.field(aor.class, "c").getInt(read) + "}";
  }
  static String linesJson(String[] l) { List<String> o = new ArrayList<>(); for (String s : l) o.add(js(s)); return join(o); }

  static void nbts() throws Exception {
    String[][] sets = {
      {"", "", "", ""}, {"Hello", "World", "", "!"}, {"123456789012345", "abcdefghijklmno", "", ""},
      {"1234567890123456", "abcdefghijklmnop", "this line is far too long to fit", "x"},
      {"§aGreen", "§lBold", "café üñ", "あいう"}, {"a\"b\\c", "tab\there", "new\nline", "\u007f del"}};
    int i = 0;
    for (String[] s : sets) line(nbtLine("set" + i++, s, true));
    // A fresh tile: text, editable flag, no editor.
    apm fresh = new apm();
    line("{\"case\":\"tile\",\"fresh\":" + tileJson(fresh) + ",\"packet\":" + (fresh.m() != null) + "}");
  }

  // ---- ChatAllowedCharacters.isAllowedCharacter over every char ----
  static void chars() throws Exception {
    List<String> denied = new ArrayList<>();
    StringBuilder bits = new StringBuilder();
    for (int c = 0; c < 65536; c++) {
      boolean ok = t.a((char) c);
      bits.append(ok ? '1' : '0');
      if (!ok) denied.add(String.valueOf(c));
    }
    line("{\"case\":\"chars\",\"count\":65536,\"denied\":" + join(denied) + ",\"sha256\":" + js(PlantProbe.sha(bits.toString())) + ",\"allowedCount\":" + (65536 - denied.size()) + "}");
    // ChatAllowedCharacters.filterAllowedCharacters on sample strings (the paste path).
    String[] samples = {"plain", "a§b", "tab\tx", "del\u007fy", "café", "あ い", "new\nline", "", "\u0000x\u001fy"};
    List<String> f = new ArrayList<>();
    for (String s : samples) f.add("[" + js(s) + "," + js(t.a(s)) + "]");
    line("{\"case\":\"filter\",\"samples\":" + join(f) + ",\"disallowedChars\":" + new String(t.a).length() + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    facts();
    shapes();
    placements();
    neighbours();
    removals();
    nbts();
    chars();
  }
}
