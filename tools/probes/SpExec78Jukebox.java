import java.util.*;

// Batch 78 spexec78: jukebox insert and eject through ItemRecord.onItemUse (adr.a) and BlockJukebox (alq.a activate, alq.a breakBlock), the world's logged aux 1005 events then run through the real
// RenderGlobal.playAuxSFX (bma.a) and its World.playRecord listener (bma.a(String,III)) on the client double of SpSounds77Probe, with a recording sound handler and GuiIngame.
public class SpExec78Jukebox {
  public static class Snd extends btp {
    List<String> events = new ArrayList<>();
    Snd() { super(null, null); }
    public void a(bst s) { events.add(SpExec78Probe.q("play " + s.b() + " vol=" + s.e() + " pitch=" + s.f() + " @" + (double) s.g() + "," + (double) s.h() + "," + (double) s.i())); }
    public void b(bst s) { events.add(SpExec78Probe.q("stop " + s.b() + " @" + (double) s.g() + "," + (double) s.h() + "," + (double) s.i())); }
  }
  public static class Gui extends bbv {
    Snd snd;
    Gui() { super(null); }
    public void a(String m) { snd.events.add(SpExec78Probe.q("message " + m)); }
  }
  static Snd snd;
  static void rig() throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    snd = (Snd) u.allocateInstance(Snd.class); snd.events = new ArrayList<>();
    Gui gui = (Gui) u.allocateInstance(Gui.class); gui.snd = snd;
    bao mc = (bao) u.allocateInstance(bao.class);
    MobMoveProbe.set(mc, "aw", snd);
    MobMoveProbe.set(mc, "r", gui);
    bjf cw = (bjf) u.allocateInstance(bjf.class);
    MobMoveProbe.set(cw, "s", new Random(2));
    MobMoveProbe.set(cw, "L", mc);
    MobMoveProbe.set(mc, "i", (sv) DoorPaneProbe.player);
    bma rg = (bma) u.allocateInstance(bma.class);
    MobMoveProbe.set(rg, "r", cw);
    MobMoveProbe.set(rg, "A", mc);
    MobMoveProbe.set(rg, "P", new HashMap<Object, Object>());
    List<Object> listeners = new ArrayList<>(); listeners.add(rg);
    MobMoveProbe.set(cw, "u", listeners);
    SpSounds77Probe.rg = rg; SpSounds77Probe.cw = cw;
  }
  // The client replay of an aux event list: [type, x, y, z, data] lines from the world log
  static String replay(List<String> log) {
    List<String> out = new ArrayList<>();
    try { ((Map) MobMoveProbe.field(bma.class, "P").get(SpSounds77Probe.rg)).clear(); } catch (Exception e) { throw new RuntimeException(e); }
    for (String e : log) {
      if (!e.startsWith("aux ")) continue;
      String[] p = e.split(" ");
      int type = Integer.parseInt(p[1]);
      String[] r = p[2].split(",");
      snd.events.clear();
      String err = "null";
      try { SpSounds77Probe.rg.a(SpSounds77Probe.pl(), type, Integer.parseInt(r[0]), Integer.parseInt(r[1]), Integer.parseInt(r[2]), Integer.parseInt(r[3])); } catch (Throwable t) { err = SpExec78Probe.q(SpSounds77Probe.errOf(t)); }
      out.add("{\"aux\":" + SpExec78Probe.q(e) + ",\"client\":" + SpExec78Probe.jlist(new ArrayList<>(snd.events)) + ",\"error\":" + err + "}");
    }
    return SpExec78Probe.jlist(out);
  }
  static String sets(SoundSweepProbe.PW w) {
    List<String> l = new ArrayList<>();
    for (int[] s : w.sets) l.add("[" + s[0] + "," + s[1] + "," + s[2] + "," + s[3] + "," + s[4] + "]");
    return SpExec78Probe.jlist(l);
  }
  static void record(String name, int remote, SoundSweepProbe.PW w, String res, String err, String extra) {
    System.out.println("{\"kind\":\"jukebox\",\"name\":" + SpExec78Probe.q(name) + ",\"remote\":" + (remote == 1) + ",\"result\":" + res + ",\"error\":" + err + ",\"held\":" + SpSounds77Probe.heldJson() + ",\"sets\":" + sets(w)
      + ",\"spawned\":" + w.spawned.size() + extra + ",\"world\":" + SpSounds77Probe.all(w) + ",\"replay\":" + replay(w.log) + "}");
  }
  static List<String> keys() throws Exception {
    List<String> l = new ArrayList<>();
    for (Object k : new TreeSet<Object>(((Map) MobMoveProbe.field(adr.class, "b").get(null)).keySet())) l.add(SpExec78Probe.q(String.valueOf(k)));
    return l;
  }
  static void run() throws Exception {
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DoorPaneProbe.makePlayer();
    MobMoveProbe.field(sv.class, "f").set(DoorPaneProbe.player, new HashMap());
    rig();
    System.out.println("{\"kind\":\"jukebox-lookup\",\"byName\":" + (adr.b("13") != null) + ",\"byRecordsName\":" + (adr.b("records.13") != null)+ ",\"name\":" + SpExec78Probe.q(((adr) adb.d(2256)).a) + ",\"keys\":" + SpExec78Probe.jlist(keys()) + "}");
    // insert every record item
    int[] ids = {2256, 2257, 2258, 2259, 2260, 2261, 2262, 2263, 2264, 2265, 2266, 2267};
    for (int id : ids) for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = SpSounds77Probe.world(remote == 1, new int[][] {{8, 64, 8, 84, 0}});
      SpSounds77Probe.bind(w); SpSounds77Probe.resetPlayer();
      aor t = SpSounds77Probe.tile(w, 8, 64, 8, alr.class); SpSounds77Probe.setTilePos(t, w, 8, 64, 8);
      add st = new add(adb.d(id), 1, 0);
      SpSounds77Probe.held(st);
      String err = "null", res = "null";
      try { res = String.valueOf(adb.d(id).a(st, SpSounds77Probe.pl(), w, 8, 64, 8, 1, 0.5f, 0.5f, 0.5f)); } catch (Throwable x) { err = SpExec78Probe.q(SpSounds77Probe.errOf(x)); }
      int[] c = w.cell(8, 64, 8);
      record("insert-" + id, remote, w, res, err, ",\"meta\":" + c[1] + ",\"stackAfter\":" + st.b);
    }
    // eject by right click, by breaking the jukebox, and an empty jukebox; then insert over an existing sound at the same cell
    for (int remote = 0; remote < 2; remote++) {
      for (String how : new String[] {"eject-click", "eject-break", "click-empty"}) {
        SoundSweepProbe.PW w = SpSounds77Probe.world(remote == 1, new int[][] {{8, 64, 8, 84, how.equals("click-empty") ? 0 : 1}});
        SpSounds77Probe.bind(w); SpSounds77Probe.resetPlayer();
        aor t = SpSounds77Probe.tile(w, 8, 64, 8, alr.class); SpSounds77Probe.setTilePos(t, w, 8, 64, 8);
        if (!how.equals("click-empty")) ((alr) t).a(new add(adb.d(2257), 1, 0));
        SpSounds77Probe.held(null);
        String err = "null", res = "null";
        try {
          if (how.equals("eject-break")) { aji b = w.a(8, 64, 8); b.a(w, 8, 64, 8, b, 1); }
          else res = String.valueOf(w.a(8, 64, 8).a(w, 8, 64, 8, SpSounds77Probe.pl(), 1, 0.5f, 0.5f, 0.5f));
        } catch (Throwable x) { err = SpExec78Probe.q(SpSounds77Probe.errOf(x)); }
        int[] c = w.cell(8, 64, 8);
        record(how, remote, w, res, err, ",\"meta\":" + c[1]);
      }
    }
    // client-only sequences: play at a cell, play again at the same cell (stops the first), stop, stop again, a non-record data id
    String[][] seq = {{"1005,8,64,8,2256", "1005,8,64,8,2257", "1005,8,64,8,0", "1005,8,64,8,0"}, {"1005,8,64,8,1", "1005,8,64,8,2256", "1005,9,64,8,2258", "1005,8,64,8,0", "1005,9,64,8,0"}};
    int n = 0;
    for (String[] s : seq) {
      snd.events.clear();
      List<String> rows = new ArrayList<>();
      for (String e : s) {
        String[] p = e.split(",");
        snd.events.clear();
        String err = "null";
        try { SpSounds77Probe.rg.a(SpSounds77Probe.pl(), Integer.parseInt(p[0]), Integer.parseInt(p[1]), Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4])); } catch (Throwable t) { err = SpExec78Probe.q(SpSounds77Probe.errOf(t)); }
        rows.add("{\"aux\":" + SpExec78Probe.q(e) + ",\"client\":" + SpExec78Probe.jlist(new ArrayList<>(snd.events)) + ",\"error\":" + err + "}");
      }
      System.out.println("{\"kind\":\"jukebox-client\",\"sequence\":" + (n++) + ",\"steps\":" + SpExec78Probe.jlist(rows) + "}");
    }
  }
}
