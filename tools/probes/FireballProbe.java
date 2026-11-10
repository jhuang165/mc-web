import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 40 fireballs. Large (zg) and small (zi) fireballs ticked whole (Entity.onUpdate = ze.h) on the unchanged classes in the LegacyAiProbe double
// (real sight rays, real block shapes from the cell map, real water when asked, a real EntityPlayer double), so the flight, the block and entity sweep,
// the impact and the player's punch replay against native evidence. The shooters (ghast yd, blaze xx) and the targets (zombie yq, pigman yh, magma cube
// yf) are never ticked: they stand where the record puts them. Entities (index): the mobs of `types` (z zombie, p zombie pigman, b blaze, g ghast, m magma
// cube of `sizes[i]`), then the player (types.length). Fireballs are numbered in spawn order. Entity.rand of a ball is a SeedRandom (the constructor's
// three gaussian aim draws), its seed is listed. Script ops "t op ...", applied before the tick runs:
//   ball L idx dx dy dz x y z [power]   a large (1) or small (0) fireball of shooter idx with the aim (dx, dy, dz); then posX/posY/posZ are assigned
//                                       as EntityGhast and EntityBlaze do after the constructor (no setPosition: the box stays at the shooter)
//   exact L x y z ax ay az [power]      the dispenser form (no shooter)
//   punch k                             the player hits fireball k (ze.a(DamageSource.causePlayerDamage, 4))
//   look yaw pitch                      the player's rotation
//   move idx x z [y]                    teleport an entity
//   kill idx                            setDead
//   rule name value                     a game rule (mobGriefing)
//   fire idx seconds                    setFire
// Row per tick: [[per entity: x, y, z, vx, vy, vz, health, fire ticks, isDead], [per fireball: large, shooter index (-1 none), x, y, z, vx, vy, vz, ax, ay, az,
// isDead, ticksInAir, ticksAlive, power], explosions, setBlock calls, punch results].
public class FireballProbe {
  public static class FW extends VillageLiveProbe.W {
    static List<String> booms = new ArrayList<>(), sets = new ArrayList<>();
    public agw a(sa e, double x, double y, double z, float power, boolean flaming, boolean smoking) {
      booms.add("[" + num(x) + "," + num(y) + "," + num(z) + "," + num(power) + "," + (flaming ? 1 : 0) + "," + (smoking ? 1 : 0) + "," + (e == null ? 0 : 1) + "]");
      return null;
    }
    public boolean b(int x, int y, int z, aji block) {
      sets.add("[" + x + "," + y + "," + z + "," + aji.b(block) + "]");
      VillageLiveProbe.put(x, y, z, aji.b(block), 0);
      return true;
    }
  }
  static String num(double v) { return Double.toString(v); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static Field fld(Class<?> c, String n) throws Exception { return MobMoveProbe.field(c, n); }
  static int in(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }
  static double dbl(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getDouble(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static int index(List<sa> all, Object e) { for (int k = 0; k < all.size(); k++) if (all.get(k) == e) return k; return -1; }

  static int difficulty = 2;
  static int[][] blocks = {};
  static boolean water = false;

  static void scenario(String name, long seed, int ticks, String types, int[] sizes, double[][] pos, String[] script) throws Exception {
    if (System.getenv("FB_ONLY") != null && !name.equals(System.getenv("FB_ONLY"))) return;
    int n = types.length();
    MobMoveProbe.set(VillageLiveProbe.world, "r", rd.values()[difficulty]);
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = false;
    FW.booms.clear(); FW.sets.clear();
    for (int[] b : blocks) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++) VillageLiveProbe.put(x, y, z, b[6], b[7]);
    VillagerProbe.World.light = 15; MobMoveProbe.ProbeWorld.water = water;
    VillagerProbe.World.brightLevel = 15; VillagerProbe.World.brightPatches = new int[][] {}; VillagerProbe.World.vulnerable = true;
    VillagerProbe.World.immediateSlimes = false; VillagerProbe.World.chunkCache = false; VillagerProbe.World.unloaded.clear(); VillagerProbe.World.localDiff = 0;
    ahb w = VillageLiveProbe.world;
    ((agy) w.O()).a("mobGriefing", "true");
    VillageFightProbe.P player = new VillageFightProbe.P(w, "probe");
    List<sa> all = new ArrayList<>();
    SeedRandom.next = 4000000L + seed * 1000;
    for (int i = 0; i < n; i++) {
      sa e;
      switch (types.charAt(i)) {
        case 'z': e = new yq(w); break;
        case 'p': e = new yh(w); break;
        case 'b': e = new xx(w); break;
        case 'g': e = new yd(w); break;
        case 's': e = new yn(w); break;
        case 'k': e = new yk(w); break;
        case 'e': e = new ye(w); break;
        case 'm': { yf s = new yf(w); MobMoveProbe.method(ym.class, "a", int.class).invoke(s, sizes[i]); e = s; break; }
        default: throw new RuntimeException(types);
      }
      all.add(e);
    }
    all.add(player);
    VillagerProbe.World.entities.clear();
    for (int i = 0; i < all.size(); i++) {
      sa e = all.get(i);
      for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, fn, 0f);
      MobMoveProbe.set(e, "Z", new VillageFightProbe.Log(seed * 10 + i));
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
    List<sa> balls = new ArrayList<>();
    List<String> made = new ArrayList<>(), rows = new ArrayList<>();
    VillagerProbe.World.spawned.clear();
    for (int t = 0; t < ticks; t++) {
      List<String> punches = new ArrayList<>(), hurts = new ArrayList<>();
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "ball": {
            boolean large = p[2].equals("1");
            int shooter = Integer.parseInt(p[3]);
            double dx = Double.parseDouble(p[4]), dy = Double.parseDouble(p[5]), dz = Double.parseDouble(p[6]);
            sv owner = (sv) all.get(shooter);
            sa f = large ? new zg(w, owner, dx, dy, dz) : new zi(w, owner, dx, dy, dz);
            SeedRandom r = (SeedRandom) fld(sa.class, "Z").get(f);
            r.log.clear();
            f.s = Double.parseDouble(p[7]); f.t = Double.parseDouble(p[8]); f.u = Double.parseDouble(p[9]);
            int power = 1;
            if (large && p.length > 10) { power = Integer.parseInt(p[10]); fld(zg.class, "e").setInt(f, power); }
            made.add("[" + t + "," + (large ? 1 : 0) + "," + shooter + "," + num(dx) + "," + num(dy) + "," + num(dz) + "," + num(f.s) + "," + num(f.t) + "," + num(f.u) + "," + power + "," + r.seed + "]");
            balls.add(f);
            VillagerProbe.World.entities.add(f);
            break;
          }
          case "exact": {
            boolean large = p[2].equals("1");
            double x = Double.parseDouble(p[3]), y = Double.parseDouble(p[4]), z = Double.parseDouble(p[5]), ax = Double.parseDouble(p[6]), ay = Double.parseDouble(p[7]), az = Double.parseDouble(p[8]);
            sa f = large ? new zg(w, x, y, z, ax, ay, az) : new zi(w, x, y, z, ax, ay, az);
            int power = 1;
            if (large && p.length > 9) { power = Integer.parseInt(p[9]); fld(zg.class, "e").setInt(f, power); }
            made.add("[" + t + "," + (large ? 1 : 0) + ",-1," + num(ax) + "," + num(ay) + "," + num(az) + "," + num(f.s) + "," + num(f.t) + "," + num(f.u) + "," + power + ",0]");
            balls.add(f);
            VillagerProbe.World.entities.add(f);
            break;
          }
          case "punch": {
            sa f = balls.get(Integer.parseInt(p[2]));
            boolean hit = f.a(ro.a(player), 4.0f);
            azw look = player.ag();
            punches.add("[" + p[2] + "," + hit + "," + num(look.a) + "," + num(look.b) + "," + num(look.c) + "]");
            break;
          }
          case "look": MobMoveProbe.set(player, "y", Float.parseFloat(p[2])); MobMoveProbe.set(player, "z", Float.parseFloat(p[3])); break;
          case "move": { sa e = all.get(Integer.parseInt(p[2])); at(e, Double.parseDouble(p[3]), p.length > 5 ? Double.parseDouble(p[5]) : e.t, Double.parseDouble(p[4])); break; }
          case "kill": all.get(Integer.parseInt(p[2])).B(); break;
          case "rule": ((agy) w.O()).a(p[2], p[3]); break;
          case "fire": all.get(Integer.parseInt(p[2])).e(Integer.parseInt(p[3])); break;
          case "hurt": { // hurt victim kind amount: kind m<i> a mob attacker (DamageSource.causeMobDamage), p the player, n a fireball without a shooter, s the victim itself
            sv victim = (sv) all.get(Integer.parseInt(p[2]));
            ro src = p[3].equals("p") ? ro.a((yz) player) : p[3].equals("n") ? ro.a(new zg(w, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1), (sa) null) : p[3].equals("s") ? ro.a(victim) : ro.a((sv) all.get(Integer.parseInt(p[3].substring(1))));
            boolean hit = victim.a(src, Float.parseFloat(p[4]));
            hurts.add("[" + p[2] + "," + hit + "," + num(victim.aS()) + "]");
            break;
          }
          default: throw new RuntimeException(op);
        }
      }
      FW.booms.clear(); FW.sets.clear();
      for (sa f : new ArrayList<>(balls)) {
        if (f.K) continue;
        f.aa++;
        f.h();
      }
      // World.updateEntities drops every setDead entity from the loaded list at the end of its tick (the probe's list keeps them otherwise, and a dead large ball is still collidable).
      VillagerProbe.World.entities.removeIf(e -> e.K);
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < all.size(); i++) {
        sa e = all.get(i);
        if (i > 0) row.append(",");
        row.append("[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append(",").append(num(e.v)).append(",").append(num(e.w)).append(",").append(num(e.x)).append(",")
          .append(num(((sv) e).aS())).append(",").append(fld(sa.class, "e").getInt(e)).append(",").append(e.K ? 1 : 0).append(",").append(e instanceof xx || e instanceof yk || e instanceof ye || e instanceof yn || e instanceof yh ? index(all, ((td) e).bT()) : -1).append("]");
      }
      row.append("],[");
      for (int k = 0; k < balls.size(); k++) {
        sa f = balls.get(k);
        if (k > 0) row.append(",");
        row.append("[").append(f instanceof zg ? 1 : 0).append(",").append(index(all, fld(ze.class, "a").get(f))).append(",").append(num(f.s)).append(",").append(num(f.t)).append(",").append(num(f.u)).append(",")
          .append(num(f.v)).append(",").append(num(f.w)).append(",").append(num(f.x)).append(",").append(num(fld(ze.class, "b").getDouble(f))).append(",").append(num(fld(ze.class, "c").getDouble(f))).append(",").append(num(fld(ze.class, "d").getDouble(f))).append(",")
          .append(f.K ? 1 : 0).append(",").append(fld(ze.class, "au").getInt(f)).append(",").append(fld(ze.class, "at").getInt(f)).append(",").append(f instanceof zg ? fld(zg.class, "e").getInt(f) : 0).append("]");
      }
      row.append("],[").append(String.join(",", FW.booms)).append("],[").append(String.join(",", FW.sets)).append("],[").append(String.join(",", punches)).append("],[").append(String.join(",", hurts)).append("]]");
      rows.add(row.toString());
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"fireballs\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"difficulty\":" + difficulty + ",\"ticks\":" + ticks + ",\"types\":" + q(types) + ",\"sizes\":" + Arrays.toString(sizes)
      + (water ? ",\"water\":true" : "") + (blocks.length > 0 ? ",\"blocks\":" + Arrays.deepToString(blocks) : "") + ",\"pos\":" + Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"made\":[" + String.join(",", made)
      + "],\"rows\":[" + String.join(",", rows) + "]}");
    VillagerProbe.reset();
  }


