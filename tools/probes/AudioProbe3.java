import java.lang.reflect.*;
import java.util.*;
import paulscode.sound.*;

// Minecraft Java 1.7.10 sound bookkeeping facts from the unchanged original classes (batch 19, audio round 3). Compile together
// with SoundProbe.java (it reuses that probe's fake paulscode library and player stub). No audio device is opened.
//  * "listener": SoundManager.setListener (btj.a(yz, float)) on an Unsafe-allocated player: the SET_LISTENER_POSITION and
//    SET_LISTENER_ORIENTATION commands it queues for interpolated positions, yaw and pitch.
//  * "bookkeeping": SoundManager.update (btj.d), isSoundPlaying (btj.a(bst)), stopSound, the 20-tick playingSoundsStopTime,
//    tickable sounds and repeat delays, driven against a fake library whose sources play or end on command.
//  * "moving": MovingSoundMinecart (bsm.a) and MovingSoundMinecartRiding (bsn.a) volume formulas on Unsafe-allocated carts.
public class AudioProbe3 {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String name) throws Exception { return SoundProbe.field(c, name); }
  static Object get(Object o, String n) throws Exception { return SoundProbe.get(o, n); }
  static void set(Object o, String n, Object v) throws Exception { SoundProbe.set(o, n, v); }

  // ---- SoundManager.setListener ----
  static String listener(Random r, int i) throws Exception {
    SoundProbe.P p = (SoundProbe.P) unsafe.allocateInstance(SoundProbe.P.class);
    double[] prev = {r.nextGaussian() * 500, 40 + r.nextGaussian() * 20, r.nextGaussian() * 500};
    double[] cur = {prev[0] + r.nextGaussian(), prev[1] + (i % 3 == 0 ? -0.08 : r.nextGaussian() * 0.3), prev[2] + r.nextGaussian()};
    float prevYaw = (float) (r.nextDouble() * 720 - 360), yaw = prevYaw + (float) (r.nextGaussian() * 20);
    float prevPitch = (float) (r.nextDouble() * 180 - 90), pitch = Math.max(-90f, Math.min(90f, prevPitch + (float) (r.nextGaussian() * 15)));
    float t = i == 0 ? 0f : i == 1 ? 1f : (float) r.nextDouble();
    if (i == 2) { prevYaw = yaw = 0; prevPitch = pitch = 0; }
    field(sa.class, "p").setDouble(p, prev[0]); field(sa.class, "q").setDouble(p, prev[1]); field(sa.class, "r").setDouble(p, prev[2]);
    field(sa.class, "s").setDouble(p, cur[0]); field(sa.class, "t").setDouble(p, cur[1]); field(sa.class, "u").setDouble(p, cur[2]);
    field(sa.class, "A").setFloat(p, prevYaw); field(sa.class, "y").setFloat(p, yaw);
    field(sa.class, "B").setFloat(p, prevPitch); field(sa.class, "z").setFloat(p, pitch);
    btj sm = (btj) unsafe.allocateInstance(btj.class);
    btn rec = (btn) unsafe.allocateInstance(btn.class);
    set(rec, "commandQueue", new LinkedList<CommandObject>());
    set(rec, "commandThread", new CommandThread(rec));
    set(sm, "f", true); set(sm, "e", rec);
    sm.a(p, t);
    List<CommandObject> q = (List<CommandObject>) get(rec, "commandQueue");
    String pos = "null", ori = "null";
    for (CommandObject c : q) {
      if (c.Command == CommandObject.SET_LISTENER_POSITION) pos = Arrays.toString(c.floatArgs);
      if (c.Command == CommandObject.SET_LISTENER_ORIENTATION) ori = Arrays.toString(c.floatArgs);
    }
    return "{\"prev\":" + Arrays.toString(prev) + ",\"cur\":" + Arrays.toString(cur) + ",\"prevYaw\":" + prevYaw + ",\"yaw\":" + yaw
      + ",\"prevPitch\":" + prevPitch + ",\"pitch\":" + pitch + ",\"t\":" + t + ",\"commands\":" + q.size() + ",\"position\":" + pos + ",\"orientation\":" + ori + "}";
  }

  // ---- SoundManager.update / isSoundPlaying ----
  public static class PSource extends Source {
    boolean alive;
    PSource() { super(false, false, false, null, null, null, 0f, 0f, 0f, 0, 0f, false); }
    public boolean playing() { return alive; }
  }
  public static class TS extends bsl {
    int updates, limit;
    TS() { super(new bqx("test.tickable")); }
    public void a() { updates++; if (updates >= limit) j = true; }
  }
  public static class RS extends bsk {
    RS(int delay) { super(new bqx("test.repeat")); g = true; h = delay; }
  }

  static String bookkeeping(long seed, int ops) throws Exception {
    Random r = new Random(seed);
    btj sm = (btj) unsafe.allocateInstance(btj.class);
    btn rec = (btn) unsafe.allocateInstance(btn.class);
    set(rec, "commandQueue", new LinkedList<CommandObject>());
    set(rec, "commandThread", new CommandThread(rec));
    SoundSystemConfig.setMasterGain(1f);
    SoundProbe.FLib lib = new SoundProbe.FLib(); lib.init();
    set(rec, "soundLibrary", lib);
    Map<String, Source> sources = (Map<String, Source>) get(lib, "sourceMap");
    SoundProbe.Handler h = (SoundProbe.Handler) unsafe.allocateInstance(SoundProbe.Handler.class);
    bto comp = new bto(new bqx("test.event"), 1.0, 1.0, w.e);
    comp.a(new SoundProbe.Entry(new bti(new bqx("test/file"), 1.0, 1.0, true), 1));
    h.composite = comp;
    SoundProbe.Gs gs = (SoundProbe.Gs) unsafe.allocateInstance(SoundProbe.Gs.class); gs.levels = new float[] {1, 1, 1, 1, 1, 1, 1, 1, 1};
    set(sm, "f", true); set(sm, "e", rec); set(sm, "c", h); set(sm, "d", gs);
    com.google.common.collect.BiMap<String, bst> bi = com.google.common.collect.HashBiMap.create(); // the constructor's playingSounds and its inverse
    set(sm, "h", bi); set(sm, "i", bi.inverse()); set(sm, "j", new HashMap<>()); set(sm, "n", new HashMap<>());
    set(sm, "m", new HashMap<>()); set(sm, "l", new ArrayList<>());
    set(sm, "k", com.google.common.collect.HashMultimap.create());
    Map<String, bst> playing = (Map<String, bst>) get(sm, "h");
    Map<String, Integer> stopTimes = (Map<String, Integer>) get(sm, "n");
    Map<bst, Integer> delayedMap = (Map<bst, Integer>) get(sm, "m");
    List<bsv> tickables = (List<bsv>) get(sm, "l");
    Field playTime = field(btj.class, "g");
    List<bst> sounds = new ArrayList<>();
    List<String> kinds = new ArrayList<>();
    Set<String> known = new HashSet<>();
    StringBuilder rows = new StringBuilder();
    int n = 0;
    for (int i = 0; i < ops; i++) {
      int op = r.nextInt(100);
      String row = null;
      if (op < 18 || sounds.isEmpty()) {
        // play: kind 0 plain, 1 tickable (done after `limit` updates), 2 repeat with delay; startsPlaying says whether the stream starts
        int kind = r.nextInt(4) == 0 ? 1 : r.nextInt(5) == 0 ? 2 : 0;
        boolean starts = r.nextInt(6) != 0;
        bst s; int arg = 0;
        if (kind == 1) { TS t = (TS) unsafe.allocateInstance(TS.class); set(t, "a", new bqx("test.tickable")); set(t, "b", 1f); set(t, "c", 1f); set(t, "i", bsu.b); t.limit = arg = 1 + r.nextInt(40); s = t; }
        else if (kind == 2) { arg = 1 + r.nextInt(6); RS rs = (RS) unsafe.allocateInstance(RS.class); set(rs, "a", new bqx("test.repeat")); set(rs, "b", 1f); set(rs, "c", 1f); set(rs, "i", bsu.b); set(rs, "g", true); set(rs, "h", arg); s = rs; }
        else s = new bso(new bqx("test.event"), 1f, 1f, 1.5f, 64f, -2.25f);
        sounds.add(s); kinds.add(kind + ":" + arg + ":" + (starts ? 1 : 0));
        sm.c(s);
        row = "[\"play\"," + (sounds.size() - 1) + "," + kind + "," + arg + "," + (starts ? 1 : 0) + "]";
      } else if (op < 35) {
        int k = r.nextInt(sounds.size());
        // the stream ends by itself: its source stops playing
        for (Map.Entry<String, bst> e : playing.entrySet()) if (e.getValue() == sounds.get(k) && sources.get(e.getKey()) instanceof PSource) ((PSource) sources.get(e.getKey())).alive = false;
        row = "[\"end\"," + k + "]";
      } else if (op < 42) {
        int k = r.nextInt(sounds.size());
        sm.b(sounds.get(k)); // stopSound: queues the stop command; the sound system executes it after the call (below)
        row = "[\"stop\"," + k + "]";
      } else if (op < 75) {
        sm.d();
        row = "[\"tick\"]";
      } else {
        int k = r.nextInt(sounds.size());
        row = "[\"query\"," + k + "," + (sm.a(sounds.get(k)) ? 1 : 0) + "]";
      }
      // sources of sounds that just started (including repeat re-plays) appear in the fake library, playing or not
      for (Map.Entry<String, bst> e : playing.entrySet()) {
        if (known.add(e.getKey())) {
          PSource ps = (PSource) unsafe.allocateInstance(PSource.class);
          int idx = sounds.indexOf(e.getValue());
          ps.alive = idx >= 0 && kinds.get(idx).endsWith(":1");
          sources.put(e.getKey(), ps);
        }
      }
      // the sound system then executes the queued stop commands: those sources no longer play (stopSound, a finished tickable sound)
      List<CommandObject> queued = (List<CommandObject>) get(rec, "commandQueue");
      for (CommandObject c : queued)
        if (c.Command == CommandObject.STOP && sources.get(c.stringArgs[0]) instanceof PSource) ((PSource) sources.get(c.stringArgs[0])).alive = false;
      queued.clear();
      row = row.substring(0, row.length() - 1) + "," + playTime.getInt(sm) + "," + playing.size() + "," + stopTimes.size() + "," + delayedMap.size() + "," + tickables.size() + "]";
      rows.append(n++ > 0 ? "," : "").append(row);
    }
    return "{\"seed\":" + seed + ",\"ops\":" + ops + ",\"rows\":[" + rows + "]}";
  }

  // ---- MovingSoundMinecart / MovingSoundMinecartRiding ----
  static String moving(Random r) throws Exception {
    StringBuilder rows = new StringBuilder();
    xn cart = (xn) unsafe.allocateInstance(xn.class);
    SoundProbe.P player = (SoundProbe.P) unsafe.allocateInstance(SoundProbe.P.class);
    bsm base = new bsm(cart);
    bsn inside = new bsn(player, cart);
    field(sa.class, "m").set(player, cart);
    Field vol = field(bsk.class, "b"), done = field(bsl.class, "j");
    Field px = field(bsk.class, "d"), py = field(bsk.class, "e"), pz = field(bsk.class, "f"), dist = field(bsm.class, "l");
    for (int i = 0; i < 160; i++) {
      double mx = i % 7 == 0 ? 0 : r.nextGaussian() * 0.25, mz = i % 11 == 0 ? 0 : r.nextGaussian() * 0.25;
      if (i % 5 == 0) { mx *= 0.02; mz *= 0.02; }
      boolean dead = i == 150, riding = i < 120 || i > 140;
      field(sa.class, "v").setDouble(cart, mx); field(sa.class, "x").setDouble(cart, mz);
      field(sa.class, "s").setDouble(cart, 10 + i * 0.5); field(sa.class, "t").setDouble(cart, 64.0625 + i * 0.01); field(sa.class, "u").setDouble(cart, -3 - i * 0.25);
      field(sa.class, "K").setBoolean(cart, dead);
      field(sa.class, "m").set(player, riding ? cart : null);
      boolean baseDone = done.getBoolean(base), insideDone = done.getBoolean(inside);
      base.a(); inside.a();
      rows.append(i > 0 ? "," : "").append("{\"mx\":" + mx + ",\"mz\":" + mz + ",\"dead\":" + dead + ",\"riding\":" + riding
        + ",\"x\":" + px.getFloat(base) + ",\"y\":" + py.getFloat(base) + ",\"z\":" + pz.getFloat(base)
        + ",\"baseVolume\":" + vol.getFloat(base) + ",\"baseDistance\":" + dist.getFloat(base) + ",\"baseDone\":" + done.getBoolean(base)
        + ",\"insideVolume\":" + vol.getFloat(inside) + ",\"insideDone\":" + done.getBoolean(inside) + "}");
    }
    return "[" + rows + "]";
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    SoundProbe.unsafe = unsafe;
    Random r = new Random(19);
    StringBuilder out = new StringBuilder("{\"listener\":[");
    for (int i = 0; i < 40; i++) out.append(i > 0 ? "," : "").append(listener(r, i));
    out.append("],\"bookkeeping\":[").append(bookkeeping(1L, 500)).append(',').append(bookkeeping(2L, 900)).append(',').append(bookkeeping(3L, 700));
    out.append("],\"moving\":").append(moving(r)).append("}");
    System.out.println(out);
    System.out.flush();
    System.exit(0);
  }
}
