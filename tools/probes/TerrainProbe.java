import java.lang.reflect.*;
import java.util.*;
import java.security.MessageDigest;
import sun.misc.Unsafe;

// Executes unchanged pinned 1.7.10 classes. The World double supplies only seed, type and real WorldChunkManager.
// ChunkProviderGenerate's real constructor, density and replaceBlocksForBiome run; no caves/populate/structures.
public class TerrainProbe {
  static Unsafe unsafe;
  static Field field(Class<?> c,String n)throws Exception {for(;c!=null;c=c.getSuperclass())try{Field f=c.getDeclaredField(n);f.setAccessible(true);return f;}catch(NoSuchFieldException e){}throw new NoSuchFieldException(n);}
  static void set(Object o,String n,Object v)throws Exception{field(o.getClass(),n).set(o,v);}
  static Object get(Object o,String n)throws Exception{return field(o.getClass(),n).get(o);}
  static String q(String s){return "\""+s+"\"";}
  static String doubles(double[] a){return Arrays.toString(a);}
  static String ints(int[] a){return Arrays.toString(a);}
  static String hash(aji[] a)throws Exception{MessageDigest h=MessageDigest.getInstance("SHA-1");for(aji b:a){int id=b==null?0:aji.b(b);h.update((byte)id);h.update((byte)(id>>8));}return hex(h.digest());}
  static String hash(byte[] a)throws Exception{return hex(MessageDigest.getInstance("SHA-1").digest(a));}
  static String hex(byte[] a){StringBuilder s=new StringBuilder();for(byte b:a)s.append(String.format("%02x",b&255));return s.toString();}
  static String column(aji[] a,byte[] m,int base){int[] b=new int[256],m0=new int[256];for(int y=0;y<256;y++){b[y]=a[base+y]==null?0:aji.b(a[base+y]);m0[y]=m[base+y]&255;}return "["+ints(b)+","+ints(m0)+"]";}
  public static class W extends ahb {
    long seed; aib manager; ays info;
    W(){super((azc)null,null,(aqo)null,(ahj)null,null);}
    protected apu j(){return null;}protected int p(){return 0;}public sa a(int id){return null;}
    public long H(){return seed;} public aib v(){return manager;} public ays N(){return info;}
  }
  static W world(long seed,ahm type)throws Exception{
    W w=(W)unsafe.allocateInstance(W.class);w.seed=seed;w.manager=new aib(seed,type);w.info=(ays)unsafe.allocateInstance(ays.class);
    for(Field f:ays.class.getDeclaredFields())if(f.getType()==ahm.class){f.setAccessible(true);f.set(w.info,type);}return w;
  }
  static void resetMesa()throws Exception {for(ahu b:ahu.n())if(b instanceof ail){set(b,"aC",null);set(b,"aD",0L);set(b,"aE",null);set(b,"aF",null);set(b,"aG",null);}}
  static String type(ahm t){return t==ahm.e?"amplified":t==ahm.d?"largeBiomes":"default";}
  static void chunk(W w,aqz gen,int x,int z)throws Exception {
    ((Random)get(gen,"i")).setSeed((long)x*341873128712L+(long)z*132897987541L);
    aji[] blocks=new aji[65536];byte[] meta=new byte[65536];axl.a();gen.a(x,z,blocks);
    long chunkSeed=(long)x*341873128712L+(long)z*132897987541L;String raw=hash(blocks);double[] density=((double[])get(gen,"q")).clone();
    axl.a();ahu[] biomes=w.manager.b(null,x*16,z*16,16,16);gen.a(x,z,blocks,meta,biomes);
    int[] ids=new int[256];for(int i=0;i<256;i++)ids[i]=biomes[i].ay;
    StringBuilder cols=new StringBuilder("[");for(int[] p:new int[][]{{0,0},{1,7},{7,1},{8,8},{15,15}}){if(cols.length()>1)cols.append(',');cols.append('[').append(p[0]).append(',').append(p[1]).append(',').append(column(blocks,meta,(p[0]*16+p[1])*256)).append(']');}cols.append(']');
    System.out.println("{\"kind\":\"chunk\",\"seed\":"+q(""+w.seed)+",\"type\":"+q(type(w.info.u()))+",\"x\":"+x+",\"z\":"+z+",\"chunkSeed\":"+q(""+chunkSeed)+",\"rawSha1\":"+q(raw)+",\"blocksSha1\":"+q(hash(blocks))+",\"metadataSha1\":"+q(hash(meta))+",\"biomes\":"+ints(ids)+",\"density\":"+doubles(density)+",\"columns\":"+cols+",\"nextLong\":"+q(""+((Random)get(gen,"i")).nextLong())+"}");
  }
  public static void main(String[] args)throws Exception {
    Field uf=Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);unsafe=(Unsafe)uf.get(null);aji.p();
    for(long seed:new long[]{0,-1,8675309,Long.MIN_VALUE,Long.MAX_VALUE}) {
      for(int[] a:new int[][]{{0,0,0,3,1,4},{-19,-7,31,3,5,2},{30000000,0,-30000000,2,3,2}}){
        awj improved=new awj(new Random(seed));double[] n=new double[a[3]*a[4]*a[5]];improved.a(n,a[0],a[1],a[2],a[3],a[4],a[5],0.125,0.25,0.3,0.7);
        awk oct=new awk(new Random(seed),4);awl perlin=new awl(new Random(seed),4);awo simplex=new awo(new Random(seed));
        System.out.println("{\"kind\":\"noise\",\"seed\":"+q(""+seed)+",\"area\":"+ints(a)+",\"improved\":"+doubles(n)+",\"octaves\":"+doubles(oct.a(null,a[0],a[1],a[2],a[3],a[4],a[5],0.125,0.25,0.3))+",\"perlin\":"+doubles(perlin.a(null,a[0],a[2],a[3],a[5],0.125,0.3,1.5))+",\"simplex\":"+simplex.a(a[0]*0.125,a[2]*0.3)+",\"point\":"+perlin.a(a[0]*0.125,a[2]*0.3)+"}");
      }
    }
    for(long seed:new long[]{0,8675309,-123456789,Long.MAX_VALUE})for(ahm t:new ahm[]{ahm.b,ahm.e,ahm.d}){
      resetMesa();W w=world(seed,t);aqz gen=new aqz(w,seed,false);
      if(t==ahm.b){
        StringBuilder fields=new StringBuilder("{");
        for(String name:new String[]{"j","k","l","m","a","b","c"}){
          Object ng=get(gen,name);double[] values=ng instanceof awk?((awk)ng).a(null,-7,3,19,2,3,2,0.125,0.25,0.3):((awl)ng).a(null,-7,19,2,2,0.125,0.3,1.5);
          if(fields.length()>1)fields.append(',');fields.append(q(name)).append(':').append(doubles(values));
        }fields.append('}');
        float[] parabolic=(float[])get(gen,"r");double[] parab=new double[25];for(int i=0;i<25;i++)parab[i]=parabolic[i];
        Random rnd=(Random)get(gen,"i");long next=rnd.nextLong();
        System.out.println("{\"kind\":\"constructor\",\"seed\":"+q(""+seed)+",\"fields\":"+fields+",\"parabolic\":"+doubles(parab)+",\"nextLong\":"+q(""+next)+"}");
        rnd.setSeed(seed); // Chunk fixtures reseed before use; constructor state has already been captured.
      }
      for(int[] p:new int[][]{{0,0},{-17,29},{1874999,-1874999}})chunk(w,gen,p[0],p[1]);
      if(t!=ahm.d&&seed==8675309){
        Set<Integer> need=new HashSet<>(Arrays.asList(0,3,6,32,37,38,131,140,160,163,164,165,166));
        for(int radius=0;radius<=6&&!need.isEmpty();radius++)for(int tx=-radius;tx<=radius&&!need.isEmpty();tx++)for(int tz=-radius;tz<=radius&&!need.isEmpty();tz++){
          if(radius>0&&Math.abs(tx)!=radius&&Math.abs(tz)!=radius)continue;
          int bx=tx*1024-512,bz=tz*1024-512;axl.a();ahu[] bs=w.manager.a((ahu[])null,bx,bz,1024,1024);
          for(int i=0;i<1024*1024;i++)if(need.remove(bs[i].ay))chunk(w,gen,Math.floorDiv((bx+i%1024)*4,16),Math.floorDiv((bz+i/1024)*4,16));
        }
        if(!need.isEmpty())throw new AssertionError("Missing biome samples "+need);
      }
    }
    // Every occupied biome slot, branch thresholds, sea floor, high/cavern surfaces, and negative/far columns.
    for(int slot=0;slot<256;slot++)if(ahu.n()[slot]!=null){
      resetMesa();W w=world(8675309,ahm.b);ahu b=ahu.n()[slot];StringBuilder cases=new StringBuilder("[");
      double[] noises={-12,-3,-1,-0.95,-0.5,0,0.9,1,1.75,2,3,7,-12,0,0,0};int[] heights={50,61,62,63,64,70,90,130,250,80,66,55,62,62,62,62};
      for(int k=0;k<noises.length;k++){
        int x=k>=13?-40:k%2==0?-33:30000007,z=k>=13?new int[]{60,62,70}[k-13]:k%2==0?71:-29999997,base=((z&15)*16+(x&15))*256;
        aji[] blocks=new aji[65536];byte[] meta=new byte[65536];if(k>=13)Arrays.fill(blocks,base,base+256,aji.e(0));Arrays.fill(blocks,base,base+heights[k]+1,aji.e(1));Arrays.fill(blocks,base+42,base+47,null);
        if(blocks[base+44]!=null)throw new AssertionError("Fixture cavity");
        Random r=new Random(1234+k);b.a(w,r,blocks,meta,x,z,noises[k]);
        if(k>0)cases.append(',');cases.append("{\"explicitAir\":").append(k>=13).append(",\"noise\":").append(noises[k]).append(",\"height\":").append(heights[k]).append(",\"x\":").append(x).append(",\"z\":").append(z).append(",\"column\":").append(column(blocks,meta,base)).append(",\"nextLong\":").append(q(""+r.nextLong())).append('}');
      }cases.append(']');System.out.println("{\"kind\":\"surface\",\"seed\":\"8675309\",\"slot\":"+slot+",\"class\":"+q(b.getClass().getName())+",\"cases\":"+cases+"}");
    }
    // Same singleton Mesa across world seeds: retain the previous-seed Bryce noise quirk.
    resetMesa();for(long seed:new long[]{23,42,0}){W w=world(seed,ahm.b);aqz gen=new aqz(w,seed,false);aji[] a=new aji[65536];byte[] m=new byte[65536];Arrays.fill(a,0,100,aji.e(1));ahu[] bs=new ahu[256];Arrays.fill(bs,ahu.d(165));gen.a(0,0,a,m,bs);System.out.println("{\"kind\":\"mesaSequence\",\"seed\":"+q(""+seed)+",\"blocksSha1\":"+q(hash(a))+",\"metadataSha1\":"+q(hash(m))+"}");}
  }
}
