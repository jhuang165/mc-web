import java.lang.reflect.*;
import java.util.*;

// Minecraft Java 1.7.10 single-player sound sweep, part 3 (batch 77 spsounds77), from the unchanged original classes on the SoundSweepProbe world double.
//  - activate: Block.onBlockActivated (aji.a(ahb,III,yz,I,F,F,F)) for doors, trapdoors, fence gates, levers, buttons, repeater, comparator, cake, jukebox, note block, TNT with flint and steel,
//    on a remote and a non-remote world; records World.playSoundEffect / playSoundAtEntity / aux events. Aux events are then run through the real RenderGlobal.playAuxSFX (bma.a)
//    to get the sound names, volumes and pitches (1003 picks door_open or door_close with Math.random, so it is run 64 times and aggregated).
//  - plate: Block.onEntityCollidedWithBlock (aji.a(ahb,III,sa)) with the player on the four pressure plates.
//  - chest: TileEntityChest.updateEntity (aow.h) and TileEntityEnderChest (ape.h) over 40 ticks opening and closing.
//  - note: BlockNote.onBlockEventReceived (amj.a(ahb,III,I,I)) for all instruments and pitches.
//  - item: ItemBow.onPlayerStoppedUsing, ItemLilyPad.onItemRightClick, ItemEnderEye.onItemRightClick (with and without a stronghold) and onItemUse on an end portal frame,
//    ItemFlintAndSteel.onItemUse on TNT and an obsidian frame, ItemRecord.onItemUse on a jukebox, ItemFood.onEaten, EntityPlayer.updateItemUse (yz.c) for drinking and eating.
//  - impact: EntityPotion / EntityExpBottle onImpact (zo.a(azu), zn.a(azu)).
// Records (JSON lines): kind activate / plate / chest / note / item / impact / aux. No classes patched.
public class SpSounds77Probe {
  static String q(String s) { return SoundSweepProbe.q(s); }
  // Random that records every nextFloat (the pitch of a sound is one of these draws)
  public static class LR extends Random {
    List<Float> d = new ArrayList<>();
    LR(long seed) { super(seed); }
    public float nextFloat() { float v = super.nextFloat(); d.add(v); return v; }
  }
  static LR wr, pr;
  static String draws() {
    StringBuilder b = new StringBuilder("\"draws\":[");
    for (int i = 0; i < wr.d.size(); i++) b.append(i > 0 ? "," : "").append(wr.d.get(i));
    b.append("],\"pdraws\":[");
    for (int i = 0; i < pr.d.size(); i++) b.append(i > 0 ? "," : "").append(pr.d.get(i));
    return b.append("],").toString();
  }
  static void line(String s) { System.out.println(s); }

