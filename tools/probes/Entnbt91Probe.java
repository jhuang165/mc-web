import java.util.*;

// Batch 91 entnbt91: the chunk-save NBT (Entity.writeToNBTOptional, sa.c) of every EntityList id, written by the unchanged 1.7.10 classes after the real /summon
// (CommandSummon on Summon86Probe's server double, through Summon87Probe.summon). Each id is summoned plain and, for the living ones, with a rich tag (custom name, loot flags,
// absorption, an effect, equipment and drop chances). Per row: [name, tag-as-given, "plain"|"rich", writeToNBTOptional hex or null, the reloaded copy written again (hex) or null].
// One JSON line {"rows": [...]}.
public class Entnbt91Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static String hexOf(sa e) throws Exception { dh t = new dh(); if (!e.c(t)) return null; return MobNbtProbe.hex(t); }
  static String again(sa e) throws Exception { dh t = new dh(); if (!e.c(t)) return null; sa r = sg.a(t, PlayerDamageProbe.w); if (r == null) return "!null"; return hexOf(r); }

  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    Map<String, String> need = new HashMap<>();
    need.put("Item", "{Item:{id:1s,Count:3b,Damage:0s},Age:5s,Health:4s,PickupDelay:7s,Owner:\"Alex\",Thrower:\"Steve\"}");
    need.put("XPOrb", "{Value:3s,Age:9s,Health:4s}");
    need.put("PrimedTnt", "{Fuse:50b}");
    need.put("FallingSand", "{TileID:12,Data:1b,Time:3b,DropItem:0b,HurtEntities:1b,FallHurtMax:30,FallHurtAmount:1.5f}");
    need.put("Painting", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Motive:\"Kebab\"}");
    need.put("ItemFrame", "{Direction:0b,TileX:0,TileY:64,TileZ:0,Item:{id:1s,Count:1b,Damage:0s},ItemRotation:2b,ItemDropChance:0.5f}");
    need.put("LeashKnot", "{TileX:0,TileY:64,TileZ:0}");
    need.put("ThrownPotion", "{Potion:{id:373s,Count:1b,Damage:16384s}}");
    need.put("Arrow", "{xTile:3s,yTile:4s,zTile:5s,inTile:1b,inData:2b,shake:3b,inGround:1b,pickup:2b,damage:3.5d,life:7s}");
    need.put("Fireball", "{direction:[0.1d,0.2d,0.3d],ExplosionPower:3,xTile:3s,yTile:4s,zTile:5s,inTile:1b,inGround:1b}");
    need.put("SmallFireball", "{direction:[0.1d,0.2d,0.3d],xTile:3s,yTile:4s,zTile:5s,inTile:1b,inGround:1b}");
    need.put("WitherSkull", "{direction:[0.1d,0.2d,0.3d],xTile:3s,yTile:4s,zTile:5s,inTile:1b,inGround:1b}");
    need.put("FireworksRocketEntity", "{Life:5,LifeTime:30,FireworksItem:{id:401s,Count:1b,Damage:0s,tag:{Fireworks:{Flight:2b}}}}");
    need.put("MinecartSpawner", "{EntityId:\"Pig\",Delay:5s}");
    need.put("MinecartCommandBlock", "{Command:\"say hi\",SuccessCount:2,LastOutput:\"x\"}");
    need.put("MinecartChest", "{Items:[{Slot:0b,id:1s,Count:2b,Damage:0s}]}");
    need.put("MinecartHopper", "{Items:[{Slot:0b,id:1s,Count:2b,Damage:0s}],TransferCooldown:3}");
    need.put("MinecartFurnace", "{PushX:0.5d,PushZ:0.25d,Fuel:100s}");
    need.put("MinecartTNT", "{TNTFuse:30}");
    need.put("MinecartRideable", "{CustomDisplayTile:1b,DisplayTile:20,DisplayData:1,DisplayOffset:6,CustomName:\"Cart\"}");
    need.put("Boat", "{}");
    String rich = "{CustomName:\"Nm\",CustomNameVisible:1b,PersistenceRequired:1b,CanPickUpLoot:1b,AbsorptionAmount:2.5f,HurtTime:3s,DeathTime:0s,AttackTime:2s,"
      + "ActiveEffects:[{Id:1b,Amplifier:1b,Duration:100,Ambient:1b}],Equipment:[{id:268s,Count:1b,Damage:0s},{},{},{},{id:298s,Count:1b,Damage:0s}],DropChances:[0.5f,0.1f,0.1f,0.1f,0.2f],"
      + "Health:7s,Fire:30s,Air:100s,FallDistance:2.5f,Invulnerable:1b}";
    TreeSet<String> names = new TreeSet<>();
    for (Object o : sg.b()) names.add((String) o);
    StringBuilder out = new StringBuilder("{\"rows\":[");
    boolean first = true;
    for (String name : names) {
      for (String kind : new String[] { "plain", "rich" }) {
        String tag = need.get(name);
        if (kind.equals("rich")) { if (need.containsKey(name)) continue; tag = rich; }
        String hex = null, re = null;
        try {
          List<sa> got = Summon87Probe.summon(name, tag);
          if (!got.isEmpty()) { sa e = got.get(got.size() - 1); if (kind.equals("rich") && !(e instanceof sv)) continue; hex = hexOf(e); re = again(e); }
          else { hex = "!none"; }
        } catch (Throwable t) { hex = "!" + t; }
        out.append(first ? "" : ",").append("[" + q(name) + "," + q(tag) + "," + q(kind) + "," + q(hex) + "," + q(re) + "]"); first = false;
      }
    }
    System.out.println(out.append("]}"));
  }
}
