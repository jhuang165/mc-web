import java.lang.reflect.*;
import java.util.*;

// EntityVillager (yv) chunk NBT through the unchanged writeToNBTOptional (sa.d) and EntityList.createEntityFromNBT (sg.a):
// Profession, Riches, Offers.Recipes (MerchantRecipeList / MerchantRecipe: buy, optional buyB, sell, uses, maxUses) and EntityAgeable's Age.
// The recipe list is built with the real MerchantRecipe constructors and use counters on VillagerOffersProbe's world double.
// One JSON object per line:
//   villager {nbt (hex of sa.d), again (the loaded entity written again, hex), profession, riches, age, offers [VillagerOffersProbe.offer of each loaded recipe]}
public class VillagerNbtProbe {
  static String q(String s) { return s == null ? "null" : "\"" + s + "\""; }
  static void run(String kind, int profession, int riches, int age, agn... recipes) throws Exception {
    VillagerProbe.reset();
    VillagerProbe.World w = VillagerOffersProbe.world();
    yv v = new yv(w, profession);
    MobMoveProbe.method(sa.class, "b", double.class, double.class, double.class).invoke(v, 12.5, 70.0, -3.5);
    MobMoveProbe.field(yv.class, "bx").setInt(v, riches);
    v.c(age);
    if (recipes.length > 0) {
      ago list = new ago();
      for (agn r : recipes) list.add(r);
      MobMoveProbe.field(yv.class, "bu").set(v, list);
    }
    dh t = new dh();
    if (!v.d(t)) throw new IllegalStateException("not saved");
    sa e = sg.a(t, w);
    dh again = new dh();
    e.d(again);
    StringBuilder offers = new StringBuilder();
    ago loaded = (ago) MobMoveProbe.field(yv.class, "bu").get(e);
    if (loaded != null) for (Object r : loaded) offers.append(offers.length() > 0 ? "," : "").append(VillagerOffersProbe.offer((agn) r));
    System.out.println("{\"case\":\"villager\",\"kind\":" + q(kind) + ",\"nbt\":\"" + MobNbtProbe.hex(t) + "\",\"again\":\"" + MobNbtProbe.hex(again) + "\",\"profession\":" + profession
      + ",\"riches\":" + riches + ",\"age\":" + age + ",\"hasOffers\":" + (loaded != null) + ",\"offers\":[" + offers + "]}");
  }
  public static void main(String[] args) throws Exception {
    aji.p();
    adb.l();
    agn wheat = new agn(new add(adb.d(296), 18, 0), new add(adb.d(388), 1, 0));
    wheat.f(); wheat.f();
    agn book = new agn(new add(adb.d(265), 5, 0), new add(adb.d(340), 1, 0), new add(adb.d(264), 2, 0));
    book.a(3);
    agn disabled = new agn(new add(adb.d(388), 8, 0), new add(adb.d(297), 4, 0));
    for (int i = 0; i < 7; i++) disabled.f();
    run("none", 0, 0, 0);
    run("farmer", 0, 12, -24000, wheat, disabled);
    run("smith", 3, 99, 0, wheat, book);
  }
}
