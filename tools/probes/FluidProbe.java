// Runs the unchanged original BlockDynamicLiquid (akr), BlockStaticLiquid (ant)
// and BlockLiquid (alw) against a minimal World test double. The double is not
// Minecraft code: it stores a small box of blocks and replays the documented
// World.setBlock / setBlockMetadataWithNotify / notifyBlocksOfNeighborChange
// and WorldServer scheduled-tick-list semantics (HashSet de-duplication, a
// TreeSet ordered by time, priority and creation, at most 1000 ticks per
// tick). The double also carries the world Random (ahb.s, which BlockDynamicLiquid
// and BlockLiquid.func_149799_m draw from), the WorldProvider flags the lava
// rules read (aqo.f hasNoSky, aqo.g isHellWorld) and records random.fizz
// sounds. Scenarios arrive on stdin (see tools/verify-fluids.mjs).
import java.io.*;
import java.lang.reflect.*;
import java.util.*;

class ahb implements ahl {
    int dx, dy, dz;
    aji[] blocks;
    int[] metas;
    long time = 0, serial = 0;
    final aji air = aji.e(0), stone = aji.e(1), obsidian = aji.e(49), cobble = aji.e(4);
    Random s = new Random(0);
    aqo t = new Provider(false);
    long tick = 0;
    final List<String> fizzes = new ArrayList<>();
    static class Provider extends aqo {
        Provider(boolean nether) { f = nether; g = nether; }
        public String l() { return "probe"; }
    }
    // World.playSoundEffect(x, y, z, name, volume, pitch).
    public void a(double x, double y, double z, String name, float volume, float pitch) {
        fizzes.add("[" + tick + "," + x + "," + y + "," + z + ",\"" + name + "\"," + volume + "," + pitch + "]");
    }
    // World.spawnParticle: not recorded.
    public void a(String name, double x, double y, double z, double vx, double vy, double vz) {}
    static class Entry implements Comparable<Entry> {
        final int x, y, z; final aji block; long time; final long id;
        Entry(int x, int y, int z, aji block, long id) { this.x = x; this.y = y; this.z = z; this.block = block; this.id = id; }
        public boolean equals(Object o) { return o instanceof Entry e && e.x == x && e.y == y && e.z == z && e.block == block; }
        public int hashCode() { return (x * 1664525 + y) * 1013904223 + z; }
        public int compareTo(Entry o) { return time < o.time ? -1 : time > o.time ? 1 : id < o.id ? -1 : id > o.id ? 1 : 0; }
    }
    final TreeSet<Entry> tree = new TreeSet<>();
    final HashSet<Entry> set = new HashSet<>();

    ahb(int dx, int dy, int dz) {
        this.dx = dx; this.dy = dy; this.dz = dz;
        blocks = new aji[dx * dy * dz];
        metas = new int[dx * dy * dz];
        Arrays.fill(blocks, air);
    }
    boolean in(int x, int y, int z) { return x >= 0 && y >= 0 && z >= 0 && x < dx && y < dy && z < dz; }
    int at(int x, int y, int z) { return (x * dy + y) * dz + z; }
    public aji a(int x, int y, int z) { return in(x, y, z) ? blocks[at(x, y, z)] : stone; }
    public int e(int x, int y, int z) { return in(x, y, z) ? metas[at(x, y, z)] : 0; }
    public boolean c(int x, int y, int z) { return a(x, y, z) == air; }
    public aor o(int x, int y, int z) { return null; }
    public int c(int x, int y, int z, int s) { return 0; }
    public ahu a(int x, int z) { return null; }
    public int R() { return 0; }
    public boolean T() { return false; }
    public int e(int x, int y, int z, int s) { return 0; }

    // World.setBlock(x, y, z, block, meta, flags): chunk write, onBlockAdded, then neighbour notification for flag 1.
    public boolean d(int x, int y, int z, aji b, int meta, int flags) {
        if (!in(x, y, z)) return false;
        aji old = a(x, y, z);
        if (old == b && e(x, y, z) == meta) return false;
        blocks[at(x, y, z)] = b;
        metas[at(x, y, z)] = meta;
        b.b(this, x, y, z);
        if ((flags & 1) != 0) d(x, y, z, old);
        return true;
    }
    public boolean b(int x, int y, int z, aji b) { return d(x, y, z, b, 0, 3); }
    public boolean f(int x, int y, int z) { return d(x, y, z, air, 0, 3); }
    // World.setBlockMetadataWithNotify.
    public boolean a(int x, int y, int z, int meta, int flags) {
        if (!in(x, y, z) || e(x, y, z) == meta) return false;
        metas[at(x, y, z)] = meta;
        if ((flags & 1) != 0) d(x, y, z, a(x, y, z));
        return true;
    }
    static final int[][] N = {{-1, 0, 0}, {1, 0, 0}, {0, -1, 0}, {0, 1, 0}, {0, 0, -1}, {0, 0, 1}};
    // World.notifyBlocksOfNeighborChange: x-1, x+1, y-1, y+1, z-1, z+1.
    public void d(int x, int y, int z, aji b) {
        for (int[] n : N) {
            int nx = x + n[0], ny = y + n[1], nz = z + n[2];
            if (in(nx, ny, nz)) a(nx, ny, nz).a(this, nx, ny, nz, b);
        }
    }
    // World.scheduleBlockUpdate(x, y, z, block, delay) -> priority 0.
    public void a(int x, int y, int z, aji b, int delay) {
        Entry e = new Entry(x, y, z, b, serial++);
        if (b == air || !in(x, y, z)) return;
        e.time = delay + time;
        if (!set.contains(e)) { set.add(e); tree.add(e); }
    }
    // WorldServer.tickUpdates(false).
    void tick() {
        time++;
        int n = Math.min(tree.size(), 1000);
        for (; n > 0; n--) {
            Entry e = tree.first();
            if (e.time > time) break;
            tree.remove(e);
            set.remove(e);
            aji b = a(e.x, e.y, e.z);
            if (b != air && b == e.block) b.a(this, e.x, e.y, e.z, s);
        }
    }
    char cell(int x, int y, int z) {
        aji b = a(x, y, z);
        if (b == air) return '.';
        if (b == stone) return '#';
        if (b == obsidian) return '@';
        if (b == cobble) return '%';
        if (b == aji.e(10) || b == aji.e(11)) return (char) ('A' + e(x, y, z));
        return (char) ('a' + e(x, y, z));
    }
    String grid() {
        StringBuilder s = new StringBuilder();
        for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) s.append(cell(x, y, z));
        return s.toString();
    }
}

