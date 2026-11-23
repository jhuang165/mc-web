import java.util.*;

// Batch 98 entnbt98: executed rows for NaN and infinite saturation and exhaustion (Entnbt97Probe left exhaustion out); player NBT edge cases on a real EntityPlayerMP (reuses Entnbt96Probe's harness): NaN Motion, awake SleepTimer (negative, ticked), out-of-range
// Health/HealF/food/Xp/Score and the abilities compound (read, game type interplay, written, reloaded). Rows as Entnbt96Probe (edit rows: in/out/re; tagCase rows: stage/live/out).
public class Entnbt98PlayerProbe {
  static void abil(String name, Entnbt96Probe.TEdit e) throws Exception {
    Entnbt96Probe.edit(name, t -> { dh ab = t.m("abilities"); e.apply(ab); });
    Entnbt96Probe.edit(name + "-nogt", t -> { t.o("playerGameType"); dh ab = t.m("abilities"); e.apply(ab); }); // no playerGameType key: the raw abilities compound stands
  }
  public static void main(String[] argv) throws Throwable {
    aji.p(); adb.l();
    LevelDatProbe.u = MobMoveProbe.unsafe();
    LevelDatProbe.world = (LevelDatProbe.W) LevelDatProbe.u.allocateInstance(LevelDatProbe.W.class);
    { java.lang.reflect.Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true);
      LevelDatProbe.u.putObject(LevelDatProbe.u.staticFieldBase(jf), LevelDatProbe.u.staticFieldOffset(jf), LevelDatProbe.u.allocateInstance(ServerPlayerProbe.Server.class)); }
    MobMoveProbe.set(LevelDatProbe.world, "C", new qi()); MobMoveProbe.set(LevelDatProbe.world, "s", new Random(2)); MobMoveProbe.set(LevelDatProbe.world, "t", LevelDatProbe.u.allocateInstance(aqq.class));
    for (java.lang.reflect.Field f : ahb.class.getDeclaredFields())
      if (f.getType() == java.util.List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(LevelDatProbe.world, new ArrayList()); }
    { java.lang.invoke.MethodHandles.Lookup l = java.lang.invoke.MethodHandles.privateLookupIn(mw.class, java.lang.invoke.MethodHandles.lookup());
      Entnbt96Probe.tick = l.findSpecial(sv.class, "C", java.lang.invoke.MethodType.methodType(void.class), mw.class); }
    Entnbt96Probe.edit("food-exh-nan", t -> t.a("foodExhaustionLevel", Float.NaN));
    Entnbt96Probe.edit("food-exh-inf", t -> t.a("foodExhaustionLevel", Float.POSITIVE_INFINITY));
    Entnbt96Probe.edit("food-sat-inf", t -> t.a("foodSaturationLevel", Float.POSITIVE_INFINITY));
    Entnbt96Probe.edit("food-sat-neginf", t -> t.a("foodSaturationLevel", Float.NEGATIVE_INFINITY));
    Entnbt96Probe.edit("healf-neginf", t -> t.a("HealF", Float.NEGATIVE_INFINITY));
  }
}
