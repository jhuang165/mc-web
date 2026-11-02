import java.lang.reflect.*;
import java.security.MessageDigest;
import java.util.*;

// Unchanged 1.7.10 WorldGenLiquids (asm) springs with their immediate liquid tick. World G is
// a double over real Chunk (apx) storage: real World setBlock/notify/isAir code and real Block
// callbacks run; G supplies chunks, a block-light fixture, emulated WorldServer tick scheduling
// (in immediate mode blocks other than fire run updateTick at once, otherwise a pending entry is recorded), and records
// sounds, aux effects and dropped items. Light updates and render marks are no-ops.
public class SpringProbe {
  static String q(String s){return TerrainProbe.q(s);}
  static int h(int a,int b,int c){int v=a*0x2F0B3A49+b*0x6C8E9CF5+c*0x1B873593;v^=v>>>15;v*=0x2C1B3C6D;v^=v>>>12;v*=0x297A2D39;v^=v>>>15;return v;}
  public static class G extends TerrainProbe.W {
    Map<Long,apx> chunks=new HashMap<>();MessageDigest calls,writes;int callCount,writeCount;
    StringBuilder pending=new StringBuilder(),drops=new StringBuilder(),sounds=new StringBuilder(),aux=new StringBuilder();Set<String> pendingKeys=new HashSet<>();
    StringBuilder trace;int lightBase;agy rules=new agy();
    static long ck(int x,int z){return ((long)x<<32)^(z&0xffffffffL);}
    static void put(MessageDigest d,int... a){for(int v:a)for(int s=0;s<32;s+=8)d.update((byte)(v>>s));}
    void call(int... a){callCount++;put(calls,a);if(trace!=null)trace.append(Arrays.toString(a)).append('\n');}
    static void add(StringBuilder s,String v){if(s.length()>0)s.append(',');s.append(v);}
    public boolean c(int x,int z){return chunks.containsKey(ck(x,z));}
    public apx e(int x,int z){apx c=chunks.get(ck(x,z));if(c==null)throw new AssertionError("unloaded chunk "+x+","+z);return c;}
    public aji a(int x,int y,int z){call(0,x,y,z);return super.a(x,y,z);}
    public int e(int x,int y,int z){call(2,x,y,z);return super.e(x,y,z);}
    public int j(int x,int y,int z){call(3,x,y,z);return Math.floorMod(x*5+y*11+z*3+lightBase,16);}
    public boolean d(int x,int y,int z,aji b,int meta,int flags){call(1,x,y,z,aji.b(b),meta,flags);boolean r=super.d(x,y,z,b,meta,flags);
      if(r){writeCount++;put(writes,x,y,z,aji.b(b),meta,flags);}return r;}
    public boolean a(int x,int y,int z,int meta,int flags){call(4,x,y,z,meta,flags);boolean r=super.a(x,y,z,meta,flags);
      if(r){writeCount++;put(writes,x,y,z,-1,meta,flags);}return r;}
    public void a(int x,int y,int z,aji b,int delay){a(x,y,z,b,delay,0);}
    // WorldServer.scheduleBlockUpdateWithPriority (mt), world time 0.
    public void a(int x,int y,int z,aji b,int delay,int priority){
      call(5,x,y,z,aji.b(b),delay,priority);int r=0;
      if(d&&b.o()!=awt.a){
        if(b.L()){r=8;if(b(x-r,y-r,z-r,x+r,y+r,z+r)){aji c=a(x,y,z);if(c.o()!=awt.a&&c==b)c.a(this,x,y,z,s);}return;}
        delay=1;
      }
      if(b(x-r,y-r,z-r,x+r,y+r,z+r)){String k=x+","+y+","+z+","+aji.b(b);
        if(pendingKeys.add(k))add(pending,"["+x+","+y+","+z+","+aji.b(b)+","+(b.o()!=awt.a?delay:-1)+","+(b.o()!=awt.a?priority:0)+"]");}
    }
    public boolean t(int x,int y,int z){return false;}
    public boolean c(ahn l,int x,int y,int z){return false;}
    public void b(int x,int z,int a,int b){}
    public void m(int x,int y,int z){}
    public void g(int x,int y,int z){}
    public void a(double x,double y,double z,String name,float volume,float pitch){add(sounds,"["+SpringProbe.q(name)+","+x+","+y+","+z+","+volume+","+pitch+"]");}
    public void a(String name,double x,double y,double z,double a,double b,double c){}
    public void c(int type,int x,int y,int z,int data){add(aux,"["+type+","+x+","+y+","+z+","+data+"]");}
    public boolean d(sa e){add d=((xk)e).f();add(drops,"["+e.s+","+e.t+","+e.u+","+adb.b(d.b())+","+d.b+","+d.k()+","+((xk)e).b+"]");return true;}
    public agy O(){return rules;}
    String done(){return "\"callCount\":"+callCount+",\"callSha1\":"+SpringProbe.q(TerrainProbe.hex(calls.digest()))+",\"writeCount\":"+writeCount+",\"writeSha1\":"+SpringProbe.q(TerrainProbe.hex(writes.digest()))
      +",\"pending\":["+pending+"],\"drops\":["+drops+"],\"sounds\":["+sounds+"],\"aux\":["+aux+"]";}
    // Chunk storage hash: block id and metadata per (x, z, y), then the height map.
    String state()throws Exception{MessageDigest d=MessageDigest.getInstance("SHA-1");List<Long> keys=new ArrayList<>(chunks.keySet());Collections.sort(keys);
      for(long k:keys){apx c=chunks.get(k);put(d,(int)(k>>32),(int)k);for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++)put(d,aji.b(c.a(x,y,z))|c.c(x,y,z)<<12);for(int x=0;x<16;x++)for(int z=0;z<16;z++)put(d,c.b(x,z));}
      return TerrainProbe.hex(d.digest());}
  }
  static G world(long worldSeed,long randSeed)throws Exception{return world(G.class,worldSeed,randSeed);}
  static <T extends G> T world(Class<T> cls,long worldSeed,long randSeed)throws Exception{
    T w=cls.cast(TerrainProbe.unsafe.allocateInstance(cls));w.seed=worldSeed;w.chunks=new HashMap<>();w.calls=MessageDigest.getInstance("SHA-1");w.writes=MessageDigest.getInstance("SHA-1");
    w.pending=new StringBuilder();w.drops=new StringBuilder();w.sounds=new StringBuilder();w.aux=new StringBuilder();w.pendingKeys=new HashSet<>();w.rules=new agy();
    aqo provider=(aqo)TerrainProbe.unsafe.allocateInstance(aqq.class);TerrainProbe.field(ahb.class,"t").set(w,provider);
    TerrainProbe.field(ahb.class,"s").set(w,new Random(randSeed));TerrainProbe.field(ahb.class,"C").set(w,new qi());
    for(Field f:ahb.class.getDeclaredFields())if(f.getType()==List.class&&!Modifier.isStatic(f.getModifiers())){f.setAccessible(true);f.set(w,new ArrayList<>());}
    return w;
  }
  static void chunk(G w,int cx,int cz,aji[] blocks,byte[] meta){apx c=new apx(w,blocks,meta,cx,cz);c.b();w.chunks.put(G.ck(cx,cz),c);}
  // Synthetic fixture: six cave layers of 1-wide corridors and 6x6 rooms in stone, with floors,
  // plants, vines, cocoa on jungle-log pillars, sand/gravel ceilings, shafts and liquid rooms,
  // under a dirt/grass surface. Mirrored in src/springs.test.js. Value is id<<4|meta.
  static boolean open(int x,int z,int l){return Math.floorMod(x+3*l,6)==0||Math.floorMod(z+5*l,6)==0||room(x,z,l);}
  static boolean room(int x,int z,int l){return (h(Math.floorDiv(x,6),Math.floorDiv(z,6),l)&3)==0;}
  static boolean pillar(int x,int z,int l){return open(x,z,l)&&(h(x,z,l+100)&63)==7;}
  static int cell(int x,int y,int z){
    if(y<=0)return 7<<4;
    if(y>81)return 0;
    if(y==81){int v=h(x,z,81),k=v&15;return k==0?31<<4|1:k==1?37<<4:k==2?38<<4|(v>>>4&7):k==3?83<<4:0;}
    if(y==80)return 2<<4;
    if(y>=77)return 3<<4;
    if(y>72)return 1<<4;
    int l=(y-1)/12,f=12*l+5;
    if(!open(x,z,l))return 1<<4;
    int c=h(x,z,l+100);
    if(l>0&&(c&31)==1&&y>=f-8&&y<=f+3)return 0;
    if(pillar(x,z,l)&&y>f&&y<=f+3)return 17<<4|3;
    int cell=h(Math.floorDiv(x,6),Math.floorDiv(z,6),l+50)&7;boolean pool=room(x,z,l)&&cell<=1;
    int floor=new int[]{1,1,1,1,1,2,2,3,12,12,13,9,9,11,2,3}[c>>>4&15];
    if(y==f)return floor<<4;
    if(y==f+1){
      if(pool)return (cell==0?9:11)<<4;
      int p=c>>>8&15;
      if(floor==2||floor==3)return p<=1?31<<4|1:p==2?31<<4|2:p==3?37<<4:p==4?38<<4|(c>>>12&7):p==5?39<<4:p==6?40<<4:p==7?83<<4:0;
      if(floor==12)return p<=2?32<<4:p<=4?81<<4:p==5?83<<4:0;
      if(floor==9)return p<=3?111<<4:0;
      if(floor==1&&p==0)return 39<<4;
      return 0;
    }
    if(y==f+2){
      int[][] dirs={{0,1},{-1,0},{0,-1},{1,0}};
      for(int d=0;d<4;d++)if(pillar(x+dirs[d][0],z+dirs[d][1],l)&&(c>>>14&3)==0)return 127<<4|(d|(c>>>16&3)<<2)%12;
      if((c>>>18&3)==0){int m=0;for(int d=0;d<4;d++)if(!open(x+dirs[d][0],z+dirs[d][1],l))m|=1<<d;if(m!=0)return 106<<4|m;}
      return 0;
    }
    if(y==f+3)return 0;
    if(y==f+4){int k=c>>>20&7;return k==0?12<<4:k==1?13<<4:1<<4;}
    return 1<<4;
  }
  static G fixture(long randSeed)throws Exception{
    G w=world(0,randSeed);
    for(int cx=-3;cx<=2;cx++)for(int cz=-3;cz<=2;cz++){aji[] b=new aji[65536];byte[] m=new byte[65536];
      for(int x=0;x<16;x++)for(int z=0;z<16;z++)for(int y=0;y<256;y++){int v=cell(cx*16+x,y,cz*16+z),i=(x*16+z)*256+y;b[i]=v>>4==0?null:aji.e(v>>4);m[i]=(byte)(v&15);}
      chunk(w,cx,cz,b,m);}
    return w;
  }
  // A spring site: stone above and below, stone or air here, three stone sides and one air side.
  static boolean site(G w,int x,int y,int z){
    int v=cell(x,y,z)>>4;if(cell(x,y+1,z)>>4!=1||cell(x,y-1,z)>>4!=1||(v!=1&&v!=0))return false;
    int stone=0,air=0;for(int[] d:new int[][]{{-1,0},{1,0},{0,-1},{0,1}}){int n=cell(x+d[0],y,z+d[1])>>4;if(n==1)stone++;if(n==0)air++;}return stone==3&&air==1;
  }
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);TerrainProbe.unsafe=(sun.misc.Unsafe)uf.get(null);aji.p();adb.l();
    String only=args.length>0?args[0]:null;akx.M=true;
    // Block and material properties used by the world model.
    Map<awt,String> names=new HashMap<>();for(Field f:awt.class.getDeclaredFields())if(f.getType()==awt.class&&Modifier.isStatic(f.getModifiers())){f.setAccessible(true);names.put((awt)f.get(null),f.getName());}
    StringBuilder blocks=new StringBuilder("[");
    for(int id=0;id<256;id++){aji b=aji.e(id);if(aji.b(b)!=id)continue;awt m=b.o();int top=DecorationFeatureProbe.topMask(b);if(blocks.length()>1)blocks.append(',');
      blocks.append('[').append(id).append(',').append(q(names.get(m))).append(',').append(m.a()?1:0).append(',').append(m.c()?1:0).append(',').append(m.j()?1:0).append(',').append(b.k()).append(',').append(b.d()?1:0).append(',').append(b.j()?1:0).append(',').append(top).append(',').append(q(b.getClass().getName())).append(']');}
    blocks.append(']');
    int[] blockers={aji.b(ajn.ao),aji.b(ajn.av),aji.b(ajn.an),aji.b(ajn.ap),aji.b(ajn.aH)};
    System.out.println("{\"kind\":\"config\",\"blocks\":"+blocks+",\"liquidBlockers\":"+Arrays.toString(blockers)+",\"liquids\":["+aji.b(ajn.i)+","+aji.b(ajn.k)+"]}");
    Random pick=new Random(20261101L);int records=0;
    for(int r=0;r<140;r++){
      long seed=pick.nextLong(),worldRand=pick.nextLong();int lightBase=pick.nextInt(16);
      int mode=r%7;int n=mode==6?1:4+pick.nextInt(6);List<int[]> attempts=new ArrayList<>();
      for(int i=0;i<n;i++){
        boolean lava=mode<=1?false:mode<=3?true:pick.nextBoolean();
        int x=pick.nextInt(49)-24,z=pick.nextInt(49)-24,y=1+pick.nextInt(84);
        if(i%3!=2){outer:for(int k=0;k<400;k++){int px=x+k%20-10,pz=z+(k/20)%20-10,py=Math.max(1,Math.min(84,y+(k/400)));for(int dy=0;dy<84;dy++){int yy=1+Math.floorMod(py+dy*7,84);if(site(null,px,yy,pz)){x=px;y=yy;z=pz;break outer;}}}}
        attempts.add(new int[]{lava?aji.b(ajn.k):aji.b(ajn.i),x,y,z});
      }
      String label=seed+"";if(only!=null&&!only.equals(label))continue;
      G w=fixture(worldRand);w.lightBase=lightBase;if(only!=null)w.trace=new StringBuilder();
      Random rand=new Random(seed);StringBuilder results=new StringBuilder("[");
      for(int[] a:attempts){boolean ok=new asm(aji.e(a[0])).a(w,rand,a[1],a[2],a[3]);if(results.length()>1)results.append(',');results.append(ok);}
      StringBuilder as=new StringBuilder("[");for(int[] a:attempts){if(as.length()>1)as.append(',');as.append(Arrays.toString(a));}
      System.out.println("{\"kind\":\"springs\",\"seed\":"+q(""+seed)+",\"worldRand\":"+q(""+worldRand)+",\"lightBase\":"+lightBase+",\"attempts\":"+as+"],\"results\":"+results+"],"+w.done()+",\"stateSha1\":"+q(w.state())+",\"nextLong\":"+q(""+rand.nextLong())+",\"worldNextLong\":"+q(""+w.s.nextLong())+"}");
      if(only!=null)System.err.print(w.trace);records++;
    }
  }
}
