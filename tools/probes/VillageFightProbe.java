import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 28 village3. A village fight on the unchanged classes in the VillageLiveProbe double, every mob ticked each game tick (Entity.onUpdate, sa.h): two
// EntityVillagers (yv: their whole task list, EntityAIAvoidEntity flee, MoveIndoors, village refresh), zombies (yq: AttackOnCollide on villagers, the
// player target, HurtByTarget), skeletons (yl, ticked but never given a target: they stand far from the player; their arrows would be new entities the
// double never ticks) and a real EntityIronGolem (wt: AttackOnCollide, DefendVillage, HurtByTarget, nearest monster). The player is a real EntityPlayer (P,
// 1000 health, yOffset 0 as EntityPlayerMP, never ticked) that a script moves and whose hits are scripted. The world updates the collection (wc.a()),
// then the entities in list order. Entities (index): 0, 1 villagers; 2, 3 zombies; 4 golem; 5, 6 skeletons; 7 player.
// A script op is "tick op ...":
//   hit victim attacker amount kind   victim.attackEntityFrom(DamageSource, amount): kind mob (causeMobDamage), arrow (causeArrowDamage, attacker as shooter), player (causePlayerDamage)
//   walk idx dx dz                    from this tick on the entity's position moves by (dx, dz) before each tick (0 0 stops)
//   move idx x z                      teleport
//   rename name                       the player's name (reputation key); default "probe"
// Output per record: each tick's rows [per ticked entity: x, y, z, health, attack target index, revenge target index, its Random draws], the village aggressor list
// [entity index, tick], the reputation of every name, and the hit results.
public class VillageFightProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  public static class Log extends Random {
    List<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add("i" + bound); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add("f"); return r; }
    public double nextGaussian() { double r = super.nextGaussian(); log.add("g"); return r; }
  }
  public static class P extends yz {
    String n;
    P(ahb world, String n) { super(world, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes(n.getBytes()), n)); this.n = n; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
    public String b_() { return n; }
  }
  static String draws(List<String> log) {
    StringBuilder s = new StringBuilder();
    for (String d : log) s.append(s.length() > 0 ? "," : "").append("\"").append(d).append("\"");
    return s.toString();
  }

  static void scenario(String name, long seed, int ticks, double[][] pos, String[] script) throws Exception {
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = false;
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
    ahb w = VillageLiveProbe.world;
    P player = new P(w, "probe");
    Object[] ents = new Object[] {VillagerProbe.villager((VillageLiveProbe.W) w, 0, 0, 0, 1), VillagerProbe.villager((VillageLiveProbe.W) w, 1, 0, 0, 2),
      new yq(w), new yq(w), new wt(w), new yl(w), new yl(w), player};
    Log[] logs = new Log[ents.length];
    for (int i = 0; i < ents.length; i++) {
      sa e = (sa) ents[i];
      for (String n : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, n, 0f);
      logs[i] = new Log(seed * 10 + i);
      MobMoveProbe.set(e, "Z", logs[i]);
      at(e, pos[i][0], 0, pos[i][1]);
      MobMoveProbe.set(e, "D", true);
      VillagerProbe.World.entities.add(e);
    }
    player.a(yj.a).a(1000.0);
    player.g(1000.0f);
    MobMoveProbe.set(player, "L", 0f);
    at(player, pos[7][0], 0, pos[7][1]); // yOffset 0 as EntityPlayerMP: rebuild the box that the loop above made with EntityPlayer's 1.62 (batch 29: the stale box made a zombie's AttackOnCollide see a target that had moved)
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(java.util.Arrays.asList(player));
    double[][] vel = new double[ents.length][2];
    List<String> rows = new ArrayList<>(), hits = new ArrayList<>();
    for (int t = 0; t < ticks; t++) {
      for (String op : script) {
        String[] p = op.split(" ");
        if (Integer.parseInt(p[0]) != t) continue;
        switch (p[1]) {
          case "hit": {
            sv victim = (sv) ents[Integer.parseInt(p[2])];
            sa attacker = (sa) ents[Integer.parseInt(p[3])];
            ro src = p[5].equals("arrow") ? ro.a((zc) null, attacker) : p[5].equals("player") ? ro.a((yz) attacker) : ro.a((sv) attacker);
            boolean hit = victim.a(src, Float.parseFloat(p[4]));
            hits.add("[" + t + "," + hit + "," + num(victim.aS()) + "]");
            break;
          }
          case "walk": vel[Integer.parseInt(p[2])] = new double[] {Double.parseDouble(p[3]), Double.parseDouble(p[4])}; break;
          case "move": at((sa) ents[Integer.parseInt(p[2])], Double.parseDouble(p[3]), 0, Double.parseDouble(p[4])); break;
          case "rename": VillageLiveProbe.W.players.remove(player.n); player.n = p[2]; VillageLiveProbe.W.players.put(p[2], player); break;
        }
      }
      for (int i = 0; i < ents.length; i++) if (vel[i][0] != 0 || vel[i][1] != 0) { sa e = (sa) ents[i]; at(e, e.s + vel[i][0], e.t, e.u + vel[i][1]); }
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      for (Log l : logs) l.log.clear();
      for (int i = 0; i < ents.length - 1; i++) { sa e = (sa) ents[i]; if (e.K) continue; VillagerProbe.World.entities.size(); e.aa++; e.h(); } // World.updateEntityWithOptionalForce does ++ticksExisted before onUpdate
      vz village = (vz) c.b().get(0);
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < ents.length; i++) {
        sa e = (sa) ents[i];
        if (i > 0) row.append(",");
        row.append("[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append(",").append(num(((sv) e).aS()));
        if (i < ents.length - 1) {
          sv tg = ((sw) e).o(), rv = (sv) MobMoveProbe.field(sv.class, "i").get(e);
          int ti = -1, ri = -1;
          for (int k = 0; k < ents.length; k++) { if (ents[k] == tg) ti = k; if (ents[k] == rv) ri = k; }
          row.append(",").append(ti).append(",").append(ri).append(",[").append(draws(logs[i].log)).append("]");
        }
        row.append("]");
      }
      row.append("],[");
      boolean first = true;
      for (Object o : (List) field(village, "k")) {
        int idx = -1;
        Object en = field(o, "a");
        for (int i = 0; i < ents.length; i++) if (ents[i] == en) idx = i;
        row.append(first ? "" : ",").append("[").append(idx).append(",").append(MobMoveProbe.field(o.getClass(), "b").getInt(o)).append("]");
        first = false;
      }
      row.append("],").append(village.a(player.n)).append("]");
      rows.add(row.toString());
    }
    StringBuilder sc = new StringBuilder(), rs = new StringBuilder(), hs = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    for (String r : rows) rs.append(rs.length() > 0 ? "," : "").append(r);
    for (String h : hits) hs.append(hs.length() > 0 ? "," : "").append(h);
    System.out.println("{\"case\":\"fight\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"ticks\":" + ticks + ",\"pos\":" + java.util.Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"hits\":[" + hs + "],\"rows\":[" + rs + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
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
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); } // the Scoreboard EntityPlayer.onKillEntity reads
    // villagers (52.5, 52.5) and (54.5, 52.5); zombies east; the golem west of the door; skeletons far north and south; the player south-east
    double[][] open = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {70.5, 56.5}, {46.5, 51.5}, {52.5, 80.5}, {60.5, 25.5}, {62.5, 58.5}};
    for (int seed = 0; seed < 2; seed++) {
      // the moving player walks to the zombie and hits it twice; the villager flees; later hits the villager (-1) and the golem
      scenario("player-fights-zombie-" + seed, seed, 260, open, new String[] {"0 walk 7 -0.1 -0.05", "45 hit 2 7 5.0 player", "70 hit 2 7 5.0 player", "95 walk 7 0 0", "100 hit 0 7 1.0 player", "130 hit 4 7 1.0 player", "170 walk 7 0.1 0.1"});
      // two zombies and two shooters at once: arrows on both villagers, the golem picks between the aggressors as they move and expire
      scenario("zombies-and-shooters-" + seed, seed, 430, open, new String[] {"20 hit 0 5 2.0 arrow", "26 hit 1 6 2.0 arrow", "60 hit 0 6 2.0 arrow", "90 move 5 52.5 70.5", "120 hit 1 5 2.0 arrow", "200 move 6 58.5 40.5", "260 hit 0 2 1.0 mob"});
    }
    // 15 small player hits on a villager reach reputation -15: the golem then targets the player; killing the golem costs another 5; a second name takes over the reputation key
    scenario("player-turns-aggressive", 0, 700, open, new String[] {"10 hit 0 7 0.1 player", "31 hit 0 7 0.1 player", "52 hit 0 7 0.1 player", "73 hit 0 7 0.1 player", "94 hit 0 7 0.1 player", "115 hit 0 7 0.1 player", "136 hit 0 7 0.1 player", "157 hit 0 7 0.1 player",
      "178 hit 0 7 0.1 player", "199 hit 0 7 0.1 player", "220 hit 0 7 0.1 player", "241 hit 0 7 0.1 player", "262 hit 0 7 0.1 player", "283 hit 0 7 0.1 player", "304 hit 0 7 0.1 player", "330 move 7 50.5 56.5", "500 hit 4 7 300.0 player", "600 rename alt", "610 hit 1 7 0.1 player"});
  }
}
