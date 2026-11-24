// Scout letters extend an immutable public transcript. Unrevealed host choices stay on their own desk.
(() => {
  "use strict";
  const prefix="#scout-v1=",storePrefix="wilderkin.scout.v1.",indexKey=storePrefix+"index";
  const lengths=[2,4,7,9,11],statuses=["invite","registered","scouted","locked","ready"];
  const token=/^[a-f0-9]{24}$/,salt=/^[a-f0-9]{32}$/,commitment=/^[a-f0-9]{64}$/;
  const kinId=/^[a-z][a-z0-9-]{0,39}$/,pickCode=/^[0-3]{3}$/;
  const fail=(code,message)=>({ok:false,code,message});
  const success=(record,message,code="updated")=>({ok:true,id:record.id,record,message,code});
  const unavailable=()=>fail("crypto","Scout Table needs secure browser randomness and SHA-256. Open the game over HTTPS or localhost.");
  const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
  function create({game,storage}) {
    const kit=window.WilderSparringGear,crypto=window.crypto;
    const secure=typeof crypto?.getRandomValues==="function" && typeof crypto?.subtle?.digest==="function";
    if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
    let persistent=!!storage;
    const memory=new Map();
    const random=bytes=>hex(crypto.getRandomValues(new Uint8Array(bytes)));
    async function digest(purpose,...parts) {
      // The packet alphabet is ASCII. Domain separation binds each commitment to its match and purpose.
      const input=["Wilderkin Scout","v1",purpose,...parts].join("|");
      const bytes=Uint8Array.from(input,c=>c.charCodeAt(0));
      return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)));
    }
    function pool(value) {
      if(!value||!Array.isArray(value.ids)||value.ids.length!==4||new Set(value.ids).size!==4||
          !Array.from(value.ids).every(id=>typeof id==="string"&&kinId.test(id)&&Object.hasOwn(game.species,id)&&!game.species[id].bonus))return null;
      const ids=value.ids.slice().sort();
      const fitted=kit.validate({left:value.gear===undefined?{}:value.gear},ids,[]);
      return fitted?{ids,gear:fitted.left}:null;
    }
    function pack(team) {
      return team.ids.map(id=>team.gear[id]?id+"~"+team.gear[id]:id).join(",");
    }
    function unpack(field) {
      const slots=field.split(","),ids=[],gear={};
      if(slots.length!==4)return null;
      for(const slot of slots){
        const parts=slot.split("~"),id=parts[0];
        if(!kinId.test(id)||parts.length>2||parts.length===2&&!kit.byId(parts[1]))return null;
        ids.push(id);
        if(parts.length===2)gear[id]=parts[1];
      }
      const team=pool({ids,gear});
      return team&&pack(team)===field?team:null;
    }
    function selection(team,ids) {
      if(!team||!Array.isArray(ids)||ids.length!==3||new Set(ids).size!==3||
          !Array.from(ids).every(id=>team.ids.includes(id)))return null;
      return ids.map(id=>team.ids.indexOf(id)).join("");
    }
    function picks(team,code) {
      return team&&pickCode.test(code)&&new Set(code).size===3?Array.from(code,n=>team.ids[Number(n)]):null;
    }
    function dressed(team,ids) {
      return {ids:ids.slice(),gear:Object.fromEntries(ids.filter(id=>team.gear[id]).map(id=>[id,team.gear[id]]))};
    }
    function parse(hash) {
      if(typeof hash!=="string"||hash.length>1024||!hash.startsWith(prefix)||!/^[A-Za-z0-9.,~-]+$/.test(hash.slice(prefix.length)))return null;
      const f=hash.slice(prefix.length).split("."),stage=lengths.indexOf(f.length);
      if(stage<0||!token.test(f[0])||!commitment.test(f[1]))return null;
      const rosters=[null,null],chosen=[null,null];
      if(stage>=1 && (!token.test(f[2])||f[2]===f[0]||!(rosters[1]=unpack(f[3]))))return null;
      if(stage>=2 && (!(rosters[0]=unpack(f[4]))||!salt.test(f[5])||!commitment.test(f[6])))return null;
      if(stage>=3 && (!(chosen[1]=picks(rosters[1],f[7]))||!salt.test(f[8])))return null;
      if(stage>=4 && (!(chosen[0]=picks(rosters[0],f[9]))||!salt.test(f[10])))return null;
      let battle=null;
      if(stage===4){
        // Neither party knows the other's 128-bit salt when it commits its own. XOR their low bits.
        const first=(parseInt(f[8].slice(-1),16)^parseInt(f[10].slice(-1),16))&1;
        battle={id:f[0],guestId:f[2],teams:rosters.map((team,i)=>dressed(team,chosen[i])),first};
      }
      return {id:f[0],guestId:f[2]||null,seat:null,stage,status:statuses[stage],rosters,picks:chosen,battle,hash,archived:false};
    }
    async function verifies(record) {
      const f=record.hash.slice(prefix.length).split(".");
      if(record.stage>=2&&await digest("registration",f[0],f[4],f[5])!==f[1])return false;
      if(record.stage===4&&await digest("lineup",...f.slice(0,6),f[9],f[10])!==f[6])return false;
      return true;
    }
    async function inspect(hash) {
      const record=parse(hash);
      if(!record)return null;
      try{return await verifies(record)?record:null;}catch{return null;}
    }
    function read(key) {
      if(persistent)try{
        const value=storage.getItem(key);
        if(value===null)memory.delete(key);else memory.set(key,value);
        return value;
      }catch{persistent=false;}
      return memory.get(key)??null;
    }
    function write(key,value) {
      if(persistent)try{storage.setItem(key,value);}catch{persistent=false;}
      memory.set(key,value);
    }
    function ids() {
      const all=new Set();
      try{
        const index=JSON.parse(read(indexKey)||"[]");
        if(Array.isArray(index))for(const id of index)if(typeof id==="string"&&token.test(id))all.add(id);
        for(let i=0;persistent&&i<storage.length;i++){
          const key=storage.key(i);
          if(key?.startsWith(storePrefix)&&token.test(key.slice(storePrefix.length)))all.add(key.slice(storePrefix.length));
        }
      }catch{}
      for(const key of memory.keys())if(key.startsWith(storePrefix)&&token.test(key.slice(storePrefix.length)))all.add(key.slice(storePrefix.length));
      return [...all];
    }
    function entry(id) {
      if(typeof id!=="string"||!token.test(id))return null;
      const text=read(storePrefix+id);
      if(!text||text.length>3072)return null;
      try{
        const e=JSON.parse(text),r=parse(e.hash);
        if(!r||r.id!==id||(e.seat!==0&&e.seat!==1)||e.seat===1&&r.stage===0)return null;
        if(e.seat===0){
          const own=unpack(e.home);
          if(!own||!salt.test(e.poolSalt)||r.stage>=2&&(pack(r.rosters[0])!==e.home||!picks(own,e.chosen)||!salt.test(e.pickSalt)))return null;
          r.rosters[0]=own;
          if(r.stage>=2)r.picks[0]=picks(own,e.chosen);
        }
        r.seat=e.seat;r.archived=e.archived===true;
        return {e,r};
      }catch{return null;}
    }
    const get=id=>entry(id)?.r||null;
    function persist(e,previous,message) {
      const id=parse(e.hash).id,lockPrefix="wilderkin.scout.lock."+id+".";
      // Separate intent keys avoid lost updates even across windows without a shared JS event loop.
      const canLock=persistent&&secure&&typeof storage.removeItem==="function"&&typeof storage.key==="function";
      let lock;
      try{
        if(canLock){
          try{
            lock=lockPrefix+random(12);storage.setItem(lock,String(Date.now()+30000));
            for(let i=0;i<storage.length;i++){
              const key=storage.key(i);
              if(key!==lock&&key?.startsWith(lockPrefix)&&Number(storage.getItem(key))>Date.now())
                return fail("changed","Another tab is recording this table. Reopen its latest letter.");
            }
          }catch{persistent=false;}
        }
        const current=entry(id);
        if((current?.e.hash??null)!==(previous?.hash??null)||Boolean(current?.r.archived)!==Boolean(previous?.archived))
          return fail("changed","Another tab updated this table. Reopen its latest letter.");
        write(storePrefix+id,JSON.stringify(e));
        if(!current)write(indexKey,JSON.stringify(ids()));
        return success(get(id),message);
      }finally{if(lock)try{storage.removeItem(lock);}catch{}}
    }
    const append=(hash,...fields)=>hash+"."+fields.join(".");
    function freshId(excluded) {
      for(let i=0;i<8;i++){const id=random(12);if(id!==excluded&&!read(storePrefix+id))return id;}
      return null;
    }
    async function invite(roster) {
      if(!secure)return unavailable();
      const team=pool(roster);
      if(!team)return fail("team","Register four different standard kin with legal equipment.");
      try{
        const id=freshId(),poolSalt=random(16),home=pack(team);
        if(!id)return fail("identity","A fresh table identity could not be made. Try again.");
        const seal=await digest("registration",id,home,poolSalt);
        return persist({seat:0,hash:prefix+id+"."+seal,home,poolSalt},null,"Your four are sealed. Send the invitation.");
      }catch{return unavailable();}
    }
    async function join(hash,roster) {
      if(!secure)return unavailable();
      const ticket=await inspect(hash),team=pool(roster);
      if(ticket?.stage!==0)return fail("invitation","Open the original sealed invitation to register.");
      if(!team)return fail("team","Register four different standard kin with legal equipment.");
      const current=entry(ticket.id);
      if(current){
        if(!current.r.archived&&current.r.seat===1&&current.r.hash.startsWith(hash+".")&&pack(current.r.rosters[1])===pack(team))
          return success(current.r,"This browser has already registered.","duplicate");
        return fail("occupied","This browser already holds a seat at that table.");
      }
      try{
        const guest=freshId(ticket.id);
        if(!guest)return fail("identity","A fresh guest identity could not be made. Try again.");
        return persist({seat:1,hash:append(hash,guest,pack(team))},null,"Your four are registered. Return the letter to the host.");
      }catch{return unavailable();}
    }
    async function lock(id,ids) {
      if(!secure)return unavailable();
      const current=entry(id);
      if(!current||current.r.archived)return fail("inactive","Open your active scouting table.");
      const {e,r}=current,code=selection(r.rosters[r.seat],ids);
      if(!code)return fail("picks","Choose three different registered kin in battle order.");
      if(r.picks[r.seat]){
        if(selection(r.rosters[r.seat],r.picks[r.seat])===code)return success(r,"Your trio is already locked.","duplicate");
        return fail("locked","Your trio has already been locked.");
      }
      try{
        if(e.seat===0&&r.stage===1){
          const base=append(e.hash,e.home,e.poolSalt),fields=base.slice(prefix.length).split(".");
          if(await digest("registration",r.id,e.home,e.poolSalt)!==fields[1])return fail("invalid","This desk cannot open its original registration.");
          const pickSalt=random(16),seal=await digest("lineup",...fields,code,pickSalt);
          return persist({...e,chosen:code,pickSalt,hash:append(base,seal)},e,"Your trio is sealed. Send the revealed four to your guest.");
        }
        if(e.seat===1&&r.stage===2)
          return persist({...e,hash:append(e.hash,code,random(16))},e,"Your trio is locked. Return the letter for the host’s reveal.");
        return fail("turn","Wait for your friend’s next scouting letter.");
      }catch{return unavailable();}
    }
    async function receive(hash) {
      if(!secure)return unavailable();
      const next=await inspect(hash);
      if(!next)return fail("invalid","This scouting letter is incomplete or its seal does not match.");
      const current=entry(next.id);
      if(!current)return fail("spectator","This letter is public. Only an explicit registration takes a seat.");
      const {e,r}=current;
      if(hash===e.hash)return success(r,"Your desk already has this letter.","duplicate");
      if(r.archived)return fail("archived","This table is archived on your desk.");
      if(e.hash.startsWith(hash+".")){
        if(e.seat===0&&r.stage===4&&next.stage===3)return success(r,"Your final reveal is ready to resend.","duplicate");
        return fail("stale","Your desk already has a later scouting letter.");
      }
      if(!hash.startsWith(e.hash+"."))return fail("fork","This letter comes from another registration or choice.");
      if(next.stage!==r.stage+1||next.stage%2===e.seat)
        return fail("seat","The letter skips a choice that belongs to this browser.");
      let accepted=hash;
      if(e.seat===0&&next.stage===3){
        accepted=append(hash,e.chosen,e.pickSalt);
        if(!await inspect(accepted))return fail("invalid","This desk cannot open its sealed trio.");
      }
      return persist({...e,hash:accepted},e,next.stage>=3?"The charter is ready. Both trios and the opening seat are fixed.":"Your friend’s registration is here.");
    }
    function archive(id) {
      const current=entry(id);
      if(!current)return fail("inactive","Open a table from this desk.");
      if(current.r.archived)return success(current.r,"This table is already archived.","duplicate");
      return persist({...current.e,archived:true},current.e,"This table is archived on your desk.");
    }
    return {invite,join,lock,receive,inspect,get,archive,list:()=>ids().map(get).filter(r=>r&&!r.archived),
      export:id=>get(id)?.hash||null,secure,get persistent(){return persistent;}};
  }
  window.WilderScoutRules=Object.freeze({create});
})();
