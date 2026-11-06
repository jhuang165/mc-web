import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 music, record and cave-mood facts from the unchanged original classes:
// MusicTicker (btg) and MusicTicker.MusicType (bth), PositionedSoundRecord (bso) and ISound.AttenuationType (bsu), and
// World.func_147467_a (ahb.a(IILapx;)V, the "moodSound" section that plays ambient.cave.cave).
// Minecraft (bao) and SoundHandler (btp) are subclasses allocated without constructors (sun.misc.Unsafe): getAmbientMusicType
// (bao.Y) returns a scripted type and the handler records play / stop and answers isSoundPlaying from scripted song lengths.
// The mood world is an ahb subclass with a synthetic light field (j(III) and b(ahn,III) overridden), a chunk whose blocks are
// air or stone from a hash, the real getClosestPlayer over one EntityPlayer, and playSoundEffect recorded.
// Output: one JSON object (records "types", "sounds", "ticker" and "mood"); tools/verify-music.mjs writes
// public/research/music-reference.json and src/music.test.js replays it.
public class MusicProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static Object get(Object o, String n) throws Exception { return field(o.getClass(), n).get(o); }
  static void set(Object o, String n, Object v) throws Exception { field(o.getClass(), n).set(o, v); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  // ---- MusicTicker ----
  public static class FakeMc extends bao {
    FakeMc() { super(null, 0, 0, false, false, null, null, null, null, null, null, null); }
    bth type; FakeSound sound;
    public bth Y() { return type; }
    public btp X() { return sound; }
  }
  public static class FakeSound extends btp {
    FakeSound() { super(null, null); }
    int tick; int[] lengths; int next;
    IdentityHashMap<bst, Integer> ends = new IdentityHashMap<>();
    List<String> events = new ArrayList<>();
    public void a(bst s) { int len = lengths[next++ % lengths.length]; ends.put(s, tick + len); events.add("play " + s.b().toString()); }
    public void b(bst s) { ends.remove(s); events.add("stop " + s.b().toString()); }
    public boolean c(bst s) { Integer e = ends.get(s); return e != null && tick < e; }
  }

  static String ticker(long seed, Object[][] script, int[] lengths) throws Exception {
    FakeMc mc = (FakeMc) unsafe.allocateInstance(FakeMc.class);
    FakeSound sh = (FakeSound) unsafe.allocateInstance(FakeSound.class);
    sh.ends = new IdentityHashMap<>(); sh.events = new ArrayList<>(); sh.lengths = lengths;
    mc.sound = sh;
    btg t = new btg(mc);
    Field rf = field(btg.class, "a");
    unsafe.putObject(t, unsafe.objectFieldOffset(rf), new Random(seed));
    Field df = field(btg.class, "d");
    StringBuilder rows = new StringBuilder();
    int tick = 0;
    for (Object[] seg : script) {
      bth type = (bth) seg[0];
      int n = (Integer) seg[1];
      for (int i = 0; i < n; i++, tick++) {
        mc.type = type; sh.tick = tick; sh.events.clear();
        t.a();
        int d = df.getInt(t);
        if (!sh.events.isEmpty()) {
          if (rows.length() > 0) rows.append(',');
          rows.append("{\"t\":").append(tick).append(",\"d\":").append(d).append(",\"events\":[");
          for (int k = 0; k < sh.events.size(); k++) rows.append(k > 0 ? "," : "").append(q(sh.events.get(k)));
          rows.append("]}");
        }
      }
    }
    StringBuilder s = new StringBuilder("{\"seed\":" + seed + ",\"lengths\":" + Arrays.toString(lengths) + ",\"script\":[");
    for (int i = 0; i < script.length; i++) s.append(i > 0 ? "," : "").append("[").append(q(((bth) script[i][0]).name())).append(",").append(script[i][1]).append("]");
    s.append("],\"rows\":[").append(rows).append("],\"final\":").append(df.getInt(t)).append("}");
    return s.toString();
  }

  // ---- World.func_147467_a ----
  public static class Blk extends aji { Blk() { super(null); } awt m; public awt o() { return m; } }
  public static class Ch extends apx {
    Ch() { super(null, 0, 0); }
    int bx, bz;
    public aji a(int x, int y, int z) { return air(bx + x, y, bz + z) ? AIR : STONE; }
    public void o() {}
  }
  static Blk AIR, STONE;
  static int hash(int x, int y, int z) { return (x * 73856093) ^ (y * 19349663) ^ (z * 83492791); }
  static boolean air(int x, int y, int z) { return (hash(x, y, z) & 3) != 0; }
  static int full(int x, int y, int z) { return (hash(x, y, z) >>> 2) & 15; }
  static int sky(int x, int y, int z) { int h = hash(x, y, z); return ((h >>> 6) & 3) == 0 ? (h >>> 8) & 15 : 0; }
  public static class MW extends ahb {
    MW() { super(null, null, (aqo) null, null, null); }
    List<String> played;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public int j(int x, int y, int z) { return full(x, y, z); }
    public int b(ahn kind, int x, int y, int z) { return kind == ahn.a ? sky(x, y, z) : 0; }
    public void a(double x, double y, double z, String name, float volume, float pitch) {
      played.add("{\"x\":" + x + ",\"y\":" + y + ",\"z\":" + z + ",\"name\":" + MusicProbe.q(name) + ",\"volume\":" + volume + ",\"pitch\":" + pitch + "}");
    }
  }
  public static class P extends yz {
    P() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }

  static String mood(long seed, int lcg, double px, double py, double pz, int calls) throws Exception {
    MW w = (MW) unsafe.allocateInstance(MW.class);
    w.played = new ArrayList<>();
    set(w, "s", new Random(seed));
    set(w, "C", new qi());
    field(ahb.class, "E").setBoolean(w, false);
    field(ahb.class, "k").setInt(w, lcg);
    field(ahb.class, "K").setInt(w, 0);
    P p = (P) unsafe.allocateInstance(P.class);
    field(sa.class, "s").setDouble(p, px); field(sa.class, "t").setDouble(p, py); field(sa.class, "u").setDouble(p, pz);
    List<Object> players = new ArrayList<>(); players.add(p);
    set(w, "h", players);
    Ch ch = (Ch) unsafe.allocateInstance(Ch.class);
    Method m = ahb.class.getDeclaredMethod("a", int.class, int.class, apx.class); m.setAccessible(true);
    StringBuilder trace = new StringBuilder(), plays = new StringBuilder();
    Field K = field(ahb.class, "K"), k = field(ahb.class, "k");
    int[][] chunks = {{0, 0}, {-1, 0}, {0, -1}, {-1, -1}, {1, 0}, {0, 1}};
    for (int i = 0; i < calls; i++) {
      int[] c = chunks[i % chunks.length];
      ch.bx = c[0] * 16; ch.bz = c[1] * 16;
      int before = w.played.size();
      m.invoke(w, ch.bx, ch.bz, ch);
      if (i < 400) trace.append(i > 0 ? "," : "").append(k.getInt(w));
      if (w.played.size() > before) {
        if (plays.length() > 0) plays.append(',');
        plays.append("{\"i\":").append(i).append(",\"K\":").append(K.getInt(w)).append(",\"lcg\":").append(k.getInt(w)).append(",\"sound\":").append(w.played.get(before)).append("}");
        K.setInt(w, 0); // the countdown is reset to 0 so the next call rolls again
      }
    }
    Random r = (Random) get(w, "s");
    return "{\"seed\":" + seed + ",\"lcg\":" + lcg + ",\"player\":[" + px + "," + py + "," + pz + "],\"calls\":" + calls + ",\"trace\":[" + trace + "],\"plays\":[" + plays + "],\"finalLcg\":" + k.getInt(w) + ",\"nextInt\":" + r.nextInt() + "}";
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    StringBuilder out = new StringBuilder("{\"types\":[");
    bth[] types = bth.values();
    for (int i = 0; i < types.length; i++)
      out.append(i > 0 ? "," : "").append("{\"name\":").append(q(types[i].name())).append(",\"ordinal\":").append(types[i].ordinal())
        .append(",\"location\":").append(q(types[i].a().toString())).append(",\"min\":").append(types[i].b()).append(",\"max\":").append(types[i].c()).append("}");
    out.append("],\"sounds\":{");
    bso music = bso.a(new bqx("music.game")), record = bso.a(new bqx("records.cat"), 3f, 64f, -5f), gui = bso.a(new bqx("gui.button.press"), 1f);
    String[] names = {"music", "record", "gui"}; bso[] all = {music, record, gui};
    for (int i = 0; i < all.length; i++) {
      bso s = all[i];
      out.append(i > 0 ? "," : "").append(q(names[i])).append(":{\"location\":").append(q(s.b().toString())).append(",\"volume\":").append(s.e()).append(",\"pitch\":").append(s.f())
        .append(",\"repeat\":").append(s.c()).append(",\"delay\":").append(s.d()).append(",\"x\":").append(s.g()).append(",\"y\":").append(s.h()).append(",\"z\":").append(s.i())
        .append(",\"attenuation\":").append(q(s.j().name())).append("}");
    }
    out.append("},\"ticker\":[");
    bth MENU = bth.a, GAME = bth.b, CREATIVE = bth.c, CREDITS = bth.d, NETHER = bth.e, END_BOSS = bth.f, END = bth.g;
    out.append(ticker(1L, new Object[][] {{MENU, 3000}, {GAME, 60000}}, new int[] {2400, 3000, 1800})).append(',');
    out.append(ticker(42L, new Object[][] {{MENU, 400}, {GAME, 500}, {CREATIVE, 9000}, {GAME, 200}, {NETHER, 8000}, {END, 3000}, {END_BOSS, 2500}, {END, 600}, {CREDITS, 3000}, {MENU, 2000}}, new int[] {1500, 4000, 0, 900, 2200})).append(',');
    out.append(ticker(7L, new Object[][] {{GAME, 30}, {END, 30000}, {CREDITS, 20000}}, new int[] {0, 0, 0, 5000}));
    out.append("],\"mood\":[");
    AIR = (Blk) unsafe.allocateInstance(Blk.class); AIR.m = awt.a;
    STONE = (Blk) unsafe.allocateInstance(Blk.class); STONE.m = awt.e;
    out.append(mood(5L, 12345, 3.5, 40.0, 7.25, 60000)).append(',');
    out.append(mood(99L, -7, -4.75, 12.5, -2.0, 60000));
    out.append("]}");
    System.out.println(out);
  }
}
