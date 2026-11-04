// PlayerSelector (ad), restricted to the one local player. 1.7.10 has @p/@a/@r, no @e.
export function selectLocalPlayer(text, host) {
  const match = /^@([par])(?:\[([^\]]*)\])?$/.exec(text);
  if (!match) return null;
  const args = {}, positional = ['x','y','z','r'];
  for (const [i, entry] of (match[2] ? match[2].split(',') : []).entries()) {
    const equal=entry.indexOf('=');
    if(equal<0) { if(entry && i<4)args[positional[i]]=entry; }
    else args[entry.slice(0,equal)] = entry.slice(equal+1);
  }
  const integer=(key, fallback)=> /^-?\d+$/.test(args[key]??'') ? Number(args[key])|0 : fallback;
  const p=(host.playerPosition??host.position)(), base=host.position(), name=host.playerName??host.name??'Player';
  const origin={x:integer('x',Math.floor(base.x)),y:integer('y',Math.floor(base.y+0.5)),z:integer('z',Math.floor(base.z))};
  const distance=(p.x-origin.x)**2+(p.y-origin.y)**2+(p.z-origin.z)**2;
  const r=integer('r',-1),rm=integer('rm',-1),level=host.playerLevel?.()??0,mode=host.playerMode?.()??0;
  if(r>=0&&distance>r*r||rm>=0&&distance<rm*rm) return null;
  if(level<integer('lm',0)||level>integer('l',2147483647))return null;
  if('m' in args&&integer('m',-1)!==-1&&mode!==integer('m',-1))return null;
  if('name' in args) { const invert=args.name.startsWith('!'),want=invert?args.name.slice(1):args.name;if((name===want)===invert)return null; }
  // Teams/scoreboard filters cannot match because this build has no teams or scoreboard.
  if(Object.keys(args).some(k=>k.startsWith('score_'))||args.team&&args.team!=='!')return null;
  return name;
}
