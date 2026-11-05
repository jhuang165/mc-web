// Drives the unchanged original BlockChest (ajx, type 0 = chest 54, type 1 = trapped chest 146) with TileEntityChest (aow),
// BlockEnderChest (akv, 130) with TileEntityEnderChest (ape) and InventoryEnderChest (aav) inside the RedstoneProbe World/Chunk
// fixture (as HopperProbe does). One JSON line per record on stdout:
//   facts     block class/hardness/resistance/light/opacity/drops/silk/comparator, tile-entity interfaces
//   pair      random placements of chests and trapped chests beside stone and cover blocks: canPlaceBlockAt, the
//             metadata after BlockChest.onBlockAdded/onBlockPlacedBy, TileEntityChest adjacency flags, and
//             BlockChest.func_149951_m (the opened inventory: size and name, or null when the lid is blocked)
//   power     trapped chest viewer counts 0..17: weak/strong power per side (Block), World.getStrongestIndirectPower style
//             queries, power into the block below, the neighbour notifications of open/close
//   ender     BlockEnderChest.onBlockActivated refusal with each cover block, the user count and the opened inventory
//   enderNbt  InventoryEnderChest.loadInventoryFromNBT / saveInventoryToNBT round trips
//   lid       TileEntityChest / TileEntityEnderChest.updateEntity lid steps and sounds for scripted user counts
//   display   BlockEnderChest.randomDisplayTick portal particle arguments for a seeded Random
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

public class ChestsProbe {
  static class C extends RedstoneProbe.W {
    List<String> particles = new ArrayList<>();
    public void a(sa e, String name, float volume, float pitch) {}
    public boolean d(sa e) { return true; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {
      particles.add("[\"" + name + "\"," + x + "," + y + "," + z + "," + vx + "," + vy + "," + vz + "]");
    }
  }
  static C world(long seed) throws Exception {
    C w = (C) RedstoneProbe.unsafe.allocateInstance(C.class);
    RedstoneProbe.Provider provider = new RedstoneProbe.Provider(); provider.g = false;
    RedstoneProbe.field(ahb.class, "t").set(w, provider);
    RedstoneProbe.field(ahb.class, "j").setInt(w, 0);
    RedstoneProbe.field(ahb.class, "s").set(w, new Random(seed));
    RedstoneProbe.field(ahb.class, "u").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "C").set(w, new qi());
    RedstoneProbe.field(ahb.class, "v").set(w, new RedstoneProbe.Chunks(w));
    RedstoneProbe.field(ahb.class, "a").set(w, new ArrayList());
    RedstoneProbe.field(ahb.class, "g").set(w, new ArrayList());
    w.particles = new ArrayList<>();
    w.sky = 15; w.angle = 0f;
    w.rules = new agy(); w.log = new StringBuilder(); w.sounds = new ArrayList<>(); w.drops = new ArrayList<>(); w.ents = new ArrayList<>();
    w.M = new HashSet<>(); w.N = new TreeSet<>(); w.V = new ArrayList<>();
    return w;
  }
  public static class Player extends yz {
    Player() { super(null, null); }
    public r f_() { return null; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    aav ender; rb shown;
    public aav bS() { return ender; }
    public void a(rb inventory) { shown = inventory; }
  }
  static String q(String s) { return "\"" + s + "\""; }
  static String doubles(double[] v) { StringBuilder b = new StringBuilder("["); for (int i = 0; i < v.length; i++) b.append(i > 0 ? "," : "").append(v[i]); return b.append("]").toString(); }
  static String bounds(aji b) { return "[" + b.B + "," + b.C + "," + b.D + "," + b.E + "," + b.F + "," + b.G + "]"; }
  static Field f(Class<?> c, String n) throws Exception { return RedstoneProbe.field(c, n); }
  // Block ids (original) usable as cover or terrain: stone, glass, leaves, TNT, fence, slab, ice, chest.
  static final int[] COVERS = {0, 1, 20, 18, 46, 85, 44, 79, 54, 146, 130};

