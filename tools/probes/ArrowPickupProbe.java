import java.lang.reflect.Field;
import java.util.*;

// EntityArrow.onCollideWithPlayer (zc.b_) from the unchanged 1.7.10 classes with a real EntityPlayer (PlayerKnockbackProbe construction).
// For arrowShake 0-8 ("pickup delay"), inGround, canBePickedUp 0-2, Creative and the inventory (empty, arrow stack, 35 stacks of 64 stone,
// full with a 63 arrow stack, full with a 64 arrow stack) it records whether the arrow was removed, the arrows in the inventory after,
// the sounds played and the arrow's Random after (one sound draws two floats).
public class ArrowPickupProbe {
  public static class S extends PlayerKnockbackProbe.W {
    static List<String> sounds = new ArrayList<>();
    public void a(sa e, String name, float v, float p) { sounds.add("[\"" + name + "\"," + Float.toString(v) + "," + Float.toString(p) + "]"); }
  }
  // EntityPlayer.onItemPickup (yz.a(sa,int)) casts the world to a WorldServer for its tracker; it is only recorded here.
  public static class Q extends PlayerKnockbackProbe.P {
    static List<Integer> pickups = new ArrayList<>();
    Q(ahb world) { super(world); }
    public void a(sa e, int n) { pickups.add(n); }
  }
  static yz player(S w) throws Exception {
    Q p = new Q(w);
    set(p, "Z", new Random(0));
    p.a(yj.a).a(1000.0); p.g(1000.0f);
    PlayerKnockbackProbe.place(p, 0.5, 65.62, 0.5);
    return p;
  }
  static void set(Object o, String n, Object v) throws Exception { MobMoveProbe.set(o, n, v); }
  static int arrows(yz p) { int n = 0; for (add s : p.bm.a) if (s != null && s.b() == ade.g) n += s.b; return n; }
  static int stacks(yz p) { int n = 0; for (add s : p.bm.a) if (s != null) n++; return n; }
  static void fill(yz p, String inv) {
    java.util.Arrays.fill(p.bm.a, null);
    switch (inv) {
      case "arrows": p.bm.a[0] = new add(ade.g, 10, 0); break;
      case "full": for (int i = 0; i < 36; i++) p.bm.a[i] = new add(adb.d(1), 64, 0); break;
      case "full63": for (int i = 0; i < 35; i++) p.bm.a[i] = new add(adb.d(1), 64, 0); p.bm.a[35] = new add(ade.g, 63, 0); break;
      case "full64": for (int i = 0; i < 35; i++) p.bm.a[i] = new add(adb.d(1), 64, 0); p.bm.a[35] = new add(ade.g, 64, 0); break;
      default: break;
    }
  }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    S w = (S) u.allocateInstance(S.class);
    PlayerKnockbackProbe.w = w; PlayerKnockbackProbe.u = u; DifficultyProbe.w = w; EquipmentProbe.u = u;
    set(w, "s", new Random(2)); set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    MobMoveProbe.field(ahb.class, "t").set(w, u.allocateInstance(aqq.class));
    Calendar date = Calendar.getInstance(); date.clear(); date.set(2014, Calendar.JUNE, 1);
    MobMoveProbe.field(ahb.class, "J").set(w, date);
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
    String[] invs = { "empty", "arrows", "full", "full63", "full64" };
    for (int shake : new int[] { 0, 1, 2, 7, 8 }) for (boolean ground : new boolean[] { true, false }) for (int pickup = 0; pickup < 3; pickup++)
      for (boolean creative : new boolean[] { false, true }) for (String inv : invs) {
        yz p = player(w);
        p.bE.d = creative;
        fill(p, inv);
        zc a = new zc(w, 0.5, 65.0, 0.5);
        set(a, "i", ground); set(a, "b", shake); set(a, "a", pickup);
        set(a, "Z", new Random(7));
        S.sounds.clear(); Q.pickups.clear();
        int before = arrows(p);
        a.b_(p);
        float next = ((Random) MobMoveProbe.field(sa.class, "Z").get(a)).nextFloat();
        System.out.println("{\"case\":\"pickup\",\"shake\":" + shake + ",\"inGround\":" + ground + ",\"pickup\":" + pickup + ",\"creative\":" + creative + ",\"inventory\":\"" + inv
          + "\",\"removed\":" + MobMoveProbe.b(a, "K") + ",\"arrowsBefore\":" + before + ",\"arrowsAfter\":" + arrows(p) + ",\"stacksAfter\":" + stacks(p) + ",\"pickedUp\":" + Q.pickups + ",\"sounds\":" + S.sounds + ",\"nextFloat\":" + Float.toString(next) + "}");
      }
  }
}
