import java.util.*;

// Batch 97 entnbt97: player NBT edge cases on a real EntityPlayerMP (reuses Entnbt96Probe's harness): NaN Motion, awake SleepTimer (negative, ticked), out-of-range
// Health/HealF/food/Xp/Score and the abilities compound (read, game type interplay, written, reloaded). Rows as Entnbt96Probe (edit rows: in/out/re; tagCase rows: stage/live/out).
public class Entnbt97Probe {
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
    // Motion
    Entnbt96Probe.edit("motion-nan", t -> t.a("Motion", LevelDatProbe.doubles(Double.NaN, 0.5, Double.NaN)));
    Entnbt96Probe.edit("motion-inf", t -> t.a("Motion", LevelDatProbe.doubles(Double.POSITIVE_INFINITY, Double.NEGATIVE_INFINITY, 1.0)));
    Entnbt96Probe.edit("motion-short-list", t -> t.a("Motion", LevelDatProbe.doubles(0.5, 0.5)));
    Entnbt96Probe.tagCase("motion-nan-tick", t -> t.a("Motion", LevelDatProbe.doubles(Double.NaN, 0.5, 0.25)), 1, 3);
    // SleepTimer awake
    for (int v : new int[] {-1, -50, -32768, 0, 1, 109, 110, 111, 32767}) Entnbt96Probe.tagCase("sleeptimer-" + v, t -> { t.a("Sleeping", false); t.a("SleepTimer", (short) v); }, 1, 2, 3, 120);
    // Health
    float[] hv = {0f, -5f, 1e9f, Float.NaN, Float.POSITIVE_INFINITY, 20.5f, 0.0001f};
    for (float h : hv) Entnbt96Probe.edit("healf-" + h, t -> t.a("HealF", h));
    Entnbt96Probe.edit("health-only-short-100", t -> { t.o("HealF"); t.a("Health", (short) 100); });
    Entnbt96Probe.edit("health-only-short-neg", t -> { t.o("HealF"); t.a("Health", (short) -3); });
    Entnbt96Probe.edit("health-only-float", t -> { t.o("HealF"); t.a("Health", 7.5f); });
    Entnbt96Probe.edit("health-only-int", t -> { t.o("HealF"); t.a("Health", 7); });
    Entnbt96Probe.edit("health-none", t -> { t.o("HealF"); t.o("Health"); });
    Entnbt96Probe.edit("healf-int", t -> t.a("HealF", 9));
    Entnbt96Probe.edit("health-and-healf-nan-short", t -> { t.a("HealF", Float.NaN); t.a("Health", (short) 5); });
    Entnbt96Probe.edit("absorption-neg", t -> t.a("AbsorptionAmount", -4f));
    Entnbt96Probe.edit("absorption-big", t -> t.a("AbsorptionAmount", 1e9f));
    // Food
    for (int f : new int[] {-5, 0, 19, 20, 21, 100, 500, Integer.MAX_VALUE}) Entnbt96Probe.edit("food-" + f, t -> t.a("foodLevel", f));
    Entnbt96Probe.edit("food-sat-neg", t -> t.a("foodSaturationLevel", -3f));
    Entnbt96Probe.edit("food-sat-big", t -> t.a("foodSaturationLevel", 99f));
    Entnbt96Probe.edit("food-sat-nan", t -> t.a("foodSaturationLevel", Float.NaN));
    Entnbt96Probe.edit("food-exh-big", t -> t.a("foodExhaustionLevel", 40f));
    Entnbt96Probe.edit("food-exh-neg", t -> t.a("foodExhaustionLevel", -2f));
    Entnbt96Probe.edit("food-timer-neg", t -> t.a("foodTickTimer", -7));
    Entnbt96Probe.edit("food-timer-big", t -> t.a("foodTickTimer", 500));
    Entnbt96Probe.edit("food-absent-others-set", t -> { t.o("foodLevel"); });
    // Xp
    float[] xv = {-1f, 0f, 0.999f, 1f, 5f, Float.NaN, Float.POSITIVE_INFINITY};
    for (float x : xv) Entnbt96Probe.edit("xpp-" + x, t -> t.a("XpP", x));
    for (int l : new int[] {-3, 0, 30, 100, 1000000, Integer.MAX_VALUE}) Entnbt96Probe.edit("xplevel-" + l, t -> t.a("XpLevel", l));
    for (int l : new int[] {-100, 0, Integer.MAX_VALUE}) Entnbt96Probe.edit("xptotal-" + l, t -> t.a("XpTotal", l));
    for (int l : new int[] {-100, 0, Integer.MAX_VALUE}) Entnbt96Probe.edit("score-" + l, t -> t.a("Score", l));
    Entnbt96Probe.edit("xp-types-short", t -> { t.a("XpLevel", (short) 12); t.a("XpTotal", (short) 300); t.a("Score", (short) 4); t.a("XpP", 0.5); });
    // abilities (default richPlayer has playerGameType 0)
    abil("ab-fly-true", ab -> { ab.a("flying", true); ab.a("mayfly", true); });
    abil("ab-flying-no-mayfly", ab -> ab.a("flying", true));
    abil("ab-mayfly-only", ab -> ab.a("mayfly", true));
    abil("ab-instabuild", ab -> ab.a("instabuild", true));
    abil("ab-invulnerable", ab -> ab.a("invulnerable", true));
    abil("ab-maybuild-false", ab -> ab.a("mayBuild", false));
    abil("ab-all-true", ab -> { for (String k : new String[] {"invulnerable", "flying", "mayfly", "instabuild", "mayBuild"}) ab.a(k, true); });
    abil("ab-speeds", ab -> { ab.a("flySpeed", 0.5f); ab.a("walkSpeed", 0.3f); });
    abil("ab-speeds-neg", ab -> { ab.a("flySpeed", -1f); ab.a("walkSpeed", -2f); });
    abil("ab-speeds-nan", ab -> { ab.a("flySpeed", Float.NaN); ab.a("walkSpeed", Float.POSITIVE_INFINITY); });
    abil("ab-flyspeed-only", ab -> { ab.o("walkSpeed"); ab.a("flySpeed", 0.4f); });
    abil("ab-walkspeed-only", ab -> { ab.o("flySpeed"); ab.a("walkSpeed", 0.4f); });
    abil("ab-byte-2", ab -> { ab.a("flying", (byte) 2); ab.a("mayfly", (byte) -1); ab.a("instabuild", (byte) 256 ); });
    abil("ab-ints", ab -> { ab.a("flying", 1); ab.a("mayfly", 1); });
    abil("ab-maybuild-absent", ab -> { ab.o("mayBuild"); });
    abil("ab-empty", ab -> { for (String k : new String[] {"invulnerable", "flying", "mayfly", "instabuild", "mayBuild", "flySpeed", "walkSpeed"}) ab.o(k); });
    abil("ab-speed-double", ab -> { ab.a("flySpeed", 0.25); ab.a("walkSpeed", 0.15); });
    Entnbt96Probe.edit("ab-no-compound", t -> t.o("abilities"));
    Entnbt96Probe.edit("ab-no-compound-nogt", t -> { t.o("abilities"); t.o("playerGameType"); });
    Entnbt96Probe.edit("ab-gt-minus1-fly", t -> { t.a("playerGameType", -1); t.m("abilities").a("mayfly", true); });
    Entnbt96Probe.edit("ab-no-compound-flags-in-gametype-1", t -> { t.o("abilities"); t.a("playerGameType", 1); });
    for (int gt : new int[] {0, 1, 2, 3, -1}) {
      Entnbt96Probe.edit("gt-" + gt + "-plain", t -> t.a("playerGameType", gt));
      Entnbt96Probe.edit("gt-" + gt + "-fly", t -> { t.a("playerGameType", gt); dh ab = (dh) t.a("abilities"); ab.a("flying", true); ab.a("mayfly", true); ab.a("instabuild", true); ab.a("invulnerable", true); });
      Entnbt96Probe.edit("gt-" + gt + "-nocompound", t -> { t.a("playerGameType", gt); t.o("abilities"); });
    }
  }
}