  static bma rg; static SoundSweepProbe.Snd handler; static bjf cw;
  static void rig() throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    handler = (SoundSweepProbe.Snd) u.allocateInstance(SoundSweepProbe.Snd.class);
    handler.played = new ArrayList<>();
    bao mc = (bao) u.allocateInstance(bao.class);
    MobMoveProbe.set(mc, "aw", handler);
    cw = (bjf) u.allocateInstance(bjf.class);
    MobMoveProbe.set(cw, "s", new Random(2));
    MobMoveProbe.set(cw, "u", new ArrayList<Object>());
    MobMoveProbe.set(cw, "L", mc);
    MobMoveProbe.set(mc, "i", (sv) DoorPaneProbe.player);
    rg = (bma) u.allocateInstance(bma.class);
    MobMoveProbe.set(rg, "r", cw);
    MobMoveProbe.set(rg, "A", mc);
  }

  static Set<String> auxSeen = new TreeSet<>();

  // ---- shearing a sheep (EntitySheep.interact, wp.a(yz)) ----
  static void shear() throws Exception {
    Object[][] cases = {{"shears-adult", 359, 0, false, false}, {"shears-sheared", 359, 0, true, false}, {"shears-child", 359, 0, false, true}, {"empty-hand", 0, 0, false, false}, {"wheat", 296, 0, false, false}};
    for (Object[] c : cases) for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[0][]);
      bind(w); resetPlayer();
      String err = "null", res = "null";
      int dmg = -1;
      try {
        wp sheep = (wp) PlantProbe.unsafe.allocateInstance(wp.class);
        MobMoveProbe.set(sheep, "o", w); MobMoveProbe.set(sheep, "Z", new Random(5));
        MobMoveProbe.set(sheep, "C", azt.a(0, 0, 0, 0, 0, 0));
        te watcher = new te(sheep); MobMoveProbe.set(sheep, "af", watcher);
        watcher.a(16, Byte.valueOf((byte) ((Boolean) c[3] ? 16 : 0)));
        watcher.a(12, Integer.valueOf((Boolean) c[4] ? -24000 : 0));
        MobMoveProbe.set(sheep, "s", 8.5); MobMoveProbe.set(sheep, "t", 64.0); MobMoveProbe.set(sheep, "u", 8.5);
        add st = (Integer) c[1] > 0 ? new add(adb.d((Integer) c[1]), 1, 0) : null;
        held(st);
        res = String.valueOf(sheep.a(pl()));
        if (st != null) dmg = st.k();
      } catch (Throwable t) { err = errOf(t); }
      item("sheep-interact-" + c[0], remote, w, res, err, "\"toolDamage\":" + dmg + ",");
    }
    resetPlayer();
  }

  // ---- arrow flight into a block (EntityArrow.onUpdate, zc.h) ----
  static void arrows() throws Exception {
    for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[][] {{8, 64, 12, 1, 0}});
      bind(w); resetPlayer();
      String err = "null";
      int hitTick = -1;
      try {
        zc a = new zc(w, 8.5, 64.5, 9.5);
        a.s = 8.5; a.t = 64.5; a.u = 9.5;
        a.v = 0; a.w = 0; a.x = 1.0;
        for (int t = 0; t < 12; t++) {
          int before = w.log.size();
          a.h();
          for (int i = before; i < w.log.size(); i++) if (w.log.get(i).startsWith("ent random.bowhit") || w.log.get(i).startsWith("sound random.bowhit")) hitTick = t;
        }
      } catch (Throwable t) { err = errOf(t); }
      item("arrow-into-block", remote, w, "null", err, "\"hitTick\":" + hitTick + ",");
    }
    resetPlayer();
  }

  // every aux the world logged, with the player-less cell and data
  static String all(SoundSweepProbe.PW w) {
    List<String> l = new ArrayList<>();
    for (String e : w.log) if (e.startsWith("sound ") || e.startsWith("ent ") || e.startsWith("aux ") || e.startsWith("particle ")) { l.add(q(e)); if (e.startsWith("aux ")) auxSeen.add(e); }
    return "[" + String.join(",", l) + "]";
  }

  // the world double with an entity query answer (pressure plates ask World.getEntitiesWithinAABB / ...ExcludingEntity)
  public static class W77 extends SoundSweepProbe.PW {
    static List<Object> found = null;
    public List a(Class c, azt box) { if (found == null) return new ArrayList(); List out = new ArrayList(); for (Object o : found) if (c.isInstance(o)) out.add(o); return out; }
    public List b(sa e, azt box) { return found == null ? new ArrayList() : new ArrayList(found); }
  }
  static SoundSweepProbe.PW baseWorld(boolean remote, int[][] setup) throws Exception {
    sun.misc.Unsafe u = PlantProbe.unsafe;
    W77 w = (W77) u.allocateInstance(W77.class);
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "x").set(w, u.allocateInstance(ays.class));
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, remote);
    MobMoveProbe.set(w, "v", BedProbe.chunkProvider());
    MobMoveProbe.set(w, "u", new ArrayList<Object>());
    w.tiles = new HashMap<>(); w.cells = new HashMap<>(); w.spawned = new ArrayList<>(); w.scheduled = new ArrayList<>(); w.sets = new ArrayList<>(); w.log = new ArrayList<>(); w.power = new HashSet<>();
    w.base = (x, y, z) -> new int[] {y < 0 ? 1 : (y == 63 && x >= 3 && x <= 13 && z >= 3 && z <= 13 ? 1 : 0), 0};
    for (int[] c : setup) w.put(c[0], c[1], c[2], c[3], c[4]);
    MobMoveProbe.field(aqq.class, "f").setBoolean(MobMoveProbe.field(ahb.class, "t").get(w), false);
    return w;
  }
  static SoundSweepProbe.PW world(boolean remote, int[][] setup) throws Exception {
    SoundSweepProbe.PW w = baseWorld(remote, setup);
    wr = new LR(2);
    MobMoveProbe.set(w, "s", wr);
    return w;
  }
  static void bind(SoundSweepProbe.PW w) throws Exception { MobMoveProbe.field(sa.class, "o").set(DoorPaneProbe.player, w); }
  static yz pl() { return (yz) DoorPaneProbe.player; }
  static void held(add st) { yx inv = pl().bm; Arrays.fill(inv.a, null); inv.a[inv.c] = st; }
  static void resetPlayer() throws Exception {
    Object p = DoorPaneProbe.player;
    MobMoveProbe.set(p, "s", 8.5); MobMoveProbe.set(p, "t", 64.0); MobMoveProbe.set(p, "u", 6.5);
    pr = new LR(1);
    MobMoveProbe.set(p, "Z", pr);
    for (String f : new String[] {"z", "B"}) MobMoveProbe.field(sa.class, f).setFloat(p, 0f);
    for (String f : new String[] {"y", "A"}) MobMoveProbe.field(sa.class, f).setFloat(p, 0f);
    MobMoveProbe.field(yw.class, "d").setBoolean(pl().bE, false);
    held(null);
  }
  static void aim(double ex, double ey, double ez, float pitch, float yaw) throws Exception {
    Object p = DoorPaneProbe.player;
    double[] pos = {ex, ey - 1.62, ez};
    for (String f : new String[] {"p", "s"}) MobMoveProbe.set(p, f, pos[0]);
    for (String f : new String[] {"q", "t"}) MobMoveProbe.set(p, f, pos[1]);
    for (String f : new String[] {"r", "u"}) MobMoveProbe.set(p, f, pos[2]);
    for (String f : new String[] {"z", "B"}) MobMoveProbe.field(sa.class, f).setFloat(p, pitch);
    for (String f : new String[] {"y", "A"}) MobMoveProbe.field(sa.class, f).setFloat(p, yaw);
    MobMoveProbe.field(sa.class, "L").setFloat(p, 0f);
  }
  static aor tile(SoundSweepProbe.PW w, int x, int y, int z, Class<?> c) throws Exception {
    aor t = (aor) PlantProbe.unsafe.allocateInstance(c);
    w.tiles.put(x + "," + y + "," + z, t);
    return t;
  }
  static void setTilePos(aor t, SoundSweepProbe.PW w, int x, int y, int z) throws Exception {
    MobMoveProbe.field(aor.class, "b").set(t, w);
    MobMoveProbe.field(aor.class, "c").setInt(t, x); MobMoveProbe.field(aor.class, "d").setInt(t, y); MobMoveProbe.field(aor.class, "e").setInt(t, z);
  }
  static String heldJson() { add h = pl().bm.a[pl().bm.c]; return h == null ? "[0,0,0]" : "[" + adb.b(h.b()) + "," + h.b + "," + h.k() + "]"; }
  static String errOf(Throwable t) { Throwable c = t; while (c.getCause() != null && c instanceof InvocationTargetException) c = c.getCause(); StackTraceElement[] st = c.getStackTrace(); return q(c + (st.length > 0 ? " @" + st[0] : "")); }

  // ---- activate ----
  static void activate(String name, int[][] setup, int px, int py, int pz, int held, int heldDamage, int side, Object[][] tiles) throws Exception {
    for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, setup);
      bind(w); resetPlayer();
      for (Object[] t : tiles) { aor made = tile(w, (Integer) t[0], (Integer) t[1], (Integer) t[2], (Class<?>) t[3]); setTilePos(made, w, (Integer) t[0], (Integer) t[1], (Integer) t[2]); if (made instanceof alr && name.endsWith("with-record")) ((alr) made).a(new add(adb.d(2256), 1, 0)); }
      held(held > 0 ? new add(adb.d(held), 3, heldDamage) : null);
      if (name.startsWith("cake")) MobMoveProbe.field(zr.class, "a").setInt(pl().bp, 10); // food level 10: can eat
      String err = "null", res = "null";
      try { res = String.valueOf(w.a(px, py, pz).a(w, px, py, pz, pl(), side, 0.5f, 0.5f, 0.5f)); } catch (Throwable t) { err = errOf(t); }
      line("{\"kind\":\"activate\",\"name\":" + q(name) + ",\"remote\":" + (remote == 1) + ",\"result\":" + res + ",\"error\":" + err + ",\"held\":" + heldJson() + "," + draws() + "\"sounds\":" + all(w) + ",\"spawned\":" + w.spawned.size() + "}");
    }
    resetPlayer();
  }

  static void activates() throws Exception {
    int[][] none = {};
    Object[][] nt = {};
    // doors: lower half closed / open, with the upper half; iron
    activate("door-wood-closed", new int[][] {{8, 64, 8, 64, 0}, {8, 65, 8, 64, 8}}, 8, 64, 8, 0, 0, 1, nt);
    activate("door-wood-open", new int[][] {{8, 64, 8, 64, 4}, {8, 65, 8, 64, 9}}, 8, 64, 8, 0, 0, 1, nt);
    activate("door-wood-upper", new int[][] {{8, 64, 8, 64, 0}, {8, 65, 8, 64, 8}}, 8, 65, 8, 0, 0, 1, nt);
    activate("door-iron-closed", new int[][] {{8, 64, 8, 71, 0}, {8, 65, 8, 71, 8}}, 8, 64, 8, 0, 0, 1, nt);
    activate("trapdoor-closed", new int[][] {{8, 64, 8, 96, 0}}, 8, 64, 8, 0, 0, 1, nt);
    activate("trapdoor-open", new int[][] {{8, 64, 8, 96, 4}}, 8, 64, 8, 0, 0, 1, nt);
    activate("fencegate-closed", new int[][] {{8, 64, 8, 107, 0}}, 8, 64, 8, 0, 0, 1, nt);
    activate("fencegate-open", new int[][] {{8, 64, 8, 107, 4}}, 8, 64, 8, 0, 0, 1, nt);
    // levers: floor (meta 5) off/on, wall (meta 1) off/on, ceiling (meta 7)
    for (int m : new int[] {5, 13, 1, 9, 7, 15, 6, 14}) activate("lever-m" + m, new int[][] {{7, 64, 8, 1, 0}, {8, 65, 8, 1, 0}, {8, 64, 8, 69, m}}, 8, 64, 8, 0, 0, 1, nt);
    // buttons: stone 77 and wood 143, facing a stone block, unpressed and pressed
    for (int id : new int[] {77, 143}) for (int m : new int[] {1, 9}) activate("button-" + id + "-m" + m, new int[][] {{7, 64, 8, 1, 0}, {8, 64, 8, id, m}}, 8, 64, 8, 0, 0, 1, nt);
    // repeater (93 off, 94 on), comparator (149), cake, note block, jukebox
    activate("repeater-off", new int[][] {{8, 64, 8, 93, 0}}, 8, 64, 8, 0, 0, 1, nt);
    activate("repeater-on", new int[][] {{8, 64, 8, 94, 0}}, 8, 64, 8, 0, 0, 1, nt);
    activate("comparator-compare", new int[][] {{8, 64, 8, 149, 0}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, aoz.class, 0}});
    activate("comparator-subtract", new int[][] {{8, 64, 8, 149, 4}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, aoz.class, 0}});
    activate("comparator-powered-compare", new int[][] {{8, 64, 8, 150, 0}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, aoz.class, 0}});
    activate("comparator-powered-subtract", new int[][] {{8, 64, 8, 150, 4}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, aoz.class, 0}});
    activate("cake", new int[][] {{8, 64, 8, 92, 0}}, 8, 64, 8, 0, 0, 1, nt);
    activate("note-block", new int[][] {{8, 64, 8, 25, 0}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, apl.class}});
    activate("jukebox-empty", new int[][] {{8, 64, 8, 84, 0}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, alr.class}});
    activate("jukebox-empty-record-held", new int[][] {{8, 64, 8, 84, 0}}, 8, 64, 8, 2256, 0, 1, new Object[][] {{8, 64, 8, alr.class}});
    activate("jukebox-with-record", new int[][] {{8, 64, 8, 84, 1}}, 8, 64, 8, 0, 0, 1, new Object[][] {{8, 64, 8, alr.class}});
    activate("tnt-flint", new int[][] {{8, 64, 8, 46, 0}}, 8, 64, 8, 259, 0, 1, nt);
    activate("tnt-fire-charge", new int[][] {{8, 64, 8, 46, 0}}, 8, 64, 8, 385, 0, 1, nt);
    activate("tnt-empty-hand", new int[][] {{8, 64, 8, 46, 0}}, 8, 64, 8, 0, 0, 1, nt);
  }

  // ---- pressure plates ----
  // The collision (aji.a(ahb,III,sa)) with the player standing on the plate, the world answering its entity query with the player; then the scheduled tick (aji.a(ahb,III,Random))
  // with nobody on it.
  static void plates() throws Exception {
    for (int id : new int[] {70, 72, 147, 148}) for (int m : new int[] {0, 1}) for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[][] {{8, 64, 8, id, m}});
      bind(w); resetPlayer();
      MobMoveProbe.set(pl(), "s", 8.5); MobMoveProbe.set(pl(), "t", 64.0); MobMoveProbe.set(pl(), "u", 8.5);
      W77.found = new ArrayList<>(); W77.found.add(pl());
      String err = "null";
      try { w.a(8, 64, 8).a(w, 8, 64, 8, (sa) pl()); } catch (Throwable t) { err = errOf(t); }
      int[] after = w.cell(8, 64, 8);
      String collide = all(w);
      w.log.clear();
      W77.found = null;
      String err2 = "null";
      try { w.a(8, 64, 8).a(w, 8, 64, 8, new Random(3)); } catch (Throwable t) { err2 = errOf(t); }
      line("{\"kind\":\"plate\",\"id\":" + id + ",\"meta\":" + m + ",\"remote\":" + (remote == 1) + ",\"error\":" + err + ",\"afterCollide\":[" + after[0] + "," + after[1] + "],\"collideSounds\":" + collide + ",\"tickError\":" + err2 + ",\"sounds\":" + all(w) + "}");
    }
    W77.found = null;
    resetPlayer();
  }

  // ---- chests ----
  static void chests() throws Exception {
    for (int remote = 0; remote < 2; remote++) for (Class<?> c : new Class<?>[] {aow.class, ape.class}) for (int dbl = 0; dbl < (c == aow.class ? 2 : 1); dbl++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[][] {{8, 64, 8, c == aow.class ? 54 : 130, 2}});
      bind(w);
      aor t = tile(w, 8, 64, 8, c);
      setTilePos(t, w, 8, 64, 8);
      if (c == aow.class) { MobMoveProbe.field(aow.class, "a").setBoolean(t, true); if (dbl == 1) { aow n = (aow) PlantProbe.unsafe.allocateInstance(aow.class); MobMoveProbe.field(aow.class, "l").set(t, n); } }
      String err = "null";
      List<String> ticks = new ArrayList<>();
      try {
        String uf = c == aow.class ? "o" : "j"; // numPlayersUsing
        for (int tick = 0; tick < 40; tick++) {
          if (tick == 0) MobMoveProbe.field(c, uf).setInt(t, 1);
          if (tick == 20) MobMoveProbe.field(c, uf).setInt(t, 0);
          int before = w.log.size();
          t.h();
          List<String> s = new ArrayList<>();
          for (int i = before; i < w.log.size(); i++) if (w.log.get(i).startsWith("sound ")) s.add(q(w.log.get(i)));
          if (!s.isEmpty()) ticks.add("{\"tick\":" + tick + ",\"sounds\":[" + String.join(",", s) + "]}");
        }
      } catch (Throwable x) { err = errOf(x); }
      line("{\"kind\":\"chest\",\"tile\":" + q(c.getSimpleName()) + ",\"doubleNeighbour\":" + (dbl == 1) + ",\"remote\":" + (remote == 1) + ",\"error\":" + err + "," + draws() + "\"ticks\":[" + String.join(",", ticks) + "]}");
    }
  }

  // ---- note block event ----
  static void notes() throws Exception {
    SoundSweepProbe.PW w = world(false, new int[][] {{8, 64, 8, 25, 0}});
    bind(w);
    for (int inst = 0; inst < 5; inst++) for (int pitch : new int[] {0, 12, 24}) {
      w.log.clear();
      String err = "null", res = "null";
      try { res = String.valueOf(w.a(8, 64, 8).a(w, 8, 64, 8, inst, pitch)); } catch (Throwable t) { err = errOf(t); }
      line("{\"kind\":\"note\",\"instrument\":" + inst + ",\"pitch\":" + pitch + ",\"result\":" + res + ",\"error\":" + err + ",\"sounds\":" + all(w) + "}");
    }
  }

  // ---- items ----
  static void item(String name, int remote, SoundSweepProbe.PW w, String res, String err, String extra) {
    line("{\"kind\":\"item\",\"name\":" + q(name) + ",\"remote\":" + (remote == 1) + ",\"result\":" + res + ",\"error\":" + err + ",\"held\":" + heldJson() + ",\"spawned\":" + w.spawned.size() + "," + extra + draws() + "\"sounds\":" + all(w) + "}");
  }

  static void bow() throws Exception {
    for (int remote = 0; remote < 2; remote++) for (int creative = 0; creative < 2; creative++) for (int arrows = 0; arrows < 2; arrows++) for (int ticks : new int[] {1, 3, 5, 10, 15, 20, 30}) {
      if (creative == 1 && arrows == 1) continue;
      SoundSweepProbe.PW w = world(remote == 1, new int[0][]);
      bind(w); resetPlayer(); aim(8.5, 65.62, 8.5, 0f, 0f);
      MobMoveProbe.field(yw.class, "d").setBoolean(pl().bE, creative == 1);
      yx inv = pl().bm;
      add bowStack = new add(adb.d(261), 1, 0);
      inv.a[inv.c] = bowStack;
      if (arrows == 1) inv.a[inv.c == 0 ? 1 : 0] = new add(adb.d(262), 8, 0);
      String err = "null";
      try { adb.d(261).a(bowStack, w, pl(), 72000 - ticks); } catch (Throwable t) { err = errOf(t); }
      yx inv2 = pl().bm;
      int left = 0; for (add s : inv2.a) if (s != null && adb.b(s.b()) == 262) left += s.b;
      item("bow-release", remote, w, "null", err, "\"creative\":" + (creative == 1) + ",\"arrows\":" + (arrows == 1 ? 8 : 0) + ",\"ticks\":" + ticks + ",\"arrowsLeft\":" + left + ",");
    }
    resetPlayer();
  }

  static void lily() throws Exception {
    int[][][] setups = {{{8, 63, 8, 9, 0}}, {{8, 63, 8, 8, 3}}, {{8, 63, 8, 1, 0}}, {{8, 63, 8, 9, 0}, {8, 64, 8, 111, 0}}, {{8, 63, 8, 11, 0}}};
    String[] names = {"water-source", "water-flowing", "stone", "water-with-pad", "lava"};
    for (int remote = 0; remote < 2; remote++) for (int i = 0; i < setups.length; i++) for (int creative = 0; creative < 2; creative++) {
      SoundSweepProbe.PW w = world(remote == 1, setups[i]);
      bind(w); resetPlayer(); aim(8.5, 65.62, 8.5, 90f, 0f);
      MobMoveProbe.field(yw.class, "d").setBoolean(pl().bE, creative == 1);
      add st = new add(adb.d(111), 3, 0);
      held(st);
      String err = "null", res = "null";
      try { add r = adb.d(111).a(st, w, pl()); res = "[" + adb.b(r.b()) + "," + r.b + "]"; } catch (Throwable t) { err = errOf(t); }
      int[] c = w.cell(8, 64, 8);
      item("lily-pad-" + names[i], remote, w, res, err, "\"creative\":" + (creative == 1) + ",\"above\":[" + c[0] + "," + c[1] + "],");
    }
    resetPlayer();
  }

  static apu strongholdProvider() throws Exception {
    apu base = BedProbe.chunkProvider();
    return (apu) Proxy.newProxyInstance(SpSounds77Probe.class.getClassLoader(), new Class[] {apu.class}, (p, m, a) -> {
      if (m.getName().equals("a") && m.getParameterCount() == 5) return "Stronghold".equals(a[1]) ? new agt(100, 64, 100) : null;
      return m.invoke(base, a);
    });
  }

  static void eye() throws Exception {
    for (int remote = 0; remote < 2; remote++) for (int found = 0; found < 2; found++) for (int creative = 0; creative < 2; creative++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[0][]);
      if (found == 1) MobMoveProbe.set(w, "v", strongholdProvider());
      bind(w); resetPlayer(); aim(8.5, 65.62, 8.5, 0f, 0f);
      MobMoveProbe.field(yw.class, "d").setBoolean(pl().bE, creative == 1);
      add st = new add(adb.d(381), 3, 0);
      held(st);
      String err = "null", res = "null";
      try { add r = adb.d(381).a(st, w, pl()); res = "[" + adb.b(r.b()) + "," + r.b + "]"; } catch (Throwable t) { err = errOf(t); }
      item("eye-of-ender-throw", remote, w, res, err, "\"stronghold\":" + (found == 1) + ",\"creative\":" + (creative == 1) + ",");
    }
    // onItemUse on an end portal frame (meta 0: empty), meta 4: already filled
    for (int remote = 0; remote < 2; remote++) for (int m : new int[] {0, 4}) {
      SoundSweepProbe.PW w = world(remote == 1, new int[][] {{8, 64, 8, 120, m}});
      bind(w); resetPlayer();
      add st = new add(adb.d(381), 3, 0);
      held(st);
      String err = "null", res = "null";
      try { res = String.valueOf(adb.d(381).a(st, pl(), w, 8, 64, 8, 1, 0.5f, 0.5f, 0.5f)); } catch (Throwable t) { err = errOf(t); }
      int[] c = w.cell(8, 64, 8);
      item("eye-of-ender-frame", remote, w, res, err, "\"frameMeta\":" + m + ",\"after\":[" + c[0] + "," + c[1] + "],");
    }
    resetPlayer();
  }

  static void useItem(String name, int itemId, int damage, int[][] setup, int[] at, int side) throws Exception {
    for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, setup);
      bind(w); resetPlayer();
      add st = new add(adb.d(itemId), 3, damage);
      held(st);
      String err = "null", res = "null";
      try { res = String.valueOf(adb.d(itemId).a(st, pl(), w, at[0], at[1], at[2], side, 0.5f, 0.5f, 0.5f)); } catch (Throwable t) { err = errOf(t); }
      item(name, remote, w, res, err, "\"sets\":" + w.sets.size() + ",");
    }
    resetPlayer();
  }

  static void uses() throws Exception {
    useItem("flint-on-tnt", 259, 0, new int[][] {{8, 64, 8, 46, 0}}, new int[] {8, 64, 8}, 1);
    useItem("flint-on-stone", 259, 0, new int[][] {{8, 64, 8, 1, 0}}, new int[] {8, 64, 8}, 1);
    // nether portal frame: obsidian 4 wide, 5 tall in the x plane; the bottom inside is (8,65,8)
    List<int[]> fr = new ArrayList<>();
    for (int x : new int[] {7, 10}) for (int y = 64; y <= 68; y++) fr.add(new int[] {x, y, 8, 49, 0});
    for (int x : new int[] {8, 9}) { fr.add(new int[] {x, 64, 8, 49, 0}); fr.add(new int[] {x, 68, 8, 49, 0}); }
    useItem("flint-on-portal-frame", 259, 0, fr.toArray(new int[0][]), new int[] {8, 64, 8}, 1);
    useItem("flint-on-obsidian-no-frame", 259, 0, new int[][] {{8, 64, 8, 49, 0}}, new int[] {8, 64, 8}, 1);
    useItem("record-on-jukebox", 2256, 0, new int[][] {{8, 64, 8, 84, 0}}, new int[] {8, 64, 8}, 1);
    // record on a jukebox needs the tile entity; add it through activate-style tiles
    for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[][] {{8, 64, 8, 84, 0}});
      bind(w); resetPlayer();
      aor t = tile(w, 8, 64, 8, alr.class); setTilePos(t, w, 8, 64, 8);
      add st = new add(adb.d(2257), 1, 0);
      held(st);
      String err = "null", res = "null";
      try { res = String.valueOf(adb.d(2257).a(st, pl(), w, 8, 64, 8, 1, 0.5f, 0.5f, 0.5f)); } catch (Throwable x) { err = errOf(x); }
      int[] c = w.cell(8, 64, 8);
      item("record-item-on-jukebox-with-tile", remote, w, res, err, "\"jukeboxMeta\":" + c[1] + ",");
    }
    resetPlayer();
  }

  // ---- eating and drinking ----
  static void eating() throws Exception {
    Object[][] foods = {{260, 0, "apple"}, {373, 8193, "potion-drink"}, {335, 0, "milk-bucket"}, {297, 0, "bread"}, {282, 0, "mushroom-stew"}};
    for (Object[] f : foods) for (int remote = 0; remote < 2; remote++) {
      SoundSweepProbe.PW w = world(remote == 1, new int[0][]);
      bind(w); resetPlayer();
      add st = new add(adb.d((Integer) f[0]), 3, (Integer) f[1]);
      held(st);
      MobMoveProbe.field(zr.class, "a").setInt(pl().bp, 10);
      String err = "null", act = "null";
      try {
        act = q(String.valueOf(st.o()));
        Method c = yz.class.getDeclaredMethod("c", add.class, int.class);
        c.setAccessible(true);
        for (int i = 0; i < 3; i++) c.invoke(pl(), st, 5);
      } catch (Throwable t) { err = errOf(t); }
      item("use-item-tick-" + f[2], remote, w, "null", err, "\"action\":" + act + ",\"calls\":3,");
      // onEaten (ItemFood.onEaten / ItemBucket milk / ItemPotion): the finish
      SoundSweepProbe.PW w2 = world(remote == 1, new int[0][]);
      bind(w2); resetPlayer();
      add st2 = new add(adb.d((Integer) f[0]), 3, (Integer) f[1]);
      held(st2);
      MobMoveProbe.field(zr.class, "a").setInt(pl().bp, 10);
      String err2 = "null", res2 = "null";
      try { add r = st2.b().b(st2, w2, pl()); res2 = "[" + adb.b(r.b()) + "," + r.b + "]"; } catch (Throwable t) { err2 = errOf(t); }
      item("on-eaten-" + f[2], remote, w2, res2, err2, "");
    }
    resetPlayer();
  }

  // ---- impacts ----
  static void impacts() throws Exception {
    Method potion = zo.class.getDeclaredMethod("a", azu.class), bottle = zn.class.getDeclaredMethod("a", azu.class);
    potion.setAccessible(true); bottle.setAccessible(true);
    for (int remote = 0; remote < 2; remote++) {
      for (int dmg : new int[] {16421, 16385, 16457, 16396, 0}) {
        SoundSweepProbe.PW w = world(remote == 1, new int[0][]);
        bind(w);
        String err = "null";
        try {
          zo e = new zo(w, 8.0, 64.0, 8.0, dmg);
          potion.invoke(e, new azu(8, 63, 8, 1, azw.a(8.0, 64.0, 8.0)));
        } catch (Throwable t) { err = errOf(t); }
        line("{\"kind\":\"impact\",\"entity\":\"potion\",\"damage\":" + dmg + ",\"remote\":" + (remote == 1) + ",\"error\":" + err + ",\"spawned\":" + w.spawned.size() + ",\"sounds\":" + all(w) + "}");
      }
      SoundSweepProbe.PW w = world(remote == 1, new int[0][]);
      bind(w);
      String err = "null";
      try { zn e = new zn(w, 8.0, 64.0, 8.0); bottle.invoke(e, new azu(8, 63, 8, 1, azw.a(8.0, 64.0, 8.0))); } catch (Throwable t) { err = errOf(t); }
      line("{\"kind\":\"impact\",\"entity\":\"expbottle\",\"damage\":0,\"remote\":" + (remote == 1) + ",\"error\":" + err + ",\"spawned\":" + w.spawned.size() + ",\"sounds\":" + all(w) + "}");
    }
  }

  // every aux the world logged is run through the real RenderGlobal.playAuxSFX
  static void aux() throws Exception {
    Set<String> done = new TreeSet<>();
    for (String a : auxSeen) {
      String[] p = a.split(" ");
      int type = Integer.parseInt(p[1]);
      String[] r = p[2].split(",");
      int x = Integer.parseInt(r[0]), y = Integer.parseInt(r[1]), z = Integer.parseInt(r[2]), data = Integer.parseInt(r[3]);
      if (type == 1005 || !done.add(type + "," + data)) continue;
      Set<String> names = new TreeSet<>(); Set<String> vols = new TreeSet<>();
      float pmin = 1e9f, pmax = -1e9f; String first = "null", err = "null";
      for (int i = 0; i < 64; i++) {
        handler.played.clear();
        try { rg.a(pl(), type, x, y, z, data); } catch (Throwable t) { err = errOf(t); }
        for (String s : handler.played) {
          String[] sp = s.split(" ");
          names.add(sp[0]); vols.add(sp[1]); float pi = Float.parseFloat(sp[2]); pmin = Math.min(pmin, pi); pmax = Math.max(pmax, pi);
          if (first.equals("null")) first = q(s);
        }
      }
      List<String> nl = new ArrayList<>(); for (String n : names) nl.add(q(n));
      List<String> vl = new ArrayList<>(); for (String n : vols) vl.add(q(n));
      line("{\"kind\":\"aux\",\"type\":" + type + ",\"data\":" + data + ",\"runs\":64,\"names\":[" + String.join(",", nl) + "],\"volumes\":[" + String.join(",", vl) + "],\"pitchMin\":" + pmin + ",\"pitchMax\":" + pmax + ",\"first\":" + first + ",\"after\":" + err + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l(); alb.e();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    DoorPaneProbe.makePlayer();
    DoorPaneProbe.player.getClass();
    MobMoveProbe.field(sv.class, "f").set(DoorPaneProbe.player, new HashMap());
    rig();
    activates();
    plates();
    chests();
    notes();
    bow();
    lily();
    eye();
    uses();
    eating();
    impacts();
    shear();
    arrows();
    auxSeen.add("aux 2003 8,64,8,0"); auxSeen.add("aux 2004 8,64,8,0");
    aux();
  }
}
