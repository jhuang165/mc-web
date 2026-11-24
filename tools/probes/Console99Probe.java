import io.netty.buffer.Unpooled;
import java.lang.reflect.Field;
import java.util.*;

// Batch 99 console99 (copy of Console97Probe's world double) evidence on the unchanged 1.7.10 classes (no class is patched or shipped).
//  mob  for a zombie, horse, villager and wolf made as in a fresh world: the S0F, the whole-watcher S1C and the whole watched-attribute S20 a viewer gets on entering the tracked set,
//       the dirty set the constructor left (what the first gated pass sends), then the packets of later changes as EntityTrackerEntry.b() writes them (S1C of the changed entries only,
//       S20 of the dirty set), and an S04 of a held sword. `bytes` = id VarInt + payload as the encoder fa counts it.
public class Console99Probe {
  static int size(int id, ft packet) throws Exception {
    et buf = new et(Unpooled.buffer());
    buf.b(id);
    packet.b(buf);
    return buf.readableBytes();
  }
  static tq map(sa e) { return (tq) ((sv) e).bc(); }
  static String names(Collection<?> set) {
    List<String> n = new ArrayList<>();
    for (Object o : set) n.add(((tn) o).a().a());
    Collections.sort(n);
    StringBuilder b = new StringBuilder("[");
    for (String s : n) b.append(b.length() > 1 ? "," : "").append('"').append(s).append('"');
    return b.append(']').toString();
  }
  // the S20 `il(id, tq.b())` of the dirty set, then the set cleared (func_111190_b); -1 when it is empty (nothing is sent)
  static String dirty(sa e) throws Exception {
    Collection<?> set = map(e).b();
    String r = set.isEmpty() ? "{\"bytes\":-1,\"names\":[]}" : "{\"bytes\":" + size(32, new il(e.y(), new ArrayList<Object>(set))) + ",\"names\":" + names(set) + "}";
    set.clear();
    return r;
  }
  static void out(String s) { System.out.println(s); }
  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    EquipmentProbe.u = u;
    EquipmentProbe.World w = (EquipmentProbe.World) u.allocateInstance(EquipmentProbe.World.class);
    EquipmentProbe.w = w;
    DifficultyProbe.w = w;
    InterchangeSpawnProbe.u = u;
    InterchangeSpawnProbe.w = w;
    MobMoveProbe.set(w, "s", new Random(2));
    MobMoveProbe.set(w, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(w, new ArrayList()); }
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(w, info);
    MobMoveProbe.field(ahb.class, "A").set(w, new wc(w));
    DifficultyProbe.World.chunk = (apx) u.allocateInstance(apx.class);
    DifficultyProbe.setDifficulty(2);
    EquipmentProbe.environment(1, 0, 6, 1, false);

    for (String id : new String[] { "Zombie", "EntityHorse", "Villager", "Wolf" }) {
      sv e = (sv) InterchangeSpawnProbe.make(id, 1);
      int eid = e.y();
      te dw = e.z();
      String s0f = String.valueOf(size(15, new fz(e)));
      String whole = String.valueOf(size(28, new hw(eid, dw, true)));
      Collection<?> watched = map(e).c();
      String s20whole = size(32, new il(eid, watched)) + "";
      String wnames = names(watched);
      String first = dirty(e); // what the constructor left: sent by the first gated pass, then cleared
      dw.b(); // clear the changed flags (the whole S1C went out)
      boolean calm = dw.a();
      // health 6 -> index 6 float changed
      dw.b(6, 5.0f);
      String changedHealth = String.valueOf(size(28, new hw(eid, dw, false)));
      dw.b();
      // the age entry (12): an int for the ageable classes, a byte for the zombie
      String changedAge = "null";
      try { dw.b(12, id.equals("Zombie") ? (Object) (byte) 1 : (Object) Integer.valueOf(-24000)); changedAge = String.valueOf(size(28, new hw(eid, dw, false))); } catch (Throwable x) { changedAge = "\"error\""; }
      dw.b();
      // writing a value back unchanged marks nothing
      dw.b(6, 5.0f);
      boolean unchanged = dw.a();
      // Speed I effect: dirty movementSpeed with one modifier
      e.c(new rw(1, 600, 0));
      String speed = dirty(e);
      String again = dirty(e); // read twice: the set was cleared
      // equipment S04 of an iron sword in the main hand
      String s04 = String.valueOf(size(4, new hz(eid, 0, new add(adb.d(267), 1, 0))));
      String egg = "null";
      if (e instanceof sw) try { ((sw) e).a((sy) null); egg = dirty(e); } catch (Throwable x) { egg = "\"error\""; }
      out("{\"case\":\"mob\",\"id\":\"" + id + "\",\"s0f\":" + s0f + ",\"whole\":" + whole + ",\"s20whole\":" + s20whole + ",\"watched\":" + wnames + ",\"first\":" + first
        + ",\"calm\":" + calm + ",\"changedHealth\":" + changedHealth + ",\"changedAge\":" + changedAge + ",\"unchanged\":" + unchanged + ",\"speed\":" + speed + ",\"again\":" + again
        + ",\"s04\":" + s04 + ",\"egg\":" + egg + "}");
    }
  }
}
