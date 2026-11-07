import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.util.*;

// Batch 21 interchange evidence on the unchanged 1.7.10 classes (HorseGearProbe's world double; no class is patched or shipped).
//  owner       tg.b(String) (setOwner, what wv.a(yz) / EntityOcelot call with player.getUniqueID().toString()) and wi.b(String): the keys that
//              Entity.writeToNBTOptional (sa.c) writes for a tamed wolf, ocelot and horse, an untamed one, and the same compound read back
//              with sg.a(dh, ahb) and written again. Keys of the written compound are listed with their NBT type ids.
//  ownerRead   hand-edited compounds: OwnerUUID, the pre-UUID Owner name (nz.a, PreYggdrasilConverter, needs a MinecraftServer, so the
//              outcome or its exception is recorded) and neither.
//  leashWrite  sw.b(dh) for a holder that is a player with UUID (1,2) and a knot, on a wolf, an ocelot and a horse.
//  attrs       sg.a(name, world) for every registered EntityList name, written with sa.c; the Attributes list of every EntityLivingBase,
//              in the native order, with base, final value and modifiers; plus a read-back (sg.a(dh, ahb)) and a second write.
//  attrVariant hand-edited compounds (IsBaby, Size, OwnerUUID, ActiveEffects) loaded and written again.
public class InterchangeLinkProbe {
  static void out(String s) { System.out.println(s); }
  static String q(String s) { return HorseProbe.str(s); }
  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static String keys(dh t) {
    StringBuilder s = new StringBuilder("{");
    boolean first = true;
    for (Object k : new TreeSet<Object>(t.c())) {
      if (!first) s.append(",");
      first = false;
      s.append(q((String) k)).append(":").append(t.a((String) k).a());
    }
    return s.append("}").toString();
  }
  static String attrs(sv e) {
    StringBuilder s = new StringBuilder("[");
    boolean first = true;
    for (Object o : e.bc().a()) {
      ti a = (ti) o;
      if (!first) s.append(",");
      first = false;
      s.append("{\"name\":").append(q(a.a().a())).append(",\"base\":").append(a.b()).append(",\"value\":").append(a.e()).append(",\"modifiers\":[");
      boolean f2 = true;
      for (Object mo : a.c()) {
        tj m = (tj) mo;
        if (!f2) s.append(",");
        f2 = false;
        s.append("{\"name\":").append(q(m.b())).append(",\"amount\":").append(m.d()).append(",\"operation\":").append(m.c())
          .append(",\"uuid\":").append(q(m.a().toString())).append(",\"saved\":").append(m.e()).append("}");
      }
      s.append("]}");
    }
    return s.append("]").toString();
  }
  static String attrsTag(dh t) {
    dq list = t.c("Attributes", 10);
    StringBuilder s = new StringBuilder("[");
    for (int i = 0; i < list.c(); i++) {
      dh a = list.b(i);
      if (i > 0) s.append(",");
      s.append("{\"name\":").append(q(a.j("Name"))).append(",\"base\":").append(a.i("Base")).append(",\"modifiers\":[");
      if (a.b("Modifiers", 9)) {
        dq ms = a.c("Modifiers", 10);
        for (int k = 0; k < ms.c(); k++) {
          dh m = ms.b(k);
          if (k > 0) s.append(",");
          s.append("{\"name\":").append(q(m.j("Name"))).append(",\"amount\":").append(m.i("Amount")).append(",\"operation\":").append(m.f("Operation"))
            .append(",\"most\":").append(m.g("UUIDMost")).append(",\"least\":").append(m.g("UUIDLeast")).append("}");
        }
      }
      s.append("]}");
    }
    return s.append("]").toString();
  }
  static sa place(sa e) throws Exception {
    HorseGearProbe.at(e, 100.5, 64.0, -20.25);
    e.b(100.5, 64.0, -20.25);
    return e;
  }
  static sa make(String name) throws Exception {
    Random r = new Random(7);
    sa e = sg.a(name, HorseProbe.W);
    if (e == null) return null;
    MobMoveProbe.set(e, "Z", new Random(7));
    return place(e);
  }
  static sa reload(dh t) { return sg.a(t, HorseProbe.W); }

  static void owner(String kind, sa e, Runnable tame) throws Exception {
    for (int tamed = 0; tamed < 2; tamed++) {
      if (tamed == 1) tame.run();
      dh t = new dh();
      e.c(t);
      sa back = reload(t);
      dh t2 = new dh();
      back.c(t2);
      out("{\"case\":\"owner\",\"kind\":" + q(kind) + ",\"tamed\":" + (tamed == 1) + ",\"keys\":" + keys(t) + ",\"ownerUUID\":" + (t.c("OwnerUUID") ? q(t.j("OwnerUUID")) : "null")
        + ",\"owner\":" + (t.c("Owner") ? q(t.j("Owner")) : "null") + ",\"tame\":" + (t.c("Tame") ? t.n("Tame") : t.c("Sitting")) + ",\"nbt\":\"" + hex(t) + "\",\"rewrite\":\"" + hex(t2) + "\"}");
    }
  }

