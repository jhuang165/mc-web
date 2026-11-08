import java.util.*;

// Batch 28 leads2 evidence on the unchanged 1.7.10 classes (LeashProbe's HorseGearProbe world double, extended with real
// bounding-box entity lookups and a player-by-UUID lookup; no class is patched). One JSON object per line:
//  lead
//   leadWrite   sw.b(dh) of a mob held by another mob (pig, wolf, horse as the holder or the held), by a player and by a knot
//   leadRead    sw.a(dh) then sw.bL (the first updateLeashedState: bP) for Leash tags naming another mob, the mob itself, a dead
//               or absent holder, a UUID with no match, UUID plus X/Y/Z, a half UUID, numeric and wrong-typed X/Y/Z, a tag that
//               is not a compound, Leashed without a tag; the tag that would be saved before and after the first tick
//   leadLive    td.bL of a mob held by another mob over holder distances (path, pull, break, home) and a holder that dies
//   leadCycle   two mobs holding each other
//   leadUse     sw.c(yz) with a lead in hand on a mob held by another mob, on tamed wolves and ocelots (owner, foreign owner)
//   leadKnot    su.c(yz) and adf.a(...) with a mob held by another mob and one held by the player
//  horse
//   horseOwner  wi.a(yz) (interact), mounting and the GUI over OwnerUUID text, tame and items; wi.b(dh)/wi.a(dh) OwnerUUID round trips
//   horseTame   vg.e (EntityAIRunAroundLikeCrazy) with a player rider and with a mob rider
//  size
//   sizes       yz.q(sa) (EntityPlayer.interactWith) with a held stack of size -2..2 on wolves, ocelots, sheep, horses, pigs and cows
public class Leads2Probe {
  static final UUID PLAYER = new UUID(1L, 2L), HOLDER = new UUID(7L, 8L), OTHER = new UUID(9L, 9L);

  public static class L2 extends HorseGearProbe.GW {
    public List a(Class c, azt box) {
      List<sa> out = new ArrayList<>();
      for (sa e : entities) if (c.isInstance(e) && box.b(e.C)) out.add(e);
      return out;
    }
    public yz a(UUID id) {
      for (sa e : entities) if (e instanceof yz && id.equals(e.aB())) return (yz) e;
      return null;
    }
  }

  static void out(String s) { System.out.println(s); }
  static String str(String s) { return HorseProbe.str(s); }
  static L2 world;

  static void setup() throws Exception {
    aji.p();
    adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    HorseGearProbe.u = u;
    L2 w = (L2) u.allocateInstance(L2.class);
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    MobMoveProbe.set(w, "t", u.allocateInstance(aqq.class));
    final apx empty = (apx) u.allocateInstance(apx.class);
    MobMoveProbe.set(empty, "u", new apz[16]);
    MobMoveProbe.set(w, "v", java.lang.reflect.Proxy.newProxyInstance(apu.class.getClassLoader(), new Class[] { apu.class }, (proxy, m, a) -> {
      Class r = m.getReturnType();
      if (r == apx.class) return empty;
      if (r == boolean.class) return true;
      if (r == int.class) return 0;
      return null;
    }));
    world = w;
    HorseProbe.W = w;
    HorseProbe.player = HorseProbe.makePlayer(false);
  }
  static void reset() { LeashProbe.reset(); }
  static void put(sa e, double x, double y, double z) { e.b(x, y, z); HorseGearProbe.GW.entities.add(e); }

  static sw mob(String kind, long seed) throws Exception {
    sw e;
    if (kind.equals("horse")) { e = HorseGearProbe.gearHorse(0, false); }
    else if (kind.startsWith("wolf")) e = new wv(HorseProbe.W);
    else if (kind.startsWith("ocelot")) e = new wn(HorseProbe.W);
    else if (kind.equals("sheep")) e = new wp(HorseProbe.W);
    else if (kind.equals("cow")) e = new wg(HorseProbe.W);
    else e = new wo(HorseProbe.W);
    MobMoveProbe.set(e, "Z", new Random(seed));
    MobMoveProbe.set(e, "D", true);
    return e;
  }
  static void uuid(sa e, UUID id) throws Exception { MobMoveProbe.set(e, "ar", id); }
  static yz player(boolean creative) throws Exception { yz p = LeashProbe.player(creative); return p; }
  static String drops() { return HorseProbe.strings(HorseProbe.World.items); }
  static String holderKind(sw e, sa self, sa player, sa holder) {
    sa h = e.bO();
    if (h == null) return "none";
    if (h == self) return "self";
    if (h == player) return "player";
    if (h == holder) return "holder";
    if (h instanceof su) return "knot";
    return "other";
  }
  static String knotAt(sw e) {
    return e.bO() instanceof su ? "[" + ((su) e.bO()).b + "," + ((su) e.bO()).c + "," + ((su) e.bO()).d + "]" : "null";
  }
  static String saved(sw e) {
    dh t = new dh();
    e.b(t);
    String leash = t.b("Leash", 10) ? t.m("Leash").toString() : "";
    return "{\"leashed\":" + t.n("Leashed") + ",\"leash\":" + str(leash) + "}";
  }

