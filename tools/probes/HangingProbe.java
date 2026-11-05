import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

// Records the unchanged EntityPainting [tb], EntityItemFrame [st], EntityHanging [ss], EnumArt [tc]
// and ItemHangingEntity [acz]: updateBoundingBox [ss.a(int)] for every art and facing, onValidSurface
// [ss.e] against solid planes with one cell removed, a blocking cell or another hanging entity,
// the painting's art choice [tb.<init>] against wall sizes with a fixed entity Random, onUpdate
// [ss.h] with the 100-tick surface check, attackEntityFrom [ss.a(ro,F), st.a(ro,F)], onBroken
// [tb.b(sa), st.b(sa)], interactFirst [st.c(yz)] with a held stack, writeEntityToNBT/readEntityFromNBT
// [ss.b/a, tb.b/a, st.b/a], and ItemHangingEntity.onItemUse [acz.a] through ItemStack. The world is
// the MinecartProbe.MW double (map-backed World with entity list and recording spawnEntityInWorld).
// Entity.rand [sa.Z] is replaced from the overridden entityInit [c()] that Entity's constructor
// calls, so the real EntityPainting constructor loop uses a seeded Random; no game classes are
// patched. tools/verify-hanging.mjs writes public/research/hanging-reference.json;
// src/hanging.test.js replays it.
public class HangingProbe {
  static long seed = 1;
  static void reseed(sa e) {
    try { PlayerStepProbe.field(sa.class, "Z").set(e, new Random(seed)); }
    catch (Exception x) { throw new RuntimeException(x); }
  }
  public static class P extends tb {
    P(ahb w, int x, int y, int z, int d) { super(w, x, y, z, d); }
    P(ahb w, int x, int y, int z, int d, String m) { super(w, x, y, z, d, m); }
    P(ahb w) { super(w); }
    protected void c() { super.c(); reseed(this); }
  }
  public static class F extends st {
    F(ahb w, int x, int y, int z, int d) { super(w, x, y, z, d); }
    F(ahb w) { super(w); }
    protected void c() { super.c(); reseed(this); }
  }

  static String num(double v) { return NbtProbe.number(v); }
  static String q(String s) { return NbtProbe.quote(s); }

  static String hs(ss h) {
    return "[" + h.a + "," + h.b + "," + h.c + "," + h.d + "," + num(h.s) + "," + num(h.t) + "," + num(h.u) + "," + num(h.y) + "," + num(h.A)
      + "," + num(h.C.a) + "," + num(h.C.b) + "," + num(h.C.c) + "," + num(h.C.d) + "," + num(h.C.e) + "," + num(h.C.f) + "," + h.f() + "," + h.i() + "," + h.K + "]";
  }
  static String stack(add s) {
    if (s == null) return "null";
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + (s.p() ? NbtProbe.tag(s.q()) : "null") + "]";
  }
  static String drop(sa e) throws Exception {
    xk i = (xk) e;
    add s = i.f();
    return "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + num(i.s) + "," + num(i.t) + "," + num(i.u) + ","
      + PlayerStepProbe.field(xk.class, "b").getInt(i) + "," + (s.p() ? NbtProbe.tag(s.q()) : "null") + "]";
  }
  static String drops(MinecartProbe.MW w) throws Exception {
    StringBuilder b = new StringBuilder("[");
    for (sa e : w.spawned) b.append(b.length() > 1 ? "," : "").append(drop(e));
    return b.append("]").toString();
  }
  static String vals(Object... v) {
    StringBuilder b = new StringBuilder("[");
    for (Object o : v) b.append(b.length() > 1 ? "," : "").append(o);
    return b.append("]").toString();
  }

  // Solid plane for facing dir at tile (tx, ty, tz): constant tile coordinate across the normal.
  static List<int[]> plane(int dir, int tx, int ty, int tz) {
    List<int[]> c = new ArrayList<>();
    for (int t = -8; t <= 8; t++)
      for (int y = ty - 8; y <= ty + 8; y++)
        c.add(dir == 0 || dir == 2 ? new int[] {tx + t, y, tz, 1, 0} : new int[] {tx, y, tz + t, 1, 0});
    return c;
  }
  static MinecartProbe.MW world(List<int[]> cells) throws Exception {
    MinecartProbe.MW w = MinecartProbe.world(cells.toArray(new int[0][]));
    MobMoveProbe.field(ahb.class, "u").set(w, new ArrayList());
    return w;
  }
  static int[] front(int dir, int tx, int ty, int tz) {
    return new int[][] {{tx, ty, tz + 1}, {tx - 1, ty, tz}, {tx, ty, tz - 1}, {tx + 1, ty, tz}}[dir];
  }
  static int artIndex(tc a) {
    tc[] all = tc.values();
    for (int i = 0; i < all.length; i++) if (all[i] == a) return i;
    return -1;
  }

