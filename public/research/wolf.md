# Wolf targeting (batch 42)

Evidence: `enderman-wolf-b42-reference.json`, native `wv` EntityWolf (`tg` tameable, `vr` TargetNonTamed, `vs` OwnerHurtByTarget, `vt` OwnerHurtTarget, `vn` HurtByTarget with call for help) run by `EndermanWolfProbe` beside a real `EntityPlayerMP`: wild, tamed, angry, sitting and foreign-owned wolves, sheep, zombies, creative/invisible/sneaking/adventure players, owner hurt and owner hit with the 100-tick window, two owners. The replay (`src/enderman-wolf-replay.js`) matched every compared tick of the existing wolf AI with no port change.

Open: the compared window ends when a wolf is 0.5 block from its recorded place (native AIWander and LookIdle draws are not replayed, the harness burns them) or at the first unscripted bite. Wolf wander, the exact bite timing after a run, and the sheep-hunt target chance draw (`i200`) are therefore not asserted beyond that window. Bytecode-read only (not executed): none beyond the enderman note.
