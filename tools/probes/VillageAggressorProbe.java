import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 20 villagers3. Village aggressors on the unchanged classes in the VillageLiveProbe double: EntityVillager.attackEntityFrom (yv/sv.a(ro, F)) ->
// setRevengeTarget (yv.b(sv)) -> Village.addOrRenewAgressor (vz.a(sv)); Village.tick removeDeadAndOldAgressors; EntityAIDefendVillage (vm).a()
// (vz.b(sv) findNearestVillageAggressor, then 1 in 20 vz.c(sv) findNearestTargetPlayer) for a real EntityIronGolem (wt) tied to the village.
// Entities (index): 0, 1 villagers (both in the village), 2 zombie, 3 skeleton, 4 wolf, 5 spider, 6 zombie. A script op is "tick op ...":
//   hit victim attacker amount kind   victim.attackEntityFrom(DamageSource, amount); kind mob (causeMobDamage) or arrow (causeArrowDamage with the attacker as shooter)
//   kill idx (setHealth 0)   move idx x z   setdead idx (isDead)
// Output per scenario: the hit results, the golem task result and target index every tick that changed, and each tick's aggressor list [entity index, tick].
public class VillageAggressorProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }

  static void scenario(String name, long seed, int ticks, double[][] pos, String[] script) throws Exception {
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
    vz village = (vz) c.b().get(0);
    Object[] ents = new Object[] {VillagerProbe.villager((VillageLiveProbe.W) VillageLiveProbe.world, 0, 0, 0, 1), VillagerProbe.villager((VillageLiveProbe.W) VillageLiveProbe.world, 1, 0, 0, 2),
      new yq(VillageLiveProbe.world), new yl(VillageLiveProbe.world), new wv(VillageLiveProbe.world), new yn(VillageLiveProbe.world), new yq(VillageLiveProbe.world)};
    for (int i = 0; i < ents.length; i++) {
      sa e = (sa) ents[i];
      for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f);
      MobMoveProbe.set(e, "Z", new Random(seed * 10 + i));
      at(e, pos[i][0], 0, pos[i][1]);
      VillagerProbe.World.entities.add(e);
    }
    MobMoveProbe.set(ents[0], "bp", village);
    MobMoveProbe.set(ents[1], "bp", village);
    wt golem = new wt(VillageLiveProbe.world);
    for (Object e : ents) MobMoveProbe.set(e, "D", true); // onGround, as the polish golem-reach probe does
    MobMoveProbe.set(golem, "D", true);
    VillagerProbe.World.entities.add(golem);
    MobMoveProbe.set(golem, "bp", village);
    VillageLiveProbe.LogRandom rand = new VillageLiveProbe.LogRandom(seed);
    MobMoveProbe.set(golem, "Z", rand);
    at(golem, pos[7][0], 0, pos[7][1]);
    vm task = new vm(golem);
    StringBuilder hits = new StringBuilder(), rows = new StringBuilder(), sc = new StringBuilder();
    String last = null;
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append("\"").append(s).append("\"");
    for (int t = 0; t < ticks; t++) {
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "hit": {
            sv victim = (sv) ents[Integer.parseInt(p[2])], attacker = (sv) ents[Integer.parseInt(p[3])];
            ro src = p[5].equals("arrow") ? ro.a((zc) null, attacker) : ro.a(attacker);
            boolean hit = victim.a(src, Float.parseFloat(p[4]));
            hits.append(hits.length() > 0 ? "," : "").append("[").append(t).append(",").append(hit).append(",").append(num(victim.aS())).append("]");
            break;
          }
          case "kill": ((sv) ents[Integer.parseInt(p[2])]).g(0.0f); break;
          case "setdead": ((sa) ents[Integer.parseInt(p[2])]).B(); break;
          case "move": at((sa) ents[Integer.parseInt(p[2])], Double.parseDouble(p[3]), 0, Double.parseDouble(p[4])); break;
        }
      }
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      VillageLiveProbe.LogRandom.log.clear();
      boolean on = task.a();
      sv target = (sv) field(task, "b");
      int ti = -1;
      for (int i = 0; i < ents.length; i++) if (ents[i] == target) ti = i;
      StringBuilder agg = new StringBuilder();
      for (Object o : (List) field(village, "k")) {
        int idx = -1;
        Object en = field(o, "a");
        for (int i = 0; i < ents.length; i++) if (ents[i] == en) idx = i;
        agg.append(agg.length() > 0 ? "," : "").append("[").append(idx).append(",").append(MobMoveProbe.field(o.getClass(), "b").getInt(o)).append("]");
      }
      StringBuilder draws = new StringBuilder();
      for (String d : VillageLiveProbe.LogRandom.log) draws.append(draws.length() > 0 ? "," : "").append("\"").append(d.substring(0, d.indexOf(':'))).append("\"");
      String row = "[[" + agg + "]," + on + "," + ti + ",[" + draws + "]]";
      if (!row.equals(last)) { rows.append(rows.length() > 0 ? "," : "").append("[").append(t).append(",").append(row).append("]"); last = row; }
    }
    System.out.println("{\"case\":\"aggressors\",\"name\":\"" + name + "\",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"script\":[" + sc + "],\"hits\":[" + hits + "],\"rows\":[" + rows + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
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
    // villagers at (52.5, 52.5) and (54.5, 52.5); attackers around; the golem at (51.5, 51.5)
    double[][] pos = {{52.5, 52.5}, {54.5, 52.5}, {63.5, 51.5}, {51.5, 60.0}, {51.5, 57.5}, {51.5, 66.5}, {54.5, 51.5}, {51.5, 51.5}};
    for (int seed = 0; seed < 3; seed++) {
      // a zombie, a skeleton arrow, a wolf and a villager hurt a villager: all become aggressors; the nearest to the golem is its target; the hurt window refuses a quick second hit
      scenario("every-attacker-" + seed, seed, 700, pos, new String[] {"10 hit 0 2 1.0 mob", "13 hit 0 6 1.0 mob", "40 hit 1 3 2.0 arrow", "80 hit 0 4 2.0 mob", "120 hit 1 5 1.0 mob", "160 hit 0 1 1.0 mob", "200 kill 4", "240 setdead 3", "300 kill 5"});
      // expiry: one aggressor hits once and is never renewed (300 ticks), another is renewed each 100 ticks until tick 430
      scenario("expiry-renew-" + seed, seed, 1000, pos, new String[] {"5 hit 0 2 1.0 mob", "30 hit 1 5 1.0 mob", "130 hit 1 5 1.0 mob", "230 hit 1 5 1.0 mob", "330 hit 1 5 1.0 mob", "430 hit 1 5 1.0 mob", "500 move 2 51.5 52.5"});
      // aggressors dying and moving: the nearest changes as they move; a dead one is removed on the next village tick
      scenario("move-and-die-" + seed, seed, 500, pos, new String[] {"3 hit 0 2 1.0 mob", "4 hit 1 5 1.0 mob", "50 move 5 53.5 52.5", "100 move 2 40.5 52.5", "150 move 5 80.5 52.5", "200 hit 1 4 2.0 mob", "210 kill 4", "260 kill 2"});
    }
  }
}
