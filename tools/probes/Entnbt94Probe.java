import java.util.*;

// Batch 94 entnbt94: edge values through the real 1.7.10 classes (CommandSummon on Summon86Probe's server double, then Entity.writeToNBTOptional sa.c).
// Part 1 "death": mobs summoned at Health 0 / live with a DeathTime, written after N onUpdate calls: [name, tag, [[updates, "HealF Health DeathTime isDead" or null]...]]; the dragon and the crystal included.
// Part 2 "edge": [name, tag, "written compound toString" (every key, sorted) or "!exception"]; then the same compound reloaded (sg.a) and written again.
public class Entnbt94Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static String line(sa e) throws Exception { dh t = new dh(); if (!e.c(t)) return null; return t.c("HealF") ? t.h("HealF") + " " + t.e("Health") + " " + (t.c("DeathTime") ? t.e("DeathTime") : "none") + " " + e.K : "nolive " + (t.c("DeathTime") ? t.e("DeathTime") : "none") + " " + e.K; }
  static String sorted(dh t) {
    TreeSet<String> ks = new TreeSet<>();
    for (Object k : t.c()) ks.add((String) k);
    StringBuilder b = new StringBuilder();
    for (String k : ks) b.append(k).append('=').append(t.a(k).toString()).append(';');
    return b.toString();
  }
  static String hexW(String name, String tag) {
    try { List<sa> got = Summon87Probe.summon(name, tag); if (got.isEmpty()) return "!none"; dh t = new dh(); if (!got.get(got.size() - 1).c(t)) return "!notsaved"; return MobNbtProbe.hex(t); } catch (Throwable x) { return "!" + x; }
  }
  static String edge(String name, String tag, boolean reload) {
    try {
      List<sa> got = Summon87Probe.summon(name, tag);
      if (got.isEmpty()) return "!none";
      sa e = got.get(got.size() - 1);
      dh t = new dh(); if (!e.c(t)) return "!notsaved";
      if (!reload) return sorted(t);
      sa r = sg.a(t, PlayerDamageProbe.w); if (r == null) return "!null";
      dh t2 = new dh(); if (!r.c(t2)) return "!notsaved2";
      return sorted(t2);
    } catch (Throwable x) { return "!" + x; }
  }
  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    String[][] cases = { { "Cow", "{HealF:0f,Health:0s,DeathTime:25s}" }, { "Cow", "{HealF:0f,Health:0s,DeathTime:-5s}" }, { "Cow", "{HealF:0f,Health:0s,DeathTime:19s}" }, { "Cow", "{HealF:10f,Health:10s,DeathTime:-3s}" },
      { "Cow", "{HealF:10f,Health:10s,DeathTime:9s,HurtTime:5s}" }, { "Cow", "{HealF:10f,Health:10s,DeathTime:30s}" }, { "EnderDragon", "{DeathTime:9s}" }, { "EnderDragon", "{HealF:0f,Health:0s,DeathTime:9s}" }, { "EnderCrystal", "{DeathTime:9s,Health:0s}" } };
    StringBuilder out = new StringBuilder("{\"death\":[");
    boolean first = true;
    for (String[] c : cases) {
      StringBuilder steps = new StringBuilder();
      try {
        List<sa> got = Summon87Probe.summon(c[0], c[1]);
        sa e = got.get(got.size() - 1);
        int done = 0;
        for (int target : new int[] { 0, 1, 5, 19, 20, 21, 40 }) {
          while (done < target) { try { e.h(); } catch (Throwable t) { steps.append((steps.length() == 0 ? "" : ",") + "[-1," + q("!" + t) + "]"); done = 999; break; } done++; }
          if (done == 999) break;
          steps.append(steps.length() == 0 ? "" : ",").append("[" + target + "," + q(line(e)) + "]");
        }
      } catch (Throwable t) { steps.append((steps.length() == 0 ? "" : ",") + "[-1," + q("!" + t) + "]"); }
      out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + ",[" + steps + "]]"); first = false;
    }
    out.append("],\"edge\":[");
    String it = "{id:1s,Count:1b,Damage:0s}";
    String[][] edges = {
      { "Cow", "{AbsorptionAmount:-5f}" }, { "Cow", "{AbsorptionAmount:3.5f}" }, { "Cow", "{AbsorptionAmount:1e30f}" },
      { "Zombie", "{ActiveEffects:[{Id:1b,Amplifier:-56b,Duration:0,Ambient:1b}]}" }, { "Zombie", "{ActiveEffects:[{Id:1b,Amplifier:127b,Duration:200,Ambient:1b},{Id:5b,Amplifier:3b,Duration:-1,Ambient:0b}]}" },
      { "Zombie", "{ActiveEffects:[{Id:1b,Amplifier:300,Duration:100}]}" }, { "Zombie", "{ActiveEffects:[{Id:99b,Amplifier:1b,Duration:100}]}" }, { "Zombie", "{ActiveEffects:[{Id:0b,Amplifier:1b,Duration:100}]}" }, { "Zombie", "{ActiveEffects:[{Id:23b,Amplifier:1b,Duration:100},{Id:24b,Amplifier:1b,Duration:100},{Id:31b,Amplifier:1b,Duration:100},{Id:32b,Amplifier:1b,Duration:100},{Id:-1b,Amplifier:1b,Duration:100}]}" },
      { "Cow", "{Leashed:1b,Leash:{UUIDMost:1L,UUIDLeast:2L}}" }, { "Cow", "{Leashed:1b,Leash:{X:1,Y:64,Z:1}}" }, { "Cow", "{Leashed:1b}" }, { "Cow", "{Leashed:0b,Leash:{X:1,Y:64,Z:1}}" },
      { "Villager", "{Profession:1,Offers:{Recipes:[{buy:" + it + ",sell:{id:2s,Count:1b,Damage:0s},uses:7,maxUses:7}]}}" },
      { "Villager", "{Profession:1,Offers:{Recipes:[{buy:" + it + ",sell:{id:2s,Count:1b,Damage:0s},uses:12,maxUses:7}]}}" },
      { "Villager", "{Profession:1,Offers:{Recipes:[{buy:" + it + ",buyB:{id:3s,Count:2b,Damage:0s},sell:{id:2s,Count:1b,Damage:0s},uses:-1,maxUses:0}]}}" },
      { "Villager", "{Profession:1,Offers:{Recipes:[{buy:" + it + ",sell:{id:2s,Count:1b,Damage:0s}}]}}" },
      { "Villager", "{Profession:9,Riches:-5}" },
      { "EntityHorse", "{Tame:1b,Type:0,SaddleItem:{id:329s,Count:1b,Damage:0s},ArmorItem:{id:417s,Count:1b,Damage:0s}}" },
      { "EntityHorse", "{Tame:1b,Type:0,SaddleItem:{id:1s,Count:1b,Damage:0s},ArmorItem:{id:1s,Count:1b,Damage:0s}}" },
      { "EntityHorse", "{Tame:0b,Type:0,SaddleItem:{id:329s,Count:1b,Damage:0s},ArmorItem:{id:419s,Count:1b,Damage:0s}}" },
      { "EntityHorse", "{Tame:1b,Type:1,ChestedHorse:1b,SaddleItem:{id:329s,Count:1b,Damage:0s},ArmorItem:{id:417s,Count:1b,Damage:0s}}" },
      { "Ghast", "{ExplosionPower:200}" }, { "Ghast", "{ExplosionPower:-3}" }, { "Ghast", "{ExplosionPower:100000}" },
      { "Enderman", "{carried:300s,carriedData:5s}" }, { "Enderman", "{carried:0s,carriedData:5s}" }, { "Enderman", "{carried:-1s,carriedData:300s}" }, { "Enderman", "{carried:4096s,carriedData:15s}" }, { "Enderman", "{carried:166s,carriedData:2s}" }, { "Enderman", "{carried:200s,carriedData:200s}" }, { "Enderman", "{carried:1s,carriedData:-56s}" }, { "Enderman", "{carried:175s,carriedData:7s}" },
      { "ItemFrame", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Item:" + it + ",ItemRotation:7b}" }, { "ItemFrame", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Item:" + it + ",ItemRotation:-1b,ItemDropChance:2f}" },
      { "ItemFrame", "{Direction:0b,TileX:0,TileY:64,TileZ:0,ItemRotation:5b}" }, { "ItemFrame", "{Direction:9b,TileX:0,TileY:64,TileZ:0}" },
      { "Painting", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"Foo\"}" }, { "Painting", "{Direction:0b,TileX:0,TileY:64,TileZ:0}" }, { "Painting", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"kebab\"}" },
      { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:20,DisplayData:1,DisplayOffset:6}" }, { "MinecartRideable", "{CustomDisplayTile:0b,DisplayTile:20,DisplayData:1,DisplayOffset:6}" },
      { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:0,DisplayData:1,DisplayOffset:0}" }, { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:300,DisplayData:-1,DisplayOffset:-9}" },
      { "MinecartChest", "{CustomDisplayTile:1b,DisplayTile:20,DisplayOffset:3}" },
      { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:166,DisplayData:2,DisplayOffset:6}" }, { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:200,DisplayData:2,DisplayOffset:6}" },
      { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:65556,DisplayData:2,DisplayOffset:6}" }, { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:-1,DisplayData:2,DisplayOffset:6}" }, { "MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:175,DisplayData:70000,DisplayOffset:6}" } };
    first = true;
    for (String[] c : edges) { out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + "," + q(edge(c[0], c[1], false)) + "," + q(edge(c[0], c[1], true)) + "," + q(hexW(c[0], c[1])) + "]"); first = false; }
    System.out.println(out.append("]}"));
  }
}