  static MinecartProbe.Target player(MinecartProbe.MW w, boolean creative, add held) throws Exception {
    MinecartProbe.Target p = MinecartProbe.player(w, 0.5, 64, 5.5, creative);
    PlayerStepProbe.field(yz.class, "bm").set(p, new yx(p));
    if (held != null) p.bm.a(0, held);
    return p;
  }
  static add mk(int id, int count, int dmg) { return new add(adb.d(id), count, dmg); }

  static void emit(String json) { System.out.println(json); }

  static void arts() {
    StringBuilder b = new StringBuilder();
    for (tc a : tc.values()) b.append(b.length() > 0 ? "," : "").append(vals(q(a.B), a.C, a.D, a.E, a.F));
    emit("{\"kind\":\"arts\",\"maxNameLength\":" + tc.A + ",\"arts\":[" + b + "]}");
  }

  static void bounds() throws Exception {
    int[][] tiles = {{3, 70, -4}, {-3, 70, 4}, {0, 64, 0}};
    for (int[] t : tiles)
      for (int d = 0; d < 4; d++) {
        StringBuilder b = new StringBuilder();
        for (tc a : tc.values()) {
          MinecartProbe.MW w = world(new ArrayList<>());
          P p = new P(w, t[0], t[1], t[2], d, a.B);
          b.append(b.length() > 0 ? "," : "").append(hs(p));
        }
        MinecartProbe.MW w = world(new ArrayList<>());
        F f = new F(w, t[0], t[1], t[2], d);
        emit("{\"kind\":\"bounds\",\"dir\":" + d + ",\"tile\":" + vals(t[0], t[1], t[2]) + ",\"paintings\":[" + b + "],\"frame\":" + hs(f) + "}");
      }
  }

  static void surface() throws Exception {
    for (int d = 0; d < 4; d++) {
      StringBuilder rows = new StringBuilder();
      for (tc a : tc.values()) {
        StringBuilder bits = new StringBuilder();
        // 0: full plane; 1: blocking cell in front; 2: overlapping hanging entity; 3..27: hole (dx, dy), dy then dx -2..2.
        for (int v = 0; v < 28; v++) {
          List<int[]> cells = plane(d, 0, 64, 0);
          MinecartProbe.MW w = null;
          if (v >= 3) {
            int dx = (v - 3) % 5 - 2, dy = (v - 3) / 5 - 2;
            int hx = d == 0 || d == 2 ? dx : 0, hz = d == 0 || d == 2 ? 0 : dx;
            final int fx = hx, fy = 64 + dy, fz = hz;
            cells.removeIf(c -> c[0] == fx && c[1] == fy && c[2] == fz);
          }
          if (v == 1) { int[] f = front(d, 0, 64, 0); cells.add(new int[] {f[0], f[1], f[2], 1, 0}); }
          w = world(cells);
          if (v == 2) { F other = new F(w, 0, 64, 0, d); w.entities.add(other); }
          P p = new P(w, 0, 64, 0, d, a.B);
          bits.append(p.e() ? '1' : '0');
        }
        rows.append(rows.length() > 0 ? "," : "").append("\"").append(bits).append("\"");
      }
      // The frame (9x9 pixels) against the same variants.
      StringBuilder fb = new StringBuilder();
      for (int v = 0; v < 28; v++) {
        List<int[]> cells = plane(d, 0, 64, 0);
        if (v >= 3) {
          int dx = (v - 3) % 5 - 2, dy = (v - 3) / 5 - 2;
          int hx = d == 0 || d == 2 ? dx : 0, hz = d == 0 || d == 2 ? 0 : dx;
          final int fx = hx, fy = 64 + dy, fz = hz;
          cells.removeIf(c -> c[0] == fx && c[1] == fy && c[2] == fz);
        }
        if (v == 1) { int[] f = front(d, 0, 64, 0); cells.add(new int[] {f[0], f[1], f[2], 1, 0}); }
        MinecartProbe.MW w = world(cells);
        if (v == 2) w.entities.add(new P(w, 0, 64, 0, d, "Kebab"));
        F f = new F(w, 0, 64, 0, d);
        fb.append(f.e() ? '1' : '0');
      }
      emit("{\"kind\":\"surface\",\"dir\":" + d + ",\"paintings\":[" + rows + "],\"frame\":\"" + fb + "\"}");
    }
  }

