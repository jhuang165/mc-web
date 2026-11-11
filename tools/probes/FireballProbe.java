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
  static long SMALL_SEED = Long.parseLong(System.getenv().getOrDefault("FB_SMALL_SEED", "4211"));
  static boolean unified = false; // batch 42: one loaded entity list in insertion order (World.updateEntities): mobs, then balls as they are launched, a mob that `join`s later after them
  static boolean drawLog = false; // batch 43: a seventh row section lists the Entity.rand draws of each entity of that tick
  static boolean tickMobs = false; // batch 41: every mob (not the player) is updated each tick before the fireballs, and a fireball a mob spawns joins the list at once (World.spawnEntityInWorld) and ticks in the same pass

  static void scenario(String name, long seed, int ticks, String types, int[] sizes, double[][] pos, String[] script) throws Exception {
    if (System.getenv("FB_ONLY") != null && !name.equals(System.getenv("FB_ONLY"))) return;
    if (System.getenv("FB_PREFIX") != null && !name.startsWith(System.getenv("FB_PREFIX"))) return;
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
        case 'x': e = new yl(w); break; // batch 41: EntitySkeleton (bare, empty hand)
        case 'w': e = new wr(w); break; // batch 41: EntitySnowman
        case 'i': e = new wt(w); break; // batch 42: EntityIronGolem
        case 'm': { yf s = new yf(w); MobMoveProbe.method(ym.class, "a", int.class).invoke(s, sizes[i]); e = s; break; }
        default: throw new RuntimeException(types);
      }
      all.add(e);
    }
    all.add(player);
    VillagerProbe.World.entities.clear();
    java.util.Set<Integer> late = new java.util.HashSet<>(); // batch 42: `join k` ops: mob k is created but joins the world's list only on that tick
    for (String op : script) { String[] jp = op.split(" "); if (jp[1].equals("join") || jp[1].equals("idle")) late.add(Integer.parseInt(jp[2])); }
    List<sa> loaded = new ArrayList<>();
    for (int i = 0; i < all.size(); i++) {
      sa e = all.get(i);
      for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, fn, 0f);
      MobMoveProbe.set(e, "Z", new VillageFightProbe.Log(seed * 10 + i));
      at(e, pos[i][0], pos[i].length > 2 ? pos[i][2] : 0, pos[i][1]);
      MobMoveProbe.set(e, "D", !(e instanceof yd));
      if (late.contains(i)) continue;
      VillagerProbe.World.entities.add(e);
      if (i < n) loaded.add(e);
    }
    player.a(yj.a).a(1000.0);
    player.g(1000.0f);
    MobMoveProbe.set(player, "L", 0f);
    at(player, pos[n][0], pos[n].length > 2 ? pos[n][2] : 0, pos[n][1]);
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(Arrays.asList(player));
    List<sa> balls = new ArrayList<>();
    List<String> made = new ArrayList<>(), rows = new ArrayList<>(), shots = new ArrayList<>();
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
            loaded.add(f);
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
            loaded.add(f);
            break;
          }
          case "punch": {
            sa f = balls.get(Integer.parseInt(p[2]));
            boolean hit = f.a(ro.a(player), 4.0f);
            azw look = player.ag();
            punches.add("[" + p[2] + "," + hit + "," + num(look.a) + "," + num(look.b) + "," + num(look.c) + "]");
            break;
          }
          case "ground": { // ground k x y z: the ball is stuck in the block at (x, y, z) (EntityFireball.inGround, xTile, yTile, zTile, inTile), which no 1.7.10 path sets itself
            sa f = balls.get(Integer.parseInt(p[2]));
            int gx = Integer.parseInt(p[3]), gy = Integer.parseInt(p[4]), gz = Integer.parseInt(p[5]);
            fld(ze.class, "e").setInt(f, gx); fld(ze.class, "f").setInt(f, gy); fld(ze.class, "g").setInt(f, gz);
            fld(ze.class, "h").set(f, w.a(gx, gy, gz)); fld(ze.class, "i").setBoolean(f, true);
            break;
          }
          case "join": { sa e = all.get(Integer.parseInt(p[2])); VillagerProbe.World.entities.add(e); loaded.add(e); break; } // World.spawnEntityInWorld: the end of loadedEntityList
          case "snow": { // snow v i: a snowball thrown by mob i hits entity v (EntitySnowball.onImpact, zj.a(MovingObjectPosition): 3 to an EntityBlaze, else 0), executed
            sa victim = all.get(Integer.parseInt(p[2]));
            zj ball = new zj(w, (sv) all.get(Integer.parseInt(p[3])));
            java.lang.reflect.Method imp = zj.class.getDeclaredMethod("a", azu.class); imp.setAccessible(true);
            float before = ((sv) victim).aS();
            imp.invoke(ball, new azu(victim));
            hurts.add("[" + p[2] + "," + (((sv) victim).aS() < before) + "," + num(((sv) victim).aS()) + "]");
            break;
          }
          case "idle": break; // idle k: mob k is never added to the list (a damage source only)
          case "health": ((sv) all.get(Integer.parseInt(p[2]))).g(Float.parseFloat(p[3])); break; // health k h: setHealth
          case "air": VillageLiveProbe.put(Integer.parseInt(p[2]), Integer.parseInt(p[3]), Integer.parseInt(p[4]), p.length > 5 ? Integer.parseInt(p[5]) : 0, 0); break; // air x y z [id]: the cell becomes air, or the given block
          case "look": MobMoveProbe.set(player, "y", Float.parseFloat(p[2])); MobMoveProbe.set(player, "z", Float.parseFloat(p[3])); break;
          case "move": { sa e = all.get(Integer.parseInt(p[2])); at(e, Double.parseDouble(p[3]), p.length > 5 ? Double.parseDouble(p[5]) : e.t, Double.parseDouble(p[4])); break; }
          case "kill": all.get(Integer.parseInt(p[2])).B(); break;
          case "rule": ((agy) w.O()).a(p[2], p[3]); break;
          case "fire": all.get(Integer.parseInt(p[2])).e(Integer.parseInt(p[3])); break;
          case "hurt": { // hurt victim kind amount: kind m<i> a mob attacker (DamageSource.causeMobDamage), p the player, n a fireball without a shooter, s the victim itself
            sv victim = (sv) all.get(Integer.parseInt(p[2]));
            ro src = p[3].startsWith("a") ? ro.a((zc) null, all.get(Integer.parseInt(p[3].substring(1)))) : p[3].startsWith("t") ? ro.a((sa) null, all.get(Integer.parseInt(p[3].substring(1)))) : p[3].equals("p") ? ro.a((yz) player) : p[3].equals("n") ? ro.a(new zg(w, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1), (sa) null) : p[3].equals("s") ? ro.a(victim) : ro.a((sv) all.get(Integer.parseInt(p[3].substring(1))));
            boolean hit = victim.a(src, Float.parseFloat(p[4]));
            hurts.add("[" + p[2] + "," + hit + "," + num(victim.aS()) + "]");
            break;
          }
          default: throw new RuntimeException(op);
        }
      }
      FW.booms.clear(); FW.sets.clear();
      if (drawLog) for (sa e : all) { Object lr = fld(sa.class, "Z").get(e); if (lr instanceof VillageFightProbe.Log) ((VillageFightProbe.Log) lr).log.clear(); }
      if (unified) {
        for (int i = 0; i < loaded.size(); i++) { // the list is walked by index: a ball a mob launches joins the end and updates in this pass
          sa e = loaded.get(i);
          if (e.K) continue;
          e.aa++;
          e.h();
          while (!VillagerProbe.World.spawned.isEmpty()) {
            Object sp = VillagerProbe.World.spawned.remove(0);
            if (!(sp instanceof ze)) continue;
            sa f = (sa) sp;
            shots.add("[" + t + "," + (f instanceof zg ? 1 : 0) + "," + index(all, fld(ze.class, "a").get(f)) + "," + ((SeedRandom) fld(sa.class, "Z").get(f)).seed + "]");
            balls.add(f);
            VillagerProbe.World.entities.add(f);
            loaded.add(f);
          }
        }
        loaded.removeIf(e -> e.K);
      } else if (tickMobs) {
        for (int i = 0; i < n; i++) {
          sa e = all.get(i);
          if (e.K) continue;
          e.aa++;
          e.h();
          while (!VillagerProbe.World.spawned.isEmpty()) {
            Object sp = VillagerProbe.World.spawned.remove(0);
            if (!(sp instanceof ze)) continue;
            sa f = (sa) sp;
            shots.add("[" + t + "," + (f instanceof zg ? 1 : 0) + "," + index(all, fld(ze.class, "a").get(f)) + "," + ((SeedRandom) fld(sa.class, "Z").get(f)).seed + "]");
            balls.add(f);
            VillagerProbe.World.entities.add(f);
          }
        }
      }
      if (!unified) for (sa f : new ArrayList<>(balls)) {
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
          .append(num(((sv) e).aS())).append(",").append(fld(sa.class, "e").getInt(e)).append(",").append(e.K ? 1 : 0).append(",").append(e instanceof yd ? index(all, fld(yd.class, "bq").get(e)) : e instanceof xx || e instanceof yk || e instanceof ye || e instanceof yn || e instanceof yh ? index(all, ((td) e).bT()) : -1).append("]");
      }
      row.append("],[");
      for (int k = 0; k < balls.size(); k++) {
        sa f = balls.get(k);
        if (k > 0) row.append(",");
        row.append("[").append(f instanceof zg ? 1 : 0).append(",").append(index(all, fld(ze.class, "a").get(f))).append(",").append(num(f.s)).append(",").append(num(f.t)).append(",").append(num(f.u)).append(",")
          .append(num(f.v)).append(",").append(num(f.w)).append(",").append(num(f.x)).append(",").append(num(fld(ze.class, "b").getDouble(f))).append(",").append(num(fld(ze.class, "c").getDouble(f))).append(",").append(num(fld(ze.class, "d").getDouble(f))).append(",")
          .append(f.K ? 1 : 0).append(",").append(fld(ze.class, "au").getInt(f)).append(",").append(fld(ze.class, "at").getInt(f)).append(",").append(f instanceof zg ? fld(zg.class, "e").getInt(f) : 0).append("]");
      }
      row.append("],[").append(String.join(",", FW.booms)).append("],[").append(String.join(",", FW.sets)).append("],[").append(String.join(",", punches)).append("],[").append(String.join(",", hurts)).append("]");
      if (drawLog) {
        row.append(",[");
        for (int i = 0; i < all.size(); i++) { Object lr = fld(sa.class, "Z").get(all.get(i)); row.append(i > 0 ? "," : "").append("[").append(lr instanceof VillageFightProbe.Log ? drawsOf(((VillageFightProbe.Log) lr).log) : "").append("]"); }
        row.append("]");
      }
      row.append("]");
      rows.add(row.toString());
    }
    StringBuilder sc = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    System.out.println("{\"case\":\"fireballs\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"difficulty\":" + difficulty + ",\"ticks\":" + ticks + ",\"types\":" + q(types) + ",\"sizes\":" + Arrays.toString(sizes)
      + (water ? ",\"water\":true" : "") + (blocks.length > 0 ? ",\"blocks\":" + Arrays.deepToString(blocks) : "") + ",\"pos\":" + Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"made\":[" + String.join(",", made)
      + "]" + (unified ? ",\"unified\":true" : "") + (drawLog ? ",\"draws\":true" : "") + (tickMobs ? ",\"tickMobs\":true,\"shots\":[" + String.join(",", shots) + "]" : "") + ",\"rows\":[" + String.join(",", rows) + "]}");
    VillagerProbe.reset();
  }


  static String drawsOf(List<String> log) { StringBuilder s = new StringBuilder(); for (String d : log) s.append(s.length() > 0 ? "," : "").append("\"").append(d).append("\""); return s.toString(); }
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
  // Batch 41 (names fb41-*): the inGround path executed (EntityFireball.onUpdate with the fields the probe sets; no 1.7.10 path sets them) and blaze volleys at a mob that hurt the blaze.
  static void scenarios41() throws Exception {
    long s = 4101;
    blocks = new int[][] {{60, 5, 60, 60, 5, 60, 1, 0}, {70, 5, 60, 70, 5, 60, 1, 0}, {80, 5, 60, 80, 5, 60, 1, 0}};
    for (int large = 1; large >= 0; large--) {
      String k = large == 1 ? "large" : "small";
      // stuck in a block that stays: ticksAlive counts to 600 and setDead (the ball does not move, hit or explode meanwhile)
      scenario("fb41-ground-stays-" + k + "-" + s, s, 620, "g", sz(1), new double[][] {{150.5, 150.5, 30}, {150.5, 140.5}}, new String[] {ball(1, large, 0, "0 0 1", 60.5, 6.5, 60.5, 1), "2 ground 0 60 5 60"}); s++;
      // the block is removed: the ball lets go, its motion scaled by three Random floats, and flies on (ticksAlive and ticksInAir reset)
      scenario("fb41-ground-released-" + k + "-" + s, s, 80, "g", sz(1), new double[][] {{150.5, 150.5, 30}, {150.5, 140.5}}, new String[] {ball(1, large, 0, "0 0 1", 70.5, 6.5, 60.5, 1), "2 ground 0 70 5 60", "30 air 70 5 60"}); s++;
      // a different block in its place: still released (the block is no longer the stored tile)
      scenario("fb41-ground-swapped-" + k + "-" + s, s, 60, "g", sz(1), new double[][] {{150.5, 150.5, 30}, {150.5, 140.5}}, new String[] {ball(1, large, 0, "0 0 1", 80.5, 6.5, 60.5, 1), "2 ground 0 80 5 60", "20 air 80 5 60 20"}); s++;
    }
    blocks = new int[][] {};
    // blaze volleys at a mob: the blaze is hurt by a zombie (mob damage), a skeleton's arrow and a thrown snowball, becomes its target and shoots small fireballs at it
    tickMobs = true;
    String[] kinds = {"m1", "a1", "t1"};
    // (seed 4109 made the idle zombie wander on tick 15, where the port's wandering zombie turns differently from tick 19: a legacy zombie wander gap, not part of this record)
    for (int k = 0; k < 3; k++) {
      if (k == 2) s = 4119;
      scenario("fb41-blaze-volley-" + new String[] {"zombie", "arrow", "snowball"}[k] + "-" + s, s, 300, k == 1 ? "bx" : "bz", sz(2), new double[][] {{60.5, 60.5, 3}, {72.5, 64.5, 0}, {60.5, 105.5}}, new String[] {"3 hurt 0 " + kinds[k] + " 2"}); s++;
    }
    s = 4110;
    scenario("fb41-blaze-volley-far-" + s, s, 300, "bz", sz(2), new double[][] {{60.5, 60.5, 3}, {100.5, 60.5, 0}, {80.5, 105.5}}, new String[] {"3 hurt 0 m1 2"}); s++;
    tickMobs = false;
  }
  // Batch 42 (names fb42-*): one loaded entity list. World.updateEntities walks loadedEntityList in insertion order, so a ball launched before a mob joined the world updates before it
  // (a ball sweeps the mob's last position, a ball that kills it lands before the mob's own update), and a ball launched after it updates after it. `join k` adds mob k at its place in the list.
  static void scenarios42() throws Exception {
    long s = 4201;
    unified = true; tickMobs = true;
    // The balls are the dispenser's (`exact`, no shooter), so no shooter mob ticks beside the zombies. Lane i: a zombie chasing the player, a ball aimed down the lane from z0.
    // The first four zombies join after their ball is in the list, the last three before it.
    for (int large = 0; large <= 1; large++) {
      for (int rep = 0; rep < 3; rep++) {
        List<String> o = new ArrayList<>();
        double[][] pos = new double[8][];
        for (int lane = 0; lane < 7; lane++) pos[lane] = new double[] {14.5 + lane * 8, 66.5 + 0.6 * lane, 0};
        pos[7] = new double[] {60.5, 100.5, 0};
        for (int lane = 0; lane < 7; lane++) {
          o.add(exact(1, large, 14.5 + lane * 8, 1.0, 58.0 + rep * 1.5 + 0.2 * lane, 0, 0, 0.1));
          if (lane < 4) o.add("1 join " + lane); // the zombie joins after the ball
        }
        scenario("fb42-order-" + (large == 1 ? "large" : "small") + "-" + rep + "-" + s, s, 30, "zzzzzzz", sz(7), pos, o.toArray(new String[0]));
        s++;
      }
    }
    // A ball that kills a mob before its update: the zombie has 3 health; the ball is ahead of it in the list in one case and behind it in the other.
    for (int late = 1; late >= 0; late--) {
      scenario("fb42-order-kill-" + (late == 1 ? "ball-first" : "mob-first") + "-" + s, s, 20, "z", sz(1), new double[][] {{60.5, 66.5, 0}, {60.5, 72.5, 0}},
        late == 1 ? new String[] {"0 health 0 3", exact(1, 0, 60.5, 1.0, 62.5, 0, 0, 0.1), "1 join 0"} : new String[] {"0 health 0 3", exact(1, 0, 60.5, 1.0, 62.5, 0, 0, 0.1)});
      s++;
    }
    // Two balls with a mob between them in the list: A (launched first), the mob, B.
    scenario("fb42-order-between-" + s, s, 30, "z", sz(1), new double[][] {{60.5, 66.5, 0}, {60.5, 76.5, 0}},
      new String[] {exact(1, 0, 60.5, 1.0, 59.5, 0, 0, 0.1), "1 join 0", exact(1, 0, 60.5, 1.0, 59.5, 0, 0, 0.1)});
    s++;
    // A ghast's large balls (and a small one) at mobs, the mobs ticking: zombie, skeleton, blaze, pigman, spider, silverfish, each in its own lane 6 blocks ahead of the ball.
    // The ghast (index 0) is 100 blocks from the player, so it never shoots itself; the balls are its script's. Slot 9 of the ghast and of every EntityCreature in the row is its target.
    String victims = "zxbpsk";
    for (int large = 1; large >= 0; large--) {
      if (large == 0) s = SMALL_SEED;
      List<String> o = new ArrayList<>();
      double[][] pos = new double[victims.length() + 2][];
      pos[0] = new double[] {150.5, 150.5, 30};
      for (int v = 0; v < victims.length(); v++) { pos[1 + v] = new double[] {36.5 + v * 4, 66.5, 0}; o.add(ball(1, large, 0, "0 0 40", 36.5 + v * 4, 1.0, v == 1 ? 64.0 : 60.5, 1)); }
      pos[victims.length() + 1] = new double[] {60.5, 76.5, 0};
      scenario("fb42-ghast-mobs-" + (large == 1 ? "large" : "small") + "-" + s, s, 24, "g" + victims, sz(victims.length() + 1), pos, o.toArray(new String[0]));
      s++;
    }
    // A snowball thrown by a snow golem at a blaze (3 damage, the golem becomes its target) and at a zombie (0).
    // (the golem stands 18 blocks from the blaze, outside its own 16 block target range, and the record ends before the first volley can hit it, so no snowball of its own flies)
    scenario("fb42-snowball-blaze-" + s, s, 50, "bwz", sz(3), new double[][] {{60.5, 60.5, 3}, {78.5, 60.5, 0}, {60.5, 66.5, 0}, {60.5, 105.5, 0}},
      new String[] {"3 snow 0 1", "3 snow 2 1"});
    s++;
    // The same ball at an iron golem alone (EntityIronGolem, wt), 6 blocks ahead, the player 10 behind it.
    for (int large = 1; large >= 0; large--) {
      scenario("fb42-ghast-golem-" + (large == 1 ? "large" : "small") + "-" + s, s, 40, "gi", sz(2), new double[][] {{150.5, 150.5, 30}, {60.5, 66.5, 0}, {60.5, 90.5, 0}}, new String[] {ball(1, large, 0, "0 0 40", 60.5, 1.0, 60.5, 1)});
      s++;
    }
    // The ghast hurt by a zombie (mob damage), a skeleton's arrow and a snow golem's snowball: it targets only players (EntityGhast.updateEntityActionState), slot 9 stays the player or -1.
    for (int k = 0; k < 3; k++) {
      scenario("fb42-ghast-hurt-" + new String[] {"zombie", "arrow", "snowball"}[k] + "-" + s, s, 60, "gzxw", sz(4), new double[][] {{60.5, 60.5, 3}, {62.5, 62.5, 0}, {64.5, 60.5, 0}, {66.5, 60.5, 0}, {60.5, 100.5, 0}},
        new String[] {"0 idle 1", "0 idle 2", "0 idle 3", "3 hurt 0 " + new String[] {"m1", "a2", "t3"}[k] + " 1", "30 hurt 0 " + new String[] {"m1", "a2", "t3"}[k] + " 1"});
      s++;
    }
    unified = false; tickMobs = false;
  }
  // Batch 43 (names fb43-*): legacy wanderers over many seeds with draws logged per entity (the player far away, or 22 blocks off), the silverfish
  // hide and despawn deaths, the small ghast balls at mobs on the seeds batch 42 avoided, and an iron golem next to a blaze with the blaze dying.
  static void scenarios43() throws Exception {
    unified = true; tickMobs = true; drawLog = true;
    int[][] idle = {{'s', 4301}, {'s', 4311}, {'s', 4318}, {'p', 4311}, {'p', 4318}, {'b', 4301}, {'b', 4302}, {'k', 4301}, {'k', 4302}, {'k', 4306}, {'k', 4307}, {'k', 4312}, {'k', 4320}};
    for (int[] c : idle) {
      char k = (char) c[0];
      scenario("fb43-idle-" + k + "-" + c[1], c[1], 120, "" + k, sz(1), new double[][] {{60.5, 60.5, k == 'b' ? 3 : 0}, {150.5, 150.5, 0}}, new String[] {});
    }
    String victims = "zxbpsk";
    for (long s : new long[] {4213, 4214, 4222, 4226}) {
      List<String> o = new ArrayList<>();
      double[][] pos = new double[victims.length() + 2][];
      pos[0] = new double[] {150.5, 150.5, 30};
      for (int v = 0; v < victims.length(); v++) { pos[1 + v] = new double[] {36.5 + v * 4, 66.5, 0}; o.add(ball(1, 0, 0, "0 0 40", 36.5 + v * 4, 1.0, v == 1 ? 64.0 : 60.5, 1)); }
      pos[victims.length() + 1] = new double[] {60.5, 76.5, 0};
      scenario("fb43-ghast-mobs-small-" + s, s, 24, "g" + victims, sz(victims.length() + 1), pos, o.toArray(new String[0]));
    }
    // An iron golem (index 0) next to a blaze (index 1; EntityIronGolem's EntityAINearestAttackableTarget takes any IMob within 16), the player third.
    // {seed, blaze dx, dz, dy, player x, player z}
    double[][] golem = {{4413, 1.5, 0, 0, 60.5, 105.5}, {4469, 1.5, 0, 0, 60.5, 66.5}, {4525, 1.5, 0, 0, 54.5, 60.5}, {4461, 1.5, 0, 3, 60.5, 105.5}, {4419, 4, 0, 0, 60.5, 105.5},
      {4516, 1.5, 0, 5, 54.5, 60.5}, {4521, 6, 0, 1, 54.5, 60.5}, {4411, 2.5, 0, 0, 60.5, 105.5}, {4426, 6, 0, 0, 60.5, 105.5}, {4486, 12, 0, 1, 60.5, 105.5}};
    for (double[] g : golem)
      scenario("fb43-golem-blaze-" + (long) g[0], (long) g[0], 40, "ib", sz(2), new double[][] {{60.5, 60.5, 0}, {60.5 + g[1], 60.5 + g[2], g[3]}, {g[4], g[5], 0}}, new String[] {});
    unified = false; tickMobs = false; drawLog = false;
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
    if (System.getenv("FB_PREFIX") == null || !System.getenv("FB_PREFIX").startsWith("fb4")) scenarios();
    scenarios41();
    scenarios42();
    scenarios43();
  }
}
