import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 39 legacyai. Slimes (ym), magma cubes (yf), ghasts (yd) and blazes (xx) ticked whole (Entity.onUpdate, sa.h) on the unchanged classes in the
// VillageLiveProbe double (a real EntityPlayer double in closePlayers, real sight rays, real water when asked), one record per scenario, to replay the
// legacy AI flows Random draw for Random draw. Entities (index): the mobs in the order of `types` (s slime, m magma cube, g ghast, b blaze), then the
// player (types.length), then every entity a mob spawned that the record follows (split slimes), in spawn order. `sizes[i]` is a slime or magma cube's
// size. Entity.rand of each mob is a Log seeded `seed * 10 + index`; entities built mid-run (split slimes, fireballs) get a SeedRandom seed that the
// record lists. The player is never ticked; its collision with a slime (EntityPlayer.collideWithPlayer: the entities in the player's box grown (1, 0, 1)
// get onCollideWithPlayer) is emulated right after each slime update, as the port does. Script ops "t op ...":
//   hit idx dmg            the player hits mob idx (DamageSource.causePlayerDamage)
//   walk idx dx dz         from this tick on the entity moves by (dx, dz) before each tick (0 0 stops)
//   move idx x z [y]       teleport
// Row per tick: [[per entity: x, y, z, vx, vy, vz, yaw, onGround, health, target index, [type fields], [Random draws]], sounds, level events, spawned fireballs].
public class LegacyAiProbe {
  static String num(double v) { return Double.toString(v); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Field fld(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n); }
  static Field fld(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static double dbl(Object o, String n) throws Exception { return fld(o, n).getDouble(o); }
  static float flt(Object o, String n) throws Exception { return fld(o, n).getFloat(o); }
  static int in(Object o, String n) throws Exception { return fld(o, n).getInt(o); }
  static boolean bo(Object o, String n) throws Exception { return fld(o, n).getBoolean(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }

  static int difficulty = 2, bright = 15; static int[][] blocks = {}; static boolean water = false;
  static String draws(List<String> log) {
    StringBuilder s = new StringBuilder();
    for (String d : log) s.append(s.length() > 0 ? "," : "").append("\"").append(d).append("\"");
    return s.toString();
  }
  static int index(List<sa> all, Object e) { for (int k = 0; k < all.size(); k++) if (all.get(k) == e) return k; return -1; }
  static String fields(sa e, List<sa> all) throws Exception {
    if (e instanceof ym) return num(flt(e, "h")) + "," + num(flt(e, "i")) + "," + num(flt(e, "bm")) + "," + in(e, "bn") + "," + (bo(e, "bc") ? 1 : 0) + "," + num(flt(e, "be")) + "," + num(flt(e, "bd")) + "," + in(e, "aU");
    if (e instanceof xx) {
      Object path = fld(td.class, "bp").get(e);
      return in(e, "aB") + "," + in(e, "br") + "," + (bo(e, "bn") ? 1 : 0) + "," + num(flt(e, "bp")) + "," + in(e, "bq") + "," + (path != null ? 1 : 0) + "," + in(e, "aU") + "," + (((xx) e).bZ() ? 1 : 0) + "," + num(flt(e, "be")) + "," + num(flt(e, "bd")) + "," + (bo(e, "bc") ? 1 : 0);
    }
    if (e instanceof yd) return num(dbl(e, "i")) + "," + num(dbl(e, "bm")) + "," + num(dbl(e, "bn")) + "," + in(e, "h") + "," + in(e, "bp") + "," + in(e, "bo") + "," + in(e, "br") + "," + (fld(yd.class, "bq").get(e) != null ? 1 : 0) + "," + in(e, "aU");
    return "";
  }
  static String fireball(sa f, int shooter) throws Exception {
    SeedRandom r = (SeedRandom) fld(sa.class, "Z").get(f);
    return "[" + (f instanceof zg ? 1 : 0) + "," + shooter + "," + num(f.s) + "," + num(f.t) + "," + num(f.u) + "," + num(f.v) + "," + num(f.w) + "," + num(f.x) + "," + num(dbl(f, "b")) + "," + num(dbl(f, "c")) + "," + num(dbl(f, "d"))
      + "," + (f instanceof zg ? in(f, "e") : 0) + "," + r.seed + ",[" + draws(r.log) + "]]";
  }
  static final List<String> hitLog = new ArrayList<>();

  static void scenario(String name, long seed, int ticks, String types, int[] sizes, double[][] pos, String[] script) throws Exception {
    if (System.getenv("LA_ONLY") != null && !name.equals(System.getenv("LA_ONLY"))) return;
    int n = types.length();
    MobMoveProbe.set(VillageLiveProbe.world, "r", rd.values()[difficulty]);
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = false;
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int[] b : blocks) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++) VillageLiveProbe.put(x, y, z, b[6], b[7]);
    VillagerProbe.World.light = 15; MobMoveProbe.ProbeWorld.water = water;
    VillagerProbe.World.brightLevel = bright; VillagerProbe.World.brightPatches = new int[][] {}; VillagerProbe.World.vulnerable = true;
    VillagerProbe.World.immediateSlimes = true; VillagerProbe.World.chunkCache = false; VillagerProbe.World.unloaded.clear(); VillagerProbe.World.localDiff = 0;
    ahb w = VillageLiveProbe.world;
    VillageFightProbe.P player = new VillageFightProbe.P(w, "probe");
    List<sa> all = new ArrayList<>();
    SeedRandom.next = 2000000L + seed * 1000;
    for (int i = 0; i < n; i++) {
      sa e;
      switch (types.charAt(i)) {
        case 's': { ym s = new ym(w); MobMoveProbe.method(ym.class, "a", int.class).invoke(s, sizes[i]); e = s; break; }
        case 'm': { yf s = new yf(w); MobMoveProbe.method(ym.class, "a", int.class).invoke(s, sizes[i]); e = s; break; }
        case 'g': e = new yd(w); break;
        case 'b': e = new xx(w); break;
        default: throw new RuntimeException(types);
      }
      all.add(e);
    }
    all.add(player);
    List<Long> seeds = new ArrayList<>();
    VillagerProbe.World.entities.clear();
    for (int i = 0; i < all.size(); i++) {
      sa e = all.get(i);
      for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, fn, 0f);
      VillageFightProbe.Log log = new VillageFightProbe.Log(seed * 10 + i);
      MobMoveProbe.set(e, "Z", log);
      if (e instanceof ym) MobMoveProbe.set(e, "bn", 10 + (int) ((seed + i * 7) % 20)); // the first jump delay (the constructor's own roll is unseeded)
      at(e, pos[i][0], pos[i].length > 2 ? pos[i][2] : 0, pos[i][1]);
      MobMoveProbe.set(e, "D", !(e instanceof yd));
      VillagerProbe.World.entities.add(e);
    }
    player.a(yj.a).a(1000.0);
    player.g(1000.0f);
    MobMoveProbe.set(player, "L", 0f);
    at(player, pos[n][0], pos[n].length > 2 ? pos[n][2] : 0, pos[n][1]);
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(Arrays.asList(player));
    double[][] vel = new double[64][2];
    List<String> rows = new ArrayList<>(), hits = new ArrayList<>(), kids = new ArrayList<>(), sizesOut = new ArrayList<>();
    VillagerProbe.World.sounds.clear(); VillagerProbe.World.aux.clear(); VillagerProbe.World.spawned.clear();
    for (int t = 0; t < ticks; t++) {
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "hit": {
            sv victim = (sv) all.get(Integer.parseInt(p[2]));
            boolean hit = victim.a(ro.a(player), Float.parseFloat(p[3]));
            hits.add("[" + t + "," + hit + "," + num(victim.aS()) + "]");
            break;
          }
          case "walk": vel[Integer.parseInt(p[2])] = new double[] {Double.parseDouble(p[3]), Double.parseDouble(p[4])}; break;
          case "move": { sa e = all.get(Integer.parseInt(p[2])); at(e, Double.parseDouble(p[3]), p.length > 5 ? Double.parseDouble(p[5]) : e.t, Double.parseDouble(p[4])); break; }
          default: throw new RuntimeException(op);
        }
      }
      for (int i = 0; i < all.size(); i++) if (vel[i][0] != 0 || vel[i][1] != 0) { sa e = all.get(i); at(e, e.s + vel[i][0], e.t, e.u + vel[i][1]); }
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      for (sa e : all) { Random r = (Random) fld(sa.class, "Z").get(e); if (r instanceof VillageFightProbe.Log) ((VillageFightProbe.Log) r).log.clear(); else ((SeedRandom) r).log.clear(); }
      VillagerProbe.World.sounds.clear(); VillagerProbe.World.aux.clear();
      List<String> shots = new ArrayList<>();
      List<sa> ticking = new ArrayList<>();
      for (int i = 0; i < all.size(); i++) if (all.get(i) != player) ticking.add(all.get(i)); // the split children tick on later passes too
      for (int i = 0; i < ticking.size(); i++) {
        sa e = ticking.get(i);
        if (e.K) continue;
        e.aa++;
        VillageFightProbe.update(e);
        if (e instanceof ym && !e.K) { // EntityPlayer.collideWithPlayer: the player's box grown (1, 0, 1) meets the slime
          azt grown = player.C.b(1.0, 0.0, 1.0);
          if (grown.b(e.C)) ((ym) e).b_(player);
        }
        while (!VillagerProbe.World.spawned.isEmpty()) {
          Object sp = VillagerProbe.World.spawned.remove(0);
          if (sp instanceof ym) {
            ym k = (ym) sp;
            SeedRandom r = (SeedRandom) fld(sa.class, "Z").get(k);
            kids.add("[" + t + "," + (k instanceof yf ? 1 : 0) + "," + k.bX() + "," + num(k.s) + "," + num(k.t) + "," + num(k.u) + "," + num(k.y) + "," + r.seed + ",[" + draws(r.log) + "]," + in(k, "bn") + "]");
            r.log.clear();
            all.add(k); // children follow the player in the index list
            ticking.add(k);
            if (!VillagerProbe.World.entities.contains(k)) VillagerProbe.World.entities.add(k);
          } else if (sp instanceof ze) {
            sa f = (sa) sp;
            shots.add(fireball(f, index(all, fld(ze.class, "a").get(f))));
          }
        }
      }
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < all.size(); i++) {
        sa e = all.get(i);
        if (i > 0) row.append(",");
        row.append("[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append(",").append(num(e.v)).append(",").append(num(e.w)).append(",").append(num(e.x)).append(",").append(num(e.y)).append(",").append(e.D ? 1 : 0).append(",").append(num(((sv) e).aS()));
        if (e == player) { row.append("]"); continue; }
        Object tg = e instanceof td ? ((td) e).bT() : e instanceof yd ? fld(yd.class, "bq").get(e) : null;
        Random r = (Random) fld(sa.class, "Z").get(e);
        List<String> log = r instanceof VillageFightProbe.Log ? ((VillageFightProbe.Log) r).log : ((SeedRandom) r).log;
        row.append(",").append(index(all, tg)).append(",[").append(fields(e, all)).append("],[").append(draws(log)).append("]]");
      }
      row.append("],[");
      for (int k = 0; k < VillagerProbe.World.sounds.size(); k++) row.append(k > 0 ? "," : "").append(q(VillagerProbe.World.sounds.get(k)));
      row.append("],[");
      for (int k = 0; k < VillagerProbe.World.aux.size(); k++) row.append(k > 0 ? "," : "").append(q(VillagerProbe.World.aux.get(k)));
      row.append("],[").append(String.join(",", shots)).append("]]");
      rows.add(row.toString());
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"legacyai\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"difficulty\":" + difficulty + ",\"ticks\":" + ticks + ",\"types\":" + q(types) + ",\"sizes\":" + Arrays.toString(sizes)
      + ",\"bright\":" + bright + (water ? ",\"water\":true" : "") + (blocks.length > 0 ? ",\"blocks\":" + Arrays.deepToString(blocks) : "") + ",\"pos\":" + Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"hits\":[" + String.join(",", hits)
      + "],\"children\":[" + String.join(",", kids) + "],\"rows\":[" + String.join(",", rows) + "]}");
    VillagerProbe.reset();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
    VillagerProbe.World.realRays = true;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ArmorEnchantmentProbe.U = u;
    VillageLiveProbe.W w = (VillageLiveProbe.W) u.allocateInstance(VillageLiveProbe.W.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    MobMoveProbe.set(w, "r", rd.values()[2]);
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); }
    int[] none = {0, 0, 0, 0};
    String[] quiet = {};
    // Slimes and magma cubes: idle with the player far away (no target within 16), a size each.
    scenario("la-idle-slimes", 3901, 320, "sssmmm", new int[] {1, 2, 4, 1, 2, 4}, new double[][] {{40.5, 40.5}, {60.5, 40.5}, {80.5, 40.5}, {40.5, 80.5}, {60.5, 80.5}, {80.5, 80.5}, {10.5, 10.5}}, quiet);
    // Chasing a player that stands 8 blocks away, and one that walks away, per size and kind (the targeted jump delay is a third of the roll).
    int sid = 3910;
    for (char kind : new char[] {'s', 'm'})
      for (int size : new int[] {1, 2, 4}) {
        scenario("la-chase-" + kind + size + "-" + sid, sid++, 360, "" + kind, new int[] {size}, new double[][] {{60.5, 60.5}, {68.5, 62.5}}, quiet);
        scenario("la-chase-walk-" + kind + size + "-" + sid, sid++, 360, "" + kind, new int[] {size}, new double[][] {{60.5, 60.5}, {66.5, 60.5}}, new String[] {"20 walk 1 0.04 0.02", "200 walk 1 0 0"});
      }
    // A big slime and a big magma cube die to the player's hits and split (children of half the size, their own Entity.rand, chasing on).
    scenario("la-split-s4-3930", 3930, 260, "s", new int[] {4}, new double[][] {{60.5, 60.5}, {66.5, 62.5}}, new String[] {"40 hit 0 100"});
    scenario("la-split-m4-3931", 3931, 260, "m", new int[] {4}, new double[][] {{60.5, 60.5}, {66.5, 62.5}}, new String[] {"40 hit 0 100"});
    scenario("la-split-s2-3932", 3932, 200, "s", new int[] {2}, new double[][] {{60.5, 60.5}, {66.5, 62.5}}, new String[] {"30 hit 0 100"});
    // A hit that does not kill (the slime keeps chasing), and a slime in a water pool.
    scenario("la-hurt-s2-3933", 3933, 160, "s", new int[] {2}, new double[][] {{60.5, 60.5}, {75.5, 60.5}}, new String[] {"10 hit 0 1"});
    water = true; blocks = new int[][] {{56, -2, 56, 70, -1, 70, 9, 0}};
    scenario("la-water-s2-3934", 3934, 200, "s", new int[] {2}, new double[][] {{62.5, 62.5, -1}, {75.5, 62.5}}, quiet);
    scenario("la-water-m2-3935", 3935, 200, "m", new int[] {2}, new double[][] {{62.5, 62.5, -1}, {75.5, 62.5}}, quiet);
    water = false; blocks = new int[][] {};
    // Ghasts: out of range (the player 150 blocks away), firing at a player 30 blocks away who then walks off, and a stone wall between them.
    scenario("la-ghast-idle-3940", 3940, 320, "g", none, new double[][] {{60.5, 60.5, 20}, {170.5, 60.5}}, quiet);
    scenario("la-ghast-fire-3941", 3941, 420, "g", none, new double[][] {{60.5, 60.5, 20}, {60.5, 90.5, 18}}, new String[] {"300 walk 1 0.3 0"});
    scenario("la-ghast-fire-3942", 3942, 420, "g", none, new double[][] {{60.5, 60.5, 12}, {80.5, 76.5, 2}}, new String[] {"200 hit 0 3"});
    blocks = new int[][] {{58, 0, 70, 90, 40, 71, 1, 0}};
    scenario("la-ghast-wall-3943", 3943, 360, "g", none, new double[][] {{60.5, 60.5, 20}, {64.5, 80.5, 19}}, quiet);
    blocks = new int[][] {};
    // Blazes: idle (light and dark), a volley at 14 blocks, the player walking in to melee range, a raised player (the hover push), a hit from out of range.
    scenario("la-blaze-idle-3950", 3950, 360, "b", none, new double[][] {{60.5, 60.5}, {160.5, 60.5}}, quiet);
    bright = 3;
    scenario("la-blaze-idle-dark-3951", 3951, 360, "b", none, new double[][] {{60.5, 60.5}, {160.5, 60.5}}, quiet);
    bright = 15;
    scenario("la-blaze-volley-3952", 3952, 420, "b", none, new double[][] {{60.5, 60.5}, {74.5, 62.5}}, quiet);
    scenario("la-blaze-volley-d3-3953", 3953, 420, "b", none, new double[][] {{60.5, 60.5}, {60.5, 85.5}}, new String[] {"150 walk 1 0 -0.05", "260 walk 1 0 0"});
    difficulty = 2;
    scenario("la-blaze-melee-3954", 3954, 360, "b", none, new double[][] {{60.5, 60.5}, {66.5, 60.5}}, new String[] {"60 walk 1 -0.04 0", "200 walk 1 0 0"});
    scenario("la-blaze-raised-3955", 3955, 420, "b", none, new double[][] {{60.5, 60.5}, {68.5, 60.5, 8}}, quiet);
    scenario("la-blaze-hit-3956", 3956, 360, "b", none, new double[][] {{60.5, 60.5}, {100.5, 60.5}}, new String[] {"10 hit 0 1", "200 move 1 130.5 60.5"});
    water = true; blocks = new int[][] {{56, -2, 56, 70, -1, 70, 9, 0}};
    scenario("la-blaze-water-3957", 3957, 200, "b", none, new double[][] {{62.5, 62.5, -1}, {160.5, 60.5}}, quiet);
    scenario("la-blaze-water-chase-3958", 3958, 260, "b", none, new double[][] {{62.5, 62.5, -1}, {76.5, 62.5}}, quiet);
    water = false; blocks = new int[][] {};
    // A blaze and a magma cube and a slime in one arena (they push each other, and a blaze's fireball is only recorded).
    scenario("la-mixed-3960", 3960, 300, "bsm", new int[] {0, 2, 2}, new double[][] {{60.5, 60.5}, {64.5, 60.5}, {62.5, 64.5}, {70.5, 70.5}}, quiet);
  }
}
