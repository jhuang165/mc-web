import java.util.*;

// Batch 95 entnbt95: what a real EntityPlayerMP (ServerPlayerProbe.make, the unchanged constructor) writes with Entity.writeToNBT (sa.e) after Entity.readFromNBT (sa.f) of
// hand-made compounds (LevelDatProbe.richPlayer plus edits), and what a second player writes after reading that again. One JSON line per case:
// {"name":..,"in":hex of the input,"out":"key=value;..." sorted,"re":same after reload,"live":"hurt death attack sleeping sleepTimer"}.
public class Entnbt95Probe {
  static String q(String s) { return LevelDatProbe.q(s); }
  static String sorted(dh t) {
    TreeSet<String> ks = new TreeSet<>();
    for (Object k : t.c()) ks.add((String) k);
    StringBuilder b = new StringBuilder();
    for (String k : ks) { String v = t.a(k).toString(); if (k.startsWith("UUID")) v = "uuid"; b.append(k).append('=').append(v).append(';'); }
    return b.toString();
  }
  static String live(mw p) throws Exception {
    return MobMoveProbe.field(sv.class, "ax").getInt(p) + "";
  }
  static int n = 0;
  static void run(String name, dh input, Edit after) throws Exception {
    try {
      ServerPlayerProbe.PM p = ServerPlayerProbe.make(LevelDatProbe.world, "p" + (n++));
      if (input != null) p.f(input);
      if (after != null) after.apply(p);
      dh out = new dh(); p.e(out);
      ServerPlayerProbe.PM p2 = ServerPlayerProbe.make(LevelDatProbe.world, "p" + (n++));
      p2.f(out);
      dh re = new dh(); p2.e(re);
      System.out.println("{\"name\":" + q(name) + (input == null ? "" : ",\"in\":\"" + LevelDatProbe.hex(input) + "\"") + ",\"out\":" + q(sorted(out)) + ",\"re\":" + q(sorted(re)) + ",\"hex\":\"" + LevelDatProbe.hex(out) + "\"}");
    } catch (Throwable t) { if (n < 3 && System.getenv("TRACE") != null) { Throwable c = t; while (c.getCause() != null) c = c.getCause(); c.printStackTrace(); } System.out.println("{\"name\":" + q(name) + ",\"error\":" + q(t.toString()) + "}"); }
  }
  interface Edit { void apply(ServerPlayerProbe.PM p) throws Exception; }
  interface TEdit { void apply(dh t) throws Exception; }
  static void edit(String name, TEdit e) throws Exception { dh t = LevelDatProbe.richPlayer(); e.apply(t); run(name, t, null); }

