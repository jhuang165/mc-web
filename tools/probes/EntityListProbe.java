import java.util.*;

// Batch 44 adds minecarts (EntityMinecartEmpty xs), boats (xi), paintings (tb, the 100-tick onValidSurface check), potions (zo), snowballs (zj) and wither skulls (zp)
// and the riding rule of World.updateEntities (a rider is skipped in the loop and updated right after its mount, through updateRidden). Entities spawned in
// the pass (a broken painting's item) are listed per tick after the main states.
// Batch 43: World.updateEntities walks ONE loadedEntityList in insertion order. This probe puts the real, unchanged EntityItem (xk), EntityTNTPrimed (xw),
// EntityArrow (zc), EntityXPOrb (sq) and a mob on a map-backed World double (XpOrbProbe.XW: blocks, collision boxes, the entity queries over one list) and
// walks that list by index exactly as World.updateEntities does (ticksExisted++ then onUpdate; an entity spawned in the pass joins the end and updates in it;
// setDead entities leave at the end of their own turn in the pass here: the list is swept after the pass). The same scenario is run with the entities
// listed in different orders (an entity's `join` tick says when it is added), so the record shows what the order decides.
// Row per tick: [per entity (creation order): x, y, z, vx, vy, vz, isDead, then kind fields] (item: count, age, delay; tnt: fuse; arrow: inGround, ticksInAir;
// orb: age, value; mob: health), explosions [x, y, z, power].
public class EntityListProbe {
  static List<String> booms = new ArrayList<>();
  static List<sa> extras = new ArrayList<>();
  public static class EW extends XpOrbProbe.XW {
    EW() { super(); }
    public float n(int x, int y, int z) { return 1.0f; } // World.getLightBrightness: light 15 everywhere (a wandering mob reads it)
    public int k(int x, int y, int z) { return 15; }
    public boolean d(sa e) { // World.spawnEntityInWorld: the end of loadedEntityList
      if (e instanceof xk) { e.v = 0; e.w = 0.2; e.x = 0; } // EntityItem's constructor draws the sideways motion from Math.random: fixed here (the replay passes the same motion)
      if (e instanceof sq) { e.v = 0; e.w = 0.2; e.x = 0; } // EntityXPOrb's constructor draws its motion from Math.random: fixed here (the replay passes the same motion)
      if (e instanceof wg) hatchling(e); // an EntityEgg's chick: its own Random seeded like the other entities, no AI task list
      entities.add(e); extras.add(e); return true;
    }
    // World.getCollidingBoundingBoxes: the blocks, then the entity boxes within 0.25 (getBoundingBox for a boat, getCollisionBox for the mover): carts and boats only
    public List a(sa entity, azt box) {
      List out = super.a(entity, box);
      List list = b(entity, box.b(0.25, 0.25, 0.25));
      for (Object o : list) {
        azt bb = ((sa) o).J();
        if (bb != null && bb.b(box)) out.add(bb);
        bb = entity.h((sa) o);
        if (bb != null && bb.b(box)) out.add(bb);
      }
      return out;
    }
    public List a(Class c, azt box) { return a(c, box, (sj) null); }
    public List a(Class c, azt box, sj selector) {
      List out = new ArrayList();
      for (sa o : entities) if (c.isInstance(o) && !o.K && o.C.b(box) && (selector == null || selector.a(o))) out.add(o);
      return out;
    }
    public List a(sa entity, azt box, sj selector) {
      List out = new ArrayList();
      for (sa o : entities) if (o != entity && !o.K && o.C.b(box) && (selector == null || selector.a(o))) out.add(o);
      return out;
    }
    public agw a(sa e, double x, double y, double z, float power, boolean flaming, boolean smoking) {
      booms.add("[" + num(x) + "," + num(y) + "," + num(z) + "," + num(power) + "]");
      agw ex = new agw(this, e, x, y, z, power);
      ex.a(); // Explosion.doExplosionA: damages and pushes the entities in the list; the block part (doExplosionB) is not needed here
      return ex;
    }
  }
  // The chick of EntityEgg.onImpact (EntityChicken wg): Entity.rand is unseeded, so it is set to Random(7) like every entity here, and its AI task lists are emptied
  // (a cow's updateAITasks is switched off the same way); its motion, friction and living update run unchanged.
  static void hatchling(sa e) {
    try {
      PlayerStepProbe.field(sa.class, "Z").set(e, new Random(7));
      for (java.lang.reflect.Field f : sw.class.getDeclaredFields()) if (f.getType().getName().equals("rw") || f.getType().getName().equals("ru")) { f.setAccessible(true); Object tasks = f.get(e); if (tasks != null) for (java.lang.reflect.Field g : tasks.getClass().getDeclaredFields()) if (List.class.isAssignableFrom(g.getType())) { g.setAccessible(true); ((List) g.get(tasks)).clear(); } }
    } catch (Exception x) { throw new RuntimeException(x); }
  }
  // EntityCow with updateAITasks (sw.bn: the AI task list, the random wander) switched off; its motion, friction, knockback, hurt and death run unchanged.
  static class Cow extends wh { Cow(ahb w) { super(w); } protected void bn() {} }
  // The player of the orb scenarios: an EntityPlayerSP shell (XpOrbProbe.Target) whose addExperience and onItemPickup only count.
  static class P extends XpOrbProbe.Target { P() { super(); } int xp; public void v(int n) { xp += n; } public void a(sa e, int n) {} }
  // The thrower of the player-thrown scenarios: an EntityPlayerSP shell (eye height 1.62) whose capabilities say whether it is in Creative.
  static class Th extends XpOrbProbe.Target { Th() { super(); } }
  // The thrower of the teleport scenarios: a real EntityPlayerMP subclass (allocated, not constructed: the constructor needs a server). Its connection answers isChannelOpen; attackEntityFrom only
  // counts the damage (the real one reads MinecraftServer), the pearl's own teleport (mw.setPositionAndUpdate, nh.setPlayerLocation, mw.setPositionAndRotation with its collision push-up) runs unchanged, and the 5.0F fall hit is counted. Needs netty-all 4.0.x (ej's class initialiser).
  static class Ej extends ej { Ej() { super(false); } public boolean d() { return true; } }
  static class Nh extends nh { Ej ej; Nh() { super(null, null, null); } public ej b() { return ej; } public void a(ft packet) {} } // sendPacket: nothing to send to
  static class Sp extends mw { double dmg; Sp() { super(null, null, null, null); } public boolean a(ro src, float amount) { dmg += amount; return true; } }
  static boolean detail = false; // the pthrow scenarios append the cart's and boat's damage to their state (older records keep their bytes)
  static String num(double v) { return Double.toString(v); }
  static String q(String s) { return "\"" + s + "\""; }

