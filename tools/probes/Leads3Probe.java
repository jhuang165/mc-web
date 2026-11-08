import java.util.*;

// Batch 29 leads3 evidence on the unchanged 1.7.10 classes (Leads2Probe's world double). One JSON object per line:
//  leadDeath   a leashed mob killed through EntityLivingBase.attackEntityFrom (sv.a(ro, F)) and ticked with onUpdate (sw.h -> sv.h, td.bL) until
//              setDead: per tick the leash flag, isDead, deathTime, drops, motion; the holder alive, far, dead; a knot holder
//  leadDimension  sa.a(sa, true) (Entity.copyDataFrom, what Entity.travelToDimension runs on the clone) of a leashed mob, then the clone's first
//              sw.bL in a world with the holder absent, near, far, the old entity flagged dead (travelToDimension sets isDead last)
public class Leads3Probe {
  static final UUID HOLDER = new UUID(7L, 8L);
  static void out(String s) { System.out.println(s); }
  static String str(String s) { return HorseProbe.str(s); }
  static boolean dead(sa e) throws Exception { return MobMoveProbe.b(e, "K"); }
  static int deathTime(sv e) throws Exception { return MobMoveProbe.field(sv.class, "aA").getInt(e); }

  static void leadDeath() throws Exception {
    // deathTime field name check
    for (String kind : new String[] { "pig", "wolfStanding", "sheep" }) for (String holderKind : new String[] { "player", "mob", "knot" }) for (String event : new String[] { "none", "holderFar", "holderDies", "holderFarAfterDeath" }) {
      if (holderKind.equals("knot") && event.equals("holderDies")) continue;
      Leads2Probe.reset();
      sw e = Leads2Probe.mob(kind, 3);
      Leads2Probe.put(e, 0, 0, 0);
      yz p = Leads2Probe.player(false);
      p.b(3, 0, 0);
      sw holder = Leads2Probe.mob("pig", 4);
      Leads2Probe.uuid(holder, HOLDER);
      holder.b(3, 0, 0);
      sa holderEnt;
      if (holderKind.equals("player")) { HorseGearProbe.GW.entities.add(p); holderEnt = p; e.b(p, true); }
      else if (holderKind.equals("mob")) { HorseGearProbe.GW.entities.add(holder); holderEnt = holder; e.b(holder, true); }
      else { LeashProbe.fence(5, 0, 0); su k = su.a(HorseProbe.W, 5, 0, 0); HorseGearProbe.GW.entities.add(k); holderEnt = k; e.b(k, true); }
      boolean killed = e.a(ro.j, 1000f);
      StringBuilder ticks = new StringBuilder();
      int last = -1;
      for (int t = 0; t < 26; t++) {
        if (t == 5 && event.equals("holderFar")) holderEnt.b(40, 0, 0);
        if (t == 5 && event.equals("holderDies")) MobMoveProbe.set(holderEnt, "K", true);
        if (t == 12 && event.equals("holderFarAfterDeath")) holderEnt.b(40, 0, 0);
        e.h();
        ticks.append(t > 0 ? "," : "").append("{\"t\":" + t + ",\"leashed\":" + e.bN() + ",\"isDead\":" + dead(e) + ",\"deathTime\":" + deathTime(e) + ",\"drops\":" + Leads2Probe.drops() + ",\"y\":" + e.t + "}");
        if (dead(e)) { last = t; if (t >= 21) break; }
      }
      out("{\"case\":\"leadDeath\",\"kind\":" + str(kind) + ",\"holder\":" + str(holderKind) + ",\"event\":" + str(event) + ",\"killed\":" + killed + ",\"ticks\":[" + ticks + "]}");
    }
  }

  static dh leashTag(String kind) {
    dh t = new dh();
    t.a("Leashed", true);
    dh l = new dh();
    if (kind.equals("player")) { l.a("UUIDMost", 1L); l.a("UUIDLeast", 2L); }
    else if (kind.equals("mob")) { l.a("UUIDMost", HOLDER.getMostSignificantBits()); l.a("UUIDLeast", HOLDER.getLeastSignificantBits()); }
    else { l.a("X", 3); l.a("Y", 0); l.a("Z", 0); }
    t.a("Leash", l);
    return t;
  }

