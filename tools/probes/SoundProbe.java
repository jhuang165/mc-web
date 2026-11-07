import java.lang.reflect.*;
import java.nio.FloatBuffer;
import java.util.*;
import paulscode.sound.*;

// Minecraft Java 1.7.10 sound-engine facts from the unchanged original classes (batch 18, audio round 2):
//  * "manager": SoundManager.playSound (btj.c) run over a recording SoundSystem (btn subclass): the volume, pitch, category
//    and attenuation values handed to paulscode (newSource / newStreamingSource / setVolume / setPitch), master-volume skips.
//  * "gain": paulscode's SourceLWJGLOpenAL.calculateDistance / calculateGain (soundsystem 20120107, librarylwjglopenal
//    20100824) on an Unsafe-allocated source: the LINEAR falloff and the other models.
//  * "channels": paulscode's Library.getNextChannel (28 normal + 4 streaming channels, round-robin, eviction) driven through
//    a Library subclass with fake channels and sources.
//  * "light": World.setActivePlayerChunksAndCheckLight (ahb.C): the countdown and the per-tick light-check Random draws.
// Nothing here opens an audio device: SoundSystem and OpenAL are never started.
// Output: one JSON object; tools/verify-sound.mjs writes public/research/sound-reference.json and src/sound.test.js replays it.
public class SoundProbe {
  static sun.misc.Unsafe unsafe;
  static Field field(Class<?> c, String name) throws Exception {
    for (; c != null; c = c.getSuperclass())
      try { Field f = c.getDeclaredField(name); f.setAccessible(true); return f; } catch (NoSuchFieldException e) {}
    throw new NoSuchFieldException(name);
  }
  static Object get(Object o, String n) throws Exception { return field(o.getClass(), n).get(o); }
  static void set(Object o, String n, Object v) throws Exception { field(o.getClass(), n).set(o, v); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  // ---- SoundManager.playSound over a recording sound system ----
  public static class Entry implements btu {
    final bti pool; final int weight;
    Entry(bti pool, int weight) { this.pool = pool; this.weight = weight; }
    public int a() { return weight; }
    public bti b() { return pool; }
    public Object g() { return pool; }
  }
  public static class Handler extends btp {
    Handler() { super(null, null); }
    bto composite;
    public bto a(bqx location) { return composite; }
  }
  public static class Gs extends bbj {
    Gs() { super(null, null); }
    float[] levels = new float[9];
    public float a(w category) { return levels[category.ordinal()]; }
  }

  static String manager(float volume, float pitch, double entryVolume, double entryPitch, w category, float[] levels, float master, boolean stream, boolean linear) throws Exception {
    btj sm = (btj) unsafe.allocateInstance(btj.class);
    btn rec = (btn) unsafe.allocateInstance(btn.class);
    // btn's constructor is private: the real SoundSystem is allocated bare and its command queue is read instead of a device.
    set(rec, "commandQueue", new LinkedList<CommandObject>());
    set(rec, "commandThread", new CommandThread(rec));
    SoundSystemConfig.setMasterGain(master);
    Handler h = (Handler) unsafe.allocateInstance(Handler.class);
    bto comp = new bto(new bqx("test.event"), 1.0, 1.0, category);
    comp.a(new Entry(new bti(new bqx("test/file"), entryPitch, entryVolume, stream), 1));
    h.composite = comp;
    Gs gs = (Gs) unsafe.allocateInstance(Gs.class); gs.levels = levels;
    set(sm, "f", true); set(sm, "e", rec); set(sm, "c", h); set(sm, "d", gs);
    set(sm, "h", new HashMap<>()); set(sm, "i", new HashMap<>()); set(sm, "j", new HashMap<>()); set(sm, "n", new HashMap<>());
    set(sm, "m", new HashMap<>()); set(sm, "l", new ArrayList<>());
    set(sm, "k", com.google.common.collect.HashMultimap.create());
    bst sound = linear ? new bso(new bqx("test.event"), volume, pitch, 1.5f, 64f, -2.25f) : bso.a(new bqx("test.event"), volume);
    sm.c(sound);
    StringBuilder b = new StringBuilder("{\"volume\":" + volume + ",\"pitch\":" + pitch + ",\"entryVolume\":" + entryVolume + ",\"entryPitch\":" + entryPitch
      + ",\"category\":" + q(category.a()) + ",\"levels\":" + Arrays.toString(levels) + ",\"master\":" + master + ",\"stream\":" + stream + ",\"linear\":" + linear + ",\"calls\":[");
    List<CommandObject> q = (List<CommandObject>) get(rec, "commandQueue");
    for (int i = 0; i < q.size(); i++) {
      CommandObject c = q.get(i);
      b.append(i > 0 ? "," : "");
      if (c.Command == CommandObject.NEW_SOURCE)
        b.append("{\"call\":\"newSource\",\"priority\":" + c.boolArgs[0] + ",\"stream\":" + c.boolArgs[1] + ",\"loop\":" + c.boolArgs[2] + ",\"x\":" + c.floatArgs[0] + ",\"y\":" + c.floatArgs[1] + ",\"z\":" + c.floatArgs[2] + ",\"att\":" + c.intArgs[0] + ",\"dist\":" + c.floatArgs[3] + "}");
      else if (c.Command == CommandObject.SET_VOLUME) b.append("{\"call\":\"setVolume\",\"value\":" + c.floatArgs[0] + "}");
      else if (c.Command == CommandObject.SET_PITCH) b.append("{\"call\":\"setPitch\",\"value\":" + c.floatArgs[0] + "}");
      else if (c.Command == CommandObject.PLAY) b.append("{\"call\":\"play\"}");
      else b.append("{\"call\":" + c.Command + "}");
    }
    return b.append("]}").toString();
  }

  // ---- paulscode gain ----
  static String gain(int att, float dist, float[] lp, float[] sp) throws Exception {
    Class<?> c = Class.forName("paulscode.sound.libraries.SourceLWJGLOpenAL");
    Source s = (Source) unsafe.allocateInstance(c);
    s.position = new Vector3D(sp[0], sp[1], sp[2]);
    s.attModel = att; s.distOrRoll = dist;
    FloatBuffer lb = FloatBuffer.wrap(new float[] {lp[0], lp[1], lp[2]});
    set(s, "listenerPosition", lb);
    Method cd = c.getDeclaredMethod("calculateDistance"); cd.setAccessible(true); cd.invoke(s);
    Method cg = c.getDeclaredMethod("calculateGain"); cg.setAccessible(true); cg.invoke(s);
    return "{\"att\":" + att + ",\"dist\":" + dist + ",\"listener\":" + Arrays.toString(lp) + ",\"pos\":" + Arrays.toString(sp) + ",\"distance\":" + s.distanceFromListener + ",\"gain\":" + s.gain + "}";
  }

  // ---- Library.getNextChannel ----
  public static class FChannel extends Channel {
    FChannel(int type) { super(type); }
    public boolean playing() { return attachedSource instanceof FSource && ((FSource) attachedSource).alive; }
  }
  public static class FSource extends Source {
    int id; boolean alive;
    FSource() { super(false, false, false, null, null, null, 0f, 0f, 0f, 0, 0f, false); }
  }
  public static class FLib extends Library {
    FLib() throws SoundSystemException { super(); }
    protected Channel createChannel(int type) { return new FChannel(type); }
    public void cleanup() {}
  }
  static String channels(long seed, int ops, double endChance) throws Exception {
    FLib lib = new FLib(); lib.init();
    Method next = Library.class.getDeclaredMethod("getNextChannel", Source.class); next.setAccessible(true);
    Map<String, Source> sources = (Map<String, Source>) get(lib, "sourceMap");
    List<Channel> normal = (List<Channel>) get(lib, "normalChannels"), streaming = (List<Channel>) get(lib, "streamingChannels");
    Random r = new Random(seed);
    List<FSource> alive = new ArrayList<>();
    StringBuilder rows = new StringBuilder();
    int id = 0, n = 0;
    for (int i = 0; i < ops; i++) {
      if (!alive.isEmpty() && r.nextDouble() < endChance) {
        FSource s = alive.remove(r.nextInt(alive.size()));
        s.alive = false;
        rows.append(n++ > 0 ? "," : "").append("[\"end\",").append(s.id).append("]");
        continue;
      }
      FSource s = (FSource) unsafe.allocateInstance(FSource.class);
      s.id = ++id; s.alive = true; s.toStream = r.nextInt(8) == 0; s.priority = false; s.sourcename = "s" + s.id;
      sources.put(s.sourcename, s);
      Channel c = (Channel) next.invoke(lib, s);
      List<Channel> pool = s.toStream ? streaming : normal;
      int index = pool.indexOf(c);
      Source prev = c.attachedSource;
      boolean prevPlaying = prev != null && prev.playing();
      int prevId = prev instanceof FSource ? ((FSource) prev).id : 0;
      c.attachedSource = s; s.channel = c;
      alive.removeIf(a -> !a.playing() && false);
      alive.add(s);
      // a stolen source no longer plays: it drops out of the live set
      if (prev instanceof FSource && prev != s) alive.remove(prev);
      rows.append(n++ > 0 ? "," : "").append("[\"play\",").append(s.id).append(",").append(s.toStream ? 1 : 0).append(",").append(index).append(",").append(prevId).append(",").append(prevPlaying ? 1 : 0).append("]");
    }
    return "{\"seed\":" + seed + ",\"ops\":" + ops + ",\"endChance\":" + endChance + ",\"normal\":" + normal.size() + ",\"streaming\":" + streaming.size() + ",\"rows\":[" + rows + "]}";
  }

  // ---- World.setActivePlayerChunksAndCheckLight (ahb.C) ----
  public static class LW extends ahb {
    LW() { super(null, null, (aqo) null, null, null); }
    List<String> checks;
    protected apu j() { return null; }
    protected int p() { return 0; }
    public sa a(int id) { return null; }
    public boolean t(int x, int y, int z) { checks.add("[" + x + "," + y + "," + z + "]"); return false; }
  }
  public static class P extends yz {
    P() { super(null, null); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
  }
  static String light(long seed, int countdown, double[][] players, int calls) throws Exception {
    LW w = (LW) unsafe.allocateInstance(LW.class);
    w.checks = new ArrayList<>();
    set(w, "s", new Random(seed));
    set(w, "C", new qi());
    set(w, "F", new HashSet<>());
    field(ahb.class, "K").setInt(w, countdown);
    List<Object> list = new ArrayList<>();
    for (double[] pl : players) {
      P p = (P) unsafe.allocateInstance(P.class);
      field(sa.class, "s").setDouble(p, pl[0]); field(sa.class, "t").setDouble(p, pl[1]); field(sa.class, "u").setDouble(p, pl[2]);
      list.add(p);
    }
    set(w, "h", list);
    Method m = ahb.class.getDeclaredMethod("C"); m.setAccessible(true);
    Field K = field(ahb.class, "K");
    StringBuilder ks = new StringBuilder(), cs = new StringBuilder();
    for (int i = 0; i < calls; i++) {
      m.invoke(w);
      if (i < 40) ks.append(i > 0 ? "," : "").append(K.getInt(w));
    }
    for (int i = 0; i < Math.min(60, w.checks.size()); i++) cs.append(i > 0 ? "," : "").append(w.checks.get(i));
    Random r = (Random) get(w, "s");
    StringBuilder pls = new StringBuilder();
    for (int i = 0; i < players.length; i++) pls.append(i > 0 ? "," : "").append(Arrays.toString(players[i]));
    return "{\"seed\":" + seed + ",\"countdown\":" + countdown + ",\"players\":[" + pls + "],\"calls\":" + calls + ",\"countdowns\":[" + ks + "],\"checkCount\":" + w.checks.size()
      + ",\"checks\":[" + cs + "],\"nextInt\":" + r.nextInt() + "}";
  }

  public static void main(String[] args) throws Exception {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); unsafe = (sun.misc.Unsafe) uf.get(null);
    StringBuilder out = new StringBuilder("{\"categories\":[");
    w[] cats = w.values();
    for (int i = 0; i < cats.length; i++) out.append(i > 0 ? "," : "").append(q(cats[i].a()));
    out.append("],\"manager\":[");
    float[] all1 = {1, 1, 1, 1, 1, 1, 1, 1, 1};
    float[] mixed = {1, 0.5f, 0.25f, 0.8f, 0.3f, 0.6f, 0.9f, 0.1f, 0.7f};
    float[] zeroed = {1, 0, 0, 0, 0, 0, 0, 0, 0};
    w[] pick = {w.a, w.b, w.c, w.d, w.e, w.f, w.g, w.h, w.i};
    List<String> cases = new ArrayList<>();
    Random r = new Random(18);
    cases.add(manager(1f, 1f, 1.0, 1.0, w.e, all1, 1f, false, true));
    cases.add(manager(0.7f, 0.9f, 1.0, 1.0, w.i, mixed, 1f, false, true));
    cases.add(manager(4f, 1f, 1.0, 1.0, w.c, all1, 1f, true, true));        // a record: volume 4 -> 64 blocks
    cases.add(manager(10000f, 1f, 1.0, 1.0, w.d, all1, 1f, false, true));   // thunder
    cases.add(manager(2f, 1f, 1.0, 1.0, w.f, mixed, 1f, false, true));      // 16 * 2
    cases.add(manager(1f, 1f, 1.0, 1.0, w.e, all1, 1f, false, false));      // attenuation NONE
    cases.add(manager(0.25f, 1f, 1.0, 1.0, w.a, all1, 1f, false, false));   // gui
    cases.add(manager(1f, 1f, 1.0, 1.0, w.e, zeroed, 1f, false, true));     // block category 0: unchanged level 0
    cases.add(manager(1f, 1f, 1.0, 1.0, w.b, zeroed, 1f, true, true));      // music slider 0: skipped
    cases.add(manager(1f, 1f, 1.0, 1.0, w.e, all1, 0f, false, true));       // master 0: skipped
    cases.add(manager(1f, 3.5f, 1.0, 1.0, w.e, all1, 1f, false, true));     // pitch clamp high
    cases.add(manager(1f, 0.1f, 1.0, 1.0, w.e, all1, 1f, false, true));     // pitch clamp low
    cases.add(manager(1f, 1f, 0.5, 1.5, w.e, all1, 1f, false, true));       // entry volume and pitch
    for (int i = 0; i < 40; i++) {
      float[] lv = new float[9];
      for (int k = 0; k < 9; k++) lv[k] = r.nextInt(5) == 0 ? 0f : (float) (r.nextInt(21) / 20.0);
      float v = i % 5 == 0 ? 1f + r.nextInt(9) : (float) (r.nextInt(30) / 20.0);
      cases.add(manager(v, (float) (r.nextInt(50) / 20.0), 0.2 + r.nextInt(9) / 10.0, 0.5 + r.nextInt(16) / 10.0, pick[r.nextInt(9)], lv, 1f, r.nextInt(6) == 0, r.nextInt(5) != 0));
    }
    out.append(String.join(",", cases));
    out.append("],\"gain\":[");
    cases.clear();
    int[] models = {0, 1, 2, 2, 2, 2, 2, 2};
    for (int i = 0; i < 80; i++) {
      float[] lp = {(float) (r.nextGaussian() * 40), (float) (60 + r.nextGaussian() * 10), (float) (r.nextGaussian() * 40)};
      float scale = i % 4 == 0 ? 90f : 20f;
      float[] sp = {lp[0] + (float) (r.nextGaussian() * scale), lp[1] + (float) (r.nextGaussian() * scale / 3), lp[2] + (float) (r.nextGaussian() * scale)};
      float dist = new float[] {16f, 16f, 32f, 64f, 160000f}[r.nextInt(5)];
      if (i == 0) { sp = lp.clone(); }
      if (i == 1) { sp = new float[] {lp[0] + dist, lp[1], lp[2]}; }
      cases.add(gain(models[r.nextInt(models.length)], dist, lp, sp));
    }
    out.append(String.join(",", cases));
    out.append("],\"channels\":[");
    out.append(channels(1L, 600, 0.45)).append(',').append(channels(2L, 1500, 0.2)).append(',').append(channels(3L, 800, 0.1));
    out.append("],\"light\":[");
    out.append(light(7L, 20, new double[][] {{3.5, 40.0, 7.25}}, 5000)).append(',');
    out.append(light(13L, 0, new double[][] {{-4.75, 12.5, -2.0}}, 5000)).append(',');
    out.append(light(21L, 5, new double[][] {}, 300));
    out.append("]}");
    System.out.println(out);
    System.out.flush();
    System.exit(0);
  }
}