  public static void main(String[] argv) throws Exception {
    aji.p(); adb.l();
    LevelDatProbe.u = MobMoveProbe.unsafe();
    LevelDatProbe.world = (LevelDatProbe.W) LevelDatProbe.u.allocateInstance(LevelDatProbe.W.class);
    { java.lang.reflect.Field jf = net.minecraft.server.MinecraftServer.class.getDeclaredField("j"); jf.setAccessible(true); // MinecraftServer.getServer (mw.readEntityFromNBT asks getForceGamemode)
      LevelDatProbe.u.putObject(LevelDatProbe.u.staticFieldBase(jf), LevelDatProbe.u.staticFieldOffset(jf), LevelDatProbe.u.allocateInstance(ServerPlayerProbe.Server.class)); }
    // Every item's attribute modifiers (Item.getAttributeModifiers through ItemStack.getAttributeModifiers, the multimap InventoryPlayer / EntityLivingBase.onUpdate apply for the held stack): [id, attribute, name, uuidMost, amount, operation].
    for (int id = 1; id < 4096; id++) {
      adb item = adb.d(id); if (item == null) continue;
      com.google.common.collect.Multimap m = new add(item, 1, 0).D();
      for (Object e : m.entries()) { Map.Entry en = (Map.Entry) e; tj mod = (tj) en.getValue(); System.out.println("{\"mod\":[" + id + "," + q((String) en.getKey()) + "," + q(mod.b()) + "," + q(String.valueOf(mod.a().getMostSignificantBits())) + "," + mod.d() + "," + mod.c() + "," + mod.e() + "]}"); }
    }
    run("fresh", null, null);
    run("rich", LevelDatProbe.richPlayer(), null);
    edit("timers", t -> { t.a("HurtTime", (short) 7); t.a("DeathTime", (short) 12); t.a("AttackTime", (short) 4); });
    edit("timers-neg", t -> { t.a("HurtTime", (short) -3); t.a("DeathTime", (short) -2); t.a("AttackTime", (short) 300); });
    edit("dead", t -> { t.a("HealF", 0f); t.a("Health", (short) 0); t.a("DeathTime", (short) 9); });
    edit("dead-25", t -> { t.a("HealF", 0f); t.a("Health", (short) 0); t.a("DeathTime", (short) 25); });
    edit("sleeping", t -> { t.a("Sleeping", true); t.a("SleepTimer", (short) 50); });
    edit("sleeptimer-only", t -> { t.a("Sleeping", false); t.a("SleepTimer", (short) 77); });
    edit("sleeptimer-big", t -> { t.a("Sleeping", false); t.a("SleepTimer", (short) 500); });
    edit("fall-onground", t -> { t.a("FallDistance", 7.5f); t.a("OnGround", false); });
    edit("fire-neg", t -> { t.a("Fire", (short) -20); t.a("Air", (short) 100); });
    edit("portal-cooldown", t -> { t.a("PortalCooldown", 55); });
    edit("portal-cooldown-neg", t -> { t.a("PortalCooldown", -5); });
    edit("dimension-end", t -> { t.a("Dimension", 1); });
    edit("dimension-odd", t -> { t.a("Dimension", 7); });
    edit("absorption", t -> { t.a("AbsorptionAmount", 4f); });
    edit("absorption-neg", t -> { t.a("AbsorptionAmount", -4f); });
    edit("invulnerable", t -> { t.a("Invulnerable", true); });
    edit("spawn-unforced", t -> { t.a("SpawnForced", false); });
    edit("spawn-partial", t -> { t.o("SpawnY"); });
    edit("gametype-3", t -> { t.a("playerGameType", 3); });
    edit("gametype-2", t -> { t.a("playerGameType", 2); });
    edit("gametype-9", t -> { t.a("playerGameType", 9); });
    edit("no-gametype", t -> { t.o("playerGameType"); });
    edit("selected-9", t -> { t.a("SelectedItemSlot", 9); });
    edit("selected-neg", t -> { t.a("SelectedItemSlot", -1); });
    edit("xp-odd", t -> { t.a("XpP", 0.99f); t.a("XpLevel", 30); t.a("XpTotal", 5000); t.a("Score", -4); });
    edit("health-nan", t -> { t.a("HealF", Float.NaN); });
    edit("health-neg", t -> { t.a("HealF", -3f); });
    edit("health-legacy-short", t -> { t.o("HealF"); t.a("Health", (short) 7); });
    edit("food-odd", t -> { t.a("foodLevel", -4); t.a("foodSaturationLevel", -1f); t.a("foodExhaustionLevel", 99f); t.a("foodTickTimer", 500); });
    edit("attr-modifiers", t -> {
      dq attrs = new dq(); dh a = new dh(); a.a("Name", "generic.maxHealth"); a.a("Base", 30.0); dq mods = new dq(); dh m = new dh(); m.a("Name", "Boost"); m.a("Amount", 4.0); m.a("Operation", 0); m.a("UUIDMost", 5L); m.a("UUIDLeast", 6L); mods.a(m); a.a("Modifiers", mods); attrs.a(a);
      dh s = new dh(); s.a("Name", "generic.movementSpeed"); s.a("Base", 0.2); attrs.a(s); t.a("Attributes", attrs); });
    edit("sword-slot0", t -> { dq inv = new dq(); inv.a(LevelDatProbe.slot(LevelDatProbe.stack(276, 1, 0), 0)); t.a("Inventory", inv); t.a("SelectedItemSlot", 0); });
    run("sword-ticked", null, p -> { yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p); inv.a[0] = new add(adb.d(276), 1, 0); p.h(); p.h(); });
    run("weapon-modifier", null, p -> { yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p); add sw = new add(adb.d(276), 1, 0); inv.a[0] = sw; p.bc().b(sw.D()); });
    run("sprinting", null, p -> { p.c(true); p.h(); });
    run("effects-ticked", LevelDatProbe.richPlayer(), p -> { p.h(); p.h(); });
    run("hurt-live", null, p -> { p.a(ro.j, 3f); });
  }
}
