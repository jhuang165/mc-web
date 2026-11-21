import java.lang.reflect.Field;
import java.util.*;

// Batch 89 mobpackets89 evidence on the unchanged 1.7.10 classes (no class is patched or shipped), Attributes3Probe's world double.
//  dirty    every registered living class: the names in ServersideAttributeMap.getAttributeInstanceSet (tq.b(), the set EntityTrackerEntry.func_111190_b sends as S20 and clears)
//           after the constructor, then after onSpawnWithEgg (sw.a(sy)) and after an NBT read into a fresh instance (sa.f(dh)); `watched` is tq.c() (the S20 of
//           tryStartWachingThis) with each instance's base and value.
//  effect   a pig (and a horse): the dirty set after addPotionEffect (sv.c(rw)) of Speed, of the same Speed again (onChangedPotionEffect), of Slowness, of Health Boost, of
//           Regeneration, and after the effect list is cleared (sv.aP(): onFinishedPotionEffect), each read and cleared in turn.
public class MobPackets89Probe {
  static void out(String s) { System.out.println(s); }
  static String names(Collection<?> set) {
    List<String> n = new ArrayList<>();
    for (Object o : set) n.add(((tn) o).a().a());
    Collections.sort(n);
    StringBuilder b = new StringBuilder("[");
    for (String s : n) b.append(b.length() > 1 ? "," : "").append('"').append(s).append('"');
    return b.append(']').toString();
  }
  static String rows(Collection<?> set) {
    List<String> n = new ArrayList<>();
    for (Object o : set) { tn t = (tn) o; n.add("{\"name\":\"" + t.a().a() + "\",\"base\":" + t.b() + ",\"value\":" + t.e() + ",\"mods\":" + t.c().size() + "}"); }
    Collections.sort(n);
    return "[" + String.join(",", n) + "]";
  }
  static tq map(sa e) { return (tq) ((sv) e).bc(); }
  static String take(sa e) { tq m = map(e); String s = names(m.b()); m.b().clear(); return s; }

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

    List<String> ids = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) ids.add((String) k);
    Collections.sort(ids);
    for (String id : ids) {
      sa e;
      try { e = InterchangeSpawnProbe.make(id, 1); } catch (Throwable x) { continue; }
      if (!(e instanceof sv)) continue;
      String made = take(e), egg = "null";
      if (e instanceof sw) try { ((sw) e).a((sy) null); egg = take(e); } catch (Throwable x) { egg = "\"error\""; }
      String watched = rows(map(e).c());
      dh t = InterchangeSpawnProbe.write(e);
      String read;
      try { sa back = InterchangeSpawnProbe.read(id, t); take(back); back.f(t); read = names(map(back).b()); } catch (Throwable x) { read = "\"error\""; }
      out("{\"case\":\"dirty\",\"id\":\"" + id + "\",\"made\":" + made + ",\"egg\":" + egg + ",\"read\":" + read + ",\"watched\":" + watched + "}");
    }
    for (String id : new String[] { "Pig", "EntityHorse", "Zombie" }) {
      sv e = (sv) InterchangeSpawnProbe.make(id, 1);
      take(e);
      e.c(new rw(1, 600, 0)); String speed = take(e);
      e.c(new rw(1, 600, 0)); String again = take(e);
      e.c(new rw(1, 900, 1)); String stronger = take(e);
      e.c(new rw(2, 600, 0)); String slow = take(e);
      e.c(new rw(21, 600, 0)); String boost = take(e);
      e.c(new rw(10, 600, 0)); String regen = take(e);
      String value = rows(map(e).c());
      e.aP(); String cleared = take(e);
      out("{\"case\":\"effect\",\"id\":\"" + id + "\",\"speed\":" + speed + ",\"again\":" + again + ",\"stronger\":" + stronger + ",\"slow\":" + slow + ",\"boost\":" + boost + ",\"regen\":" + regen + ",\"withEffects\":" + value + ",\"cleared\":" + cleared + ",\"after\":" + rows(map(e).c()) + "}");
    }
  }
}
