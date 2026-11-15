import java.util.*;

// Minecraft Java 1.7.10 single-player sound sweep from the unchanged original classes (batch 75 spsounds75).
//  - place: Item.onItemUse (ItemBlock, ItemReed, ItemSlab, ItemSnow, ItemSeeds, ItemDoor, ...) for every registered item id (damage 0..15 for ids below 256,
//    0 and 3 above) on a client-flagged world double; the record keeps every World.playSoundEffect (name, volume, pitch, position) and the cells that changed.
//    Scenarios: stone floor, stone wall, farmland, soul sand, sand beside water, grass, dirt, a snow layer, a half slab, tall grass.
//  - break: RenderGlobal.playAuxSFX (bma.a) with type 2001 for every original block id and metadata 0..15: the real code builds the PositionedSoundRecord
//    from the block's SoundType; the sound handler double records name, volume, pitch and position.
//  - step: Entity.func_145780_a (sa.a(int,int,int,aji)) for every original block id, plain and with a snow layer above: the entity sound call (World.playSoundAtEntity).
// Records (JSON lines): kind place / break / step.
public class SoundSweepProbe {
  public static class PW extends ClientPredictProbe.CW {
    public void a(double x, double y, double z, String s, float v, float p) { log.add("sound " + s + " " + v + " " + p + " @" + x + "," + y + "," + z); }
    public void a(double x, double y, double z, String s, float v, float p, boolean d) { log.add("sound " + s + " " + v + " " + p + " @" + x + "," + y + "," + z); } // EntityClientPlayerMP.playSound (client world, own sounds)
    public void a(sa e, String s, float v, float p) { log.add("ent " + s + " " + v + " " + p); }
    public void a(yz e, String s, float v, float p) { log.add("ent " + s + " " + v + " " + p); } // EntityPlayer.playSound -> World.playSoundToNearExcept
  }

  public static class Snd extends btp {
    List<String> played = new ArrayList<>();
    public Snd() { super(null, null); }
    public void a(bst sound) { played.add(sound.b().toString() + " " + sound.e() + " " + sound.f() + " @" + (double) sound.g() + "," + (double) sound.h() + "," + (double) sound.i()); }
  }

  static String q(String s) { return DoorPaneProbe.q(s); }
  static void line(String s) { System.out.println(s); }

