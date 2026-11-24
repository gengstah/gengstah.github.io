// Bellpost links carry both public trios and a deterministic Hall replay. The local desk owns its seat.
(() => {
  "use strict";
  const prefix="#bellpost-v1=",storePrefix="wilderkin.bellpost.v1.",indexKey=storePrefix+"index";
  const tokenRE=/^[0-9a-f]{24}$/,speciesRE=/^[a-z][a-z0-9-]{0,39}$/;
  // These positions form the version-1 wire alphabet. Append new commands under a new version.
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVW";
  const targetMoves=["swap","duet","replace","shelter","beacon","slipstream"];
  const equipment=["relay-bell","last-stitch","seam-hook","mender-wrap","prism-lens","opening-pennant"];
  const maxMoves=64,limit=512;
  const fail=(code,message)=>({ok:false,code,message});
  const success=(record,message,code="updated")=>({ok:true,id:record.id,record,code,message});
  function nonce() {
    const bytes=new Uint8Array(12);
    if(window.crypto?.getRandomValues)window.crypto.getRandomValues(bytes);
    else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
    return Array.from(bytes,n=>n.toString(16).padStart(2,"0")).join("");
  }
  function create({game,storage}) {
    const species=game.species,sim=window.WilderSparringBattle.create({species}),kit=window.WilderSparringGear;
    if(storage===undefined){try{storage=window.localStorage;}catch{storage=null;}}
    let persistent=!!storage;
    const memory=new Map(),unsaved=new Set(),seen=new Map();
    const writer=nonce();
    function getText(key) {
      if(storage && !unsaved.has(key))try{
        const value=storage.getItem(key);
        if(value!=null)memory.set(key,value);
        return value;
      }catch{persistent=false;}
      return memory.get(key)??null;
    }
    function setText(key,value) {
      if(persistent)try{storage.setItem(key,value);}catch{persistent=false;}
      if(!persistent)unsaved.add(key);
      memory.set(key,value);
    }
    function ids() {
      const set=new Set();
      try{
        const list=JSON.parse(getText(indexKey)||"[]");
        if(Array.isArray(list))for(const id of list)if(typeof id==="string"&&tokenRE.test(id))set.add(id);
        // Real localStorage is independently indexed per match. Concurrent creations never hide one another.
        for(let i=0;storage && i<storage.length;i++){
          const key=storage.key(i);
          if(key?.startsWith(storePrefix) && tokenRE.test(key.slice(storePrefix.length)))set.add(key.slice(storePrefix.length));
        }
      }catch{}
      for(const key of memory.keys())if(key.startsWith(storePrefix)&&tokenRE.test(key.slice(storePrefix.length)))set.add(key.slice(storePrefix.length));
      return [...set];
    }
    function loadout(value) {
      if(!value || !Array.isArray(value.ids) || value.ids.length!==3 || new Set(value.ids).size!==3 ||
          !Array.from(value.ids).every(id=>typeof id==="string" && speciesRE.test(id) && Object.hasOwn(species,id) && !species[id].bonus))return null;
      const fitting=kit.validate({left:value.gear===undefined?{}:value.gear},value.ids,[]);
      return fitting?{ids:value.ids.slice(),gear:fitting.left}:null;
    }
    function packTeam(t) {
      return t.ids.map(id=>id+(t.gear[id]?"~"+equipment.indexOf(t.gear[id]):"")).join(",");
    }
    function unpackTeam(code) {
      const slots=code.split(",");
      if(slots.length!==3)return null;
      const ids=[],gear={};
      for(const slot of slots){
        const parts=slot.split("~");
        if(parts.length>2||!speciesRE.test(parts[0])||parts.length===2&&!/^[0-5]$/.test(parts[1]))return null;
        ids.push(parts[0]);
        if(parts.length===2)gear[parts[0]]=equipment[Number(parts[1])];
      }
      return loadout({ids,gear});
    }
    function commandCode(pos,id) {
      const [kind,arg]=id.split(":"),side=pos.sides[pos.turn];
      if(kind==="skill"){
        const skills=species[side.team[side.active].id].skills.filter(s=>!s.trained);
        const slot=skills.findIndex(s=>s.id===arg);
        return slot>=0&&slot<4?alphabet[slot]:null;
      }
      if(kind==="stance"&&arg==="thorn-read")return alphabet[4];
      const group=targetMoves.indexOf(kind),slot=side.team.findIndex(p=>p.id===arg);
      return group>=0&&slot>=0?alphabet[5+3*group+slot]:null;
    }
    function pack(id,left,visitor,right,tape="",resigned) {
      return prefix+[id,packTeam(left),visitor||"",right?packTeam(right):"",tape,resigned??""].join(".");
    }
    function decode(hash,events) {
      if(typeof hash!=="string"||hash.length>limit||!hash.startsWith(prefix))return null;
      const fields=hash.slice(prefix.length).split(".");
      if(fields.length<2||fields.length>6)return null;
      // Chat clients can strip the final dots from older letters. Only the four optional fields may be empty.
      while(fields.length<6)fields.push("");
      for(let i=2;i<fields.length;i++)if(fields[i]==="x")fields[i]="";
      hash=prefix+fields.join(".");
      const [id,a,guest,b,commands,flag]=fields;
      if(!tokenRE.test(id)||commands.length>maxMoves||!/^[A-W]*$/.test(commands)||!/^([01])?$/.test(flag))return null;
      const left=unpackTeam(a),right=b?unpackTeam(b):null;
      if(!left || (b ? !right||!tokenRE.test(guest) : guest||commands||flag))return null;
      let pos=null,lastMove=null;
      const moves=[];
      if(right){
        pos=sim.start(left.ids,right.ids,0,{left:left.gear,right:right.gear});
        if(!pos)return null;
        for(const c of commands){
          const move=sim.options(pos).find(m=>m.available && commandCode(pos,m.id)===c);
          if(!move)return null;
          const after=sim.apply(pos,move.id);
          if(!after)return null;
          if(events)events.push({before:pos,move,after});
          moves.push(move.id);pos=after;lastMove=move;
        }
      }
      const resigned=flag===""?undefined:Number(flag);
      if(resigned!==undefined && (pos.phase==="done"||pos.turn!==resigned))return null;
      const winner=resigned===undefined?pos?.winner??null:1-resigned;
      return {id,guestId:guest||null,seat:null,teams:[left,right],first:0,moves,pos,winner,hash,
        status:!right?"invite":winner===null?"active":"done",incomplete:winner===null&&lastMove?.kind==="replace",
        ...(resigned===undefined?{}:{resigned})};
    }
    function get(id) {
      if(typeof id!=="string"||!tokenRE.test(id))return null;
      const raw=getText(storePrefix+id);
      if(!raw)return null;
      try{
        const entry=JSON.parse(raw);
        if(entry.seat!==0 && entry.seat!==1)return null;
        const record=decode(entry.hash);
        if(!record||record.id!==id || entry.seat===1 && !record.teams[1])return null;
        record.seat=entry.seat;record.archived=entry.archived===true;
        return record;
      }catch{return null;}
    }
    function remember(record) {
      if(record)seen.set(record.id,record.hash);
      return record;
    }
    function store(record,seat,old,archived=false) {
      // Other tabs can submit the very same revision at once. Publish intent before comparing it.
      // Contending writes can retry. An abandoned intent expires after the synchronous write window.
      const lockPrefix="wilderkin.bellpost.lock."+record.id+".",lock=lockPrefix+writer;
      const canLock=persistent && typeof storage.removeItem==="function" && typeof storage.key==="function";
      try {
        if(canLock){
          try {
            const now=Date.now();
            storage.setItem(lock,String(now+30000));
            for(let i=0;i<storage.length;i++){
              const key=storage.key(i);
              if(key!==lock && key?.startsWith(lockPrefix) && Number(storage.getItem(key))>now)
                return fail("changed","Another tab is recording this move. Reopen its latest turn.");
            }
          }catch{persistent=false;}
        }
        return saveRevision(record,seat,old,archived);
      } finally {
        if(canLock)try{storage.removeItem(lock);}catch{}
      }
    }
    function saveRevision(record,seat,old,archived) {
      const prior=get(record.id);
      if((old?.hash??null)!==(prior?.hash??null) || Boolean(old?.archived)!==Boolean(prior?.archived))
        return fail("changed","Another tab updated this match. Reopen its latest turn.");
      setText(storePrefix+record.id,JSON.stringify({seat,hash:record.hash,archived}));
      if(!prior)setText(indexKey,JSON.stringify(ids()));
      record.seat=seat;record.archived=archived;
      remember(record);
      return success(record,"Match saved.");
    }
    function inspect(hash) {
      const r=decode(hash);
      if(!r)return null;
      const local=get(r.id);
      if(local?.hash===r.hash){r.seat=local.seat;r.archived=local.archived;}
      return r;
    }
    function forSharing(hash) {
      const record=decode(hash);
      if(!record)return null;
      return prefix+record.hash.slice(prefix.length).split(".").map(field=>field||"x").join(".");
    }
    function invite(team) {
      const left=loadout(team);
      if(!left)return fail("team","Choose three different standard kin and legal equipment.");
      let id=nonce();
      for(let tries=0;get(id)&&tries<5;tries++)id=nonce();
      return store(decode(pack(id,left)),0,null);
    }
    function join(hash,team) {
      const ticket=decode(hash),right=loadout(team);
      if(ticket?.status!=="invite")return fail("invitation","Open the host’s original invitation to join.");
      if(!right)return fail("team","Choose three different standard kin and legal equipment.");
      const local=get(ticket.id);
      if(local){
        if(local.seat===1 && !local.archived && packTeam(local.teams[0])===packTeam(ticket.teams[0]) &&
            packTeam(local.teams[1])===packTeam(right))return success(remember(local),"This browser has already joined.","duplicate");
        return fail("occupied","This browser already has a seat for that match.");
      }
      const record=decode(pack(ticket.id,ticket.teams[0],nonce(),right));
      return store(record,1,null);
    }
    function receive(hash) {
      const events=[],incoming=decode(hash,events);
      if(!incoming)return fail("invalid","This Bellpost letter is incomplete or contains an illegal move.");
      const current=get(incoming.id);
      if(!current)return fail("spectator","This browser is viewing the public match. Open its invitation to join.");
      if(current.hash===incoming.hash)return success(remember(current),"Your desk already has this letter.","duplicate");
      if(current.archived)return fail("archived","This match is closed on your desk.");
      if(packTeam(incoming.teams[0])!==packTeam(current.teams[0]) ||
          current.guestId && incoming.guestId && (incoming.guestId!==current.guestId || packTeam(incoming.teams[1])!==packTeam(current.teams[1])))
        return fail("fork","This letter belongs to a different lineup or guest.");
      if(current.guestId&&!incoming.guestId)return fail("stale","Your desk already has a later letter.");
      const common=Math.min(current.moves.length,incoming.moves.length);
      if(current.moves.some((m,i)=>i<common&&m!==incoming.moves[i]))return fail("fork","This letter follows a different sequence of moves.");
      if(incoming.moves.length<current.moves.length || current.resigned!==undefined && incoming.resigned===undefined && incoming.moves.length===current.moves.length)
        return fail("stale","Your desk already has a later letter.");
      if(current.status==="done")return fail("fork","This match already has a final result.");
      const remote=1-current.seat;
      if(events.slice(common).some(e=>e.before.turn!==remote)||incoming.resigned!==undefined&&incoming.resigned!==remote)
        return fail("seat","The return letter contains a move belonging to your seat.");
      if(incoming.incomplete)return fail("incomplete","Your friend still has an action after the free replacement.");
      return store(incoming,current.seat,current);
    }
    function change(id,moveId,resign,expectedHash) {
      const r=get(id);
      if(!r||r.archived||r.status!=="active")return fail("inactive","Open an active match from your desk.");
      const expected=expectedHash??seen.get(id)??r.hash;
      if(expected!==r.hash && decode(expected)?.hash!==r.hash)return fail("changed","Another tab updated this match. Reopen its latest turn.");
      if(r.pos.turn!==r.seat)return fail("turn","Wait for your friend’s next letter.");
      const fields=r.hash.slice(prefix.length).split(".");
      if(resign)fields[5]=String(r.seat);
      else {
        const move=typeof moveId==="string"&&sim.forecast(r.pos,moveId);
        if(!move?.available)return fail("move",move?.reason||"Choose a legal move for this turn.");
        const code=commandCode(r.pos,moveId);
        if(!code)return fail("move","This move has no Bellpost command.");
        fields[4]+=code;
      }
      const next=decode(prefix+fields.join("."));
      return next?store(next,r.seat,r):fail("invalid","This move cannot be recorded.");
    }
    function close(id,withdraw=false) {
      const r=get(id);
      if(!r || (withdraw ? r.seat!==0||r.status!=="invite" : r.status!=="done"))
        return fail("active",withdraw?"Only an outstanding host invitation can be withdrawn.":"Finish the active match before archiving it.");
      return store(r,r.seat,r,true);
    }
    function exportHash(id) {
      const r=get(id);
      if(!r)return null;
      if(!r.incomplete)return r.hash;
      const fields=r.hash.slice(prefix.length).split(".");
      fields[4]=fields[4].slice(0,-1);
      return prefix+fields.join(".");
    }
    function review(idOrHash) {
      const hash=typeof idOrHash==="string"&&idOrHash.startsWith(prefix)?idOrHash:get(idOrHash)?.hash;
      const events=[],record=decode(hash,events);
      if(!record?.pos)return null;
      const local=get(record.id);
      if(local?.hash===record.hash)record.seat=local.seat;
      return {record,events,final:record.pos};
    }
    return {invite,join,receive,inspect,forSharing,get:id=>remember(get(id)),list:()=>ids().map(get).filter(r=>r&&!r.archived),
      play:(id,move,hash)=>change(id,move,false,hash),resign:(id,hash)=>change(id,null,true,hash),
      archive:id=>close(id),withdraw:id=>close(id,true),export:exportHash,review,get persistent(){return persistent;}};
  }
  window.WilderBellpostRules=Object.freeze({create});
})();