  static void leadDimension() throws Exception {
    // distance of the holder in the new world: absent, 3, 10.5 (inside the box edge), 12
    for (String holderKind : new String[] { "player", "mob", "knot" }) for (String where : new String[] { "absent", "near3", "edge10.5", "far12", "oldDead" }) {
      if (holderKind.equals("knot") && !where.equals("absent")) continue;
      Leads2Probe.reset();
      yz p = Leads2Probe.player(false);
      sw old = Leads2Probe.mob("pig", 3);
      Leads2Probe.put(old, 0, 0, 0);
      sw holder = Leads2Probe.mob("pig", 4);
      Leads2Probe.uuid(holder, HOLDER);
      p.b(3, 0, 0);
      holder.b(3, 0, 0);
      if (holderKind.equals("player")) { HorseGearProbe.GW.entities.add(p); old.b(p, true); }
      else if (holderKind.equals("mob")) { HorseGearProbe.GW.entities.add(holder); old.b(holder, true); }
      else { LeashProbe.fence(3, 0, 0); old.b(su.a(HorseProbe.W, 3, 0, 0), true); }
      String savedOld = Leads2Probe.saved(old);
      // the new world: a fresh entity (sg.a(sg.b(this), world)), copyDataFrom, then the old one is flagged dead
      HorseGearProbe.GW.entities.clear();
      HorseProbe.World.items.clear();
      sw clone = Leads2Probe.mob("pig", 5);
      clone.a((sa) old, true);
      MobMoveProbe.set(old, "K", true);
      String savedClone = Leads2Probe.saved(clone);
      clone.b(0, 0, 0);
      HorseGearProbe.GW.entities.add(clone);
      sa present = null;
      double d = where.equals("near3") ? 3 : where.equals("edge10.5") ? 10.5 : where.equals("far12") ? 12 : 3;
      if (!where.equals("absent") && !where.equals("oldDead")) {
        present = holderKind.equals("player") ? p : holder;
        present.b(d, 0, 0);
        HorseGearProbe.GW.entities.add(present);
      }
      if (holderKind.equals("knot")) LeashProbe.fence(3, 0, 0);
      LeashProbe.bL(clone);
      String first = "{\"leashed\":" + clone.bN() + ",\"holder\":" + str(Leads2Probe.holderKind(clone, clone, p, holder)) + ",\"knots\":" + LeashProbe.knots() + ",\"drops\":" + Leads2Probe.drops() + ",\"saved\":" + Leads2Probe.saved(clone) + ",\"knotAt\":" + Leads2Probe.knotAt(clone) + "}";
      LeashProbe.bL(clone);
      out("{\"case\":\"leadDimension\",\"holder\":" + str(holderKind) + ",\"where\":" + str(where) + ",\"savedOld\":" + savedOld + ",\"savedClone\":" + savedClone + ",\"oldLeashed\":" + old.bN() + ",\"oldDead\":" + dead(old) + ",\"first\":" + first + ",\"second\":{\"leashed\":" + clone.bN() + ",\"drops\":" + Leads2Probe.drops() + "}}");
    }
    // the holder mob changes dimension while the mob stays: the holder is flagged dead; the leashed mob's next tick drops the lead
    for (String holderKind : new String[] { "mob" }) {
      Leads2Probe.reset();
      sw e = Leads2Probe.mob("pig", 3), holder = Leads2Probe.mob("pig", 4);
      Leads2Probe.uuid(holder, HOLDER);
      Leads2Probe.put(e, 0, 0, 0); Leads2Probe.put(holder, 3, 0, 0);
      e.b(holder, true);
      MobMoveProbe.set(holder, "K", true);
      LeashProbe.bL(e);
      out("{\"case\":\"leadDimension\",\"holder\":\"mob\",\"where\":\"holderLeft\",\"leashed\":" + e.bN() + ",\"drops\":" + Leads2Probe.drops() + "}");
    }
  }

