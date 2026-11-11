import java.util.*;

// Batch 43: World.updateEntities walks ONE loadedEntityList in insertion order. This probe puts the real, unchanged EntityItem (xk), EntityTNTPrimed (xw),
// EntityArrow (zc), EntityXPOrb (sq) and a mob on a map-backed World double (XpOrbProbe.XW: blocks, collision boxes, the entity queries over one list) and
// walks that list by index exactly as World.updateEntities does (ticksExisted++ then onUpdate; an entity spawned in the pass joins the end and updates in it;
// setDead entities leave at the end of their own turn in the pass here: the list is swept after the pass). The same scenario is run with the entities
// listed in different orders (an entity's `join` tick says when it is added), so the record shows what the order decides.
// Row per tick: [per entity (creation order): x, y, z, vx, vy, vz, isDead, then kind fields] (item: count, age, delay; tnt: fuse; arrow: inGround, ticksInAir;
// orb: age, value; mob: health), explosions [x, y, z, power].
public class EntityListProbe {
  static List<String> booms = new ArrayList<>();
  public static class EW extends XpOrbProbe.XW {
    EW() { super(); }
    public float n(int x, int y, int z) { return 1.0f; } // World.getLightBrightness: light 15 everywhere (a wandering mob reads it)
    public int k(int x, int y, int z) { return 15; }
    public boolean d(sa e) { entities.add(e); return true; } // World.spawnEntityInWorld: the end of loadedEntityList
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
  // EntityCow with updateAITasks (sw.bn: the AI task list, the random wander) switched off; its motion, friction, knockback, hurt and death run unchanged.
  static class Cow extends wh { Cow(ahb w) { super(w); } protected void bn() {} }
  // The player of the orb scenarios: an EntityPlayerSP shell (XpOrbProbe.Target) whose addExperience and onItemPickup only count.
  static class P extends XpOrbProbe.Target { P() { super(); } int xp; public void v(int n) { xp += n; } public void a(sa e, int n) {} }
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
      default: throw new RuntimeException(s[0]);
    }
    e.b(x, y, z); // setPosition: the entity constructors differ in yOffset use; the listed point is the feet/box position as the port's records use it
    e.v = Double.parseDouble(s[4]); e.w = Double.parseDouble(s[5]); e.x = Double.parseDouble(s[6]);
    PlayerStepProbe.field(sa.class, "Z").set(e, new Random(7));
    return e;
  }
  static String state(sa e) throws Exception {
    StringBuilder b = new StringBuilder("[" + num(e.s) + "," + num(e.t) + "," + num(e.u) + "," + num(e.v) + "," + num(e.w) + "," + num(e.x) + "," + (e.K ? 1 : 0));
    if (e instanceof xk) b.append("," + ((xk) e).f().b + "," + ((xk) e).a + "," + ((xk) e).b);
    else if (e instanceof xw) b.append("," + ((xw) e).a);
    else if (e instanceof zc) b.append("," + (PlayerStepProbe.field(zc.class, "i").getBoolean(e) ? 1 : 0) + "," + ((zc) e).b);
    else if (e instanceof sq) b.append("," + ((sq) e).a + "," + ((sq) e).f());
    else if (e instanceof sv) b.append("," + ((sv) e).aS());
    return b.append("]").toString();
  }
  static void scenario(String name, int ticks, String[]... specs) throws Exception {
    if (System.getenv("EL_ONLY") != null && !name.contains(System.getenv("EL_ONLY"))) return;
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
    booms.clear();
    List<sa> all = new ArrayList<>();
    int[] join = new int[specs.length];
    for (int i = 0; i < specs.length; i++) { all.add(make(w, specs[i])); join[i] = Integer.parseInt(specs[i][9]); }
    List<String> rows = new ArrayList<>();
    P player = null;
    for (String[] sp : specs) if (sp[0].equals("orb")) { player = (P) PlantProbe.unsafe.allocateInstance(P.class); player.o = w; player.s = 0.5; player.t = 0.0; player.u = 0.5; PlayerStepProbe.field(sa.class, "C").set(player, azt.a(0.2, 0.0, 0.2, 0.8, 1.8, 0.8)); }
    for (int t = 0; t < ticks; t++) {
      for (int i = 0; i < all.size(); i++) if (join[i] == t) w.entities.add(all.get(i));
      booms.clear();
      for (int i = 0; i < w.entities.size(); i++) { // the list is walked by index: an entity spawned in the pass joins the end and updates in it
        sa e = w.entities.get(i);
        if (e.K) continue;
        e.aa++;
        e.h();
      }
      w.entities.removeIf(e -> e.K);
      if (player != null) { // the network tick after the world's entities: EntityPlayer.onUpdate counts xpCooldown down, onLivingUpdate collides with the entities around (list order)
        if (player.bt > 0) player.bt--;
        for (Object o : w.b(player, player.C.b(1.0, 0.5, 1.0))) if (!((sa) o).K) ((sa) o).b_(player);
        w.entities.removeIf(e -> e.K);
      }
      StringBuilder row = new StringBuilder("[[");
      for (int i = 0; i < all.size(); i++) row.append(i > 0 ? "," : "").append(state(all.get(i)));
      row.append("],[").append(String.join(",", booms)).append("],").append(player == null ? "[]" : "[" + player.xp + "," + player.bt + "]").append("]");
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
    scenario("tnt-item-ab", 4, tnt(0.5, 0.5, 0.5, 0, 0), item(2.5, 0.3, 0.5, 0.0, 4, 0, 0));
    scenario("tnt-item-ba", 4, item(2.5, 0.3, 0.5, 0.0, 4, 0, 0), tnt(0.5, 0.5, 0.5, 0, 0));
  }
}