  // ---- leadWrite ----
  static void leadWrite() throws Exception {
    String[][] pairs = { { "pig", "pig" }, { "wolfStanding", "pig" }, { "horse", "pig" }, { "pig", "horse" }, { "pig", "wolfStanding" }, { "ocelotWild", "wolfStanding" } };
    for (String[] pr : pairs) {
      reset();
      sw held = mob(pr[0], 3), holder = mob(pr[1], 4);
      uuid(holder, HOLDER);
      put(held, 0, 0, 0);
      put(holder, 3, 0, 0);
      held.b(holder, true);
      out("{\"case\":\"leadWrite\",\"held\":" + str(pr[0]) + ",\"holder\":" + str(pr[1]) + ",\"saved\":" + saved(held) + ",\"holderSaved\":" + saved(holder) + ",\"leashed\":" + held.bN() + ",\"holderIsHolder\":" + (held.bO() == holder) + "}");
    }
  }

  // ---- leadRead ----
  static dh leash(String kind, UUID holder) {
    dh l = new dh();
    switch (kind) {
      case "uuid": l.a("UUIDMost", holder.getMostSignificantBits()); l.a("UUIDLeast", holder.getLeastSignificantBits()); break;
      case "uuidAndXyz": l.a("UUIDMost", holder.getMostSignificantBits()); l.a("UUIDLeast", holder.getLeastSignificantBits()); l.a("X", 5); l.a("Y", 0); l.a("Z", 0); break;
      case "uuidWrongAndXyz": l.a("UUIDMost", OTHER.getMostSignificantBits()); l.a("UUIDLeast", OTHER.getLeastSignificantBits()); l.a("X", 5); l.a("Y", 0); l.a("Z", 0); break;
      case "mostOnly": l.a("UUIDMost", holder.getMostSignificantBits()); break;
      case "mostOnlyXyz": l.a("UUIDMost", holder.getMostSignificantBits()); l.a("X", 5); l.a("Y", 0); l.a("Z", 0); break;
      case "leastOnly": l.a("UUIDLeast", holder.getLeastSignificantBits()); break;
      case "uuidInts": l.a("UUIDMost", (int) holder.getMostSignificantBits()); l.a("UUIDLeast", (int) holder.getLeastSignificantBits()); break;
      case "uuidStrings": l.a("UUIDMost", "7"); l.a("UUIDLeast", "8"); break;
      case "empty": break;
      case "xyzBytes": l.a("X", (byte) 5); l.a("Y", (byte) 0); l.a("Z", (byte) 0); break;
      case "xyzShorts": l.a("X", (short) 5); l.a("Y", (short) 0); l.a("Z", (short) 0); break;
      case "xyzLongs": l.a("X", 5L); l.a("Y", 0L); l.a("Z", 0L); break;
      case "xyzFloats": l.a("X", 5.7f); l.a("Y", 0.2f); l.a("Z", -0.4f); break;
      case "xyzDoubles": l.a("X", 5.7); l.a("Y", 0.2); l.a("Z", -0.4); break;
      case "xyzNegDoubles": l.a("X", -5.7); l.a("Y", -0.2); l.a("Z", -0.4); break;
      case "xyzStrings": l.a("X", "5"); l.a("Y", "0"); l.a("Z", "0"); break;
      case "xyzMissingZ": l.a("X", 5); l.a("Y", 0); break;
      default: break;
    }
    return l;
  }
  static void leadRead() throws Exception {
    // (kind, holder dx, dy, holder in list, holder dead)
    Object[][] cases = {
      { "uuid", "mobNear", 3.0, 0.0, true, false }, { "uuid", "mobFar", 20.0, 0.0, true, false },
      { "uuid", "mobEdge10.8", 10.8, 0.0, true, false }, { "uuid", "mobEdge10.9", 10.9, 0.0, true, false }, { "uuid", "mobEdge10.95", 10.95, 0.0, true, false }, { "uuid", "mobEdge11", 11.0, 0.0, true, false },
      { "uuid", "mobAbove", 0.0, 10.5, true, false }, { "uuid", "mobAbove11", 0.0, 11.7, true, false }, { "uuid", "mobBelow", 0.0, -10.8, true, false },
      { "uuid", "mobDead", 3.0, 0.0, true, true }, { "uuid", "mobNotListed", 3.0, 0.0, false, false },
      { "uuid", "mobHolder0", 0.0, 0.0, true, false },
      { "uuidAndXyz", "uuidWinsOverXyz", 3.0, 0.0, true, false }, { "uuidWrongAndXyz", "wrongUuidWithXyz", 3.0, 0.0, true, false },
      { "mostOnly", "mostOnly", 3.0, 0.0, true, false }, { "mostOnlyXyz", "mostOnlyWithXyz", 3.0, 0.0, true, false }, { "leastOnly", "leastOnly", 3.0, 0.0, true, false },
      { "uuidInts", "uuidInts", 3.0, 0.0, true, false }, { "uuidStrings", "uuidStrings", 3.0, 0.0, true, false },
      { "empty", "emptyCompound", 3.0, 0.0, true, false },
      { "xyzBytes", "xyzBytes", 3.0, 0.0, true, false }, { "xyzShorts", "xyzShorts", 3.0, 0.0, true, false }, { "xyzLongs", "xyzLongs", 3.0, 0.0, true, false },
      { "xyzFloats", "xyzFloats", 3.0, 0.0, true, false }, { "xyzDoubles", "xyzDoubles", 3.0, 0.0, true, false }, { "xyzNegDoubles", "xyzNegDoubles", 3.0, 0.0, true, false },
      { "xyzStrings", "xyzStrings", 3.0, 0.0, true, false }, { "xyzMissingZ", "xyzMissingZ", 3.0, 0.0, true, false },
    };
    String[] heldKinds = { "pig", "wolfStanding", "horse" };
    for (String hk : heldKinds) for (Object[] c : cases) {
      if (!hk.equals("pig") && !String.valueOf(c[1]).matches("mobNear|mobFar|mobDead|mobHolder0|uuidWinsOverXyz|emptyCompound|xyzDoubles")) continue;
      reset();
      HorseGearProbe.GW.fx = 5; HorseGearProbe.GW.fy = 0; HorseGearProbe.GW.fz = 0;
      sw e = mob(hk, 3);
      sw holder = mob("pig", 4);
      uuid(holder, HOLDER);
      yz p = player(false);
      put(e, 0, 0, 0);
      boolean listed = (Boolean) c[4];
      double hx = (Double) c[2], hy = (Double) c[3];
      if (String.valueOf(c[1]).equals("mobHolder0")) { hx = 0; hy = 0; }
      holder.b(hx, hy, 0);
      if (listed) HorseGearProbe.GW.entities.add(holder);
      p.b(4, 0, 0);
      HorseGearProbe.GW.entities.add(p);
      if ((Boolean) c[5]) MobMoveProbe.set(holder, "K", true);
      dh tag = new dh();
      tag.a("Leashed", true);
      if (!c[0].equals("none")) tag.a("Leash", leash((String) c[0], HOLDER));
      e.a(tag);
      String before = saved(e);
      LeashProbe.bL(e);
      out("{\"case\":\"leadRead\",\"held\":" + str(hk) + ",\"name\":" + str(String.valueOf(c[1])) + ",\"leashKind\":" + str((String) c[0]) + ",\"leashed\":" + e.bN() + ",\"holder\":" + str(holderKind(e, e, p, holder))
        + ",\"knotAt\":" + knotAt(e) + ",\"knotsAfter\":" + LeashProbe.knots() + ",\"drops\":" + drops() + ",\"savedBeforeTick\":" + before + ",\"savedAfterTick\":" + saved(e) + "}");
    }
    // self holder: the mob's own UUID, in the list
    {
      reset();
      sw e = mob("pig", 3);
      uuid(e, HOLDER);
      put(e, 0, 0, 0);
      dh tag = new dh();
      tag.a("Leashed", true);
      tag.a("Leash", leash("uuid", HOLDER));
      e.a(tag);
      LeashProbe.bL(e);
      out("{\"case\":\"leadRead\",\"held\":\"pig\",\"name\":\"self\",\"leashKind\":\"uuid\",\"leashed\":" + e.bN() + ",\"holder\":" + str(holderKind(e, e, null, null)) + ",\"knotsAfter\":0,\"drops\":" + drops() + ",\"savedBeforeTick\":null,\"savedAfterTick\":" + saved(e) + "}");
    }
    // two entities with the same UUID: the first in the list wins
    {
      reset();
      sw e = mob("pig", 3), a = mob("pig", 4), b = mob("pig", 5);
      uuid(a, HOLDER); uuid(b, HOLDER);
      put(e, 0, 0, 0); put(b, 2, 0, 0); put(a, 3, 0, 0);
      dh tag = new dh();
      tag.a("Leashed", true);
      tag.a("Leash", leash("uuid", HOLDER));
      e.a(tag);
      LeashProbe.bL(e);
      out("{\"case\":\"leadRead\",\"held\":\"pig\",\"name\":\"duplicateUuid\",\"leashKind\":\"uuid\",\"leashed\":" + e.bN() + ",\"firstInList\":" + (e.bO() == b) + ",\"secondInList\":" + (e.bO() == a) + ",\"drops\":" + drops() + "}");
    }
    // Leash is not a compound (a string), and Leashed false with a tag, and Leashed absent
    for (String kind : new String[] { "leashString", "leashedFalse", "leashedAbsent", "leashedNoTag", "leashedByte2" }) {
      reset();
      sw e = mob("pig", 3), holder = mob("pig", 4);
      uuid(holder, HOLDER);
      put(e, 0, 0, 0); put(holder, 3, 0, 0);
      dh tag = new dh();
      if (kind.equals("leashString")) { tag.a("Leashed", true); tag.a("Leash", "x"); }
      if (kind.equals("leashedFalse")) { tag.a("Leashed", false); tag.a("Leash", leash("uuid", HOLDER)); }
      if (kind.equals("leashedAbsent")) { tag.a("Leash", leash("uuid", HOLDER)); }
      if (kind.equals("leashedNoTag")) { tag.a("Leashed", true); }
      if (kind.equals("leashedByte2")) { tag.a("Leashed", (byte) 2); tag.a("Leash", leash("uuid", HOLDER)); }
      e.a(tag);
      String before = saved(e);
      LeashProbe.bL(e);
      out("{\"case\":\"leadRead\",\"held\":\"pig\",\"name\":" + str(kind) + ",\"leashKind\":\"uuid\",\"leashed\":" + e.bN() + ",\"holder\":" + str(holderKind(e, e, null, holder)) + ",\"knotsAfter\":" + LeashProbe.knots()
        + ",\"drops\":" + drops() + ",\"savedBeforeTick\":" + before + ",\"savedAfterTick\":" + saved(e) + "}");
    }
    HorseGearProbe.GW.fx = Integer.MIN_VALUE;
  }

