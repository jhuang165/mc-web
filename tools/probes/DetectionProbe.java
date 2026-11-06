import java.lang.reflect.Field;
import java.util.*;

// Runs the unchanged 1.7.10 target selection against Unsafe-allocated (constructor-free) objects:
//  - World.getClosestVulnerablePlayerToEntity b(sa, D) at the ranges mobs ask for (8 silverfish, 16 spider/slime/EntityMob, 64 enderman, 100 ghast),
//  - EntityAINearestAttackableTarget (vo, EntityPlayer, chance 0) shouldExecute a() with its entity selector (vp -> vu.a(sv, false)) for a
//    zombie-like EntityCreature (follow range 16 and 40, sight on and off, creative, dead players),
//  - EntitySpider.findPlayerToAttack (yn.bR), EntitySilverfish.findPlayerToAttack (yk.bR) and EntityMob.findPlayerToAttack (yg.bR via yq).
// Only the world's entity lookup (selectEntitiesWithinAABB) is replaced: it applies the unchanged selector to the scripted players whose
// box meets the query box. Nothing in the target classes is patched.
public class DetectionProbe {
  static sun.misc.Unsafe U;
  static Object alloc(Class<?> c) throws Exception { return U.allocateInstance(c); }
  static Field field(Class<?> c, String n) throws Exception {
    for (Class<?> k = c; k != null; k = k.getSuperclass()) {
      try { Field f = k.getDeclaredField(n); f.setAccessible(true); return f; } catch (NoSuchFieldException e) { }
    }
    throw new NoSuchFieldException(c + "." + n);
  }
  static void set(Object o, String n, Object v) throws Exception { field(o.getClass(), n).set(o, v); }

  public static class World extends bjf {
    public World() { super(null, null, 0, null, null); }
    @Override public List a(Class c, azt box, sj sel) {
      List<Object> out = new ArrayList<>();
      for (Object o : (List<?>) h) { Player p = (Player) o; if (c.isInstance(p) && box.b(p.C) && (sel == null || sel.a(p))) out.add(p); }
      return out;
    }
  }
  public static class Player extends bjk {
    boolean sneak, invisible, dead; float armor; double px, py, pz;
    public Player() { super(null, null, null, null, null); }
    @Override public boolean an() { return sneak; }
    @Override public boolean ap() { return invisible; }
    @Override public float bE() { return armor; }
    @Override public boolean Z() { return !dead; }
    @Override public double e(double x, double y, double z) { double dx = px - x, dy = py - y, dz = pz - z; return dx * dx + dy * dy + dz * dz; }
  }
  static class Senses extends vw { boolean sees; Senses() { super(null); } @Override public boolean a(sa e) { return sees; } }
  static class FollowRange implements ti {
    double v; public th a() { return null; } public double b() { return v; } public void a(double d) { } public Collection c() { return null; }
    public tj a(UUID u) { return null; } public void a(tj t) { } public void b(tj t) { } public void d() { } public double e() { return v; }
  }
  public static class Zombie extends yq {
    double follow; boolean sees; Senses senses;
    public Zombie() { super(null); }
    @Override public ti a(th attr) { FollowRange r = new FollowRange(); r.v = follow; return r; }
    @Override public vw n() { return senses; }
    @Override public boolean p(sa e) { return sees; }
  }
  public static class Spider extends yn { float light; public Spider() { super(null); } @Override public float d(float p) { return light; } }
  public static class Silverfish extends yk { public Silverfish() { super(null); } }

  static World world;
  static Player player(double x, double y, boolean sneak, boolean inv, int armor, boolean creative, boolean dead) throws Exception {
    Player p = (Player) alloc(Player.class);
    p.bE = (yw) alloc(yw.class);
    p.bE.a = creative;
    p.sneak = sneak; p.invisible = inv; p.armor = armor / 4f; p.dead = dead;
    p.px = x; p.py = y; p.pz = 0;
    p.s = x; p.t = y; p.u = 0;
    set(p, "C", azt.a(x - 0.3, y, -0.3, x + 0.3, y + 1.8, 0.3));
    List<Object> list = new ArrayList<>(); list.add(p);
    world.h = list;
    return p;
  }
  static void place(sa m) throws Exception { m.s = 0; m.t = 64; m.u = 0; m.o = world; set(m, "C", azt.a(-0.3, 64, -0.3, 0.3, 65.8, 0.3)); }
  interface Probe { boolean at(double d) throws Exception; }
  static String bits(Probe p, double step, double max) throws Exception {
    StringBuilder b = new StringBuilder();
    for (int k = 1; k * step <= max + 1e-9; k++) b.append(p.at(Math.round(k * step * 1000) / 1000.0) ? '1' : '0');
    return b.toString();
  }
  static StringBuilder out = new StringBuilder();
  static void row(StringBuilder rows, String cols, String bits) { rows.append(rows.length() > 0 ? "," : "").append("[").append(cols).append(",\"").append(bits).append("\"]"); }