  // ---- horseNeg ----
  // ContainerHorseInventory (aam) clicks through Container.slotClick (zs.a) with saddle and horse armour stacks of size -2..2 in the cursor, the
  // player's hotbar and the horse's own slots (GUI equip, shift-click both ways, pick up, drop key).
  static add stackOf(String kind, int count) { return new add(adb.d(kind.equals("saddle") ? 329 : kind.equals("ironArmor") ? 417 : kind.equals("goldArmor") ? 418 : 280), count, 0); }
  static void horseNeg() throws Exception {
    String[] actions = { "cursorSlot0", "cursorSlot0Right", "cursorSlot1", "cursorSlot1Right", "shiftIn", "pickSlot0", "pickSlot0Right", "shiftOut0", "drop0", "dropAll0", "pickSlot1", "pickSlot1Right", "shiftOut1", "drop1", "dropAll1", "cursorOverSlot0", "cursorOverSlot1", "cursorChest2", "shiftInChest" };
    for (int type : new int[] { 0, 1 }) for (String kind : new String[] { "saddle", "ironArmor", "stick" }) for (int count : new int[] { -2, -1, 0, 1, 2 }) for (String action : actions) {
      boolean chested = action.endsWith("Chest") || action.equals("cursorChest2");
      if (chested && type != 1) continue;
      if (type == 1 && !chested && action.endsWith("1") || type == 1 && !chested && action.contains("Slot1") || type == 1 && !chested && action.contains("slot1")) continue;
      LeashProbe.reset();
      wi e = HorseGearProbe.gearHorse(type, chested);
      yz p = HorseGearProbe.freshPlayer(false);
      zt chest = HorseGearProbe.chestOf(e);
      yx inv = HorseGearProbe.playerInv(p);
      aam c = new aam(inv, chest, e);
      add made = stackOf(kind, count);
      int slot = 0, button = 0, mode = 0;
      switch (action) {
        case "cursorSlot0": inv.b(made); slot = 0; break;
        case "cursorSlot0Right": inv.b(made); slot = 0; button = 1; break;
        case "cursorSlot1": inv.b(made); slot = 1; break;
        case "cursorSlot1Right": inv.b(made); slot = 1; button = 1; break;
        case "cursorChest2": inv.b(made); slot = 2; break;
        case "shiftIn": inv.a[0] = made; slot = chest.a() + 27; mode = 1; break;
        case "shiftInChest": inv.a[0] = made; slot = chest.a() + 27; mode = 1; break;
        case "pickSlot0": chest.a(0, made); slot = 0; break;
        case "pickSlot0Right": chest.a(0, made); slot = 0; button = 1; break;
        case "shiftOut0": chest.a(0, made); slot = 0; mode = 1; break;
        case "drop0": chest.a(0, made); slot = 0; mode = 4; break;
        case "dropAll0": chest.a(0, made); slot = 0; mode = 4; button = 1; break;
        case "pickSlot1": chest.a(1, made); slot = 1; break;
        case "pickSlot1Right": chest.a(1, made); slot = 1; button = 1; break;
        case "shiftOut1": chest.a(1, made); slot = 1; mode = 1; break;
        case "drop1": chest.a(1, made); slot = 1; mode = 4; break;
        case "dropAll1": chest.a(1, made); slot = 1; mode = 4; button = 1; break;
        case "cursorOverSlot0": chest.a(0, stackOf("saddle", 1)); inv.b(made); slot = 0; break;
        case "cursorOverSlot1": chest.a(1, stackOf("goldArmor", 1)); inv.b(made); slot = 1; break;
        default: throw new IllegalStateException(action);
      }
      HorseProbe.clear();
      String result, error = null;
      try { result = HorseProbe.stack(c.a(slot, button, mode, p)); } catch (Throwable t) { result = "null"; error = t.toString(); }
      StringBuilder pi = new StringBuilder("[");
      boolean first = true;
      for (int i = 0; i < inv.a.length; i++) if (inv.a[i] != null) { pi.append(first ? "" : ",").append("{\"slot\":" + i + ",\"stack\":" + HorseProbe.stack(inv.a[i]) + "}"); first = false; }
      out("{\"case\":\"horseNeg\",\"type\":" + type + ",\"kind\":" + str(kind) + ",\"count\":" + count + ",\"action\":" + str(action) + ",\"result\":" + result + ",\"cursor\":" + HorseProbe.stack(inv.o())
        + ",\"horse\":" + HorseGearProbe.stacks(chest) + ",\"player\":" + pi + "],\"saddled\":" + e.cu() + ",\"armor\":" + e.cl() + ",\"drops\":" + HorseProbe.strings(HorseProbe.World.items)
        + ",\"error\":" + (error == null ? "null" : Attributes2Probe.q(error)) + "}");
    }
  }

  static void edge() throws Exception {
    for (double d : new double[] { 5, 8, 9, 9.5, 9.9, 10, 10.1, 10.3, 10.5, 10.8 }) {
      Leads2Probe.reset();
      sw e = Leads2Probe.mob("pig", 3), holder = Leads2Probe.mob("pig", 4);
      Leads2Probe.uuid(holder, HOLDER);
      Leads2Probe.put(e, 0, 0, 0);
      holder.b(d, 0, 0);
      HorseGearProbe.GW.entities.add(holder);
      e.a(leashTag("mob"));
      LeashProbe.bL(e);
      out("{\"case\":\"edge\",\"d\":" + d + ",\"leashed\":" + e.bN() + ",\"mobBox\":\"" + e.C + "\",\"holderBox\":\"" + holder.C + "\",\"expanded\":\"" + e.C.b(10, 10, 10) + "\",\"intersects\":" + e.C.b(10, 10, 10).b(holder.C) + ",\"lookup\":" + HorseProbe.W.a(sv.class, e.C.b(10, 10, 10)).size() + "}");
    }
  }

  public static void main(String[] args) throws Exception {
    String mode = args.length > 0 ? args[0] : "lead";
    Leads2Probe.setup();
    ays info = (ays) HorseGearProbe.u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.set(Leads2Probe.world, "x", info);
    float[] light = new float[16];
    for (int i = 0; i < 16; i++) { float f = 1f - i / 15f; light[i] = (1f - f) / (f * 3f + 1f); }
    MobMoveProbe.field(aqq.class, "h").set(MobMoveProbe.field(ahb.class, "t").get(Leads2Probe.world), light);
    out("--items--");
    if (mode.equals("lead")) { leadDeath(); leadDimension(); }
    if (mode.equals("edge")) edge();
    if (mode.equals("horse")) horseNeg();
  }
}