  // ---- leadLive ----
  static void leadLive() throws Exception {
    String[] kinds = { "pig", "horse", "wolfSitting", "wolfStanding" };
    for (String kind : kinds) for (double dist : new double[] { 1, 3.9, 4.0, 4.1, 5.9, 6.0, 6.1, 8, 9.9, 10.0, 10.1, 12 }) for (double dy : new double[] { 0, 3 }) {
      reset();
      sw e = mob(kind, 3);
      if (kind.equals("horse")) HorseGearProbe.at(e, 0, 0, 0);
      e.b(0.0, 0.0, 0.0);
      MobMoveProbe.set(e, "D", true);
      if (kind.equals("wolfSitting")) { ((tg) e).j(true); ((tg) e).k(true); }
      sw holder = mob("pig", 4);
      uuid(holder, HOLDER);
      put(e, 0, 0, 0);
      put(holder, dist, dy, 0);
      e.b(holder, true);
      String steps = "[";
      for (int i = 0; i < 2; i++) { LeashProbe.bL(e); steps += (i > 0 ? "," : "") + "{" + LeashProbe.state(e) + "}"; }
      out("{\"case\":\"leadLive\",\"mob\":" + str(kind) + ",\"distance\":" + dist + ",\"dy\":" + dy + ",\"steps\":" + steps + "]}");
    }
    // the holder dies (isDead) before the tick; the holder is another mob far away on a later tick
    for (int mode = 0; mode < 3; mode++) {
      reset();
      sw e = mob("pig", 3), holder = mob("pig", 4);
      uuid(holder, HOLDER);
      put(e, 0, 0, 0); put(holder, 3, 0, 0);
      e.b(holder, true);
      LeashProbe.bL(e);
      String first = LeashProbe.state(e);
      if (mode == 0) MobMoveProbe.set(holder, "K", true);
      if (mode == 1) holder.b(30, 0, 0);
      if (mode == 2) { MobMoveProbe.set(holder, "K", true); HorseGearProbe.GW.entities.remove(holder); }
      LeashProbe.bL(e);
      out("{\"case\":\"leadLive\",\"mob\":\"pig\",\"event\":" + str(mode == 0 ? "holderDead" : mode == 1 ? "holderFar" : "holderDeadRemoved") + ",\"first\":{" + first + "},\"second\":{" + LeashProbe.state(e) + "}}");
    }
    // a leashed mob that dies drops its lead where it stands (setDead -> clearLeashed(true, true)), and the holder keeps no record
    {
      reset();
      sw e = mob("pig", 3), holder = mob("pig", 4);
      uuid(holder, HOLDER);
      put(e, 0, 0, 0); put(holder, 3, 0, 0);
      e.b(holder, true);
      e.B(); // setDead (sa.B)
      out("{\"case\":\"leadLive\",\"mob\":\"pig\",\"event\":\"heldSetDead\",\"leashed\":" + e.bN() + ",\"drops\":" + drops() + "}");
    }
    // mobs holding each other: positions 5 apart, then 12 apart
    for (double d : new double[] { 5, 8, 12 }) {
      reset();
      sw a = mob("pig", 3), b = mob("pig", 4);
      uuid(a, new UUID(11L, 1L)); uuid(b, new UUID(11L, 2L));
      put(a, 0, 0, 0); put(b, d, 0, 0);
      a.b(b, true); b.b(a, true);
      LeashProbe.bL(a); LeashProbe.bL(b);
      out("{\"case\":\"leadCycle\",\"distance\":" + d + ",\"a\":{" + LeashProbe.state(a) + "},\"b\":{" + LeashProbe.state(b) + "},\"aLeashed\":" + a.bN() + ",\"bLeashed\":" + b.bN() + "}");
    }
  }

