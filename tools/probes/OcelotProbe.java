import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.util.*;

// Runs the unchanged EntityOcelot (wn), EntityTameable (tg), EntityAIOcelotSit (uw), BlockChest's ocelot check (ajx.o),
// ModelOcelot (bht) and the EntityCreeper (xz) task list of the 1.7.10 JAR on top of the MobMoveProbe world double.
// One JSON object per line:
//   facts       constructor size, attribute bases, datawatcher defaults, canDespawn, eye height, sounds, fall
//   tasks       the task and target lists of an ocelot and of a creeper: priority, mutex bits, class, scalar fields
//   interact    wn.a(yz) for raw fish (300 seeded rolls with the tempt task running), the scared/far/not-fish branches,
//               cooked fish, creative, the owner sitting toggle and the breeding path
//   sound       wn.t() for wild, tamed, in-love tamed over seeded Entity.rand
//   spawn       wn.by() over block-below, height and seeds
//   speed       wn.bp(): sneak and sprint flags from the move helper speed
//   sitTarget   EntityAIOcelotSit: block validity, the search (nearest, scan order) and shouldExecute over seeds
//   chest       BlockChest's ocelot check
//   attack      wn.n(sa) on a chicken; hurt rule; fall; child; mate; egg kittens
//   model       ModelOcelot parts at rest and for the standing, sneaking, sprinting and sitting poses
public class OcelotProbe {
  public static class World extends MobMoveProbe.ProbeWorld {
    static List<String> sounds = new ArrayList<>();
    static List<Integer> states = new ArrayList<>();
    static List<sa> spawned = new ArrayList<>();
    static List<sa> entities = new ArrayList<>();
    static Map<String, int[]> blocks = new HashMap<>();
    static Map<String, aor> tiles = new HashMap<>();
    static boolean anyLiquid = false, noCollision = true;
    static yz player;
    static bac board = new bac();
    static int[] at(int x, int y, int z) { return blocks.get(x + "," + y + "," + z); }
    public aji a(int x, int y, int z) { int[] b = at(x, y, z); return b != null ? aji.e(b[0]) : super.a(x, y, z); }
    public int e(int x, int y, int z) { int[] b = at(x, y, z); return b != null ? b[1] : 0; }
    public aor o(int x, int y, int z) { return tiles.get(x + "," + y + "," + z); }
    public boolean d(sa entity) { spawned.add(entity); return true; }
    public void a(sa entity, String sound, float volume, float pitch) { sounds.add(sound + "|" + volume + "|" + pitch); }
    public void a(sa entity, byte state) { states.add((int) state); }
    public bac W() { return board; }
    public yz a(UUID id) { return player != null && id.equals(player.aB()) ? player : null; }
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {}
    public boolean b(azt box) { return noCollision; }
    public boolean d(azt box) { return anyLiquid; }
    public List b(sa entity, azt box) { return new ArrayList(); }
    static boolean meets(azt a, azt b) { return a.d > b.a && a.a < b.d && a.e > b.b && a.b < b.e && a.f > b.c && a.c < b.f; }
    public List a(Class c, azt box) {
      List out = new ArrayList();
      for (sa e : entities) if (c.isInstance(e) && meets(box, e.C)) out.add(e);
      return out;
    }
    public List a(sa entity, azt box, sj selector) { return new ArrayList(); }
    public List a(Class c, azt box, sj selector) {
      List out = new ArrayList();
      for (sa e : entities) if (c.isInstance(e) && meets(box, e.C) && (selector == null || selector.a(e))) out.add(e);
      return out;
    }
  }

  public static abstract class FakePlayerBase extends yz { FakePlayerBase() { super(null, null); } }
  public static class FakePlayer extends FakePlayerBase {
    FakePlayer() { super(); }
    public add be() { return null; }
    public add q(int slot) { return null; }
    public void c(int slot, add stack) {}
    public add[] ak() { return new add[0]; }
    public boolean a(int level, String command) { return true; }
    public void a(fj message) {}
    public r f_() { return null; }
  }

  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static World W;
  // splitmix64 finaliser: java.util.Random seeded with consecutive small ints gives correlated first draws
  static long mix(long z) { z += 0x9E3779B97F4A7C15L; z = (z ^ (z >>> 30)) * 0xBF58476D1CE4E5B9L; z = (z ^ (z >>> 27)) * 0x94D049BB133111EBL; return z ^ (z >>> 31); }

