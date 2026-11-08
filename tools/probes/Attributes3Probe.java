import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Batch 27 attributes3 evidence on the unchanged 1.7.10 classes (no class is patched or shipped), InterchangeSpawnProbe's world double.
//  attack     every registered living class that has an attackEntityAsMob (sv.n(sa): EntityMob, wolf, ocelot, iron golem, ...) written, its Attributes list edited
//             (attackDamage modifiers of operation 0/1/2, a base override, a movementSpeed modifier that must not change it), read back, then n(victim): the
//             damage the victim's attackEntityFrom received and the attribute value. Wolves are wild and tamed (an OwnerUUID, which makes the read call setTamed).
//  knockback  EntityLivingBase.knockBack (sv.a(sa, F, DD)V) on several classes with a knockbackResistance base/modifier edited, Entity.rand seeds 0-7:
//             the victim's motion afterwards.
//  speed      isAIEnabled, getAIMoveSpeed and the movementSpeed value of every class with movementSpeed modifiers of operation 0/1/2 (written, edited, read back).
public class Attributes3Probe {
  static void out(String s) { System.out.println(s); }
  static String q(String s) { return HorseProbe.str(s == null ? null : s.replace("\\", "/").replace("\"", "'")); }
  static EquipmentProbe.World w;
  static float lastAmount;
  static class Victim extends yq { Victim(ahb w) { super(w); } public boolean a(ro s, float a) { lastAmount = a; return true; } }
  static String num(double d) { return Double.toString(d); }

  static dh wolfTag(boolean tamed) throws Exception {
    dh t = InterchangeSpawnProbe.write(InterchangeSpawnProbe.make("Wolf", 9));
    if (tamed) t.a("OwnerUUID", new UUID(5L, 6L).toString());
    return t;
  }
  static Method find(Class<?> c, String name, Class<?>... args) {
    for (; c != null; c = c.getSuperclass()) try { Method m = c.getDeclaredMethod(name, args); m.setAccessible(true); return m; } catch (NoSuchMethodException x) { }
    return null;
  }
  static dh attrOf(dh t, String name) { return t.b("Attributes", 9) ? InterchangeSpawnProbe.attr(t, name) : null; }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    sun.misc.Unsafe u = MobMoveProbe.unsafe();
    EquipmentProbe.u = u;
    w = (EquipmentProbe.World) u.allocateInstance(EquipmentProbe.World.class);
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

    List<String> names = new ArrayList<>();
    Field cf = sg.class.getDeclaredField("c");
    cf.setAccessible(true);
    for (Object k : ((Map) cf.get(null)).keySet()) names.add((String) k);
    Collections.sort(names);

    String[] labels = { "plain", "add3", "mul1", "total0.5", "all", "base7", "base7add3", "speedOnly", "negative" };
    // ---- attack ----
    for (String id : names) {
      sa probe;
      try { probe = InterchangeSpawnProbe.make(id, 1); } catch (Throwable x) { continue; }
      if (!(probe instanceof sv)) continue;
      Method n = find(probe.getClass(), "n", sa.class);
      if (n == null || n.getReturnType() != boolean.class) continue;
      for (int owned = 0; owned < (id.equals("Wolf") || id.equals("Ozelot") ? 2 : 1); owned++)
        for (String label : labels) {
          sa e = InterchangeSpawnProbe.make(id, 9);
          dh t = InterchangeSpawnProbe.write(e);
          if (owned == 1) t.a("OwnerUUID", new UUID(1L, 2L).toString());
          dh a = attrOf(t, "generic.attackDamage");
          boolean has = a != null;
          if (has) switch (label) {
            case "add3": InterchangeSpawnProbe.addModifier(a, "Probe add", 3.0, 0, 31, 1); break;
            case "mul1": InterchangeSpawnProbe.addModifier(a, "Probe mul", 1.0, 1, 31, 2); break;
            case "total0.5": InterchangeSpawnProbe.addModifier(a, "Probe total", 0.5, 2, 31, 3); break;
            case "all":
              InterchangeSpawnProbe.addModifier(a, "Probe total", 0.5, 2, 31, 3);
              InterchangeSpawnProbe.addModifier(a, "Probe mul", 1.0, 1, 31, 2);
              InterchangeSpawnProbe.addModifier(a, "Probe add", 3.0, 0, 31, 1);
              InterchangeSpawnProbe.addModifier(a, "Probe mul2", 0.25, 1, 31, 4);
              break;
            case "base7": a.a("Base", 7.0); break;
            case "base7add3": a.a("Base", 7.0); InterchangeSpawnProbe.addModifier(a, "Probe add", 3.0, 0, 31, 1); break;
            case "negative": InterchangeSpawnProbe.addModifier(a, "Probe neg", -50.0, 0, 31, 5); break;
            default: break;
          }
          if (label.equals("speedOnly")) InterchangeSpawnProbe.addModifier(attrOf(t, "generic.movementSpeed"), "Probe speed", 1.0, 1, 31, 6);
          // An attackDamage entry on a class that does not register it (a wolf, an ocelot): added as an extra list entry, which the reader must ignore.
          if (!has && !label.equals("plain")) {
            dq list = t.c("Attributes", 10);
            dh extra = new dh();
            extra.a("Name", "generic.attackDamage"); extra.a("Base", 9.0);
            InterchangeSpawnProbe.addModifier(extra, "Probe add", 3.0, 0, 31, 1);
            list.a(extra);
          }
          if (!has && label.equals("plain") ) { }
          sa back = InterchangeSpawnProbe.read(id, t);
          int seedsN = id.equals("VillagerGolem") ? 4 : 1;
          for (int seed = 0; seed < seedsN; seed++) {
            Victim v = new Victim(w);
            EquipmentProbe.place(v, 3.5, 64.0, 8.5);
            MobMoveProbe.set(back, "Z", new Random(seed));
            lastAmount = -1;
            String error = null; boolean hit = false;
            try { hit = (Boolean) n.invoke(back, v); } catch (Throwable x) { error = x.toString(); }
            ti attr = ((sv) back).a(yj.e);
            out("{\"case\":\"attack\",\"id\":" + q(id) + ",\"owned\":" + (owned == 1) + ",\"variant\":" + q(label) + ",\"seed\":" + seed + ",\"registered\":" + (attr != null)
              + ",\"attribute\":" + (attr == null ? "null" : num(attr.e())) + ",\"hit\":" + hit + ",\"amount\":" + num(lastAmount) + ",\"error\":" + (error == null ? "null" : q(error)) + ",\"nbt\":\"" + InterchangeLinkProbe.hex(t) + "\"}");
          }
        }
    }

