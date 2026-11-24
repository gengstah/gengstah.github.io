// The Cup keeps its registered six and every game's orders together. Score and trophies
// are reconstructed from complete Twinbell bouts against Sela's announced orders.
(() => {
  "use strict";
  const storageKey="wilderkin.switchyard.v1";
  const captain={name:"Sela Switch",ids:["arcbill","kilnclaw","brookpeep","cairnwatch","chordowl","icereeve"],
    gear:{arcbill:"opening-pennant",kilnclaw:"last-stitch",brookpeep:"relay-bell",cairnwatch:"prism-lens",chordowl:"mender-wrap",icereeve:"seam-hook"}};
  const starter={name:"My Switchyard six",ids:["dewfin","thicketowl","kilnclaw","cairnwatch","gustlance","sprigkit"],
    gear:{dewfin:"opening-pennant",thicketowl:"mender-wrap",kilnclaw:"last-stitch",cairnwatch:"relay-bell"}};
  const clone=v=>JSON.parse(JSON.stringify(v));
  const lanes=[0,1],success=()=>({ok:true});
  const fail=(message,code="invalid")=>({ok:false,code,message});
  const changed=()=>fail("Another tab changed the Cup. Its latest position is open.","changed");
  const appears=(raw,id)=>typeof id==="string"&&raw.includes(id);
  const stamp=id=>typeof id==="string"&&/^[0-9a-f]{16}$/.test(id);
  const initial=()=>({v:1,roster:clone(starter),id:null,picks:[],games:[],active:null,review:false,best:null});
  const four=(card,ids)=>({name:card.name,ids:ids.slice(),gear:Object.fromEntries(ids.filter(id=>Object.hasOwn(card.gear,id)).map(id=>[id,card.gear[id]]))});
  function token(){
    const n=new Uint32Array(2);
    if(window.crypto?.getRandomValues)window.crypto.getRandomValues(n);
    else for(let i=0;i<2;i++)n[i]=Math.floor(Math.random()*4294967296);
    return Array.from(n,v=>v.toString(16).padStart(8,"0")).join("");
  }
  function create({game,sim=window.WilderTwinBattle.create({game}),storage}){
    if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
    const kin=game.species,kit=window.WilderSparringGear,dex=window.WilderKinDex;
    let persistent=!!storage,disk=null,data,records,current,sealed,bestRecord,prepared;
    const known=id=>typeof id==="string"&&Object.hasOwn(kin,id)&&!kin[id].bonus;
    const subset=(ids,pool,min,max)=>Array.isArray(ids)&&ids.length>=min&&ids.length<=max&&
      new Set(ids).size===ids.length&&[...ids].every(id=>appears(pool,id));
    function clean(card){
      if(!card||typeof card.name!=="string"||card.name.length>140||/[\u0000-\u001f\u007f-\u009f<>\u2028\u2029\u202a-\u202e\u2066-\u2069]/u.test(card.name)||
        !Array.isArray(card.ids)||card.ids.length!==6||new Set(card.ids).size!==6||![...card.ids].every(known))return null;
      const name=card.name.normalize("NFC").trim().replace(/\s+/gu," ");
      const gear=kit.validate({left:card.gear===undefined?{}:card.gear},card.ids,[]);
      return name&&[...name].length<=40&&gear?{name,ids:card.ids.slice(),gear:gear.left}:null;
    }
    const tally=games=>games.reduce((s,g)=>{if(g.winner!=="draw")s[g.winner]++;return s;},[0,0]);
    const winner=score=>score[0]>=2?0:score[1]>=2?1:null;
    const nextNumber=games=>1+games.filter(g=>g.winner!=="draw").length;
    function maxStrike(id,target,held){
      return Math.max(...kin[id].skills.filter(s=>s.kind==="attack"&&!s.trained).map(s=>{
        const effectiveness=dex.effectiveness(s.type,kin[target].types);
        const factor=held==="prism-lens"&&effectiveness<1?1:effectiveness;
        return Math.round((s.power+7.05)*factor);
      }));
    }
    // Only the public registration and finished games are inputs. A west/east pair
    // gets credit for coverage and resistance; reserves cover gaps in that pair.
    function selectRival(roster,games){
      const last=games.at(-1),ids=captain.ids,threats=roster.ids;
      const weights=threats.map(id=>{
        if(!last)return 1;
        const place=last.left.ids.indexOf(id);
        if(place<0)return .85;
        return 1.35+(place<2 ? .55 : 0)+(last.survivors[0].includes(id) ? .75 : 0);
      });
      const utility=ids.map(id=>threats.map(target=>{
        const hit=maxStrike(id,target,captain.gear[id]),reply=maxStrike(target,id,roster.gear[target]);
        return hit-.57*reply+(roster.gear[target]==="last-stitch"&&hit>22?-1:0);
      }));
      const members=[],available=ids.map((_,i)=>i);
      let top=-Infinity;
      for(const west of available)for(const east of available){
        if(west===east)continue;
        let score=ids[west]==="arcbill"?4:0;
        for(const [t,w] of weights.entries()){
          const a=utility[west][t],b=utility[east][t];
          score+=w*(Math.max(a,b)+.35*Math.min(a,b)+.05*a);
        }
        if(last?.winner===0&&last.right.ids.slice(0,2).every(id=>[ids[west],ids[east]].includes(id)))score-=36;
        if(score>top){top=score;members[0]=west;members[1]=east;}
      }
      while(members.length<4){
        let best=-1,highest=-Infinity;
        for(const id of available){
          if(members.includes(id))continue;
          let score=0;
          weights.forEach((weight,t)=>{
            const current=Math.max(...members.map(i=>utility[i][t]));
            score+=weight*(Math.max(0,utility[id][t]-current)+.3*utility[id][t]);
          });
          if(captain.gear[ids[id]]==="relay-bell")score+=2;
          if(score>highest){best=id;highest=score;}
        }
        members.push(best);
      }
      return four(captain,members.map(i=>ids[i]));
    }
    const validOrders=(p,draft,partial)=>Array.isArray(draft)&&draft.length===2&&lanes.every(lane=>{
      const id=draft[lane],occupied=p.sides[0].active[lane]!==null;
      return id===null?partial||!occupied:
        occupied&&typeof id==="string"&&id.length<=100&&sim.options(p,0,lane,draft).some(m=>m.available&&m.id===id);
    });
    function openRun(roster,prior,id,ids,committed){
      const left=four(roster,ids),right=committed||selectRival(roster,prior),pos=sim.start(left,right);
      return {id:id+"-"+(prior.length+1),left,right,keeper:null,history:[],draft:[null,null],pos,lastEvents:[],marks:{},highlight:"",high:-1};
    }
    function applyStep(run,ours,theirs,step){
      run.history.push([ours.slice(),theirs.slice()]);
      run.pos=step.pos;run.lastEvents=step.events;run.draft=[null,null];
      for(const event of step.events)if((event.damage||0)>run.high&&event.damage>0){
        run.high=event.damage;run.highlight="Round "+run.history.length+" · "+event.text;
      }
    }
    function replay(roster,prior,id,tape){
      if(!tape||!subset(tape.ids,roster.ids,4,4)||!Array.isArray(tape.orders)||tape.orders.length>sim.limit)return null;
      const run=openRun(roster,prior,id,tape.ids);
      for(const ours of tape.orders){
        if(run.pos.phase==="done"||!validOrders(run.pos,ours,false))return null;
        const theirs=sim.coach(run.pos,1),step=sim.resolve(run.pos,ours,theirs);
        if(!step)return null;
        applyStep(run,ours,theirs,step);
      }
      if(run.pos.phase==="plan"&&validOrders(run.pos,tape.draft,true))run.draft=tape.draft.slice();
      return run;
    }
    function summary(run,prior){
      const survivors=run.pos.sides.map(s=>s.team.filter(k=>k.hp).map(k=>k.id));
      return {number:nextNumber(prior),winner:run.pos.winner,rounds:run.history.length,left:run.left,right:run.right,
        standing:survivors.map(a=>a.length),survivors,hp:run.pos.sides.map(s=>s.team.reduce((n,k)=>n+k.hp,0)),
        highlight:run.highlight||"The final bell compared standing kin and remaining health."};
    }
    function verified(roster,id,tapes){
      const games=[];let last=null;
      for(const tape of tapes){
        if(winner(tally(games))!==null)break;
        const run=replay(roster,games,id,tape);
        if(run?.pos.phase!=="done")break;
        games.push(summary(run,games));last=run;
      }
      return {games,last};
    }
    const recordFor=(roster,games)=>({roster,score:tally(games),rounds:games.reduce((n,g)=>n+g.rounds,0),games});
    function earn(){
      if(winner(tally(records))!==0)return;
      const earned=recordFor(data.roster,records);
      if(!bestRecord||earned.score[1]<bestRecord.score[1]||earned.score[1]===bestRecord.score[1]&&earned.rounds<bestRecord.rounds){
        data.best={id:data.id,roster:clone(data.roster),games:clone(data.games)};bestRecord=earned;
      }
    }
    function load(text){
      data=initial();records=[];current=null;bestRecord=null;prepared=null;sealed=null;
      if(!text||text.length>4000000)return;
      try{
        const raw=JSON.parse(text);if(raw?.v!==1)return;
        const saved=raw.best,oldRoster=clean(saved?.roster);
        if(oldRoster&&stamp(saved.id)&&Array.isArray(saved.games)){
          const check=verified(oldRoster,saved.id,saved.games);
          if(check.games.length===saved.games.length&&winner(tally(check.games))===0){
            data.best=saved;bestRecord=recordFor(oldRoster,check.games);
          }
        }
        const roster=clean(raw.roster);if(!roster)return;
        data.roster=roster;if(!stamp(raw.id)||!Array.isArray(raw.games))return;
        data.id=raw.id;
        const check=verified(roster,data.id,raw.games);
        records=check.games;data.games=raw.games.slice(0,records.length);
        if(winner(tally(records))!==null){data.review=true;current=check.last;earn();return;}
        sealed=selectRival(roster,records);
        if(records.length!==raw.games.length){data.review=!!records.length;current=check.last;return;}
        if(raw.review&&records.length){data.review=true;current=check.last;return;}
        if(subset(raw.picks,roster.ids,0,4))data.picks=raw.picks.slice();
        const run=replay(roster,records,data.id,raw.active);
        if(run?.pos.phase==="plan"){
          current=run;data.picks=run.left.ids.slice();
          data.active={ids:run.left.ids.slice(),orders:run.history.map(o=>o[0]),draft:run.draft.slice()};
        }
      }catch{/* The last fully replayed game remains available. */}
    }
    const readDisk=()=>{if(persistent)try{return storage.getItem(storageKey);}catch{persistent=false;}return disk;};
    disk=readDisk();load(disk);
    function refresh(){
      const latest=readDisk();if(latest===disk)return false;
      disk=latest;load(latest);return true;
    }
    function save(){
      const next=JSON.stringify(data);
      if(!persistent){disk=next;return success();}
      let lock;
      try{
        const prefix=storageKey+".lock.";
        if(typeof storage.key==="function"&&typeof storage.removeItem==="function"){
          lock=prefix+token();storage.setItem(lock,String(Date.now()+10000));
          for(let i=0;i<storage.length;i++){
            const k=storage.key(i);
            if(k!==lock&&k?.startsWith(prefix)&&Number(storage.getItem(k))>Date.now()){
              disk=readDisk();load(disk);return changed();
            }
          }
        }
        const latest=storage.getItem(storageKey);
        if(latest!==disk){disk=latest;load(disk);return changed();}
        storage.setItem(storageKey,next);disk=next;return success();
      }catch(error){
        if(error?.name==="SecurityError"){persistent=false;disk=next;return {ok:true,persistent:false};}
        load(disk);return fail("This browser could not save the Cup. The previous position is open.","storage");
      }finally{if(lock)try{storage.removeItem(lock);}catch{/* A claim expires independently. */}}
    }
    function phase(){
      if(!data.id)return "register";
      if(winner(tally(records))!==null)return "done";
      if(data.review)return "between";
      return data.active?"battle":"pick";
    }
    function desk(){
      refresh();
      const stage=phase(),score=tally(records),win=winner(score),last=records.at(-1);
      const scoutNote=last?"Sela gives extra weight to the last game’s openers and surviving kin."+
        (last.winner===0?" She also favors changing her opening pair after a loss.":""):
        "Sela studies the affinities and equipment on your registered six before choosing her four.";
      return clone({id:data.id,phase:stage,roster:data.roster,captain,picks:data.picks,score,winner:win,
        gameNumber:stage==="done"?last.number:nextNumber(records),games:records,best:bestRecord,trophy:!!bestRecord,persistent,scoutNote});
    }
    function read(){
      refresh();if(!current)return null;
      if(!prepared)prepared=current.pos.phase==="done"?[null,null]:sim.coach(current.pos,1);
      const {id,left,right,keeper,history,draft,pos,lastEvents,marks}=current;
      return clone({id,left,right,keeper,history,draft,pos,lastEvents,marks,rivalOrders:prepared});
    }
    function setRoster(card){
      if(refresh())return changed();
      if(phase()!=="register")return fail("The six are registered for this Cup.","locked");
      const roster=clean(card);if(!roster)return fail("Choose a name, six different standard kin and unique gear for the six.");
      data.roster=roster;return save();
    }
    function register(card){
      if(refresh())return changed();
      if(phase()!=="register")return fail("Finish this series or explicitly start a new Cup.","locked");
      const roster=clean(card===undefined?data.roster:card);
      if(!roster)return fail("Choose a name, six different standard kin and unique gear for the six.");
      data.roster=roster;data.id=token();data.picks=[];sealed=selectRival(roster,records);return save();
    }
    function setPicks(ids){
      if(refresh())return changed();
      if(phase()!=="pick"||!subset(ids,data.roster.ids,0,4))return fail("Choose up to four different members of the registered six.");
      data.picks=ids.slice();return save();
    }
    function startGame(){
      if(refresh())return changed();
      if(phase()!=="pick"||data.picks.length!==4)return fail("Choose a west lead, an east lead and two reserves first.");
      current=openRun(data.roster,records,data.id,data.picks,sealed);
      data.active={ids:data.picks.slice(),orders:[],draft:[null,null]};prepared=null;return save();
    }
    function commit(action,lane,id){
      if(refresh())return changed();
      if(phase()!=="battle"||!current)return fail("Enter the next Cup game before choosing orders.");
      const p=current.pos;
      if(action==="pick"||action==="clear"){
        if(!lanes.includes(lane)||p.sides[0].active[lane]===null||action==="pick"&&typeof id!=="string")return fail("Choose an order for an occupied lane.");
        const draft=current.draft.slice();draft[lane]=action==="clear"?null:id;
        if(!validOrders(p,draft,true))return fail("Those two orders cannot be played together.");
        current.draft=draft;data.active.draft=draft.slice();return save();
      }
      if(action!=="round"||!validOrders(p,current.draft,false))return fail("Choose an order for every standing lead first.");
      const ours=current.draft.slice(),theirs=prepared||sim.coach(p,1),step=sim.resolve(p,ours,theirs,{frames:true});
      if(!step)return fail("These orders could not be resolved.");
      applyStep(current,ours,theirs,step);
      data.active.orders.push(ours);data.active.draft=[null,null];prepared=null;
      if(step.pos.phase==="done"){
        data.games.push({ids:data.active.ids.slice(),orders:data.active.orders});
        records.push(summary(current,records));data.active=null;data.review=true;data.picks=[];sealed=null;earn();
      }
      const saved=save();return saved.ok?{...saved,frames:step.frames}:saved;
    }
    function next(){
      if(refresh())return changed();
      if(phase()!=="between")return fail("The score must still be open after a completed game.");
      data.review=false;data.picks=[];sealed=selectRival(data.roster,records);current=null;prepared=null;
      return save();
    }
    function reset(confirm){
      if(refresh())return changed();
      if(confirm!==true)return fail("Confirm before starting a new Switchyard Cup.","confirm");
      data={...initial(),roster:data.roster,best:data.best};records=[];current=null;sealed=null;prepared=null;
      return save();
    }
    return Object.freeze({desk,read,refresh,setRoster,register,setPicks,startGame,commit,next,reset});
  }
  window.WilderSwitchyardSeries=Object.freeze({create,storageKey});
})();
