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
  // The rest of that block (sv.h bytecode): the previous stack's attribute modifiers come off the attribute map (sv.d), the new one's go on, and previousEquipment follows; so a zombie that
  // spawned with a sword hits with the sword's damage.
  static void equipSync(sv e, int slot) throws Exception {
    add[] prev = (add[]) MobMoveProbe.field(sv.class, "g").get(e); add cur = e.q(slot);
    if (add.b(prev[slot], cur)) return;
    tl map = (tl) MobMoveProbe.field(sv.class, "d").get(e);
    if (prev[slot] != null) map.a(prev[slot].D());
    if (cur != null) map.b(cur.D());
    prev[slot] = cur == null ? null : cur.m();
  }
  // Batch 36: setCurrentItemOrArmor(0) only; EntityLivingBase.onUpdate's equipment block (equipSync, run before each update below) takes the old stack's attribute modifiers off and the new one's on.
  static void held(sv e, add stack) throws Exception { e.c(0, stack); }
  // World.updateEntityWithOptionalForce: onUpdate, or updateRidden (onUpdate plus the mount's seat) for an entity that rides, then its rider's update right after.
  static final java.util.Set<sa> ghosts = new java.util.HashSet<>();
  static void update(sa e) throws Exception {
    if (e instanceof sv) for (int slot = 0; slot < 5; slot++) equipSync((sv) e, slot);
    if (e.m != null) e.ab(); else e.h();
    if (e.l != null) {
      if (e.l.K || e.l.m != e) { e.l.m = null; e.l = null; }
      else if (!ghosts.contains(e.l)) { e.l.aa++; update(e.l); } // a rider the world refused (not added to a chunk) is never ticked: World.updateEntityWithOptionalForce needs addedToChunk
    }
  }
  static double[] bx(azt b) throws Exception { return new double[] {b.a, b.b, b.c, b.d, b.e, b.f}; }
  static String searchJson() {
    StringBuilder b = new StringBuilder("[");
    for (long[] r : VillagerProbe.World.searches) b.append(b.length() > 1 ? "," : "").append("[").append(r[0]).append(",").append(r[1]).append(",").append(r[2]).append("]");
    long total = 0, worst = 0; for (long ns : VillagerProbe.World.searchNanos) { total += ns; worst = Math.max(worst, ns); }
    long points = 0, most = 0; for (long[] r : VillagerProbe.World.searches) { points += r[1]; most = Math.max(most, r[1]); }
    System.err.println("searches " + VillagerProbe.World.searches.size() + " points " + points + " max " + most + " native ms total " + total / 1e6 + " worst " + worst / 1e6);
    return b.append("]").toString();
  }
  static boolean b35or36(String name) { return name.startsWith("b35-") || b36up(name) || name.startsWith("b37-"); }
  static boolean b36up(String name) { return name.startsWith("b36-") || name.startsWith("b37-"); }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  public static class Log extends Random {
    List<String> log = new ArrayList<>();
    Log(long seed) { super(seed); }
    public int nextInt(int bound) { int r = super.nextInt(bound); log.add("i" + bound + (SeedRandom.TRACE ? SeedRandom.where() : "")); return r; }
    public float nextFloat() { float r = super.nextFloat(); log.add("f" + (SeedRandom.TRACE ? SeedRandom.where() : "")); return r; }
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
    public float g() { return 1.62f; } // EntityPlayerMP.getEyeHeight (mw.g, bytecode-read): the server player's eye over its feet (yOffset 0)
  }
  // Index of an entity in the record: the mobs, the player (types.length), then the zombies spawned during the fight in spawn order.
  static List<sv> mobsForIndex = new ArrayList<>();
  static int index(Object[] ents, List<yq> extra, Object e) {
    for (int k = 0; k < ents.length; k++) if (ents[k] == e) return k;
    for (int k = 0; k < extra.size(); k++) if (extra.get(k) == e) return ents.length + k;
    for (int k = 0; k < mobsForIndex.size(); k++) if (mobsForIndex.get(k) == e) return ents.length + extra.size() + k; // batch 37: spiders and skeletons spawned during the fight follow the zombies
    return -1;
  }
  static String draws(List<String> log) {
    StringBuilder s = new StringBuilder();
    for (String d : log) s.append(s.length() > 0 ? "," : "").append("\"").append(d).append("\"");
    return s.toString();
  }

  // batch 35: `follow` > 0 sets every zombie's generic.followRange base value (yj.b): the live value after EntityZombie.onSpawnWithEgg's "Random zombie-spawn bonus" (operation 2, d0 = nextDouble * 1.5 * local difficulty, kept when above 1) reaches (40 + bonus) * (1 + d0), up to about 130 on Hard
  static void base(yq z) throws Exception { if (reinforce > 0) ((ti) z.a((th) MobMoveProbe.field(yq.class, "bp").get(null))).a(reinforce); if (follow > 0) ((ti) z.a(yj.b)).a(follow); }
  static double follow = 0;
  static double local = 0; // batch 37: World.func_147462_b (regional difficulty) the double answers, record field `local`
  static int[][] blocks = {}; static boolean water = false; static int light = 15; static double reinforce = 0; // batch 32 arena (reset after each scenario)
  static int[][] unloadedChunks = {}; // batch 34: [chunkX, chunkZ] pairs the ChunkProviderServer model has not loaded
  static int eggTimer = 6000; // batch 36: chickens' timeUntilNextEgg (the constructor's nextInt(6000) + 6000 is out of reach of any record)
  static int difficulty = 2; // batch 30: rd ordinal (0 Peaceful .. 3 Hard) the next scenarios run on
  static final String DEFAULT_TYPES = "VVZZGKK";
  static void scenario(String name, long seed, int ticks, double[][] pos, String[] script) throws Exception { scenario(name, seed, ticks, DEFAULT_TYPES, pos, script); }
  // Batch 31: `types` is one letter per mob (V villager, Z zombie, z zombie with CanBreakDoors, G iron golem, K skeleton with an empty hand,
  // B skeleton holding a bow); the player follows the last mob. A record with a bow skeleton, a villager that may convert or an equip op also
  // carries the spawned arrows (`shots`: their initial state, which natively comes from an unseedable Random) and per tick the arrows' rows.
  static void scenario(String name, long seed, int ticks, String types, double[][] pos, String[] script) throws Exception {
    int n = types.length();
    if (System.getenv("VF_ONLY") != null && !name.equals(System.getenv("VF_ONLY"))) return; // development aid: run one record
    if (System.getenv("VF_PREFIX") != null && !name.startsWith(System.getenv("VF_PREFIX"))) return; // development aid: run the records of one batch
    MobMoveProbe.set(VillageLiveProbe.world, "r", rd.values()[difficulty]);
    wc c = VillageLiveProbe.newCollection(seed);
    VillageLiveProbe.W.players.clear();
    VillageLiveProbe.W.day = false;
    VillageLiveProbe.door(50, 0, 50, 0);
    VillageLiveProbe.W.roofs.add(new int[] {40, 0, 49, 100});
    for (int[] b : blocks) for (int x = b[0]; x <= b[3]; x++) for (int y = b[1]; y <= b[4]; y++) for (int z = b[2]; z <= b[5]; z++) VillageLiveProbe.put(x, y, z, b[6], b[7]);
    VillagerProbe.World.light = light; MobMoveProbe.ProbeWorld.water = water;
    // batch 34: b34-* records read blocks through the real ChunkCache (VF_CACHE_ALL=1 runs the older ones that way too, to see which of them depend on it) and may leave chunks unloaded
    boolean cache = name.startsWith("b34-") || b35or36(name) || System.getenv("VF_CACHE_ALL") != null;
    VillagerProbe.World.chunkCache = cache; VillagerProbe.World.unloaded.clear();
    for (int[] u : unloadedChunks) VillagerProbe.World.unloaded.add(VillagerProbe.World.chunkKey(u[0], u[1]));
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
        case 'C': { wg hen = new wg(w); hen.bu = eggTimer; ents[i] = hen; break; }
        case 'B': { yl k = new yl(w); held(k, ArmorEnchantmentProbe.make(261, 0, ArmorEnchantmentProbe.ench())); ents[i] = k; break; }
        default: throw new RuntimeException(types);
      }
    }
    ents[n] = player;
    // EntityZombie.applyEntityAttributes draws the spawnReinforcements base (nextDouble * 0.1) from the constructor's Entity.rand: with Entity seeded it is part of the record.
    StringBuilder bases = new StringBuilder("[");
    for (int i = 0; i < n; i++) bases.append(i > 0 ? "," : "").append(ents[i] instanceof yq ? num(((ti) ((yq) ents[i]).a((th) MobMoveProbe.field(yq.class, "bp").get(null))).e()) : "null");
    bases.append("]");
    VillagerProbe.World.immediateZombies = (name.startsWith("b33-") || name.startsWith("b34-") || b35or36(name));
    boolean extras = name.startsWith("b31-") || name.startsWith("b32-") || name.startsWith("b33-") || name.startsWith("b34-") || b35or36(name); // rows then end with the arrows, and the record lists the shots and conversions
    VillagerProbe.World.spawned.clear();
    SeedRandom.next = 1000000L + seed * 1000; // the first Entity built from here on (an arrow, a converted or reinforcement zombie) gets this seed
    List<yq> extraZombies = new ArrayList<>(); List<String> zombieRecs = new ArrayList<>();
    List<wg> extraChickens = new ArrayList<>(); List<String> chickenRecs = new ArrayList<>(), spawnRecs = new ArrayList<>(); // batch 36
    VillagerProbe.World.immediateChickens = b36up(name);
    VillagerProbe.World.immediateMobs = name.startsWith("b37-");
    VillagerProbe.World.localDiff = (float) local;
    List<sv> extraMobs = mobsForIndex = new ArrayList<>(); List<String> mobRecs = new ArrayList<>(); // batch 37: spiders and skeletons the spawn ops built (a spider jockey's skeleton)
    Log[] logs = new Log[ents.length];
    for (int i = 0; i < ents.length; i++) {
      sa e = (sa) ents[i];
      for (String fn : new String[] {"y", "aO", "aM", "aN", "aP"}) MobMoveProbe.set(e, fn, 0f);
      logs[i] = new Log(seed * 10 + i);
      MobMoveProbe.set(e, "Z", logs[i]);
      at(e, pos[i][0], pos[i].length > 2 ? pos[i][2] : 0, pos[i][1]); // batch 33: an optional third element is the start height (a raised platform)
      MobMoveProbe.set(e, "D", true);
      VillagerProbe.World.entities.add(e);
    }
    player.a(yj.a).a(1000.0);
    player.g(1000.0f);
    MobMoveProbe.set(player, "L", 0f);
    at(player, pos[n][0], pos[n].length > 2 ? pos[n][2] : 0, pos[n][1]); // yOffset 0 as EntityPlayerMP: rebuild the box that the loop above made with EntityPlayer's 1.62 (batch 29: the stale box made a zombie's AttackOnCollide see a target that had moved)
    VillageLiveProbe.W.players.put("probe", player);
    VillagerProbe.World.closePlayers = new ArrayList<yz>(java.util.Arrays.asList(player));
    double[][] vel = new double[ents.length][2];
    List<String> rows = new ArrayList<>(), hits = new ArrayList<>(), shots = new ArrayList<>(), conversions = new ArrayList<>();
    java.util.Map<sa, Integer> arrowId = new java.util.HashMap<>(); java.util.Map<sa, String> lastArrow = new java.util.HashMap<>(); List<sa> arrowList = new ArrayList<>(); List<sa> removed = new ArrayList<>();
    VillagerProbe.World.searches.clear(); VillagerProbe.World.searchNanos.clear();
    for (int t = 0; t < ticks; t++) {
      VillagerProbe.World.tick = t;
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
          case "hitmob": { // batch 37: "t hitmob k dmg player|mob": a hit on the k-th spider or skeleton built during the fight, by the player (the last entity) or the first mob
            sv victim = (sv) mobsForIndex.get(Integer.parseInt(p[2]));
            sa attacker = (sa) ents[p[4].equals("player") ? ents.length - 1 : 0];
            boolean hit = victim.a(p[4].equals("player") ? ro.a((yz) attacker) : ro.a((sv) attacker), Float.parseFloat(p[3]));
            hits.add("[" + t + "," + hit + "," + num(victim.aS()) + "]");
            break;
          }
          case "equip": held((sv) ents[Integer.parseInt(p[2])], p[3].equals("0") ? null : ArmorEnchantmentProbe.make(Integer.parseInt(p[3]), 0, ArmorEnchantmentProbe.ench())); break; // setCurrentItemOrArmor(0): setCombatTask runs at once
          case "spawn": { // batch 36: "t spawn x z y yaw" SpawnerAnimals' order: a zombie placed, World.spawnEntityInWorld (refused in an unloaded chunk), then onSpawnWithEgg(null) with its chicken-jockey rolls
            yq z = new yq(w);
            z.b(Double.parseDouble(p[2]), Double.parseDouble(p[4]), Double.parseDouble(p[3]), Float.parseFloat(p[5]), 0f);
            boolean in = w.d(z);
            if (!in) ghosts.add(z);
            int spawnedBefore = VillagerProbe.World.spawned.size();
            z.a((sy) null);
            int kind = 0, near = -1;
            if (z.m != null) { kind = 2; for (int k = 0; k < ents.length; k++) if (ents[k] == z.m) { kind = 1; near = k; } }
            boolean chickenIn = false; for (int k = spawnedBefore; k < VillagerProbe.World.spawned.size(); k++) if (VillagerProbe.World.spawned.get(k) instanceof wg) chickenIn = true;
            spawnRecs.add("[" + t + "," + (in ? 1 : 0) + "," + (z.f() ? 1 : 0) + "," + kind + "," + near + "," + (chickenIn ? 1 : 0) + "," + ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(z)).seed + "]");
            break;
          }
          case "spawnspider": { // batch 37: "t spawnspider x z y yaw" SpawnerAnimals' order for a spider: placed, World.spawnEntityInWorld, EntitySpider.onSpawnWithEgg(null): World.rand rolls the 1-in-100 skeleton jockey, then on Hard the potion effect
            yn sp = new yn(w);
            sp.b(Double.parseDouble(p[2]), Double.parseDouble(p[4]), Double.parseDouble(p[3]), Float.parseFloat(p[5]), 0f);
            w.d(sp);
            sp.a((sy) null);
            break;
          }
          case "walk": vel[Integer.parseInt(p[2])] = new double[] {Double.parseDouble(p[3]), Double.parseDouble(p[4])}; break;
          case "move": at((sa) ents[Integer.parseInt(p[2])], Double.parseDouble(p[3]), p.length > 5 ? Double.parseDouble(p[5]) : 0, Double.parseDouble(p[4])); break; // batch 33: optional height
          case "rename": VillageLiveProbe.W.players.remove(player.n); player.n = p[2]; VillageLiveProbe.W.players.put(p[2], player); break;
        }
      }
      for (int i = 0; i < ents.length; i++) if (vel[i][0] != 0 || vel[i][1] != 0) { sa e = (sa) ents[i]; at(e, e.s + vel[i][0], e.t, e.u + vel[i][1]); }
      if (t % 60 == 0) c.a(52, 0, 52);
      c.a();
      for (Log l : logs) l.log.clear();
      for (yq z : extraZombies) ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(z)).log.clear();
      for (wg ch : extraChickens) ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(ch)).log.clear();
      for (sv m : extraMobs) ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(m)).log.clear();
      // World.updateEntities walks loadedEntityList by index, so an arrow spawned by a skeleton joins the end and ticks in the same pass; a dead entity
      // (setDead) leaves the list right after its own update (extras records only: the batch 28-30 records kept corpses in the list).
      List<String> tickArrows = new ArrayList<>();
      List<sa> ticking = new ArrayList<>();
      for (int i = 0; i < n; i++) ticking.add((sa) ents[i]);
      ticking.addAll(arrowList); // arrows already in flight (or stuck) tick after every mob, in spawn order
      for (int i = 0; i < ticking.size(); i++) {
        sa e = ticking.get(i);
        if (e.m != null) { if (!e.m.K && e.m.l == e) continue; e.m.l = null; e.m = null; } // World.updateEntities: a rider updates with its mount (update), not on its own
        if (!e.K || !extras) {
          if (e.K) continue;
          VillagerProbe.World.entities.size();
          e.aa++;
          if (System.getenv("VF_EXTRA") != null && extraZombies.contains(e)) System.err.println("pre " + t + " " + e.s + "," + e.t + "," + e.u + " motion=" + e.v + "," + e.w + "," + e.x + " box=" + java.util.Arrays.toString(bx(e.C)) + " w=" + MobMoveProbe.field(sa.class, "M").getFloat(e));
          update(e); // World.updateEntityWithOptionalForce does ++ticksExisted before onUpdate (batch 36: and the equipment block, a rider's updateRidden and the rider's own update)
        }
        for (String op : script) { // batch 31: "t equipmid k idx item" swaps the held item right after entity k's update (EntityLiving.onLivingUpdate's pickup runs there natively)
          String[] p = op.split(" ");
          if (Integer.parseInt(p[0]) == t && p[1].equals("equipmid") && Integer.parseInt(p[2]) == i) held((sv) ents[Integer.parseInt(p[3])], p[4].equals("0") ? null : ArmorEnchantmentProbe.make(Integer.parseInt(p[4]), 0, ArmorEnchantmentProbe.ench()));
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
          } else if (sp instanceof wg && b36up(name)) {
            // Batch 36: a chicken built by a baby zombie's onSpawnWithEgg (a new chicken jockey), spawned and ticked like any mob. Its constructor's Math.random yaw is overwritten by setLocationAndAngles (the zombie's yaw).
            wg ch = (wg) sp;
            chickenRecs.add("[" + t + "," + num(ch.s) + "," + num(ch.t) + "," + num(ch.u) + "," + ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(ch)).seed + "," + num(ch.y) + "," + num(MobMoveProbe.field(sv.class, "aP").getFloat(ch)) + "," + (ch.bZ() ? 1 : 0) + "," + ch.bu + "]");
            extraChickens.add(ch); arrowList.add(ch); ticking.add(ch);
            if (!VillagerProbe.World.entities.contains(ch)) VillagerProbe.World.entities.add(ch);
          } else if ((sp instanceof yn || sp instanceof yl) && name.startsWith("b37-")) {
            // Batch 37: a spider built by a spawn op and the skeleton its onSpawnWithEgg seats on it (World.spawnEntityInWorld first, mountEntity after): both join the world list and tick in this pass; the skeleton updates with its mount.
            sv m = (sv) sp;
            for (String fn : new String[] {"aO", "aM", "aN", "aP"}) MobMoveProbe.set(m, fn, 0f);
            for (int slot = 0; slot < 5; slot++) equipSync(m, slot);
            int mount = -1; if (((sa) m).m != null) for (int k = 0; k < extraMobs.size(); k++) if (extraMobs.get(k) == ((sa) m).m) mount = k;
            mobRecs.add("[" + t + "," + (sp instanceof yn ? 0 : 1) + "," + num(m.s) + "," + num(m.t) + "," + num(m.u) + "," + ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(m)).seed + "," + num(m.y) + "," + mount + "," + num(((ti) m.a(yj.d)).e()) + "," + num(m.aS()) + "]");
            extraMobs.add(m); arrowList.add(m); ticking.add(m);
            if (!VillagerProbe.World.entities.contains(m)) VillagerProbe.World.entities.add(m);
          } else if (sp instanceof yq) {
            // Batch 32: a zombie spawned mid-pass (EntityZombie.onKillEntity's converted villager, or a Hard reinforcement) joins the world list and ticks in this
            // pass like any entity. A conversion stands exactly where a dead villager did; a reinforcement is built by attackEntityFrom on an integer corner.
            yq z = (yq) sp;
            boolean conv = false;
            for (int k = 0; k < n; k++) if (ents[k] instanceof yv && ((sv) ents[k]).aS() <= 0 && ((sa) ents[k]).s == z.s && ((sa) ents[k]).u == z.u) conv = true;
            if (conv) conversions.add("[" + t + "," + num(z.s) + "," + num(z.t) + "," + num(z.u) + "]");
            for (String fn : new String[] {"aO", "aM", "aN", "aP"}) MobMoveProbe.set(z, fn, 0f);
            for (int slot = 0; slot < 5; slot++) equipSync(z, slot); // batch 34: onSpawnWithEgg may have equipped it: EntityLivingBase.onUpdate's equipment block minus the packet the double cannot send
            zombieRecs.add("[" + t + "," + (conv ? 1 : 0) + "," + num(z.s) + "," + num(z.t) + "," + num(z.u) + "," + ((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(z)).seed + "," + (z.bZ() ? 1 : 0) + "," + num(z.y) + "]"); // the last field is rotationYaw: EntityLivingBase's constructor rolls it with Math.random (0..2*pi degrees), which no Entity.rand seed reaches
            if (System.getenv("VF_EXTRA") != null) System.err.println("drain " + t + " at ticking index " + i + " of " + ticking.size());
            extraZombies.add(z);
            arrowList.add(z);
            ticking.add(z);
            if (!VillagerProbe.World.entities.contains(z)) VillagerProbe.World.entities.add(z);
          }
        }
        if (e instanceof zc) { // only an arrow whose state changed since the last row lists (a stuck arrow ticks on, unchanged)
          String as = "[" + arrowId.get(e) + "," + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + (e.K ? 1 : 0) + "]";
          if (!as.equals(lastArrow.put(e, as))) tickArrows.add(as);
        }
        if (e.K && extras) { VillagerProbe.World.entities.remove(e); arrowList.remove(e); if (!(e instanceof zc)) removed.add(e); ticking.remove(i--); }
      }
      if (System.getenv("VF_PATH") != null) { // development aid: the native path of mob VF_PATH after each tick
        try {
          sw m = (sw) ents[Integer.parseInt(System.getenv("VF_PATH"))]; Object nav = m.m(); Object path = null;
          for (Field f : nav.getClass().getDeclaredFields()) if (f.getType() == ayf.class) { f.setAccessible(true); path = f.get(nav); }
          StringBuilder pb = new StringBuilder();
          if (path != null) for (Field f : ayf.class.getDeclaredFields()) if (f.getType().isArray() && !f.getType().getComponentType().isPrimitive()) { f.setAccessible(true); for (Object pt : (Object[]) f.get(path)) pb.append(pt == null ? "null" : "(" + MobMoveProbe.field(pt.getClass(), "a").getInt(pt) + "," + MobMoveProbe.field(pt.getClass(), "b").getInt(pt) + "," + MobMoveProbe.field(pt.getClass(), "c").getInt(pt) + ")"); }
          System.err.println("path " + t + " " + pb);
        } catch (Exception ex) { System.err.println("path ?" + ex); }
      }
      if (System.getenv("VF_YAW") != null) { // development aid (batch 33): rotationYaw, motion, ground and liquid flags of mob VF_YAW after each tick
        sa m = (sa) ents[Integer.parseInt(System.getenv("VF_YAW"))];
        System.err.println("yaw " + t + " yaw=" + m.y + " head=" + MobMoveProbe.field(sv.class, "aP").getFloat(m) + " motion=" + m.v + "," + m.w + "," + m.x + " ground=" + m.D + " pos=" + m.s + "," + m.t + "," + m.u);
      }
      if (System.getenv("VF_EXTRA") != null && extraZombies.size() > Integer.parseInt(System.getenv("VF_EXTRA"))) { // development aid (batch 33): state of the first zombie built during the fight
        yq m = extraZombies.get(Integer.parseInt(System.getenv("VF_EXTRA")));
        System.err.println("extra " + t + " yaw=" + m.y + " motion=" + m.v + "," + m.w + "," + m.x + " ground=" + m.D + " collH=" + MobMoveProbe.field(sa.class, "E").getBoolean(m) + " pos=" + m.s + "," + m.t + "," + m.u);
      }
      if (System.getenv("VF_COL") != null) { // development aid: collision flags of mob VF_COL after each tick
        sa m = (sa) ents[Integer.parseInt(System.getenv("VF_COL"))];
        System.err.println("col " + t + " E=" + MobMoveProbe.field(sa.class, "E").getBoolean(m) + " F=" + MobMoveProbe.field(sa.class, "F").getBoolean(m) + " D=" + MobMoveProbe.field(sa.class, "D").getBoolean(m) + " vy=" + m.w + " y=" + m.t + " off=" + m.c(m.v, m.w + 0.6 - m.t + Double.parseDouble(System.getenv("VF_Y0") == null ? "0" : System.getenv("VF_Y0")), m.x) + " coll=" + ((List) VillageLiveProbe.world.a(m, m.C.c(m.v, m.w + 0.6 - m.t + Double.parseDouble(System.getenv("VF_Y0") == null ? "0" : System.getenv("VF_Y0")), m.x))).size() + " box=" + java.util.Arrays.toString(bx(m.C.c(m.v, m.w + 0.6 - m.t + Double.parseDouble(System.getenv("VF_Y0") == null ? "0" : System.getenv("VF_Y0")), m.x))) + " hit=" + (((List) VillageLiveProbe.world.a(m, m.C.c(m.v, m.w + 0.6 - m.t + Double.parseDouble(System.getenv("VF_Y0") == null ? "0" : System.getenv("VF_Y0")), m.x))).isEmpty() ? "" : java.util.Arrays.toString(bx((azt) ((List) VillageLiveProbe.world.a(m, m.C.c(m.v, m.w + 0.6 - m.t + Double.parseDouble(System.getenv("VF_Y0") == null ? "0" : System.getenv("VF_Y0")), m.x))).get(0)))) + " liq=" + VillageLiveProbe.world.d(m.C.c(m.v, m.w + 0.6 - m.t + Double.parseDouble(System.getenv("VF_Y0") == null ? "0" : System.getenv("VF_Y0")), m.x)));
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
        if (name.startsWith("b37-")) { // the spiders and skeletons built during the fight (chickens first as in b36 rows)
          row.append(",[");
          for (int k = 0; k < extraChickens.size(); k++) { wg ch = extraChickens.get(k); row.append(k > 0 ? "," : "").append("[").append(num(ch.s)).append(",").append(num(ch.t)).append(",").append(num(ch.u)).append(",").append(num(ch.aS())).append(",").append(ch.bZ() ? 1 : 0).append(",[").append(draws(((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(ch)).log)).append("]]"); }
          row.append("],[");
          boolean firstFlag = true;
          for (int k = 0; k < n; k++) if (ents[k] instanceof wg) { row.append(firstFlag ? "" : ",").append(((wg) ents[k]).bZ() ? 1 : 0); firstFlag = false; }
          row.append("],[");
          for (int k = 0; k < extraMobs.size(); k++) {
            sv m = extraMobs.get(k);
            row.append(k > 0 ? "," : "").append("[").append(num(m.s)).append(",").append(num(m.t)).append(",").append(num(m.u)).append(",").append(num(m.aS())).append(",")
              .append(index(ents, extraZombies, ((sw) m).o())).append(",").append(index(ents, extraZombies, (sv) MobMoveProbe.field(sv.class, "i").get(m))).append(",[").append(draws(((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(m)).log)).append("]]");
          }
          row.append("]");
        } else if (b36up(name)) { // the chickens built during the fight
          row.append(",[");
          for (int k = 0; k < extraChickens.size(); k++) { wg ch = extraChickens.get(k); row.append(k > 0 ? "," : "").append("[").append(num(ch.s)).append(",").append(num(ch.t)).append(",").append(num(ch.u)).append(",").append(num(ch.aS())).append(",").append(ch.bZ() ? 1 : 0).append(",[").append(draws(((SeedRandom) MobMoveProbe.field(sa.class, "Z").get(ch)).log)).append("]]"); }
          row.append("],[");
          boolean firstFlag = true;
          for (int k = 0; k < n; k++) if (ents[k] instanceof wg) { row.append(firstFlag ? "" : ",").append(((wg) ents[k]).bZ() ? 1 : 0); firstFlag = false; } // IsChickenJockey of the chickens the record starts with
          row.append("]");
        }
      }
      row.append("]");
      rows.add(row.toString());
    }
    StringBuilder sc = new StringBuilder(), rs = new StringBuilder(), hs = new StringBuilder();
    for (String s : script) sc.append(sc.length() > 0 ? "," : "").append(q(s));
    for (String r : rows) rs.append(rs.length() > 0 ? "," : "").append(r);
    for (String h : hits) hs.append(hs.length() > 0 ? "," : "").append(h);
    System.out.println("{\"case\":\"fight\",\"name\":" + q(name) + ",\"seed\":" + seed + ",\"difficulty\":" + difficulty + ",\"ticks\":" + ticks + (extras ? ",\"types\":" + q(types) + ",\"shots\":[" + String.join(",", shots) + "],\"conversions\":[" + String.join(",", conversions) + "],\"zombies\":[" + String.join(",", zombieRecs) + "]" + ",\"bases\":" + bases + (blocks.length > 0 ? ",\"blocks\":" + java.util.Arrays.deepToString(blocks) : "") + (water ? ",\"water\":true" : "") + (light != 15 ? ",\"light\":" + light : "") + (reinforce > 0 ? ",\"reinforce\":" + reinforce : "") + (follow > 0 ? ",\"follow\":" + follow : "") + (local > 0 ? ",\"local\":" + local : "") + (cache ? ",\"chunkCache\":true" : "") + (b36up(name) ? ",\"egg\":" + eggTimer + ",\"spawns\":[" + String.join(",", spawnRecs) + "],\"chickens\":[" + String.join(",", chickenRecs) + "]" + (name.startsWith("b37-") ? ",\"mobs\":[" + String.join(",", mobRecs) + "]" : "") : "") + (b35or36(name) ? ",\"searches\":" + searchJson() : "") + (unloadedChunks.length > 0 ? ",\"unloaded\":" + java.util.Arrays.deepToString(unloadedChunks) : "") : "") + ",\"pos\":" + java.util.Arrays.deepToString(pos) + ",\"script\":[" + sc + "],\"hits\":[" + hs + "],\"rows\":[" + rs + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    VillagerProbe.World.pickEntities = true;
    MobMoveProbe.ProbeWorld.exact = true;
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
    // Batch 32: arena variants (fill specs {x0,y0,z0,x1,y1,z1,id,meta}; the flat floor is y=-1, mobs stand at y=0). Zombies, villagers and the golem as in b31-three-zombies.
    double[][] arena = three;
    String[] fight = {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "80 hit 3 7 5.0 player", "120 hit 3 7 5.0 player", "150 hit 0 4 1.0 mob"};
    String[] hunt = {"250 hit 1 3 30.0 mob"};
    // a one-block ledge (zombies and the golem jump it) and a two-block wall (they path around its ends); on Hard so that the villagers convert
    for (int d = 2; d <= 3; d++) {
      difficulty = d;
      blocks = new int[][] {{58, 0, 40, 59, 0, 70, 1, 0}};
      scenario("b32-step1-d" + d, 100 + d, 420, "VVzZZGK", arena, fight);
      scenario("b32-step1-hunt-d" + d, 110 + d, 500, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt);
      blocks = new int[][] {{58, 0, 44, 59, 1, 60, 1, 0}};
      scenario("b32-step2-d" + d, 120 + d, 420, "VVzZZGK", arena, fight);
      scenario("b32-step2-hunt-d" + d, 130 + d, 500, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt);
      blocks = new int[][] {{56, 0, 40, 57, 1, 70, 1, 0}, {58, 0, 40, 59, 0, 70, 1, 0}, {60, 0, 40, 61, 0, 70, 2, 0}}; // a stair of three levels: 1, 1/2, grass-height ledges
      scenario("b32-terrace-d" + d, 140 + d, 420, "VVzZZGK", arena, fight);
    }
    // a water pool (two deep) between the zombies and the villagers
    difficulty = 3; water = true;
    blocks = new int[][] {{56, -2, 44, 62, -1, 62, 9, 0}};
    scenario("b32-pool-d3", 150, 420, "VVzZZGK", arena, fight);
    scenario("b32-pool-hunt-d3", 151, 500, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt);
    blocks = new int[][] {{56, -2, 44, 62, -1, 62, 9, 0}, {63, -2, 44, 63, -1, 62, 1, 0}};
    scenario("b32-pool-golem-d2", 152, 420, "VVzZZGK", arena, fight);
    water = false; blocks = new int[][] {};
    // closed doors: the villagers stand in a stone room with a wooden door; zombies (one breaks doors) outside
    int[][] house = {{49, 0, 49, 56, 2, 49, 4, 0}, {49, 0, 56, 56, 2, 56, 4, 0}, {49, 0, 50, 49, 2, 55, 4, 0}, {56, 0, 50, 56, 2, 55, 4, 0}, {49, 3, 49, 56, 3, 56, 4, 0}, {56, 0, 52, 56, 0, 52, 64, 0}, {56, 1, 52, 56, 1, 52, 64, 8}};
    for (int d = 2; d <= 3; d++) {
      difficulty = d;
      blocks = house;
      scenario("b32-closed-door-d" + d, 160 + d, 500, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 53.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 40.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt);
    }
    // an open door (meta 4) villagers walk through and close behind them
    blocks = new int[][] {{49, 0, 49, 56, 2, 49, 4, 0}, {49, 0, 56, 56, 2, 56, 4, 0}, {49, 0, 50, 49, 2, 55, 4, 0}, {56, 0, 50, 56, 2, 55, 4, 0}, {49, 3, 49, 56, 3, 56, 4, 0}, {56, 0, 52, 56, 0, 52, 64, 4}, {56, 1, 52, 56, 1, 52, 64, 8}};
    difficulty = 2;
    scenario("b32-open-door-d2", 170, 500, "VVzZGK", new double[][] {{52.5, 52.5}, {54.5, 53.5}, {70.5, 51.5}, {46.5, 40.5}, {52.5, 80.5}, {62.5, 58.5}, {62.5, 60.5}}, new String[] {});
    blocks = new int[][] {};
    // arrows hit blocks: a stone wall, a fence and a glass pane line between the shooters (east) and the player and villagers (west)
    difficulty = 3;
    int[][][] shields = {{{60, 0, 48, 60, 2, 60, 1, 0}}, {{60, 0, 48, 60, 1, 60, 85, 0}}, {{60, 0, 48, 60, 2, 60, 20, 0}}, {{60, 0, 48, 60, 0, 60, 44, 0}}};
    String[] shieldName = {"stone", "fence", "glass", "slab"};
    for (int k = 0; k < shields.length; k++) {
      blocks = shields[k];
      scenario("b32-arrows-" + shieldName[k], 180 + k, 300, "VVGBBB", new double[][] {{54.5, 52.5}, {54.5, 54.5}, {10.5, 10.5}, {66.5, 52.5}, {66.5, 54.5}, {68.5, 53.5}, {52.5, 53.5}}, new String[] {"150 hit 3 6 1.0 player"});
    }
    blocks = new int[][] {};
    // Hard reinforcements: a dark world and a reinforcement base of 1.0 (the base is otherwise nextDouble * 0.1): every hit on a zombie with a target can summon
    difficulty = 3; light = 0; reinforce = 1.0;
    scenario("b32-reinforce-d3", 190, 400, "VVzZZGK", arena, new String[] {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "80 hit 3 7 1.0 player", "100 hit 3 7 1.0 player", "120 hit 2 7 1.0 player", "150 hit 0 4 1.0 mob"});
    scenario("b32-reinforce-hunt-d3", 191, 450, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}}, new String[] {"100 hit 2 5 1.0 mob", "200 hit 3 1 1.0 mob"});
    difficulty = 2; light = 15; reinforce = 0;
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
    // Batch 33 (names b33-*): more terrain. The arena is b32's; `raised` puts the two villagers on a platform (third pos element = start height).
    double[][] raised = {{52.5, 52.5, 2}, {54.5, 52.5, 2}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 51.5}, {52.5, 80.5}, {62.5, 58.5}};
    double[][] farGolem = {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}};
    String[] fight33 = {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "80 hit 3 7 5.0 player", "120 hit 3 7 5.0 player", "150 hit 0 4 1.0 mob"};
    String[] hunt33 = {"250 hit 1 3 30.0 mob"};
    // stairs: a ramp of ascending stairs (meta 1 rises towards -x) up to a 2-high platform, and the same with upside-down stairs (meta 5)
    for (int inv = 0; inv < 2; inv++) {
      int sm = inv == 0 ? 1 : 5;
      blocks = new int[][] {{51, 0, 40, 57, 1, 66, 1, 0}, {58, 0, 40, 58, 0, 66, 1, 0}, {59, 0, 40, 59, 0, 66, 53, sm}, {58, 1, 40, 58, 1, 66, 53, sm}};
      for (int d = 2; d <= 3; d++) { difficulty = d; scenario("b33-stairs-" + (inv == 0 ? "up" : "inverted") + "-d" + d, 200 + inv * 10 + d, 420, "VVzZZGK", raised, fight33); }
      difficulty = 3;
      scenario("b33-stairs-" + (inv == 0 ? "up" : "inverted") + "-hunt-d3", 205 + inv * 10, 500, "VVzZZGK", new double[][] {{52.5, 52.5, 2}, {54.5, 52.5, 2}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt33);
    }
    // stairs the other way: zombies on the platform (east), villagers and the golem below; descending stairs (meta 0 rises towards +x)
    blocks = new int[][] {{61, 0, 40, 70, 1, 66, 1, 0}, {60, 0, 40, 60, 0, 66, 1, 0}, {59, 0, 40, 59, 0, 66, 53, 0}, {60, 1, 40, 60, 1, 66, 53, 0}};
    difficulty = 3;
    scenario("b33-stairs-down-d3", 230, 420, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5, 2}, {68.5, 55.5, 2}, {62.5, 47.5, 2}, {46.5, 51.5}, {52.5, 80.5}, {62.5, 58.5, 2}}, fight33);
    // ladders: a 3-high platform with a ladder column on its east face (zombies below climb it) and one on its west face (zombies on top come down it)
    blocks = new int[][] {{51, 0, 40, 57, 2, 66, 1, 0}, {58, 0, 40, 58, 2, 66, 65, 5}};
    scenario("b33-ladder-up-d3", 231, 420, "VVzZZGK", new double[][] {{52.5, 52.5, 3}, {54.5, 52.5, 3}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 51.5}, {52.5, 80.5}, {62.5, 58.5}}, fight33);
    blocks = new int[][] {{61, 0, 40, 70, 2, 66, 1, 0}, {60, 0, 44, 60, 2, 58, 65, 4}};
    scenario("b33-ladder-down-d3", 232, 420, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5, 3}, {68.5, 55.5, 3}, {62.5, 47.5, 3}, {46.5, 51.5}, {52.5, 80.5}, {62.5, 58.5, 3}}, fight33);
    // trapdoors across the zombies' way: closed (a 3/16 step), open (a thin wall), closed in the top half (a lid at head height)
    String[] trap = {"closed", "open", "top"}; int[] trapMeta = {0, 4, 8};
    for (int k = 0; k < 3; k++) {
      blocks = new int[][] {{58, 0, 40, 59, 0, 70, 96, trapMeta[k]}};
      scenario("b33-trapdoor-" + trap[k] + "-d3", 233 + k, 420, "VVzZZGK", arena, fight33);
    }
    // a fence line with a gate: closed (zombies go round) and open (they go through)
    for (int k = 0; k < 2; k++) {
      blocks = new int[][] {{58, 0, 44, 58, 1, 60, 85, 0}, {58, 0, 52, 58, 1, 52, 0, 0}, {58, 0, 52, 58, 0, 52, 107, k == 0 ? 1 : 5}};
      scenario("b33-gate-" + (k == 0 ? "closed" : "open") + "-d3", 236 + k, 420, "VVzZZGK", arena, fight33);
      scenario("b33-gate-" + (k == 0 ? "closed" : "open") + "-hunt-d3", 238 + k, 500, "VVzZZGK", farGolem, hunt33);
    }
    // lava: a pool between zombies and villagers (real liquid physics), mobs thrown in, and a hunt that has to go round it
    water = true;
    blocks = new int[][] {{56, -2, 44, 62, -1, 62, 11, 0}};
    scenario("b33-lava-pool-d3", 240, 420, "VVzZZGK", arena, fight33);
    scenario("b33-lava-hunt-d3", 241, 500, "VVzZZGK", farGolem, hunt33);
    scenario("b33-lava-fall-d3", 242, 420, "VVzZZGK", arena, new String[] {"30 move 2 59.5 52.5", "50 move 0 60.5 54.5", "80 move 3 58.5 50.5", "120 hit 3 7 5.0 player"});
    difficulty = 2;
    scenario("b33-lava-fall-d2", 243, 420, "VVzZZGK", arena, new String[] {"30 move 2 59.5 52.5", "50 move 0 60.5 54.5", "80 move 3 58.5 50.5", "120 hit 3 7 5.0 player"});
    difficulty = 3;
    water = false;
    // slippery, slowing and sticky floors: ice and packed ice (slipperiness 0.98), soul sand (0.875 box, slows), cobweb columns
    int[] floorId = {79, 174, 88};
    String[] floorName = {"ice", "packed-ice", "soul-sand"};
    for (int k = 0; k < 3; k++) {
      blocks = new int[][] {{52, -1, 40, 66, -1, 70, floorId[k], 0}};
      scenario("b33-" + floorName[k] + "-d3", 244 + k, 420, "VVzZZGK", arena, fight33);
      scenario("b33-" + floorName[k] + "-hunt-d3", 247 + k, 500, "VVzZZGK", farGolem, hunt33);
    }
    blocks = new int[][] {{58, 0, 40, 59, 1, 70, 30, 0}};
    scenario("b33-cobweb-d3", 250, 420, "VVzZZGK", arena, fight33);
    scenario("b33-cobweb-hunt-d3", 251, 500, "VVzZZGK", farGolem, hunt33);
    // Batch 33: Hard reinforcements in a lit world. EntityZombie.attackEntityFrom (yq.a) only places a reinforcement where getBlockLightValue < 10 (and the spot is solid, clear and its
    // chunks exist), so the same script as b32-reinforce-d3 at light 15 and 10 must summon nothing and at light 9 must summon like the dark world.
    blocks = new int[][] {}; difficulty = 3; reinforce = 1.0;
    for (int lv : new int[] {15, 10, 9}) { light = lv; scenario("b33-reinforce-light" + lv + "-d3", 260 + lv, 400, "VVzZZGK", arena, new String[] {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "80 hit 3 7 1.0 player", "100 hit 3 7 1.0 player", "120 hit 2 7 1.0 player", "150 hit 0 4 1.0 mob"}); }
    difficulty = 2; light = 15; reinforce = 0;
    // Batch 34 (names b34-*): these records read blocks through the real ChunkCache over real Chunks (chunkCache field of the record), and the finding is that the path search is NOT bounded by the region the
    // native PathFinder is given (radius (int)(followRange + 16) for a path to an entity, +8 for a block, whole chunk columns, y 0..255, air outside): ayg's open/blocked test (static func_82565_a) reads
    // entity.worldObj, not the cache, which only serves the swimming start loop. The ring records below were built to catch a region bound; they show there is none (a wall beyond the region still seals).
    blocks = new int[][] {}; difficulty = 3; light = 15; reinforce = 0;
    // A ring of 2-high stone around the villagers (x 16..64, z 30..74) with the zombies (range 40) west of it at 36 blocks: a zombie at x 4.5 has chunk columns -4..3 east to x 63, so the east
    // wall (x 64) and the corners beyond it are outside the cache region; a region-bounded search would find the ring open there, the native one does not (the wall counts).
    double[][] ringPos = {{40.5, 52.5}, {42.5, 54.5}, {4.5, 52.5}, {4.5, 56.5}, {4.5, 48.5}, {10.5, 10.5}, {60.5, 120.5}, {8.5, 52.5}};
    blocks = new int[][] {{16, 0, 30, 64, 1, 30, 1, 0}, {16, 0, 74, 64, 1, 74, 1, 0}, {16, 0, 30, 16, 1, 74, 1, 0}, {64, 0, 30, 64, 1, 74, 1, 0}};
    scenario("b34-ring-east-d3", 300, 700, "VVzZZGK", ringPos, new String[] {"250 hit 1 3 30.0 mob"});
    // the same ring seen from the east: the golem (range 16, region radius 24) cannot get round the ring's west wall because the wall beyond its region still counts; the zombies at x 70 flood the ring
    scenario("b34-ring-sealed-d3", 301, 700, "VVzZZGK", new double[][] {{40.5, 52.5}, {42.5, 54.5}, {70.5, 52.5}, {70.5, 56.5}, {70.5, 48.5}, {10.5, 10.5}, {60.5, 120.5}, {72.5, 52.5}}, new String[] {});
    // a villager in a closed 3x3 stone cell (roof at y 3): zombies at 30 and 38 blocks (inside the range 40, search floods), at 44 (outside: the search starts and ends at once)
    blocks = new int[][] {{47, 0, 51, 51, 2, 55, 1, 0}, {48, 0, 52, 50, 2, 54, 0, 0}, {47, 3, 51, 51, 3, 55, 1, 0}};
    scenario("b34-sealed-cell-d3", 302, 600, "VVzZZGK", new double[][] {{49.5, 53.5}, {49.5, 53.5}, {19.5, 53.5}, {11.5, 53.5}, {5.5, 53.5}, {10.5, 10.5}, {60.5, 120.5}, {8.5, 60.5}}, new String[] {});
    scenario("b34-sealed-cell-d2", 303, 600, "VVzZZGK", new double[][] {{49.5, 53.5}, {49.5, 53.5}, {19.5, 53.5}, {11.5, 53.5}, {5.5, 53.5}, {10.5, 10.5}, {60.5, 120.5}, {8.5, 60.5}}, new String[] {});
    // a fight across the chunk borders x 48 and x 64 (and z 48): one-block and two-block terrain ON the border columns, Normal and Hard
    for (int d = 2; d <= 3; d++) {
      difficulty = d;
      blocks = new int[][] {{63, 0, 40, 64, 0, 70, 1, 0}, {47, 0, 44, 48, 1, 47, 1, 0}, {47, 0, 58, 48, 1, 62, 1, 0}};
      scenario("b34-chunk-border-d" + d, 310 + d, 460, "VVzZZGK", arena, fight);
      scenario("b34-chunk-border-hunt-d" + d, 320 + d, 520, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt);
    }
    difficulty = 3;
    // Hard reinforcements (dark world, base 1.0 as b32-reinforce-d3): the same fight with every chunk loaded and with chunk columns x >= 80 not loaded (ChunkProviderServer.chunkExists false):
    // yq.a picks a site there, World.spawnEntityInWorld refuses the zombie and yq.a still charges both zombies and stops searching.
    blocks = new int[][] {}; light = 0; reinforce = 1.0;
    String[] reinfScript = {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "80 hit 3 7 1.0 player", "100 hit 3 7 1.0 player", "120 hit 2 7 1.0 player", "140 hit 3 7 1.0 player", "160 hit 2 7 1.0 player", "180 hit 3 7 1.0 player", "200 hit 0 4 1.0 mob"};
    for (int sd = 0; sd < 3; sd++) {
      unloadedChunks = new int[][] {};
      scenario("b34-reinforce-loaded-" + sd, 330 + sd, 420, "VVzZZGK", arena, reinfScript);
      java.util.List<int[]> east = new ArrayList<>();
      for (int cx = 5; cx <= 9; cx++) for (int cz = -2; cz <= 6; cz++) east.add(new int[] {cx, cz});
      unloadedChunks = east.toArray(new int[0][]);
      scenario("b34-reinforce-unloaded-" + sd, 330 + sd, 420, "VVzZZGK", arena, reinfScript);
    }
    unloadedChunks = new int[][] {}; light = 15; reinforce = 0;
    // cobblestone walls (renderType 32) and nether fences (113): a 1.5-high line with a gap at z 52 (zombies and the golem path through it or hop; nothing climbs a wall block)
    for (int k = 0; k < 2; k++) {
      int id = k == 0 ? 139 : 113; String nm = k == 0 ? "wall" : "nether-fence";
      blocks = new int[][] {{58, 0, 44, 58, 1, 60, id, 0}, {58, 0, 52, 58, 1, 52, 0, 0}};
      scenario("b34-" + nm + "-gap-d3", 340 + k, 460, "VVzZZGK", arena, fight33);
      blocks = new int[][] {{58, 0, 40, 58, 1, 70, id, 0}};
      scenario("b34-" + nm + "-closed-d3", 342 + k, 460, "VVzZZGK", arena, fight33);
      scenario("b34-" + nm + "-hunt-d3", 344 + k, 520, "VVzZZGK", farGolem, hunt33);
    }
    // arrows into cobweb: bow skeletons east of a web screen shoot at the player and villagers west of it (as b32-arrows-*)
    blocks = new int[][] {{60, 0, 48, 60, 2, 60, 30, 0}};
    scenario("b34-arrows-cobweb-d3", 350, 300, "VVGBBB", new double[][] {{54.5, 52.5}, {54.5, 54.5}, {10.5, 10.5}, {66.5, 52.5}, {66.5, 54.5}, {68.5, 53.5}, {52.5, 53.5}}, new String[] {"150 hit 3 6 1.0 player"});
    // mobs thrown into the air above a web pad: they fall into cobweb (Entity.isInWeb slows the fall to 5 %, and the web blocks a walk) while the fight goes on
    blocks = new int[][] {{58, 0, 48, 62, 2, 56, 30, 0}};
    scenario("b34-web-fall-d3", 351, 460, "VVzZZGK", arena, new String[] {"20 move 2 60.5 52.5 12", "30 move 3 59.5 50.5 9", "40 move 0 61.5 54.5 7", "60 move 4 58.5 54.5 20", "80 hit 3 7 5.0 player", "120 hit 3 7 5.0 player"});
    blocks = new int[][] {{58, 0, 48, 62, 0, 56, 30, 0}};
    scenario("b34-web-fall-shallow-d3", 352, 460, "VVzZZGK", arena, new String[] {"20 move 2 60.5 52.5 9", "30 move 3 59.5 50.5 6", "40 move 0 61.5 54.5 5", "80 hit 3 7 5.0 player", "120 hit 3 7 5.0 player"});
    // Batch 35 (names b35-*): the same real-ChunkCache arenas, plus the path point count of every native search (record field `searches`: [tick, points the PathFinder created, 1 if it returned a path]).
    // Stacked storeys: four stone slabs (y 3, 7, 11 on x 20..80, z 20..86; the probe floor y -1 is storey 0) joined by one-block step ramps through holes in the slabs, so every storey is a large walkable
    // plane inside a zombie's range-40 sphere around a target on the top storey. Step ramps (4 steps of 1 block) go 0 to 1 at x 34, 1 to 2 at x 60 and 2 to 3 at x 34 (z 40/60/60).
    difficulty = 3; light = 15; reinforce = 0; unloadedChunks = new int[][] {};
    java.util.function.IntFunction<int[][]> storeysOf = n -> {
      java.util.List<int[]> st = new ArrayList<>();
      for (int k = 1; k < n; k++) st.add(new int[] {20, 4 * k - 1, 20, 80, 4 * k - 1, 86, 1, 0});
      int[][] rampAt = {{34, 40}, {60, 60}, {34, 60}};
      for (int k = 0; k + 1 < n; k++) { int[] rp = rampAt[k % 3]; int y0 = 4 * k; st.add(new int[] {rp[0], y0 + 3, rp[1], rp[0] + 2, y0 + 3, rp[1] + 1, 0, 0}); for (int i = 0; i < 4; i++) st.add(new int[] {rp[0] + i, y0, rp[1], rp[0] + i, y0 + i, rp[1] + 1, 1, 0}); }
      return st.toArray(new int[0][]);
    };
    int[][] storeys = storeysOf.apply(4), tower = storeysOf.apply(7);
    // a sealed 3x3 stone cell on storey 1 (interior x 48..50, z 52..54, y 4..6; the slab above is its roof)
    java.util.function.IntFunction<int[][]> cellAt = y -> new int[][] {{47, y, 51, 51, y + 2, 55, 1, 0}, {48, y, 52, 50, y + 2, 54, 0, 0}};
    java.util.function.Function<int[][][], int[][]> cat = parts -> { java.util.List<int[]> all = new ArrayList<>(); for (int[][] p : parts) for (int[] b : p) all.add(b); return all.toArray(new int[0][]); };
    double[][] cellPos = {{49.5, 53.5, 4}, {49.5, 53.5, 4}, {27.5, 53.5}, {24.5, 56.5, 8}, {30.5, 50.5}, {10.5, 10.5}, {60.5, 120.5}, {8.5, 150.5}};
    // (A zombie only picks a target within 4 blocks above or below it, so the villagers sit one storey up and the zombies on the storeys beside them.)
    blocks = cat.apply(new int[][][] {storeys, cellAt.apply(4)});
    scenario("b35-storeys-sealed-d3", 400, 500, "VVzZZGK", cellPos, new String[] {"250 hit 1 3 30.0 mob"});
    // the same cell with a doorway (x 47, z 53, y 4..5 open): the zombies find the way up the ramps
    blocks = cat.apply(new int[][][] {storeys, cellAt.apply(4), new int[][] {{47, 4, 53, 47, 5, 53, 0, 0}}});
    scenario("b35-storeys-open-d3", 401, 600, "VVzZZGK", cellPos, new String[] {"250 hit 1 3 30.0 mob"});
    // zombies on the first storey hunting a player on the ground (a long way down the ramp) while the villagers stand beside them
    double[][] down = {{45.5, 53.5, 4}, {45.5, 56.5, 4}, {50.5, 70.5, 4}, {40.5, 70.5, 4}, {70.5, 70.5, 4}, {10.5, 10.5}, {60.5, 120.5}, {30.5, 53.5}};
    blocks = storeys;
    scenario("b35-storeys-down-d3", 402, 600, "VVzZZGK", down, new String[] {"0 walk 7 0.05 0.02", "120 walk 7 0 0", "250 hit 1 3 30.0 mob"});
    scenario("b35-storeys-down-d2", 403, 600, "VVzZZGK", down, new String[] {"0 walk 7 0.05 0.02", "120 walk 7 0 0", "250 hit 1 3 30.0 mob"});
    // a seven-storey tower (the sphere of range 40 around a sealed villager on storey 3 holds seven walkable planes): the largest realistic flood
    double[][] towerPos = {{49.5, 53.5, 12}, {49.5, 53.5, 12}, {27.5, 53.5, 8}, {24.5, 56.5, 16}, {30.5, 50.5, 12}, {10.5, 10.5}, {60.5, 120.5}, {8.5, 150.5}};
    blocks = cat.apply(new int[][][] {tower, cellAt.apply(12)});
    scenario("b35-tower-sealed-d3", 404, 500, "VVzZZGK", towerPos, new String[] {"250 hit 1 3 30.0 mob"});
    // Zombie follow range. EntityZombie.onSpawnWithEgg adds a "Random zombie-spawn bonus" (operation 2, d0 = nextDouble * 1.5 * local difficulty, kept above 1) on top of the spawn bonus, so a Hard zombie in a well-played chunk has
    // followRange (40 + bonus) * (1 + d0): about 80 to 130, not 40 to 45. A zombie then searches a sphere of that radius around a sealed target: the record sets generic.followRange (field `follow`) on every zombie.
    blocks = new int[][] {{47, 0, 51, 51, 2, 55, 1, 0}, {48, 0, 52, 50, 2, 54, 0, 0}, {47, 3, 51, 51, 3, 55, 1, 0}};
    double[][] farSealed = {{49.5, 53.5}, {49.5, 53.5}, {49.5, 120.5}, {-30.5, 53.5}, {49.5, 190.5}, {10.5, 10.5}, {60.5, 120.5}, {8.5, 150.5}};
    for (double fr : new double[] {80, 100, 130}) {
      follow = fr;
      scenario("b35-follow" + (int) fr + "-sealed-d3", 410 + (int) fr, 300, "VVzZZGK", farSealed, new String[] {"150 hit 1 3 30.0 mob"});
    }
    follow = 0;
    blocks = new int[][] {};
    difficulty = 2;
    // Batch 36 (names b36-*): EntityZombie.onSpawnWithEgg's chicken jockeys. "t spawn x z y yaw" places a zombie, calls World.spawnEntityInWorld and then onSpawnWithEgg(null); the child roll (World.rand nextFloat < 0.05)
    // and the jockey rolls that follow are on World.rand, which VillageLiveProbe.newCollection seeds with the record's seed. The seeds below were found with the port's own draw order and are confirmed by the record
    // (`spawns`: [tick, spawned, child, 0 none / 1 nearby chicken / 2 new chicken, nearby chicken index, new chicken spawned, zombie Entity.rand seed]). Chickens (C) lay on the egg timer set by `egg`.
    difficulty = 3; light = 15; reinforce = 0; unloadedChunks = new int[][] {}; blocks = new int[][] {}; follow = 0;
    java.util.List<int[]> eastGone = new ArrayList<>();
    for (int cx = 5; cx <= 9; cx++) for (int cz = -2; cz <= 6; cz++) eastGone.add(new int[] {cx, cz});
    int[][] east = eastGone.toArray(new int[0][]);
    eggTimer = 90;
    double[][] nearChickens = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {46.5, 51.5}, {52.5, 80.5}, {76.5, 61.5}, {73.5, 58.5}, {62.5, 58.5}}; // chickens 5 blocks from the spawn site (75.5, 60.5), one of them half a block above ground level of the other
    double[][] farChickens = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {46.5, 51.5}, {52.5, 80.5}, {76.5, 70.5}, {70.5, 52.5}, {62.5, 58.5}};
    double[][] eastChickens = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {46.5, 51.5}, {52.5, 80.5}, {91.5, 61.5}, {88.5, 58.5}, {62.5, 58.5}};
    String[] jockeyOps = {"3 spawn 75.5 60.5 0 90"}, eastOps = {"3 spawn 90.5 60.5 0 90"};
    scenario("b36-jockey-nearby-d3", 218, 300, "VVZGKCC", nearChickens, jockeyOps);
    scenario("b36-jockey-nearby-none-d3", 113, 300, "VVZGKCC", farChickens, jockeyOps);
    scenario("b36-jockey-new-d3", 668, 300, "VVZGKCC", farChickens, jockeyOps);
    unloadedChunks = east;
    scenario("b36-jockey-new-unloaded-d3", 668, 300, "VVZGKCC", eastChickens, eastOps);
    scenario("b36-jockey-nearby-unloaded-d3", 113, 300, "VVZGKCC", eastChickens, eastOps);
    unloadedChunks = new int[][] {};
    eggTimer = 6000; difficulty = 3;
    // Held-item swaps: EntityLivingBase.onUpdate compares each slot with the previous update's stack and moves the item's attribute modifiers (a sword's +4 damage and material bonus) in or out of the attribute map before
    // onLivingUpdate. "equip" (before the tick) takes effect in that mob's update of the same tick, "equipmid k i item" (after mob k's update, as a loot pickup does) in its next one.
    blocks = new int[][] {};
    String[] swords = {"0 walk 7 -0.08 -0.04", "60 walk 7 0 0", "20 equip 3 276", "70 equipmid 2 4 267", "80 hit 3 7 5.0 player", "120 hit 3 7 5.0 player", "130 equip 3 0", "135 equipmid 3 3 268", "150 hit 0 4 1.0 mob", "200 equip 4 0", "210 equip 4 272", "260 equipmid 4 2 276"};
    scenario("b36-sword-swap-d3", 4600, 360, "VVzZZGK", arena, swords);
    scenario("b36-sword-swap-d2", 4601, 360, "VVzZZGK", arena, swords);
    // a skeleton with a sword melees (AttackOnCollide 1.2) and swaps it for nothing and back mid-fight, hurting the player it reaches
    scenario("b36-sword-skeleton-d3", 4602, 320, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 51.5}, {58.5, 58.5}, {60.5, 60.5}}, new String[] {"0 equip 6 267", "60 equip 6 276", "120 equip 6 0", "160 equip 6 268", "220 equipmid 5 6 276"});
    difficulty = 3;
    // Gates and doors on slopes. The east half (x 58..80, z 40..70) is raised one block (stone at y 0, mobs stand at y 1), so every approach to the villagers is a one-block step.
    int[][] plateau = {{58, 0, 40, 80, 0, 70, 1, 0}};
    double[][] up = {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5, 1}, {68.5, 55.5, 1}, {62.5, 47.5, 1}, {46.5, 51.5}, {52.5, 80.5}, {62.5, 58.5, 1}};
    // a fence line standing on the plateau (x 62) with a gate at z 52: closed (go round, or hop the step), open
    for (int k = 0; k < 2; k++) {
      String g = k == 0 ? "closed" : "open";
      blocks = cat.apply(new int[][][] {plateau, new int[][] {{62, 1, 44, 62, 2, 60, 85, 0}, {62, 1, 52, 62, 2, 52, 0, 0}, {62, 1, 52, 62, 1, 52, 107, k == 0 ? 1 : 5}}});
      scenario("b36-slope-gate-" + g + "-d3", 4610 + k, 460, "VVzZZGK", up, fight33);
      scenario("b36-slope-gate-" + g + "-hunt-d3", 4612 + k, 520, "VVzZZGK", new double[][] {{52.5, 52.5}, {54.5, 52.5}, {64.5, 51.5, 1}, {68.5, 55.5, 1}, {62.5, 47.5, 1}, {10.5, 10.5}, {52.5, 80.5}, {62.5, 58.5, 1}}, hunt33);
    }
    // a gate on the step itself (the fence line on the plateau's edge column x 58, the gate at z 52 on the plateau) and a gate one block below the plateau (ground level, x 56) with zombies coming off the step
    blocks = cat.apply(new int[][][] {plateau, new int[][] {{58, 1, 44, 58, 2, 60, 85, 0}, {58, 1, 52, 58, 2, 52, 0, 0}, {58, 1, 52, 58, 1, 52, 107, 5}}});
    scenario("b36-slope-gate-edge-d3", 4614, 460, "VVzZZGK", up, fight33);
    blocks = cat.apply(new int[][][] {plateau, new int[][] {{56, 0, 44, 56, 1, 60, 85, 0}, {56, 0, 52, 56, 1, 52, 0, 0}, {56, 0, 52, 56, 0, 52, 107, 1}}});
    scenario("b36-slope-gate-foot-d3", 4615, 460, "VVzZZGK", up, fight33);
    // the villagers' house on a raised base: x 47..58 stone at y 0, walls y 1..3 on x 49..56, z 49..56, the door at x 56 z 52 (y 1 and 2) one block above the ground outside; the zombies outside climb the step
    int[][] baseHouse = {{47, 0, 47, 58, 0, 58, 1, 0}, {49, 1, 49, 56, 3, 49, 4, 0}, {49, 1, 56, 56, 3, 56, 4, 0}, {49, 1, 50, 49, 3, 55, 4, 0}, {56, 1, 50, 56, 3, 55, 4, 0}, {49, 4, 49, 56, 4, 56, 4, 0}};
    double[][] inHouse = {{52.5, 52.5, 1}, {54.5, 53.5, 1}, {64.5, 51.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 40.5}, {52.5, 80.5}, {62.5, 58.5}};
    for (int k = 0; k < 2; k++) {
      blocks = cat.apply(new int[][][] {baseHouse, new int[][] {{56, 1, 52, 56, 1, 52, 64, k == 0 ? 0 : 4}, {56, 2, 52, 56, 2, 52, 64, 8}}});
      scenario("b36-slope-door-" + (k == 0 ? "closed" : "open") + "-d3", 4616 + k, 500, "VVzZZGK", inHouse, hunt33);
    }
    // a ramp of three one-block steps up to the plateau door: the zombie that breaks doors (Hard) and the others
    blocks = cat.apply(new int[][][] {baseHouse, new int[][] {{56, 1, 52, 56, 1, 52, 64, 0}, {56, 2, 52, 56, 2, 52, 64, 8}, {57, 1, 52, 58, 1, 52, 1, 0}}});
    scenario("b36-slope-door-step-d3", 4618, 500, "VVzZZGK", new double[][] {{52.5, 52.5, 1}, {54.5, 53.5, 1}, {64.5, 52.5}, {68.5, 55.5}, {62.5, 47.5}, {46.5, 40.5}, {52.5, 80.5}, {62.5, 58.5}}, hunt33);
    // villagers fleeing across storeys (b35's slabs and ramps): zombies on the villagers' storey (1), below (0) and above (2); the golem is a long way off
    blocks = storeysOf.apply(3);
    double[][] flee = {{45.5, 53.5, 4}, {47.5, 56.5, 4}, {52.5, 53.5, 4}, {45.5, 62.5, 0}, {46.5, 50.5, 8}, {10.5, 10.5}, {60.5, 120.5}, {30.5, 53.5}};
    scenario("b36-flee-storeys-d3", 4620, 420, "VVzZZGK", flee, new String[] {"0 walk 7 0.05 0.02", "120 walk 7 0 0"});
    scenario("b36-flee-storeys-hit-d3", 4621, 420, "VVzZZGK", flee, new String[] {"0 walk 7 0.05 0.02", "120 walk 7 0 0", "150 hit 1 3 30.0 mob"});
    blocks = storeysOf.apply(3);
    scenario("b36-flee-ramp-d3", 4622, 500, "VVzZZGK", new double[][] {{33.5, 41.5, 4}, {35.5, 44.5, 4}, {36.5, 40.5, 4}, {30.5, 40.5, 0}, {37.5, 47.5, 8}, {10.5, 10.5}, {60.5, 120.5}, {30.5, 53.5}}, new String[] {"0 walk 7 0.05 0.02", "120 walk 7 0 0"});
    blocks = new int[][] {};
    // Batch 37 (names b37-*): see the scenarios below.
    difficulty = 3; blocks = new int[][] {}; eggTimer = 90;
    scenario("b37-chicken-wander-1406", 1406, 300, "VVZGKCC", nearChickens, new String[] {});
    scenario("b37-jockey-nearby-113-d3", 113, 300, "VVZGKCC", nearChickens, jockeyOps);
    // Chicken wander targets underground: the probe floor (y < 0) is stone, so every try has the same getBlockPathWeight (brightness - 0.5) and the first one wins, a target below the mob when its dy is negative; the partial path
    // goes to the reachable cell nearest the target. (The port replays this world with a stone floor: its first replay floor was the port's grass id 1, which made tries with a floor under them weigh 10.)
    for (int sd : new int[] {1401, 1402, 1408, 1413}) scenario("b37-chicken-wander-" + sd, sd, 300, "VVZGKCC", nearChickens, new String[] {});
    // the same two seeds over a grass patch (the weight of a try with grass below it is 10, so those tries win over stone ones)
    blocks = new int[][] {{58, -1, 48, 90, -1, 70, 2, 0}};
    for (int sd : new int[] {1402, 1413}) scenario("b37-chicken-wander-grass-" + sd, sd, 300, "VVZGKCC", nearChickens, new String[] {});
    blocks = new int[][] {};
    // Skeleton spider jockeys: "t spawnspider x z y yaw" (SpawnerAnimals' order). World.rand rolls the 1-in-100 jockey first; on Hard a roll below 0.1 * regional difficulty (record field `local`; 0 in the other records) gives the spider a potion effect.
    // Seeds were found with the port's draw order and are confirmed by the records (`mobs`: [tick, 0 spider / 1 skeleton, x, y, z, Entity.rand seed, yaw, mount's index among them, movement speed, health]).
    double[][] spiderArena = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {36.5, 100.5}, {46.5, 51.5}, {52.5, 80.5}, {10.5, 10.5}, {62.5, 58.5}};
    double[][] spiderFarGolem = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {10.5, 130.5}, {46.5, 51.5}, {52.5, 80.5}, {10.5, 10.5}, {62.5, 58.5}};
    String[] spiderOps = {"3 spawnspider 30.5 100.5 0 90"};
    // (the jockey and effect seeds were found with the port's replay of this world, whose World.rand has drawn before the spawn tick; the records confirm them)
    difficulty = 2;
    scenario("b37-spider-jockey-d2-47", 47, 80, "VVZGKKK", spiderFarGolem, spiderOps);
    difficulty = 3; local = 1.5;
    scenario("b37-spider-jockey-speed-2231", 2231, 80, "VVZGKKK", spiderFarGolem, spiderOps);
    scenario("b37-spider-jockey-regen-1713", 1713, 80, "VVZGKKK", spiderFarGolem, spiderOps);
    scenario("b37-spider-jockey-invisible-972", 972, 80, "VVZGKKK", spiderFarGolem, spiderOps);
    scenario("b37-spider-jockey-strength-1003", 1003, 80, "VVZGKKK", spiderFarGolem, spiderOps);
    scenario("b37-spider-effect-nojockey-4", 4, 80, "VVZGKKK", spiderFarGolem, spiderOps);
    // the golem inside its village walks to a spider at the village edge (its target selector takes any IMob inside its home area) and hits it: the spider's motion, health and the skeleton riding it follow
    double[][] spiderVillage = {{52.5, 52.5}, {54.5, 52.5}, {66.5, 51.5}, {47.5, 46.5}, {46.5, 51.5}, {52.5, 80.5}, {10.5, 10.5}, {66.5, 70.5}};
    scenario("b37-spider-jockey-golem-1713", 1713, 80, "VVZGKKK", spiderVillage, new String[] {"3 spawnspider 40.5 46.5 0 90", "30 hitmob 1 2.0 player", "50 hitmob 1 1.0 player"});
    local = 0; difficulty = 2;
    eggTimer = 6000; difficulty = 2;
    difficulty = 2;
    // 15 small player hits on a villager reach reputation -15: the golem then targets the player; killing the golem costs another 5; a second name takes over the reputation key
    scenario("player-turns-aggressive", 0, 700, open, new String[] {"10 hit 0 7 0.1 player", "31 hit 0 7 0.1 player", "52 hit 0 7 0.1 player", "73 hit 0 7 0.1 player", "94 hit 0 7 0.1 player", "115 hit 0 7 0.1 player", "136 hit 0 7 0.1 player", "157 hit 0 7 0.1 player",
      "178 hit 0 7 0.1 player", "199 hit 0 7 0.1 player", "220 hit 0 7 0.1 player", "241 hit 0 7 0.1 player", "262 hit 0 7 0.1 player", "283 hit 0 7 0.1 player", "304 hit 0 7 0.1 player", "330 move 7 50.5 56.5", "500 hit 4 7 300.0 player", "600 rename alt", "610 hit 1 7 0.1 player"});
  }
}