public class FluidProbe {
    static int hash(String s) { int h = 0; for (int i = 0; i < s.length(); i++) h = 31 * h + s.charAt(i); return h; }
    public static void main(String[] args) throws Exception {
        aji.p(); // Block.registerBlocks
        aji flowing = aji.e(8), still = aji.e(9), lavaFlowing = aji.e(10), lavaStill = aji.e(11);
        Method flow = alw.class.getDeclaredMethod("f", ahl.class, int.class, int.class, int.class);
        flow.setAccessible(true);
        Field fx = azw.class.getDeclaredField("a"), fy = azw.class.getDeclaredField("b"), fz = azw.class.getDeclaredField("c");
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        StringBuilder percents = new StringBuilder();
        for (int m = 0; m < 16; m++) percents.append(m > 0 ? "," : "").append(Float.toString(alw.b(m)));
        System.out.println("{\"percent\":[" + percents + "],\"blocks\":{\"water\":[" + still.m() + "," + still.k() + "," + still.c() + "],\"lava\":[" + lavaStill.m() + "," + lavaStill.k() + "," + lavaStill.c() + "]}}");
        for (String line = in.readLine(); line != null; ) {
            String[] head = line.split(" ");
            if (!head[0].equals("scenario")) { line = in.readLine(); continue; }
            int dx = Integer.parseInt(head[2]), dy = Integer.parseInt(head[3]), dz = Integer.parseInt(head[4]), ticks = Integer.parseInt(head[5]);
            ahb w = new ahb(dx, dy, dz);
            if (head.length > 6) w.s = new Random(Long.parseLong(head[6]));
            if (head.length > 7) w.t = new ahb.Provider(head[7].equals("1"));
            String grid = in.readLine().substring(5);
            for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
                char c = grid.charAt((x * dy + y) * dz + z);
                w.blocks[w.at(x, y, z)] = c == '#' ? w.stone : c == '~' ? still : c == 'L' ? lavaStill : w.air;
            }
            List<String[]> events = new ArrayList<>();
            for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
            StringBuilder hashes = new StringBuilder();
            for (int t = 1; t <= ticks; t++) {
                w.tick = t;
                for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
                    int x = Integer.parseInt(e[3]), y = Integer.parseInt(e[4]), z = Integer.parseInt(e[5]);
                    if (e[2].equals("remove")) w.d(x, y, z, w.air, 0, 3);
                    else if (e[2].equals("stone")) w.d(x, y, z, w.stone, 0, 3);
                    else if (e[2].equals("water")) {
                        // The game has one water block: a source over a source changes nothing.
                        aji now = w.a(x, y, z);
                        if (!((now == flowing || now == still) && w.e(x, y, z) == 0)) w.d(x, y, z, flowing, 0, 3);
                    }
                    else if (e[2].equals("lava")) {
                        aji now = w.a(x, y, z);
                        if (!((now == lavaFlowing || now == lavaStill) && w.e(x, y, z) == 0)) w.d(x, y, z, lavaFlowing, 0, 3);
                    }
                }
                w.tick();
                hashes.append(t > 1 ? "," : "").append(hash(w.grid()));
            }
            StringBuilder flows = new StringBuilder();
            for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
                aji b = w.a(x, y, z);
                boolean lava = b == lavaFlowing || b == lavaStill;
                if (b != flowing && b != still && !lava) continue;
                azw v = (azw) flow.invoke(b, w, x, y, z);
                double angle = alw.a(w, x, y, z, lava ? awt.i : awt.h);
                flows.append(flows.length() > 0 ? "," : "").append("[").append(x).append(",").append(y).append(",").append(z).append(",")
                    .append(fx.getDouble(v)).append(",").append(fy.getDouble(v)).append(",").append(fz.getDouble(v)).append(",").append(angle).append("]");
            }
            StringBuilder pend = new StringBuilder();
            for (ahb.Entry e : w.tree) pend.append(pend.length() > 0 ? "," : "").append("[").append(e.x).append(",").append(e.y).append(",").append(e.z).append(",").append(e.time - w.time).append(",\"").append(e.block == flowing ? "flowing" : e.block == still ? "still" : e.block == lavaFlowing ? "lavaFlowing" : e.block == lavaStill ? "lavaStill" : "other").append("\"]");
            System.out.println("{\"name\":\"" + head[1] + "\",\"hashes\":[" + hashes + "],\"grid\":\"" + w.grid() + "\",\"fizz\":[" + String.join(",", w.fizzes) + "],\"rng\":" + w.s.nextInt() + ",\"pending\":" + w.tree.size() + ",\"pendingCells\":[" + pend + "],\"flows\":[" + flows + "]}");
        }
    }
}