  // ---- leadUse ----
  static void ownerOf(sw e, String owner) {
    if (e instanceof tg) {
      ((tg) e).j(!owner.equals("wild"));
      if (owner.equals("player")) ((tg) e).b(PLAYER.toString());
      else if (owner.equals("foreign")) ((tg) e).b(OTHER.toString());
      else if (owner.equals("blank")) ((tg) e).b("");
    }
  }
  static void leadUse() throws Exception {
    // a mob already held by another mob, clicked with a lead in hand and with an empty hand
    for (String subject : new String[] { "pig", "horse" }) for (int creative = 0; creative < 2; creative++) for (int lead = 0; lead < 2; lead++) {
      reset();
      sw e = mob(subject, 3), holder = mob("pig", 4);
      uuid(holder, HOLDER);
      yz p = player(creative == 1);
      put(e, 0, 0, 0); put(holder, 3, 0, 0); put(p, 0, 0, 1);
      e.b(holder, true);
      if (lead == 1) HorseProbe.hold(p, new add(ade.ca, 2));
      boolean r = e.c(p);
      out("{\"case\":\"leadUse\",\"kind\":\"heldByMob\",\"subject\":" + str(subject) + ",\"creative\":" + (creative == 1) + ",\"lead\":" + (lead == 1) + ",\"result\":" + r + ",\"leashed\":" + e.bN() + ",\"holder\":" + str(holderKind(e, e, p, holder))
        + ",\"heldAfter\":" + (HorseProbe.held(p) == null ? 0 : HorseProbe.held(p).b) + ",\"drops\":" + drops() + "}");
    }
    // tamed wolves and ocelots: the owner, a foreign owner and a wild one clicked with a lead
    for (String subject : new String[] { "wolfStanding", "ocelotWild" }) for (String owner : new String[] { "wild", "player", "foreign", "blank" }) for (int creative = 0; creative < 2; creative++) {
      reset();
      sw e = mob(subject, 3);
      yz p = player(creative == 1);
      put(e, 0, 0, 0); put(p, 0, 0, 1);
      ownerOf(e, owner);
      HorseProbe.hold(p, new add(ade.ca, 2));
      boolean r = e.c(p);
      boolean viaInteract = false;
      out("{\"case\":\"leadUse\",\"kind\":\"tamed\",\"subject\":" + str(subject) + ",\"owner\":" + str(owner) + ",\"creative\":" + (creative == 1) + ",\"result\":" + r + ",\"leashed\":" + e.bN() + ",\"holder\":" + str(holderKind(e, e, p, null))
        + ",\"heldAfter\":" + (HorseProbe.held(p) == null ? 0 : HorseProbe.held(p).b) + ",\"sitting\":" + ((tg) e).ca() + "}");
      // the same click through EntityPlayer.interactWith
      reset();
      sw e2 = mob(subject, 3);
      yz p2 = player(creative == 1);
      put(e2, 0, 0, 0); put(p2, 0, 0, 1);
      ownerOf(e2, owner);
      HorseProbe.hold(p2, new add(ade.ca, 2));
      boolean r2 = p2.q(e2);
      out("{\"case\":\"leadUse\",\"kind\":\"tamedInteractWith\",\"subject\":" + str(subject) + ",\"owner\":" + str(owner) + ",\"creative\":" + (creative == 1) + ",\"result\":" + r2 + ",\"leashed\":" + e2.bN()
        + ",\"heldAfter\":" + (HorseProbe.held(p2) == null ? 0 : HorseProbe.held(p2).b) + ",\"sitting\":" + ((tg) e2).ca() + "}");
    }
    // a leashed tamed wolf held by the player: the owner's empty-hand click frees it, a foreign owner's does not
    for (String owner : new String[] { "player", "foreign" }) {
      reset();
      sw e = mob("wolfStanding", 3);
      yz p = player(false);
      put(e, 0, 0, 0); put(p, 0, 0, 1);
      ownerOf(e, owner);
      e.b(p, true);
      HorseProbe.hold(p, null);
      boolean r = e.c(p);
      out("{\"case\":\"leadUse\",\"kind\":\"unleashTamed\",\"owner\":" + str(owner) + ",\"result\":" + r + ",\"leashed\":" + e.bN() + ",\"drops\":" + drops() + "}");
    }
  }

