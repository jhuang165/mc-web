import java.io.ByteArrayOutputStream;
import java.io.DataOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

// Chunk-save NBT of the mobs whose region import used to be missing, written and read by the unchanged 1.7.10 classes:
// EntityPig (wo), EntityCow (wh), EntityMooshroom (wm), EntitySheep (wp), EntityChicken (wg), EntityWolf (wv),
// EntitySpider (yn), EntityCaveSpider (xy), EntityCreeper (xz), EntityWitch (yp), EntitySilverfish (yk) and EntitySnowman (wr).
// Each case builds the mob with its real constructor on the HorseProbe/MobMoveProbe world double, places it, and writes it with
// Entity.writeToNBTOptional (sa.c(dh), the call AnvilChunkLoader makes). The case then edits named keys of that native tag and
// loads it with EntityList.createEntityFromNBT (sg.a(dh, ahb), the chunk loader's reader). The record holds the loaded mob's
// own NBT (written again with sa.c) and its getters. One JSON object per line:
//   mob  {kind, id, nbt (uncompressed hex), x, y, z, yaw, health, age (EntityAgeable), love (EntityAnimal), and per kind:
//         saddled, color, sheared, tamed, sitting, angry, collar, owner, powered, ignited, jockey}
public class MobNbtProbe {
  static final sun.misc.Unsafe u;
  static { try { u = MobMoveProbe.unsafe(); } catch (Exception e) { throw new RuntimeException(e); } }
  static HorseProbe.World W;

  static String hex(dh tag) throws Exception {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    du.a(tag, (java.io.DataOutput) new DataOutputStream(bytes));
    StringBuilder s = new StringBuilder();
    for (byte b : bytes.toByteArray()) s.append(String.format("%02x", b & 0xff));
    return s.toString();
  }
  static String q(String s) { return s == null ? "null" : "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"") + "\""; }
  static int inLove(wf a) throws Exception { Field f = wf.class.getDeclaredField("bp"); f.setAccessible(true); return f.getInt(a); }

  interface Edit { void apply(dh t) throws Exception; }

  static void mob(String kind, sa fresh, Edit edit) throws Exception {
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(fresh, 100.5, 64.0, -20.25);
    fresh.y = 37.5f;
    dh t = new dh();
    if (!fresh.c(t)) throw new IllegalStateException("not saved: " + kind);
    edit.apply(t);
    sa e = sg.a(t, W);
    if (e == null) throw new IllegalStateException("not loaded: " + kind);
    dh out = new dh();
    e.c(out);
    StringBuilder s = new StringBuilder("{\"case\":\"mob\",\"kind\":" + q(kind) + ",\"id\":" + q(sg.b(e)) + ",\"nbt\":\"" + hex(out) + "\"");
    s.append(",\"x\":").append(e.s).append(",\"y\":").append(e.t).append(",\"z\":").append(e.u).append(",\"yaw\":").append(e.y);
    s.append(",\"health\":").append(((sv) e).aS());
    if (e instanceof rx) s.append(",\"age\":").append(((rx) e).d());
    if (e instanceof wf) s.append(",\"love\":").append(inLove((wf) e));
    if (e instanceof wo) s.append(",\"saddled\":").append(((wo) e).bZ());
    if (e instanceof wp) s.append(",\"color\":").append(((wp) e).bZ()).append(",\"sheared\":").append(((wp) e).ca());
    if (e instanceof tg) s.append(",\"tamed\":").append(((tg) e).bZ()).append(",\"sitting\":").append(((tg) e).ca()).append(",\"owner\":").append(q(((tg) e).b()));
    if (e instanceof wv) s.append(",\"angry\":").append(((wv) e).ci()).append(",\"collar\":").append(((wv) e).cj());
    if (e instanceof xz) s.append(",\"powered\":").append(((xz) e).bZ()).append(",\"ignited\":").append(((xz) e).cc());
    if (e instanceof wg) s.append(",\"jockey\":").append(((wg) e).bZ());
    System.out.println(s.append("}"));
  }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    HorseProbe.World world = (HorseProbe.World) u.allocateInstance(HorseProbe.World.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    W = world;
    HorseProbe.W = world;
    Edit none = t -> {};

    mob("pig", new wo(W), none);
    mob("pig", new wo(W), t -> { t.a("Saddle", true); t.a("Age", -24000); t.a("InLove", 300); t.a("HealF", 7.5f); t.a("Fire", (short) 40); });
    mob("cow", new wh(W), none);
    mob("cow", new wh(W), t -> { t.a("Age", 6000); t.a("CustomName", "Daisy"); t.a("PersistenceRequired", true); });
    mob("mooshroom", new wm(W), none);
    mob("mooshroom", new wm(W), t -> { t.a("Age", -1200); });
    mob("sheep", new wp(W), none);
    mob("sheep", new wp(W), t -> { t.a("Color", (byte) 14); t.a("Sheared", true); });
    mob("sheep", new wp(W), t -> { t.a("Color", (byte) -1); }); // the fleece colour is (byte & 15)
    mob("chicken", new wg(W), none);
    mob("chicken", new wg(W), t -> { t.a("IsChickenJockey", true); t.a("Age", -100); });
    mob("wolf", new wv(W), none);
    mob("wolf", new wv(W), t -> { t.a("OwnerUUID", "00000000-0000-0001-0000-000000000002"); t.a("Sitting", true); t.a("CollarColor", (byte) 3); t.a("HealF", 18.0f); });
    mob("wolf", new wv(W), t -> { t.a("Angry", true); });
    mob("spider", new yn(W), none);
    mob("cave_spider", new xy(W), none);
    mob("creeper", new xz(W), none);
    mob("creeper", new xz(W), t -> { t.a("powered", true); t.a("ignited", true); t.a("Fuse", (short) 20); t.a("ExplosionRadius", (byte) 5); });
    mob("witch", new yp(W), none);
    mob("silverfish", new yk(W), none);
    mob("snow_golem", new wr(W), none);
    mob("snow_golem", new wr(W), t -> { t.a("HealF", 2.5f); });
  }
}
