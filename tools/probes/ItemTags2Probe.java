// Batch 58 (itemtags2). The unchanged 1.7.10 NBTUtil (dv), ItemSkull (aeb), BlockSkull (anl), TileEntitySkull (apn), ItemMap (adh), ItemStack (add) and the splash
// potion dispenser behaviour (kw, the anonymous BehaviorProjectileDispense of Bootstrap).
//   profile  a SkullOwner / Owner compound through NBTUtil.func_152459_a (dv.a(dh)): the GameProfile (name, id, properties), NBTUtil.func_152460_a's written compound,
//            the ItemSkull title (ItemStack.getDisplayName) and the stack's own tag text (the raw tag is kept untouched).
//   tile     TileEntitySkull.readFromNBT of Owner / ExtraType compounds (a lookup that needs MinecraftServer is recorded as an error) and writeToNBT.
//   drop     BlockSkull.breakBlock: the dropped stack's tag text for a tile of each type with and without a profile.
//   map      ItemMap.addInformation through ItemStack.getTooltip on a world double that holds (or lacks) map data, with and without advanced tooltips.
//   dispense kw.a(world, position): the EntityPotion the dispenser makes, with the stack it keeps and its effects.
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;
import com.mojang.authlib.GameProfile;
import com.mojang.authlib.properties.Property;

public class ItemTags2Probe {
  static sun.misc.Unsafe u;
  static String json(String s) { return ItemTagsProbe.json(s); }
  static String err(Throwable x) { return ItemTagsProbe.err(x); }

  static class W2 extends HorseProbe.World {
    Map<String, aor> tiles = new HashMap<>();
    ayi mapData = null;
    List<String> spawned = new ArrayList<>();
    public aor o(int x, int y, int z) { return tiles.get(x + "," + y + "," + z); }
    public boolean d(sa e) { if (e instanceof xk) spawned.add(((xk) e).f().b(new dh()).toString()); return true; }
    public ayl a(Class c, String name) { return mapData; }
    public void c(int a, int b, int c2, int d, int e) {}
    public void p(int x, int y, int z) {}
    public void f(int x, int y, int z, aji b) {}
  }
  static W2 world;

  static String profileJson(GameProfile p) {
    if (p == null) return "null";
    List<String> keys = new ArrayList<>(p.getProperties().keySet());
    Collections.sort(keys);
    StringBuilder b = new StringBuilder("{\"name\":" + (p.getName() == null ? "null" : json(p.getName())) + ",\"id\":" + (p.getId() == null ? "null" : json(p.getId().toString())) + ",\"properties\":[");
    boolean first = true;
    for (String k : keys) {
      b.append(first ? "" : ",").append("[").append(json(k)).append(",[");
      boolean f2 = true;
      for (Property q : p.getProperties().get(k)) {
        b.append(f2 ? "" : ",").append("[").append(json(q.getValue())).append(",").append(q.hasSignature() ? json(q.getSignature()) : "null").append("]");
        f2 = false;
      }
      b.append("]]");
      first = false;
    }
    return b.append("]}").toString();
  }
  static String nbtOf(GameProfile p) { dh t = new dh(); dv.a(t, p); return t.toString(); }

  static void profile(String name, ItemTagsProbe.N compound) {
    StringBuilder out = new StringBuilder("{\"tag\":\"b58profile\",\"name\":" + json(name) + ",\"owner\":" + compound.d);
    try {
      GameProfile p = dv.a((dh) compound.v);
      out.append(",\"profile\":").append(profileJson(p));
      if (p != null) out.append(",\"written\":").append(json(nbtOf(p)));
    } catch (Throwable x) { out.append(",\"error\":").append(err(x)); }
    try {
      add st = new add(adb.d(397), 1, 3);
      dh tag = new dh();
      tag.a("SkullOwner", compound.v);
      st.d(tag);
      String title = st.s();
      out.append(",\"title\":").append(json(title)).append(",\"stackNbt\":").append(json(st.b(new dh()).toString()));
    } catch (Throwable x) { out.append(",\"titleError\":").append(err(x)); }
    System.out.println(out.append("}"));
  }

