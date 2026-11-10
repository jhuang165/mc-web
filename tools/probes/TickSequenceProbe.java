// Batch 35 (ticktree3): executed tick sequences. Runs the unchanged BlockDynamicLiquid (akr), BlockStaticLiquid (ant), BlockLiquid (alw),
// BlockFalling (akx) with BlockSand/BlockGravel against the FluidProbe World test double, with BlockFalling.fallInstantly set (akx.M, the
// field the unchanged updateTick reads; no EntityFallingBlock is spawned) and checkChunksExist false. The double's tick() is the model of
// WorldServer.tickUpdates (HashSet de-duplication, TreeSet ordered by time, priority and creation, at most 1000 per call; the real
// WorldServer cap is probed separately by TileTicksProbe). Original FluidProbe comment follows.
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
    public boolean E = false; // isRemote
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
    public boolean b(int a, int b, int c, int d, int e, int f) { return false; } // checkChunksExist
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
    long taken, ran; StringBuilder takenLog = new StringBuilder();
    // WorldServer.tickUpdates (mt.a(boolean), bytecode-read): the first min(size, 1000) due entries are first removed from the tree and the set into
    // the tick-this-tick list, and only then ticked in that order, so a block updated by an earlier entry can schedule an entry for a cell whose own
    // entry was already taken (FluidProbe's double ran each entry at once, which differs).
    void tick() {
        time++;
        taken = 0; ran = 0; takenLog.setLength(0);
        List<Entry> list = new ArrayList<>();
        int n = Math.min(tree.size(), 1000);
        for (; n > 0; n--) {
            Entry e = tree.first();
            if (e.time > time) break;
            tree.remove(e);
            set.remove(e);
            list.add(e);
        }
        for (Entry e : list) {
            taken++;
            if (takenLog.length() > 0) takenLog.append(' ');
            takenLog.append(id(e.block)).append('@').append(e.x).append(',').append(e.y).append(',').append(e.z);
            aji b = a(e.x, e.y, e.z);
            if (b != air && b == e.block) { ran++; b.a(this, e.x, e.y, e.z, s); }
        }
    }
    static char id(aji b) { int i = aji.b(b); return i == 8 || i == 9 ? 'w' : i == 10 || i == 11 ? 'l' : i == 12 ? 's' : i == 13 ? 'g' : '?'; }
    char cell(int x, int y, int z) {
        aji b = a(x, y, z);
        if (b == air) return '.';
        if (b == stone) return '#';
        if (b == obsidian) return '@';
        if (b == cobble) return '%';
        if (b == aji.e(12)) return 'S';
        if (b == aji.e(13)) return 'G';
        if (b == aji.e(10) || b == aji.e(11)) return (char) ('A' + e(x, y, z));
        return (char) ('a' + e(x, y, z));
    }
    String grid() {
        StringBuilder s = new StringBuilder();
        for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) s.append(cell(x, y, z));
        return s.toString();
    }
}

public class TickSequenceProbe {
    static int hash(String s) { int h = 0; for (int i = 0; i < s.length(); i++) h = 31 * h + s.charAt(i); return h; }
    public static void main(String[] args) throws Exception {
        aji.p(); // Block.registerBlocks
        akx.M = true; // BlockFalling.fallInstantly
        aji flowing = aji.e(8), still = aji.e(9), lavaFlowing = aji.e(10), lavaStill = aji.e(11), sand = aji.e(12), gravel = aji.e(13);
        BufferedReader in = new BufferedReader(new InputStreamReader(System.in));
        for (String line = in.readLine(); line != null; ) {
            String[] head = line.split(" ");
            if (!head[0].equals("scenario")) { line = in.readLine(); continue; }
            int dx = Integer.parseInt(head[2]), dy = Integer.parseInt(head[3]), dz = Integer.parseInt(head[4]), ticks = Integer.parseInt(head[5]);
            ahb w = new ahb(dx, dy, dz);
            w.s = new Random(Long.parseLong(head[6]));
            String grid = in.readLine().substring(5);
            for (int x = 0; x < dx; x++) for (int y = 0; y < dy; y++) for (int z = 0; z < dz; z++) {
                char c = grid.charAt((x * dy + y) * dz + z);
                w.blocks[w.at(x, y, z)] = c == '#' ? w.stone : c == '~' ? still : c == 'L' ? lavaStill : c == 'S' ? sand : c == 'G' ? gravel : w.air;
            }
            List<String[]> events = new ArrayList<>();
            for (line = in.readLine(); line != null && line.startsWith("event "); line = in.readLine()) events.add(line.split(" "));
            StringBuilder per = new StringBuilder();
            for (int t = 1; t <= ticks; t++) {
                w.tick = t;
                for (String[] e : events) if (Integer.parseInt(e[1]) == t) {
                    int x = Integer.parseInt(e[3]), y = Integer.parseInt(e[4]), z = Integer.parseInt(e[5]);
                    if (e[2].equals("remove")) w.d(x, y, z, w.air, 0, 3);
                    else if (e[2].equals("stone")) w.d(x, y, z, w.stone, 0, 3);
                    else if (e[2].equals("sand")) w.d(x, y, z, sand, 0, 3);
                    else if (e[2].equals("gravel")) w.d(x, y, z, gravel, 0, 3);
                    else if (e[2].equals("water")) { aji now = w.a(x, y, z); if (!((now == flowing || now == still) && w.e(x, y, z) == 0)) w.d(x, y, z, flowing, 0, 3); }
                    else if (e[2].equals("lava")) { aji now = w.a(x, y, z); if (!((now == lavaFlowing || now == lavaStill) && w.e(x, y, z) == 0)) w.d(x, y, z, lavaFlowing, 0, 3); }
                }
                w.tick();
                if (System.getenv("DUMP") != null && System.getenv("DUMP").equals(head[1] + ":" + t)) System.err.println(w.takenLog);
                per.append(t > 1 ? "," : "").append("[").append(w.taken).append(",").append(w.ran).append(",").append(hash(w.takenLog.toString())).append(",").append(hash(w.grid())).append("]");
            }
            List<String> pend = new ArrayList<>();
            for (ahb.Entry e : w.tree) pend.add(ahb.id(e.block) + "@" + e.x + "," + e.y + "," + e.z + ":" + (e.time - w.time));
            Collections.sort(pend);
            System.out.println("{\"name\":\"" + head[1] + "\",\"ticks\":[" + per + "],\"final\":" + hash(w.grid()) + ",\"pending\":" + pend.size() + ",\"pendingHash\":" + hash(String.join(" ", pend)) + ",\"fizz\":" + w.fizzes.size() + ",\"rng\":" + w.s.nextInt() + "}");
        }
    }
}