  static void select() throws Exception {
    for (int d = 0; d < 4; d++)
      for (int W = 1; W <= 4; W++)
        for (int H = 1; H <= 4; H++)
          for (int ci = 0; ci < W; ci++)
            for (int cj = 0; cj < H; cj++) {
              if (!(ci == 0 || ci == W - 1) || !(cj == 0 || cj == H - 1)) continue;
              List<int[]> cells = new ArrayList<>();
              for (int i = 0; i < W; i++)
                for (int j = 0; j < H; j++)
                  cells.add(d == 0 || d == 2 ? new int[] {i, 64 + j, 0, 1, 0} : new int[] {0, 64 + j, i, 1, 0});
              int tx = d == 0 || d == 2 ? ci : 0, tz = d == 0 || d == 2 ? 0 : ci, ty = 64 + cj;
              StringBuilder valid = new StringBuilder(), picks = new StringBuilder();
              MinecartProbe.MW w0 = world(cells);
              for (tc a : tc.values()) {
                P p = new P(w0, tx, ty, tz, d, a.B);
                if (p.e()) valid.append(valid.length() > 0 ? "," : "").append(artIndex(a));
              }
              for (int s = 0; s < 12; s++) {
                seed = s;
                MinecartProbe.MW w = world(cells);
                P p = new P(w, tx, ty, tz, d);
                picks.append(picks.length() > 0 ? "," : "").append(vals(artIndex(p.e), p.e(), num(p.s), num(p.t), num(p.u)));
              }
              emit("{\"kind\":\"select\",\"dir\":" + d + ",\"wall\":" + vals(W, H) + ",\"tile\":" + vals(tx, ty, tz) + ",\"valid\":[" + valid + "],\"picks\":[" + picks + "]}");
            }
    // No wall at all: the constructor leaves the last art selected.
    MinecartProbe.MW w = world(new ArrayList<>());
    seed = 3;
    P p = new P(w, 0, 64, 0, 2);
    emit("{\"kind\":\"select-none\",\"art\":" + artIndex(p.e) + ",\"valid\":" + p.e() + "}");
  }

  static ro sourceOf(String name, MinecartProbe.Target p) throws Exception {
    if (name.equals("player")) return ro.a((yz) p);
    if (name.equals("explosion")) return ro.a((agw) null);
    return MinecartProbe.source(name);
  }

  // Frame scenario: steps are {"insert"}, {"rotate"}, {"hit", source}, {"nbt"}.
  static void frame(String name, boolean creative, add held, float dropChance, Object[][] steps) throws Exception {
    List<int[]> cells = plane(2, 0, 64, 0);
    MinecartProbe.MW w = world(cells);
    seed = 7;
    F f = new F(w, 0, 64, 0, 2);
    MinecartProbe.Target p = player(w, creative, held);
    if (dropChance >= 0) {
      dh tag = new dh();
      f.b(tag);
      f.a(tag);
      PlayerStepProbe.field(st.class, "e").setFloat(f, dropChance);
    }
    StringBuilder out = new StringBuilder();
    for (Object[] step : steps) {
      w.spawned.clear();
      String kind = (String) step[0];
      String ret = "null";
      if (kind.equals("insert") || kind.equals("rotate")) ret = String.valueOf(f.c(p));
      else if (kind.equals("hit")) ret = String.valueOf(f.a(sourceOf((String) step[1], p), 1.0f));
      else if (kind.equals("force")) { f.b((sa) null); ret = "true"; }
      else if (kind.equals("move")) { f.d(0.1, 0, 0); ret = "true"; }
      else if (kind.equals("move0")) { f.d(0, 0, 0); ret = "true"; }
      String nbt = "null";
      if (kind.equals("nbt")) { dh tag = new dh(); f.b(tag); nbt = NbtProbe.tag(tag); }
      out.append(out.length() > 0 ? "," : "").append(vals(q(kind), ret, stack(f.j()), f.k(), f.K, stack(p.bm.h()), drops(w), nbt));
    }
    emit("{\"kind\":\"frame\",\"name\":" + q(name) + ",\"creative\":" + creative + ",\"held\":" + stack(held) + ",\"dropChance\":" + num(dropChance) + ",\"steps\":[" + out + "]}");
  }

