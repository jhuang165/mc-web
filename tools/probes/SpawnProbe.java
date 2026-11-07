import java.lang.reflect.*;
import java.util.*;
import sun.misc.Unsafe;

// Runs the unchanged 1.7.10 WorldServer.createSpawnPosition (mt.b(WorldSettings)) with its real findBiomePosition, the up-to-1000-step
// walk, WorldProvider.canCoordinateBeSpawn (aqo.a(II)) and World.getTopBlock (ahb.b(II)), on a WorldServer allocated without a constructor.
// Chunks come from the real ChunkProviderGenerate (aqz, caves, ravines, structure starts off) or ChunkProviderFlat (aqu) and are not
// populated (the walk loads isolated chunks, so ChunkProviderServer never populates). Also records World.getTopSolidOrLiquidBlock
// (ahb.i(II)) around each spawn, the input of the EntityPlayerMP spawn fuzz (read from bytecode, not executed).
public class SpawnProbe {
  static Unsafe unsafe;
  static String q(String s){
    StringBuilder b=new StringBuilder("\"");
    for(char c:s.toCharArray()){if(c=='"'||c=='\\')b.append('\\').append(c);else if(c<32||c>126)b.append(String.format("\\u%04x",(int)c));else b.append(c);}
    return b.append('"').toString();
  }
  static void set(Object o,Class<?> c,String n,Object v)throws Exception{Field f=c.getDeclaredField(n);f.setAccessible(true);f.set(o,v);}
  public static class Info extends ays {
    int sx,sy,sz;int calls;
    public void a(int x,int y,int z){sx=x;sy=y;sz=z;calls++;}
  }
  public static class W extends mt {
    W(){super(null,null,null,0,null,null);} // never run: the instance is allocated without constructors
    long seed;apu gen;Map<Long,apx> chunks=new HashMap<>();
    protected void a(){} public long H(){return seed;}
    static long key(int bx,int bz){return ((long)(bx>>4)<<32)^((bz>>4)&0xffffffffL);}
    // World.blockExists: a chunk still being generated is not loaded yet, so the mapgen biome lookups fall back to the manager.
    public boolean d(int x,int y,int z){return y>=0&&y<256&&chunks.containsKey(key(x,z));}
    public apx d(int bx,int bz){apx c=chunks.get(key(bx,bz));if(c==null){c=gen.d(bx>>4,bz>>4);chunks.put(key(bx,bz),c);}return c;}
    public aji a(int x,int y,int z){if(y<0||y>=256)return ajn.a;return d(x,z).a(x&15,y,z&15);}
    public boolean c(int x,int y,int z){return a(x,y,z)==ajn.a;}
    void run(ahj s){b(s);}
  }
  static void spawn(String kind,String preset,long seed)throws Exception{
    ahm type=kind.equals("default")?ahm.b:kind.equals("largeBiomes")?ahm.d:kind.equals("amplified")?ahm.e:ahm.c;
    W w=(W)unsafe.allocateInstance(W.class);w.seed=seed;w.chunks=new HashMap<>();
    for(Field f:ahb.class.getDeclaredFields())if(!Modifier.isStatic(f.getModifiers())&&f.getType()==List.class){f.setAccessible(true);f.set(w,new ArrayList<>());}
    Info info=(Info)unsafe.allocateInstance(Info.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(info,type);}
    set(w,ahb.class,"x",info);
    aqo prov=new aqq();
    aib manager;
    if(kind.equals("flat")){ass i=ass.a(preset);manager=new aie(ahu.d(i.a()),0.5f);w.gen=new aqu(w,seed,false,preset);}
    else{manager=new aib(seed,type);}
    set(prov,aqo.class,"b",w);set(prov,aqo.class,"c",type);set(prov,aqo.class,"e",manager);
    set(w,ahb.class,"t",prov);
    if(!kind.equals("flat"))w.gen=new aqz(w,seed,false);
    set(w,ahb.class,"v",w.gen);
    agt bp=manager.a(0,0,256,manager.a(),new Random(seed));
    w.run(new ahj(seed,ahk.b,false,false,type));
    StringBuilder tops=new StringBuilder("[");
    for(int dx=-10;dx<=10;dx+=5)for(int dz=-10;dz<=10;dz+=5){
      if(tops.length()>1)tops.append(',');tops.append("["+(info.sx+dx)+","+(info.sz+dz)+","+w.i(info.sx+dx,info.sz+dz)+"]");
    }
    System.out.println("{\"kind\":"+q(kind)+",\"preset\":"+(preset==null?"null":q(preset))+",\"seed\":"+q(""+seed)+",\"biomePos\":"+(bp==null?"null":"["+bp.a+","+bp.c+"]")+",\"spawn\":["+info.sx+","+info.sy+","+info.sz+"],\"calls\":"+info.calls+",\"chunks\":"+w.chunks.size()+",\"topSolid\":"+tops+"]}");
  }
  public static void main(String[] a)throws Exception{
    Field uf=Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);unsafe=(Unsafe)uf.get(null);aji.p();adb.l();
    long[] seeds={0,1,2,3,4,5,6,7,8,9,10,42,100,671,1234567,8675309,-1,-7,-987654321L,1L<<40|7,Long.MAX_VALUE,Long.MIN_VALUE,2718281828L,314159265358979L,-5555,20000,31337,99999,-424242,1000003,777,-12,123456789012L,11,12,13};
    for(long s:seeds)spawn("default",null,s);
    for(int i=0;i<8;i++){spawn("largeBiomes",null,seeds[i*3+1]);spawn("amplified",null,seeds[i*3+2]);}
    for(String p:a)for(long s:new long[]{0,42,-7,8675309})spawn("flat",p,s);
  }
}