  // ---- leadKnot ----
  static void leadKnot() throws Exception {
    // adf.a (fence) and su.c (existing knot): a mob held by the player and one held by another mob, both near
    for (int existing = 0; existing < 2; existing++) {
      reset();
      HorseGearProbe.GW.fx = 5; HorseGearProbe.GW.fy = 0; HorseGearProbe.GW.fz = 0;
      su knot = existing == 1 ? su.a(HorseProbe.W, 5, 0, 0) : null;
      yz p = player(false);
      sw own = mob("pig", 3), byMob = mob("pig", 4), holder = mob("pig", 5);
      uuid(holder, HOLDER);
      put(p, 5, 0, 3);
      put(own, 5, 0, 1); put(byMob, 6, 0, 1); put(holder, 7, 0, 0);
      own.b(p, true);
      byMob.b(holder, true);
      boolean used;
      if (existing == 1) { HorseProbe.hold(p, new add(ade.ca, 1)); used = knot.c(p); }
      else used = new adf().a(new add(ade.ca, 1), p, HorseProbe.W, 5, 0, 0, 1, 0.5f, 0.5f, 0.5f);
      out("{\"case\":\"leadKnot\",\"existing\":" + (existing == 1) + ",\"used\":" + used + ",\"ownIsKnot\":" + (own.bO() instanceof su) + ",\"ownLeashed\":" + own.bN() + ",\"byMobHolder\":" + str(holderKind(byMob, byMob, p, holder))
        + ",\"byMobLeashed\":" + byMob.bN() + ",\"knots\":" + LeashProbe.knots() + "}");
    }
    HorseGearProbe.GW.fx = Integer.MIN_VALUE;
  }