  // spec: kind x y z vx vy vz a b join
  static sa make(EW w, String[] s) throws Exception {
    double x = Double.parseDouble(s[1]), y = Double.parseDouble(s[2]), z = Double.parseDouble(s[3]);
    sa e;
    switch (s[0]) {
      case "item": { xk it = new xk(w, x, y, z, new add(aji.e(Integer.parseInt(s[10])), Integer.parseInt(s[7]), 0)); it.a = Integer.parseInt(s[8]); it.b = 0; e = it; break; }
      case "tnt": { xw t = new xw(w, x, y, z, null); t.a = Integer.parseInt(s[7]); e = t; break; }
      case "arrow": e = new zc(w, x, y, z); break;
      case "orb": e = new sq(w, x, y, z, Integer.parseInt(s[7])); break;
      case "cow": e = new Cow(w); break;
      case "cart": e = new xs(w, x, y, z); PlayerStepProbe.field(sa.class, "c").setInt(e, 1); break; // EntityMinecartEmpty (id set as VehicleProbe does)
      case "boat": { xi bt = new xi(w, x, y, z); bt.y = Float.parseFloat(s[7]); bt.A = bt.y; PlayerStepProbe.field(sa.class, "c").setInt(bt, 1); e = bt; break; }
      case "painting": { HangingProbe.seed = 1; HangingProbe.P pt = new HangingProbe.P(w, (int) x, (int) y, (int) z, Integer.parseInt(s[7])); PlayerStepProbe.field(ss.class, "e").setInt(pt, Integer.parseInt(s[8])); e = pt; break; }
      case "potion": e = new zo(w, x, y, z, Integer.parseInt(s[7])); break; // EntityPotion (a dispenser's form: no thrower)
      case "snowball": e = new zj(w, x, y, z); break;
      case "pthrow": { // a snowball (0), egg (1), ender pearl (2), potion (3) thrown by a player shell: the constructor takes the thrower (EntityThrowable(World, EntityLivingBase)); b = 1 for a Creative thrower
        boolean mp = s[8].equals("2"); // b = 2: a real EntityPlayerMP subclass as the thrower (a pearl's teleport branch), Survival
        yz t = mp ? (yz) PlantProbe.unsafe.allocateInstance(Sp.class) : (yz) PlantProbe.unsafe.allocateInstance(Th.class);
        t.o = w; t.s = 0.0; t.t = 0.0; t.u = 0.0; t.y = 0f; t.z = 0f;
        yw cap = new yw(); cap.d = s[8].equals("1"); t.bE = cap;
        if (mp) { // an open connection: EntityEnderPearl.onImpact asks mw.playerNetServerHandler.netManager.isChannelOpen()
          Ej ej = (Ej) PlantProbe.unsafe.allocateInstance(Ej.class); Nh nh = (Nh) PlantProbe.unsafe.allocateInstance(Nh.class); nh.ej = ej; nh.b = (mw) t; ((mw) t).a = nh; // nh.a (setPlayerLocation) then runs unchanged: mw.setPositionAndRotation
          PlayerStepProbe.field(sa.class, "C").set(t, azt.a(0.0, 0.0, 0.0, 0.0, 0.0, 0.0));
        }
        int type = Integer.parseInt(s[7]);
        e = type == 0 ? new zj(w, t) : type == 1 ? new zl(w, t) : type == 2 ? new zm(w, t) : type == 4 ? new zn(w, t) : new zo(w, t, 32732);
        if (s.length > 10) { PlayerStepProbe.field(sa.class, "Z").set(e, new Random(Long.parseLong(s[10]))); e.b(x, y, z); e.v = Double.parseDouble(s[4]); e.w = Double.parseDouble(s[5]); e.x = Double.parseDouble(s[6]); return e; } // a seeded Entity.rand (the egg's hatch roll)
        break;
      }
      case "skull": e = new zp(w, x, y, z, Double.parseDouble(s[4]), Double.parseDouble(s[5]), Double.parseDouble(s[6])); break; // EntityFireball(World, x, y, z, ax, ay, az): the aim normalised to 0.1, no noise
      default: throw new RuntimeException(s[0]);
    }
    PlayerStepProbe.field(sa.class, "Z").set(e, new Random(7));
    if (s[0].equals("painting") || s[0].equals("skull")) return e; // placed by their constructors; a fireball starts with no motion
    e.b(x, y, z); // setPosition: the entity constructors differ in yOffset use; the listed point is the feet/box position as the port's records use it
    e.v = Double.parseDouble(s[4]); e.w = Double.parseDouble(s[5]); e.x = Double.parseDouble(s[6]);
    return e;
  }
  static String state(sa e) throws Exception {
    StringBuilder b = new StringBuilder("[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + (e.K ? 1 : 0));
    if (e instanceof xk) b.append("," + ((xk) e).f().b + "," + ((xk) e).a + "," + ((xk) e).b);
    else if (e instanceof xw) b.append("," + ((xw) e).a);
    else if (e instanceof zc) b.append("," + (PlayerStepProbe.field(zc.class, "i").getBoolean(e) ? 1 : 0) + "," + ((zc) e).b);
    else if (e instanceof sq) b.append("," + ((sq) e).a + "," + ((sq) e).f());
    else if (e instanceof sv) b.append("," + ((sv) e).aS());
    else if (e instanceof xl) b.append("," + num(e.y) + "," + num(e.z) + (detail ? "," + num(((xl) e).j()) + "," + ((xl) e).k() + "," + ((xl) e).l() : ""));
    else if (e instanceof xi) b.append("," + num(e.y) + "," + num(((xi) e).f()) + (detail ? "," + num(((xi) e).e()) : ""));
    else if (e instanceof zp) b.append("," + (((zp) e).f() ? 1 : 0));
    if (e instanceof zm && detail && ((zm) e).j() instanceof Sp) { Sp p = (Sp) ((zm) e).j(); b.append("," + num(p.s) + "," + num(p.t) + "," + num(p.u) + "," + num(p.dmg)); } // the thrower after the pearl: where it stands and the fall damage it took
    return b.append("]").toString();
  }
  // World.updateEntityWithOptionalForce: lastTickPos and prevRotation, ticksExisted++, then updateRidden (a rider) or onUpdate; the rider of this entity is updated right after it
  static void update(sa e) {
    e.S = e.s; e.T = e.t; e.U = e.u; e.A = e.y; e.B = e.z;
    e.aa++;
    if (e.m != null) e.ab(); else e.h();
    if (e.l != null) {
      if (e.l.K || e.l.m != e) { e.l.m = null; e.l = null; } else update(e.l);
    }
  }
  static EW newWorld() throws Exception {
    EW w = (EW) PlantProbe.unsafe.allocateInstance(EW.class);
    MobMoveProbe.set(w, "t", PlantProbe.unsafe.allocateInstance(aqq.class));
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    MobMoveProbe.field(ahb.class, "E").setBoolean(w, false);
    MobMoveProbe.field(ahb.class, "h").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "L").set(w, new ArrayList());
    MobMoveProbe.field(ahb.class, "u").set(w, new ArrayList()); // worldAccesses: World.spawnParticle walks it
    w.cells = new HashMap<>();
    w.entities = new ArrayList<>();
    Object info = PlantProbe.unsafe.allocateInstance(ays.class); // the world info of the game rules: a skull's explosion reads mobGriefing
    MobMoveProbe.set(info, "x", new agy());
    MobMoveProbe.set(w, "x", info);
    ((agy) w.O()).a("mobGriefing", "true");
    booms.clear();
    extras.clear();
    return w;
  }
  static void scenario(String name, int ticks, String[]... specs) throws Exception {
    if (System.getenv("EL_ONLY") != null && !name.contains(System.getenv("EL_ONLY"))) return;
    detail = name.startsWith("pthrow");
    EW w = newWorld();
    List<String[]> ents = new ArrayList<>(), sets = new ArrayList<>();
    for (String[] sp : specs) {
      if (sp[0].equals("wall")) for (int[] c : HangingProbe.plane(Integer.parseInt(sp[7]), Integer.parseInt(sp[1]), Integer.parseInt(sp[2]), Integer.parseInt(sp[3]))) w.put(c[0], c[1], c[2], c[3], c[4]);
      else if (sp[0].equals("set") && Integer.parseInt(sp[9]) < 0) w.put(Integer.parseInt(sp[1]), Integer.parseInt(sp[2]), Integer.parseInt(sp[3]), Integer.parseInt(sp[7]), 0); // before the entities exist
      else if (sp[0].equals("set")) sets.add(sp); // a block change at the start of tick `join`
      else ents.add(sp);
    }
    List<sa> all = new ArrayList<>();
    int[] join = new int[ents.size()];
    for (int i = 0; i < ents.size(); i++) { all.add(make(w, ents.get(i))); join[i] = Integer.parseInt(ents.get(i)[9]); }
    for (int i = 0; i < ents.size(); i++) if (ents.get(i)[0].equals("cow") && !ents.get(i)[8].equals("0")) all.get(i).a(all.get(Integer.parseInt(ents.get(i)[8]) - 1)); // Entity.mountEntity
    List<String> rows = new ArrayList<>();
    P player = null;
    for (String[] sp : ents) if (sp[0].equals("orb")) { player = (P) PlantProbe.unsafe.allocateInstance(P.class); player.o = w; player.s = 0.5; player.t = 0.0; player.u = 0.5; PlayerStepProbe.field(sa.class, "C").set(player, azt.a(0.2, 0.0, 0.2, 0.8, 1.8, 0.8)); }
    for (int t = 0; t < ticks; t++) {
      for (String[] st : sets) if (Integer.parseInt(st[9]) == t) w.put(Integer.parseInt(st[1]), Integer.parseInt(st[2]), Integer.parseInt(st[3]), Integer.parseInt(st[7]), 0);
      for (int i = 0; i < all.size(); i++) if (join[i] == t) w.entities.add(all.get(i));
      booms.clear();
      for (int i = 0; i < w.entities.size(); i++) { // the list is walked by index: an entity spawned in the pass joins the end and updates in it
        sa e = w.entities.get(i);
        if (e.m != null) { // World.updateEntities: a rider is updated right after its mount; a dead or released mount frees it
          if (!e.m.K && e.m.l == e) continue;
          e.m.l = null; e.m = null;
        }
        if (!e.K) update(e);
      }
      w.entities.removeIf(e -> e.K);
      if (player != null) { // the network tick after the world's entities: EntityPlayer.onUpdate counts xpCooldown down, onLivingUpdate collides with the entities around (list order)
        if (player.bt > 0) player.bt--;
        for (Object o : w.b(player, player.C.b(1.0, 0.5, 1.0))) if (!((sa) o).K) ((sa) o).b_(player);
        w.entities.removeIf(e -> e.K);
      }
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < all.size(); i++) row.append(i > 0 ? "," : "").append(state(all.get(i)));
      row.append("],[").append(String.join(",", booms)).append("],").append(player == null ? "[]" : "[" + player.xp + "," + player.bt + "]").append(",[");
      for (int i = 0; i < extras.size(); i++) row.append(i > 0 ? "," : "").append(state(extras.get(i))); // entities spawned in a pass (spawn order, dead ones frozen)
      row.append("]]");
      rows.add(row.toString());
    }
    StringBuilder sp = new StringBuilder();
    for (String[] s : specs) sp.append(sp.length() > 0 ? "," : "").append("[").append(String.join(",", Arrays.stream(s).map(v -> v.matches("-?[0-9.]+") ? v : q(v)).toArray(String[]::new))).append("]");
    System.out.println("{\"case\":\"entity-list\",\"name\":" + q(name) + ",\"ticks\":" + ticks + ",\"specs\":[" + sp + "],\"rows\":[" + String.join(",", rows) + "]}");
  }
  // kind x y z vx vy vz a b join [block]
  static String[] item(double x, double y, double z, double vx, int count, int age, int join) { return new String[] {"item", "" + x, "" + y, "" + z, "" + vx, "0", "0", "" + count, "" + age, "" + join, "1"}; }
  static String[] cow(double x, double y, double z, double vx, int join) { return new String[] {"cow", "" + x, "" + y, "" + z, "" + vx, "0", "0", "0", "0", "" + join}; }
  static String[] arrow(double x, double y, double z, double vx, double vy, double vz, int join) { return new String[] {"arrow", "" + x, "" + y, "" + z, "" + vx, "" + vy, "" + vz, "0", "0", "" + join}; }
  static String[] orb(double x, double y, double z, int value, int join) { return new String[] {"orb", "" + x, "" + y, "" + z, "0", "0", "0", "" + value, "0", "" + join}; }
  static String[] tnt(double x, double y, double z, int fuse, int join) { return new String[] {"tnt", "" + x, "" + y, "" + z, "0", "0", "0", "" + fuse, "0", "" + join}; }

  // Batch 44 kinds. cow: b = 1 + the index (among the entity specs) of the vehicle it rides, 0 for none
  static String[] rider(double x, double y, double z, int vehicle, int join) { return new String[] {"cow", "" + x, "" + y, "" + z, "0", "0", "0", "0", "" + (vehicle + 1), "" + join}; }
  static String[] cart(double x, double y, double z, double vx, double vz, int join) { return new String[] {"cart", "" + x, "" + y, "" + z, "" + vx, "0", "" + vz, "0", "0", "" + join}; }
  static String[] boat(double x, double y, double z, double vx, double yaw, int join) { return new String[] {"boat", "" + x, "" + y, "" + z, "" + vx, "0", "0", "" + yaw, "0", "" + join}; }
  // a painting at the wall tile (tx, ty, tz) facing dir; `counter` presets EntityHanging's private 100-tick counter (the check runs when it reads 100)
  static String[] painting(int tx, int ty, int tz, int dir, int counter, int join) { return new String[] {"painting", "" + tx, "" + ty, "" + tz, "0", "0", "0", "" + dir, "" + counter, "" + join}; }
  static String[] potion(double x, double y, double z, double vx, double vy, double vz, int meta, int join) { return new String[] {"potion", "" + x, "" + y, "" + z, "" + vx, "" + vy, "" + vz, "" + meta, "0", "" + join}; }
  static String[] snowball(double x, double y, double z, double vx, double vy, double vz, int join) { return new String[] {"snowball", "" + x, "" + y, "" + z, "" + vx, "" + vy, "" + vz, "0", "0", "" + join}; }
  // a wither skull: the aim (ax, ay, az) is normalised to 0.1 by EntityFireball's second constructor, as a dispenser's ball is
  // a ball thrown by a player shell: type 0 snowball, 1 egg, 2 pearl, 3 potion; creative 1 for a Creative thrower
  // type 4: an experience bottle. `seed` is the Entity.rand seed (Random(7) when omitted: the egg's hatch roll is false, 5)
  static String[] pthrow(double x, double y, double z, double vx, double vy, double vz, int type, int creative, int join, long seed) { return new String[] {"pthrow", "" + x, "" + y, "" + z, "" + vx, "" + vy, "" + vz, "" + type, "" + creative, "" + join, "" + seed}; }
  static String[] pthrow(double x, double y, double z, double vx, double vy, double vz, int type, int creative, int join) { return new String[] {"pthrow", "" + x, "" + y, "" + z, "" + vx, "" + vy, "" + vz, "" + type, "" + creative, "" + join}; }
  static String[] skull(double x, double y, double z, double ax, double ay, double az, int join) { return new String[] {"skull", "" + x, "" + y, "" + z, "" + ax, "" + ay, "" + az, "0", "0", "" + join}; }
  static String[] wall(int dir, int tx, int ty, int tz) { return new String[] {"wall", "" + tx, "" + ty, "" + tz, "0", "0", "0", "" + dir, "0", "0"}; }
  static String[] setBlock(int x, int y, int z, int id, int tick) { return new String[] {"set", "" + x, "" + y, "" + z, "0", "0", "0", "" + id, "0", "" + tick}; }


  // Batch 46. The launch of every player-thrown EntityThrowable subclass: the constructor (World, EntityLivingBase) runs unchanged on a player shell. The entity's own Random is
  // created unseeded by Entity's constructor, so the state it had before the aim is recovered: the LCG is stepped back until three nextGaussian draws from there end in the state
  // the constructor left (including the cached second value). A port that restores that state and draws the same must reach the same state and the same motion.
  static final java.math.BigInteger MULT = java.math.BigInteger.valueOf(0x5DEECE66DL), MOD = java.math.BigInteger.ONE.shiftLeft(48);
  static long back(long seed, int steps) {
    java.math.BigInteger inv = MULT.modInverse(MOD), v = java.math.BigInteger.valueOf(seed);
    for (int i = 0; i < steps; i++) v = v.subtract(java.math.BigInteger.valueOf(0xBL)).multiply(inv).mod(MOD);
    return v.longValue();
  }
  static void launch(String name, int type, double px, double py, double pz, float yaw, float pitch) throws Exception {
    EW w = newWorld();
    Th t = (Th) PlantProbe.unsafe.allocateInstance(Th.class);
    t.o = w; t.s = px; t.t = py; t.u = pz; t.y = yaw; t.z = pitch;
    yw cap = new yw(); t.bE = cap;
    zk e = type == 0 ? new zj(w, t) : type == 1 ? new zl(w, t) : type == 2 ? new zm(w, t) : type == 3 ? new zo(w, t, 16421) : new zn(w, t);
    Random r = (Random) PlayerStepProbe.field(sa.class, "Z").get(e);
    sun.misc.Unsafe u = PlantProbe.unsafe;
    long seedOff = u.objectFieldOffset(Random.class.getDeclaredField("seed")), haveOff = u.objectFieldOffset(Random.class.getDeclaredField("haveNextNextGaussian")), nextOff = u.objectFieldOffset(Random.class.getDeclaredField("nextNextGaussian"));
    long after = ((java.util.concurrent.atomic.AtomicLong) u.getObject(r, seedOff)).get();
    boolean have = u.getBoolean(r, haveOff);
    double next = u.getDouble(r, nextOff);
    long found = -1; int draws = -1;
    for (int k = 0; k <= 80 && found < 0; k++) {
      long raw = back(after, k);
      Random c = new Random(0);
      ((java.util.concurrent.atomic.AtomicLong) u.getObject(c, seedOff)).set(raw);
      u.putBoolean(c, haveOff, false);
      c.nextGaussian(); c.nextGaussian(); c.nextGaussian();
      if (((java.util.concurrent.atomic.AtomicLong) u.getObject(c, seedOff)).get() == after && u.getBoolean(c, haveOff) == have && (!have || u.getDouble(c, nextOff) == next)) { found = raw; draws = k; }
    }
    if (found < 0) throw new RuntimeException("no three-gaussian start for " + name);
    System.out.println("{\"case\":\"throw-launch\",\"name\":" + q(name) + ",\"type\":" + type + ",\"from\":[" + num(px) + "," + num(py) + "," + num(pz) + "," + yaw + "," + pitch + "],\"seed\":\"" + found + "\",\"stepsBack\":" + draws
      + ",\"after\":{\"seed\":\"" + after + "\",\"gaussian\":" + (have ? num(next) : "null") + "},\"entity\":[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + num((double) e.y) + "," + num((double) e.z) + "]}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    PlantProbe.unsafe = MobMoveProbe.unsafe();
    // EntityItem.onUpdate searches for stacks to merge with only when its block cell changed (or every 25th tick). A and B cross a cell edge in the same tick and
    // find each other: the first to update merges INTO the other (equal counts), so the list order picks the survivor
    scenario("items-equal-ab", 3, item(0.9, 0.3, 0.5, 0.2, 4, 10, 0), item(1.1, 0.3, 0.5, -0.25, 4, 50, 0));
    scenario("items-equal-ba", 3, item(1.1, 0.3, 0.5, -0.25, 4, 50, 0), item(0.9, 0.3, 0.5, 0.2, 4, 10, 0));
    // an item that joins later is updated (and searches) after the earlier one
    scenario("items-join-late", 4, item(0.9, 0.3, 0.5, 0.2, 4, 10, 0), item(1.1, 0.3, 0.5, -0.25, 4, 50, 1));
    scenario("items-join-early", 4, item(0.9, 0.3, 0.5, 0.2, 4, 10, 1), item(1.1, 0.3, 0.5, -0.25, 4, 50, 0));
    // three stacks (limit 64): 20 + 20 fit, a third of 30 does not
    scenario("items-three-abc", 3, item(0.9, 0.3, 0.5, 0.2, 20, 10, 0), item(1.1, 0.3, 0.5, -0.25, 20, 20, 0), item(1.3, 0.3, 0.5, -0.45, 30, 30, 0));
    scenario("items-three-cba", 3, item(1.3, 0.3, 0.5, -0.45, 30, 30, 0), item(1.1, 0.3, 0.5, -0.25, 20, 20, 0), item(0.9, 0.3, 0.5, 0.2, 20, 10, 0));
    // the player stands among the orbs: it takes one every other tick (xpCooldown 2), in list order
    scenario("orbs-pickup-ab", 5, orb(0.4, 0.5, 0.5, 7, 0), orb(0.6, 0.5, 0.5, 3, 0));
    scenario("orbs-pickup-ba", 5, orb(0.6, 0.5, 0.5, 3, 0), orb(0.4, 0.5, 0.5, 7, 0));
    scenario("orbs-pickup-join", 5, orb(0.4, 0.5, 0.5, 7, 1), orb(0.6, 0.5, 0.5, 3, 0));
    // an arrow flies at a cow that slides (knockback motion): the arrow updates before the cow moves (arrow listed first) or after
    scenario("arrow-cow-first", 6, arrow(-2.0, 1.0, 0.5, 0.9, 0.0, 0.0, 0), cow(1.0, 0.0, 0.5, 0.3, 0));
    scenario("arrow-cow-after", 6, cow(1.0, 0.0, 0.5, 0.3, 0), arrow(-2.0, 1.0, 0.5, 0.9, 0.0, 0.0, 0));
    // TNT A explodes this tick (fuse 1 -> 0 on its update) and pushes TNT B, which is updated before A (list B, A: it moves first, then is pushed) or after
    scenario("tnt-push-ab", 4, tnt(0.5, 0.5, 0.5, 0, 0), tnt(2.5, 0.5, 0.5, 80, 0));
    scenario("tnt-push-ba", 4, tnt(2.5, 0.5, 0.5, 80, 0), tnt(0.5, 0.5, 0.5, 0, 0));
    // kinds mixed: the blast pushes an item that is updated before it (it moves, then is pushed) or after it (pushed, then moves); the old fixed order ran every item before every TNT
    scenario("tnt-item-ab", 4, tnt(0.5, 0.5, 0.5, 0, 0), item(1.5, 0.3, 0.5, 0.0, 4, 0, 0));
    scenario("tnt-item-ba", 4, item(1.5, 0.3, 0.5, 0.0, 4, 0, 0), tnt(0.5, 0.5, 0.5, 0, 0));

    // Batch 44. A cow rides a minecart: the loop skips the rider and updates it right after its mount (updateRidden), whichever way round the two are listed
    scenario("cart-rider-cart-first", 8, cart(0.5, 0.5, 0.5, 0.3, 0.0, 0), rider(0.5, 0.5, 0.5, 0, 0));
    scenario("cart-rider-cow-first", 8, rider(0.5, 0.5, 0.5, 1, 0), cart(0.5, 0.5, 0.5, 0.3, 0.0, 0));
    // two carts meet: the first of the list to update pushes the other, which is then moved by its own update
    scenario("carts-collide-ab", 14, cart(0.5, 0.5, 0.5, 0.3, 0.0, 0), cart(3.5, 0.5, 0.5, -0.3, 0.0, 0));
    scenario("carts-collide-ba", 14, cart(3.5, 0.5, 0.5, -0.3, 0.0, 0), cart(0.5, 0.5, 0.5, 0.3, 0.0, 0));
    // a boat drifts into a cart coming the other way: whichever updates first moves, then meets the other
    scenario("boat-cart-ab", 14, boat(0.5, 0.5, 0.5, 0.25, 0, 0), cart(2.2, 0.5, 0.5, -0.15, 0.0, 0));
    scenario("boat-cart-ba", 14, cart(2.2, 0.5, 0.5, -0.15, 0.0, 0), boat(0.5, 0.5, 0.5, 0.25, 0, 0));
    // a painting loses its wall: the surface check runs at the 100th update (the counter is preset to 98: ticks 0, 1 count, tick 2 checks), the wall goes at tick 2;
    // the painting item joins the end of the list in that pass and updates in it
    scenario("painting-wall-first", 7, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 98, 0), item(3.5, 0.3, 2.5, 0.0, 4, 0, 0), cart(1.5, 0.5, 3.5, 0.2, 0.0, 0), rider(1.5, 0.5, 3.5, 2, 0), setBlock(0, 3, 0, 0, 2));
    scenario("painting-wall-last", 7, setBlock(0, 3, 0, 1, -1), item(3.5, 0.3, 2.5, 0.0, 4, 0, 0), cart(1.5, 0.5, 3.5, 0.2, 0.0, 0), rider(1.5, 0.5, 3.5, 1, 0), painting(0, 3, 0, 0, 98, 0), setBlock(0, 3, 0, 0, 2));
    // a witch's potion (harming, splash) lands beside a cow riding a cart that moves: the cow's distance, so the damage, depends on who updates first
    scenario("potion-cart-ab", 10, cart(0.5, 0.5, 0.5, 0.3, 0.0, 0), rider(0.5, 0.5, 0.5, 0, 0), potion(1.8, 0.25, 1.8, 0.0, 0.0, -0.3, 32732, 0));
    scenario("potion-cart-ba", 10, potion(1.8, 0.25, 1.8, 0.0, 0.0, -0.3, 32732, 0), cart(0.5, 0.5, 0.5, 0.3, 0.0, 0), rider(0.5, 0.5, 0.5, 1, 0));
    // a snow golem's snowball flies at a cow riding a cart that moves
    scenario("snowball-cart-ab", 10, cart(0.5, 0.5, 0.5, 0.3, 0.0, 0), rider(0.5, 0.5, 0.5, 0, 0), snowball(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 0));
    scenario("snowball-cart-ba", 10, snowball(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 0), cart(0.5, 0.5, 0.5, 0.3, 0.0, 0), rider(0.5, 0.5, 0.5, 1, 0));
    // a wither skull hits the ground beside an item: the blast pushes it after it moved (item first) or before (skull first)
    scenario("skull-item-ab", 12, item(1.5, 0.3, 0.5, 0.0, 4, 0, 0), skull(0.5, 1.5, 0.5, 0.0, -1.0, 0.0, 0));
    scenario("skull-item-ba", 12, skull(0.5, 1.5, 0.5, 0.0, -1.0, 0.0, 0), item(1.5, 0.3, 0.5, 0.0, 4, 0, 0));

    // Batch 45. Explosion.doExplosionA takes every entity in the box (attackEntityFrom with the explosion source, then the motion): a TNT beside a minecart (it breaks at 40+
    // damage: 10 per point, so only a cart about 7.8 blocks away survives with a wobble), a boat, a thrown potion and a snowball, with the target listed before or after the TNT
    scenario("boom-cart-near-ab", 6, tnt(0.5, 0.5, 0.5, 0, 0), cart(2.5, 0.5, 0.5, 0.0, 0.0, 0));
    scenario("boom-cart-near-ba", 6, cart(2.5, 0.5, 0.5, 0.0, 0.0, 0), tnt(0.5, 0.5, 0.5, 0, 0));
    scenario("boom-cart-far-ab", 8, tnt(0.5, 0.5, 0.5, 0, 0), cart(8.3, 0.5, 0.5, 0.0, 0.0, 0));
    scenario("boom-boat-near-ab", 6, tnt(0.5, 0.5, 0.5, 0, 0), boat(2.5, 0.5, 0.5, 0.0, 0, 0));
    scenario("boom-boat-near-ba", 6, boat(2.5, 0.5, 0.5, 0.0, 0, 0), tnt(0.5, 0.5, 0.5, 0, 0));
    scenario("boom-boat-far-ab", 8, tnt(0.5, 0.5, 0.5, 0, 0), boat(8.3, 0.5, 0.5, 0.0, 0, 0));
    scenario("boom-potion-ab", 6, tnt(0.5, 0.5, 0.5, 0, 0), potion(3.5, 5.0, 0.5, 0.0, 0.0, 0.0, 32732, 0));
    scenario("boom-potion-ba", 6, potion(3.5, 5.0, 0.5, 0.0, 0.0, 0.0, 32732, 0), tnt(0.5, 0.5, 0.5, 0, 0));
    scenario("boom-snowball-ab", 6, tnt(0.5, 0.5, 0.5, 0, 0), snowball(3.5, 5.0, 0.5, 0.0, 0.0, 0.0, 0));
    scenario("boom-snowball-ba", 6, snowball(3.5, 5.0, 0.5, 0.0, 0.0, 0.0, 0), tnt(0.5, 0.5, 0.5, 0, 0));
    // EntityThrowable's ray takes any canBeCollidedWith entity in the sweep box, a painting included: a snowball breaks it (attackEntityFrom, 0 damage; the drop joins the list),
    // a potion shatters on it and leaves it standing (the wall block goes at tick 4, before the hit, so the dropped item is not pushed out of it: that draws an unseeded random)
    scenario("snowball-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), snowball(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 0), setBlock(0, 3, 0, 0, 4));
    scenario("potion-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), potion(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 32732, 0), setBlock(0, 3, 0, 0, 4));
    // A mob's own update ends with collideWithNearbyEntities: it pushes the cart or boat beside it (applyEntityCollision) inside its turn, so the list order decides
    // whether it meets the vehicle before or after the vehicle moved. A slow cart only pushes; a fast empty one (above 0.1) also takes the cow aboard
    scenario("cart-cow-ab", 10, cart(0.55, 0.5, 0.5, 0.05, 0.0, 0), cow(1.5, 0.0, 0.5, 0.0, 0));
    scenario("cart-cow-ba", 10, cow(1.5, 0.0, 0.5, 0.0, 0), cart(0.55, 0.5, 0.5, 0.05, 0.0, 0));
    scenario("cart-cow-mount-ab", 10, cart(0.55, 0.5, 0.5, 0.3, 0.0, 0), cow(1.5, 0.0, 0.5, 0.0, 0));
    scenario("cart-cow-mount-ba", 10, cow(1.5, 0.0, 0.5, 0.0, 0), cart(0.55, 0.5, 0.5, 0.3, 0.0, 0));
    scenario("boat-cow-ab", 10, boat(0.55, 0.5, 0.5, 0.05, 0, 0), cow(1.5, 0.0, 0.5, 0.0, 0));
    scenario("boat-cow-ba", 10, cow(1.5, 0.0, 0.5, 0.0, 0), boat(0.55, 0.5, 0.5, 0.05, 0, 0));
    // a cow riding one cart is pushed by a second cart: the push uses the position the rider has after its own update, before the seat is taken
    scenario("cart-rider-push-ab", 10, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), rider(0.5, 0.5, 0.5, 0, 0), cart(1.5, 0.5, 0.5, -0.05, 0.0, 0));
    scenario("cart-rider-push-ba", 10, cart(1.5, 0.5, 0.5, -0.05, 0.0, 0), cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), rider(0.5, 0.5, 0.5, 1, 0));

    // Batch 46. Snowballs, eggs, pearls and potions thrown by a player shell (the constructor takes the thrower, so attackEntityFrom gets an indirect thrown source whose
    // entity is the player: a Creative player's hit breaks a cart, a boat or a painting outright). The ball flies at the target from 2 blocks away (spec: type 0 snowball,
    // 1 egg, 2 pearl, 3 potion; b = 1 Creative thrower). Cart and boat rows carry their damage after the rotation fields.
    scenario("pthrow-snowball-cart", 6, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 0, 0, 0));
    scenario("pthrow-snowball-cart-creative", 6, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 0, 1, 0));
    scenario("pthrow-snowball-boat", 6, boat(0.5, 0.5, 0.5, 0.0, 0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 0, 0, 0));
    scenario("pthrow-snowball-boat-creative", 6, boat(0.5, 0.5, 0.5, 0.0, 0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 0, 1, 0));
    scenario("pthrow-egg-cart", 6, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 1, 0, 0));
    scenario("pthrow-pearl-cart", 6, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 2, 0, 0));
    scenario("pthrow-pearl-boat-creative", 6, boat(0.5, 0.5, 0.5, 0.0, 0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 2, 1, 0));
    scenario("pthrow-potion-cart", 6, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 3, 0, 0));
    scenario("pthrow-snowball-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 0, 0, 0), setBlock(0, 3, 0, 0, 4));
    scenario("pthrow-snowball-painting-creative", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 0, 1, 0), setBlock(0, 3, 0, 0, 4));
    scenario("pthrow-egg-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 1, 0, 0), setBlock(0, 3, 0, 0, 4));
    scenario("pthrow-pearl-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 2, 0, 0), setBlock(0, 3, 0, 0, 4));
    scenario("pthrow-pearl-painting-creative", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 2, 1, 0), setBlock(0, 3, 0, 0, 4));
    scenario("pthrow-potion-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 3, 0, 0), setBlock(0, 3, 0, 0, 4));

    // Batch 47. An egg's hatch roll both ways (Entity.rand seeds 4096: one chick, 4104: four; seed 7 is false) and an experience bottle (type 4) on a cart, boat and painting.
    // The chick and the orbs join the entity list in the pass (World.spawnEntityInWorld) and are listed after the main states.
    scenario("pthrow-egg-cart-hatch", 8, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 1, 0, 0, 4096));
    scenario("pthrow-egg-cart-hatch4", 8, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 1, 0, 0, 4104));
    scenario("pthrow-egg-boat-hatch", 8, boat(0.5, 0.5, 0.5, 0.0, 0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 1, 0, 0, 4096));
    scenario("pthrow-egg-painting-hatch", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 1, 0, 0, 4096), setBlock(0, 3, 0, 0, 4));
    scenario("pthrow-egg-cart-creative-hatch", 8, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 1, 1, 0, 4096));
    scenario("pthrow-expbottle-cart", 8, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 4, 0, 0));
    scenario("pthrow-expbottle-boat", 8, boat(0.5, 0.5, 0.5, 0.0, 0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 4, 0, 0));
    scenario("pthrow-expbottle-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.9, 1.7, 0.0, 0.0, -0.4, 4, 0, 0), setBlock(0, 3, 0, 0, 4));
    // A pearl thrown by an EntityPlayerMP: the cart wobbles, then the thrower is put at the pearl's position (pre-move at the impact) and takes 5.0 fall damage; the pearl row ends with x, y, z, damage of the thrower.
    scenario("pthrow-pearl-mp-cart", 6, cart(0.5, 0.5, 0.5, 0.0, 0.0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 2, 2, 0));
    scenario("pthrow-pearl-mp-boat", 6, boat(0.5, 0.5, 0.5, 0.0, 0, 0), pthrow(2.6, 0.6, 0.5, -0.4, 0.0, 0.0, 2, 2, 0));
    scenario("pthrow-pearl-mp-painting", 8, setBlock(0, 3, 0, 1, -1), painting(0, 3, 0, 0, 0, 0), pthrow(0.5, 3.5, 3.5, 0.0, 0.0, -0.4, 2, 2, 0), setBlock(0, 3, 0, 0, 4));
    // The launch of each player-thrown class from a few views (floats: yaw, pitch in degrees). type 0 snowball, 1 egg, 2 pearl, 3 potion, 4 experience bottle
    float[][] views = {{0f, 0f}, {37.5f, -12.25f}, {-123.75f, 45.5f}, {200.125f, -80f}, {90f, 10f}};
    String[] names = {"snowball", "egg", "pearl", "potion", "expbottle"};
    for (int type = 0; type < 5; type++) for (int i = 0; i < views.length; i++) launch("launch-" + names[type] + "-" + i, type, 10.5 + i, 64.0 + 0.25 * i, -3.75 - i, views[i][0], views[i][1]);
  }
}
