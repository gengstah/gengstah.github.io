// The Twinbell register stores both sides' orders. A saved bout is rebuilt with the same doubles rules as a live round.
(() => {
  "use strict";
  const storageKey="wilderkin.twinbell.v1";
  const wardens=[
    {id:"willow",name:"Mara Reed",bell:"Willow Bell",place:"Willow Bank",
      intro:"Mara ties two willow leaves to her bell rope. Watch which lane both of her leads can reach.",
      ids:["pincoil","coalmoth","mossbell","glimmeray"],gear:{pincoil:"opening-pennant",glimmeray:"mender-wrap"}},
    {id:"crosswind",name:"Tavi Rook",bell:"Crosswind Bell",place:"Kite Terrace",
      intro:"Tavi raises a striped windsock. His flock opens with Vane and Arc. Keep a reserve ready to take their place.",
      ids:["gustlance","arcbill","icereeve","kilnbeak"],gear:{gustlance:"opening-pennant",arcbill:"seam-hook",icereeve:"relay-bell",kilnbeak:"last-stitch"}},
    {id:"kiln",name:"Iva Brass",bell:"Foundry Bell",place:"Copper Court",
      intro:"Iva taps the casting mold with a brass key. Her Ember and Alloy pair can spend three beats on Bell Foundry.",
      ids:["smelteroll","ironblink","brookpeep","cairnwatch"],gear:{smelteroll:"opening-pennant",ironblink:"seam-hook",brookpeep:"mender-wrap",cairnwatch:"relay-bell"}}
  ];
  const findKeeper=id=>wardens.find(w=>w.id===id);
  const wardenCard=id=>{const w=findKeeper(id);return w?{name:w.name,ids:w.ids.slice(),gear:{...w.gear}}:null;};
  const clone=value=>JSON.parse(JSON.stringify(value));
  function nonce(){
    const parts=new Uint32Array(2);
    if(window.crypto?.getRandomValues)window.crypto.getRandomValues(parts);
    else for(let i=0;i<parts.length;i++)parts[i]=Math.floor(Math.random()*0x100000000);
    return Array.from(parts,n=>n.toString(16).padStart(8,"0")).join("");
  }
  const ok=()=>({ok:true});
  const fail=(message,code="invalid")=>({ok:false,code,message});
  function create({game,library,sim=window.WilderTwinBattle.create({game}),storage}){
    if(storage===undefined)try{storage=window.localStorage;}catch{storage=null;}
    let persistent=!!storage,snapshot=null,record,state,prepared=null;
    const clean=card=>library.decode(library.encode(card));
    const empty=()=>({v:1,crew:library.featured()[0].card,opponent:"willow",guest:null,marks:{},run:null});
    const foe=()=>record.opponent==="guest"?record.guest:wardenCard(record.opponent);
    const alive=(p,seat,lane)=>p.sides[seat].active[lane]!=null;
    function legal(p,seat,lane,id,draft){
      return id===null?!alive(p,seat,lane):typeof id==="string"&&sim.options(p,seat,lane,draft).some(o=>o.id===id&&o.available);
    }
    function restoreRun(raw){
      const left=clean(raw?.left),right=clean(raw?.right),keeper=raw?.keeper;
      if(!left||!right||typeof raw.id!=="string"||!/^[\da-f]{16}$/.test(raw.id)||keeper!==null&&(!findKeeper(keeper)||library.encode(right)!==library.encode(wardenCard(keeper)))||
          !Array.isArray(raw.history)||raw.history.length>120)return null;
      let pos=sim.start(left,right),lastEvents=[];
      for(const orders of raw.history){
        if(!Array.isArray(orders)||orders.length!==2||!pos||pos.phase==="done")return null;
        const step=sim.resolve(pos,orders[0],orders[1]);if(!step)return null;
        pos=step.pos;lastEvents=step.events;
      }
      let draft=[null,null];
      if(pos.phase!=="done"&&Array.isArray(raw.draft)&&raw.draft.length===2&&raw.draft.every((id,lane)=>id===null||legal(pos,0,lane,id,raw.draft)))draft=raw.draft.slice();
      return {pos,lastEvents,run:{id:raw.id,left,right,keeper,history:raw.history,draft}};
    }
    function load(text){
      record=empty();state=null;prepared=null;
      if(!text||text.length>100000)return;
      try{
        const raw=JSON.parse(text);if(raw?.v!==1)return;
        record.crew=clean(raw.crew)||record.crew;const guest=clean(raw.guest);
        if(raw.opponent==="guest"&&guest){record.opponent="guest";record.guest=guest;}
        else if(findKeeper(raw.opponent))record.opponent=raw.opponent;
        for(const w of wardens){
          const mark=raw.marks?.[w.id],team=clean(mark?.team);
          if(team&&Number.isInteger(mark.rounds)&&mark.rounds>0&&mark.rounds<=120)record.marks[w.id]={team,rounds:mark.rounds};
        }
        if(raw.run){const restored=restoreRun(raw.run);if(restored){record.run=restored.run;state={pos:restored.pos,lastEvents:restored.lastEvents};}}
      }catch{/* A damaged bout can be replaced from the grounds. */}
    }
    function stored(){if(persistent)try{return storage.getItem(storageKey);}catch{persistent=false;}return snapshot;}
    snapshot=stored();load(snapshot);
    function refresh(){
      const latest=stored();if(latest===snapshot)return false;
      snapshot=latest;load(latest);return true;
    }
    function save(){
      const next=JSON.stringify(record),prefix=storageKey+".lock.";
      let lock;
      if(persistent)try{
        if(typeof storage.key==="function"&&typeof storage.removeItem==="function"){
          lock=prefix+nonce();storage.setItem(lock,String(Date.now()+10000));
          for(let i=0;i<storage.length;i++){
            const k=storage.key(i);
            if(k!==lock&&k?.startsWith(prefix)&&Number(storage.getItem(k))>Date.now()){
              snapshot=storage.getItem(storageKey);load(snapshot);
              return fail("Another tab is ringing the bell. Try your order again.","changed");
            }
          }
        }
        const actual=storage.getItem(storageKey);
        if(actual!==snapshot){snapshot=actual;load(actual);return changed();}
        storage.setItem(storageKey,next);
      }catch{persistent=false;}
      finally{if(lock)try{storage.removeItem(lock);}catch{}}
      snapshot=next;return ok();
    }
    function read(){
      refresh();
      if(!state)return null;
      if(!prepared)prepared=state.pos.phase==="done"?[null,null]:sim.coach(state.pos,1);
      return {...record.run,...state,rivalOrders:prepared.slice(),draft:record.run.draft.slice(),marks:record.marks};
    }
    const changed=()=>fail("Another tab changed the grounds. Its latest lineup and round are open.","changed");
    function begin(left,right,keeper){
      const pos=sim.start(left,right);if(!pos)return fail("Choose four different kin and legal gear on each side.");
      record.run={id:nonce(),left:clone(left),right:clone(right),keeper,history:[],draft:[null,null]};
      state={pos,lastEvents:[]};prepared=null;return save();
    }
    function start(replace=false){
      if(refresh())return changed();
      if(state&&state.pos.phase!=="done"&&!replace)return fail("A bout is in progress.","active");
      return begin(record.crew,foe(),record.opponent==="guest"?null:record.opponent);
    }
    function rematch(){
      if(refresh())return changed();
      if(!record.run||state.pos.phase!=="done")return fail("Finish this bout before ringing for a rematch.");
      const {left,right,keeper}=record.run;return begin(left,right,keeper);
    }
    function choose(card,opponent=false){
      if(refresh())return changed();
      if(opponent&&findKeeper(card)){record.opponent=card;record.guest=null;return save();}
      const checked=clean(card);if(!checked)return fail("Choose four different standard kin with valid equipment.");
      if(opponent){record.opponent="guest";record.guest=checked;}else record.crew=checked;
      return save();
    }
    function commit(action,lane,id){
      if(refresh())return changed();
      if(!state||state.pos.phase==="done")return fail("Choose a bout at the grounds.");
      const run=record.run,p=state.pos;
      if(action==="pick"||action==="clear"){
        if(![0,1].includes(lane)||!alive(p,0,lane))return fail("Choose an occupied lane.");
        const next=run.draft.slice();next[lane]=null;
        if(action==="pick"){
          if(!legal(p,0,lane,id,next))return fail("Those orders cannot be played together.");
          next[lane]=id;
          const other=1-lane;
          if(next[other]!==null&&!legal(p,0,other,next[other],next))return fail("Change the other lane’s order first.");
        }
        run.draft=next;return save();
      }
      if(action!=="round")return fail("Choose a round order.");
      const away=prepared||sim.coach(p,1),step=sim.resolve(p,run.draft,away,{frames:true});
      if(!step)return fail("Choose a legal order for each standing lead before ringing the bell.");
      run.history.push([run.draft.slice(),away.slice()]);run.draft=[null,null];
      state={pos:step.pos,lastEvents:step.events};prepared=null;
      if(step.pos.phase==="done"&&step.pos.winner===0&&run.keeper){
        const old=record.marks[run.keeper];
        if(!old||run.history.length<old.rounds)record.marks[run.keeper]={rounds:run.history.length,team:clone(run.left)};
      }
      const saved=save();return saved.ok?{...saved,frames:step.frames}:saved;
    }
    function desk(){refresh();return {crew:record.crew,opponent:record.opponent,foe:foe(),marks:record.marks,
      active:state?.pos.phase==="plan",played:!!state,persistent};}
    return {read,desk,start,rematch,choose,commit,refresh};
  }
  window.WilderTwinMatch=Object.freeze({create,wardens,wardenCard,storageKey});
})();