  // ---- horseOwner ----
  static void horseOwner() throws Exception {
    String[] owners = { "", PLAYER.toString(), OTHER.toString(), "Steve", " ", "not-a-uuid" };
    String[] items = { "none", "saddle", "wheat", "sugar", "chest", "ironArmor" };
    for (String owner : owners) for (int type : new int[] { 0, 1, 3 }) for (int tame = 0; tame < 2; tame++) for (String item : items) for (int sneak = 0; sneak < 2; sneak++) {
      reset();
      HorseProbe.FakePlayer.sneak = sneak == 1;
      wi e = HorseGearProbe.gearHorse(type, false);
      e.i(tame == 1);
      e.b(owner);
      e.c(0);
      yz p = HorseGearProbe.freshPlayer(false);
      p.b(0, 0, 0);
      HorseProbe.hold(p, item.equals("none") ? null : HorseProbe.itemStack(item, 2));
      boolean r = e.a(p);
      HorseProbe.FakePlayer.sneak = false;
      out("{\"case\":\"horseOwner\",\"owner\":" + str(owner) + ",\"type\":" + type + ",\"tame\":" + (tame == 1) + ",\"item\":" + str(item) + ",\"sneak\":" + (sneak == 1) + ",\"result\":" + r
        + ",\"horse\":" + HorseProbe.horseState(e) + ",\"held\":" + HorseProbe.stack(HorseProbe.held(p)) + ",\"gui\":" + HorseProbe.FakePlayer.guiOpens + ",\"mounted\":" + (MobMoveProbe.field(sa.class, "l").get(e) != null) + "}");
    }
    // OwnerUUID NBT: written text for tame/untame with each owner, read back for strings, empty, absent and the wrong type
    for (String owner : owners) for (int tame = 0; tame < 2; tame++) {
      reset();
      wi e = HorseGearProbe.gearHorse(0, false);
      e.i(tame == 1);
      e.b(owner);
      dh t = new dh();
      e.b(t);
      out("{\"case\":\"horseOwnerWrite\",\"owner\":" + str(owner) + ",\"tame\":" + (tame == 1) + ",\"tag\":" + str(t.j("OwnerUUID")) + ",\"hasKey\":" + t.c("OwnerUUID") + ",\"tameTag\":" + t.n("Tame") + "}");
    }
    for (String kind : new String[] { "text", "empty", "absent", "int", "legacyOwner", "blankText" }) for (int tame = 0; tame < 2; tame++) {
      reset();
      wi src = HorseGearProbe.gearHorse(0, false);
      dh t = new dh();
      src.b(t);
      t.a("Tame", tame == 1);
      t.o("OwnerUUID");
      if (kind.equals("text")) t.a("OwnerUUID", OTHER.toString());
      if (kind.equals("empty")) t.a("OwnerUUID", "");
      if (kind.equals("int")) t.a("OwnerUUID", 5);
      if (kind.equals("legacyOwner")) t.a("Owner", "Steve");
      if (kind.equals("blankText")) t.a("OwnerUUID", " ");
      wi e = HorseGearProbe.gearHorse(0, false);
      e.a(t);
      out("{\"case\":\"horseOwnerRead\",\"kind\":" + str(kind) + ",\"tame\":" + (tame == 1) + ",\"owner\":" + str(e.ch()) + ",\"tameAfter\":" + e.cc() + "}");
    }
  }