  static void facts(PrintStream out) throws Exception {
    StringBuilder rows = new StringBuilder();
    C w = world(0);
    for (int id : new int[] {54, 146, 130, 50, 1}) {
      aji b = aji.e(id);
      w.raw(0, 1, 0, b, 0);
      boolean silk = false; try { Method m = aji.class.getDeclaredMethod("E"); m.setAccessible(true); silk = (Boolean) m.invoke(b); } catch (Exception e) {}
      Random r = new Random(1);
      adb drop = b.a(0, r, 0);
      rows.append(rows.length() > 0 ? "," : "").append("{\"id\":" + id + ",\"class\":" + q(b.getClass().getName()) + ",\"hardness\":" + b.f((ahb) w, 0, 1, 0) + ",\"resistance\":" + b.w
        + ",\"light\":" + b.m() + ",\"opacity\":" + b.k() + ",\"opaque\":" + (b.c() ? 1 : 0) + ",\"normal\":" + (b.r() ? 1 : 0) + ",\"renderAsNormal\":" + (b.d() ? 1 : 0)
        + ",\"renderType\":" + b.b() + ",\"comparator\":" + (b.M() ? 1 : 0) + ",\"canProvidePower\":" + (b.f() ? 1 : 0) + ",\"silk\":" + (silk ? 1 : 0)
        + ",\"dropItem\":" + (drop == null ? -1 : adb.b(drop)) + ",\"dropCount\":" + b.a(new Random(1)) + ",\"bounds\":" + bounds(b)
        + ",\"material\":" + q(b.o().getClass().getName() + ":" + System.identityHashCode(b.o()) * 0) + "}");
    }
    boolean chestInv = rb.class.isAssignableFrom(aow.class), enderInv = rb.class.isAssignableFrom(ape.class);
    aji trapped = aji.e(146), normal = aji.e(54);
    out.println("{\"kind\":\"facts\",\"blocks\":[" + rows + "],\"chestIsInventory\":" + chestInv + ",\"enderTileIsInventory\":" + enderInv
      + ",\"enderSize\":" + new aav().a() + ",\"enderName\":" + q(new aav().b()) + ",\"trappedType\":" + ((ajx) trapped).a + ",\"normalType\":" + ((ajx) normal).a + "}");
  }

  // ---- placement / pairing / opening ----
  static final Random picks = new Random(710);
  static void pair(PrintStream out, int index) throws Exception {
    C w = world(index + 1);
    List<int[]> stones = new ArrayList<>(), covers = new ArrayList<>(), placements = new ArrayList<>();
    int y = 2;
    for (int dz = -2; dz <= 2; dz++) for (int dx = -2; dx <= 2; dx++) {
      if (picks.nextInt(100) < 18) { stones.add(new int[] {dx, dz}); w.raw(dx + 8, y, dz + 8, aji.e(1), 0); }
    }
    int n = 1 + picks.nextInt(4);
    StringBuilder result = new StringBuilder();
    List<int[]> cells = new ArrayList<>();
    for (int i = 0; i < n; i++) {
      int dx = picks.nextInt(5) - 2, dz = picks.nextInt(5) - 2, id = picks.nextInt(100) < 55 ? 146 : 54;
      float yaw = picks.nextFloat() * 360f - 180f;
      boolean taken = false; for (int[] c : cells) if (c[0] == dx && c[1] == dz) taken = true;
      for (int[] s : stones) if (s[0] == dx && s[1] == dz) taken = true;
      if (taken) { i--; if (picks.nextInt(8) == 0) n--; continue; }
      aji b = aji.e(id);
      boolean can = b.c((ahb) w, dx + 8, y, dz + 8);
      placements.add(new int[] {dx, dz, id, Float.floatToIntBits(yaw), can ? 1 : 0});
      if (!can) continue;
      w.d(dx + 8, y, dz + 8, b, 0, 3);
      Player p = (Player) RedstoneProbe.unsafe.allocateInstance(Player.class);
      f(sa.class, "y").setFloat(p, yaw);
      b.a((ahb) w, dx + 8, y, dz + 8, (sv) p, new add(b));
      cells.add(new int[] {dx, dz});
    }
    // Cover blocks above some chests, placed after the chests exist (they only matter to func_149951_m).
    List<String> out2 = new ArrayList<>();
    for (int[] c : cells) {
      if (picks.nextInt(100) < 35) {
        int cover = COVERS[picks.nextInt(COVERS.length)];
        covers.add(new int[] {c[0], c[1], cover});
        if (cover != 0) w.raw(c[0] + 8, y + 1, c[1] + 8, aji.e(cover), 0);
      }
    }
    for (int[] c : cells) {
      int x = c[0] + 8, z = c[1] + 8;
      aji b = w.a(x, y, z);
      aow tile = (aow) w.o(x, y, z);
      tile.u(); tile.i();
      rb inv = ((ajx) b).m((ahb) w, x, y, z);
      String name = inv == null ? "null" : q(inv.b()), size = inv == null ? "-1" : String.valueOf(inv.a());
      result.append(result.length() > 0 ? "," : "").append("{\"x\":" + c[0] + ",\"z\":" + c[1] + ",\"id\":" + aji.b(b) + ",\"meta\":" + w.e(x, y, z)
        + ",\"adj\":[" + (tile.i != null) + "," + (tile.j != null) + "," + (tile.k != null) + "," + (tile.l != null) + "],\"size\":" + size + ",\"name\":" + name + "}");
    }
    StringBuilder st = new StringBuilder(), pl = new StringBuilder(), cv = new StringBuilder();
    for (int[] s : stones) st.append(st.length() > 0 ? "," : "").append("[" + s[0] + "," + s[1] + "]");
    for (int[] p : placements) pl.append(pl.length() > 0 ? "," : "").append("[" + p[0] + "," + p[1] + "," + p[2] + "," + Float.intBitsToFloat(p[3]) + "," + p[4] + "]");
    for (int[] c : covers) cv.append(cv.length() > 0 ? "," : "").append("[" + c[0] + "," + c[1] + "," + c[2] + "]");
    out.println("{\"kind\":\"pair\",\"stones\":[" + st + "],\"placements\":[" + pl + "],\"covers\":[" + cv + "],\"cells\":[" + result + "]}");
  }