    // ---- strength ----
    // Strength (Potion.damageBoost, id 5, operation 2 modifier) on the attacker, applied with addPotionEffect then n(victim) with the effect's modifier live.
    for (String id : new String[] { "Zombie", "PigZombie", "Skeleton", "Spider", "Enderman", "Silverfish", "Giant", "Wolf", "Ozelot", "VillagerGolem" })
      for (int amp = 0; amp < 3; amp++) for (int owned = 0; owned < (id.equals("Wolf") ? 2 : 1); owned++) {
        sa e = InterchangeSpawnProbe.make(id, 9);
        dh t = InterchangeSpawnProbe.write(e);
        if (owned == 1) t.a("OwnerUUID", new UUID(1L, 2L).toString());
        sa back = InterchangeSpawnProbe.read(id, t);
        if (amp > 0) ((sv) back).c(new rw(5, 600, amp - 1));
        Victim v = new Victim(w);
        EquipmentProbe.place(v, 3.5, 64.0, 8.5);
        MobMoveProbe.set(back, "Z", new Random(0));
        lastAmount = -1;
        boolean hit = (Boolean) find(back.getClass(), "n", sa.class).invoke(back, v);
        out("{\"case\":\"strength\",\"id\":" + q(id) + ",\"owned\":" + (owned == 1) + ",\"strength\":" + amp + ",\"hit\":" + hit + ",\"amount\":" + num(lastAmount) + "}");
      }

    // ---- foreign ----
    // A tamed wolf or ocelot whose OwnerUUID names nobody online: EntityTameable.getOwner (tg.cb) looks the UUID up among the world's players (none), so it is null.
    // For each AI task (tasks c, target tasks d of EntityLiving) the class name and shouldExecute (a()) with the animal on the ground.
    for (String id : new String[] { "Wolf", "Ozelot" })
      for (int state = 0; state < 4; state++) {
        sa e = InterchangeSpawnProbe.make(id, 9);
        dh t = InterchangeSpawnProbe.write(e);
        if (state > 0) t.a("OwnerUUID", new UUID(1L, 2L).toString());
        if (state >= 2) t.a("Sitting", (byte) 1);
        if (state == 3) t.a("OwnerUUID", " ");
        sa back = InterchangeSpawnProbe.read(id, t);
        EquipmentProbe.place(back, 3.5, 64.0, 7.5);
        MobMoveProbe.set(back, "D", true);
        tg tame = (tg) back;
        StringBuilder tasks = new StringBuilder("[");
        boolean first = true;
        for (String list : new String[] { "c", "d" }) {
          uj aiTasks = (uj) MobMoveProbe.field(sw.class, list).get(back);
          for (Object entry : (List) MobMoveProbe.field(uj.class, "b").get(aiTasks)) {
            ui action = (ui) MobMoveProbe.field(uk.class, "a").get(entry);
            String result;
            try { result = Boolean.toString(action.a()); } catch (Throwable x) { result = q(x.toString()); }
            if (!first) tasks.append(",");
            first = false;
            tasks.append("{\"list\":" + q(list) + ",\"priority\":" + MobMoveProbe.field(uk.class, "b").getInt(entry) + ",\"action\":" + q(action.getClass().getName()) + ",\"run\":" + result + "}");
          }
        }
        tasks.append("]");
        // A tamed wolf as another wolf's target (a(sv, sv) with the owner argument the AI passes, null for an absent owner).
        String attack = "null";
        if (id.equals("Wolf")) {
          sa t1 = InterchangeSpawnProbe.read("Wolf", wolfTag(true));
          sa t2 = InterchangeSpawnProbe.read("Wolf", wolfTag(false));
          attack = "{\"tamedWolf\":" + ((wv) back).a((sv) t1, null) + ",\"wildWolf\":" + ((wv) back).a((sv) t2, null) + "}";
        }
        out("{\"case\":\"foreign\",\"id\":" + q(id) + ",\"state\":" + state + ",\"tamed\":" + tame.bZ() + ",\"sitting\":" + tame.ca() + ",\"owner\":" + (tame.cb() != null)
          + ",\"tasks\":" + tasks + ",\"attack\":" + attack + ",\"nbt\":\"" + InterchangeLinkProbe.hex(t) + "\"}");
      }

