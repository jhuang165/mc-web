import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 17 villager polish. Runs the unchanged EntityVillager (yv), VillageCollection (wc), Village (vz),
// EntityAIMoveIndoors (ur), EntityAINearestAttackableTarget (vo, with EntityAITarget vu / selector vp),
// EntityIronGolem (wt) and EntityZombie (yq) on the VillageLiveProbe flat-world double. One JSON object per line:
//   particles    EntityVillager.handleHealthUpdate(12/13/14): every spawnParticle call and the next Random draw
//   defaultRep   EntityVillager.updateAITick with the cd() flag: Village.changeAllReputations(5) on the village
//   moveIndoors  EntityAIMoveIndoors.shouldExecute over day, rain, biome and WorldProvider.hasNoSky
//   golemReach   the golem's nearbyOnly EntityAINearestAttackableTarget: path end, cached state and draws per tick
public class VillagerPolishProbe {
  public static class PW extends VillageLiveProbe.W {
    static int biome = 1;
    public ahu a(int x, int z) { return ahu.d(biome); }
  }

  static String q(String s) { return "\"" + s + "\""; }
  static String num(double v) { return Double.toString(v); }
  static String num(float v) { return Float.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static int fi(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).getInt(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static int draw(Object o) throws Exception { return ((Random) field(o, "Z")).nextInt(1000000); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    PW w = (PW) u.allocateInstance(PW.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    Object provider = field(w, "t");

    // particles: the entity Random drives 3 gaussians then 3 floats per particle, five particles
    {
      for (int status : new int[] {12, 13, 14}) for (int child = 0; child < 2; child++) for (long seed = 0; seed < 12; seed++) {
        VillageLiveProbe.newCollection(1);
        VillageLiveProbe.W.particles.clear();
        double x = 64.5 + seed * 0.37, y = 3.0 + seed * 0.21, z = -20.25 - seed * 0.61;
        yv v = VillagerProbe.villager(w, (int) (seed % 5), x, z, seed);
        if (child == 1) v.c(-24000);
        at(v, x, y, z);
        MobMoveProbe.set(v, "Z", new Random(seed));
        v.a((byte) status);
        System.out.println("{\"case\":\"particles\",\"status\":" + status + ",\"child\":" + (child == 1) + ",\"seed\":" + seed + ",\"pos\":[" + num(x) + "," + num(y) + "," + num(z) + "],\"size\":["
          + num(MobMoveProbe.fl(v, "M")) + "," + num(MobMoveProbe.fl(v, "N")) + "],\"particles\":" + VillagerProbe.strings(VillageLiveProbe.W.particles) + ",\"next\":" + draw(v) + "}");
      }
    }

    // default reputation: updateAITick registers the position, finds the village within 32 and, when the flag is set,
    // adds 5 to every known player's reputation once
    {
      Method bp = MobMoveProbe.method(yv.class, "bp");
      Method cd = MobMoveProbe.method(yv.class, "cd");
      Field bq = MobMoveProbe.field(yv.class, "bq"), bz = MobMoveProbe.field(yv.class, "bz");
      String[] names = {"A", "B", "C", "D"};
      int[][] starts = {{3, -20, 8, 10}, {-30, 6, 0, -14}, {}, {-12, 9, 10, 4}};
      for (int variant = 0; variant < 4; variant++) for (int flag = 0; flag < 2; flag++) for (int far = 0; far < 2; far++) for (long seed = 0; seed < 3; seed++) {
        wc c = VillageLiveProbe.built(80 + variant, 12, 5);
        vz village = (vz) c.b().get(0);
        for (int i = 0; i < starts[variant].length; i++) village.a(names[i], starts[variant][i]);
        yv v = VillageLiveProbe.vill(far == 1 ? 300.5 : 52.5, far == 1 ? 300.5 : 52.5, seed, 0);
        if (flag == 1) cd.invoke(v);
        StringBuilder steps = new StringBuilder();
        for (int round = 0; round < 3; round++) {
          bq.setInt(v, 0);
          bp.invoke(v);
          StringBuilder reps = new StringBuilder();
          for (int i = 0; i < names.length; i++) reps.append(i > 0 ? "," : "").append(village.a(names[i]));
          steps.append(round > 0 ? "," : "").append("[[").append(reps).append("],").append(bz.getBoolean(v)).append(",").append(bq.getInt(v)).append(",").append(v.b() == null).append("]");
        }
        int pre = 0;
        System.out.println("{\"case\":\"defaultRep\",\"variant\":" + variant + ",\"flag\":" + (flag == 1) + ",\"far\":" + (far == 1) + ",\"seed\":" + seed + ",\"start\":" + java.util.Arrays.toString(starts[variant])
          + ",\"steps\":[" + steps + "],\"next\":" + draw(v) + "}");
      }
    }

    // MoveIndoors: day/rain x biome x hasNoSky
    {
      int[] biomes = {1, 2, 12, 8, 6, 3};
      StringBuilder facts = new StringBuilder();
      for (int b : biomes) facts.append(facts.length() > 0 ? "," : "").append("[").append(b).append(",").append(ahu.d(b).e()).append("]");
      StringBuilder rows = new StringBuilder();
      Field noSky = null;
      for (Class<?> k = provider.getClass(); k != null && noSky == null; k = k.getSuperclass())
        try { noSky = k.getDeclaredField("g"); } catch (NoSuchFieldException e) {}
      noSky.setAccessible(true);
      for (int dark = 0; dark < 2; dark++) for (int day = 0; day < 2; day++) for (int rain = 0; rain < 2; rain++) for (int bi = 0; bi < biomes.length; bi++) for (long seed = 0; seed < 40; seed++) {
        wc c = VillageLiveProbe.built(70, 12, 5);
        PW.biome = biomes[bi];
        noSky.setBoolean(provider, dark == 1);
        VillageLiveProbe.W.day = day == 1; VillageLiveProbe.W.rain = rain == 1;
        yv a = VillageLiveProbe.vill(51.5, 52.5, seed, 0);
        ur task = new ur(a);
        MobMoveProbe.set(a, "Z", new Random(seed));
        boolean ret = task.a();
        rows.append(rows.length() > 0 ? "," : "").append("[").append(dark).append(",").append(day).append(",").append(rain).append(",").append(biomes[bi]).append(",").append(seed).append(",").append(ret).append(",").append(draw(a)).append("]");
      }
      noSky.setBoolean(provider, false);
      PW.biome = 1;
      System.out.println("{\"case\":\"moveIndoors\",\"biomeFacts\":[" + facts + "],\"rows\":[" + rows + "]}");
    }

    // golem reach: vo(golem, EntityLiving, 0, false, nearbyOnly, IMob) over scripted terrain
    {
      Constructor<?> voC = vo.class.getConstructor(td.class, Class.class, int.class, boolean.class, boolean.class, sj.class);
      Field state = MobMoveProbe.field(vu.class, "b"), counter = MobMoveProbe.field(vu.class, "e");
      // name, zombie [x,y,z], stone boxes [x0,y0,z0,x1,y1,z1]
      Object[][] scenes = {
        {"open", new double[] {70.5, 0, 64.5}, new int[][] {}},
        {"short wall", new double[] {70.5, 0, 64.5}, new int[][] {{67, 0, 60, 67, 3, 68}}},
        {"long wall", new double[] {70.5, 0, 64.5}, new int[][] {{67, 0, 30, 67, 3, 100}}},
        {"pillar", new double[] {68.5, 5, 64.5}, new int[][] {{68, 0, 64, 68, 4, 64}}},
        {"sealed box", new double[] {69.5, 0, 64.5}, new int[][] {{67, 0, 62, 71, 3, 66}}},
        {"cell", new double[] {69.5, 0, 64.5}, new int[][] {{68, 0, 63, 70, 2, 65}}},
        {"far", new double[] {78.5, 0, 66.5}, new int[][] {}},
        {"diagonal", new double[] {75.5, 0, 75.5}, new int[][] {{70, 0, 70, 80, 3, 70}, {70, 0, 70, 70, 3, 80}}},
      };
      for (Object[] sc : scenes) for (int nearby = 1; nearby >= 0; nearby--) for (long seed = 0; seed < 8; seed++) {
        VillageLiveProbe.newCollection(1);
        int[][] boxes = (int[][]) sc[2];
        for (int[] b : boxes) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++)
          if (!(sc[0].equals("sealed box") && x > 67 && x < 71 && z > 62 && z < 66 && y < 3)) VillageLiveProbe.put(x, y, z, 1, 0);
        if (sc[0].equals("sealed box")) { /* hollow: only the shell is stone, the inside is air */ }
        if (sc[0].equals("cell")) VillageLiveProbe.put(69, 0, 64, 0, 0);
        if (sc[0].equals("cell")) { VillagerProbe.World.cells.remove(VillagerProbe.key(69, 0, 64)); VillagerProbe.World.cells.remove(VillagerProbe.key(69, 1, 64)); }
        wt g = new wt(w);
        at(g, 64.5, 0, 64.5);
        MobMoveProbe.set(g, "D", true);
        double[] zp = (double[]) sc[1];
        yq z = new yq(w);
        at(z, zp[0], zp[1], zp[2]);
        MobMoveProbe.set(z, "D", true);
        VillagerProbe.World.entities.add(g);
        VillagerProbe.World.entities.add(z);
        MobMoveProbe.set(g, "Z", new Random(seed));
        ui task = (ui) voC.newInstance(g, sw.class, 0, false, nearby == 1, yb.a);
        StringBuilder ticks = new StringBuilder();
        for (int t = 0; t < 40; t++) {
          boolean ret = task.a();
          ticks.append(t > 0 ? "," : "").append("[").append(ret).append(",").append(state.getInt(task)).append(",").append(counter.getInt(task)).append("]");
        }
        ayf path = g.m().a(z);
        String end = "null";
        if (path != null && path.c() != null) end = "[" + path.c().a + "," + path.c().b + "," + path.c().c + "]";
        System.out.println("{\"case\":\"golemReach\",\"scene\":" + q((String) sc[0]) + ",\"nearbyOnly\":" + (nearby == 1) + ",\"seed\":" + seed + ",\"golem\":[64.5,0,64.5],\"zombie\":" + java.util.Arrays.toString(zp)
          + ",\"stone\":" + java.util.Arrays.deepToString(boxes) + ",\"hollow\":" + (sc[0].equals("sealed box")) + ",\"cell\":" + (sc[0].equals("cell")) + ",\"end\":" + end + ",\"ticks\":[" + ticks + "],\"next\":" + draw(g) + "}");
      }
    }
  }
}
