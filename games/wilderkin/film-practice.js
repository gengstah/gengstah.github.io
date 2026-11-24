// One private practice slot. Rebuild the opening from a verified public film, then replay the branch.
(() => {
  "use strict";
  const key="wilderkin.film-practice.v1",lockPrefix=key+".lock.",scoutPrefix="#scout-bout1=",hallPrefix="#hall-film1=";
  const maxDecisions=64,revPattern=/^[a-f0-9]{24}$/;
  const punctuation=/(?:[.,;:!?'"\)\]}>*_\x60’”…。]|%(?:22|27|29|3E|5D|60|7D)|%E2%80%(?:99|9D|A6)|%E3%80%82)+$/iu;
  const isSeat=n=>n===0||n===1,within=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const fail=(code,message)=>({ok:false,code,message});
  const ok=(record,code="updated",message="")=>({ok:true,record:clone(record),code,message});
  const invalid=()=>fail("invalid","The saved film practice could not be verified.");
  const changed=()=>fail("changed","Another tab updated this practice. Open the latest saved practice before continuing.");
  function token() {
    const bytes=new Uint8Array(12);
    if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    return Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  }
  function create({game,storage}) {
    const sim=window.WilderSparringBattle.create({game});
    const letters=window.WilderBellpostRules.create({game,storage:null});
    const scouts=window.WilderScoutRules?.create({game,storage:null});
    if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
    let persistent=!!storage,memory=null,current=null;
    function read() {
      if(persistent)try{memory=storage.getItem(key)??null;}catch{persistent=false;}
      return memory;
    }
    function write(raw,previous) {
      const canLock=persistent&&typeof storage.key==="function"&&typeof storage.removeItem==="function";
      const lock=canLock?lockPrefix+token():null;
      try{
        if(lock)try{
          storage.setItem(lock,String(Date.now()+30000));
          for(let i=0;i<storage.length;i++){
            const other=storage.key(i);
            if(other!==lock&&other?.startsWith(lockPrefix)&&Number(storage.getItem(other))>Date.now())return false;
          }
        }catch{persistent=false;}
        if(read()!==previous)return false;
        if(persistent)try{storage.setItem(key,raw);}catch{persistent=false;}
        memory=raw;
        return true;
      }finally{if(lock)try{storage.removeItem(lock);}catch{}}
    }
    const codec=letters.filmCodec;
    function scoutReport(card,teams,first) {
      const setup={mode:"cpu",rival:"custom",left:teams[0].ids,right:teams[1].ids,gear:{left:teams[0].gear,right:teams[1].gear}};
      return window.WilderScoutPractice?.filmRosters(card,setup,first,game.species,sim)||null;
    }
    // Hall tapes have no seats or correspondence IDs. A scout registration is optional evidence
    // for the fourth kin; both its published equipment and the coach's calculated trio must match.
    function hallFilm(tape) {
      if(!tape||tape.human!==0||!isSeat(tape.first)||tape.mode!==undefined&&tape.mode!=="cpu"||
          !Array.isArray(tape.moves)||!within(tape.moves.length,1,maxDecisions))return null;
      const {left,right,first,moves}=tape;
      if(![left,right].every(ids=>Array.isArray(ids)&&ids.length===3))return null;
      const gear=window.WilderSparringGear.validate(tape.gear,left,right);
      if(!gear)return null;
      const teams=[{ids:left,gear:gear.left},{ids:right,gear:gear.right}],fields=teams.map(t=>codec.team(t));
      if(fields.some(f=>!f))return null;
      let pos=sim.start(left,right,first,gear,2),commands="";
      for(const id of moves){
        if(pos.phase==="done"||typeof id!=="string"||id.length>64)return null;
        const after=sim.apply(pos,id);
        if(!after)return null;
        const command=codec.command(pos,id,2);
        if(!command)return null;
        commands+=command;pos=after;
      }
      if(pos.phase!=="done")return null;
      fields.push(first,commands);
      if(tape.scout!=null){
        const report=scoutReport(tape.scout,teams,first);
        if(!report)return null;
        fields.push(report.card.coach,report.card.die,codec.team(report.rosters[0],4));
        if(report.card.coach==="rental")fields.push(report.card.rental.slice("#rental-v1=".length));
      }else if(tape.rival!==undefined){
        if(!window.WilderSparringTeams?.namedCrew?.(tape.rival,right))return null;
        fields.push("crew-"+tape.rival);
      }else fields.push("hall");
      return hallPrefix+fields.join(".");
    }
    function hallBook(hash) {
      if(hash.length>1200)return null;
      const f=hash.slice(hallPrefix.length).split(".");
      const rental=f[4]==="rental";
      if((rental?f.length!==9:f.length!==5&&f.length!==7)||!/^[01]$/.test(f[2])||!/^[A-Z2]{1,64}$/.test(f[3]))return null;
      const teams=[codec.readTeam(f[0]),codec.readTeam(f[1])],first=Number(f[2]);
      if(teams.some(t=>!t))return null;
      let report=null,coachLabel="Hall coach";
      if(f.length>=7){
        const four=codec.readTeam(f[6],4);
        if(!four||!/^[1-6]$/.test(f[5]))return null;
        report=scoutReport({v:1,coach:f[4],ids:four.ids,gear:four.gear,picks:teams[0].ids,die:Number(f[5]),
          ...(rental?{rental:"#rental-v1="+f[7]+"."+f[8]}:{})},teams,first);
        if(!report)return null;
        coachLabel=report.name;
      }else if(f[4]!=="hall"){
        if(!f[4].startsWith("crew-"))return null;
        coachLabel=window.WilderSparringTeams?.namedCrew?.(f[4].slice(5),teams[1].ids);
        if(!coachLabel)return null;
      }
      const gear={left:teams[0].gear,right:teams[1].gear};
      let pos=sim.start(teams[0].ids,teams[1].ids,first,gear,2);
      const events=[],moves=[];
      for(const code of f[3]){
        if(pos.phase==="done")return null;
        const move=codec.readCommand(pos,code,2);
        if(!move)return null;
        const after=sim.apply(pos,move.id);
        events.push({before:pos,move,after});moves.push(move.id);pos=after;
      }
      if(pos.phase!=="done")return null;
      const record={kind:"hall",id:hash,hash,protocol:2,seat:null,human:0,teams,first,moves,pos,winner:pos.winner,status:"done",
        labels:["Challenger",coachLabel],...(report?{scout:report.card}:{})};
      return {record,events,final:pos,rosters:report?.rosters||teams};
    }
    function review(hash) {
      if(typeof hash!=="string")return null;
      if(hash.startsWith(hallPrefix))return hallBook(hash);
      return /^#bellpost-v[123]=/.test(hash)?letters.review(hash):null;
    }
    async function resolveHash(hash) {
      if(hash.startsWith(hallPrefix)){
        const book=hallBook(hash);
        return book?{source:book.record,publicHash:hash,rosters:book.rosters,table:null}:null;
      }
      if(!hash.startsWith(scoutPrefix)){
        if(!/^#bellpost-v[123]=/.test(hash))return null;
        const other=letters.inspect(hash);
        return other?.pos?{source:other,publicHash:letters.forSharing(other.hash),rosters:other.teams,table:null}:null;
      }
      const parts=hash.slice(scoutPrefix.length).split("!");
      if(!scouts||parts.length!==3||!/^([A-Z2]{1,64}|x)$/.test(parts[1])||!/^([01]|x)$/.test(parts[2]))return null;
      const table=await scouts.inspect("#scout-v1="+parts[0]);
      if(table?.stage!==4)return null;
      const tape=parts[1]==="x"?"":parts[1],end=parts[2]==="x"?"":parts[2];
      const source=letters.inspect(letters.scoutedHash(table.battle,tape,end));
      return source?{source,publicHash:hash,rosters:table.rosters,table}:null;
    }
    async function resolve(hash) {
      if(typeof hash!=="string"||hash.length>1200)return null;
      const found=await resolveHash(hash);
      if(found)return found;
      const trimmed=hash.replace(punctuation,"");
      return trimmed===hash?null:resolveHash(trimmed);
    }
    function selection(input,roster) {
      if(!Array.isArray(input?.ids)||input.ids.length!==3||new Set(input.ids).size!==3||
          !Array.from(input.ids).every(id=>roster.ids.includes(id)))return null;
      const gear=Object.fromEntries(input.ids.filter(id=>roster.gear[id]).map(id=>[id,roster.gear[id]]));
      if(input.gear===undefined)return {ids:input.ids.slice(),gear};
      const fit=window.WilderSparringGear.validate({left:input.gear},input.ids,[]);
      if(!fit||input.ids.some(id=>fit.left[id]!==gear[id]))return null;
      return {ids:input.ids.slice(),gear};
    }
    async function prepare(input) {
      const book=review(input?.sourceHash);
      if(!book||!isSeat(input.seat))return fail("source","Choose a battle film and a seat to rehearse.");
      const source=book.record,pivot=input.pivot,last=Math.max(0,book.events.length-1);
      const returnIndex=input.returnIndex===undefined?Math.min(pivot,last):input.returnIndex;
      if(!within(pivot,0,book.events.length)||!within(returnIndex,0,last))
        return fail("pivot","Choose a decision recorded in this film.");
      const film=await resolve(input.publicHash===undefined?source.hash:input.publicHash);
      if(!film||film.source.hash!==source.hash)return fail("source","The shared report and film do not describe the same battle.");
      let loadout=null,origin=book.events[pivot]?.before||book.final;
      const teams=source.teams.slice();
      if(input.loadout!=null){
        if(pivot!==0)return fail("pivot","A change of formation starts at the opening bell.");
        loadout=selection(input.loadout,film.rosters[input.seat]);
        if(!loadout)return fail("loadout","Choose three of this seat’s registered kin with their original equipment.");
        teams[input.seat]=loadout;
        origin=sim.start(teams[0].ids,teams[1].ids,source.first,{left:teams[0].gear,right:teams[1].gear},source.protocol);
      }
      if(!origin||origin.phase==="done")return fail("finished","Choose a decision before the final action.");
      const record={sourceHash:source.hash,publicHash:film.publicHash,source,seat:input.seat,pivot,returnIndex,
        teams,rosters:film.rosters,loadout,origin,pos:origin,moves:[],events:[],revision:null,status:"active"};
      return {ok:true,record};
    }
    function step(r,id) {
      if(r.moves.length+r.pivot>=maxDecisions||typeof id!=="string"||id.length>64)return false;
      const before=r.pos,move=sim.forecast(before,id);
      if(!move?.available)return false;
      const after=sim.apply(before,id);
      if(!after)return false;
      r.events.push({before,move,after});r.moves.push(id);r.pos=after;
      if(after.phase==="done")r.status="done";
      return true;
    }
    function coach(r) {
      while(r.status==="active"&&r.pos.turn!==r.seat){
        const move=sim.recommend(r.pos);
        if(!move||!step(r,move.id))return false;
      }
      return true;
    }
    function store(r,old) {
      r.revision=token();
      const {sourceHash,publicHash,seat,pivot,returnIndex,loadout,moves,revision}=r;
      const raw=JSON.stringify({v:1,sourceHash,publicHash,seat,pivot,returnIndex,loadout,moves,revision});
      if(!write(raw,old))return changed();
      current={raw,r};return ok(r);
    }
    async function resume() {
      const raw=read();
      if(raw===null){current=null;return ok(null,"empty");}
      if(raw===current?.raw)return ok(current.r,"resumed");
      if(typeof raw!=="string"||raw.length>8192){current=null;return invalid();}
      try{
        const saved=JSON.parse(raw);
        if(saved?.v!==1||typeof saved.revision!=="string"||!revPattern.test(saved.revision)||
            !Array.isArray(saved.moves)||saved.moves.length>maxDecisions){current=null;return invalid();}
        const prepared=await prepare(saved);
        if(read()!==raw)return changed();
        if(!prepared.ok){current=null;return invalid();}
        const r=prepared.record;
        for(const id of saved.moves){
          if(r.status==="done"||r.pos.turn!==r.seat&&sim.recommend(r.pos)?.id!==id||!step(r,id)){current=null;return invalid();}
        }
        if(r.status==="active"&&r.pos.turn!==r.seat){current=null;return invalid();}
        r.revision=saved.revision;current={raw,r};return ok(r,"resumed");
      }catch{current=null;return invalid();}
    }
    async function start(input) {
      const previous=read();
      let old=null;
      if(previous!==null){
        const restored=await resume();
        if(read()!==previous)return changed();
        if(!restored.ok&&restored.code!=="invalid")return restored;
        // An unreadable slot has no playable practice. Only a validated new start replaces its exact bytes.
        old=restored.ok?current?.r:null;
      }
      const result=await prepare(input);
      if(!result.ok)return result;
      if(read()!==previous)return changed();
      const r=result.record;
      if(old){
        if(input.expectedRevision!==undefined&&input.expectedRevision!==old.revision)return changed();
        if(old.sourceHash===r.sourceHash&&old.publicHash===r.publicHash&&old.seat===r.seat&&old.pivot===r.pivot&&
            old.returnIndex===r.returnIndex&&JSON.stringify(old.loadout)===JSON.stringify(r.loadout))return ok(old,"resumed");
        if(input.replace!==true)return fail("occupied","A practice is already saved. Resume it or choose to replace it.");
        if(input.expectedRevision!==old.revision)return changed();
      }else if(input.expectedRevision!=null)return changed();
      return coach(r)?store(r,previous):invalid();
    }
    function change(id,revision,restart) {
      if(!current)return fail("inactive","Open a film practice first.");
      const {r,raw}=current;
      if(read()!==raw||revision!==undefined&&revision!==r.revision)return changed();
      if(!restart&&r.status==="done")return fail("finished","This practice has ended. Retry it to play again.");
      // Work on a separate tape until both the player's action and all required coach replies are durable.
      const next={...r,pos:restart?r.origin:r.pos,moves:restart?[]:r.moves.slice(),events:restart?[]:r.events.slice(),
        status:restart?"active":r.status};
      if(!restart&&(next.pos.turn!==next.seat||!step(next,id)))return fail("move","Choose an available practice move.");
      return coach(next)?store(next,raw):invalid();
    }
    return {review,resolve,hallFilm,start,resume,get:()=>clone(current?.r||null),play:(id,revision)=>change(id,revision,false),
      retry:revision=>change(null,revision,true),get persistent(){return persistent;}};
  }
  window.WilderFilmPractice=Object.freeze({create});
})();
