import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;

// level.dat and the singleplayer player as the unchanged 1.7.10 classes write and read them:
// WorldInfo (ays) built from WorldSettings (ahj) and written with WorldInfo.cloneNBTCompound (ays.a(dh)), the Data
// compound SaveHandler wraps in level.dat; WorldInfo(NBTTagCompound) (ays(dh)) reading hand-made Data compounds and
// writing them again; and EntityPlayer (yz, through the real constructor on the MobMoveProbe world double) loaded
// with Entity.readFromNBT (sa.f) and saved with Entity.writeToNBT (sa.e), the calls SaveHandler.readPlayerData and
// writePlayerData make. One JSON object per line; `written` is the uncompressed hex of the written compound
// (LastPlayed, which is MinecraftServer.getCurrentTimeMillis, is zeroed; UUIDMost/UUIDLeast are fixed by the probe).
public class LevelDatProbe {
  static sun.misc.Unsafe u;
  static W world;

  public static class W extends MobMoveProbe.ProbeWorld {}
  public static class P extends yz {
    P(ahb w, com.mojang.authlib.GameProfile g) { super(w, g); }
    public void a(fj message) {}
    public boolean a(int level, String command) { return false; }
    public r f_() { return new r(0, 0, 0); }
  }

  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }

  static P player() throws Exception {
    return new P(world, new com.mojang.authlib.GameProfile(new UUID(1L, 2L), "Player"));
  }
  static void fixUuid(dh t) { if (t.b("UUIDMost", 99)) { t.a("UUIDMost", 1L); t.a("UUIDLeast", 2L); } }

  static dh stack(int id, int count, int damage) { dh s = new dh(); s.a("id", (short) id); s.a("Count", (byte) count); s.a("Damage", (short) damage); return s; }
  static dh slot(dh s, int slot) { s.a("Slot", (byte) slot); return s; }
  static dq doubles(double... v) { dq l = new dq(); for (double d : v) l.a(new dk(d)); return l; }
  static dq floats(float... v) { dq l = new dq(); for (float f : v) l.a(new dm(f)); return l; }
  static dh effect(int id, int amp, int duration, boolean ambient) { dh e = new dh(); e.a("Id", (byte) id); e.a("Amplifier", (byte) amp); e.a("Duration", duration); e.a("Ambient", ambient); return e; }

  // A survival player as a real save would hold it (every key EntityPlayer and its superclasses read).
  static dh richPlayer() {
    dh t = new dh();
    t.a("Pos", doubles(100.5, 70.0, -20.25));
    t.a("Motion", doubles(0.1, -0.0784000015258789, 0.0));
    t.a("Rotation", floats(45.5f, -10.0f));
    t.a("FallDistance", 2.5f); t.a("Fire", (short) -20); t.a("Air", (short) 250); t.a("OnGround", true); t.a("Dimension", 0);
    t.a("Invulnerable", false); t.a("PortalCooldown", 0);
    t.a("HealF", 13.5f); t.a("Health", (short) 14); t.a("AbsorptionAmount", 0.0f); t.a("HurtTime", (short) 0); t.a("DeathTime", (short) 0); t.a("AttackTime", (short) 0);
    dq effects = new dq(); effects.a(effect(1, 1, 600, false)); effects.a(effect(16, 0, 3600, true)); t.a("ActiveEffects", effects);
    dq inv = new dq();
    dh pick = slot(stack(278, 1, 12), 0); dh tag = new dh(); dq ench = new dq(); dh e = new dh(); e.a("id", (short) 32); e.a("lvl", (short) 3); ench.a(e); tag.a("ench", ench);
    dh display = new dh(); display.a("Name", "Mining pick"); tag.a("display", display); tag.a("RepairCost", 3); pick.a("tag", tag); inv.a(pick);
    inv.a(slot(stack(1, 64, 0), 1));
    inv.a(slot(stack(400, 3, 0), 8));
    inv.a(slot(stack(35, 5, 14), 9));
    dh book = slot(stack(387, 1, 0), 35); dh bt = new dh(); bt.a("title", "Notes"); bt.a("author", "Player"); dq pages = new dq(); pages.a(new dx("Hello")); bt.a("pages", pages); book.a("tag", bt); inv.a(book);
    inv.a(slot(stack(313, 1, 10), 100));
    inv.a(slot(stack(304, 1, 0), 101));
    dh chest = slot(stack(299, 1, 0), 102); dh ct = new dh(); dh cd = new dh(); cd.a("color", 0x336699); ct.a("display", cd); chest.a("tag", ct); inv.a(chest);
    inv.a(slot(stack(86, 1, 0), 103));
    t.a("Inventory", inv);
    t.a("SelectedItemSlot", 1); t.a("Sleeping", false); t.a("SleepTimer", (short) 0);
    t.a("XpP", 0.25f); t.a("XpLevel", 7); t.a("XpTotal", 120); t.a("Score", 99);
    t.a("SpawnX", -40); t.a("SpawnY", 65); t.a("SpawnZ", 12); t.a("SpawnForced", true);
    t.a("foodLevel", 17); t.a("foodTickTimer", 30); t.a("foodSaturationLevel", 2.5f); t.a("foodExhaustionLevel", 1.25f);
    dh ab = new dh(); ab.a("invulnerable", false); ab.a("flying", false); ab.a("mayfly", false); ab.a("instabuild", false); ab.a("mayBuild", true); ab.a("flySpeed", 0.05f); ab.a("walkSpeed", 0.1f); t.a("abilities", ab);
    dq ender = new dq(); ender.a(slot(stack(49, 10, 0), 0)); ender.a(slot(stack(368, 16, 0), 26)); t.a("EnderItems", ender);
    t.a("playerGameType", 0);
    t.a("UUIDMost", 1L); t.a("UUIDLeast", 2L);
    return t;
  }

  interface Edit { void apply(dh t) throws Exception; }

  static String playerJson(P p) throws Exception {
    yx inv = (yx) MobMoveProbe.field(yz.class, "bm").get(p);
    zr food = (zr) MobMoveProbe.field(yz.class, "bp").get(p);
    yw ab = (yw) MobMoveProbe.field(yz.class, "bE").get(p);
    StringBuilder s = new StringBuilder();
    s.append("\"pos\":[").append(p.s).append(',').append(p.t).append(',').append(p.u).append("],\"yaw\":").append(p.y).append(",\"pitch\":").append(p.z);
    s.append(",\"health\":").append(p.aS()).append(",\"current\":").append(inv.c);
    s.append(",\"food\":[").append(MobMoveProbe.field(zr.class, "a").getInt(food)).append(',').append(MobMoveProbe.field(zr.class, "b").getFloat(food)).append(',')
      .append(MobMoveProbe.field(zr.class, "c").getFloat(food)).append(',').append(MobMoveProbe.field(zr.class, "d").getInt(food)).append(']');
    s.append(",\"abilities\":[").append(ab.a).append(',').append(ab.b).append(',').append(ab.c).append(',').append(ab.d).append(',').append(ab.e).append("]");
    s.append(",\"xp\":[").append(MobMoveProbe.field(yz.class, "bF").getInt(p)).append(',').append(MobMoveProbe.field(yz.class, "bG").getInt(p)).append(',').append(MobMoveProbe.field(yz.class, "bH").getFloat(p)).append(']');
    s.append(",\"slots\":[");
    for (int i = 0; i < inv.a.length; i++) { if (i > 0) s.append(','); add st = inv.a[i]; s.append(st == null ? "null" : "[" + adb.b(st.b()) + "," + st.b + "," + st.k() + "]"); }
    s.append("],\"armor\":[");
    for (int i = 0; i < inv.b.length; i++) { if (i > 0) s.append(','); add st = inv.b[i]; s.append(st == null ? "null" : "[" + adb.b(st.b()) + "," + st.b + "," + st.k() + "]"); }
    s.append("],\"effects\":[");
    boolean first = true;
    for (Object o : p.aQ()) { rw r = (rw) o; if (!first) s.append(','); first = false; s.append("[").append(r.a()).append(',').append(r.b()).append(',').append(r.c()).append(',').append(r.e()).append(']'); }
    s.append("]");
    return s.toString();
  }

  static void playerCase(String name, dh input) throws Exception {
    P p = player();
    String error = null;
    if (input != null) try { p.f(input); } catch (RuntimeException e) { error = e.toString(); }
    dh out = new dh();
    p.e(out);
    fixUuid(out);
    System.out.println("{\"case\":\"player\",\"name\":" + q(name) + (input == null ? "" : ",\"input\":\"" + hex(input) + "\"") + (error == null ? "" : ",\"error\":" + q(error))
      + ",\"written\":\"" + hex(out) + "\"," + playerJson(p) + "}");
  }

  static dh written(ays info, dh player) throws Exception {
    dh data = info.a(player);
    data.a("LastPlayed", 0L);
    return data;
  }

  static void settingsCase(String name, ahj settings, String level, Edit edit) throws Exception {
    ays info = new ays(settings, level);
    P p = player();
    p.f(richPlayer());
    dh pt = new dh(); p.e(pt); fixUuid(pt);
    edit.apply(pt);
    dh data = written(info, pt);
    // SaveHandler.saveWorldInfoWithPlayer: level.dat is { Data: <this> } in a gzip stream (CompressedStreamTools.writeCompressed).
    dh again = written(new ays(data), pt);
    System.out.println("{\"case\":\"settings\",\"name\":" + q(name) + ",\"written\":\"" + hex(data) + "\",\"reread\":\"" + hex(again) + "\"}");
  }

  static void readCase(String name, Edit edit) throws Exception {
    dh data = new dh();
    data.a("RandomSeed", 8675309L); data.a("generatorName", "default"); data.a("generatorVersion", 1); data.a("generatorOptions", "");
    data.a("GameType", 0); data.a("MapFeatures", true); data.a("SpawnX", 12); data.a("SpawnY", 70); data.a("SpawnZ", -30);
    data.a("Time", 123456L); data.a("DayTime", 30000L); data.a("SizeOnDisk", 0L); data.a("LastPlayed", 0L); data.a("LevelName", "Read");
    data.a("version", 19133); data.a("rainTime", 500); data.a("raining", false); data.a("thunderTime", 900); data.a("thundering", false);
    data.a("hardcore", false); data.a("allowCommands", false); data.a("initialized", true);
    edit.apply(data);
    ays info = new ays(data);
    dh out = written(info, null);
    System.out.println("{\"case\":\"read\",\"name\":" + q(name) + ",\"input\":\"" + hex(data) + "\",\"written\":\"" + hex(out) + "\",\"dimension\":" + info.j() + "}");
  }

  public static void main(String[] args) throws Exception {
    aji.p(); adb.l();
    u = MobMoveProbe.unsafe();
    world = (W) u.allocateInstance(W.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    ays worldInfo = new ays(new ahj(17L, ahk.b, true, false, ahm.b), "Probe");
    worldInfo.a(8, 64, 8);
    MobMoveProbe.field(ahb.class, "x").set(world, worldInfo);

    // WorldType registry: id, name, generator version and the version lookup (WorldType.getWorldTypeForGeneratorVersion).
    for (ahm t : ahm.a) if (t != null)
      System.out.println("{\"case\":\"worldType\",\"id\":" + t.g() + ",\"name\":" + q(t.a()) + ",\"version\":" + t.d() + ",\"versioned\":" + t.f() + ",\"v0\":" + q(t.a(0).a()) + ",\"v1\":" + q(t.a(1).a()) + "}");
    for (String n : new String[] { "default", "DEFAULT", "Flat", "largeBiomes", "LARGEBIOMES", "amplified", "default_1_1", "bogus", "" }) {
      ahm t = ahm.a(n);
      System.out.println("{\"case\":\"parseWorldType\",\"name\":" + q(n) + ",\"type\":" + (t == null ? "null" : q(t.a())) + "}");
    }
    // GameRules defaults (GameRules.<init>) and the boolean read (GameRules.getGameRuleBooleanValue).
    agy rules = new agy();
    System.out.println("{\"case\":\"gameRules\",\"written\":\"" + hex(rules.a()) + "\"}");
    for (String v : new String[] { "true", "TRUE", "True", "false", "1", "yes", "" }) {
      agy r = new agy(); r.b("keepInventory", v);
      System.out.println("{\"case\":\"ruleValue\",\"value\":" + q(v) + ",\"on\":" + r.b("keepInventory") + "}");
    }

    // Players: a fresh player, the rich survival save loaded and saved, and edge cases of EntityPlayer.readEntityFromNBT.
    playerCase("fresh", null);
    playerCase("rich", richPlayer());
    Edit[] none = {};
    Object[][] edits = {
      { "creative-flying", (Edit) t -> { dh ab = t.m("abilities"); ab.a("flying", true); ab.a("mayfly", true); ab.a("instabuild", true); ab.a("invulnerable", true); ab.a("flySpeed", 0.1f); t.a("playerGameType", 1); } },
      { "legacy-health", (Edit) t -> { t.o("HealF"); t.a("Health", (short) 9); } },
      { "health-over-max", (Edit) t -> { t.a("HealF", 40.0f); } },
      { "selected-out-of-range", (Edit) t -> { t.a("SelectedItemSlot", 12); } },
      { "food-over-max", (Edit) t -> { t.a("foodLevel", 25); t.a("foodSaturationLevel", 30.0f); } },
      { "xp-progress-over-one", (Edit) t -> { t.a("XpP", 1.5f); t.a("XpLevel", -3); } },
      { "inventory-odd-slots", (Edit) t -> { dq inv = new dq(); inv.a(slot(stack(1, 1, 0), 36)); inv.a(slot(stack(1, 2, 0), 99)); inv.a(slot(stack(1, 3, 0), 104)); inv.a(slot(stack(1, 4, 0), -1)); inv.a(slot(stack(9999, 5, 0), 2)); inv.a(slot(stack(1, 0, 0), 3)); t.a("Inventory", inv); } },
      { "nether", (Edit) t -> { t.a("Dimension", -1); } },
      { "no-spawn", (Edit) t -> { t.o("SpawnX"); t.o("SpawnForced"); } },
      { "no-abilities", (Edit) t -> { t.o("abilities"); } },
      { "no-food", (Edit) t -> { t.o("foodLevel"); t.o("foodTickTimer"); t.o("foodSaturationLevel"); t.o("foodExhaustionLevel"); } },
      { "fire-air", (Edit) t -> { t.a("Fire", (short) 160); t.a("Air", (short) -5); t.a("FallDistance", 30.0f); } },
      { "effects-odd", (Edit) t -> { dq e = new dq(); e.a(effect(14, 0, 0, false)); e.a(effect(5, -1, 100, false)); e.a(effect(99, 0, 100, false)); t.a("ActiveEffects", e); } },
      { "ender-odd-slots", (Edit) t -> { dq e = new dq(); e.a(slot(stack(1, 1, 0), 27)); e.a(slot(stack(1, 2, 0), -2)); e.a(slot(stack(1, 3, 0), 5)); t.a("EnderItems", e); } },
    };
    for (Object[] e : edits) { dh t = richPlayer(); ((Edit) e[1]).apply(t); playerCase((String) e[0], t); }

    // level.dat as created by GuiCreateWorld's WorldSettings for each world type, with the rich player.
    Edit keep = t -> {};
    settingsCase("default-survival", new ahj(17L, ahk.b, true, false, ahm.b), "Default", keep);
    settingsCase("flat-creative-commands", new ahj(-1234567890123L, ahk.c, true, false, ahm.c).a("2;7,2x3,2;1;village").b(), "Flat", keep);
    settingsCase("largeBiomes-hardcore", new ahj(42L, ahk.b, true, true, ahm.d), "Large", keep);
    settingsCase("amplified-adventure-nofeatures", new ahj(Long.MIN_VALUE, ahk.d, false, false, ahm.e).b().a(), "Amplified", keep);
    settingsCase("default_1_1", new ahj(Long.MAX_VALUE, ahk.b, true, false, ahm.f), "Old", keep);

    // WorldInfo(NBTTagCompound) on hand-made Data compounds: what it keeps, defaults and normalises.
    readCase("baseline", t -> {});
    readCase("default-version-0", t -> t.a("generatorVersion", 0));
    readCase("no-generator-version", t -> t.o("generatorVersion"));
    readCase("uppercase-name", t -> t.a("generatorName", "LARGEBIOMES"));
    readCase("unknown-name", t -> t.a("generatorName", "bogus"));
    readCase("no-generator-name", t -> { t.o("generatorName"); t.o("generatorVersion"); });
    readCase("flat-options", t -> { t.a("generatorName", "flat"); t.a("generatorVersion", 0); t.a("generatorOptions", "2;7,3x1,52;2;"); });
    readCase("no-day-time", t -> t.o("DayTime"));
    readCase("creative-no-allow-commands", t -> { t.a("GameType", 1); t.o("allowCommands"); });
    readCase("survival-no-allow-commands", t -> t.o("allowCommands"));
    readCase("no-map-features", t -> t.o("MapFeatures"));
    readCase("no-initialized", t -> t.o("initialized"));
    readCase("bad-game-type", t -> t.a("GameType", 7));
    readCase("weather", t -> { t.a("raining", true); t.a("thundering", true); t.a("rainTime", 1); t.a("thunderTime", 2); });
    readCase("game-rules", t -> { dh r = new dh(); r.a("keepInventory", "TRUE"); r.a("doDaylightCycle", "false"); r.a("customRule", "7"); t.a("GameRules", r); });
    readCase("player-dimension", t -> { dh p = new dh(); p.a("Dimension", 1); t.a("Player", p); });
    readCase("difficulty-ignored", t -> t.a("Difficulty", (byte) 3));
  }
}
