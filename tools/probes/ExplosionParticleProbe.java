import java.lang.reflect.Field;
import java.util.*;

// Calls the original four explosion particle constructors and onUpdate methods, and
// records client Explosion.doExplosionB's spawnParticle calls. No GL render calls.
public class ExplosionParticleProbe extends ParticleProbe {
  static class PW extends PWorld {
    PW(){super();}
    public void a(String name,double x,double y,double z,double vx,double vy,double vz){calls.add("[\""+name+"\","+x+","+y+","+z+","+vx+","+vy+","+vz+"]");}
    public void a(double x,double y,double z,String sound,float volume,float pitch){}
    public boolean d(int x,int y,int z,aji block,int meta,int flags){return true;}
  }
  static int age(bkm p,String kind)throws Exception{return i(p,kind.equals("largeexplode")?"aB":kind.equals("hugeexplosion")?"a":"f");}
  static int max(bkm p,String kind)throws Exception{return i(p,kind.equals("largeexplode")?"aC":kind.equals("hugeexplosion")?"aB":"g");}
  public static void main(String[] args)throws Exception{
    Field uf=sun.misc.Unsafe.class.getDeclaredField("theUnsafe");uf.setAccessible(true);U=(sun.misc.Unsafe)uf.get(null);
    seedField=Random.class.getDeclaredField("seed");seedField.setAccessible(true);Math.random();
    Field holder=Class.forName("java.lang.Math$RandomNumberGeneratorHolder").getDeclaredField("randomNumberGenerator");holder.setAccessible(true);mathRandom=(Random)holder.get(null);
    aji.p();adb.l();
    world=(PW)U.allocateInstance(PW.class);set(world,"s",new Random(7));set(world,"t",U.allocateInstance(aqq.class));set(world,"C",new qi());world.E=true;
    for(String kind:new String[]{"explode","smoke","largeexplode","hugeexplosion"})for(int fixture=0;fixture<8;fixture++){
      cells.clear();
      if(fixture==1)put(11,65,10,1,0);
      if(fixture==2)put(10,65,10,1,0);
      if(fixture==3)put(10,64,10,30,0);
      if(fixture==5)put(11,64,10,81,0);
      if(fixture==6)put(11,64,10,60,0);
      if(fixture==7)put(11,64,10,65,5);
      double y=fixture==4?64.01:64.5;
      setRaw(mathRandom,0x2545F4914F6CL+fixture);
      long math=raw(mathRandom);
      bkm p=kind.equals("explode")?new bka(world,10.5,y,10.5,0.15,0.1,-0.05):kind.equals("smoke")?new bkv(world,10.5,y,10.5,0.15,0.1,-0.05):kind.equals("largeexplode")?new bki(null,world,10.5,y,10.5,0.5,0,0):new bkj(world,10.5,y,10.5,1,0,0);
      int draws=kind.equals("explode")?8:kind.equals("largeexplode")?6:4;
      long seed=back(raw((Random)get(p,"Z")),draws);
      String initial=spawn(p);initial="{\"seed\":"+seed+initial.substring(initial.indexOf(",\"x\""));
      StringBuilder track=new StringBuilder(), events=new StringBuilder();
      for(int t=0;t<120&&!p.K;t++){
        calls.clear();p.h();
        if(t>0){track.append(',');events.append(',');}
        track.append('[').append(p.s).append(',').append(p.t).append(',').append(p.u).append(',').append(p.v).append(',').append(p.w).append(',').append(p.x).append(',').append(age(p,kind)).append(',').append(i(p,"b")+i(p,"c")*16).append(',').append(p.K).append(',').append(p.D).append(']');
        events.append(calls);
      }
      System.out.println("{\"case\":\"particle\",\"kind\":\""+kind+"\",\"fixture\":"+fixture+",\"math\":"+math+",\"max\":"+max(p,kind)+",\"initial\":"+initial+",\"tracks\":["+track+"],\"events\":["+events+"]}");
    }
    cells.clear();
    {
      xw t=new xw(world,10.5,65.5,10.5,null);t.v=0.01;t.w=0.2;t.x=-0.02;t.a=3;
      StringBuilder tracks=new StringBuilder(),events=new StringBuilder();
      for(int i=0;i<4;i++){
        calls.clear();t.h();if(i>0){tracks.append(',');events.append(',');}
        tracks.append('[').append(t.s).append(',').append(t.t).append(',').append(t.u).append(',').append(t.v).append(',').append(t.w).append(',').append(t.x).append(',').append(t.a).append(',').append(t.K).append(']');
        events.append(calls);
      }
      System.out.println("{\"case\":\"tnt-smoke\",\"tracks\":["+tracks+"],\"events\":["+events+"]}");
    }
    for(float size:new float[]{1f,3f,4f,6f})for(boolean smoking:new boolean[]{false,true}){
      world.s=new Random(19);calls.clear();
      agw ex=new agw(world,null,10.5,70.5,10.5,size);ex.b=smoking;
      int[][] positions={{10,70,10},{11,70,10},{9,69,10},{11,71,12}};
      for(int[] p:positions)ex.h.add(new agt(p[0],p[1],p[2]));
      ex.a(true);
      System.out.println("{\"case\":\"burst\",\"size\":"+size+",\"smoking\":"+smoking+",\"calls\":"+calls+"}");
    }
  }
}
