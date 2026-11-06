import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;

// Chunk-save NBT of the live mob state batch 9 added, written and read by the unchanged 1.7.10 classes on the
// HorseGearProbe world double: EntityLiving.writeEntityToNBT / readEntityFromNBT (sw.b / sw.a: CanPickUpLoot,
// PersistenceRequired, Equipment, DropChances, Leashed / Leash), Entity.writeToNBT (sa.e: PortalCooldown), EntitySkeleton (yl),
// EntityZombie (yq), EntityPigZombie (yh), EntityLeashKnot (su) and EntityList.createEntityFromNBT (sg.a). One JSON line each:
//   gear   {kind, nbtWritten, nbt (the loaded mob written again), equipment [[id,count,damage,[[ench,lvl]..]]|null x5],
//           dropChances, canPickUpLoot, persistent, portalCooldown, skeletonType, health}
//   leash  a mob held by a knot or by a player: Leash compound, and the knot's own su.d(NBT) result and tag
//   knotLoad  EntityList.createEntityFromNBT of a LeashKnot compound with TileX/TileY/TileZ/Direction
public class MobGearNbtProbe {
  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static String q(String s) { return HorseProbe.str(s); }
  static String pairs(dq l) {
    StringBuilder b = new StringBuilder("[");
    if (l != null) for (int i = 0; i < l.c(); i++) { if (i > 0) b.append(','); dh t = l.b(i); b.append('[').append(t.e("id")).append(',').append(t.e("lvl")).append(']'); }
    return b.append(']').toString();
  }
  static String enc(add s) { return s == null ? "null" : "[" + adb.b(s.b()) + "," + s.b + "," + s.k() + "," + pairs(s.r()) + "]"; }
  static add make(int id, int damage, int... ench) {
    add s = new add(adb.d(id), 1, damage);
    if (ench.length > 0) {
      dq l = new dq();
      for (int i = 0; i < ench.length; i += 2) { dh t = new dh(); t.a("id", (short) ench[i]); t.a("lvl", (short) ench[i + 1]); l.a(t); }
      if (!s.p()) s.d(new dh());
      s.q().a("ench", l);
    }
    return s;
  }
  interface Edit { void apply(sw e, dh t) throws Exception; }
  static void field(Object o, Class c, String n, Object v) throws Exception { MobMoveProbe.field(c, n).set(o, v); }

  static void gear(String kind, sw fresh, Edit prep, Edit edit) throws Exception {
    LeashProbe.reset();
    HorseGearProbe.at(fresh, 100.5, 64.0, -20.25);
    prep.apply(fresh, null);
    dh t = new dh();
    if (!fresh.c(t)) throw new IllegalStateException("not saved: " + kind);
    String written = hex(t);
    edit.apply(fresh, t);
    sa e0 = sg.a(t, HorseProbe.W);
    if (e0 == null) throw new IllegalStateException("not loaded: " + kind);
    sw e = (sw) e0;
    dh out = new dh();
    e.c(out);
    float[] chances = (float[]) MobMoveProbe.field(sw.class, "e").get(e);
    StringBuilder eq = new StringBuilder("["), ch = new StringBuilder("[");
    for (int i = 0; i < 5; i++) { if (i > 0) { eq.append(','); ch.append(','); } eq.append(enc(e.q(i))); ch.append(chances[i]); }
    StringBuilder s = new StringBuilder("{\"case\":\"gear\",\"kind\":" + q(kind) + ",\"id\":" + q(sg.b(e)) + ",\"nbtWritten\":\"" + written + "\",\"nbt\":\"" + hex(out) + "\"");
    s.append(",\"equipment\":").append(eq.append(']')).append(",\"dropChances\":").append(ch.append(']'));
    s.append(",\"canPickUpLoot\":").append(e.bJ()).append(",\"persistent\":").append(MobMoveProbe.field(sw.class, "bt").getBoolean(e));
    s.append(",\"portalCooldown\":").append(MobMoveProbe.field(sa.class, "am").get(e)).append(",\"skeletonType\":").append(e instanceof yl ? ((yl) e).cb() : -1);
    s.append(",\"health\":").append(e.aS()).append(",\"x\":").append(e.s).append(",\"z\":").append(e.u);
    System.out.println(s.append("}"));
  }
  static void chances(sw e, float... v) throws Exception { float[] c = (float[]) MobMoveProbe.field(sw.class, "e").get(e); for (int i = 0; i < v.length; i++) c[i] = v[i]; }
  static Edit none = (e, t) -> {};