  static wn cat(long seed) throws Exception {
    wn e = new wn(W);
    MobMoveProbe.set(e, "Z", new Random(mix(seed)));
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.5, 64.0, 64.5);
    MobMoveProbe.set(e, "D", true);
    return e;
  }

  static yz makePlayer(boolean creative) throws Exception {
    yz p = (yz) u.allocateInstance(FakePlayer.class);
    yx inv = (yx) u.allocateInstance(yx.class);
    inv.a = new add[40];
    inv.c = 0;
    inv.d = p;
    MobMoveProbe.set(p, "bm", inv);
    yw abilities = (yw) u.allocateInstance(yw.class);
    abilities.d = creative;
    MobMoveProbe.set(p, "bE", abilities);
    MobMoveProbe.set(p, "ar", new UUID(1L, 2L));
    MobMoveProbe.set(p, "o", W);
    MobMoveProbe.set(p, "i", new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player"));
    MobMoveProbe.set(p, "Z", new Random(5));
    MobMoveProbe.set(p, "s", 64.5);
    MobMoveProbe.set(p, "t", 64.0);
    MobMoveProbe.set(p, "u", 66.0);
    return p;
  }
  static void hold(yz p, add stack) throws Exception { ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0] = stack; }
  static add held(yz p) throws Exception { return ((yx) MobMoveProbe.field(yz.class, "bm").get(p)).a[0]; }
  static String stack(add s) { return s == null ? "null" : "{\"id\":" + adb.b(s.b()) + ",\"damage\":" + s.k() + ",\"count\":" + s.b + "}"; }
  static String str(String s) { return "\"" + (s == null ? "" : s) + "\""; }
  static String ints(List<Integer> l) {
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < l.size(); i++) s.append(i > 0 ? "," : "").append(l.get(i));
    return s.append("]").toString();
  }
  static void setTempt(wn e, boolean running) throws Exception {
    vk tempt = (vk) MobMoveProbe.field(wn.class, "bq").get(e);
    MobMoveProbe.set(tempt, "j", running);
  }
  static vh sit(wn e) throws Exception { return (vh) MobMoveProbe.field(tg.class, "bp").get(e); }
  static boolean sitWish(wn e) throws Exception { return MobMoveProbe.b(sit(e), "b"); }
  static String catState(wn e) throws Exception {
    return "{\"tamed\":" + e.bZ() + ",\"sitting\":" + e.ca() + ",\"sitWish\":" + sitWish(e) + ",\"catType\":" + e.cg() + ",\"owner\":" + str(e.b())
      + ",\"health\":" + num(e.aS()) + ",\"maxHealth\":" + num(((ti) e.a(yj.a)).e()) + ",\"inLove\":" + e.ce() + ",\"age\":" + e.d() + "}";
  }
  static void setLove(wf e, int v) throws Exception { MobMoveProbe.field(wf.class, "bp").setInt(e, v); }

  static String taskList(uj list) throws Exception {
    List entries = (List) MobMoveProbe.field(uj.class, "b").get(list);
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : entries) {
      uk entry = (uk) o;
      ui action = entry.a;
      if (!first) s.append(',');
      first = false;
      s.append("{\"priority\":" + entry.b + ",\"class\":\"" + action.getClass().getName() + "\",\"mutex\":" + action.j() + ",\"fields\":{");
      boolean ff = true;
      for (Class<?> c = action.getClass(); c != null && c != ui.class && c != Object.class; c = c.getSuperclass())
        for (Field fld : c.getDeclaredFields()) {
          if (Modifier.isStatic(fld.getModifiers())) continue;
          fld.setAccessible(true);
          Class<?> t = fld.getType();
          String v;
          if (t == double.class || t == float.class || t == int.class || t == boolean.class || t == long.class) v = String.valueOf(fld.get(action));
          else if (t == Class.class) { Object cv = fld.get(action); v = cv == null ? "null" : "\"" + ((Class) cv).getName() + "\""; }
          else if (t == adb.class) { Object iv = fld.get(action); v = iv == null ? "null" : String.valueOf(adb.b((adb) iv)); }
          else continue;
          s.append(ff ? "" : ",").append("\"" + c.getName() + "." + fld.getName() + "\":" + v);
          ff = false;
        }
      s.append("}}");
    }
    return s.append("]").toString();
  }

  static String dumpParts(String tag, bht m, String extra) throws Exception {
    StringBuilder b = new StringBuilder("{\"case\":\"model\",\"tag\":\"" + tag + "\"" + extra + ",\"i\":" + MobMoveProbe.field(bht.class, "i").getInt(m) + ",\"parts\":{");
    boolean first = true;
    for (Field f : bht.class.getDeclaredFields()) {
      if (f.getType() != bix.class) continue;
      f.setAccessible(true);
      if (!first) b.append(',');
      first = false;
      b.append("\"" + f.getName() + "\":" + ModelProbe.part((bix) f.get(m)));
    }
    return b.append("}}").toString();
  }

  static void block(int x, int y, int z, int id, int meta) { World.blocks.put(x + "," + y + "," + z, new int[] { id, meta }); }
  static void chestTile(int x, int y, int z, int users) throws Exception {
    aow t = (aow) u.allocateInstance(aow.class);
    t.o = users;
    World.tiles.put(x + "," + y + "," + z, t);
  }
  static void clearWorld() { World.blocks.clear(); World.tiles.clear(); World.entities.clear(); World.anyLiquid = false; World.noCollision = true; }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    World world = (World) u.allocateInstance(World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    World.player = makePlayer(false);
    yz creative = makePlayer(true);

    // facts
    {
      wn e = cat(1);
      wn t = cat(1);
      t.j(true);
      System.out.println("{\"case\":\"facts\",\"width\":" + num(MobMoveProbe.fl(e, "M")) + ",\"height\":" + num(MobMoveProbe.fl(e, "N"))
        + ",\"speed\":" + num(((ti) e.a(yj.d)).e()) + ",\"maxHealth\":" + num(((ti) e.a(yj.a)).e()) + ",\"health\":" + num(e.aS())
        + ",\"tamedMaxHealth\":" + num(((ti) t.a(yj.a)).e()) + ",\"tamedHealth\":" + num(t.aS())
        + ",\"catType\":" + e.cg() + ",\"eyeHeight\":" + num((Float) MobMoveProbe.method(sa.class, "g").invoke(e))
        + ",\"verticalFaceSpeed\":" + e.x() + ",\"aiEnabled\":" + e.bk()
        + ",\"hurt\":" + str((String) MobMoveProbe.method(wn.class, "aT").invoke(e)) + ",\"death\":" + str((String) MobMoveProbe.method(wn.class, "aU").invoke(e))
        + ",\"volume\":" + num((Float) MobMoveProbe.method(wn.class, "bf").invoke(e)) + ",\"dropItem\":" + adb.b((adb) MobMoveProbe.method(wn.class, "u").invoke(e)) + "}");
      StringBuilder d = new StringBuilder();
      int[] ages = { 0, 2400, 2401, 5000 };
      for (int tamedFlag = 0; tamedFlag < 2; tamedFlag++) for (int age : ages) {
        wn x = cat(1);
        if (tamedFlag == 1) x.j(true);
        MobMoveProbe.set(x, "aa", age);
        d.append(d.length() > 0 ? "," : "").append("{\"tamed\":" + (tamedFlag == 1) + ",\"age\":" + age + ",\"canDespawn\":" + MobMoveProbe.method(wn.class, "v").invoke(x) + "}");
      }
      System.out.println("{\"case\":\"despawn\",\"rows\":[" + d + "]}");
    }

    // task lists
    {
      wn e = cat(1);
      xz creeper = new xz(world);
      System.out.println("{\"case\":\"tasks\",\"ocelot\":{\"tasks\":" + taskList((uj) MobMoveProbe.field(sw.class, "c").get(e)) + ",\"targets\":" + taskList((uj) MobMoveProbe.field(sw.class, "d").get(e)) + "},"
        + "\"creeper\":{\"tasks\":" + taskList((uj) MobMoveProbe.field(sw.class, "c").get(creeper)) + ",\"targets\":" + taskList((uj) MobMoveProbe.field(sw.class, "d").get(creeper)) + "}}");
    }

    // interact: raw fish on a wild ocelot with the tempt task running (the taming roll), 300 seeds
    for (long seed = 0; seed < 300; seed++) {
      World.states.clear();
      MobMoveProbe.set(world, "s", new Random(mix(seed + 1000)));
      wn e = cat(seed);
      setTempt(e, true);
      hold(World.player, new add(ade.aP, 3));
      boolean r = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"fish\",\"seed\":" + seed + ",\"result\":" + r + ",\"states\":" + ints(World.states) + ",\"held\":" + stack(held(World.player)) + ",\"cat\":" + catState(e) + "}");
    }
    // not tempted (scared or idle), far player, not a fish, cooked fish, every raw fish damage, creative, last fish
    {
      String[] names = { "scared", "far", "stick", "cookedFish", "cookedSalmon" };
      for (int k = 0; k < names.length; k++) {
        World.states.clear();
        MobMoveProbe.set(world, "s", new Random(1000));
        wn e = cat(0);
        setTempt(e, k != 0);
        if (k == 1) { MobMoveProbe.set(World.player, "s", 80.5); }
        hold(World.player, k == 2 ? new add(adb.d(280), 3) : k == 3 ? new add(ade.aQ, 3) : k == 4 ? new add(ade.aQ, 3, 1) : new add(ade.aP, 3));
        boolean r = e.a(World.player);
        MobMoveProbe.set(World.player, "s", 64.5);
        System.out.println("{\"case\":\"interact\",\"kind\":\"" + names[k] + "\",\"result\":" + r + ",\"states\":" + ints(World.states) + ",\"held\":" + stack(held(World.player)) + ",\"cat\":" + catState(e) + "}");
      }
      for (int dmg = 0; dmg < 4; dmg++) {
        World.states.clear();
        MobMoveProbe.set(world, "s", new Random(1000));
        wn e = cat(0);
        setTempt(e, true);
        hold(World.player, new add(ade.aP, 2, dmg));
        boolean r = e.a(World.player);
        System.out.println("{\"case\":\"interact\",\"kind\":\"fishDamage\",\"damage\":" + dmg + ",\"result\":" + r + ",\"states\":" + ints(World.states) + ",\"held\":" + stack(held(World.player)) + ",\"cat\":" + catState(e) + "}");
      }
      {
        MobMoveProbe.set(world, "s", new Random(1000));
        wn e = cat(0);
        setTempt(e, true);
        hold(creative, new add(ade.aP, 2));
        e.a(creative);
        System.out.println("{\"case\":\"interact\",\"kind\":\"creative\",\"held\":" + stack(held(creative)) + ",\"cat\":" + catState(e) + "}");
        wn l = cat(0);
        setTempt(l, true);
        hold(World.player, new add(ade.aP, 1));
        l.a(World.player);
        System.out.println("{\"case\":\"interact\",\"kind\":\"lastFish\",\"held\":" + stack(held(World.player)) + "}");
      }
    }
    // tamed ocelots: the owner toggles sitting (empty hand, stick), a stranger does not, fish breeds instead
    {
      wn e = cat(7); e.j(true); e.b(World.player.aB().toString());
      hold(World.player, null);
      boolean r1 = e.a(World.player);
      String s1 = catState(e);
      sit(e).c(); // the Sit task starts on the next AI pass
      boolean r2 = e.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sit\",\"first\":{\"result\":" + r1 + ",\"cat\":" + s1 + "},\"second\":{\"result\":" + r2 + ",\"cat\":" + catState(e) + "}}");
      wn o = cat(7); o.j(true); o.b(new UUID(9L, 9L).toString());
      boolean r3 = o.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sitStranger\",\"result\":" + r3 + ",\"cat\":" + catState(o) + "}");
      wn m = cat(7); m.j(true); m.b(World.player.aB().toString());
      hold(World.player, new add(ade.aP, 2));
      boolean r4 = m.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sitWithFish\",\"result\":" + r4 + ",\"cat\":" + catState(m) + ",\"held\":" + stack(held(World.player)) + "}");
      wn st = cat(7); st.j(true); st.b(World.player.aB().toString());
      hold(World.player, new add(adb.d(280), 1));
      boolean r5 = st.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"sitWithStick\",\"result\":" + r5 + ",\"cat\":" + catState(st) + "}");
      wn w = cat(7);
      hold(World.player, new add(ade.aP, 2));
      boolean r6 = w.a(World.player); // wild, tempt not running: the breeding path of EntityAnimal
      System.out.println("{\"case\":\"interact\",\"kind\":\"wildBreedPath\",\"result\":" + r6 + ",\"cat\":" + catState(w) + ",\"held\":" + stack(held(World.player)) + "}");
      wn kit = cat(7); kit.j(true); kit.b(World.player.aB().toString()); kit.c(-24000);
      hold(World.player, new add(ade.aP, 2));
      boolean r7 = kit.a(World.player);
      System.out.println("{\"case\":\"interact\",\"kind\":\"kittenFish\",\"result\":" + r7 + ",\"cat\":" + catState(kit) + ",\"held\":" + stack(held(World.player)) + "}");
    }

    // living sound: wild, tamed, tamed in love
    Method say = MobMoveProbe.method(wn.class, "t");
    for (int mode = 0; mode < 3; mode++)
      for (long seed = 0; seed < 60; seed++) {
        wn e = cat(seed);
        if (mode >= 1) e.j(true);
        if (mode == 2) setLove(e, 600);
        System.out.println("{\"case\":\"sound\",\"mode\":" + mode + ",\"seed\":" + seed + ",\"say\":" + str((String) say.invoke(e)) + "}");
      }

    // spawn: wn.by()
    {
      int[] below = { 2, 18, 161, 1, 3, 12, 9, 0 };
      for (int id : below)
        for (int y = 60; y <= 66; y++)
          for (int k = 0; k < 3; k++) {
            clearWorld();
            wn e = cat(1);
            MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, 64.5, y, 64.5);
            block(64, y - 1, 64, id, 0);
            if (k == 1) World.noCollision = false;
            if (k == 2) World.anyLiquid = true;
            int trues = 0;
            for (long seed = 0; seed < 30; seed++) {
              MobMoveProbe.set(world, "s", new Random(mix(seed)));
              if (e.by()) trues++;
            }
            System.out.println("{\"case\":\"spawn\",\"block\":" + id + ",\"y\":" + y + ",\"blocked\":" + (k == 1) + ",\"liquid\":" + (k == 2) + ",\"trues\":" + trues + ",\"of\":30}");
          }
      // the world.rand roll alone: with a valid spot the first nextInt(3) decides, per seed
      clearWorld();
      wn e = cat(1);
      block(64, 63, 64, 2, 0);
      StringBuilder rows = new StringBuilder();
      for (long seed = 0; seed < 90; seed++) {
        MobMoveProbe.set(world, "s", new Random(mix(seed)));
        rows.append(seed > 0 ? "," : "").append(e.by() ? 1 : 0);
      }
      System.out.println("{\"case\":\"spawnSeeds\",\"y\":64,\"block\":2,\"results\":[" + rows + "]}");
      clearWorld();
    }

    // sneak and sprint flags from the move helper
    {
      double[] speeds = { 0.6, 1.33, 0.8, 1.0, 1.2, 0.0 };
      for (double sp : speeds)
        for (int updating = 0; updating < 2; updating++) {
          wn e = cat(1);
          tv helper = e.k();
          MobMoveProbe.set(helper, "f", updating == 1);
          MobMoveProbe.set(helper, "e", sp);
          // sneaking and sprinting start set, to show both are cleared by a speed that is neither
          e.b(true);
          e.c(true);
          MobMoveProbe.method(wn.class, "bp").invoke(e);
          System.out.println("{\"case\":\"speed\",\"speed\":" + num(sp) + ",\"updating\":" + (updating == 1) + ",\"sneaking\":" + e.an() + ",\"sprinting\":" + e.ao() + "}");
        }
    }

    // EntityAIOcelotSit: block validity, search and start
    {
      Method valid = MobMoveProbe.method(uw.class, "a", ahb.class, int.class, int.class, int.class);
      Method search = MobMoveProbe.method(uw.class, "f");
      // chest (users 0 / 1), furnace 61, lit furnace 62, bed foot / head / occupied, stone, air
      Object[][] cases = {
        { "chestFree", 54, 0, 0 }, { "chestOpen", 54, 0, 1 }, { "furnace", 61, 0, 0 }, { "litFurnace", 62, 0, 0 }, { "bedFoot", 26, 0, 0 },
        { "bedHead", 26, 8, 0 }, { "bedFootOccupied", 26, 4, 0 }, { "bedHeadOccupied", 26, 12, 0 }, { "stone", 1, 0, 0 }, { "air", 0, 0, 0 }, { "trappedChest", 146, 0, 0 }, { "enderChest", 130, 0, 0 },
      };
      for (Object[] c : cases) {
        clearWorld();
        wn e = cat(1); e.j(true);
        block(64, 64, 64, (Integer) c[1], (Integer) c[2]);
        if ((Integer) c[1] == 54) chestTile(64, 64, 64, (Integer) c[3]);
        uw task = new uw(e, 1.33);
        boolean ok;
        try { ok = (Boolean) valid.invoke(task, world, 64, 64, 64); } catch (Exception ex) { ok = false; }
        System.out.println("{\"case\":\"sitValid\",\"name\":\"" + c[0] + "\",\"block\":" + c[1] + ",\"meta\":" + c[2] + ",\"valid\":" + ok + "}");
      }
      // the search: several valid spots, nearest wins; scan order x then z; the cat's own y only; air needed above
      clearWorld();
      wn e = cat(1); e.j(true);
      block(70, 64, 64, 54, 0); chestTile(70, 64, 64, 0);   // 5.5 blocks east
      block(60, 64, 64, 62, 0);                             // 4.5 blocks west: nearer
      block(64, 64, 70, 26, 0);                             // 5.5 blocks south
      block(64, 65, 60, 62, 0);                             // wrong y
      block(72, 64, 64, 62, 0);                             // 7.5 away, inside the window
      block(73, 64, 64, 62, 0);                             // 8.5 away: x in [56, 72]
      uw task = new uw(e, 1.33);
      boolean found = (Boolean) search.invoke(task);
      System.out.println("{\"case\":\"sitSearch\",\"name\":\"nearest\",\"found\":" + found + ",\"x\":" + MobMoveProbe.field(uw.class, "f").getInt(task) + ",\"y\":" + MobMoveProbe.field(uw.class, "g").getInt(task) + ",\"z\":" + MobMoveProbe.field(uw.class, "h").getInt(task) + "}");
      // solid block above the valid spot
      block(60, 65, 64, 1, 0);
      found = (Boolean) search.invoke(task);
      System.out.println("{\"case\":\"sitSearch\",\"name\":\"coveredNearest\",\"found\":" + found + ",\"x\":" + MobMoveProbe.field(uw.class, "f").getInt(task) + ",\"y\":" + MobMoveProbe.field(uw.class, "g").getInt(task) + ",\"z\":" + MobMoveProbe.field(uw.class, "h").getInt(task) + "}");
      // window edges: x 56 (posX 64.5, int 64, -8) is included, 72 (int 64 + 8 < 72.5) is the last, 73 is out
      for (int dx : new int[] { -9, -8, 7, 8, 9 }) {
        clearWorld();
        wn w = cat(1); w.j(true);
        block(64 + dx, 64, 64, 62, 0);
        uw t = new uw(w, 1.33);
        boolean f = (Boolean) search.invoke(t);
        System.out.println("{\"case\":\"sitSearch\",\"name\":\"edgeX\",\"dx\":" + dx + ",\"found\":" + f + "}");
      }
      for (int dz : new int[] { -9, -8, 7, 8, 9 }) {
        clearWorld();
        wn w = cat(1); w.j(true);
        block(64, 64, 64 + dz, 62, 0);
        uw t = new uw(w, 1.33);
        boolean f = (Boolean) search.invoke(t);
        System.out.println("{\"case\":\"sitSearch\",\"name\":\"edgeZ\",\"dz\":" + dz + ",\"found\":" + f + "}");
      }
      // shouldExecute over seeds: tamed, not sitting, a target in range: Entity.rand.nextDouble() <= 0.0065
      clearWorld();
      block(66, 64, 64, 62, 0);
      StringBuilder rows = new StringBuilder();
      int hits = 0;
      for (long seed = 0; seed < 4000; seed++) {
        wn t = cat(seed); t.j(true);
        uw tk = new uw(t, 1.33);
        boolean r = tk.a();
        if (r) { hits++; rows.append(rows.length() > 0 ? "," : "").append(seed); }
      }
      System.out.println("{\"case\":\"sitStart\",\"seeds\":4000,\"hits\":" + hits + ",\"hitSeeds\":[" + rows + "]}");
      for (int mode = 0; mode < 3; mode++) {
        wn t = cat(0); // seed 0: nextDouble() is 0.730..., set a seed that passes instead
        long pass = -1;
        for (long seed = 0; seed < 4000 && pass < 0; seed++) { wn p = cat(seed); p.j(true); if (new uw(p, 1.33).a()) pass = seed; }
        wn x = cat(pass);
        if (mode >= 1) x.j(true);
        if (mode == 2) x.k(true);
        System.out.println("{\"case\":\"sitStartGate\",\"mode\":" + mode + ",\"seed\":" + pass + ",\"tamed\":" + x.bZ() + ",\"sitting\":" + x.ca() + ",\"result\":" + new uw(x, 1.33).a() + "}");
      }
      // the random of start: c() draws nextInt(nextInt(1200) + 1200) + 1200 from Entity.rand
      StringBuilder maxes = new StringBuilder();
      for (long seed = 0; seed < 20; seed++) {
        Random r = new Random(mix(seed));
        int inner = r.nextInt(1200) + 1200;
        maxes.append(seed > 0 ? "," : "").append(r.nextInt(inner) + 1200);
      }
      System.out.println("{\"case\":\"sitDuration\",\"formula\":\"nextInt(nextInt(1200)+1200)+1200\",\"seeds0to19\":[" + maxes + "]}");
      clearWorld();
    }

    // BlockChest's ocelot check (ajx.o): a sitting ocelot in the box above the chest
    {
      Method blocked = MobMoveProbe.method(ajx.class, "o", ahb.class, int.class, int.class, int.class);
      Object[][] cases = {
        { "sittingOnChest", 64.5, 65.0, 64.5, true }, { "standingOnChest", 64.5, 65.0, 64.5, false }, { "sittingBeside", 66.5, 65.0, 64.5, true },
        { "sittingInside", 64.5, 64.0, 64.5, true }, { "sittingHigh", 64.5, 66.5, 64.5, true }, { "sittingEdge", 64.2, 65.0, 64.9, true },
      };
      for (Object[] c : cases) {
        clearWorld();
        wn e = cat(1);
        MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, (Double) c[1], (Double) c[2], (Double) c[3]);
        e.j(true);
        e.k((Boolean) c[4]);
        World.entities.add(e);
        System.out.println("{\"case\":\"chestOcelot\",\"name\":\"" + c[0] + "\",\"sitting\":" + c[4] + ",\"blocked\":" + blocked.invoke(null, world, 64, 64, 64) + "}");
      }
      clearWorld();
      System.out.println("{\"case\":\"chestOcelot\",\"name\":\"none\",\"sitting\":false,\"blocked\":" + blocked.invoke(null, world, 64, 64, 64) + "}");
    }

    // attack on a chicken, hurt rule, fall, child, mate
    {
      wn e = cat(3);
      wg chicken = new wg(world);
      MobMoveProbe.set(chicken, "Z", new Random(1));
      float before = chicken.aS();
      boolean r = e.n(chicken);
      System.out.println("{\"case\":\"attack\",\"result\":" + r + ",\"chickenBefore\":" + num(before) + ",\"chickenAfter\":" + num(chicken.aS()) + "}");
    }
    {
      yz p = World.player;
      ro[] sources = { ro.a(p), ro.j, ro.h };
      String[] names = { "player", "generic", "fall" };
      for (int i = 0; i < sources.length; i++) {
        wn e = cat(1);
        e.j(true);
        e.b(p.aB().toString());
        sit(e).a(true);
        boolean r = e.a(sources[i], 3f);
        System.out.println("{\"case\":\"hurt\",\"source\":\"" + names[i] + "\",\"result\":" + r + ",\"health\":" + num(e.aS()) + ",\"sitWish\":" + sitWish(e) + "}");
      }
      wn e = cat(1);
      float before = e.aS();
      MobMoveProbe.method(wn.class, "b", float.class).invoke(e, 30f);
      System.out.println("{\"case\":\"fall\",\"before\":" + num(before) + ",\"after\":" + num(e.aS()) + "}");
    }
    for (int mode = 0; mode < 4; mode++) {
      wn parent = cat(3);
      if (mode >= 1) { parent.j(true); parent.b(World.player.aB().toString()); parent.s(1 + mode % 3); }
      if (mode == 3) parent.b("   ");
      wn child = parent.b(cat(4));
      System.out.println("{\"case\":\"child\",\"mode\":" + mode + ",\"parent\":" + catState(parent) + ",\"child\":" + catState(child) + "}");
    }
    {
      boolean[] t = { false, true };
      for (int a = 0; a < 2; a++) for (int b = 0; b < 2; b++) for (int loveA = 0; loveA < 2; loveA++) for (int loveB = 0; loveB < 2; loveB++) for (int sitA = 0; sitA < 2; sitA++) {
        wn x = cat(1), y = cat(2);
        if (a == 1) x.j(true);
        if (b == 1) y.j(true);
        if (sitA == 1) x.k(true);
        setLove(x, loveA * 600);
        setLove(y, loveB * 600);
        System.out.println("{\"case\":\"mate\",\"tamedA\":" + t[a] + ",\"tamedB\":" + t[b] + ",\"loveA\":" + (loveA == 1) + ",\"loveB\":" + (loveB == 1) + ",\"sitA\":" + (sitA == 1) + ",\"result\":" + x.a((wf) y) + "}");
      }
      wn self = cat(1); self.j(true); setLove(self, 600);
      System.out.println("{\"case\":\"mate\",\"self\":true,\"result\":" + self.a((wf) self) + "}");
      wn x = cat(1); x.j(true); setLove(x, 600);
      wp sheep = new wp(world);
      System.out.println("{\"case\":\"mate\",\"other\":\"sheep\",\"result\":" + x.a((wf) sheep) + "}");
    }
    // onSpawnWithEgg: one chance in seven for two kittens at the ocelot's position (age -24000, catType 0)
    {
      StringBuilder rows = new StringBuilder();
      int litters = 0;
      for (long seed = 0; seed < 70; seed++) {
        World.spawned.clear();
        MobMoveProbe.set(world, "s", new Random(mix(seed)));
        wn e = cat(seed);
        e.a((sy) null);
        int n = World.spawned.size();
        if (n > 0) litters++;
        StringBuilder kids = new StringBuilder();
        for (sa k : World.spawned) kids.append(kids.length() > 0 ? "," : "").append("{\"age\":" + ((wn) k).d() + ",\"catType\":" + ((wn) k).cg() + ",\"tamed\":" + ((wn) k).bZ() + ",\"x\":" + num(k.s) + ",\"y\":" + num(k.t) + ",\"z\":" + num(k.u) + "}");
        rows.append(seed > 0 ? "," : "").append("{\"seed\":" + seed + ",\"kittens\":[" + kids + "]}");
      }
      System.out.println("{\"case\":\"egg\",\"seeds\":70,\"litters\":" + litters + ",\"rows\":[" + rows + "]}");
      World.spawned.clear();
    }

    // avoidance gates of tw.a(): the creeper's task (class wn, 6 blocks), and the ocelot's own player-avoid with a tamed or wild ocelot.
    // Past the gates tw.a() runs RandomPositionGenerator and PathNavigate, which need chunks the world double lacks; that is
    // recorded as reachedPathfinding (the NPE is inside ahb.e on the missing chunk provider) and the algorithm stays bytecode-derived.
    {
      for (int mode = 0; mode < 5; mode++) {
        clearWorld();
        World.player = makePlayer(false);
        try {
          wn self = cat(1);
          wn other = cat(2);
          xz creeper = new xz(world);
          MobMoveProbe.set(creeper, "Z", new Random(1));
          MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(creeper, 64.5, 64.0, 64.5);
          sw owner = mode < 3 ? creeper : self;
          Class<?> want = mode < 3 ? wn.class : yz.class;
          MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(other, mode == 2 ? 80.5 : 67.5, 64.0, 64.5);
          if (mode == 4) self.j(true);
          if (mode >= 3) { MobMoveProbe.set(World.player, "s", 67.5); MobMoveProbe.set(World.player, "t", 64.0); MobMoveProbe.set(World.player, "u", 64.5); World.entities.add(World.player); }
          else World.entities.add(other);
          MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(self, 64.5, 64.0, 64.5);
          List entries = (List) MobMoveProbe.field(uj.class, "b").get((uj) MobMoveProbe.field(sw.class, "c").get(owner));
          tw avoid = null;
          for (Object o : entries) if (((uk) o).a instanceof tw) avoid = (tw) ((uk) o).a;
          String result;
          try { result = String.valueOf(avoid.a()); } catch (NullPointerException ex) { result = "\"reachedPathfinding\""; }
          String[] names = { "creeperNearOcelot", "creeperNearOcelotAgain", "creeperFarOcelot", "ocelotNearPlayer", "tamedOcelotNearPlayer" };
          System.out.println("{\"case\":\"avoid\",\"name\":\"" + names[mode] + "\",\"avoidClass\":\"" + want.getName() + "\",\"result\":" + result + "}");
        } catch (Throwable ex) {
          System.out.println("{\"case\":\"avoid\",\"name\":\"" + mode + "\",\"error\":\"" + ex.getClass().getName() + "\"}");
        }
      }
      clearWorld();
      World.player = makePlayer(false);
    }

    // model
    {
      bht m = new bht();
      System.out.println(dumpParts("rest", m, ""));
      String[] states = { "standing", "sneaking", "sprinting", "sitting" };
      float[][] poses = { { 0f, 0f, 0f, 0f, 0f }, { 1.3f, 0.7f, 50f, 20f, -15f }, { 4.1f, 1f, 123.4f, -35f, 25f } };
      for (int s = 0; s < states.length; s++) {
        wn e = cat(11);
        if (s == 1) e.b(true);
        if (s == 2) e.c(true);
        if (s == 3) { e.j(true); e.k(true); }
        for (float[] pose : poses) {
          bht model = new bht();
          model.a((sv) e, pose[0], pose[1], 0.5f);
          model.a(pose[0], pose[1], pose[2], pose[3], pose[4], 0.0625f, (sa) e);
          System.out.println(dumpParts(states[s], model, ",\"limbSwing\":" + num(pose[0]) + ",\"limbAmount\":" + num(pose[1]) + ",\"age\":" + num(pose[2]) + ",\"headYaw\":" + num(pose[3]) + ",\"headPitch\":" + num(pose[4])));
        }
      }
    }
  }
}
