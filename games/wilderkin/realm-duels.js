// Live realm exhibitions use the Hall's level-20 rules and an independently replayed command tape at each seat.
(() => {
  "use strict";
  const storageKey="wilderkin.realm-duel.v1",inviteMs=45000,graceMs=45000,saveMs=90000,retryMs=4500;
  const token=/^[0-9a-f]{24}$/,sealPattern=/^[0-9a-f]{64}$/,tapePattern=/^[A-Z2]{0,64}$/;
  const peerId=id=>typeof id==="string"&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
  const isToken=id=>typeof id==="string"&&token.test(id);
  const equal=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
  const fail=message=>({ok:false,message});
  function nonce(){
    const bytes=new Uint8Array(12);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes,n=>n.toString(16).padStart(2,"0")).join("");
  }
  async function seal(id,secret,team){
    const text=["Wilderkin realm duel v1",id,secret,...team].join("/");
    const bytes=Uint8Array.from(text,c=>c.charCodeAt(0));
    const digest=await window.crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,"0")).join("");
  }
  function create({game,send,onChange=()=>{},canInvite=()=>true,now=Date.now,storage,row,image}){
    if(storage===undefined){try{storage=window.sessionStorage;}catch{storage=null;}}
    row??=((id,label,value,detail="",extra={})=>({id,label,value,detail,...extra}));
    image??=(id=>window.WilderKinDex.spriteUrl(id));
    const sim=window.WilderSparringBattle.create({game}),codec=window.WilderBellpostRules.create({game,storage:null}).filmCodec;
    const arena=window.WilderBellpostArena.create({game,row,image});
    const closed=new Map(),invited=new Map(),declined=new Map();
    let self=null,s=null,panel="",film=null,lastNotice="",savedAt=0;

    const secure=()=>!!window.crypto?.getRandomValues&&!!window.crypto?.subtle?.digest;
    const standard=id=>typeof id==="string"&&Object.hasOwn(game.species,id)&&!game.species[id].bonus;
    const valid=ids=>Array.isArray(ids)&&ids.length===3&&new Set(ids).size===3&&Array.from(ids).every(standard);
    function team(){
      const order=[game.state.lead,...game.state.team,...game.state.party.map(p=>p.id)];
      return Array.from(new Set(order.filter(id=>standard(id)&&game.state.party.some(p=>p.id===id)))).slice(0,3);
    }
    const owned=ids=>valid(ids)&&ids.every(id=>game.state.party.some(p=>p.id===id));
    function empty(peer,id,seat){
      return {peer,id,seat,phase:seat?"incoming":"outgoing",expiresAt:now()+inviteMs,away:null,local:[],remote:[],
        secret:null,seal:null,guest:null,pos:null,tape:"",moves:[],yields:0,abandoned:false,lastSent:-Infinity,lastPeer:now(),acked:false,confirmed:false,verifying:false};
    }
    function result(){
      if(!s||s.phase!=="done")return null;
      if(s.abandoned)return "no-contest";
      const won=winner();
      return won==="draw"?"draw":won===s.seat?"win":"loss";
    }
    function winner(){return s.pos?.winner??(s.yields===3?"draw":s.yields===1?1:s.yields===2?0:null);}
    function record(){
      if(!s?.pos)return null;
      const ids=s.seat?[s.remote,s.local]:[s.local,s.remote],won=winner();
      return {id:s.id,protocol:3,first:s.pos.first,seat:s.seat,teams:ids.map(ids=>({ids:ids.slice(),gear:{}})),
        labels:s.seat?["Opponent","You"]:["You","Opponent"],pos:s.pos,moves:s.moves.slice(),status:s.phase==="done"?"done":"active",
        winner:won,...(s.yields===1||s.yields===2?{resigned:s.yields===1?0:1}:{})};
    }
    function read(){
      return {phase:s?.phase||"idle",peer:s?.peer||null,id:s?.id||null,online:s?.away==null,expiresAt:s?.expiresAt||0,
        locking:!!s?.guest&&s.phase==="incoming",localTeam:s?.local.slice()||[],remoteTeam:s?.remote.slice()||[],record:record(),result:result(),message:lastNotice};
    }
    function save(){
      savedAt=now();
      if(!self||!storage)return;
      try{
        if(!s||!["active","done"].includes(s.phase)||!s.pos)storage.removeItem(storageKey);
        else{
          const {peer,id,seat,secret,seal,guest,local,remote,tape,yields,abandoned,away}=s;
          storage.setItem(storageKey,JSON.stringify({at:savedAt,self,peer,id,seat,secret,seal,guest,local,remote,tape,yields,abandoned,away}));
        }
      }catch{ /* A live duel still works without tab storage. */ }
    }
    function changed(text){
      if(text!==undefined)lastNotice=text;
      save();onChange(read());
    }
    function reset(text){s=null;panel="";film=null;changed(text);}
    function sendTo(peer,id,op,body={}){
      try{return send(peer,{kind:"duel",v:1,id,op,...body})!==false;}catch{return false;}
    }
    function keep(map,key,value){
      if(map.has(key))map.delete(key);
      map.set(key,value);
      if(map.size>128)map.delete(map.keys().next().value);
    }
    function later(peer,id,op,body={}){
      keep(closed,id,{peer,op,body,until:now()+saveMs,sent:now()});
    }
    function endNotice(text,reply){
      const {peer,id}=s;
      if(reply){later(peer,id,reply);sendTo(peer,id,reply);}
      else later(peer,id,null);
      reset(text);
    }
    function frame(){
      return {guest:s.guest,tape:s.tape,yielded:!!(s.yields&(1<<s.seat)),...(s.seat===0?{team:s.local.slice(),open:s.secret}:{})};
    }
    function transmit(){
      if(!s)return;
      s.lastSent=now();
      if(s.pos&&!s.abandoned)sendTo(s.peer,s.id,"turn",frame());
      else if(s.phase==="outgoing"&&s.seal)sendTo(s.peer,s.id,"offer",{seal:s.seal});
      else if(s.phase==="incoming"&&s.guest)sendTo(s.peer,s.id,"join",{guest:s.guest,team:s.local.slice()});
    }
    function establish(){
      const sides=s.seat?[s.remote,s.local]:[s.local,s.remote];
      const first=(parseInt(s.secret.slice(-2),16)^parseInt(s.guest.slice(-2),16))&1;
      s.pos=sim.start(sides[0],sides[1],first,undefined,3);
      s.phase="active";s.acked=false;s.expiresAt=0;panel="";film=null;
    }
    function resume(id){
      if(!peerId(id))return read();
      if(s&&self===id)return read();
      self=id;s=null;panel="";film=null;
      let raw;
      try{
        const value=storage?.getItem(storageKey);
        if(value&&value.length<=1024)raw=JSON.parse(value);
      }catch{}
      if(raw?.self===self&&peerId(raw.peer)&&raw.peer!==self&&Number.isSafeInteger(raw.at)&&raw.at<=now()&&now()-raw.at<saveMs&&
          isToken(raw.id)&&isToken(raw.secret)&&isToken(raw.guest)&&typeof raw.seal==="string"&&sealPattern.test(raw.seal)&&
          [0,1].includes(raw.seat)&&owned(raw.local)&&valid(raw.remote)&&typeof raw.tape==="string"&&tapePattern.test(raw.tape)&&
          Number.isInteger(raw.yields)&&raw.yields>=0&&raw.yields<=3&&typeof raw.abandoned==="boolean"&&
          (raw.away==null||Number.isSafeInteger(raw.away)&&raw.away>=0&&raw.away<=now())){
        s=Object.assign(empty(raw.peer,raw.id,raw.seat),{local:raw.local,remote:raw.remote,secret:raw.secret,seal:raw.seal,guest:raw.guest});
        establish();
        if(applyTape(raw.tape,null)){
          s.yields=raw.yields;s.abandoned=raw.abandoned||(raw.away!=null&&now()-raw.away>=graceMs);
          s.phase=winner()!==null||s.abandoned?"done":"active";
          if(s.phase==="active")s.away=raw.away??now();
          changed(s.phase==="done"?"Your last duel result.":"Rejoining your duel.");transmit();return read();
        }
      }
      s=null;save();return read();
    }
    function invite(peer,ids=team()){
      if(!peerId(peer)||peer===self||!canInvite(peer,"outgoing"))return fail("Choose an available traveler nearby.");
      if(s)return fail("Finish the current invitation or duel first.");
      if(!owned(ids))return fail("Choose three different companions from your collection.");
      if(!secure())return fail("Open Wilderkin on HTTPS to invite a traveler.");
      if((invited.get(peer)||0)>now())return fail("Give this traveler a moment before inviting them again.");
      const match=empty(peer,nonce(),0);
      match.local=ids.slice();match.secret=nonce();s=match;keep(invited,peer,now()+30000);changed("Duel invitation sent.");
      seal(match.id,match.secret,match.local).then(value=>{
        if(s===match&&s.phase==="outgoing"){s.seal=value;transmit();}
      }).catch(()=>{if(s===match)reset("This browser could not seal your trio.");});
      return {ok:true};
    }
    function accept(ids=team()){
      if(s?.phase!=="incoming"||s.guest)return fail("Open a waiting duel invitation.");
      if(now()>=s.expiresAt){endNotice("The invitation expired.","decline");return fail(lastNotice);}
      if(!canInvite(s.peer,"accept")||s.away!==null)return fail("Rejoin the same trail before accepting.");
      if(!owned(ids))return fail("Choose three different companions from your collection.");
      if(!secure())return fail("Open Wilderkin on HTTPS to join a duel.");
      s.guest=nonce();s.local=ids.slice();changed("Trio locked. Waiting for the challenger.");transmit();
      return {ok:true};
    }
    function decline(){
      if(s?.phase!=="incoming")return fail("There is no invitation to decline.");
      keep(declined,s.peer,now()+60000);endNotice("Invitation declined.","decline");return {ok:true};
    }
    function cancel(){
      if(s?.phase!=="outgoing")return fail("There is no invitation to cancel.");
      endNotice("Invitation withdrawn.","cancel");return {ok:true};
    }
    // Stage all remote decisions in a detached position. A forged later
    // decision must never leave the valid prefix applied to the local seat.
    function applyTape(tape,actor){
      if(!tape.startsWith(s.tape))return false;
      let p=s.pos;const moves=[];
      for(const code of tape.slice(s.tape.length)){
        if(p.phase==="done"||actor!==null&&p.turn!==actor)return false;
        const move=codec.readCommand(p,code,3);
        if(!move)return false;
        p=sim.apply(p,move.id);if(!p)return false;
        moves.push(move.id);
      }
      s.pos=p;s.moves.push(...moves);s.tape=tape;
      return true;
    }
    function sync(msg){
      if(s.abandoned||msg.guest!==s.guest||typeof msg.tape!=="string"||!tapePattern.test(msg.tape)||typeof msg.yielded!=="boolean")return false;
      if(s.seat===1&&(msg.open!==s.secret||!equal(msg.team,s.remote)))return false;
      const old=s.tape,flags=s.yields,away=s.away,remote=1-s.seat;
      if(!old.startsWith(msg.tape)&&!applyTape(msg.tape,remote))return false;
      if(msg.yielded)s.yields|=1<<remote;
      s.away=null;s.lastPeer=now();s.confirmed=true;s.acked=msg.tape===s.tape&&!(s.yields&(1<<s.seat));
      if(winner()!==null)s.phase="done";
      if(old!==s.tape||flags!==s.yields||away!==null){
        panel="";film=null;changed(s.phase==="done"?"Duel complete.":"");
      }
      sendTo(s.peer,s.id,"ack",{guest:s.guest,tape:s.tape,yields:s.yields});
      if(!s.acked&&now()-s.lastSent>500)transmit();
      return true;
    }
    function receive(peer,msg){
      if(!peerId(peer)||peer===self||!msg||msg.kind!=="duel"||msg.v!==1||!isToken(msg.id))return false;
      const {id,op}=msg;
      const terminal=closed.get(id);
      if(terminal&&terminal.until>now()){
        if(terminal.peer===peer&&terminal.op&&op!=="ack"&&op!=="cancel"&&op!=="decline"&&now()-terminal.sent>=1000){
          terminal.sent=now();sendTo(peer,id,terminal.op,terminal.body);
        }
        return true;
      }
      if(op==="offer"){
        if(typeof msg.seal!=="string"||!sealPattern.test(msg.seal))return false;
        const crossed=s?.peer===peer&&s.phase==="outgoing";
        if(s?.id===id){
          if(s.peer!==peer||s.seat!==1||s.seal!==msg.seal)return false;
          if(s.guest&&now()-s.lastSent>=1000)transmit();
          return true;
        }
        if(!crossed&&(s||!canInvite(peer,"incoming")||(declined.get(peer)||0)>now())||crossed&&s.id<id){
          later(peer,id,"decline");sendTo(peer,id,"decline");return true;
        }
        if(crossed){later(peer,s.id,"cancel");sendTo(peer,s.id,"cancel");}
        s=empty(peer,id,1);s.seal=msg.seal;changed("A traveler invited you to a friendly duel.");return true;
      }
      if(!s||s.id!==id||s.peer!==peer)return false;
      if((op==="decline"&&s.phase==="outgoing")||(op==="cancel"&&s.phase==="incoming")){
        endNotice(op==="decline"?"The traveler declined your invitation.":"The challenger withdrew the invitation.");return true;
      }
      if(op==="decline"&&s.phase==="active"&&s.seat===0&&!s.confirmed){
        s.abandoned=true;s.phase="done";changed("Your opponent left before the opening bell.");return true;
      }
      if(op==="join"&&s.seat===0&&isToken(msg.guest)&&valid(msg.team)){
        if(!s.seal)return false;
        if(s.phase==="outgoing"){
          if(!canInvite(peer,"accept")){endNotice("Your campaign party is busy. The invitation closed.","cancel");return true;}
          if(now()>=s.expiresAt){cancel();return false;}
          s.remote=msg.team.slice();s.guest=msg.guest;establish();changed("Both trios are ready.");transmit();return true;
        }
        if(s.guest===msg.guest&&equal(s.remote,msg.team)&&now()-s.lastSent>=1000)transmit();
        return true;
      }
      if(op==="turn"&&s.seat===1&&s.phase==="incoming"&&isToken(msg.guest)&&s.guest===msg.guest&&isToken(msg.open)&&valid(msg.team)&&
          typeof msg.tape==="string"&&tapePattern.test(msg.tape)&&typeof msg.yielded==="boolean"){
        if(!s.verifying){
          const match=s,ids=msg.team.slice(),secret=msg.open;s.verifying=true;
          seal(id,secret,ids).then(value=>{
            if(s!==match||s.phase!=="incoming")return;
            s.verifying=false;
            if(!canInvite(peer,"accept")){endNotice("Your campaign party is busy. The invitation closed.","decline");return;}
            if(s.seal!==value){endNotice("The revealed trio did not match the invitation.","decline");return;}
            s.secret=secret;s.remote=ids;establish();changed("Both trios are ready.");sync(msg);
          }).catch(()=>{if(s===match)endNotice("Could not verify the challenger’s trio.","decline");});
        }
        return true;
      }
      if(!s.pos||msg.guest!==s.guest)return false;
      if(op==="turn")return sync(msg);
      if(op==="ack"&&msg.tape===s.tape&&msg.yields===s.yields){
        s.acked=true;s.confirmed=true;s.lastPeer=now();if(s.away!==null){s.away=null;changed("Your opponent is back.");}return true;
      }
      return false;
    }
    function move(id){
      if(s?.phase!=="active"||s.pos.turn!==s.seat||s.away!==null)return fail("Wait for your turn and your opponent.");
      const m=typeof id==="string"&&sim.forecast(s.pos,id);
      if(!m?.available)return fail(m?.reason||"Choose a legal move for this turn.");
      const code=codec.command(s.pos,id,3);
      if(!code||!applyTape(s.tape+code,s.seat))return fail("This move could not be recorded.");
      s.acked=false;if(winner()!==null)s.phase="done";
      panel="";film=null;changed(s.phase==="done"?"Duel complete.":"");transmit();
      return {ok:true};
    }
    function concede(){
      if(s?.phase!=="active")return fail("There is no live duel to concede.");
      s.yields|=1<<s.seat;s.phase="done";s.acked=false;panel="";film=null;
      changed("You conceded the duel.");transmit();return {ok:true,result:result(),message:lastNotice};
    }
    function dismiss(){
      if(s?.phase!=="done")return fail("Finish this duel first.");
      const summary={ok:true,result:result(),message:lastNotice};
      if(!s.abandoned)later(s.peer,s.id,"turn",frame());
      reset(lastNotice);return summary;
    }
    function leave(){
      if(s?.phase==="active")concede();
      if(s?.phase==="done")return dismiss();
      if(s?.phase==="outgoing")return cancel();
      if(s?.phase==="incoming")return decline();
      return {ok:true,result:null,message:""};
    }
    function peerLeft(peer){
      if(s?.peer!==peer||s.away!==null)return;
      if(s.phase==="outgoing"||s.phase==="incoming"){endNotice("The traveler left before the duel started.");return;}
      if(s.phase==="active"){s.away=now();s.lastSent=-Infinity;s.acked=false;changed("Opponent disconnected. Their seat stays open for 45 seconds.");}
    }
    function peerJoined(peer){
      if(s?.peer===peer&&s.away!==null&&now()-s.lastSent>=1000)transmit();
    }
    function tick(){
      if(!s)return;
      if((s.phase==="outgoing"||s.phase==="incoming")&&now()>=s.expiresAt){endNotice("The invitation expired.",s.seat?"decline":"cancel");return;}
      if(s.phase==="active"&&s.away!==null&&now()-s.away>=graceMs){
        s.phase="done";s.abandoned=true;changed("Your opponent did not return. The duel ended without a result.");return;
      }
      if(s.phase==="active"&&s.away===null&&now()-s.lastPeer>=30000){
        s.away=now();s.acked=false;changed("Waiting to reconnect to the other duel seat.");
      }
      if(!s.abandoned&&(!s.acked||s.phase==="active")&&now()-s.lastSent>=(s.acked?15000:retryMs))transmit();
      if(s.phase==="active"&&now()-savedAt>=15000)save();
    }
    function model(){
      if(!s?.pos)return {title:"Trail duel",subtitle:lastNotice,sections:[]};
      if(s.abandoned)return {...arena.snapshot(record(),s.pos),title:"Duel ended",kicker:"TRAIL DUEL",subtitle:lastNotice,
        sections:[{rows:[row("realm-duel-dismiss","Return to the realm")]}]};
      const r=record(),m=film===null?arena.model(r,panel):arena.review(r,film,panel);
      m.kicker=(m.kicker||"TRAIL DUEL").replace("BELLPOST","TRAIL DUEL");
      if(s.yields===3&&film===null){m.title="Match drawn";m.subtitle="Both travelers conceded.";}
      if(s.away!==null&&s.phase==="active")m.subtitle="Opponent disconnected. Waiting up to 45 seconds for them to return.";
      for(const section of m.sections||[])for(const b of section.rows||[]){
        if(b.id?.startsWith("post-"))b.id=b.id.replace("post-","realm-duel-");
        if(s.away!==null&&b.id==="realm-duel-move")b.disabled=true;
      }
      if(film===null&&!panel)m.sections.push({rows:[s.phase==="done"?row("realm-duel-dismiss","Return to the realm"):
        row("realm-duel-confirm","Concede duel")]});
      if(panel==="concede")return {title:"Concede this duel?",kicker:"TRAIL DUEL",subtitle:"Your opponent will win the exhibition.",sections:[{rows:[
        row("realm-duel-battle","Keep battling"),row("realm-duel-concede","Concede duel",null,"",{tone:"danger"})]}]};
      return m;
    }
    function act(id,value){
      if(typeof id!=="string"||!id.startsWith("realm-duel-"))return false;
      switch(id.slice(11)){
        case "move":move(value);break;
        case "panel":if(!["partners","crew"].includes(value))return false;panel=value;film=null;onChange(read());break;
        case "film":case "film-step":if(!Number.isInteger(value))return false;film=value;panel="";onChange(read());break;
        case "battle":film=null;panel="";onChange(read());break;
        case "confirm":panel="concede";film=null;onChange(read());break;
        case "concede":if(panel==="concede")concede();break;
        case "dismiss":dismiss();break;
        default:return false;
      }
      return true;
    }
    function key(event){
      if(!s?.pos||typeof event.key!=="string")return false;
      const k=event.key.toLowerCase();
      if(k==="escape"&&(panel||film!==null)){if(!event.repeat)act("realm-duel-battle");return true;}
      if(!/^[1-4a-d]$/.test(k))return false;
      const option=model().sections.flatMap(g=>g.rows||[]).find(b=>b.key?.toLowerCase()===k&&!b.disabled);
      if(!option)return false;
      if(!event.repeat)act(option.id,option.value);
      return true;
    }
    return {read,team,invite,accept,decline,cancel,receive,move,concede,dismiss,leave,resume,peerLeft,peerJoined,tick,model,act,key};
  }
  window.WilderRealmDuels=Object.freeze({create});
})();
