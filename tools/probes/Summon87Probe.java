import java.lang.reflect.Field;
import java.util.*;

// Batch 87 summon87: what Entity.readFromNBT/writeToNBT keep through /summon, per entity kind, and a summoned mob's head yaw. Runs the unchanged CommandSummon
// (bu.b) on Summon86Probe's server double (CmdExec83Probe's world, which records spawnEntityInWorld). Output, one JSON line:
//   base: [[name, tag, {writeToNBT key: toString}]...] for every key of Entity.writeToNBT and a few class keys, right after the command.
//   ticks: [[name, tag, n, {key: toString} after n onUpdate calls, or "!exception"]...] (items, TNT and falling blocks on the double's empty world).
//   head: [[name, tag, runs, [rotationYaw, prevRotationYaw, rotationPitch, prevRotationPitch, renderYawOffset, prevRenderYawOffset, prevRotationYawHead] (identical in every run, or
//          null), min and max rotationYawHead over the runs, min and max of EntityTrackerEntry.lastHeadMotion (my.i) for a new entry, how many runs had head == rotationYaw]...].
public class Summon87Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static final String[] KEYS = { "Pos", "Motion", "Rotation", "FallDistance", "Fire", "Air", "OnGround", "Dimension", "Invulnerable", "PortalCooldown", "UUIDMost", "UUIDLeast",
    "Age", "Health", "Fuse", "Time", "Value", "Life", "xTile", "inGround", "life" };

  static List<sa> summon(String name, String tag) throws Exception {
    CmdExec83Probe.W.spawned.clear(); CmdExec83Probe.admin.clear();
    List<String> args = new ArrayList<>(Arrays.asList(name, "0.5", "64", "0.5"));
    if (tag != null) args.add(tag);
    CmdExec83Probe.byName.get("summon").b(CmdExec83Probe.alex, args.toArray(new String[0]));
    return new ArrayList<>(CmdExec83Probe.W.spawned);
  }
  static String dump(sa s) {
    dh tag = new dh();
    try { s.e(tag); } catch (Throwable t) { return q("!" + t); }
    StringBuilder b = new StringBuilder("{");
    for (String k : KEYS) if (tag.c(k)) b.append(b.length() > 1 ? "," : "").append(q(k)).append(":").append(q(tag.a(k).toString()));
    return b.append("}").toString();
  }
  static String f(float v) { return Float.toString(v); }

  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    String base = "Motion:[0.1d,0.2d,0.3d],Rotation:[400.0f,-200.0f],FallDistance:-3.5f,Fire:7s,Air:11s,OnGround:1b,Dimension:-1,Invulnerable:1b,PortalCooldown:9,UUIDMost:5L,UUIDLeast:6L";
    String[][] kinds = {
      { "Item", "Item:{id:1s,Count:1b,Damage:0s},Age:-32768s," }, { "XPOrb", "Value:3s," }, { "PrimedTnt", "Fuse:80b," }, { "FallingSand", "TileID:12,Time:1b," },
      { "Boat", "" }, { "MinecartRideable", "" }, { "MinecartChest", "" }, { "Painting", "Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"Kebab\"," },
      { "ItemFrame", "Direction:0b,TileX:0,TileY:64,TileZ:0," }, { "Arrow", "" }, { "Snowball", "" }, { "ThrownEnderpearl", "" }, { "ThrownExpBottle", "" },
      { "ThrownPotion", "Potion:{id:373s,Count:1b,Damage:16384s}," }, { "Fireball", "direction:[0.0d,0.0d,0.0d]," }, { "SmallFireball", "direction:[0.0d,0.0d,0.0d]," },
      { "WitherSkull", "direction:[0.0d,0.0d,0.0d]," }, { "EyeOfEnderSignal", "" }, { "FireworksRocketEntity", "" }, { "EnderCrystal", "" },
      { "Pig", "" }, { "Zombie", "" }, { "Squid", "" }, { "Bat", "" }, { "Slime", "" }, { "Ghast", "" }, { "Creeper", "" } };
    StringBuilder out = new StringBuilder("{\"base\":[");
    boolean first = true;
    for (String[] k : kinds) for (String extra : new String[] { k[1] + base, k[1].isEmpty() ? null : k[1].substring(0, k[1].length() - 1) }) {
      String tag = extra == null ? null : "{" + extra + "}";
      if (tag == null && k[1].isEmpty()) continue;
      String row;
      try { List<sa> got = summon(k[0], tag); row = got.isEmpty() ? q("!none") : dump(got.get(got.size() - 1)); } catch (Throwable t) { row = q("!" + t); }
      out.append(first ? "" : ",").append("[" + q(k[0]) + "," + q(tag) + "," + row + "]"); first = false;
    }
    // untagged object summons (Air, Fire, FallDistance from an id-only compound)
    for (String n : new String[] { "PrimedTnt", "FallingSand", "Boat", "XPOrb", "Pig", "EnderCrystal" }) {
      String row;
      try { List<sa> got = summon(n, null); row = got.isEmpty() ? q("!none") : dump(got.get(got.size() - 1)); } catch (Throwable t) { row = q("!" + t); }
      out.append(",[" + q(n) + ",null," + row + "]");
    }
    out.append("],\"ticks\":[");
    first = true;
    String[][] ticked = { { "Item", "{Item:{id:1s,Count:1b,Damage:0s},Age:-32768s}", "1" }, { "Item", "{Item:{id:1s,Count:1b,Damage:0s},Age:-32768s}", "3" },
      { "Item", "{Item:{id:1s,Count:1b,Damage:0s},Age:-1s}", "1" }, { "Item", "{Item:{id:1s,Count:1b,Damage:0s},Age:5999s}", "1" }, { "Item", "{Item:{id:1s,Count:1b,Damage:0s},Age:-32768s}", "40" } };
    for (String[] t : ticked) {
      String row;
      try {
        sa e = summon(t[0], t[1]).get(0);
        int n = Integer.parseInt(t[2]);
        for (int i = 0; i < n; i++) e.h();
        row = dump(e) + "," + e.K; // K: isDead
      } catch (Throwable x) { row = q("!" + x) + ",null"; }
      out.append(first ? "" : ",").append("[" + q(t[0]) + "," + q(t[1]) + "," + t[2] + "," + row + "]"); first = false;
    }
    out.append("],\"head\":[");
    first = true;
    Field y = sa.class.getDeclaredField("y"), A = sa.class.getDeclaredField("A"), z = sa.class.getDeclaredField("z"), B = sa.class.getDeclaredField("B");
    Field aM = sv.class.getDeclaredField("aM"), aN = sv.class.getDeclaredField("aN"), aO = sv.class.getDeclaredField("aO"), aP = sv.class.getDeclaredField("aP");
    for (Field fl : new Field[] { y, A, z, B, aM, aN, aO, aP }) fl.setAccessible(true);
    String[] mobs = { "Pig", "Zombie", "Creeper", "Spider", "Slime", "Villager", "EntityHorse", "Blaze" };
    String[] tags = { null, "{}", "{Rotation:[90.0f,30.0f]}", "{Rotation:[400.0f,-200.0f]}", "{Rotation:[-90.0f,0.0f]}" };
    int runs = 300;
    for (String m : mobs) for (String tag : tags) {
      String fixed = null; boolean same = true; float lo = Float.MAX_VALUE, hi = -Float.MAX_VALUE; int hlo = Integer.MAX_VALUE, hhi = Integer.MIN_VALUE, equal = 0; String crash = null;
      for (int r = 0; r < runs && crash == null; r++) {
        try {
          List<sa> got = summon(m, tag);
          sa e = null; for (sa s : got) if (s.getClass().getSimpleName().length() > 0 && s instanceof sv && e == null && got.indexOf(s) == got.size() - 1) e = s;
          if (e == null) e = got.get(got.size() - 1);
          String now = "[" + f(y.getFloat(e)) + "," + f(A.getFloat(e)) + "," + f(z.getFloat(e)) + "," + f(B.getFloat(e)) + "," + f(aM.getFloat(e)) + "," + f(aN.getFloat(e)) + "," + f(aP.getFloat(e)) + "]";
          if (fixed == null) fixed = now; else if (!fixed.equals(now)) same = false;
          float h = aO.getFloat(e); lo = Math.min(lo, h); hi = Math.max(hi, h);
          if (h == y.getFloat(e)) equal++;
          my entry = new my(e, 80, 3, true);
          hlo = Math.min(hlo, entry.i); hhi = Math.max(hhi, entry.i);
        } catch (Throwable t) { crash = String.valueOf(t); }
      }
      out.append(first ? "" : ",").append("[" + q(m) + "," + q(tag) + "," + runs + "," + (same ? fixed : "null") + "," + f(lo) + "," + f(hi) + "," + hlo + "," + hhi + "," + equal + (crash != null ? "," + q(crash) : "") + "]");
      first = false;
    }
    System.out.println(out.append("]}"));
  }
}