    // ---- knockback ----
    Method kb = find(sv.class, "a", sa.class, float.class, double.class, double.class);
    String[] kids = { "Zombie", "Cow", "Skeleton", "VillagerGolem", "Wolf", "Slime", "Spider" };
    String[] klabels = { "plain", "add0.5", "mul1", "base1", "add2", "negative" };
    for (String id : kids) for (String label : klabels) for (int seed = 0; seed < 8; seed++) {
      sa e = InterchangeSpawnProbe.make(id, 9);
      dh t = InterchangeSpawnProbe.write(e);
      dh k = attrOf(t, "generic.knockbackResistance");
      switch (label) {
        case "add0.5": InterchangeSpawnProbe.addModifier(k, "Probe add", 0.5, 0, 41, 1); break;
        case "mul1": k.a("Base", 0.25); InterchangeSpawnProbe.addModifier(k, "Probe mul", 1.0, 1, 41, 2); break;
        case "base1": k.a("Base", 1.0); break;
        case "add2": InterchangeSpawnProbe.addModifier(k, "Probe add", 2.0, 0, 41, 3); break;
        case "negative": k.a("Base", 0.5); InterchangeSpawnProbe.addModifier(k, "Probe neg", -2.0, 0, 41, 4); break;
        default: break;
      }
      sa back = InterchangeSpawnProbe.read(id, t);
      sa from = new Victim(w);
      EquipmentProbe.place(from, 3.5, 64.0, 8.5);
      EquipmentProbe.place(back, 3.5, 64.0, 7.5);
      MobMoveProbe.set(back, "Z", new Random(seed));
      kb.invoke(back, from, 1.0f, 0.0, 1.0);
      out("{\"case\":\"knockback\",\"id\":" + q(id) + ",\"variant\":" + q(label) + ",\"seed\":" + seed + ",\"value\":" + num(((sv) back).a(yj.c).e()) + ",\"motion\":[" + num(MobMoveProbe.d(back, "v")) + "," + num(MobMoveProbe.d(back, "w")) + "," + num(MobMoveProbe.d(back, "x")) + "],\"nbt\":\"" + InterchangeLinkProbe.hex(t) + "\"}");
    }

    // ---- speed ----
    String[] slabels = { "plain", "add0.1", "mul0.5", "total0.5", "all", "base0.4", "negative" };
    java.lang.reflect.Method bk = MobMoveProbe.method(sv.class, "bk");
    for (String id : names) {
      sa probe;
      try { probe = InterchangeSpawnProbe.make(id, 1); } catch (Throwable x) { continue; }
      if (!(probe instanceof sv)) continue;
      for (String label : slabels) {
        sa e = InterchangeSpawnProbe.make(id, 9);
        dh t = InterchangeSpawnProbe.write(e);
        dh s = attrOf(t, "generic.movementSpeed");
        switch (label) {
          case "add0.1": InterchangeSpawnProbe.addModifier(s, "Probe add", 0.1, 0, 51, 1); break;
          case "mul0.5": InterchangeSpawnProbe.addModifier(s, "Probe mul", 0.5, 1, 51, 2); break;
          case "total0.5": InterchangeSpawnProbe.addModifier(s, "Probe total", 0.5, 2, 51, 3); break;
          case "all":
            InterchangeSpawnProbe.addModifier(s, "Probe total", 0.5, 2, 51, 3);
            InterchangeSpawnProbe.addModifier(s, "Probe mul", 0.5, 1, 51, 2);
            InterchangeSpawnProbe.addModifier(s, "Probe add", 0.1, 0, 51, 1);
            break;
          case "base0.4": s.a("Base", 0.4); break;
          case "negative": InterchangeSpawnProbe.addModifier(s, "Probe neg", -5.0, 0, 51, 4); break;
          default: break;
        }
        sa back = InterchangeSpawnProbe.read(id, t);
        out("{\"case\":\"speed\",\"id\":" + q(id) + ",\"variant\":" + q(label) + ",\"ai\":" + bk.invoke(back) + ",\"aiMoveSpeed\":" + ((sv) back).bl() + ",\"value\":" + num(((sv) back).a(yj.d).e()) + ",\"nbt\":\"" + InterchangeLinkProbe.hex(t) + "\"}");
      }
    }
  }
}