  // ---- horseTame ----
  static void horseTame() throws Exception {
    for (String rider : new String[] { "player", "pig" }) for (long seed = 0; seed < 30; seed++) {
      reset();
      wi e = HorseProbe.horse(seed);
      e.a((sy) null);
      e.i(false);
      e.u(60);
      yz p = HorseGearProbe.freshPlayer(false);
      sw mobRider = null;
      if (rider.equals("player")) p.a((sa) e);
      else if (rider.equals("pig")) { mobRider = mob("pig", 2); MobMoveProbe.field(sa.class, "m").set(mobRider, e); MobMoveProbe.field(sa.class, "l").set(e, mobRider); }
      vg task = new vg(e, 1.2);
      boolean should = !e.cc() && MobMoveProbe.field(sa.class, "l").get(e) != null; // vg.a() minus the random-position search (wi.cc() false, a rider)
      StringBuilder ev = new StringBuilder();
      for (int tick = 0; tick < 400; tick++) {
        HorseProbe.World.states.clear();
        int tBefore = e.cq();
        task.e();
        if (!HorseProbe.World.states.isEmpty()) {
          ev.append(ev.length() > 0 ? "," : "").append("{\"tick\":" + tick + ",\"status\":" + HorseProbe.World.states.get(0) + ",\"tame\":" + e.cc() + ",\"temperBefore\":" + tBefore + ",\"temperAfter\":" + e.cq()
            + ",\"owner\":" + str(e.ch()) + ",\"riderLeft\":" + (MobMoveProbe.field(sa.class, "l").get(e) == null) + "}");
          break;
        }
        if (e.cq() != tBefore) ev.append("temper+");
      }
      out("{\"case\":\"horseTame\",\"rider\":" + str(rider) + ",\"seed\":" + seed + ",\"shouldExecute\":" + should + ",\"events\":[" + ev + "]}");
    }
  }

