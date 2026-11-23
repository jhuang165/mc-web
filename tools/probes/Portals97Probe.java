import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Random;

// Batch 97 portals97: mobs through Entity.travelToDimension (sa.b(I)V, unchanged 1.7.10 classes). Built on EntityPortalProbe's sparse
// WorldServer doubles (mt), MinecraftServer double and the real oi.transferEntityToWorld / Teleporter. A real mob (EntityList.createEntityByName, real
// constructor) is loaded from an edited native compound, given timeUntilPortal 300 and sent through e.b(to): EntityList.createEntityByName(id, newWorld),
// copyDataFrom (sa.a(sa, true): old.writeToNBT -> copy.readFromNBT), spawnEntityInWorld on the destination double (captured here).
// Records (one JSON object per line):
//   mob    {name, from, to, src (the written compound of the loaded mob), copy (the copy's written compound), same (they are equal after removing Pos, Motion, Rotation, Dimension, PortalCooldown), pos, rot, cooldown, removed}
//   pitch  {from, to, pitchBefore, pitchAfter}  the copy's rotationPitch for a mob entity of pitch 33
public class Portals97Probe {
  static sun.misc.Unsafe U;
  static sa lastSpawn;
  static int spawnDim;
  static int removed;
  public static class TW2 extends EntityPortalProbe.TW {
    TW2() { super(); }
    public boolean d(sa e) { lastSpawn = e; spawnDim = dim; return true; }
    public void e(sa e) { removed++; if (e.l != null) e.l.a((sa) null); if (e.m != null) e.a((sa) null); }
  }
  static TW2 world(int dim, long seed, int floor) throws Exception {
    TW2 w = (TW2) U.allocateInstance(TW2.class); w.dim = dim; w.seed = seed; w.floor = floor; w.cells = new HashMap<>(); w.spawnX = 3; w.spawnY = 64; w.spawnZ = -5;
    aqo p = (aqo) U.allocateInstance(dim == -1 ? aqp.class : dim == 1 ? aqr.class : aqq.class);
    EntityPortalProbe.fld(aqo.class, "h").set(p, new float[16]); EntityPortalProbe.fld(aqo.class, "j").set(p, new float[4]); EntityPortalProbe.fld(ahb.class, "t").set(w, p); p.a(w);
    EntityPortalProbe.fld(ahb.class, "C").set(w, new qi()); EntityPortalProbe.fld(ahb.class, "L").set(w, new ArrayList<Object>()); EntityPortalProbe.fld(ahb.class, "E").set(w, false);
    EntityPortalProbe.fld(ahb.class, "s").set(w, new Random(dim + 77));
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); if (f.get(w) == null) f.set(w, new ArrayList()); }
    w.tele = new ahp(w);
    return w;
  }
  static void bind(TW2 a, TW2 b, TW2 c) throws Exception {
    EntityPortalProbe.TS s = (EntityPortalProbe.TS) U.allocateInstance(EntityPortalProbe.TS.class);
    EntityPortalProbe.fld(net.minecraft.server.MinecraftServer.class, "c").set(s, new mt[] { a, b, c });
    EntityPortalProbe.fld(net.minecraft.server.MinecraftServer.class, "u").set(s, U.allocateInstance(EntityPortalProbe.TC.class));
    EntityPortalProbe.fld(net.minecraft.server.MinecraftServer.class, "j").set(null, s);
    for (TW2 w : new TW2[] { a, b, c }) EntityPortalProbe.fld(mt.class, "J").set(w, s);
  }
  static String hex(dh tag) throws Exception {
    java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new java.io.DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static String q(String s) { return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  interface Edit { void apply(dh t) throws Exception; }
  static dh item(int id, int count, int dmg) { dh t = new dh(); t.a("id", (short) id); t.a("Count", (byte) count); t.a("Damage", (short) dmg); return t; }
  static dh stripped(dh t) {
    dh o = (dh) t.b();
    for (String k : new String[] { "Pos", "Motion", "Rotation", "Dimension", "PortalCooldown" }) { try { Method m = dh.class.getDeclaredMethod("o", String.class); m.setAccessible(true); m.invoke(o, k); } catch (Exception e) { removeKey(o, k); } }
    return o;
  }
  static void removeKey(dh t, String k) {
    try {
      for (Field f : dh.class.getDeclaredFields()) if (java.util.Map.class.isAssignableFrom(f.getType())) { f.setAccessible(true); ((java.util.Map) f.get(t)).remove(k); }
    } catch (Exception e) { throw new RuntimeException(e); }
  }
  static void mob(String name, String id, int from, int to, Edit edit) throws Exception {
    TW2 over = world(0, 11, 60), nether = world(-1, 11, 31), end = world(1, 11, 40); bind(over, nether, end);
    TW2 src = from == 0 ? over : from == -1 ? nether : end;
    sa fresh = sg.a(id, src);
    if (fresh == null) throw new IllegalStateException("no mob " + id);
    fresh.b(40.5, 62.0, -12.5, 71f, 0f);
    dh t = new dh(); fresh.c(t); edit.apply(t);
    sa e = sg.a(t, src);
    if (e == null) throw new IllegalStateException("not loaded " + name);
    dh before = new dh(); e.c(before);
    e.am = 300; e.ap = src.dim;
    lastSpawn = null; removed = 0;
    e.b(to);
    sa copy = lastSpawn;
    String res;
    if (copy == null) res = "\"copy\":null";
    else {
      dh after = new dh(); copy.c(after);
      boolean same = stripped(before).toString().equals(stripped(after).toString());
      res = "\"srcHex\":\"" + hex(before) + "\",\"copyHex\":\"" + hex(after) + "\",\"src\":" + q(before.toString()) + ",\"copy\":" + q(after.toString()) + ",\"same\":" + same + ",\"copyClass\":" + q(copy.getClass().getSimpleName())
        + ",\"pos\":[" + copy.s + "," + copy.t + "," + copy.u + "],\"rot\":[" + copy.y + "," + copy.z + "],\"cooldown\":" + copy.am + ",\"dim\":" + spawnDim + ",\"copyDimensionField\":" + copy.ap;
    }
    System.out.println("{\"kind\":\"mob\",\"name\":" + q(name) + ",\"from\":" + from + ",\"to\":" + to + ",\"removed\":" + removed + "," + res + "}");
  }
  static void pitch(int from, int to, float pitch) throws Exception {
    TW2 over = world(0, 12, 60), nether = world(-1, 12, 31), end = world(1, 12, 40); bind(over, nether, end);
    TW2 src = from == 0 ? over : from == -1 ? nether : end;
    sa e = sg.a("Pig", src);
    e.b(40.5, src.floor + 1.0, -12.5, 71f, pitch);
    e.am = 300; e.ap = src.dim; lastSpawn = null;
    e.b(to);
    System.out.println("{\"kind\":\"pitch\",\"from\":" + from + ",\"to\":" + to + ",\"pitchBefore\":" + pitch + ",\"pitchAfter\":" + (lastSpawn == null ? "null" : "" + lastSpawn.z) + ",\"yawAfter\":" + (lastSpawn == null ? "null" : "" + lastSpawn.y) + "}");
  }
  public static void main(String[] args) throws Throwable {
    Field uf = sun.misc.Unsafe.class.getDeclaredField("theUnsafe"); uf.setAccessible(true); U = (sun.misc.Unsafe) uf.get(null);
    aji.p(); adb.l();
    EntityPortalProbe.INFO = (ays) U.allocateInstance(ays.class);
    Edit none = t -> {};
    int[][] routes = { { 0, -1 }, { -1, 0 }, { 0, 1 }, { 1, 1 } };
    for (int[] r : routes) for (float p : new float[] { 33f, -20f }) pitch(r[0], r[1], p);
    Edit leashUuid = t -> { t.a("Leashed", true); dh l = new dh(); l.a("UUIDMost", 11L); l.a("UUIDLeast", 22L); t.a("Leash", l); };
    Edit leashKnot = t -> { t.a("Leashed", true); dh l = new dh(); l.a("X", 10); l.a("Y", 64); l.a("Z", -3); t.a("Leash", l); };
    Edit common = t -> { t.a("CustomName", "Bessie"); t.a("CustomNameVisible", true); t.a("PersistenceRequired", true); t.a("Fire", (short) 25); t.a("Air", (short) 100); t.a("FallDistance", 3.5f); t.a("AbsorptionAmount", 4f); t.a("HurtTime", (short) 5); t.a("DeathTime", (short) 0); t.a("AttackTime", (short) 3); t.a("HealF", 6f); };
    Edit effects = t -> { dq list = new dq(); dh f = new dh(); f.a("Id", (byte) 1); f.a("Amplifier", (byte) 2); f.a("Duration", 900); f.a("Ambient", true); list.a(f); dh g = new dh(); g.a("Id", (byte) 10); g.a("Amplifier", (byte) 0); g.a("Duration", 40); g.a("Ambient", false); list.a(g); t.a("ActiveEffects", list); };
    for (int[] r : new int[][] { { 0, -1 }, { -1, 0 }, { 0, 1 } }) {
      String rt = r[0] + ">" + r[1];
      mob("pig-common-" + rt, "Pig", r[0], r[1], t -> { common.apply(t); effects.apply(t); t.a("Saddle", true); t.a("Age", -12000); t.a("InLove", 200); });
      mob("cow-leash-uuid-" + rt, "Cow", r[0], r[1], t -> { common.apply(t); leashUuid.apply(t); t.a("Age", 5000); });
      mob("cow-leash-knot-" + rt, "Cow", r[0], r[1], leashKnot);
    }
    int[] r0 = { 0, -1 };
    mob("sheep", "Sheep", 0, -1, t -> { t.a("Color", (byte) 14); t.a("Sheared", true); common.apply(t); });
    mob("wolf", "Wolf", 0, -1, t -> { t.a("OwnerUUID", "00000000-0000-0001-0000-000000000002"); t.a("Sitting", true); t.a("CollarColor", (byte) 3); t.a("Angry", false); common.apply(t); });
    mob("ocelot", "Ozelot", 0, -1, t -> { t.a("OwnerUUID", "00000000-0000-0001-0000-000000000002"); t.a("Sitting", true); t.a("CatType", 2); });
    mob("chicken-jockey", "Chicken", 0, -1, t -> { t.a("IsChickenJockey", true); t.a("Age", -100); });
    mob("creeper", "Creeper", 0, -1, t -> { t.a("powered", true); t.a("ignited", true); t.a("Fuse", (short) 12); t.a("ExplosionRadius", (byte) 5); });
    mob("zombie-gear", "Zombie", 0, -1, t -> {
      dq eq = new dq(); eq.a(item(268, 1, 10)); eq.a(item(301, 1, 3)); eq.a(new dh()); eq.a(item(307, 1, 0)); eq.a(new dh()); t.a("Equipment", eq);
      dq dc = new dq(); for (float v : new float[] { 0.5f, 1f, 0f, 0.25f, 0.085f }) dc.a(new dm(v)); t.a("DropChances", dc);
      t.a("CanPickUpLoot", true); t.a("IsBaby", true); common.apply(t);
    });
    mob("skeleton-wither", "Skeleton", 0, -1, t -> { t.a("SkeletonType", (byte) 1); dq eq = new dq(); eq.a(item(272, 1, 7)); eq.a(new dh()); eq.a(new dh()); eq.a(new dh()); eq.a(new dh()); t.a("Equipment", eq); });
    mob("villager", "Villager", 0, -1, t -> {
      t.a("Profession", 2); t.a("Riches", 77); t.a("Age", 3000);
      dq rec = new dq(); dh o = new dh(); o.a("buy", item(295, 20, 0)); o.a("sell", item(388, 1, 0)); o.a("uses", 3); o.a("maxUses", 7); rec.a(o);
      dh offers = new dh(); offers.a("Recipes", rec); t.a("Offers", offers); common.apply(t);
    });
    mob("horse", "EntityHorse", 0, -1, t -> {
      t.a("Type", 0); t.a("Variant", 0x0102); t.a("Tame", true); t.a("Temper", 40); t.a("Bred", true); t.a("HasReproduced", true); t.a("EatingHaystack", true);
      t.a("OwnerUUID", "00000000-0000-0001-0000-000000000002"); t.a("Saddle", true); t.a("SaddleItem", item(329, 1, 0)); t.a("ArmorItem", item(417, 1, 0)); common.apply(t);
    });
    mob("donkey-chest", "EntityHorse", 0, -1, t -> {
      t.a("Type", 1); t.a("Tame", true); t.a("ChestedHorse", true); dq items = new dq(); dh a = item(264, 5, 0); a.a("Slot", (byte) 2); items.a(a); t.a("Items", items); t.a("SaddleItem", item(329, 1, 0));
    });
    mob("slime", "Slime", 0, -1, t -> { t.a("Size", 2); t.a("HealF", 3f); });
    mob("pigman", "PigZombie", -1, 0, t -> { t.a("Anger", (short) 200); dq eq = new dq(); eq.a(item(283, 1, 0)); eq.a(new dh()); eq.a(new dh()); eq.a(new dh()); eq.a(new dh()); t.a("Equipment", eq); });
    mob("iron-golem", "VillagerGolem", 0, -1, t -> { t.a("PlayerCreated", true); });
    mob("enderman", "Enderman", 0, -1, t -> { t.a("carried", (short) 2); t.a("carriedData", (short) 0); });
    mob("bat", "Bat", 0, -1, t -> { t.a("BatFlags", (byte) 1); });
    mob("mooshroom", "MushroomCow", 0, -1, t -> { t.a("Age", -300); });
  }
}