  static void painting(String name, boolean creative, String art, String[] hits) throws Exception {
    MinecartProbe.MW w = world(plane(2, 0, 64, 0));
    seed = 5;
    P p = new P(w, 0, 64, 0, 2, art);
    MinecartProbe.Target pl = player(w, creative, null);
    StringBuilder out = new StringBuilder();
    for (String h : hits) {
      w.spawned.clear();
      boolean r = p.a(sourceOf(h, pl), 1.0f);
      out.append(out.length() > 0 ? "," : "").append(vals(q(h), r, p.K, drops(w)));
    }
    emit("{\"kind\":\"painting-hit\",\"name\":" + q(name) + ",\"art\":" + q(art) + ",\"creative\":" + creative + ",\"steps\":[" + out + "]}");
  }

  // onUpdate [ss.h] for 130 ticks after removing the supporting cell at tick `removeAt` (-1 never).
  static void tick(String name, boolean frame, int removeAt, boolean remote) throws Exception {
    MinecartProbe.MW w = world(plane(2, 0, 64, 0));
    seed = 11;
    ss h = frame ? new F(w, 0, 64, 0, 2) : new P(w, 0, 64, 0, 2, "Pool");
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remote);
    if (frame) { h = h; ((F) h).a(mk(4, 1, 0)); }
    int deadAt = -1;
    StringBuilder log = new StringBuilder();
    for (int t = 0; t < 130; t++) {
      if (t == removeAt) {
        for (int x = -2; x <= 2; x++) w.cells.remove(PlantProbe.W.key(x, 64, 0));
        w.put(0, 64, 0, 0, 0);
        w.put(-1, 64, 0, 0, 0);
      }
      w.spawned.clear();
      boolean was = h.K;
      h.h();
      if (!was && h.K && deadAt < 0) { deadAt = t; log.append(drops(w)); }
    }
    emit("{\"kind\":\"tick\",\"name\":" + q(name) + ",\"frame\":" + frame + ",\"removeAt\":" + removeAt + ",\"remote\":" + remote + ",\"deadAt\":" + deadAt + ",\"drops\":" + (log.length() > 0 ? log : "[]") + "}");
  }

  static dh tagOf(Object... kv) {
    dh t = new dh();
    for (int i = 0; i < kv.length; i += 2) {
      String k = (String) kv[i];
      Object v = kv[i + 1];
      if (v instanceof Byte) t.a(k, (Byte) v);
      else if (v instanceof Integer) t.a(k, (Integer) v);
      else if (v instanceof Float) t.a(k, (Float) v);
      else if (v instanceof String) t.a(k, (String) v);
      else if (v instanceof dy) t.a(k, (dy) v);
    }
    return t;
  }

  static void nbtRead(String name, boolean frame, dh tag) throws Exception {
    MinecartProbe.MW w = world(new ArrayList<>());
    seed = 13;
    ss h = frame ? new F(w) : new P(w);
    h.a(tag);
    dh out = new dh();
    h.b(out);
    emit("{\"kind\":\"nbt-read\",\"name\":" + q(name) + ",\"frame\":" + frame + ",\"tag\":" + NbtProbe.tag(tag) + ",\"state\":" + hs(h) + ",\"art\":" + (frame ? "null" : q(((tb) h).e.B)) + ",\"item\":"
      + (frame ? stack(((st) h).j()) : "null") + ",\"rotation\":" + (frame ? ((st) h).k() : 0) + ",\"written\":" + NbtProbe.tag(out) + "}");
  }

  static void place(String name, boolean frame, boolean blocked, boolean creative) throws Exception {
    for (int side = 0; side < 6; side++) {
      List<int[]> cells = new ArrayList<>();
      cells.add(new int[] {0, 65, 0, 1, 0});
      if (blocked) cells.add(new int[] {0, 65, -1, 1, 0});
      MinecartProbe.MW w = world(cells);
      seed = 17;
      MinecartProbe.Target p = player(w, creative, mk(frame ? 389 : 321, 3, 0));
      add s = p.bm.h();
      boolean ret;
      String err = "null";
      try { ret = s.a(p, w, 0, 65, 0, side, 0.5f, 0.5f, 0.5f); }
      catch (Throwable t) { ret = false; err = q(t.toString()); }
      String ent = "null";
      for (sa e : w.spawned)
        if (e instanceof ss) {
          ss h = (ss) e;
          ent = vals(hs(h), e instanceof tb ? q(((tb) e).e.B) : "null", h.e());
        }
      emit("{\"kind\":\"place\",\"name\":" + q(name) + ",\"frame\":" + frame + ",\"blocked\":" + blocked + ",\"side\":" + side + ",\"return\":" + ret + ",\"error\":" + err + ",\"stack\":" + s.b + ",\"entity\":" + ent + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    arts();
    bounds();
    surface();
    select();
    add sword = mk(276, 1, 5);
    dh swordTag = new dh();
    swordTag.a("RepairCost", 3);
    sword.d(swordTag);
    frame("survival", false, mk(4, 3, 0), -1, new Object[][] {{"insert"}, {"rotate"}, {"rotate"}, {"rotate"}, {"rotate"}, {"rotate"}, {"nbt"}, {"hit", "player"}, {"hit", "player"}});
    frame("survival-last-item", false, mk(264, 1, 0), -1, new Object[][] {{"insert"}, {"hit", "generic"}, {"hit", "generic"}});
    frame("creative", true, sword, -1, new Object[][] {{"insert"}, {"rotate"}, {"rotate"}, {"nbt"}, {"hit", "player"}, {"hit", "player"}});
    frame("empty-survival", false, null, -1, new Object[][] {{"rotate"}, {"hit", "player"}});
    frame("empty-hand-rotate", false, mk(4, 2, 0), -1, new Object[][] {{"insert"}, {"insert"}, {"insert"}});
    frame("explosion", false, sword, -1, new Object[][] {{"insert"}, {"hit", "explosion"}, {"hit", "explosion"}});
    frame("drop-chance-0", false, mk(4, 1, 0), 0.0f, new Object[][] {{"insert"}, {"hit", "player"}});
    frame("drop-chance-half", false, mk(4, 1, 0), 0.5f, new Object[][] {{"insert"}, {"nbt"}, {"hit", "player"}});
    frame("move", false, mk(4, 1, 0), -1, new Object[][] {{"insert"}, {"move0"}, {"move"}});
    frame("force-broken", false, mk(4, 1, 0), -1, new Object[][] {{"insert"}, {"force"}});
    painting("kebab", false, "Kebab", new String[] {"player", "player"});
    painting("creative", true, "Pool", new String[] {"player"});
    painting("generic", false, "Wither", new String[] {"generic"});
    painting("explosion", false, "Fighters", new String[] {"explosion"});
    tick("painting-valid", false, -1, false);
    tick("painting-removed", false, 20, false);
    tick("painting-removed-late", false, 105, false);
    tick("painting-remote", false, 20, true);
    tick("frame-removed", true, 50, false);
    place("painting", false, false, false);
    place("painting-blocked", false, true, false);
    place("painting-creative", false, false, true);
    place("frame", true, false, false);
    place("frame-blocked", true, true, false);
    nbtRead("painting-direction", false, tagOf("Motive", "Pool", "Direction", (byte) 1, "TileX", 5, "TileY", 70, "TileZ", -9));
    nbtRead("painting-dir-0", false, tagOf("Motive", "Fighters", "Dir", (byte) 0, "TileX", 5, "TileY", 70, "TileZ", -9));
    nbtRead("painting-dir-1", false, tagOf("Motive", "Skeleton", "Dir", (byte) 1, "TileX", 5, "TileY", 70, "TileZ", -9));
    nbtRead("painting-dir-2", false, tagOf("Motive", "Wither", "Dir", (byte) 2, "TileX", 5, "TileY", 70, "TileZ", -9));
    nbtRead("painting-dir-3", false, tagOf("Motive", "Bust", "Dir", (byte) 3, "TileX", 5, "TileY", 70, "TileZ", -9));
    nbtRead("painting-unknown", false, tagOf("Motive", "Nonsense", "Direction", (byte) 3, "TileX", 1, "TileY", 2, "TileZ", 3));
    nbtRead("painting-missing", false, tagOf("TileX", 1, "TileY", 2, "TileZ", 3));
    dh item = new dh();
    mk(276, 1, 5).b(item);
    nbtRead("frame-item", true, tagOf("Direction", (byte) 0, "TileX", 5, "TileY", 70, "TileZ", -9, "Item", item, "ItemRotation", (byte) 6, "ItemDropChance", 0.25f));
    nbtRead("frame-empty", true, tagOf("Direction", (byte) 3, "TileX", 5, "TileY", 70, "TileZ", -9));
    nbtRead("frame-legacy-dir", true, tagOf("Dir", (byte) 1, "TileX", 5, "TileY", 70, "TileZ", -9, "Item", item, "ItemRotation", (byte) 3));
    nbtRead("frame-empty-item", true, tagOf("Direction", (byte) 2, "TileX", 5, "TileY", 70, "TileZ", -9, "Item", new dh(), "ItemRotation", (byte) 3));
  }
}
