import java.lang.reflect.Field;
import java.util.*;

// Batch 65: MobEffects2Probe's b54order sequences (random put / addPotionEffect / updatePotionEffects on a Pig, then the effect list in the HashMap's
// iteration order and the ActiveEffects NBT written from it) with the mob's activePotionsMap replaced by Java7Map, a port of the OpenJDK 7 HashMap, so
// the unchanged EntityLivingBase / PotionEffect classes drive it. Same seeds as batch 54; the tag is j7order.
public class MobEffectsJava7Probe {
  public static void main(String[] args) throws Exception {
    sun.misc.Unsafe u = MobEffects2Probe.u;
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(world, info);
    MobEffects2Probe.W = world;
    HorseProbe.W = world;
    MobEffects2Probe.MAP = MobMoveProbe.field(sv.class, "f");
    MobEffects2Probe.UPDATE = MobMoveProbe.method(sv.class, "aO");
    MobEffects2Probe.J7 = true;
    for (int seed = 1; seed <= 40; seed++) MobEffects2Probe.order(seed, 6 + seed % 14, false);
    for (int seed = 101; seed <= 112; seed++) MobEffects2Probe.order(seed, 40, true);
  }
}