  static String ownerOf(sa e) {
    if (e instanceof tg) return ((tg) e).b();
    return ((wi) e).ch();
  }
  static boolean tamedOf(sa e) {
    if (e instanceof tg) return ((tg) e).bZ();
    return ((wi) e).cc();
  }
  static void ownerRead(String kind, String name, String ownerUUID, String legacyOwner) throws Exception {
    sa e = make(name);
    dh t = new dh();
    e.c(t);
    if (ownerUUID != null) t.a("OwnerUUID", ownerUUID); else t.o("OwnerUUID");
    if (legacyOwner != null) t.a("Owner", legacyOwner);
    String result, error = null;
    try {
      sa back = reload(t);
      result = "{\"owner\":" + q(ownerOf(back)) + ",\"tamed\":" + tamedOf(back) + "}";
    } catch (Throwable x) {
      result = "null";
      error = x.getClass().getName();
    }
    out("{\"case\":\"ownerRead\",\"kind\":" + q(kind) + ",\"entity\":" + q(name) + ",\"ownerUUID\":" + (ownerUUID == null ? "null" : q(ownerUUID)) + ",\"legacyOwner\":" + (legacyOwner == null ? "null" : q(legacyOwner))
      + ",\"result\":" + result + ",\"error\":" + (error == null ? "null" : q(error)) + "}");
  }

  static void leashWrite(String name) throws Exception {
    HorseGearProbe.GW.entities.clear();
    HorseGearProbe.GW.fx = 5; HorseGearProbe.GW.fy = 0; HorseGearProbe.GW.fz = 0; HorseGearProbe.GW.fid = 85;
    sw a = (sw) make(name), b = (sw) make(name);
    yz p = LeashProbe.player(false);
    su knot = su.a(HorseProbe.W, 5, 0, 0);
    a.b(p, true);
    b.b(knot, true);
    dh ta = new dh(), tb = new dh();
    a.c(ta);
    b.c(tb);
    out("{\"case\":\"leashWrite\",\"entity\":" + q(name) + ",\"playerLeashed\":" + ta.n("Leashed") + ",\"playerKeys\":" + keys(ta.m("Leash")) + ",\"most\":" + ta.m("Leash").g("UUIDMost") + ",\"least\":" + ta.m("Leash").g("UUIDLeast")
      + ",\"knotKeys\":" + keys(tb.m("Leash")) + ",\"x\":" + tb.m("Leash").f("X") + ",\"y\":" + tb.m("Leash").f("Y") + ",\"z\":" + tb.m("Leash").f("Z") + "}");
  }

  static void record(String c, String kind, sa e) throws Exception {
    dh t = new dh();
    e.c(t);
    sa back = reload(t);
    dh t2 = new dh();
    back.c(t2);
    String live = e instanceof sv ? attrs((sv) e) : "[]";
    String backLive = back instanceof sv ? attrs((sv) back) : "[]";
    StringBuilder s = new StringBuilder("{\"case\":" + q(c) + ",\"kind\":" + q(kind) + ",\"id\":" + q(sg.b(e)) + ",\"hasAttributes\":" + t.b("Attributes", 9));
    s.append(",\"attributes\":").append(t.b("Attributes", 9) ? attrsTag(t) : "[]").append(",\"live\":").append(live);
    s.append(",\"rewriteAttributes\":").append(t2.b("Attributes", 9) ? attrsTag(t2) : "[]").append(",\"liveBack\":").append(backLive);
    s.append(",\"stable\":").append(hex(t).equals(hex(t2)));
    s.append(",\"health\":").append(((sv) e).aS()).append(",\"healthBack\":").append(((sv) back).aS());
    s.append(",\"nbt\":\"").append(hex(t)).append("\"}");
    out(s.toString());
  }
  static void variant(String kind, String name, Edit edit) throws Exception {
    sa e = make(name);
    dh t = new dh();
    e.c(t);
    edit.apply(t);
    sa edited = reload(t);
    if (edited == null) throw new IllegalStateException("not loaded " + kind);
    record("attrVariant", kind, edited);
  }
  interface Edit { void apply(dh t) throws Exception; }
  static dh effect(int id, int amp, int duration) {
    dh e = new dh();
    e.a("Id", (byte) id); e.a("Amplifier", (byte) amp); e.a("Duration", duration); e.a("Ambient", false);
    return e;
  }
  static void withEffects(dh t, dh... effects) {
    dq l = new dq();
    for (dh e : effects) l.a(e);
    t.a("ActiveEffects", l);
  }