  static PW world(int[][] setup) throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    PW w = (PW) u.allocateInstance(PW.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(w, u.allocateInstance(ays.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, true);
    MobMoveProbe.set(w, "v", BedProbe.chunkProvider());
    MobMoveProbe.set(w, "u", new ArrayList<Object>());
    w.tiles = new HashMap<>();
    w.cells = new HashMap<>();
    w.spawned = new ArrayList<>();
    w.scheduled = new ArrayList<>();
    w.sets = new ArrayList<>();
    w.log = new ArrayList<>();
    w.power = new HashSet<>();
    w.base = (x, y, z) -> new int[] {y < 0 ? 1 : (y == 63 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : 0), 0};
    for (int[] c : setup) w.put(c[0], c[1], c[2], c[3], c[4]);
    return w;
  }

  static int[][] s(int[]... cs) { return cs; }
  static int[] c(int x, int y, int z, int id, int meta) { return new int[] {x, y, z, id, meta}; }

  static Map<String, int[]> snap(PW w) {
    Map<String, int[]> m = new TreeMap<>();
    for (int x = 6; x <= 10; x++) for (int y = 62; y <= 66; y++) for (int z = 6; z <= 10; z++) { int[] k = w.cell(x, y, z); m.put(x + "," + y + "," + z, new int[] {x, y, z, k[0], k[1]}); }
    return m;
  }
  static String diff(Map<String, int[]> before, PW w) {
    List<String> l = new ArrayList<>();
    for (int[] b : before.values()) { int[] k = w.cell(b[0], b[1], b[2]); if (k[0] != b[3] || k[1] != b[4]) l.add("[" + b[0] + "," + b[1] + "," + b[2] + "," + k[0] + "," + k[1] + "]"); }
    return "[" + String.join(",", l) + "]";
  }
  static String sounds(PW w) {
    List<String> l = new ArrayList<>();
    for (String e : w.log) if (e.startsWith("sound ") || e.startsWith("ent ")) l.add(q(e));
    return "[" + String.join(",", l) + "]";
  }

  // name, setup, click cell, side
  static final Object[][] SCENARIOS = {
    {"stone-floor", s(), new int[] {8, 63, 8}, 1},
    {"stone-wall", s(c(8, 64, 8, 1, 0)), new int[] {8, 64, 8}, 3},
    {"farmland", s(c(8, 63, 8, 60, 7)), new int[] {8, 63, 8}, 1},
    {"soul-sand", s(c(8, 63, 8, 88, 0)), new int[] {8, 63, 8}, 1},
    {"sand-water", s(c(8, 63, 8, 12, 0), c(7, 63, 8, 9, 0)), new int[] {8, 63, 8}, 1},
    {"grass", s(c(8, 63, 8, 2, 0)), new int[] {8, 63, 8}, 1},
    {"dirt", s(c(8, 63, 8, 3, 0)), new int[] {8, 63, 8}, 1},
    {"snow-layer", s(c(8, 64, 8, 78, 0)), new int[] {8, 64, 8}, 1},
    {"half-slab", s(c(8, 64, 8, 44, 0)), new int[] {8, 64, 8}, 1},
    {"tall-grass", s(c(8, 64, 8, 31, 1)), new int[] {8, 64, 8}, 1},
  };

  static String run(int item, int damage, Object[] sc) throws Exception {
    int[][] setup = (int[][]) sc[1];
    int[] at = (int[]) sc[2];
    PW w = world(setup);
    Map<String, int[]> before = snap(w);
    MobMoveProbe.field(sa.class, "y").setFloat(DoorPaneProbe.player, 0f);
    String err = "null", res = "null";
    int count = 0;
    try {
      adb it = adb.d(item);
      add st = new add(it, 3, damage);
      boolean r = it.a(st, (yz) DoorPaneProbe.player, w, at[0], at[1], at[2], (Integer) sc[3], 0.5f, 0.5f, 0.5f);
      res = String.valueOf(r);
      count = st.b;
    } catch (Throwable t) { err = q(t.toString()); }
    return "\"result\":" + res + ",\"count\":" + count + ",\"error\":" + err + ",\"sounds\":" + sounds(w) + ",\"diff\":" + diff(before, w);
  }

  static void places() throws Exception {
    for (int id = 1; id < 4096; id++) {
      if (adb.d(id) == null) continue;
      int[] damages = id < 256 ? new int[] {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15} : new int[] {0, 3};
      for (Object[] sc : SCENARIOS) {
        String base = null;
        for (int d : damages) {
          String body;
          try { body = run(id, d, sc); } catch (Throwable t) { body = "\"error\":" + q(t.toString()); }
          if (d == 0) base = body;
          else if (body.equals(base)) continue;
          // an attempt that did nothing and played nothing is not recorded
          if (body.contains("\"sounds\":[]") && body.contains("\"diff\":[]")) continue;
          line("{\"kind\":\"place\",\"item\":" + id + ",\"damage\":" + d + ",\"scenario\":" + q((String) sc[0]) + "," + body + "}");
        }
      }
    }
  }

  static void breaks() throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    PW w = world(s());
    Snd handler = (Snd) u.allocateInstance(Snd.class);
    handler.played = new ArrayList<>();
    bao mc = (bao) u.allocateInstance(bao.class);
    MobMoveProbe.set(mc, "aw", handler);
    bjf cw = (bjf) u.allocateInstance(bjf.class);
    MobMoveProbe.set(cw, "s", new Random(2));
    bma rg = (bma) u.allocateInstance(bma.class);
    MobMoveProbe.set(rg, "r", cw);
    MobMoveProbe.set(rg, "A", mc);
    for (int id = 0; id < 176; id++) {
      if (aji.e(id) == null) continue;
      if (id != 0 && aji.b(aji.e(id)) != id) continue;
      for (int meta = 0; meta < 16; meta++) {
        handler.played.clear();
        String err = "null";
        try { rg.a((yz) DoorPaneProbe.player, 2001, 8, 64, 8, id + (meta << 12)); } catch (Throwable t) { err = q(t.getClass().getName() + " " + (t.getStackTrace().length > 0 ? t.getStackTrace()[0] : "")); } // the particle half after the sound may fail on the stubs
        List<String> l = new ArrayList<>();
        for (String e : handler.played) l.add(q(e));
        line("{\"kind\":\"break\",\"id\":" + id + ",\"meta\":" + meta + ",\"sounds\":[" + String.join(",", l) + "],\"after\":" + err + "}");
      }
    }
  }

  static void steps() throws Exception {
    java.lang.reflect.Method m = sa.class.getDeclaredMethod("a", int.class, int.class, int.class, aji.class);
    m.setAccessible(true);
    for (int id = 0; id < 176; id++) {
      if (aji.e(id) == null) continue;
      if (id != 0 && aji.b(aji.e(id)) != id) continue;
      for (int snow = 0; snow < 2; snow++) {
        PW w = world(snow == 1 ? s(c(8, 63, 8, id, 0), c(8, 64, 8, 78, 0)) : s(c(8, 63, 8, id, 0)));
        MobMoveProbe.field(sa.class, "o").set(DoorPaneProbe.player, w);
        String err = "null";
        try { m.invoke(DoorPaneProbe.player, 8, 63, 8, aji.e(id)); } catch (Throwable t) { err = q(String.valueOf(t.getCause() != null ? t.getCause() : t)); }
        line("{\"kind\":\"step\",\"id\":" + id + ",\"snowAbove\":" + (snow == 1) + ",\"sounds\":" + sounds(w) + ",\"error\":" + err + "}");
      }
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); alb.e();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DoorPaneProbe.makePlayer();
    breaks();
    steps();
    places();
  }
}