  public static void main(String[] a) throws Exception {
    java.lang.reflect.Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe");
    uf.setAccessible(true);
    U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    world = (World) alloc(World.class);
    Zombie z = (Zombie) alloc(Zombie.class); place(z); field(td.class, "br").set(z, -1f); // maximumHomeDistance -1: isWithinHomeDistance is true
    Senses senses = (Senses) alloc(Senses.class); z.senses = senses;
    Spider sp = (Spider) alloc(Spider.class); place(sp);
    Silverfish sf = (Silverfish) alloc(Silverfish.class); place(sf);

    // World.getClosestVulnerablePlayerToEntity at the ranges the mobs use.
    double[][] ranges = { { 8, 0.1 }, { 16, 0.1 }, { 64, 0.5 }, { 100, 0.5 } };
    StringBuilder sets = new StringBuilder();
    for (double[] r : ranges) {
      StringBuilder rows = new StringBuilder();
      for (int sneak = 0; sneak < 2; sneak++) for (int inv = 0; inv < 2; inv++) for (int armor = 0; armor <= 4; armor++) {
        final int s = sneak, i = inv, ar = armor;
        row(rows, s + "," + i + "," + ar + ",0,0", bits(d -> { player(d, 64, s == 1, i == 1, ar, false, false); return world.b(z, r[0]) != null; }, r[1], r[0] + 1));
      }
      row(rows, "0,0,0,1,0", bits(d -> { player(d, 64, false, false, 0, true, false); return world.b(z, r[0]) != null; }, r[1], r[0] + 1));
      row(rows, "0,0,0,0,1", bits(d -> { player(d, 64, false, false, 0, false, true); return world.b(z, r[0]) != null; }, r[1], r[0] + 1));
      sets.append(sets.length() > 0 ? "," : "").append("{\"range\":").append((int) r[0]).append(",\"step\":").append(r[1]).append(",\"rows\":[").append(rows).append("]}");
    }
    out.append("{\"case\":\"closestVulnerable\",\"columns\":[\"sneaking\",\"invisible\",\"armorPieces\",\"creative\",\"dead\",\"foundByDistance\"],\"sets\":[").append(sets).append("]}\n");

    // EntityAINearestAttackableTarget (vo) on a zombie-like creature: the box is followRange x 4 x followRange, the selector is vu.a(sv, false).
    StringBuilder rows = new StringBuilder();
    for (double follow : new double[] { 16, 40 }) for (int sight = 0; sight < 2; sight++) for (int canSee = 0; canSee < 2; canSee++) {
      if (sight == 0 && canSee == 1) continue;
      z.follow = follow; senses.sees = canSee == 1;
      vo task = new vo(z, yz.class, 0, sight == 1);
      for (double dy : new double[] { 0, 5.5, 6.0, -5.5, -6.0 }) for (int sneak = 0; sneak < 2; sneak++) for (int inv = 0; inv < 2; inv++) for (int armor : new int[] { 0, 2, 4 }) {
        final int s = sneak, i = inv, ar = armor; final double yy = 64 + dy;
        row(rows, (int) follow + "," + sight + "," + canSee + "," + dy + "," + s + "," + i + "," + ar + ",0,0", bits(d -> { player(d, yy, s == 1, i == 1, ar, false, false); return task.a(); }, 0.5, follow + 2));
      }
      for (int mode = 0; mode < 2; mode++) {
        final int md = mode;
        row(rows, (int) follow + "," + sight + "," + canSee + ",0,0,0,0," + (md == 0 ? 1 : 0) + "," + (md == 1 ? 1 : 0), bits(d -> { player(d, 64, false, false, 0, md == 0, md == 1); return task.a(); }, 0.5, follow + 2));
      }
    }
    out.append("{\"case\":\"nearestAttackable\",\"step\":0.5,\"columns\":[\"followRange\",\"checkSight\",\"canSee\",\"dy\",\"sneaking\",\"invisible\",\"armorPieces\",\"creative\",\"dead\",\"acceptedByDistance\"],\"rows\":[").append(rows).append("]}\n");

    // findPlayerToAttack of the legacy mobs.
    rows = new StringBuilder();
    for (float light : new float[] { 0.3f, 0.7f }) for (int sneak = 0; sneak < 2; sneak++) for (int inv = 0; inv < 2; inv++) for (int armor : new int[] { 0, 2, 4 }) {
      final int s = sneak, i = inv, ar = armor; final float l = light;
      row(rows, l + "," + s + "," + i + "," + ar, bits(d -> { sp.light = l; player(d, 64, s == 1, i == 1, ar, false, false); return sp.bR() != null; }, 0.1, 17));
    }
    out.append("{\"case\":\"spider\",\"step\":0.1,\"columns\":[\"brightness\",\"sneaking\",\"invisible\",\"armorPieces\",\"foundByDistance\"],\"rows\":[").append(rows).append("]}\n");
    rows = new StringBuilder();
    for (int sneak = 0; sneak < 2; sneak++) for (int inv = 0; inv < 2; inv++) for (int armor : new int[] { 0, 2, 4 }) {
      final int s = sneak, i = inv, ar = armor;
      row(rows, s + "," + i + "," + ar, bits(d -> { player(d, 64, s == 1, i == 1, ar, false, false); return sf.bR() != null; }, 0.1, 9));
    }
    out.append("{\"case\":\"silverfish\",\"step\":0.1,\"columns\":[\"sneaking\",\"invisible\",\"armorPieces\",\"foundByDistance\"],\"rows\":[").append(rows).append("]}\n");
    rows = new StringBuilder();
    for (int sees = 0; sees < 2; sees++) for (int sneak = 0; sneak < 2; sneak++) for (int inv = 0; inv < 2; inv++) for (int armor : new int[] { 0, 2, 4 }) {
      final int se = sees, s = sneak, i = inv, ar = armor;
      row(rows, se + "," + s + "," + i + "," + ar, bits(d -> { z.sees = se == 1; player(d, 64, s == 1, i == 1, ar, false, false); return z.bR() != null; }, 0.1, 17));
    }
    out.append("{\"case\":\"mob\",\"step\":0.1,\"columns\":[\"canSee\",\"sneaking\",\"invisible\",\"armorPieces\",\"foundByDistance\"],\"rows\":[").append(rows).append("]}\n");
    System.out.print(out);
  }
}