  // ---- trapped chest power ----
  static void power(PrintStream out, int id, int users) throws Exception {
    C w = world(5);
    aji b = aji.e(id);
    w.raw(4, 1, 4, aji.e(1), 0); // stone below
    w.raw(4, 2, 4, b, 2);
    w.raw(4, 3, 4, aji.e(1), 0); // stone above
    aow tile = (aow) w.o(4, 2, 4);
    tile.u();
    w.log.setLength(0);
    for (int i = 0; i < users; i++) tile.f();
    String openLog = w.log.toString();
    StringBuilder weak = new StringBuilder(), strong = new StringBuilder(), indirect = new StringBuilder(), direct = new StringBuilder();
    for (int s = 0; s < 6; s++) {
      weak.append(s > 0 ? "," : "").append(b.b((ahl) w, 4, 2, 4, s));
      strong.append(s > 0 ? "," : "").append(b.c((ahl) w, 4, 2, 4, s));
      indirect.append(s > 0 ? "," : "").append(w.g(4, 2, 4, s));
      direct.append(s > 0 ? "," : "").append(w.e(4, 2, 4, s));
    }
    boolean below = w.v(4, 1, 4), above = w.v(4, 3, 4);
    w.log.setLength(0);
    if (users > 0) tile.l_();
    String closeLog = w.log.toString();
    out.println("{\"kind\":\"power\",\"block\":" + id + ",\"users\":" + users + ",\"weak\":[" + weak + "],\"strong\":[" + strong + "],\"indirect\":[" + indirect
      + "],\"direct\":[" + direct + "],\"belowPowered\":" + below + ",\"abovePowered\":" + above + ",\"openLog\":" + q(openLog) + ",\"closeLog\":" + q(closeLog) + ",\"afterClose\":" + tile.o + "}");
  }

  // ---- ender chest activation ----
  static void ender(PrintStream out, int cover) throws Exception {
    C w = world(9);
    aji b = aji.e(130);
    w.raw(2, 1, 2, b, 3);
    if (cover != 0) w.raw(2, 2, 2, aji.e(cover), 0);
    ape tile = (ape) w.o(2, 1, 2);
    Player p = (Player) RedstoneProbe.unsafe.allocateInstance(Player.class);
    p.ender = new aav();
    boolean r = b.a((ahb) w, 2, 1, 2, (yz) p, 1, 0.5f, 0.5f, 0.5f);
    boolean opened = p.shown != null;
    int users = tile.j;
    if (opened) { p.shown.f(); users = tile.j; p.shown.l_(); }
    out.println("{\"kind\":\"ender\",\"cover\":" + cover + ",\"returned\":" + r + ",\"opened\":" + opened + ",\"usersWhileOpen\":" + users + ",\"usersAfter\":" + tile.j + ",\"title\":" + q(opened ? p.shown.b() : "") + ",\"size\":" + (opened ? p.shown.a() : -1) + "}");
  }

