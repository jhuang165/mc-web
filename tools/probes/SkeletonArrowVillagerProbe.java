import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 22 villagers4. A live skeleton arrow on a villager, from the unchanged classes in the VillageLiveProbe double: EntitySkeleton.attackEntityWithRangedAttack
// (yl.a(sv, F): the arrow, its damage from the skeleton's own Random, Power/Punch/Flame of the held bow, the random.bow sound), then EntityArrow.onUpdate (zc.h)
// every tick against the villager (the world answers getEntitiesWithinAABBExcludingEntity with the live entity list): ray trace, damage ceil(speed * damage),
// Punch addVelocity, EntityLivingBase.attackEntityFrom with causeArrowDamage(arrow, skeleton) (knockBack from the skeleton, setRevengeTarget -> Village.addOrRenewAgressor),
// the "random.bowhit" sound. A real EntityIronGolem tied to the village evaluates EntityAIDefendVillage every tick after the hit. A villager that dies shows the
// CombatTracker message (func_151521_b, death.attack.arrow with the skeleton's name; natively nothing broadcasts it for a villager, but the tracker is the one
// EntityPlayerMP.onDeath prints). The arrow's own heading Random is not seedable (zc(world, shooter, target, v, i) calls c() on a fresh Random), so the record
// stores the initial arrow state and the replay starts the port's arrow from it; the arrow's later Random (the bowhit pitch) is replaced by a seeded one after spawn.
public class SkeletonArrowVillagerProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  public static class AW extends VillageLiveProbe.W {
    public java.util.List b(sa self, azt box) {
      List out = new ArrayList();
      for (sa o : VillagerProbe.World.entities) if (o != self && o.C.b(box)) out.add(o);
      return out;
    }
  }
  // EntityVillager.onDeath double: the CombatTracker message as it stands when onDeath starts (EntityLivingBase.onDeath resets the tracker afterwards).
  public static class V extends yv {
    static String deathMessage = "null";
    V(ahb w) { super(w, 0); }
    public String b_() { return "Villager"; } // the subclass is not in the EntityList, whose registered name is entity.Villager.name
    public void a(ro source) { try { deathMessage = PlayerDamageProbe.chat(aW().b()); } catch (Exception e) { throw new RuntimeException(e); } super.a(source); }
  }
  public static class Log extends Random {
    List<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add("i" + bound); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add("f"); return r; }
    public double nextGaussian() { double r = super.nextGaussian(); log.add("g"); return r; }
  }
  static String draws(List<String> log) {
    StringBuilder s = new StringBuilder();
    for (String d : log) s.append(s.length() > 0 ? "," : "").append("\"").append(d).append("\"");
    return s.toString();
  }

  // difficulty, bow (0 none, 1 plain bow, 2 Power 3 + Punch 2 + Flame, 3 Punch 1), scale, distance, villager health, skeleton name (null or a custom one), seed, golem distance
  static void scenario(int difficulty, int bow, float scale, double dist, float hp, String name, long seed, boolean golem) throws Exception {
    VillageLiveProbe.W w = (VillageLiveProbe.W) VillageLiveProbe.world;
    MobMoveProbe.set(w, "r", rd.values()[difficulty]);
    wc c = VillageLiveProbe.newCollection(seed);
    VillagerProbe.World.spawned.clear(); VillagerProbe.World.sounds.clear();
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
    vz village = (vz) c.b().get(0);
    V.deathMessage = "null";
    V villager = new V(w);
    MobMoveProbe.set(villager, "Z", new Random(seed + 1));
    yl skel = new yl(w);
    for (sa e : new sa[] {villager, skel}) { for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f); MobMoveProbe.set(e, "D", true); }
    Log sr = new Log(seed);
    MobMoveProbe.set(skel, "Z", sr);
    at(skel, 52.5, 0, 52.5 + dist);
    at(villager, 52.5, 0, 52.5);
    MobMoveProbe.set(villager, "bp", village);
    if (name != null) skel.a(name);
    if (bow == 1) skel.c(0, ArmorEnchantmentProbe.make(261, 0, ArmorEnchantmentProbe.ench(34, 0)));
    if (bow == 2) skel.c(0, ArmorEnchantmentProbe.make(261, 0, ArmorEnchantmentProbe.ench(48, 3, 49, 2, 50, 1)));
    if (bow == 3) skel.c(0, ArmorEnchantmentProbe.make(261, 0, ArmorEnchantmentProbe.ench(49, 1)));
    villager.g(hp);
    VillagerProbe.World.entities.clear();
    VillagerProbe.World.entities.add(villager);
    VillagerProbe.World.entities.add(skel);
    wt gol = new wt(w);
    MobMoveProbe.set(gol, "D", true);
    MobMoveProbe.set(gol, "bp", village);
    MobMoveProbe.set(gol, "Z", new VillageLiveProbe.LogRandom(seed));
    at(gol, 46.5, 0, 51.5);
    VillagerProbe.World.entities.add(gol);
    vm task = new vm(gol);
    // the shot
    skel.a((sv) villager, scale);
    zc arrow = (zc) VillagerProbe.World.spawned.get(0);
    MobMoveProbe.set(arrow, "Z", new Random(seed + 7));
    String shot = "{\"arrow\":[" + num(arrow.s) + "," + num(arrow.t) + "," + num(arrow.u) + "," + num(arrow.v) + "," + num(arrow.w) + "," + num(arrow.x) + "," + num(arrow.y) + "," + num(arrow.z) + "]"
      + ",\"damage\":" + num(arrow.e()) + ",\"knockback\":" + MobMoveProbe.field(zc.class, "aw").getInt(arrow) + ",\"fire\":" + MobMoveProbe.field(sa.class, "e").getInt(arrow)
      + ",\"pickup\":" + arrow.a + ",\"skeletonDraws\":[" + draws(sr.log) + "],\"sounds\":[" + sounds() + "]}";
    sr.log.clear();
    VillagerProbe.World.sounds.clear();
    StringBuilder ticks = new StringBuilder(), golemRows = new StringBuilder();
    String last = null;
    int hitTick = -1;
    String hit = "null";
    for (int t = 0; t < 40; t++) {
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      float before = villager.aS();
      arrow.h();
      if (hitTick < 0 && (arrow.K || villager.aS() != before)) {
        hitTick = t;
        StringBuilder ev = new StringBuilder();
        for (String e : VillageLiveProbe.W.events) ev.append(ev.length() > 0 ? "," : "").append(q(e));
        hit = "{\"tick\":" + t + ",\"health\":" + num(villager.aS()) + ",\"dead\":" + arrow.K + ",\"motion\":[" + num(villager.v) + "," + num(villager.w) + "," + num(villager.x) + "]"
          + ",\"hurtTime\":" + MobMoveProbe.field(sv.class, "au").getInt(villager) + ",\"resistant\":" + MobMoveProbe.field(sa.class, "ad").getInt(villager) + ",\"sounds\":[" + sounds() + "],\"events\":[" + ev + "]"
          + ",\"aggressors\":" + ((List) field(village, "k")).size() + ",\"fire\":" + MobMoveProbe.field(sa.class, "e").getInt(villager) + ",\"message\":" + PlayerDamageProbe.chat(villager.aW().b()) + ",\"deathMessage\":" + V.deathMessage
          + "}";
      }
      ticks.append(t > 0 ? "," : "").append("[").append(num(arrow.s)).append(",").append(num(arrow.t)).append(",").append(num(arrow.u)).append(",").append(num(arrow.v)).append(",").append(num(arrow.w)).append(",").append(num(arrow.x)).append(",").append(arrow.K).append("]");
      if (hitTick >= 0) {
        VillageLiveProbe.LogRandom.log.clear();
        boolean on = task.a();
        sv target = (sv) field(task, "b");
        int ti = target == skel ? 3 : target == villager ? 0 : -1;
        StringBuilder agg = new StringBuilder();
        for (Object o : (List) field(village, "k")) agg.append(agg.length() > 0 ? "," : "").append("[").append(field(o, "a") == skel ? 3 : -1).append(",").append(MobMoveProbe.field(o.getClass(), "b").getInt(o)).append("]");
        StringBuilder dr = new StringBuilder();
        for (String d : VillageLiveProbe.LogRandom.log) dr.append(dr.length() > 0 ? "," : "").append("\"").append(d.substring(0, d.indexOf(':'))).append("\"");
        String row = "[[" + agg + "]," + on + "," + ti + ",[" + dr + "]]";
        if (!row.equals(last)) { golemRows.append(golemRows.length() > 0 ? "," : "").append("[").append(t).append(",").append(row).append("]"); last = row; }
      }
      if (hitTick >= 0 && t >= hitTick + 3) break;
    }
    System.out.println("{\"case\":\"skeletonArrow\",\"difficulty\":" + difficulty + ",\"bow\":" + bow + ",\"scale\":" + num(scale) + ",\"distance\":" + num(dist) + ",\"hp\":" + num(hp)
      + ",\"name\":" + (name == null ? "null" : q(name)) + ",\"seed\":" + seed + ",\"shot\":" + shot + ",\"hitTick\":" + hitTick + ",\"ticks\":[" + ticks + "],\"hit\":" + hit + ",\"golem\":[" + golemRows + "]}");
  }
  static String sounds() {
    StringBuilder s = new StringBuilder();
    for (String x : VillagerProbe.World.sounds) s.append(s.length() > 0 ? "," : "").append(q(x));
    return s.toString();
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    ArmorEnchantmentProbe.U = MobMoveProbe.unsafe();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    AW w = (AW) u.allocateInstance(AW.class);
    VillageLiveProbe.world = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    Object info = u.allocateInstance(ays.class);
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    int n = 0;
    for (int difficulty = 1; difficulty <= 3; difficulty++) for (int bow = 0; bow <= 3; bow++) for (long seed = 0; seed < 4; seed++) {
      scenario(difficulty, bow, seed % 2 == 0 ? 1.0f : 0.6f, seed < 2 ? 8 : 11, 20f, null, seed + 10 * bow, true); n++;
    }
    // a lethal hit with the skeleton's own and a custom name, and a hit on a villager at 1 health
    scenario(2, 0, 1.0f, 8, 1f, null, 21, true); scenario(2, 1, 1.0f, 8, 2f, "Bob", 22, true); scenario(3, 2, 1.0f, 6, 3f, null, 23, true);
    scenario(1, 0, 1.0f, 10, 5f, "Steve", 24, true);
    System.err.println("scenarios " + (n + 4));
  }
}