  public static void main(String[] args) throws Exception {
    HorseGearProbe.setup();
    // Fully armed zombie: enchanted weapon and armour, custom drop chances, pickup, persistence and a portal cooldown.
    gear("zombieFull", new yq(HorseProbe.W), (e, t) -> {
      e.c(0, make(276, 5, 16, 3, 20, 1)); e.c(1, make(309, 7, 0, 2)); e.c(2, make(308, 0)); e.c(3, make(307, 11, 4, 1, 7, 3)); e.c(4, make(306, 2, 5, 3));
      chances(e, 1.0f, 0.5f, 0.25f, 0.1f, 0.0f); e.h(true); MobMoveProbe.field(sw.class, "bt").setBoolean(e, true); MobMoveProbe.field(sa.class, "am").setInt(e, 150);
    }, none);
    gear("zombieEmpty", new yq(HorseProbe.W), none, none);
    gear("zombieVillagerGear", new yq(HorseProbe.W), (e, t) -> { e.c(4, make(298, 0)); e.c(0, make(272, 0)); }, (e, t) -> { t.a("IsVillager", true); t.a("IsBaby", true); });
    gear("skeletonBow", new yl(HorseProbe.W), (e, t) -> { e.c(0, make(261, 12, 48, 4, 50, 1)); e.c(4, make(298, 0, 1, 2)); chances(e, 0.0f, 0.085f, 0.085f, 0.085f, 2.0f); }, none);
    gear("skeletonDefault", new yl(HorseProbe.W), none, none);
    gear("witherSkeleton", new yl(HorseProbe.W), (e, t) -> { e.c(0, make(272, 3, 16, 2)); }, (e, t) -> { t.a("SkeletonType", (byte) 1); });
    gear("pigmanSword", new yh(HorseProbe.W), (e, t) -> { e.c(0, make(283, 0, 20, 2)); e.c(2, make(316, 4)); MobMoveProbe.field(sa.class, "am").setInt(e, 40); }, (e, t) -> { t.a("Anger", (short) 400); });
    gear("pigmanDefault", new yh(HorseProbe.W), none, none);
    // Edited tags: a short Equipment list (the missing slots read as empty compounds), a short DropChances list, CanPickUpLoot
    // removed (read as false), Equipment of the wrong tag type (ignored, constructor gear stays), PortalCooldown outside 0..300.
    gear("zombieShortLists", new yq(HorseProbe.W), (e, t) -> { e.c(1, make(309, 0)); chances(e, 0.4f, 0.4f, 0.4f, 0.4f, 0.4f); }, (e, t) -> {
      dq l = new dq(); l.a(make(276, 0).b(new dh())); t.a("Equipment", l);
      dq d = new dq(); d.a(new dm(0.9f)); d.a(new dm(0.8f)); t.a("DropChances", d);
    });
    gear("skeletonEquipmentWrongType", new yl(HorseProbe.W), (e, t) -> { e.h(true); }, (e, t) -> { t.a("Equipment", 5); t.a("DropChances", "x"); t.o("CanPickUpLoot"); });
    gear("zombieEmptyCompounds", new yq(HorseProbe.W), (e, t) -> { e.c(0, make(276, 0)); e.c(3, make(299, 0)); }, (e, t) -> {
      dq l = new dq(); for (int i = 0; i < 5; i++) l.a(new dh()); t.a("Equipment", l);
    });
    gear("zombieStackCountAndDamage", new yq(HorseProbe.W), none, (e, t) -> {
      dq l = new dq(); dh a = new dh(); a.a("id", (short) 276); a.a("Count", (byte) 7); a.a("Damage", (short) 9999); l.a(a);
      dh b = new dh(); b.a("id", (short) 9999); b.a("Count", (byte) 1); b.a("Damage", (short) 0); l.a(b);
      t.a("Equipment", l);
    });
    for (int pc : new int[] { 0, 1, 300, 301, -7, 100000 }) gear("zombiePortal" + pc, new yq(HorseProbe.W), none, (e, t) -> { t.a("PortalCooldown", pc); });

    // Leashes: the lead's NBT as the native writer makes it, for an armoured zombie held by a knot and a pig held by the player.
    for (String holder : new String[] { "knot", "player" }) {
      LeashProbe.reset();
      LeashProbe.fence(5, 0, 0);
      su knot = su.a(HorseProbe.W, 5, 0, 0);
      yz p = LeashProbe.player(false);
      yq z = new yq(HorseProbe.W);
      HorseGearProbe.at(z, 5.5, 0, 0.5);
      z.c(0, make(272, 0));
      z.b(holder.equals("knot") ? knot : p, true);
      dh t = new dh();
      z.c(t);
      dh leash = t.m("Leash");
      String kt = holder.equals("knot") ? "{X:" + leash.f("X") + ",Y:" + leash.f("Y") + ",Z:" + leash.f("Z") + "}" : "{UUIDMost,UUIDLeast}";
      dh knotTag = new dh();
      boolean knotSaved = knot.d(knotTag);
      sa back = sg.a(t, HorseProbe.W);
      System.out.println("{\"case\":\"leash\",\"holder\":" + q(holder) + ",\"nbt\":\"" + hex(t) + "\",\"leashed\":" + t.n("Leashed") + ",\"leash\":" + q(leash.toString()) + ",\"leashShape\":" + q(kt)
        + ",\"knotWritesToChunk\":" + knotSaved + ",\"knotTag\":" + q(knotTag.toString()) + ",\"reloaded\":" + (back != null) + ",\"reloadedLeashed\":" + (back != null && ((sw) back).bN()) + "}");
    }
    // A chunk entity compound with the LeashKnot id (an EntityHanging layout): su.a(dh) is empty, so none of it is read.
    LeashProbe.reset();
    dh k = new dh();
    k.a("id", "LeashKnot"); k.a("TileX", 7); k.a("TileY", 65); k.a("TileZ", -3); k.a("Direction", (byte) 2);
    dq pos = new dq(); pos.a(new dk(7.5)); pos.a(new dk(65.5)); pos.a(new dk(-2.5)); k.a("Pos", pos);
    sa made = sg.a(k, HorseProbe.W);
    System.out.println("{\"case\":\"knotLoad\",\"created\":" + (made != null) + ",\"class\":" + q(made == null ? "" : made.getClass().getName()) + ",\"x\":" + (made == null ? 0 : made.s) + ",\"y\":" + (made == null ? 0 : made.t) + ",\"z\":" + (made == null ? 0 : made.u)
      + ",\"id\":" + q(made == null ? "" : sg.b(made)) + "}");
  }
}