  static void tile(String name, ItemTagsProbe.N compound, boolean extra, int type) {
    StringBuilder out = new StringBuilder("{\"tag\":\"b58tile\",\"name\":" + json(name) + ",\"source\":" + compound.d + ",\"extra\":" + extra + ",\"type\":" + type);
    try {
      apn t = new apn();
      dh in = new dh();
      in.a("SkullType", (byte) type);
      in.a("Rot", (byte) 4);
      in.a(extra ? "ExtraType" : "Owner", compound.v);
      try { t.a(in); } catch (Throwable x) { out.append(",\"readError\":").append(err(x)); }
      out.append(",\"profile\":").append(profileJson(t.a())).append(",\"readType\":").append(t.b());
      dh o = new dh();
      t.b(o);
      out.append(",\"written\":").append(json(o.toString()));
    } catch (Throwable x) { out.append(",\"error\":").append(err(x)); }
    System.out.println(out.append("}"));
  }

  static void drop(String name, int type, ItemTagsProbe.N compound) {
    StringBuilder out = new StringBuilder("{\"tag\":\"b58drop\",\"name\":" + json(name) + ",\"type\":" + type + ",\"owner\":" + (compound == null ? "null" : compound.d));
    try {
      world.tiles.clear();
      world.spawned.clear();
      apn t = new apn();
      t.a(type);
      if (compound != null) {
        dh in = new dh();
        in.a("SkullType", (byte) type);
        in.a("Owner", compound.v);
        t.a(in);
      }
      world.tiles.put("1,2,3", t);
      ((anl) ajn.bP).a(world, 1, 2, 3, ajn.bP, 0);
    } catch (Throwable x) { out.append(",\"error\":").append(err(x)); }
    out.append(",\"spawned\":[");
    for (int k = 0; k < world.spawned.size(); k++) out.append(k == 0 ? "" : ",").append(json(world.spawned.get(k)));
    System.out.println(out.append("]}"));
  }

  static void map(int damage, int scale, boolean remote, boolean advanced) throws Exception { map(damage, scale, remote, advanced, null); }
  static void map(int damage, int scale, boolean remote, boolean advanced, String named) throws Exception {
    StringBuilder out = new StringBuilder("{\"tag\":\"b58map\",\"damage\":" + damage + ",\"scale\":" + scale + ",\"advanced\":" + advanced + ",\"named\":" + (named == null ? "null" : json(named)));
    try {
      ayi data = null;
      if (scale >= 0) { data = (ayi) u.allocateInstance(ayi.class); MobMoveProbe.field(ayi.class, "d").setByte(data, (byte) scale); }
      world.mapData = data;
      MobMoveProbe.field(ahb.class, "E").setBoolean(world, remote);
      yz player = (yz) u.allocateInstance(HorseProbe.FakePlayer.class);
      MobMoveProbe.set(player, "o", world);
      add st = new add(adb.d(358), 1, damage);
      if (named != null) st.c(named);
      out.append(",\"tooltip\":").append(ItemTagsProbe.strings(st.a(player, advanced)));
      List l = new ArrayList();
      adb.d(358).a(st, player, l, advanced);
      out.append(",\"lines\":").append(ItemTagsProbe.strings(l));
    } catch (Throwable x) { out.append(",\"error\":").append(err(x)); }
    System.out.println(out.append("}"));
  }