  @SuppressWarnings("unchecked")
  public static void main(String[] args) throws Exception {
    HorseGearProbe.setup();
    // ---- owner and leash links ----
    final String uuid = new UUID(1L, 2L).toString();
    {
      final sa wolf = make("Wolf"), cat = make("Ozelot");
      owner("wolf", wolf, () -> { ((tg) wolf).b(uuid); ((tg) wolf).j(true); });
      owner("ocelot", cat, () -> { ((tg) cat).b(uuid); ((tg) cat).j(true); });
      final wi horse = HorseProbe.typed(5, 0);
      HorseGearProbe.at(horse, 100.5, 64.0, -20.25);
      owner("horse", horse, () -> { horse.i(true); horse.b(uuid); });
    }
    ownerRead("uuid", "Wolf", uuid, null);
    ownerRead("legacyName", "Wolf", null, "Player");
    ownerRead("legacyNameLong", "Wolf", null, "A-name-longer-than-sixteen-chars");
    ownerRead("both", "Wolf", uuid, "Player");
    ownerRead("empty", "Wolf", "", "");
    ownerRead("uuid", "Ozelot", uuid, null);
    ownerRead("legacyName", "Ozelot", null, "Player");
    ownerRead("uuid", "EntityHorse", uuid, null);
    ownerRead("legacyName", "EntityHorse", null, "Player");
    for (String n : new String[] { "Wolf", "Ozelot", "EntityHorse", "Pig" }) leashWrite(n);

    // ---- attributes for every registered living class ----
    List<String> names = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) names.add((String) k);
    Collections.sort(names);
    for (String n : names) {
      sa e;
      try { e = make(n); } catch (Throwable x) { out("{\"case\":\"attrsError\",\"id\":" + q(n) + ",\"error\":" + q(x.toString()) + "}"); continue; }
      if (e == null) { out("{\"case\":\"attrsError\",\"id\":" + q(n) + ",\"error\":\"null\"}"); continue; }
      if (!(e instanceof sv)) { out("{\"case\":\"notLiving\",\"id\":" + q(n) + "}"); continue; }
      try { record("attrs", "default", e); } catch (Throwable x) { out("{\"case\":\"attrsError\",\"id\":" + q(n) + ",\"error\":" + q(x.toString()) + "}"); }
    }
    for (int type = 0; type < 5; type++) for (long seed = 1; seed <= 3; seed++) {
      wi h = HorseProbe.typed(seed, type);
      HorseGearProbe.at(h, 100.5, 64.0, -20.25);
      record("attrVariant", "horse" + type + "seed" + seed, h);
    }
    variant("babyZombie", "Zombie", t -> t.a("IsBaby", true));
    variant("babyVillagerZombie", "Zombie", t -> { t.a("IsBaby", true); t.a("IsVillager", true); });
    variant("witherSkeleton", "Skeleton", t -> t.a("SkeletonType", (byte) 1));
    variant("babyPigman", "PigZombie", t -> t.a("IsBaby", true));
    for (int size : new int[] { 0, 1, 2, 3, 6 }) {
      final int s = size;
      variant("slimeSize" + size, "Slime", t -> t.a("Size", s));
      variant("magmaSize" + size, "LavaSlime", t -> t.a("Size", s));
    }
    variant("tamedWolf", "Wolf", t -> t.a("OwnerUUID", uuid));
    variant("tamedWolfHealth", "Wolf", t -> { t.a("OwnerUUID", uuid); t.a("HealF", 12.0f); });
    variant("angryWolf", "Wolf", t -> t.a("Angry", true));
    variant("tamedOcelot", "Ozelot", t -> t.a("OwnerUUID", uuid));
    for (int[] fx : new int[][] { { 1, 0 }, { 1, 1 }, { 2, 0 }, { 5, 0 }, { 5, 2 }, { 18, 0 }, { 18, 1 }, { 21, 0 }, { 21, 2 }, { 22, 0 } }) {
      final int[] f = fx;
      variant("zombieEffect" + fx[0] + "a" + fx[1], "Zombie", t -> withEffects(t, effect(f[0], f[1], 600)));
    }
    variant("zombieSpeedStrength", "Zombie", t -> withEffects(t, effect(1, 1, 600), effect(5, 0, 600)));
    variant("pigSpeed", "Pig", t -> withEffects(t, effect(1, 0, 600)));
    variant("villagerSlow", "Villager", t -> withEffects(t, effect(2, 0, 600)));
    variant("golemStrength", "VillagerGolem", t -> withEffects(t, effect(5, 1, 600)));
    variant("pigmanSpeed", "PigZombie", t -> withEffects(t, effect(1, 0, 600)));
    variant("babyZombieSpeed", "Zombie", t -> { t.a("IsBaby", true); withEffects(t, effect(1, 0, 600)); });
  }
}