  static String ball(int t, int large, int shooter, String aim, double x, double y, double z, int power) { return t + " ball " + large + " " + shooter + " " + aim + " " + x + " " + y + " " + z + (power != 1 ? " " + power : ""); }
  static String exact(int t, int large, double x, double y, double z, double ax, double ay, double az) { return t + " exact " + large + " " + x + " " + y + " " + z + " " + ax + " " + ay + " " + az; }
  static int[] sz(int n) { return new int[n]; }
  static final double[] FAR = {150.5, 150.5};

  static void scenarios() throws Exception {
    String[] quiet = {};
    long s = 4001;
    // Open flight: large and small, a shallow and a steep aim (the steep one meets the stone floor and explodes or lights).
    for (int large = 1; large >= 0; large--)
      for (int k = 0; k < 2; k++, s++)
        scenario("fb-flight-" + (large == 1 ? "large" : "small") + "-" + s, s, 100, "g", sz(1), new double[][] {{60.5, 60.5, 20}, FAR}, new String[] {ball(1, large, 0, k == 0 ? "10 -2 20" : "-8 -6 12", 60.5, 22.5, 63, 1)});
    // A stone wall: large power 1 and 3 with mobGriefing on and off, small with it on and off (the small ball's fire has no rule check in 1.7.10).
    blocks = new int[][] {{40, 0, 80, 80, 12, 81, 1, 0}};
    int[][] wall = {{1, 1, 1}, {1, 3, 0}, {0, 1, 1}, {0, 1, 0}};
    for (int[] c : wall) {
      scenario("fb-wall-" + (c[0] == 1 ? "large" : "small") + "-p" + c[1] + (c[2] == 1 ? "-grief" : "-nogrief") + "-" + s, s, 60, "g", sz(1), new double[][] {{60.5, 60.5, 2}, FAR},
        new String[] {"0 rule mobGriefing " + (c[2] == 1), ball(1, c[0], 0, "0 0 20", 60.5, 4.5, 64.5, c[1])});
      s++;
    }
    // Floor and ceiling: four balls on near-vertical aims (small up, small down, large up, large down).
    blocks = new int[][] {{30, 12, 30, 90, 12, 90, 1, 0}};
    scenario("fb-vertical-" + s, s, 50, "g", sz(1), new double[][] {{60.5, 40.5, 2}, FAR}, new String[] {ball(1, 0, 0, "0 20 2", 50.5, 4.5, 60.5, 1), ball(1, 0, 0, "0 -20 2", 56.5, 4.5, 60.5, 1), ball(1, 1, 0, "0 20 2", 62.5, 4.5, 60.5, 1), ball(1, 1, 0, "0 -20 2", 68.5, 4.5, 60.5, 2)});
    s++;
    blocks = new int[][] {};
    // Block shapes: small balls on a straight line into 22 kinds of block at two heights (the 2-argument rayTraceBlocks stops at plants, torches, sign-likes too).
    int[][] shape = {{1, 0}, {20, 0}, {38, 0}, {31, 1}, {50, 5}, {44, 0}, {85, 0}, {53, 0}, {65, 2}, {78, 0}, {171, 0}, {30, 0}, {63, 0}, {70, 0}, {55, 0}, {96, 0}, {107, 0}, {69, 5}, {92, 0}, {139, 0}, {102, 0}, {51, 0}, {54, 0}, {64, 0}};
    List<int[]> bl = new ArrayList<>(); List<String> ops = new ArrayList<>();
    for (int i = 0; i < shape.length; i++) {
      int x = 20 + i * 3;
      bl.add(new int[] {x, 0, 70, x, 0, 70, shape[i][0], shape[i][1]});
      if (shape[i][0] == 64) bl.add(new int[] {x, 1, 70, x, 1, 70, 64, 8});
      for (int h = 0; h < 2; h++) ops.add(exact(1, 0, x + 0.5, h == 0 ? 0.3 : 0.7, 60.5, 0, 0, 0.1));
    }
    blocks = bl.toArray(new int[0][]);
    scenario("fb-shapes-small-" + s, s, 30, "g", sz(1), new double[][] {FAR, {150.5, 140.5}}, ops.toArray(new String[0])); s++;
    ops.clear();
    for (int i = 0; i < shape.length; i++) for (int h = 0; h < 2; h++) ops.add(exact(1, 1, 20 + i * 3 + 0.5, h == 0 ? -0.2 : 0.4, 60.5, 0, 0, 0.1));
    scenario("fb-shapes-large-" + s, s, 30, "g", sz(1), new double[][] {FAR, {150.5, 140.5}}, ops.toArray(new String[0])); s++;
    blocks = new int[][] {};
    // Entities: ball lanes into a zombie, a pigman, a ghast, a magma cube (size 4), a blaze and the player; shooter blaze 0 at the side.
    for (int large = 0; large <= 1; large++) {
      List<String> o = new ArrayList<>();
      for (int lane = 0; lane < 6; lane++) o.add(ball(1, large, 0, "0 0 40", 30.5 + lane * 8, 1.0, 62.5, 1));
      scenario("fb-entities-" + (large == 1 ? "large" : "small") + "-" + s, s, 40, "bzpgmb", new int[] {0, 0, 0, 0, 4, 0},
        new double[][] {{10.5, 10.5}, {30.5, 70.5}, {38.5, 70.5}, {46.5, 70.5, 0}, {54.5, 70.5}, {62.5, 70.5}, {70.5, 70.5}}, o.toArray(new String[0]));
      s++;
    }
    // The nearest of two zombies wins; a wall in front hides a zombie; a ball that starts inside a zombie's grown box; the zombie behind the ball.
    blocks = new int[][] {{58, 0, 66, 62, 5, 66, 1, 0}};
    scenario("fb-nearest-" + s, s, 40, "bzzzz", sz(5), new double[][] {{10.5, 10.5}, {40.5, 72.5}, {40.5, 68.5}, {60.5, 70.5}, {50.5, 62.5}, {150.5, 150.5}},
      new String[] {ball(1, 0, 0, "0 0 40", 40.5, 1.0, 62.5, 1), ball(1, 0, 0, "0 0 40", 60.5, 1.0, 62.5, 1), ball(1, 1, 0, "0 0 40", 50.5, 1.0, 62.0, 1)});
    s++;
    blocks = new int[][] {};
    // The shooter's own box is skipped for 25 ticks of flight (ticksInAir, not ticksAlive), then it is hit: balls aimed back at the ghast from near and far.
    scenario("fb-grace-" + s, s, 80, "g", sz(1), new double[][] {{60.5, 60.5, 4}, FAR},
      new String[] {ball(1, 1, 0, "0 0 -1", 60.5, 6.5, 66.5, 1), ball(1, 1, 0, "0 0 -1", 54.5, 6.5, 100.5, 1), ball(1, 1, 0, "0 0 -1", 66.5, 6.5, 120.5, 1), ball(1, 0, 0, "0 0 -1", 72.5, 6.5, 110.5, 1)});
    s++;
    // The player punches a large ball: toward the ghast (it dies to its own deflected fireball), early and late past the player (ticksInAir keeps counting).
    String[] looks = {"180 0", "180 0", "180 0"};
    int[] punchAt = {3, 4, 30};
    for (int k = 0; k < 3; k++) {
      scenario("fb-punch-" + k + "-" + s, s, 130, "gg", sz(2), new double[][] {{60.5, 40.5, 0}, {k == 0 ? 60.5 : 100.5, 100.5, 0}, {60.5, 80.5}}, // the second ghast stays out of the late balls' lane
        new String[] {"0 look " + looks[k], ball(1, 1, 0, k == 0 ? "0 0 40" : "0 0 20", 60.5, 2.5, k == 0 ? 50.5 : 90.5, 1), punchAt[k] + " punch 0"});
      s++;
    }
    scenario("fb-punch-small-" + s, s, 40, "bz", sz(2), new double[][] {{60.5, 40.5, 0}, {60.5, 100.5, 0}, {60.5, 80.5}}, new String[] {"0 look 180 0", ball(1, 0, 0, "0 0 40", 60.5, 1.4, 50.5, 1), "3 punch 0"});
    s++;
    // Water: a pool (y 1 to 3) crossed at nine heights, small and large (the 0.8 drag, the thin box test of isInWater).
    water = true; blocks = new int[][] {{14, 1, 62, 100, 3, 76, 9, 0}};
    for (int large = 0; large <= 1; large++) {
      List<String> o = new ArrayList<>();
      double[] hs = {0.0, 0.5, 0.8, 1.0, 1.5, 2.5, 3.5, 3.9, 4.3};
      for (int i = 0; i < hs.length; i++) o.add(exact(1, large, 20.5 + i * 7, hs[i], 55.5, 0, 0, 0.1));
      scenario("fb-water-" + (large == 1 ? "large" : "small") + "-" + s, s, 45, "g", sz(1), new double[][] {FAR, {150.5, 140.5}}, o.toArray(new String[0]));
      s++;
    }
    water = false; blocks = new int[][] {};
    // The shooter dies: the ball is removed on its next update (small and large; a ball whose shooter is the player stays).
    scenario("fb-shooter-dead-" + s, s, 30, "gb", new int[] {0, 0}, new double[][] {{60.5, 60.5, 4}, {80.5, 60.5, 0}, FAR},
      new String[] {ball(1, 1, 0, "0 0 20", 60.5, 6.5, 64.5, 1), ball(1, 0, 1, "0 0 20", 80.5, 1.4, 62.5, 1), "5 kill 0", "7 kill 1"});
    s++;
    // Two large balls head on (EntityFireball is collidable; the one that is hit is deflected along the shooter's look vector), a small one crossing.
    scenario("fb-ballball-" + s, s, 40, "gg", sz(2), new double[][] {{60.5, 40.5, 2}, {60.5, 100.5, 2}, FAR},
      new String[] {ball(1, 1, 0, "0 0 40", 60.5, 4.5, 44.5, 1), ball(1, 1, 1, "0 0 -40", 60.5, 4.5, 96.5, 1), ball(1, 0, 0, "0 0 40", 70.5, 4.5, 44.5, 1), ball(1, 1, 1, "0 0 -40", 70.5, 4.5, 96.5, 1)});
    s++;
    // Fire on a mob: a burning zombie keeps the longer fire, a fresh one gets 5 seconds, and the damage and knockback of 5 hits.
    scenario("fb-fire-" + s, s, 40, "bzzz", sz(4), new double[][] {{10.5, 10.5}, {30.5, 70.5}, {38.5, 70.5}, {46.5, 70.5}, FAR},
      new String[] {"0 fire 2 10", "0 fire 3 2", ball(1, 0, 0, "0 0 40", 30.5, 1.0, 62.5, 1), ball(1, 0, 0, "0 0 40", 38.5, 1.0, 62.5, 1), ball(1, 0, 0, "0 0 40", 46.5, 1.0, 62.5, 1)});
    s++;
    // mobGriefing off: a large ball on a zombie and on the player (the explosion is the world's either way).
    scenario("fb-nogrief-entity-" + s, s, 40, "bz", sz(2), new double[][] {{10.5, 10.5}, {30.5, 70.5}, {60.5, 70.5}},
      new String[] {"0 rule mobGriefing false", ball(1, 1, 0, "0 0 40", 30.5, 1.0, 62.5, 2), ball(1, 1, 0, "0 0 40", 60.5, 1.0, 62.5, 1)});
    s++;
    // EntityMob.attackEntityFrom (yg.a) on the blaze, the silverfish, the giant, the spider and the pigman: the attacker of a hit that counts becomes entityToAttack
    // (a mob, the player), a refused hit (not above the hurt window's last damage) leaves it, an entity-less source and the victim itself change nothing.
    scenario("fb-hurt-mobs-" + s, s, 8, "bkespzz", sz(7), new double[][] {{20.5, 20.5}, {26.5, 20.5}, {32.5, 20.5}, {38.5, 20.5}, {44.5, 20.5}, {50.5, 20.5}, {56.5, 20.5}, {150.5, 150.5}},
      concat(hurts(0, "m5 4"), hurts(1, "p 4"), hurts(2, "p 6"), hurts(3, "m6 5"), hurts(4, "n 7"), hurts(5, "s 8"), hurts(6, "m5 9"), hurts(7, "n 12")));
    s++;
    // A fireball without a shooter (a dispenser's): DamageSource.causeFireballDamage uses the ball itself as the source entity, so a fresh hit knocks back from the ball
    // and makes the ball the victim's entityToAttack (a dead entity: the next action state clears it).
    scenario("fb-hurt-ball-" + s, s, 3, "bkespz", sz(6), new double[][] {{20.5, 20.5}, {26.5, 20.5}, {32.5, 20.5}, {38.5, 20.5}, {44.5, 20.5}, {50.5, 20.5}, {150.5, 150.5}},
      hurts(0, "n 5"));
    s++;
  }
  // One hurt op per victim 0 to 4 at tick `t` (kind and amount as the op names them).
  static String[] hurts(int t, String what) {
    String[] o = new String[5];
    for (int v = 0; v < 5; v++) o[v] = t + " hurt " + v + " " + what;
    return o;
  }
  static String[] concat(String[]... parts) {
    List<String> o = new ArrayList<>();
    for (String[] a : parts) o.addAll(Arrays.asList(a));
    return o.toArray(new String[0]);
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
    VillagerProbe.World.realRays = true;
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    ArmorEnchantmentProbe.U = u;
    FW w = (FW) u.allocateInstance(FW.class);
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
    scenarios();
  }
}
