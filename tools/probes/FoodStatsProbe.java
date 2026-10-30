// An original-bytecode test harness. These tiny dependencies isolate FoodStats;
// they are test doubles, not copied Minecraft implementation classes.
class ro { static final ro f = new ro(); }
enum rd { a, b, c, d }
class agy { boolean b(String rule) { return rule.equals("naturalRegeneration"); } }
class ahb { rd r = rd.c; agy O() { return new agy(); } }
class yz {
    ahb o = new ahb();
    float health = 20;
    float aS() { return health; }
    boolean bR() { return health > 0 && health < 20; }
    void f(float amount) { health = Math.min(20, health + amount); }
    boolean a(ro source, float amount) { health -= amount; return true; }
}
public class FoodStatsProbe {
    static void emit(String name, zr food, yz player) throws Exception {
        java.lang.reflect.Field exhaustion = zr.class.getDeclaredField("c");
        exhaustion.setAccessible(true);
        System.out.println("{\"case\":\"" + name + "\",\"health\":" + player.health
            + ",\"food\":" + food.a() + ",\"saturation\":" + food.e()
            + ",\"exhaustion\":" + exhaustion.getFloat(food) + "}");
    }
    public static void main(String[] args) throws Exception {
        yz player = new yz();
        zr food = new zr();
        emit("initial", food, player);
        food.a(4.0f); food.a(player); emit("exact-threshold", food, player);
        food.a(0.01f); food.a(player); emit("above-threshold", food, player);
        food = new zr(); food.a(12); food.b(0.0f); food.a(4, 0.3f);
        emit("apple", food, player);
        food = new zr(); food.a(18); player.health = 18;
        for (int i = 0; i < 79; i++) food.a(player);
        emit("regen-79", food, player);
        food.a(player); emit("regen-80", food, player);
        food = new zr(); food.a(0); food.b(0.0f); player.health = 2;
        for (int i = 0; i < 160; i++) food.a(player);
        emit("normal-starvation", food, player);
    }
}
