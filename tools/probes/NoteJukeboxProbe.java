import java.util.*;

// Records the unchanged BlockNote [amj], TileEntityNote [apl], BlockJukebox [alq], its TileEntityJukebox [alr],
// ItemRecord [adr], EntityCreeper.onDeath [xz.a(ro)] and the GuiIngame record-text arithmetic (colour from the
// JDK's java.awt.Color.HSBtoRGB, as GuiIngame calls it). The world is a subclass of MobMoveProbe.ProbeWorld that
// stores blocks and tile entities in maps and records block events, sounds, particles, world events (aux effects
// and playRecord), metadata writes and spawned entities. No game class is patched. One JSON object per line;
// tools/verify-note-jukebox.mjs writes public/research/note-jukebox-reference.json and src/note-jukebox.test.js
// replays it. Item-entity motion uses Math.random() and is not recorded.
public class NoteJukeboxProbe {
  static final int NOTE = 25, JUKEBOX = 84;

  public static class NW extends MobMoveProbe.ProbeWorld {
    Map<Long, int[]> cells; Map<Long, aor> tiles; Set<Long> powered;
    List<String> events, sounds, particles, aux, meta, spawned;
    static long key(int x, int y, int z) { return ((long) x & 0xfffff) | (((long) y & 0xfff) << 20) | (((long) z & 0xfffff) << 32); }
    void init() { cells = new HashMap<>(); tiles = new HashMap<>(); powered = new HashSet<>(); clear(); }
    void clear() { events = new ArrayList<>(); sounds = new ArrayList<>(); particles = new ArrayList<>(); aux = new ArrayList<>(); meta = new ArrayList<>(); spawned = new ArrayList<>(); }
    public aji a(int x, int y, int z) { int[] c = cells.get(key(x, y, z)); return aji.e(c == null ? 0 : c[0]); }
    public int e(int x, int y, int z) { int[] c = cells.get(key(x, y, z)); return c == null ? 0 : c[1]; }
    public aor o(int x, int y, int z) { return tiles.get(key(x, y, z)); }
    public void a(int x, int y, int z, aor t) { tiles.put(key(x, y, z), t); }
    public void p(int x, int y, int z) { tiles.remove(key(x, y, z)); }
    public boolean a(int x, int y, int z, int m, int flags) {
      int[] c = cells.get(key(x, y, z));
      if (c == null) return false;
      c[1] = m; meta.add("[" + x + "," + y + "," + z + "," + m + "," + flags + "]");
      return true;
    }
    public boolean v(int x, int y, int z) { return powered.contains(key(x, y, z)); }
    public boolean c(int x, int y, int z) { return a(x, y, z).o() == awt.a; }
    public float n(int x, int y, int z) { return 0f; }
    public int k(int x, int y, int z) { return 0; }
    public agy O() { return new agy(); }
    public void c(int x, int y, int z, aji b, int ev, int param) { events.add("[" + x + "," + y + "," + z + "," + aji.b(b) + "," + ev + "," + param + "]"); }
    public void a(double x, double y, double z, String s, float v, float p) { sounds.add("[" + NbtProbe.quote(s) + "," + NbtProbe.number(x) + "," + NbtProbe.number(y) + "," + NbtProbe.number(z) + "," + v + "," + p + "]"); }
    public void a(String n, double x, double y, double z, double vx, double vy, double vz) { particles.add("[" + NbtProbe.quote(n) + "," + NbtProbe.number(x) + "," + NbtProbe.number(y) + "," + NbtProbe.number(z) + "," + NbtProbe.number(vx) + "," + NbtProbe.number(vy) + "," + NbtProbe.number(vz) + "]"); }
    public void c(int id, int x, int y, int z, int data) { aux.add("[" + id + "," + x + "," + y + "," + z + "," + data + "]"); }
    public void a(yz p, int id, int x, int y, int z, int data) { aux.add("[" + id + "," + x + "," + y + "," + z + "," + data + "]"); }
    public void a(String s, int x, int y, int z) { aux.add("[\"playRecord\"," + (s == null ? "null" : NbtProbe.quote(s)) + "," + x + "," + y + "," + z + "]"); }
    public void a(sa e, byte state) {}
    public boolean d(sa e) { spawned.add(describe(e)); return true; }
    public List b(sa except, azt box) { return new ArrayList(); }
    public List a(Class c, azt box) { return new ArrayList(); }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) { return new ArrayList(); }
    void put(int x, int y, int z, int id, int m) { cells.put(key(x, y, z), new int[] {id, m}); }
  }

  static String describe(sa e) {
    try {
      if (e instanceof xk) {
        add s = ((xk) e).f();
        return "[\"item\"," + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + NbtProbe.number(e.s) + "," + NbtProbe.number(e.t) + "," + NbtProbe.number(e.u) + "," + PlayerStepProbe.field(xk.class, "b").getInt(e) + "]";
      }
    } catch (Exception x) { throw new RuntimeException(x); }
    return "[\"entity\"]";
  }

  static NW world(long seed) throws Exception {
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    NW w = (NW) u.allocateInstance(NW.class);
    MobMoveProbe.set(w, "s", new Random(seed));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    w.init();
    return w;
  }
  static void reseed(NW w, long seed) throws Exception { MobMoveProbe.set(w, "s", new Random(seed)); }

  static String list(List<String> l) { return "[" + String.join(",", l) + "]"; }
  static void out(String s) { System.out.println(s); }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    NW w = world(1);
    amj noteBlock = (amj) aji.e(NOTE);
    alq jukebox = (alq) aji.e(JUKEBOX);
    String discs = "13,cat,blocks,chirp,far,mall,mellohi,stal,strad,ward,11,wait";

    // facts: hardness, resistance, material and class facts of both blocks
    for (int id : new int[] {NOTE, JUKEBOX}) {
      aji b = aji.e(id);
      out("{\"case\":\"facts\",\"block\":" + id + ",\"hardness\":" + b.f(w, 0, 0, 0) + ",\"resistance\":" + b.a((sa) null) * 5f + ",\"wood\":" + (b.o() == awt.d)
        + ",\"container\":" + (b instanceof ajc) + ",\"comparator\":" + b.M() + ",\"opaque\":" + b.c() + ",\"fullCube\":" + b.d() + ",\"renderType\":" + b.b() + "}");
    }

    // note-trigger: TileEntityNote.triggerNote for every note below/above combination
    int[] belows = {0, 1, 2, 3, 4, 5, 7, 12, 13, 17, 20, 35, 41, 42, 45, 58, 79, 82, 88, 89, 97, 98, 103};
    for (int below : belows) for (int above : new int[] {0, 1, 8}) {
      StringBuilder rows = new StringBuilder();
      for (int note = 0; note <= 24; note++) {
        w.cells.clear(); w.tiles.clear(); w.clear();
        w.put(0, 63, 0, below, 0); w.put(0, 64, 0, NOTE, 0); if (above != 0) w.put(0, 65, 0, above, 0);
        apl t = (apl) noteBlock.a(w, 0); t.a = (byte) note; w.a(0, 64, 0, t);
        t.a(w, 0, 64, 0);
        if (rows.length() > 0) rows.append(',');
        rows.append(list(w.events));
      }
      out("{\"case\":\"trigger\",\"below\":" + below + ",\"above\":" + above + ",\"events\":[" + rows + "]}");
    }

    // instruments: the instrument TileEntityNote.triggerNote picks for every registered block id below the note block
    {
      StringBuilder table = new StringBuilder();
      for (int below = 0; below < 176; below++) {
        if (below != 0 && aji.e(below) == aji.e(0)) continue;
        w.cells.clear(); w.tiles.clear(); w.clear();
        w.put(0, 63, 0, below, 0); w.put(0, 64, 0, NOTE, 0);
        apl t = (apl) noteBlock.a(w, 0); t.a = 0; w.a(0, 64, 0, t);
        t.a(w, 0, 64, 0);
        String instrument = w.events.isEmpty() ? "-1" : w.events.get(0).replace("]", "").split(",")[4];
        if (table.length() > 0) table.append(',');
        table.append("[").append(below).append(",").append(instrument).append("]");
      }
      out("{\"case\":\"instruments\",\"table\":[" + table + "]}");
    }

    // note-event: BlockNote.onBlockEventReceived for every instrument value and note
    for (int inst = 0; inst <= 5; inst++) {
      StringBuilder rows = new StringBuilder();
      for (int note = 0; note <= 24; note++) {
        w.clear();
        boolean r = noteBlock.a(w, 3, 70, -2, inst, note);
        if (rows.length() > 0) rows.append(',');
        rows.append("{\"result\":" + r + ",\"sounds\":" + list(w.sounds) + ",\"particles\":" + list(w.particles) + "}");
      }
      out("{\"case\":\"event\",\"instrument\":" + inst + ",\"rows\":[" + rows + "]}");
    }

    // note-click: right clicks (changePitch + trigger) from several start notes, then left clicks (trigger only)
    for (int start : new int[] {0, 7, 23, 24}) {
      w.cells.clear(); w.tiles.clear(); w.clear();
      w.put(0, 63, 0, 1, 0); w.put(0, 64, 0, NOTE, 0);
      apl t = (apl) noteBlock.a(w, 0); t.a = (byte) start; w.a(0, 64, 0, t);
      StringBuilder rights = new StringBuilder(), lefts = new StringBuilder();
      for (int i = 0; i < 27; i++) {
        w.clear();
        boolean r = noteBlock.a(w, 0, 64, 0, (yz) null, 1, 0.5f, 0.5f, 0.5f);
        if (rights.length() > 0) rights.append(',');
        rights.append("{\"result\":" + r + ",\"note\":" + t.a + ",\"events\":" + list(w.events) + "}");
      }
      for (int i = 0; i < 2; i++) {
        w.clear();
        noteBlock.a(w, 0, 64, 0, (yz) null);
        if (lefts.length() > 0) lefts.append(',');
        lefts.append("{\"note\":" + t.a + ",\"events\":" + list(w.events) + "}");
      }
      out("{\"case\":\"click\",\"start\":" + start + ",\"right\":[" + rights + "],\"left\":[" + lefts + "]}");
    }
    // no tile entity: click does nothing but still reports true on a right click
    { w.cells.clear(); w.tiles.clear(); w.clear(); w.put(0, 64, 0, NOTE, 0);
      boolean r = noteBlock.a(w, 0, 64, 0, (yz) null, 1, 0.5f, 0.5f, 0.5f);
      out("{\"case\":\"click-no-tile\",\"result\":" + r + ",\"events\":" + list(w.events) + "}"); }

    // note-redstone: BlockNote.onNeighborBlockChange over a power sequence
    for (boolean[] seq : new boolean[][] {{false, true, true, false, true, false, false, true}, {true, true, false}}) {
      w.cells.clear(); w.tiles.clear(); w.clear();
      w.put(0, 63, 0, 1, 0); w.put(0, 64, 0, NOTE, 0);
      apl t = (apl) noteBlock.a(w, 0); t.a = 9; w.a(0, 64, 0, t);
      StringBuilder rows = new StringBuilder();
      for (boolean p : seq) {
        w.clear();
        if (p) w.powered.add(NW.key(0, 64, 0)); else w.powered.remove(NW.key(0, 64, 0));
        noteBlock.a(w, 0, 64, 0, aji.e(1));
        if (rows.length() > 0) rows.append(',');
        rows.append("{\"powered\":" + p + ",\"previous\":" + t.i + ",\"events\":" + list(w.events) + "}");
      }
      out("{\"case\":\"redstone\",\"rows\":[" + rows + "]}");
    }

    // note-nbt: TileEntityNote.readFromNBT clamps, writeFromNBT
    for (int v : new int[] {-128, -5, -1, 0, 1, 12, 24, 25, 100, 127}) {
      dh tag = new dh(); tag.a("note", (byte) v);
      apl t = new apl(); t.a(tag);
      dh o = new dh(); t.b(o);
      out("{\"case\":\"note-nbt\",\"read\":" + v + ",\"note\":" + t.a + ",\"written\":" + NbtProbe.tag(o) + "}");
    }
    { apl t = new apl(); t.a(new dh()); out("{\"case\":\"note-nbt\",\"read\":null,\"note\":" + t.a + "}"); }

    // jukebox: ItemRecord facts and insertion for every disc
    String[] names = discs.split(",");
    for (int i = 0; i < 12; i++) {
      int id = 2256 + i;
      adr item = (adr) adb.d(id);
      add stack = new add(item, 1, 0);
      w.cells.clear(); w.tiles.clear(); w.clear();
      w.put(0, 64, 0, JUKEBOX, 0); aor jt = jukebox.a(w, 0); w.a(0, 64, 0, jt);
      boolean r = item.a(stack, (yz) null, w, 0, 64, 0, 1, 0.5f, 0.5f, 0.5f);
      add held = ((alr) jt).a();
      List<String> aux1 = new ArrayList<>(w.aux), meta1 = new ArrayList<>(w.meta);
      // second insert onto the full jukebox and a non-jukebox cell
      add other = new add(item, 1, 0);
      w.clear();
      boolean again = item.a(other, (yz) null, w, 0, 64, 0, 1, 0.5f, 0.5f, 0.5f);
      w.put(5, 64, 5, 1, 0);
      boolean stone = item.a(new add(item, 1, 0), (yz) null, w, 5, 64, 5, 1, 0.5f, 0.5f, 0.5f);
      // comparator signal while holding the disc
      int signal = jukebox.g(w, 0, 64, 0, 0);
      out("{\"case\":\"disc\",\"id\":" + id + ",\"name\":" + NbtProbe.quote(item.a) + ",\"stackLimit\":" + item.h + ",\"rarity\":" + NbtProbe.quote(item.f(stack).toString()) + ",\"descKey\":" + NbtProbe.quote("item.record." + item.a + ".desc")
        + ",\"insert\":{\"result\":" + r + ",\"stackAfter\":" + stack.b + ",\"held\":" + (held == null ? "null" : "[" + adb.b(held.b()) + "," + held.b + "," + held.k() + "]")
        + ",\"aux\":" + list(aux1) + ",\"meta\":" + list(meta1) + "},\"insertAgain\":{\"result\":" + again + ",\"stackAfter\":" + other.b + ",\"aux\":" + list(w.aux) + "},\"insertStone\":" + stone + ",\"signal\":" + signal + "}");
    }
    { // empty jukebox: comparator signal and activation
      w.cells.clear(); w.tiles.clear(); w.clear();
      w.put(0, 64, 0, JUKEBOX, 0); w.a(0, 64, 0, jukebox.a(w, 0));
      boolean r = jukebox.a(w, 0, 64, 0, (yz) null, 1, 0.5f, 0.5f, 0.5f);
      out("{\"case\":\"empty\",\"activate\":" + r + ",\"signal\":" + jukebox.g(w, 0, 64, 0, 0) + ",\"events\":" + list(w.aux) + "}");
    }

    // eject: right click and break on a full jukebox for seeded world.rand (offsets d0, d1, d2 and delay)
    for (int disc : new int[] {0, 1, 11}) for (int seed = 0; seed < 12; seed++) for (int mode = 0; mode < 2; mode++) {
      w.cells.clear(); w.tiles.clear(); w.clear(); reseed(w, seed);
      w.put(3, 70, -4, JUKEBOX, 1); aor jt = jukebox.a(w, 0); w.a(3, 70, -4, jt);
      ((alr) jt).a(new add(adb.d(2256 + disc), 1, 0));
      boolean r = true;
      if (mode == 0) r = jukebox.a(w, 3, 70, -4, (yz) null, 1, 0.5f, 0.5f, 0.5f);
      else jukebox.a(w, 3, 70, -4, jukebox, 1);
      out("{\"case\":\"eject\",\"mode\":" + (mode == 0 ? "\"use\"" : "\"break\"") + ",\"disc\":" + disc + ",\"seed\":" + seed + ",\"result\":" + r + ",\"spawned\":" + list(w.spawned) + ",\"aux\":" + list(w.aux)
        + ",\"meta\":" + list(w.meta) + ",\"tile\":" + (w.o(3, 70, -4) == null ? "null" : (((alr) w.o(3, 70, -4)).a() == null ? "\"empty\"" : "\"full\"")) + ",\"nextInt\":" + w.s.nextInt(1 << 20) + "}");
    }

    // jukebox NBT: writeToNBT with and without a disc; readFromNBT of RecordItem and the legacy Record id
    for (int disc : new int[] {-1, 0, 5, 11}) {
      alr jt = new alr();
      if (disc >= 0) jt.a(new add(adb.d(2256 + disc), 1, 0));
      dh o = new dh(); jt.b(o);
      alr back = new alr(); back.a(o);
      add held = back.a();
      out("{\"case\":\"jukebox-nbt\",\"disc\":" + disc + ",\"written\":" + NbtProbe.tag(o) + ",\"read\":" + (held == null ? "null" : "[" + adb.b(held.b()) + "," + held.b + "," + held.k() + "]") + "}");
    }
    for (int legacy : new int[] {0, 2255, 2256, 2261, 2267, 2268, 1, 5}) {
      dh o = new dh(); o.a("Record", legacy);
      alr back = new alr(); back.a(o);
      add held = back.a();
      out("{\"case\":\"jukebox-legacy\",\"record\":" + legacy + ",\"read\":" + (held == null ? "null" : "[" + adb.b(held.b()) + "," + held.b + "," + held.k() + "]") + "}");
    }

    // creeper drop: EntityCreeper.onDeath (xz.a(ro)) for several damage sources over seeded Entity.rand
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    String[] kinds = {"skeleton-arrow", "skeleton-melee", "creeper-melee", "cactus", "arrow-no-shooter"};
    for (String kind : kinds) {
      StringBuilder rows = new StringBuilder();
      for (int seed = 0; seed < 240; seed++) {
        w.clear();
        xz e = new xz(w); ChickenProbe.clearTasks(e); MobMoveProbe.set(e, "Z", new Random(seed));
        ro src;
        switch (kind) {
          case "skeleton-arrow": src = ro.a((sa) u.allocateInstance(zc.class), (sa) u.allocateInstance(yl.class)); break;
          case "skeleton-melee": src = ro.a((sv) u.allocateInstance(yl.class)); break;
          case "creeper-melee": src = ro.a((sv) u.allocateInstance(xz.class)); break;
          case "arrow-no-shooter": src = ro.a((sa) u.allocateInstance(zc.class), (sa) null); break;
          default: src = MinecartProbe.source("cactus");
        }
        e.a(src);
        int disc = -1, items = 0;
        for (String s : w.spawned) {
          String[] f = s.replace("[", "").replace("]", "").split(",");
          if (f.length > 3 && f[0].equals("\"item\"")) { items++; int id = Integer.parseInt(f[1]); if (id >= 2256 && id <= 2267) disc = id; }
        }
        if (rows.length() > 0) rows.append(',');
        rows.append("[" + disc + "," + items + "]");
      }
      out("{\"case\":\"creeper\",\"source\":\"" + kind + "\",\"rows\":[" + rows + "]}");
    }

    // hud: GuiIngame record text: alpha int((p - partial) * 255 / 20) capped at 255 (drawn above 8) and the colour
    StringBuilder hud = new StringBuilder();
    for (int p = 60; p >= 0; p--) for (float partial : new float[] {0f, 0.25f, 0.5f, 0.75f}) {
      float f2 = p - partial;
      int alpha = (int) (f2 * 255.0F / 20.0F);
      if (alpha > 255) alpha = 255;
      int rgb = java.awt.Color.HSBtoRGB(f2 / 50.0F, 0.7F, 0.6F) & 0xFFFFFF;
      if (hud.length() > 0) hud.append(',');
      hud.append("[" + p + "," + partial + "," + alpha + "," + rgb + "]");
    }
    out("{\"case\":\"hud\",\"rows\":[" + hud + "]}");

    // note particle colour: EntityNoteFX red/green/blue from MathHelper.sin (qh.a)
    StringBuilder col = new StringBuilder();
    for (int note = 0; note <= 24; note++) {
      double vx = (double) note / 24.0;
      float c = (float) vx;
      float r = qh.a((c + 0.0F) * 3.1415927F * 2.0F) * 0.65F + 0.35F;
      float g = qh.a((c + 0.33333334F) * 3.1415927F * 2.0F) * 0.65F + 0.35F;
      float b = qh.a((c + 0.6666667F) * 3.1415927F * 2.0F) * 0.65F + 0.35F;
      if (col.length() > 0) col.append(',');
      col.append("[" + note + "," + r + "," + g + "," + b + "]");
    }
    out("{\"case\":\"note-colour\",\"rows\":[" + col + "]}");
  }
}
