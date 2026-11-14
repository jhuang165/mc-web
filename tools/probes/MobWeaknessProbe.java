import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

// Batch 71 mobfixes71 evidence on the unchanged 1.7.10 classes: Weakness (Potion.weakness id 18, PotionAttackDamage: -0.5F * (amplifier + 1), operation 0) and Strength
// (id 5, 1.3 * (amplifier + 1), operation 2) on an attacking mob, applied with addPotionEffect, then attackEntityAsMob(victim) (sv.n(sa)): the damage the victim received.
// Same world double as Attributes3Probe.
public class MobWeaknessProbe {
  static void out(String s) { System.out.println(s); }
  static float lastAmount;
  static class Victim extends yq { Victim(ahb w) { super(w); } public boolean a(ro s, float a) { lastAmount = a; return true; } }
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
    for (String id : new String[] { "Zombie", "PigZombie", "Spider", "Enderman", "Silverfish", "Giant", "Wolf" })
      for (int weak = 0; weak < 4; weak++) for (int str = 0; str < 3; str++) {
        sa e = InterchangeSpawnProbe.make(id, 9);
        sa back = InterchangeSpawnProbe.read(id, InterchangeSpawnProbe.write(e));
        if (weak > 0) ((sv) back).c(new rw(18, 600, weak - 1));
        if (str > 0) ((sv) back).c(new rw(5, 600, str - 1));
        Victim v = new Victim(w);
        EquipmentProbe.place(v, 3.5, 64.0, 8.5);
        MobMoveProbe.set(back, "Z", new Random(0));
        lastAmount = -1;
        boolean hit = (Boolean) Attributes3Probe.find(back.getClass(), "n", sa.class).invoke(back, v);
        out("{\"case\":\"weakness\",\"id\":\"" + id + "\",\"weakness\":" + weak + ",\"strength\":" + str + ",\"hit\":" + hit + ",\"amount\":" + Double.toString(lastAmount) + "}");
      }
  }
}
