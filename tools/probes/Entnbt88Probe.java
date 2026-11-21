import java.lang.reflect.Field;
import java.util.*;

// Batch 88 entnbt88: the Entity base keys of Summon87Probe, in a Nether world (provider id -1) and over update ticks. Runs the unchanged CommandSummon
// (bu.b) on Summon86Probe's server double through Summon87Probe.summon / dump. Output, one JSON line:
//   nether: [[name, tag, {writeToNBT key: toString}]...]: summoned with the double's provider id set to -1; "new:<name>" rows are EntityList.createEntityByName
//           (the plain constructor, no readFromNBT), the way a natural spawn or a dropped item starts.
//   ticks:  [[name, tag, n, {key: toString} after n onUpdate (sa.h) calls or "!exception", isDead]...] in the Overworld double.
//   fall:   [[name, tag, "ground" | "air" | "water" | "up", dy, {key} after one moveEntity (sa.d(0, dy, 0)), isDead]...] for a boat and a pig.
public class Entnbt88Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static void provider(int id) throws Exception { PlayerDamageProbe.w.t.i = id; }

  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    StringBuilder out = new StringBuilder("{\"nether\":[");
    boolean first = true;
    String[][] nether = { { "Pig", null }, { "Pig", "{}" }, { "Pig", "{Dimension:1}" }, { "Zombie", null }, { "Item", "{Item:{id:1s,Count:1b,Damage:0s}}" },
      { "XPOrb", "{Value:3s}" }, { "Boat", null }, { "MinecartRideable", null }, { "Arrow", null }, { "Snowball", null }, { "PrimedTnt", null },
      { "Painting", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"Kebab\"}" } };
    provider(-1);
    try {
      for (String[] k : nether) {
        String row;
        try { List<sa> got = Summon87Probe.summon(k[0], k[1]); row = got.isEmpty() ? q("!none") : Summon87Probe.dump(got.get(got.size() - 1)); } catch (Throwable t) { row = q("!" + t); }
        out.append(first ? "" : ",").append("[" + q(k[0]) + "," + q(k[1]) + "," + row + "]"); first = false;
      }
      for (String n : new String[] { "Pig", "Item", "Boat", "Arrow" }) {
        String row;
        try { sa e = sg.a(n, PlayerDamageProbe.w); row = e == null ? q("!none") : Summon87Probe.dump(e); } catch (Throwable t) { row = q("!" + t); }
        out.append(",[" + q("new:" + n) + ",null," + row + "]");
      }
    } finally { provider(0); }
    out.append("],\"ticks\":[");
    first = true;
    String item = "Item:{id:1s,Count:1b,Damage:0s},";
    String[][] ticked = {
      { "Item", "{" + item + "PortalCooldown:5000,Air:11s}", "1" }, { "Item", "{" + item + "PortalCooldown:5000,Air:11s}", "3" }, { "Item", "{" + item + "PortalCooldown:-7}", "3" },
      { "XPOrb", "{Value:3s,PortalCooldown:5000,Air:11s}", "2" }, { "Boat", "{PortalCooldown:5000,Air:11s}", "1" }, { "Boat", "{PortalCooldown:-7}", "2" },
      { "MinecartRideable", "{PortalCooldown:5000,Air:11s}", "1" }, { "Snowball", "{PortalCooldown:9,Air:11s}", "2" }, { "Arrow", "{PortalCooldown:9,Air:11s}", "2" },
      { "Painting", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"Kebab\",PortalCooldown:9,Air:11s}", "2" },
      { "Pig", "{PortalCooldown:5000,Air:11s,Fire:-20s,FallDistance:-2.0f,OnGround:1b,Rotation:[10.0f,25.0f]}", "1" }, { "Pig", "{PortalCooldown:-7}", "2" } };
    for (String[] t : ticked) {
      String row;
      try {
        List<sa> got = Summon87Probe.summon(t[0], t[1]);
        sa e = got.get(got.size() - 1);
        int n = Integer.parseInt(t[2]);
        for (int i = 0; i < n; i++) e.h();
        row = Summon87Probe.dump(e) + "," + e.K;
      } catch (Throwable x) { row = q("!" + x) + ",null"; }
      out.append(first ? "" : ",").append("[" + q(t[0]) + "," + q(t[1]) + "," + t[2] + "," + row + "]"); first = false;
    }
    out.append("],\"fall\":[");
    first = true;
    // The double's collision boxes are the cells below y 0 (DifficultyProbe.World.a(sa, azt)); its getBlock reads SuffocationProbe's cells (stone below y 0).
    // "ground": the box bottom at y 0 (a boat's posY (double) 0.3f, its float yOffset; a pig's posY 0), so dy -0.5 is cut to 0 and onGround is set. "air": posY 70 over air.
    // "water": still water (9) at 0,68,0 under a boat at posY 69.25. "up": dy +0.5 in air.
    Object[][] falls = {
      { "Boat", "{FallDistance:-2.0f}", "ground", (double) 0.3f, -0.5 }, { "Boat", "{FallDistance:2.5f}", "ground", (double) 0.3f, -0.5 }, { "Boat", "{FallDistance:3.0f}", "ground", (double) 0.3f, -0.5 },
      { "Boat", "{FallDistance:3.5f}", "ground", (double) 0.3f, -0.5 }, { "Boat", "{FallDistance:-2.0f}", "air", 70.0, -0.5 }, { "Boat", "{FallDistance:1.0f}", "water", 69.25, -0.125 },
      { "Boat", "{FallDistance:1.0f}", "up", 70.0, 0.5 }, { "Pig", "{FallDistance:-2.0f}", "ground", 0.0, -0.5 }, { "Pig", "{FallDistance:2.5f}", "ground", 0.0, -0.5 } };
    for (Object[] fcase : falls) {
      String row;
      SuffocationProbe.World.cells.clear();
      try {
        if (fcase[2].equals("water")) SuffocationProbe.put(0, 68, 0, 9);
        List<sa> got = Summon87Probe.summon((String) fcase[0], (String) fcase[1]);
        sa e = got.get(got.size() - 1);
        e.b(0.5, (Double) fcase[3], 0.5); // setPosition
        e.d(0.0, (Double) fcase[4], 0.0);   // moveEntity
        row = Summon87Probe.dump(e) + "," + e.K;
      } catch (Throwable x) { row = q("!" + x) + ",null"; }
      SuffocationProbe.World.cells.clear();
      out.append(first ? "" : ",").append("[" + q((String) fcase[0]) + "," + q((String) fcase[1]) + "," + q((String) fcase[2]) + "," + fcase[4] + "," + row + "]"); first = false;
    }
    System.out.println(out.append("]}"));
  }
}
