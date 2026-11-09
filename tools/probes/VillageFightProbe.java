import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Random;

// Batch 28 village3. A village fight on the unchanged classes in the VillageLiveProbe double, every mob ticked each game tick (Entity.onUpdate, sa.h): two
// EntityVillagers (yv: their whole task list, EntityAIAvoidEntity flee, MoveIndoors, village refresh), zombies (yq: AttackOnCollide on villagers, the
// player target, HurtByTarget), skeletons (yl, ticked but never given a target: they stand far from the player; their arrows would be new entities the
// double never ticks) and a real EntityIronGolem (wt: AttackOnCollide, DefendVillage, HurtByTarget, nearest monster). The player is a real EntityPlayer (P,
// 1000 health, yOffset 0 as EntityPlayerMP, never ticked) that a script moves and whose hits are scripted. The world updates the collection (wc.a()),
// then the entities in list order. Entities (index): 0, 1 villagers; 2, 3 zombies; 4 golem; 5, 6 skeletons; 7 player.
// (Batch 31: the player index is the mob count, 7 in the original records.) A script op is "tick op ...":
//   hit victim attacker amount kind   victim.attackEntityFrom(DamageSource, amount): kind mob (causeMobDamage), arrow (causeArrowDamage, attacker as shooter), player (causePlayerDamage)
//   walk idx dx dz                    from this tick on the entity's position moves by (dx, dz) before each tick (0 0 stops)
//   move idx x z                      teleport
//   rename name                       the player's name (reputation key); default "probe"
// Output per record: each tick's rows [per ticked entity: x, y, z, health, attack target index, revenge target index, its Random draws], the village aggressor list
// [entity index, tick], the reputation of every name, and the hit results.
// (Batch 32: names b32-*. Entity.rand is a SeedRandom (see SeedRandom.java), so an arrow's heading draws and the onSpawnWithEgg draws of a converted
// or reinforcement zombie are reproducible: each record lists them with their seed, and the zombies are ticked like any mob. The record fields
// `blocks` ([x0,y0,z0,x1,y1,z1,id,meta] fills), `water` (real water physics), `light` (World.getBlockLightValue) and `reinforce` (the zombies'
// spawnReinforcements base) describe the arena.)
public class VillageFightProbe {
  static String num(double v) { return Double.toString(v); }
  static Object field(Object o, String n) throws Exception { return MobMoveProbe.field(o.getClass(), n).get(o); }
  static void at(sa e, double x, double y, double z) throws Exception { MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(e, x, y, z); }
  // EntityLivingBase.onUpdate sends an equipment packet through (WorldServer) when a slot differs from its previous one; the double has no WorldServer, so previousEquipment follows each swap.
  static void held(yl e, add stack) throws Exception { e.c(0, stack); ((add[]) MobMoveProbe.field(sv.class, "g").get(e))[0] = e.ak()[0]; }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  public static class Log extends Random {
    List<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add("i" + bound); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add("f"); return r; }
    public double nextGaussian() { double r = super.nextGaussian(); log.add("g"); return r; }
    public boolean nextBoolean() { boolean r = super.nextBoolean(); log.add("b"); return r; } // batch 31: the zombie's onKillEntity roll on Normal
  }
  public static class P extends yz {
    String n;
    P(ahb world, String n) { super(world, new com.mojang.authlib.GameProfile(java.util.UUID.nameUUIDFromBytes(n.getBytes()), n)); this.n = n; }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return null; }
    public String b_() { return n; }
  }
  // Index of an entity in the record: the mobs, the player (types.length), then the zombies spawned during the fight in spawn order.
  static int index(Object[] ents, List<yq> extra, Object e) {
    for (int k = 0; k < ents.length; k++) if (ents[k] == e) return k;
    for (int k = 0; k < extra.size(); k++) if (extra.get(k) == e) return ents.length + k;
    return -1;
  }
  static String draws(List<String> log) {
    StringBuilder s = new StringBuilder();
    for (String d : log) s.append(s.length() > 0 ? "," : "").append("\"").append(d).append("\"");
    return s.toString();
  }

  static void base(yq z) throws Exception { if (reinforce > 0) ((ti) z.a((th) MobMoveProbe.field(yq.class, "bp").get(null))).a(reinforce); }
  static int[][] blocks = {}; static boolean water = false; static int light = 15; static double reinforce = 0; // batch 32 arena (reset after each scenario)
  static int difficulty = 2; // batch 30: rd ordinal (0 Peaceful .. 3 Hard) the next scenarios run on
  static final String DEFAULT_TYPES = "VVZZGKK";
  static void scenario(String name, long seed, int ticks, double[][] pos, String[] script) throws Exception { scenario(name, seed, ticks, DEFAULT_TYPES, pos, script); }
  // Batch 31: `types` is one letter per mob (V villager, Z zombie, z zombie with CanBreakDoors, G iron golem, K skeleton with an empty hand,
  // B skeleton holding a bow); the player follows the last mob. A record with a bow skeleton, a villager that may convert or an equip op also
  // carries the spawned arrows (`shots`: their initial state, which natively comes from an unseedable Random) and per tick the arrows' rows.
  static void scenario(String name, long seed, int ticks, String types, double[][] pos, String[] script) throws Exception {
    int n = types.length();
    if (System.getenv("VF_ONLY") != null && !name.equals(System.getenv("VF_ONLY"))) return; // development aid: run one record
    MobMoveProbe.set(VillageLiveProbe.world, "r", rd.values()[difficulty]);
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = false;
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int[] b : blocks) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++) VillageLiveProbe.put(x, y, z, b[6], b[7]);
    VillagerProbe.World.light = light; MobMoveProbe.ProbeWorld.water = water;
    for (int t = 0; t < 5; t++) { if (t % 60 == 0) c.a(52, 0, 52); c.a(); }
    ahb w = VillageLiveProbe.world;
    P player = new P(w, "probe");
    Object[] ents = new Object[n + 1];
    for (int i = 0; i < n; i++) {
      switch (types.charAt(i)) {
        case 'V': ents[i] = VillagerProbe.villager((VillageLiveProbe.W) w, i % 5, 0, 0, i + 1); break;
        case 'Z': { yq z = new yq(w); base(z); ents[i] = z; break; }
        case 'z': { yq z = new yq(w); dh tag = new dh(); tag.a("CanBreakDoors", true); z.a(tag); base(z); ents[i] = z; break; }
        case 'G': ents[i] = new wt(w); break;
        case 'K': ents[i] = new yl(w); break;
        case 'B': { yl k = new yl(w); held(k, ArmorEnchantmentProbe.make(261, 0, ArmorEnchantmentProbe.ench())); ents[i] = k; break; }
        default: throw new RuntimeException(types);
      }
    }
    ents[n] = player;
    // EntityZombie.applyEntityAttributes draws the spawnReinforcements base (nextDouble * 0.1) from the constructor's Entity.rand: with Entity seeded it is part of the record.
    StringBuilder bases = new StringBuilder("[");
    for (int i = 0; i < n; i++) bases.append(i > 0 ? "," : "").append(ents[i] instanceof yq ? num(((ti) ((yq) ents[i]).a((th) MobMoveProbe.field(yq.class, "bp").get(null))).e()) : "null");
    bases.append("]");
    boolean extras = name.startsWith("b31-") || name.startsWith("b32-"); // rows then end with the arrows, and the record lists the shots and conversions
    VillagerProbe.World.spawned.clear();
    SeedRandom.next = 1000000L + seed * 1000; // the first Entity built from here on (an arrow, a converted or reinforcement zombie) gets this seed
    List<yq> extraZombies = new ArrayList<>(); List<String> zombieRecs = new ArrayList<>();
    Log[] logs = new Log[ents.length];
    for (int i = 0; i < ents.length; i++) {
      sa e = (sa) ents[i];
      for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, fn, 0f);
      logs[i] = new Log(seed * 10 + i);
      MobMoveProbe.set(e, "Z", logs[i]);
      at(e, pos[i][0], 0, pos[i][1]);
      MobMoveProbe.set(e, "D", true);
      VillagerProbe.World.entities.add(e);
    }
    player.a(yj.a).a(1000.0);
    player.g(1000.0f);
    MobMoveProbe.set(player, "L", 0f);
    at(player, pos[n][0], 0, pos[n][1]); // yOffset 0 as EntityPlayerMP: rebuild the box that the loop above made with EntityPlayer's 1.62 (batch 29: the stale box made a zombie's AttackOnCollide see a target that had moved)
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(java.util.Arrays.asList(player));
    double[][] vel = new double[ents.length][2];
    List<String> rows = new ArrayList<>(), hits = new ArrayList<>(), shots = new ArrayList<>(), conversions = new ArrayList<>();
    java.util.Map<sa, Integer> arrowId = new java.util.HashMap<>(); java.util.Map<sa, String> lastArrow = new java.util.HashMap<>(); List<sa> arrowList = new ArrayList<>(); List<sa> removed = new ArrayList<>();
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
          case "equip": held((yl) ents[Integer.parseInt(p[2])], p[3].equals("0") ? null : ArmorEnchantmentProbe.make(Integer.parseInt(p[3]), 0, ArmorEnchantmentProbe.ench())); break; // setCurrentItemOrArmor(0): setCombatTask runs at once
          case "walk": vel[Integer.parseInt(p[2])] = new double[] {Double.parseDouble(p[3]), Double.parseDouble(p[4])}; break;
          case "move": at((sa) ents[Integer.parseInt(p[2])], Double.parseDouble(p[3]), 0, Double.parseDouble(p[4])); break;
          case "rename": VillageLiveProbe.W.players.remove(player.n); player.n = p[2]; VillageLiveProbe.W.players.put(p[2], player); break;
        }
      }
      for (int i = 0; i < ents.length; i++) if (vel[i][0] != 0 || vel[i][1] != 0) { sa e = (sa) ents[i]; at(e, e.s + vel[i][0], e.t, e.u + vel[i][1]); }
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      for (Log l : logs) l.log.clear();
      for (yq z : extraZombies) ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(z)).log.clear();
      // World.updateEntities walks loadedEntityList by index, so an arrow spawned by a skeleton joins the end and ticks in the same pass; a dead entity
      // (setDead) leaves the list right after its own update (extras records only: the batch 28-30 records kept corpses in the list).
      List<String> tickArrows = new ArrayList<>();
      List<sa> ticking = new ArrayList<>();
      for (int i = 0; i < n; i++) ticking.add((sa) ents[i]);
      ticking.addAll(arrowList); // arrows already in flight (or stuck) tick after every mob, in spawn order
      for (int i = 0; i < ticking.size(); i++) {
        sa e = ticking.get(i);
        if (!e.K || !extras) {
          if (e.K) continue;
          VillagerProbe.World.entities.size();
          e.aa++;
          e.h(); // World.updateEntityWithOptionalForce does ++ticksExisted before onUpdate
        }
        for (String op : script) { // batch 31: "t equipmid k idx item" swaps the held item right after entity k's update (EntityLiving.onLivingUpdate's pickup runs there natively)
          String[] p = op.split(" ");
          if (Integer.parseInt(p[0]) == t && p[1].equals("equipmid") && Integer.parseInt(p[2]) == i) held((yl) ents[Integer.parseInt(p[3])], p[4].equals("0") ? null : ArmorEnchantmentProbe.make(Integer.parseInt(p[4]), 0, ArmorEnchantmentProbe.ench()));
        }
        while (!VillagerProbe.World.spawned.isEmpty()) {
          Object sp = VillagerProbe.World.spawned.remove(0);
          if (sp instanceof zc) {
            zc arrow = (zc) sp;
            int shooter = -1;
            for (int k = 0; k < n; k++) if (ents[k] == arrow.c) shooter = k;
            shots.add("[" + t + "," + shooter + "," + num(arrow.s) + "," + num(arrow.t) + "," + num(arrow.u) + "," + num(arrow.v) + "," + num(arrow.w) + "," + num(arrow.x) + "," + num(arrow.y) + "," + num(arrow.z)
              + "," + num(arrow.e()) + "," + MobMoveProbe.field(zc.class, "aw").getInt(arrow) + "," + MobMoveProbe.field(sa.class, "e").getInt(arrow) + "," + ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(arrow)).seed + "]");
            arrowId.put(arrow, shots.size() - 1);
            arrowList.add(arrow);
            ticking.add(arrow);
            VillagerProbe.World.entities.add(arrow);
          } else if (sp instanceof yq) {
            // Batch 32: a zombie spawned mid-pass (EntityZombie.onKillEntity's converted villager, or a Hard reinforcement) joins the world list and ticks in this
            // pass like any entity. A conversion stands exactly where a dead villager did; a reinforcement is built by attackEntityFrom on an integer corner.
            yq z = (yq) sp;
            boolean conv = false;
            for (int k = 0; k < n; k++) if (ents[k] instanceof yv && ((sv) ents[k]).aS() <= 0 && ((sa) ents[k]).s == z.s && ((sa) ents[k]).u == z.u) conv = true;
            if (conv) conversions.add("[" + t + "," + num(z.s) + "," + num(z.t) + "," + num(z.u) + "]");
            for (String fn : new String[] {"aO", "aM", "aN", "aP"}) MobMoveProbe.set(z, fn, 0f);
            zombieRecs.add("[" + t + "," + (conv ? 1 : 0) + "," + num(z.s) + "," + num(z.t) + "," + num(z.u) + "," + ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(z)).seed + "," + (z.bZ() ? 1 : 0) + "]");
            extraZombies.add(z);
            arrowList.add(z);
            ticking.add(z);
            VillagerProbe.World.entities.add(z);
          }
        }
        if (e instanceof zc) { // only an arrow whose state changed since the last row lists (a stuck arrow ticks on, unchanged)
          String as = "[" + arrowId.get(e) + "," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + (e.K ? 1 : 0) + "]";
          if (!as.equals(lastArrow.put(e, as))) tickArrows.add(as);
        }
        if (e.K && extras) { VillagerProbe.World.entities.remove(e); arrowList.remove(e); if (!(e instanceof zc)) removed.add(e); ticking.remove(i--); }
      }
      if (System.getenv("VF_DOOR") != null) { int[] dc = VillagerProbe.World.cell(50, 0, 50); System.err.println("door " + t + " " + (dc == null ? -1 : dc[0] + ":" + dc[1])); } // development aid
      vz village = (vz) c.b().get(0);
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < ents.length; i++) {
        sa e = (sa) ents[i];
        if (i > 0) row.append(",");
        row.append("[").append(num(e.s)).append(",").append(num(e.t)).append(",").append(num(e.u)).append(",").append(num(((sv) e).aS()));
        if (i < ents.length - 1) {
          sv tg = ((sw) e).o(), rv = (sv) MobMoveProbe.field(sv.class, "i").get(e);
          row.append(",").append(index(ents, extraZombies, tg)).append(",").append(index(ents, extraZombies, rv)).append(",[").append(draws(logs[i].log)).append("]");
        }
        row.append("]");
      }
      row.append("],[");
      boolean first = true;
      for (Object o : (List) field(village, "k")) {
        int idx = index(ents, extraZombies, field(o, "a"));
        row.append(first ? "" : ",").append("[").append(idx).append(",").append(MobMoveProbe.field(o.getClass(), "b").getInt(o)).append("]");
        first = false;
      }
      row.append("],").append(village.a(player.n));
      if (extras) {
        row.append(",[").append(String.join(",", tickArrows)).append("],[");
        for (int k = 0; k < extraZombies.size(); k++) {
          yq z = extraZombies.get(k);
          row.append(k > 0 ? "," : "").append("[").append(num(z.s)).append(",").append(num(z.t)).append(",").append(num(z.u)).append(",").append(num(z.aS())).append(",")
            .append(index(ents, extraZombies, z.o())).append(",").append(index(ents, extraZombies, (sv) MobMoveProbe.field(sv.class, "i").get(z))).append(",[").append(draws(((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(z)).log)).append("]]");
        }
        row.append("]");
      }
      row.append("]");
      rows.add(row.toString());
    }
    StringBuilder sc = new StringBuilder(), rs = new StringBuilder(), hs = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    for (String r : rows) rs.append(rs.length() > 0 ? "," : "").append(r);
    for (String h : hits) hs.append(hs.length() > 0 ? "," : "").append(h);
    System.out.println("{\"case\":\"fight\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"difficulty\":" + difficulty + ",\"ticks\":" + ticks + (extras ? ",\"types\":" + q(types) + ",\"shots\":[" + String.join(",", shots) + "],\"conversions\":[" + String.join(",", conversions) + "],\"zombies\":[" + String.join(",", zombieRecs) + "]" + ",\"bases\":" + bases + (blocks.length > 0 ? ",\"blocks\":" + java.util.Arrays.deepToString(blocks) : "") + (water ? ",\"water\":true" : "") + (light != 15 ? ",\"light\":" + light : "") + (reinforce > 0 ? ",\"reinforce\":" + reinforce : "") : "") + ",\"pos\":" + java.util.Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"hits\":[" + hs + "],\"rows\":[" + rs + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    VillagerProbe.World.realRays = true; // batch 30: real EntitySenses sight rays (the village3 double returned null: a villager saw a zombie through a closed door)
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
    for (Field f : ahb.class.getDeclaredFields()) if (f.getType() == bac.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new bac()); } // the Scoreboard EntityPlayer.onKillEntity reads
    // villagers (52.5, 52.5) and (54.5, 52.5); zombies east; the golem west of the door; skeletons far north and south; the player south-east
    double[][] open = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {70.5, 56.5}, {46.5, 51.5}, {52.5, 80.5}, {60.5, 25.5}, {62.5, 58.5}};
    for (int seed = 0; seed < 2; seed++) {
      // the moving player walks to the zombie and hits it twice; the villager flees; later hits the villager (-1) and the golem
      scenario("player-fights-zombie-" + seed, seed, 260, open, new String[] {"0 walk 7 -0.1 -0.05", "45 hit 2 7 5.0 player", "70 hit 2 7 5.0 player", "95 walk 7 0 0", "100 hit 0 7 1.0 player", "130 hit 4 7 1.0 player", "170 walk 7 0.1 0.1"});
      // two zombies and two shooters at once: arrows on both villagers, the golem picks between the aggressors as they move and expire
      scenario("zombies-and-shooters-" + seed, seed, 430, open, new String[] {"20 hit 0 5 2.0 arrow", "26 hit 1 6 2.0 arrow", "60 hit 0 6 2.0 arrow", "90 move 5 52.5 70.5", "120 hit 1 5 2.0 arrow", "200 move 6 58.5 40.5", "260 hit 0 2 1.0 mob"});
    }
    // batch 30: both zombies and a villager pair squeezed between them (villager flee from several zombies, the golem west of the door), then Peaceful (EntityMob.onUpdate setDead)
    double[][] pinch = {{52.5, 52.5}, {56.5, 54.5}, {61.5, 50.5}, {43.5, 55.5}, {46.5, 51.5}, {52.5, 80.5}, {60.5, 25.5}, {62.5, 58.5}};
    scenario("villagers-flee-two-zombies", 3, 300, pinch, new String[] {"150 hit 1 2 1.0 mob", "200 hit 0 3 1.0 mob"});
    difficulty = 0;
    scenario("peaceful", 4, 120, open, new String[] {"0 walk 7 -0.1 -0.05", "60 hit 0 7 1.0 player"}); // villager hit only: a removed mob is no longer in the world, so the port cannot take a hit that a probe script lands on its corpse
    difficulty = 2;
    // Batch 31 (names b31-*, rows end with the arrows, records list the shots and conversions).
    // three zombies and two villagers, with the golem and a skeleton, on Normal and on Hard (one zombie breaks doors; a killed villager converts on Hard, half the time on Normal)
    double[][] three = {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 51.5}, {52.5, 80.5}, {62.5, 58.5}};
    for (int d = 2; d <= 3; d++) {
      difficulty = d;
      for (int seed = 0; seed < 2; seed++)
        scenario("b31-three-zombies-d" + d + "-" + seed, 10 + seed, 420, "VVzZZGK", three, new String[] {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "80 hit 3 7 5.0 player", "120 hit 3 7 5.0 player", "150 hit 0 4 1.0 mob"});
    }
    // the golem is a world away (it never reaches the fight), so the zombies chase the villagers down: kills convert on Hard (always) and on Normal (nextBoolean on the killer's Random), a scripted lethal blow lands at 250
    double[][] alone = {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}};
    for (int d = 2; d <= 3; d++) {
      difficulty = d;
      for (int seed = 0; seed < 3; seed++)
        scenario("b31-zombies-hunt-d" + d + "-" + seed, 50 + seed, 500, "VVzZZGK", alone, new String[] {"250 hit 1 3 30.0 mob"});
    }
    // bow skeletons (ArrowAttack, real arrows ticked in list order): three shooters facing the golem, two villagers and the player; Easy, Normal and Hard
    double[][] shooters = {{56.5, 53.5}, {58.5, 55.5}, {46.5, 51.5}, {64.5, 52.5}, {66.5, 56.5}, {62.5, 49.5}, {68.5, 54.5}};
    for (int d = 1; d <= 3; d++) {
      difficulty = d;
      scenario("b31-three-bows-d" + d, 20 + d, 360, "VVGBBB", shooters, new String[] {"30 hit 3 2 1.0 mob", "100 hit 4 2 1.0 mob", "200 hit 5 2 1.0 mob"});
    }
    // arrows through the villagers: the shooters (east) aim at the player (west) with the two villagers standing in the line of fire; the golem is far away
    double[][] line = {{58.5, 52.5}, {58.5, 54.5}, {10.5, 10.5}, {66.5, 52.5}, {66.5, 54.5}, {68.5, 53.5}, {52.5, 53.5}};
    for (int d = 1; d <= 3; d++) {
      difficulty = d;
      scenario("b31-arrows-through-villagers-d" + d, 60 + d, 300, "VVGBBB", line, new String[] {"150 hit 3 6 1.0 player"});
    }
    difficulty = 2;
    // a moving player fights back at bow skeletons: walks to them, hits one, backs off (arrows reach the player and the villagers beside him)
    double[][] chase = {{58.5, 50.5}, {60.5, 50.5}, {46.5, 51.5}, {66.5, 52.5}, {70.5, 56.5}, {72.5, 50.5}, {62.5, 58.5}};
    scenario("b31-player-vs-bows", 30, 400, "VVGBBB", chase, new String[] {"0 walk 6 0.12 -0.1", "40 walk 6 0.1 0", "62 walk 6 0 0", "64 hit 3 6 4.0 player", "80 hit 3 6 4.0 player", "100 hit 3 6 4.0 player", "120 walk 6 -0.1 0.1", "180 walk 6 0 0", "200 hit 4 6 5.0 player", "260 hit 0 6 1.0 player"});
    // an equipment swap: a skeleton starts empty-handed (AttackOnCollide), takes a bow at tick 40 (script phase), loses it at 120; a second one swaps after another mob's update (tick 40, after entity 0) and mid-pass
    double[][] swap = {{52.5, 52.5}, {46.5, 51.5}, {60.5, 52.5}, {64.5, 54.5}, {62.5, 56.5}};
    scenario("b31-equip-swap", 40, 240, "VGKK", Arrays.copyOf(swap, 5), new String[] {"40 equip 2 261", "120 equip 2 0", "60 equipmid 0 3 261", "150 equipmid 3 3 0"});
    // a hit on a Peaceful-removed zombie: the mob left the world (setDead) at the end of tick 0, but its health is still 20, so the hit lands natively
    difficulty = 0;
    scenario("b31-peaceful-hit-removed", 41, 60, "VVZZGKK", open, new String[] {"5 hit 2 7 3.0 player", "6 hit 2 7 3.0 mob", "10 hit 5 7 30.0 player"});
    difficulty = 2;
    // 15 small player hits on a villager reach reputation -15: the golem then targets the player; killing the golem costs another 5; a second name takes over the reputation key
    scenario("player-turns-aggressive", 0, 700, open, new String[] {"10 hit 0 7 0.1 player", "31 hit 0 7 0.1 player", "52 hit 0 7 0.1 player", "73 hit 0 7 0.1 player", "94 hit 0 7 0.1 player", "115 hit 0 7 0.1 player", "136 hit 0 7 0.1 player", "157 hit 0 7 0.1 player",
      "178 hit 0 7 0.1 player", "199 hit 0 7 0.1 player", "220 hit 0 7 0.1 player", "241 hit 0 7 0.1 player", "262 hit 0 7 0.1 player", "283 hit 0 7 0.1 player", "304 hit 0 7 0.1 player", "330 move 7 50.5 56.5", "500 hit 4 7 300.0 player", "600 rename alt", "610 hit 1 7 0.1 player"});
  }
}
