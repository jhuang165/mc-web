import java.util.*;

// Batch 102 entnbt102: entity NBT load/save edge values through the real 1.7.10 classes (CommandSummon on Summon86Probe's double), rows in Entnbt101Probe's format
// [name, tag, "written compound (sorted)", "same after sg.a reload", "written hex"].
public class Entnbt102Probe {
  static String q(String s) { return CmdChatProbe.q(s); }
  static void add(List<String[]> e, String[] names, String... tags) { for (String n : names) for (String t : tags) e.add(new String[] {n, t}); }
  public static void main(String[] argv) throws Exception {
    Summon86Probe.setup();
    CmdExec83Probe.fresh("solo");
    List<String[]> e = new ArrayList<>();
    // 1. neither HealF nor Health
    for (String m : new String[] {"Bat", "Blaze", "CaveSpider", "Chicken", "Cow", "Creeper", "EnderDragon", "Enderman", "EntityHorse", "Ghast", "Giant", "LavaSlime", "MushroomCow", "Ozelot", "Pig", "PigZombie",
        "Sheep", "Silverfish", "Skeleton", "Slime", "SnowMan", "Spider", "Squid", "Villager", "VillagerGolem", "Witch", "WitherBoss", "Wolf", "Zombie", "EnderCrystal"})
      add(e, new String[] {m}, "{}", "{Health:7s}", "{HealF:3.5f}");
    // 2. modifier Name as non-string
    String mh = "generic.maxHealth";
    for (String n : new String[] {"5", "5b", "5s", "5L", "1.5f", "2.5d", "\"x\"", "[1]", "{a:1}", "[B;1,2]", "[I;1,2]"})
      add(e, new String[] {"Zombie"}, "{Attributes:[{Name:\"" + mh + "\",Base:40.0d,Modifiers:[{Name:" + n + ",Amount:4.0d,Operation:0,UUIDMost:1L,UUIDLeast:2L}]}]}");
    // 3. edges
    add(e, new String[] {"Creeper"}, "{Fuse:10s}", "{Fuse:-5s}", "{Fuse:40000s}", "{Fuse:10}", "{Fuse:10b}", "{ExplosionRadius:5b}", "{ExplosionRadius:0b}", "{ExplosionRadius:-1b}", "{ExplosionRadius:300}", "{ExplosionRadius:3s}", "{powered:1b}", "{powered:2b}", "{powered:256}", "{powered:1}");
    add(e, new String[] {"Enderman"}, "{carried:1s,carriedData:2s}", "{carried:1,carriedData:2}", "{carried:1b,carriedData:2b}", "{carried:70000s}", "{carried:-1s}", "{carried:35s,carriedData:20s}", "{carried:35s,carriedData:-1s}", "{carried:35s,carriedData:70000s}", "{carried:\"x\"}", "{carried:9999s}", "{carried:0s,carriedData:5s}");
    add(e, new String[] {"Slime", "LavaSlime"}, "{Size:2}", "{Size:0}", "{Size:-1}", "{Size:3b}", "{Size:3s}", "{Size:3L}", "{Size:1.5f}", "{Size:\"3\"}", "{Size:100}", "{Size:127}", "{Size:2147483647}", "{Size:2,wasOnGround:1b}", "{Size:3,HealF:3f}");
    add(e, new String[] {"Zombie"}, "{IsBaby:1b}", "{IsBaby:2b}", "{IsBaby:1}", "{IsBaby:256}", "{IsBaby:\"x\"}", "{IsVillager:1b}", "{IsVillager:1b,IsBaby:1b}", "{IsVillager:2}", "{ConversionTime:100}", "{ConversionTime:100,IsVillager:1b}", "{ConversionTime:-1}", "{ConversionTime:0}", "{ConversionTime:100s}", "{ConversionTime:100L}", "{ConversionTime:1.5f}", "{ConversionTime:100,IsVillager:1b,IsBaby:1b}", "{CanBreakDoors:1b}", "{CanBreakDoors:2b}");
    add(e, new String[] {"Skeleton"}, "{SkeletonType:1b}", "{SkeletonType:2b}", "{SkeletonType:-1b}", "{SkeletonType:1}", "{SkeletonType:1s}", "{SkeletonType:257}", "{SkeletonType:256}", "{SkeletonType:1L}", "{SkeletonType:1.9f}", "{SkeletonType:\"1\"}");
    add(e, new String[] {"Sheep"}, "{Color:5b}", "{Color:5}", "{Color:5s}", "{Color:16b}", "{Color:-1b}", "{Color:17}", "{Color:255b}", "{Color:5L}", "{Color:5.5f}", "{Color:\"5\"}", "{Sheared:1b}", "{Sheared:2b}", "{Sheared:1}", "{Sheared:256}", "{Sheared:\"1\"}", "{Sheared:1b,Color:3b}");
    add(e, new String[] {"Wolf"}, "{Owner:\"Alex\"}", "{Owner:\"\"}", "{Owner:5}", "{OwnerUUID:\"\"}", "{OwnerUUID:\"x\"}", "{OwnerUUID:5}", "{Owner:\"Alex\",Sitting:1b}", "{Owner:\"Alex\",Sitting:2b}", "{Owner:\"Alex\",Sitting:1}", "{Owner:\"Alex\",Sitting:256}", "{Sitting:1b}",
        "{Owner:\"Alex\",CollarColor:3b}", "{Owner:\"Alex\",CollarColor:3}", "{Owner:\"Alex\",CollarColor:16b}", "{Owner:\"Alex\",CollarColor:-1b}", "{Owner:\"Alex\",CollarColor:3s}", "{Owner:\"Alex\",CollarColor:3L}", "{Owner:\"Alex\",CollarColor:\"3\"}", "{CollarColor:3b}", "{Angry:1b}", "{Angry:2b}", "{Angry:256}", "{Angry:1b,Owner:\"Alex\"}");
    add(e, new String[] {"Ozelot"}, "{Owner:\"Alex\"}", "{Owner:\"Alex\",Sitting:1b}", "{Owner:\"Alex\",Sitting:256}", "{Sitting:1b}", "{CatType:2}", "{CatType:2b}", "{CatType:4}", "{CatType:-1}", "{CatType:2s}", "{CatType:2L}", "{CatType:\"2\"}", "{CatType:3,Owner:\"Alex\"}", "{CatType:0}");
    add(e, new String[] {"Villager"}, "{Profession:1}", "{Profession:5}", "{Profession:-1}", "{Profession:1b}", "{Profession:1s}", "{Profession:1L}", "{Riches:5}", "{Riches:-5}", "{Riches:5s}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:1b,Damage:0s},buyB:{id:339s,Count:2b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:9,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:0,uses:0,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:-1,uses:-2,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7s,uses:3b,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7L,uses:3L,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7.5f,uses:3.5f,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:64b,Damage:0s},sell:{id:264s,Count:64b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:0b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:1b,Damage:0s},buyB:{},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[{maxUses:7,uses:3,buy:{id:388s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}},{buy:{id:280s,Count:1b,Damage:0s},sell:{id:264s,Count:1b,Damage:0s}}]}}",
        "{Offers:{Recipes:[]}}", "{Offers:{}}", "{Offers:5}", "{Offers:{Recipes:5}}", "{Offers:{Recipes:[{}]}}", "{Offers:{Recipes:[5]}}");
    add(e, new String[] {"EntityHorse"}, "{Variant:0}", "{Variant:261}", "{Variant:1027}", "{Variant:65535}", "{Variant:-1}", "{Variant:2b}", "{Variant:2s}", "{Variant:2L}", "{Variant:\"2\"}", "{Type:1}", "{Type:2}", "{Type:3}", "{Type:4}", "{Type:5}", "{Type:-1}", "{Type:1b}", "{Type:2s}",
        "{Temper:50}", "{Temper:-5}", "{Temper:100000}", "{Temper:50b}", "{Temper:50s}", "{Temper:50L}", "{Temper:5.5f}", "{Tame:1b}", "{Tame:2b}", "{Tame:1}", "{Tame:256}", "{Tame:\"1\"}", "{Tame:1b,Temper:20}",
        "{OwnerName:\"Alex\"}", "{OwnerName:\"Alex\",Tame:1b}", "{OwnerName:\"\"}", "{OwnerName:5}", "{OwnerUUID:\"abc\"}", "{Tame:1b,OwnerUUID:\"\"}",
        "{ChestedHorse:1b}", "{ChestedHorse:1b,Type:1}", "{ChestedHorse:1b,Type:1,Items:[{Slot:2b,id:260s,Count:3b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:1,Items:[{Slot:0b,id:260s,Count:3b,Damage:0s},{Slot:1b,id:260s,Count:3b,Damage:0s},{Slot:3b,id:260s,Count:3b,Damage:0s},{Slot:17b,id:260s,Count:3b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:1,Items:[{Slot:2b,id:260s,Count:3b,Damage:0s},{Slot:2b,id:280s,Count:1b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:1,Items:[{Slot:20b,id:260s,Count:3b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:1,Items:[{Slot:-1b,id:260s,Count:3b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:1,Items:[{Slot:2,id:260s,Count:3b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:0,Items:[{Slot:2b,id:260s,Count:3b,Damage:0s}]}",
        "{ChestedHorse:1b,Type:1,Items:[{Slot:2b,id:260s,Count:0b,Damage:0s}]}",
        "{ChestedHorse:2b,Type:1}", "{ChestedHorse:256,Type:1}", "{ChestedHorse:1,Type:1}",
        "{ArmorItem:{id:417s,Count:1b,Damage:0s}}", "{ArmorItem:{id:419s,Count:1b,Damage:0s}}", "{ArmorItem:{id:418s,Count:1b,Damage:0s}}",
        "{ArmorItem:{id:311s,Count:1b,Damage:0s}}", "{ArmorItem:{id:417s,Count:5b,Damage:0s}}", "{ArmorItem:{id:417s,Count:0b,Damage:0s}}",
        "{ArmorItem:{id:417s,Count:1b,Damage:7s}}", "{ArmorItem:{}}", "{ArmorItem:5}", "{ArmorItem:{id:417s,Count:1b,Damage:0s},Type:1}",
        "{SaddleItem:{id:329s,Count:1b,Damage:0s}}", "{SaddleItem:{id:329s,Count:1b,Damage:0s},Tame:1b}", "{SaddleItem:{id:329s,Count:5b,Damage:0s}}", "{SaddleItem:{id:329s,Count:0b,Damage:0s}}",
        "{SaddleItem:{id:260s,Count:1b,Damage:0s}}", "{SaddleItem:{id:329s,Count:1b,Damage:3s}}", "{SaddleItem:{}}", "{SaddleItem:5}", "{SaddleItem:{id:329s,Count:1b,Damage:0s},Type:2}",
        "{EatingHaystack:1b}", "{Bred:1b}", "{HasReproduced:1b}", "{HasReproduced:2b}", "{Bred:256}");
    StringBuilder out = new StringBuilder("{\"edge\":[");
    boolean first = true;
    for (String[] c : e) { out.append(first ? "" : ",").append("[" + q(c[0]) + "," + q(c[1]) + "," + q(Entnbt94Probe.edge(c[0], c[1], false)) + "," + q(Entnbt94Probe.edge(c[0], c[1], true)) + "," + q(Entnbt94Probe.hexW(c[0], c[1])) + "]"); first = false; }
    System.out.println(out.append("]}"));
  }
}