  static void dispense(String name, add stack) {
    StringBuilder out = new StringBuilder("{\"tag\":\"b58dispense\",\"name\":" + json(name) + ",\"stack\":" + json(stack.b(new dh()).toString()));
    try {
      MobMoveProbe.field(ahb.class, "E").setBoolean(world, false);
      java.lang.reflect.Constructor<?> ctor = kw.class.getDeclaredConstructor(kv.class, add.class);
      ctor.setAccessible(true);
      Object behaviour = ctor.newInstance(null, stack);
      Method make = kw.class.getDeclaredMethod("a", ahb.class, cx.class);
      make.setAccessible(true);
      zo potion = (zo) make.invoke(behaviour, world, new cx() { public double a() { return 1.5; } public double b() { return 64.5; } public double c() { return -2.5; } });
      add kept = (add) MobMoveProbe.field(zo.class, "c").get(potion);
      out.append(",\"kept\":").append(json(kept.b(new dh()).toString())).append(",\"damage\":").append(kept.k()).append(",\"effects\":").append(ItemTagsProbe.effectRows(((adp) adb.d(373)).g(kept)));
      out.append(",\"sameInstance\":").append(kept == stack);
    } catch (Throwable x) { out.append(",\"error\":").append(err(x)); }
    System.out.println(out.append("}"));
  }

  static ItemTagsProbe.N prof(String name, String id) {
    Object[] kv = new Object[(name != null ? 2 : 0) + (id != null ? 2 : 0)];
    int k = 0;
    if (name != null) { kv[k++] = "Name"; kv[k++] = ItemTagsProbe.s(name); }
    if (id != null) { kv[k++] = "Id"; kv[k++] = ItemTagsProbe.s(id); }
    return ItemTagsProbe.c(kv);
  }
  static ItemTagsProbe.N tex(ItemTagsProbe.N... entries) { return ItemTagsProbe.c("textures", ItemTagsProbe.l(entries)); }
  static ItemTagsProbe.N value(String v, String sig) { return sig == null ? ItemTagsProbe.c("Value", ItemTagsProbe.s(v)) : ItemTagsProbe.c("Value", ItemTagsProbe.s(v), "Signature", ItemTagsProbe.s(sig)); }

  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    u = MobMoveProbe.unsafe();
    world = (W2) u.allocateInstance(W2.class);
    MobMoveProbe.set(world, "s", new Random(2));
    MobMoveProbe.set(world, "C", new qi());
    for (Field f : ahb.class.getDeclaredFields())
      if (f.getType() == List.class && !java.lang.reflect.Modifier.isStatic(f.getModifiers())) { f.setAccessible(true); f.set(world, new ArrayList()); }
    MobMoveProbe.set(world, "t", u.allocateInstance(aqq.class));
    ays info = (ays) u.allocateInstance(ays.class);
    MobMoveProbe.field(ays.class, "g").setLong(info, 1);
    MobMoveProbe.field(ays.class, "x").set(info, new agy());
    MobMoveProbe.field(ahb.class, "x").set(world, info);
    world.tiles = new HashMap<>();
    world.spawned = new ArrayList<>();
    HorseProbe.W = world;