  // ---- sizes ----
  static String mobState(String kind, sw e) throws Exception {
    if (kind.startsWith("wolf")) { wv w = (wv) e; return WolfProbe.wolfState(w); }
    if (kind.startsWith("ocelot")) return OcelotProbe.catState((wn) e);
    if (kind.equals("horse")) return HorseProbe.horseState((wi) e);
    if (kind.equals("sheep")) { wp s = (wp) e; return "{\"color\":" + s.bY() + ",\"sheared\":" + s.bZ() + ",\"age\":" + ((rx) s).d() + ",\"inLove\":" + s.ce() + "}"; }
    if (kind.equals("pig")) return "{\"saddled\":" + ((wo) e).bZ() + ",\"age\":" + ((rx) e).d() + ",\"inLove\":" + ((wf) e).ce() + "}";
    return "{\"age\":" + ((rx) e).d() + ",\"inLove\":" + ((wf) e).ce() + "}";
  }
  static void sizes() throws Exception {
    // subject, state, item
    String[] subjects = { "wolfWild", "wolfOwned", "wolfForeign", "ocelotWild", "ocelotOwned", "sheep", "sheepSheared", "lamb", "horseWild", "horseTame", "horseFoal", "horseHurt", "pig", "pigBaby", "cow" };
    Object[][] items = {
      { "bone", 352, 0 }, { "beef", 363, 0 }, { "rottenFlesh", 367, 0 }, { "dyeBlue", 351, 4 }, { "dyeRed", 351, 1 }, { "dyeWhite", 351, 15 }, { "dyeBlack", 351, 0 },
      { "rawFish", 349, 0 }, { "wheat", 296, 0 }, { "sugar", 353, 0 }, { "apple", 260, 0 }, { "goldenApple", 322, 0 }, { "carrot", 391, 0 }, { "saddle", 329, 0 },
      { "shears", 359, 0 }, { "stick", 280, 0 }, { "lead", 420, 0 }, { "bucket", 325, 0 },
    };
    for (String subject : subjects) for (Object[] it : items) for (int creative = 0; creative < 2; creative++) for (int count : new int[] { -2, -1, 0, 1, 2 }) {
      reset();
      MobMoveProbe.set(world, "s", new Random(1000));
      sw e;
      String kind;
      if (subject.startsWith("wolf")) kind = "wolf"; else if (subject.startsWith("ocelot")) kind = "ocelot"; else if (subject.startsWith("sheep") || subject.equals("lamb")) kind = "sheep";
      else if (subject.startsWith("horse")) kind = "horse"; else if (subject.startsWith("pig")) kind = "pig"; else kind = "cow";
      e = mob(kind, 7);
      yz p = player(creative == 1);
      put(e, 0, 0, 1); put(p, 0, 0, 0);
      e.b(0, 0, 1);
      if (kind.equals("horse")) { wi h = (wi) e; h.a((sy) null); h.i(!subject.equals("horseWild")); if (subject.equals("horseFoal")) h.c(-12000); if (subject.equals("horseHurt")) HorseProbe.setHealth(h, 5f); }
      if (subject.equals("wolfOwned")) ownerOf(e, "player");
      if (subject.equals("wolfForeign")) ownerOf(e, "foreign");
      if (subject.equals("ocelotWild")) OcelotProbe.setTempt((wn) e, true);
      if (subject.equals("ocelotOwned")) ownerOf(e, "player");
      if (subject.equals("sheepSheared")) ((wp) e).i(true);
      if (subject.equals("lamb") || subject.equals("pigBaby")) ((wf) e).c(-12000);
      add held = new add(adb.d((Integer) it[1]), count, (Integer) it[2]);
      HorseProbe.hold(p, held);
      boolean r; String error = null;
      try { r = p.q(e); } catch (Throwable x) { r = false; error = x.toString(); }
      add after = HorseProbe.held(p);
      out("{\"case\":\"sizes\",\"subject\":" + str(subject) + ",\"item\":" + str((String) it[0]) + ",\"creative\":" + (creative == 1) + ",\"count\":" + count + ",\"result\":" + r + ",\"after\":" + HorseProbe.stack(after)
        + ",\"sameStack\":" + (after == held) + ",\"heldCount\":" + held.b + ",\"mob\":" + mobState(kind, e) + ",\"states\":" + HorseProbe.ints(HorseProbe.World.states) + ",\"drops\":" + drops()
        + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    String mode = args.length > 0 ? args[0] : "lead";
    setup();
    out("--items--");
    if (mode.equals("lead")) { leadWrite(); leadRead(); leadLive(); leadUse(); leadKnot(); }
    if (mode.equals("horse")) { horseOwner(); horseTame(); }
    if (mode.equals("sizes")) sizes();
  }
}
