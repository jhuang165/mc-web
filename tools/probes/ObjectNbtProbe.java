import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Batch 75 (entityaudit75): chunk-save NBT of the object entities the browser exports but ProjectileNbtProbe does not cover:
// EntityXPOrb (sq), EntityFallingBlock (xj), EntityTNTPrimed (xw) and EntityEnderCrystal (wz). Same machinery as ProjectileNbtProbe
// (the entity is built with its constructor, placed, written with Entity.writeToNBTOptional, an edited copy of the tag is loaded with
// EntityList.createEntityFromNBT and written again). Records have case "projectile" so tools/verify-object-nbt.mjs reuses the format.
public class ObjectNbtProbe {
  static void tile(dh t, int id, int data, int time) { t.a("TileID", id); t.a("Data", (byte) data); t.a("Time", (byte) time); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) MobNbtProbe.u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", MobNbtProbe.u.allocateInstance(aqq.class));
    ProjectileNbtProbe.W = world;
    HorseProbe.W = world;
    ProjectileNbtProbe.Edit none = t -> {};
    ProjectileNbtProbe.Fields noFields = e -> null;

    run("xporb", new sq(world, 100.5, 64.0, -20.25, 7), none);
    run("xporb", new sq(world, 100.5, 64.0, -20.25, 7), t -> { t.a("Health", (short) 3); t.a("Age", (short) 5900); t.a("Value", (short) 1237); });
    run("xporb", new sq(world, 100.5, 64.0, -20.25, 7), t -> { t.o("Health"); t.o("Value"); t.o("Age"); });
    run("xporb", new sq(world, 100.5, 64.0, -20.25, 7), t -> { t.a("Health", 300); t.a("Value", 70000); }); // int tags narrow through getShort
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), none);
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(13)), t -> { t.a("Time", (byte) 40); t.a("DropItem", false); });
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(145)), none);
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(145), 2), none);
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("HurtEntities", true); t.a("FallHurtAmount", 3.5f); t.a("FallHurtMax", 20); });
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("HurtEntities", true); }); // the tag still holds the fresh 2.0 and 40
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.o("TileID"); t.a("Tile", (byte) 13); }); // legacy Tile byte
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("TileID", 0); }); // air: the entity is killed
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("DropItem", false); t.a("Time", (byte) -1); });
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("TileID", 1); }); // a block that does not fall: kept as the falling block
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("TileID", 4000); }); // unregistered id: aji.e gives air, which becomes sand
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.o("TileID"); t.o("Tile"); }); // neither key: Tile reads 0 (air), so sand
    run("falling", new xj(world, 100.5, 64.0, -20.25, aji.e(12)), t -> { t.a("TileID", 12); t.a("Data", (byte) 0x1f); }); // Data is not masked
    run("tnt", new xw(world, 100.5, 64.0, -20.25, null), none);
    run("tnt", new xw(world, 100.5, 64.0, -20.25, null), t -> { t.a("Fuse", (byte) 10); });
    run("tnt", new xw(world, 100.5, 64.0, -20.25, null), t -> { t.a("Fuse", (short) 300); }); // getByte: a short tag narrows
    run("tnt", new xw(world, 100.5, 64.0, -20.25, null), t -> { t.o("Fuse"); });
    run("crystal", new wz(world, 100.5, 64.0, -20.25), none);
    run("crystal", new wz(world), t -> { t.a("Foo", (byte) 1); });
  }

  static void run(String name, sa e, ProjectileNbtProbe.Edit edit) throws Exception {
    ProjectileNbtProbe.run(name, e, edit);
  }
}