  // ---- ender inventory NBT ----
  static void enderNbt(PrintStream out, String name, int[][] stacks, int[] extraSlots) throws Exception {
    aav inv = new aav();
    for (int[] s : stacks) inv.a(s[0], new add(adb.d(s[1]), s[2], s[3]));
    dq list = inv.h();
    // Add out-of-range / negative slot entries on the way in (loadInventoryFromNBT ignores them).
    for (int slot : extraSlots) { dh t = new dh(); t.a("Slot", (byte) slot); new add(adb.d(1), 1, 0).b(t); list.a(t); }
    aav back = new aav();
    back.a(list);
    dq again = back.h();
    StringBuilder rows = new StringBuilder(), slots = new StringBuilder();
    for (int i = 0; i < again.c(); i++) {
      dh t = again.b(i);
      rows.append(rows.length() > 0 ? "," : "").append("[" + (t.d("Slot") & 255) + "," + t.e("id") + "," + t.d("Count") + "," + t.e("Damage") + "]");
    }
    for (int i = 0; i < back.a(); i++) { add s = back.a(i); slots.append(i > 0 ? "," : "").append(s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "]"); }
    StringBuilder first = new StringBuilder();
    for (int i = 0; i < list.c(); i++) { dh t = list.b(i); first.append(first.length() > 0 ? "," : "").append("[" + (t.d("Slot") & 255) + "," + t.e("id") + "," + t.d("Count") + "," + t.e("Damage") + "]"); }
    StringBuilder in = new StringBuilder();
    for (int[] s : stacks) in.append(in.length() > 0 ? "," : "").append("[" + s[0] + "," + s[1] + "," + s[2] + "," + s[3] + "]");
    StringBuilder extra = new StringBuilder();
    for (int s : extraSlots) extra.append(extra.length() > 0 ? "," : "").append(s);
    out.println("{\"kind\":\"enderNbt\",\"name\":" + q(name) + ",\"stacks\":[" + in + "],\"extraSlots\":[" + extra + "],\"saved\":[" + first + "],\"loaded\":[" + slots + "],\"savedAgain\":[" + rows + "]}");
  }

  // ---- lid ----
  static void lid(PrintStream out, String name, boolean ender, int[][] users) throws Exception {
    C w = world(11);
    aor tile;
    if (ender) { w.raw(3, 1, 3, aji.e(130), 3); tile = w.o(3, 1, 3); } else { w.raw(3, 1, 3, aji.e(146), 3); tile = w.o(3, 1, 3); }
    Field lidField = f(tile.getClass(), ender ? "a" : "m"), prevField = f(tile.getClass(), ender ? "i" : "n"), usersField = f(tile.getClass(), ender ? "j" : "o");
    if (!ender) { ((aow) tile).u(); ((aow) tile).i(); }
    StringBuilder frames = new StringBuilder();
    int ticks = 60;
    for (int t = 1; t <= ticks; t++) {
      for (int[] u : users) if (u[0] == t) usersField.setInt(tile, u[1]);
      w.tick = t;
      w.sounds.clear();
      tile.h();
      StringBuilder snd = new StringBuilder();
      for (String s : w.sounds) snd.append(snd.length() > 0 ? "," : "").append(s);
      frames.append(t > 1 ? "," : "").append("[" + lidField.getFloat(tile) + "," + prevField.getFloat(tile) + ",[" + snd + "]]");
    }
    out.println("{\"kind\":\"lid\",\"name\":" + q(name) + ",\"ender\":" + ender + ",\"users\":" + Arrays.deepToString(users) + ",\"frames\":[" + frames + "]}");
  }

  // ---- display tick ----
  static void display(PrintStream out, long seed, int x, int y, int z, int n) throws Exception {
    C w = world(3);
    aji b = aji.e(130);
    Random r = new Random(seed);
    StringBuilder rows = new StringBuilder();
    for (int i = 0; i < n; i++) {
      w.particles.clear();
      b.b((ahb) w, x, y, z, r);
      rows.append(i > 0 ? "," : "").append("[").append(String.join(",", w.particles)).append("]");
    }
    out.println("{\"kind\":\"display\",\"seed\":\"" + seed + "\",\"cell\":[" + x + "," + y + "," + z + "],\"ticks\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); RedstoneProbe.unsafe = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    PrintStream out = System.out;
    facts(out);
    for (int i = 0; i < 300; i++) pair(out, i);
    for (int id : new int[] {146, 54}) for (int users = 0; users <= 17; users++) power(out, id, users);
    for (int cover : COVERS) ender(out, cover);
    enderNbt(out, "empty", new int[][] {}, new int[] {});
    enderNbt(out, "mixed", new int[][] {{0, 1, 64, 0}, {5, 276, 1, 12}, {26, 49, 7, 0}, {13, 351, 3, 4}}, new int[] {});
    enderNbt(out, "out-of-range-slots", new int[][] {{1, 264, 2, 0}}, new int[] {27, 30, -1, 100});
    lid(out, "single-open-close", false, new int[][] {{3, 1}, {25, 0}});
    lid(out, "two-viewers", false, new int[][] {{3, 1}, {10, 2}, {20, 1}, {35, 0}});
    lid(out, "ender-open-close", true, new int[][] {{3, 1}, {25, 0}});
    lid(out, "ender-interrupt", true, new int[][] {{2, 1}, {8, 0}, {10, 1}, {40, 0}});
    display(out, 1234L, 7, 3, -4, 40);
    display(out, -99L, 0, 64, 0, 40);
  }
}
