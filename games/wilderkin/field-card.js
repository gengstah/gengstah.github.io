// A field card carries an owned lineup and its opponent. HP, inventory and
// battle decisions always come from the live campaign when the card is played.
(() => {
  "use strict";
  const key="wilderkin.field-card.v1";
  const clone=value=>JSON.parse(JSON.stringify(value));
  function create({game,row,image,go,notify,locate,travel,fight,review}){
    let plan=null,record=null,bound=null;
    const state=()=>game.state;
    const owner=id=>state().party.find(p=>p.id===id);
    const name=(id,owned=false)=>game.kin(id,{owned}).name;
    function valid(s){
      if(!s||!Number.isInteger(s.region)||!state().visited.includes(s.region)||!Array.isArray(s.team)||s.team.length<1||
        s.team.length>6||new Set(s.team).size!==s.team.length||!s.team.every(id=>typeof id==="string"&&owner(id))||!s.team.includes(s.lead))return false;
      if(s.kind==="wild")return game.pools[s.region].includes(s.foe);
      return s.kind==="warden"&&game.wardenRoster(s.region)[0]===s.foe&&(state().crests.includes(s.region)||state().met.includes(s.region));
    }
    const tag=s=>valid(s)?[s.region,s.kind,s.foe,s.lead,s.team.join("+")].join("/"):"";
    const opponentInCard=(s,id)=>s.kind==="wild"?s.foe===id:game.wardenRoster(s.region).includes(id);
    const equalTeam=s=>s.lead===state().lead&&s.team.join("|")===state().team.join("|");
    function hash(screen,s){
      const suffix=tag(s);
      return "#chalkyard/"+screen+(suffix?"/"+suffix:"");
    }
    const methods={useSkill:1,swap:1,useDuet:1,useItem:2,useFamilyTechnique:1,useEmberTechnique:null};
    const plain=(s,max)=>typeof s==="string"&&s.length>0&&s.length<=max;
    function clean(s){
      if(!valid(s))return null;
      const base={kind:s.kind,region:s.region,foe:s.foe,lead:s.lead,team:s.team.slice()},t=s.tested;
      if(!t||!["victory","defeat"].includes(t.result)||!Array.isArray(t.members))return base;
      const members=t.members.filter(p=>p&&s.team.includes(p.id)&&Number.isInteger(p.level)&&p.level>=1&&p.level<=game.maxLevel&&
        Number.isInteger(p.hp)&&Number.isInteger(p.maxHp)&&p.maxHp>0&&p.hp>=0&&p.hp<=p.maxHp).map(p=>({
          id:p.id,name:name(p.id,true),level:p.level,hp:p.hp,maxHp:p.maxHp,gear:window.WilderTrailFittings?.byId(p.gear)?.id||null}));
      if(members.length!==s.team.length||new Set(members.map(p=>p.id)).size!==members.length)return base;
      const turns=[];
      for(const e of Array.isArray(t.turns)?t.turns.slice(0,3):[]){
        if(!e||e.turn!==turns.length+1||!s.team.includes(e.activeId)||!opponentInCard(s,e.foe)||
          !Object.hasOwn(methods,e.method)||!Array.isArray(e.args)||e.args.length>2||!e.args.every(a=>plain(a,64))||
          (methods[e.method]!==null&&e.args.length!==methods[e.method])||!plain(e.label,160)||!plain(e.actual,1400))break;
        if(e.method==="useEmberTechnique"&&(e.args.length>1||e.args.length&&!s.team.includes(e.args[0])))break;
        if(e.method==="useItem"&&(!["balm","tonic","sparkseed"].includes(e.args[0])||!s.team.includes(e.args[1])))break;
        if(["swap","useDuet","useFamilyTechnique"].includes(e.method)&&!s.team.includes(e.args[0]))break;
        turns.push({turn:e.turn,activeId:e.activeId,foe:e.foe,method:e.method,args:e.args.slice(),label:e.label,actual:e.actual});
      }
      return {...base,tested:{result:t.result,members,turns}};
    }
    function readSaved(){
      try{
        const raw=window.sessionStorage?.getItem(key);
        return typeof raw==="string"&&raw.length<=30000?JSON.parse(raw):null;
      }catch{return null;}
    }
    function persist(){
      try{
        if(plan)window.sessionStorage?.setItem(key,JSON.stringify({plan,record}));
        else window.sessionStorage?.removeItem(key);
      }catch{ /* This card also works for the duration of the page. */ }
    }
    function decode(parts){
      if(!Array.isArray(parts)||parts.length!==5||!parts.every(p=>typeof p==="string")||!/^(0|[1-9]\d{0,2})$/.test(parts[0])||parts.join("/").length>300)return null;
      const [region,kind,foe,lead,ids]=parts,s={region:Number(region),kind,foe,lead,team:ids.split("+")};
      if(!valid(s))return null;
      const saved=readSaved();
      return saved&&tag(saved.plan)===tag(s)?clean({...s,tested:saved.plan.tested}):s;
    }
    function keep(s){
      if(!valid(s))return false;
      plan=clean(s);record=null;bound=null;persist();return true;
    }
    function open(s){
      if(!keep(s))return notify("Choose an owned party and an opponent on a visited trail.");
      go("field-card",null,"root");
    }
    function signature(b){
      return JSON.stringify([state().region,state().team,b.kind,b.activeId,b.enemy.id,b.enemy.hp,b.turn,b.beats,b.log.at(-1),game.team().map(p=>p.hp)]);
    }
    function restore(){
      const saved=readSaved()||{plan,record};
      if(!valid(saved.plan)){plan=null;record=null;bound=null;return;}
      plan=clean(saved.plan);bound=null;
      const r=saved.record;
      const knownResult=["victory","defeat","recruited","escaped"].includes(r?.result);
      record=r&&(typeof r.signature==="string"||knownResult)&&Array.isArray(r.turns)&&r.turns.length<=3&&r.turns.every(t=>
        t&&Number.isInteger(t.turn)&&t.turn>0&&plain(t.label,160)&&plain(t.actual,1400)&&(!t.practice||plain(t.practice,1800)))?
        {signature:r.signature,result:knownResult?r.result:null,turns:clone(r.turns)}:null;
      const b=state().battle;
      if(b&&!b.secondBell&&record?.signature===signature(b)&&b.kind===plan.kind&&plan.region===state().region&&equalTeam(plan)&&opponentInCard(plan,b.enemy.id))bound=b;
      else if(record?.signature){record=null;bound=null;}
    }
    function restoreDesk(s){
      if(!valid(s))return;
      if(tag(plan)!==tag(s)){plan=clean(s);bound=null;record=null;}
    }
    function realStrip(){
      return {label:"Traveling party",slots:game.team().map(p=>({id:p.id,name:name(p.id,true),src:image(p.id,true),
        level:p.level,hp:p.hp,maxHp:p.maxHp,lead:p.id===state().lead}))};
    }
    function model(){
      if(!valid(plan))return {title:"Field card",kicker:"THE CHALKYARD",sections:[{rows:[row("nav","Choose an opponent","practice-yard")]}]};
      const s=plan,r=game.regions[s.region],wild=s.kind==="wild",opponent=wild?name(s.foe):"Warden "+r.warden;
      const local=s.region===state().region,at=local&&state().landmark===(wild?"wild":"warden"),match=equalTeam(s);
      const gate=wild?null:game.trialAccess(s.region);
      const lead=owner(s.lead),rows=[];
      if(state().battle)rows.push(row("root","Return to the encounter",null,"",{tone:"primary"}));
      else if(!match)rows.push(row("card-review","Review the proposed party",null,"Choose who will travel before approaching "+opponent+".",{tone:"primary"}));
      else if(!lead.hp)rows.push(row("walk-kind","Rest at camp","camp|camp",name(s.lead,true)+" needs to recover."));
      else if(!local)rows.push(row("card-travel","Travel to "+r.name,null,game.access(s.region).reason,{tone:"primary",disabled:!game.access(s.region).open}));
      else if(!at)rows.push(row("card-walk",wild?"Walk to the tracks":"Walk to "+r.lodge,null,"Bring "+name(s.lead,true)+" to "+opponent+".",{tone:"primary"}));
      else if(!wild&&!gate.open)rows.push(row("nav","Read the trial requirements","warden",gate.reason,{tone:"primary"}));
      else rows.push(row("card-battle",wild?"Approach "+opponent:"Accept "+r.warden+"’s trial",null,"Begin a campaign battle. "+name(s.lead,true)+" leads at "+lead.hp+"/"+lead.maxHp+" HP.",{tone:"primary"}));
      if(match&&!state().battle)rows.push(row("card-review","Review the lineup",null,"Check trail HP, change the lead or save a pennant."));
      const sections=[{title:r.name,rows}];
      if(!wild&&!gate.open&&!at)sections.push({title:"Crest trial",text:gate.reason});
      const result=resultSection();if(result)sections.push(result);
      if(s.tested?.turns?.length)sections.push({title:"Opening from your rehearsal",rows:s.tested.turns.map(t=>({label:"Turn "+t.turn+" · "+t.label,detail:t.actual||""}))});
      return {title:opponent+" · field card",kicker:"CAMPAIGN   /   "+(wild?"WILD TRACKS":"WARDEN LODGE"),
        subtitle:wild?"Follow this wild kin’s tracks with your traveling companions.":"The trial follows the lodge’s usual entry rules and awards.",
        formationStrip:realStrip(),sections};
    }
    function act(id){
      if(!["card-review","card-walk","card-travel","card-battle"].includes(id))return false;
      if(!valid(plan))return true;
      if(id==="card-review"){review(plan);return true;}
      const allowed=model().sections[0].rows.some(button=>button.id===id&&!button.disabled);
      if(!allowed){notify("Review the field card for the current trail conditions.");return true;}
      if(id==="card-travel")travel(plan.region,{name:"field-card"});
      if(id==="card-walk")locate(plan.kind==="wild"?"wild":"warden",{name:"field-card"});
      if(id==="card-battle")fight(plan.kind,plan.kind==="wild"?plan.foe:undefined,true);
      return true;
    }
    function bind(){
      const b=state().battle;
      if(!valid(plan)||!b||b.secondBell||!equalTeam(plan)||state().region!==plan.region||b.kind!==plan.kind||b.enemy.id!==plan.foe)return;
      bound=b;record={signature:signature(b),turns:[],result:null};persist();
    }
    const expected=turn=>plan?.tested?.turns?.find(t=>t.turn===turn);
    function guide(){
      const b=state().battle;
      if(!b||b!==bound||!record)return null;
      const note=expected(b.turn);
      if(!note)return null;
      const previous="Practice · "+note.actual;
      if(note.activeId!==b.activeId||note.foe!==b.enemy.id)return {title:"Chalkyard · turn "+b.turn,text:"You practiced "+note.label+" with "+name(note.activeId,true)+" against "+name(note.foe)+". "+previous};
      const [a,z]=note.args,me=name(b.activeId,true);
      let f,detail,button;
      if(note.method==="useSkill"){
        f=game.skillPreview(a)||game.ordinaryForecast(a);
        if(f)button=row("skill",note.label,a);
        if(f)detail=f.reason||f.detail||(f.skill?.kind==="heal"?"Recover "+f.healing+" HP":"Deal "+f.damage+" damage")+(f.finishes?" · KO before reply":" · take "+f.returnDamage+" HP");
      }else if(note.method==="useDuet"){
        f=game.duets().options.find(d=>d.partnerId===a);
        if(f){button=row("duet",note.label+" with "+name(a,true),a);detail=f.reason||f.preview;}
      }else if(note.method==="swap"){
        f=game.switchForecast(a);
        if(f){button=row("swap","Switch to "+name(a,true),a);detail=f.reason||f.hpAfter+"/"+f.maxHp+" HP after entry";}
      }else if(note.method==="useFamilyTechnique"){
        const pass=game.familyTechnique(),target=pass?.targets.find(t=>t.id===a);
        if(pass){
          f={available:!!target&&pass.available};button=row("family-pass",pass.name+" to "+name(a,true),a);
          detail=pass.reason||(!target?"Choose a conscious reserve.":target.hpAfter+"/"+target.maxHp+" HP after entry · "+target.returnDamage+" incoming damage");
        }
      }else if(note.method==="useEmberTechnique"){
        const art=game.emberTechnique(),target=art?.targets.find(t=>t.id===a);
        if(art){
          const warmth=art.id==="banked-warmth";
          f={available:art.available&&(warmth?!!target?.available:a==null)};
          button=row("ember-technique",art.name+(target?" for "+target.name:""),a??null);
          detail=art.reason||target?.reason||(warmth?(target?"Restore "+target.heal+" HP to "+target.name+" · take "+art.returnDamage:"Choose an injured reserve."):
            "Deal "+art.damage+" damage · recover "+art.healing+" HP · take "+art.returnDamage);
        }
      }else if(note.method==="useItem"){
        f=game.itemForecast(a,z);
        if(f){button=row("use-item",note.label,a+"|"+z);detail=f.reason||"Use 1 "+game.items[a].name+" · restore "+f.gain+" HP · "+me+" finishes at "+f.activeHpAfter+" HP";}
      }
      if(button){button.detail=detail;button.disabled=!f.available;}
      return {title:"Chalkyard · turn "+b.turn,text:previous,rows:button?[button]:[]};
    }
    function before(label){
      const b=state().battle;
      if(!b||bound!==b||!record)return null;
      return {turn:b.turn,foe:b.enemy,foeHp:b.enemy.hp,id:b.activeId,beats:b.beats,party:game.team().map(p=>({id:p.id,hp:p.hp})),label:label||"Field decision"};
    }
    function after(s,res){
      if(!s||!res.ok||!record)return;
      if(res.kind==="replacement"){refreshBinding();return;}
      const b=state().battle;
      if(record.turns.length<3&&!record.turns.some(t=>t.turn===s.turn)){
        const effects=[name(s.foe.id)+" "+s.foeHp+" → "+s.foe.hp+" HP"],practice=expected(s.turn);
        for(const p of s.party){
          const hp=res.fieldHp?.[p.id]??owner(p.id).hp;
          if(p.id===s.id||p.hp!==hp)effects.push(name(p.id,true)+" "+p.hp+" → "+hp+" HP");
        }
        if(b&&b.activeId!==s.id)effects.push(name(b.activeId,true)+" took the lead");
        if(b&&s.beats!==b.beats)effects.push("Beats "+s.beats+" → "+b.beats);
        for(const e of res.fittingEvents||[])effects.push(e.text);
        record.turns.push({turn:s.turn,label:s.label,actual:effects.join(" · "),practice:practice?practice.label+" · "+practice.actual:null});
      }
      if(b)record.signature=signature(b);
      else{record.signature=null;record.result=res.kind;bound=null;}
      persist();
    }
    function resultSection(){
      if(state().battle||!record?.result||!record.turns.length||!valid(plan))return null;
      return {title:"Field card · "+(plan.kind==="wild"?name(plan.foe):"Warden "+game.regions[plan.region].warden),
        rows:record.turns.map(t=>({label:"Turn "+t.turn+" · "+t.label,detail:"Trail · "+t.actual+(t.practice?"\nPractice · "+t.practice:"")}))};
    }
    function refreshBinding(){if(bound&&bound===state().battle&&record){record.signature=signature(bound);persist();}}
    function unbind(){if(record){bound=null;record=null;persist();}}
    function reset(){plan=null;bound=null;record=null;persist();}
    return {model,act,open,keep,restore,restoreDesk,tag,hash,decode,bind,guide,before,after,resultSection,refreshBinding,unbind,reset,current:()=>plan};
  }
  window.WilderFieldCard=Object.freeze({create});
})();