    String uuid = "069a79f4-44e9-4726-a5be-fca90e38aaf5";
    LinkedHashMap<String, ItemTagsProbe.N> owners = new LinkedHashMap<>();
    owners.put("full", ItemTagsProbe.c("Name", ItemTagsProbe.s("Notch"), "Id", ItemTagsProbe.s(uuid), "Properties", tex(value("eyJ0ZXh0dXJlcyI6e30=", "c2ln"))));
    owners.put("nameOnly", prof("jeb_", null));
    owners.put("idOnly", prof(null, uuid));
    owners.put("extraKey", ItemTagsProbe.c("Name", ItemTagsProbe.s("Dinnerbone"), "Foo", ItemTagsProbe.i(7), "Bar", ItemTagsProbe.l(ItemTagsProbe.s("x"))));
    owners.put("noSignature", ItemTagsProbe.c("Name", ItemTagsProbe.s("Grumm"), "Properties", tex(value("one", null), value("two", "s2"))));
    owners.put("twoKeys", ItemTagsProbe.c("Name", ItemTagsProbe.s("Searge"), "Properties", ItemTagsProbe.c("textures", ItemTagsProbe.l(value("t", "s")), "other", ItemTagsProbe.l(value("o", null)))));
    owners.put("upperId", prof("Up", "069A79F4-44E9-4726-A5BE-FCA90E38AAF5"));
    owners.put("shortId", prof("Short", "1-2-3-4-5"));
    owners.put("badIdWithName", prof("Bad", "not-a-uuid"));
    owners.put("badIdNoName", prof(null, "not-a-uuid"));
    owners.put("blankBoth", prof("", ""));
    owners.put("blankNameValidId", prof("", uuid));
    owners.put("spaceName", prof("  ", uuid));
    owners.put("nameInt", ItemTagsProbe.c("Name", ItemTagsProbe.i(5), "Id", ItemTagsProbe.s(uuid)));
    owners.put("idInt", ItemTagsProbe.c("Name", ItemTagsProbe.s("IdInt"), "Id", ItemTagsProbe.i(5)));
    owners.put("propertiesList", ItemTagsProbe.c("Name", ItemTagsProbe.s("PL"), "Properties", ItemTagsProbe.l(ItemTagsProbe.s("x"))));
    owners.put("propertyStrings", ItemTagsProbe.c("Name", ItemTagsProbe.s("PS"), "Properties", ItemTagsProbe.c("textures", ItemTagsProbe.l(ItemTagsProbe.s("v")))));
    owners.put("noValue", ItemTagsProbe.c("Name", ItemTagsProbe.s("NV"), "Properties", ItemTagsProbe.c("textures", ItemTagsProbe.l(ItemTagsProbe.c("Signature", ItemTagsProbe.s("only"))))));
    owners.put("emptyProperties", ItemTagsProbe.c("Name", ItemTagsProbe.s("EP"), "Properties", ItemTagsProbe.c()));
    owners.put("emptyList", ItemTagsProbe.c("Name", ItemTagsProbe.s("EL"), "Properties", ItemTagsProbe.c("textures", ItemTagsProbe.l())));
    for (Map.Entry<String, ItemTagsProbe.N> e : owners.entrySet()) profile(e.getKey(), e.getValue());
    // the tile: a complete profile with textures needs no lookup; an incomplete one asks the (absent) server on ExtraType only
    for (String k : new String[] { "full", "nameOnly", "idOnly", "extraKey", "noSignature", "twoKeys", "shortId", "badIdWithName", "blankBoth", "propertiesList" })
      tile("owner_" + k, owners.get(k), false, 3);
    tile("ownerType1", owners.get("full"), false, 1);
    tile("extraNotch", ItemTagsProbe.s("Notch"), true, 3);
    tile("extraEmpty", ItemTagsProbe.s(""), true, 3);
    tile("extraInt", ItemTagsProbe.i(3), true, 3);
    for (String k : new String[] { "full", "nameOnly", "extraKey" }) { drop("type3_" + k, 3, owners.get(k)); }
    drop("type3_none", 3, null);
    drop("type1_full", 1, owners.get("full"));
    drop("type0_none", 0, null);
    for (int s = -1; s <= 4; s++) for (boolean adv : new boolean[] { false, true }) map(s < 0 ? 1 : 100 + s, s, s < 0, adv);
    for (boolean adv : new boolean[] { false, true }) map(102, 2, false, adv, "Atlas");
    dispense("customSplash", ItemTagsProbe.potion(16384, ItemTagsProbe.c("CustomPotionEffects", ItemTagsProbe.l(ItemTagsProbe.effect(1, 1, 600, 0), ItemTagsProbe.effect(10, 0, 100, 1)), "display", ItemTagsProbe.c("Lore", ItemTagsProbe.l(ItemTagsProbe.s("kept"))))));
    dispense("customOverride", ItemTagsProbe.potion(16421, ItemTagsProbe.c("CustomPotionEffects", ItemTagsProbe.l(ItemTagsProbe.effect(19, 0, 900, 0)))));
    dispense("damageOnly", ItemTagsProbe.potion(16421, null));
    dispense("customEmpty", ItemTagsProbe.potion(16421, ItemTagsProbe.c("CustomPotionEffects", ItemTagsProbe.l())));
  }
}
