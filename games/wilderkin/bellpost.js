// A Bellpost letter carries a complete match between two browsers.
(() => {
  "use strict";
  const draftKey="wilderkin.bellpost.drafts.v1";
  // A chat client can attach sentence punctuation and Markdown closers to the URL.
  const trailingPunctuation=/(?:[.,;:!?'")\]}>*_\x60’”…。]|%(?:22|27|29|3E|5D|60|7D)|%E2%80%(?:99|9D|A6)|%E3%80%82)+$/i;
  const copyTeam=t=>({ids:t.ids.slice(),gear:{...t.gear}});
  function create({game,row,image,go,render,notify}) {
    const rules=window.WilderBellpostRules.create({game});
    const arena=window.WilderBellpostArena.create({game,row,image});
    const wire=window.WilderBellpostWire?.create({rules,row,render,notify});
    const inbox=new Map(),drafts=new Map();
    let problem="",olderLetter=null,displayed=null;
    const hotkeys=new Map();
    const group=(title,rows,columns=1)=>({title,rows,columns});
    const control=(id,label,value=null,detail="",extra={})=>row("post-"+id,label,value,detail,extra);
    const page=(title,kicker,subtitle,sections,art)=>({title,kicker,subtitle,sections,art});
    const show=(route,mode)=>go("bellpost",route,mode);
    const path=(view,id,extra)=>[view,id,extra].filter(v=>v!==undefined&&v!=="").join("|");
    const known=id=>typeof id==="string"&&Object.hasOwn(game.species,id)&&!game.species[id].bonus;
    const name=id=>game.species[id].name;
    const names=t=>t.ids.map(name).join(" · ");
    const piece=id=>window.WilderSparringGear.byId(id);
    const buttons=t=>t.ids.map((id,i)=>({label:name(id),image:image(id,false),
      detail:[game.species[id].types.join(" / "),piece(t.gear?.[id])?.name].filter(Boolean).join(" · "),badge:i===0?"LEAD":""}));
    const record=id=>rules.get(id)||inbox.get(id)||null;
    const role=r=>r.seat===0?"Host":r.seat===1?"Guest":"Spectator";
    const myTurn=r=>r.status==="active"&&r.pos?.turn===r.seat;
    const hallTrio=()=>{
      const s=window.WilderSparringTeams.restore(game.state.sparring?.setup,{species:game.species});
      return {ids:s.left,gear:s.gear?.left||{}};
    };
    function travelers(){
      const ids=game.team().filter(p=>known(p.id)&&p.hp>0).map(p=>p.id);
      const n=ids.indexOf(game.state.lead);
      if(n>0)ids.unshift(...ids.splice(n,1));
      return ids;
    }
    function trailTrio(){
      const ids=travelers().slice(0,3);
      return ids.length===3?{ids,gear:{}}:null;
    }
    function owned(){
      const front=game.state.team.filter(known),lead=front.indexOf(game.state.lead);
      if(lead>0)front.unshift(...front.splice(lead,1));
      return [...front,...game.state.party.map(p=>p.id).filter(id=>known(id)&&!front.includes(id)).sort((a,b)=>name(a).localeCompare(name(b)))];
    }
    function storedDrafts(){
      try{const d=JSON.parse(window.localStorage?.getItem(draftKey)||"{}");return d&&typeof d==="object"&&!Array.isArray(d)?d:{};}
      catch{return {};}
    }
    function draft(id) {
      if(drafts.has(id))return drafts.get(id);
      const saved=storedDrafts()[id];
      const valid=saved&&Array.isArray(saved.ids)&&saved.ids.length===3&&new Set(saved.ids).size===3&&saved.ids.every(known)&&
        window.WilderSparringGear.validate({left:saved.gear||{}},saved.ids,[]);
      const t=valid?{ids:saved.ids,gear:valid.left}:trailTrio()||hallTrio();
      drafts.set(id,copyTeam(t));return drafts.get(id);
    }
    function saveDraft(id,t){
      drafts.set(id,copyTeam(t));
      try{const all=storedDrafts();all[id]=copyTeam(t);window.localStorage?.setItem(draftKey,JSON.stringify(all));}catch{}
    }
    function desk(){
      const entries=rules.list(),sections=[];
      if(entries.length){
        const sorted=[...entries].sort((a,b)=>Number(myTurn(b))-Number(myTurn(a))||Number(a.status==="done")-Number(b.status==="done"));
        sections.push(group("Your matches",sorted.map(r=>{
          const title=r.teams[1]?name(r.teams[0].ids[0])+" vs. "+name(r.teams[1].ids[0]):name(r.teams[0].ids[0])+"’s invitation";
          const state=r.status==="invite"?"Waiting for a guest":r.status==="done"?"Finished":myTurn(r)?"Your turn":"Waiting for your friend";
          return control("open",title,r.id,role(r)+" · "+r.moves.length+" moves · "+state,{image:image(r.teams[0].ids[0],false)});
        })));
      }
      sections.push(group("Play with a friend",[
        control("new","Create an invitation",null,"Pick your three kin. Your friend chooses their own trio.",{tone:"primary"}),
        control("paste","Open a letter",null,"Paste an invitation or a return link.")]));
      sections.push(group("Adventure",[row("root",game.state.battle?"Resume campaign battle":"Back to the trail"),
        row("nav","Visit the Sparring Hall","sparring")],2));
      const desk=page("Bellpost","TWO-PLAYER SPARRING","Two browsers, one level-20 match. Send a link after each turn or pair your devices on the same Wi-Fi.",sections,
        {src:"ui/bellpost.png",landscape:true,height:164});
      if(rules.persistent===false)desk.status="Session only · keep this tab open to retain your seat.";
      return desk;
    }
    function incoming(r){
      return page("You’re invited to Bellpost","TWO-PLAYER SPARRING","The host will take the first turn after you send your lineup.",[
        group("Host’s trio",buttons(r.teams[0]),3),group("Your answer",[
          control("join","Choose my trio",r.id,"Review your lineup before you accept.",{tone:"primary"}),
          control("desk","Bellpost desk")])]);
    }
    function lineup(id) {
      const t=draft(id),guest=id!=="new",other=guest&&record(id);
      if(guest&&(!other||other.seat!==null||other.status!=="invite"))return other?match(other):desk();
      const trail=trailTrio(),hall=hallTrio();
      return page(guest?"Choose your visiting trio":"Choose your Bellpost trio","LEVEL 20   /   "+(guest?"GUEST":"HOST"),
        "The first kin leads. Tap a slot to change its kin or reorder your team.",[
          group("Your lineup",t.ids.map((k,i)=>control("slot",name(k),i,[game.species[k].types.join(" / "),piece(t.gear[k])?.name].filter(Boolean).join(" · "),
            {image:image(k,false),badge:i===0?"LEAD":"SLOT "+(i+1)})),3),
          group("Match desk",[control("confirm",guest?"Accept and prepare return link":"Create match link",null,guest?"Send your lineup back for the host’s opening move.":"Your friend chooses their trio before you play.",{tone:"primary"})]),
          group("Bring a team",[
            control("use-trail","Use my trail trio",null,trail?names(trail):"Needs three conscious traveling kin.",{disabled:!trail}),
            control("use-hall","Use my Hall trio",null,names(hall)+(Object.keys(hall.gear).length?" · equipped gear":""))]),
          ...(guest?[group("Host’s trio",buttons(other.teams[0]),3)]:[]),
          group("",[control("desk","Return to the Bellpost desk",null,"Keep this lineup draft.")])]);
    }
    let filter={id:null,slot:null,query:"",page:0};
    function picker(id,i) {
      const t=draft(id),front=game.state.team;
      if(filter.id!==id||filter.slot!==i)filter={id,slot:i,query:"",page:0};
      const all=owned(),matches=all.filter(k=>[name(k),game.kin(k,{owned:true}).name].some(n=>n.toLowerCase().includes(filter.query.toLowerCase())));
      const pages=Math.max(1,Math.ceil(matches.length/8));
      filter.page=Math.max(0,Math.min(pages-1,filter.page));
      const rows=matches.slice(8*filter.page,8*(filter.page+1)).map(k=>{
        const held=t.ids.indexOf(k);
        return control("choose",name(k),k,(held===i?"In this slot":held>=0?"Trade places with "+name(t.ids[i]):front.includes(k)?"Traveling companion":"Campaign reserve")+
          " · "+game.species[k].types.join(" / "),{image:image(k,false),badge:game.state.lead===k?"TRAIL LEAD":""});
      });
      const sections=[group("Formation",[...t.ids.flatMap((k,j)=>j===i?[]:[control("swap",j===0?"Make "+name(t.ids[i])+" lead":"Trade with "+name(k),j)]),control("lineup","Back to trio")])];
      if(all.length>8)sections.push(group("Find a companion",[control("find",filter.query||"Search your collection")]));
      sections.push(group("Owned companions",rows.length?rows:[{label:"No matching kin"}],2));
      if(pages>1)sections.push(group("Page "+(filter.page+1)+" of "+pages,[control("page","Previous",-1,"",{disabled:!filter.page}),control("page","Next",1,"",{disabled:filter.page===pages-1})],2));
      return page("Choose "+(i===0?"your lead":"slot "+(i+1)),"BELLPOST   /   LINEUP", "Each kin enters at full health and level 20.",sections);
    }
    function shareLabel(r){
      if(r.status==="invite")return "Send invitation";
      if(r.status==="done")return "Send result";
      return r.moves.length===0&&r.seat===1?"Send your lineup":"Send latest turn";
    }
    function match(r,panel=""){
      if(r.status==="invite"&&r.archived)return page("Invitation withdrawn","BELLPOST","This device has closed the host seat.",[
        group("Original trio",buttons(r.teams[0]),3),group("Match desk",[control("desk","Return to desk"),control("new","Create another invitation")])]);
      if(r.status==="invite"&&r.seat===null)return incoming(r);
      const live=wire?.connected(r.id),result=r.status==="invite"?
        page("Invitation ready","BELLPOST   /   HOST","Send your friend this invitation. Open their return link here to take the first turn.",[group("Your trio",buttons(r.teams[0]),3)]):
        arena.model(r,panel);
      const share=r.incomplete?[control("copy","Copy previous handoff",r.id,"Your replacement is ready. Choose its move before sending your new turn.")]:
        [...(!live&&typeof window.navigator?.share==="function"?[control("share",shareLabel(r),r.id,"Choose how to share this link.",{tone:"primary"})]:[]),
          control("copy","Copy "+(r.status==="invite"?"invitation":"match link"),r.id,live?"Keep a link for later.":r.status==="active"&&!myTurn(r)?"Send this link to the other player.":"Use in a message to your friend.",{tone:live?undefined:"primary"}),
          control("link","Show selectable link",r.id)];
      const sections=[...result.sections];
      if(myTurn(r)&&!panel)for(const s of sections)for(const action of s.rows||[]){
        if(action.key&&!action.disabled)hotkeys.set(action.key.toLowerCase(),action);
      }
      if(!panel){
        const wireRow=wire?.link(r);
        const send=group(live?"Direct play connected · turns arrive here":"Send by Bellpost",share);
        if(r.status==="invite"||myTurn(r))sections.push(send);else sections.unshift(send);
        const more=[...(wireRow?[wireRow]:[]),control("desk","Bellpost desk")];
        if(!r.archived&&r.seat!==null){
          if(myTurn(r))more.push(control("resign-confirm","Resign match",r.id));
          else if(r.seat===0&&r.status==="invite")more.push(control("manage","Withdraw unused invitation","withdraw"));
          else if(r.status==="done")more.push(control("manage","Archive on this device","archive"));
        }
        sections.push(group("Match options",more));
      }
      const subtitle=(result.subtitle||"")+(olderLetter===r.id?" This device has a newer position than that letter.":"");
      return {...result,subtitle:subtitle.trim(),sections};
    }
    function model(value){
      const [view,id,part]=String(value||"desk").split("|"),r=id&&record(id);
      hotkeys.clear();
      displayed=r?{id:r.id,hash:r.hash}:null;
      if(view==="draft")return lineup(id);
      if(view==="pick"&&[0,1,2].includes(Number(part)))return picker(id,Number(part));
      if(view==="error")return page(r?"Your saved match is available":"This letter can’t be opened","BELLPOST",problem,[group("Bellpost",[
        ...(r?[control("open","Resume latest position",r.id,"Open the current turn saved on this device.",{tone:"primary"})]:[]),
        control("paste","Open another letter"),control("desk","Return to desk")])]);
      if(!r)return desk();
      if(view==="film")return arena.review(r,part===undefined?-1:Number(part));
      if(view==="film-crew")return arena.review(r,Number(part),"crew");
      if(view==="wire"&&wire)return wire.model(r);
      if(view==="manage"){
        const withdraw=part==="withdraw",possible=!r.archived&&(withdraw?r.status==="invite"&&r.seat===0:r.status==="done"&&r.seat!==null);
        if(!possible)return match(r);
        return page(withdraw?"Withdraw this invitation?":"Archive this result?","BELLPOST",withdraw?
          "Close the host seat on this device. A delivered link may remain in your friend’s inbox.":
          "Remove the finished match from your desk. Keep its final link to reopen the film.",[
          group("Match decision",[control("battle",withdraw?"Keep the invitation":"Keep on my desk"),
            control("close",withdraw?"Withdraw invitation":"Archive result",part)])]);
      }
      if(view==="resign")return page("Resign this match?","BELLPOST","Your friend wins. You can send the final result and review the match.",[
        group("Match decision",[control("battle","Keep playing"),control("resign","Resign and record result")])]);
      return match(r,view==="panel"?part:"");
    }
    function result(res){
      if(!res?.ok){notify(res?.reason||res?.message||"This letter could not be opened.");return null;}
      return res.record;
    }
    function loadFragment(hash){
      if(hash==="#bellpost")return "desk";
      if(typeof hash!=="string"||!hash.startsWith("#bellpost-v1="))return null;
      let inspected=rules.inspect(hash);
      if(!inspected&&hash.length<=600){
        const trimmed=hash.replace(trailingPunctuation,"");
        if(trimmed!==hash){hash=trimmed;inspected=rules.inspect(hash);}
      }
      if(inspected&&!rules.get(inspected.id)){
        inbox.set(inspected.id,inspected);olderLetter=null;rememberUrl(inspected.hash);return path("game",inspected.id);
      }
      const check=rules.receive(hash);
      if(!check?.ok){
        problem=check?.message||"The link is incomplete or invalid.";
        if(check.code==="stale"&&inspected&&rules.get(inspected.id)){
          olderLetter=inspected.id;rememberUrl(rules.export(inspected.id));return path("game",inspected.id);
        }
        return path("error",inspected&&rules.get(inspected.id)?inspected.id:undefined);
      }
      olderLetter=null;const r=check.record;inbox.set(r.id,r);
      rememberUrl(rules.export(r.id));
      return path("game",r.id);
    }
    function address(r){
      const hash=rules.export(r.id)||r.hash,loc=window.location;
      return loc.origin+loc.pathname+(loc.search||"")+rules.forSharing(hash);
    }
    function rememberUrl(hash){
      const publicHash=hash==="#bellpost"?hash:rules.forSharing(hash);
      if(publicHash&&window.location.hash!==publicHash)try{window.history?.replaceState(null,"",publicHash);}catch{}
    }
    function textBox(title,text,accept,allowEmpty=false){
      // A native input gives mobile users the OS paste/select controls.
      const v=window.prompt?.(title,text);
      if(accept&&typeof v==="string"&&(allowEmpty||v.trim()))accept(v.trim());
    }
    function selectable(r){textBox("Select and copy this Bellpost link",address(r));}
    async function deliver(r,mode){
      const url=address(r);
      if(mode==="share"&&window.navigator?.share){
        try{await window.navigator.share({title:"Wilderkin · Bellpost",url});return;}
        catch(e){if(e?.name==="AbortError")return;}
      }
      try{
        if(!window.navigator?.clipboard?.writeText){selectable(r);return;}
        await window.navigator.clipboard.writeText(url);notify("Bellpost link copied.");
      }catch{selectable(r);}
    }
    function act(action,value,current){
      const [view,id,part]=String(current||"desk").split("|"),r=record(id);
      if(r&&action.startsWith("wire-"))return wire?.act(action,value,r);
      if(action==="spar-view"&&value==="equipment"&&r){show(view==="film"?path("film-crew",id,part):path("panel",id,"crew"));return true;}
      if(!action.startsWith("post-"))return false;
      const cmd=action.slice(5),i=Number(part);
      if(cmd==="desk"){rememberUrl("#bellpost");show("desk");return true;}
      if(cmd==="paste"){textBox("Paste a Bellpost link or message","",raw=>{
        const letter=raw.match(/#bellpost-v1=\S+/u)?.[0]||raw.match(/#bellpost(?=$|[\s.,!?;)\]}>])/u)?.[0];
        const dest=letter&&loadFragment(letter);
        if(dest){if(dest==="desk")rememberUrl("#bellpost");show(dest);}else notify("Choose a Bellpost invitation or turn link.");
      });return true;}
      if(cmd==="new"){show(path("draft","new"));return true;}
      if(cmd==="join"&&record(value)?.seat===null&&record(value)?.status==="invite"){show(path("draft",value));return true;}
      if(cmd==="open"&&record(value)){rememberUrl(rules.export(value)||record(value).hash);show(path("game",value));return true;}
      if(view==="draft"||view==="pick"){
        const t=copyTeam(draft(id));
        if(cmd==="confirm"&&view==="draft"){
          const record=id==="new"?result(rules.invite(t)):result(rules.join(r?.hash,t));
          if(record){inbox.set(record.id,record);rememberUrl(rules.export(record.id));show(path("game",record.id),"replace");}
        }else if(cmd==="use-trail"||cmd==="use-hall"){
          const selected=cmd==="use-trail"?trailTrio():hallTrio();if(selected){saveDraft(id,selected);render();}
        }else if(cmd==="slot"&&[0,1,2].includes(Number(value)))show(path("pick",id,Number(value)));
        else if(cmd==="lineup")show(path("draft",id),"replace");
        else if(cmd==="page"){filter.page+=Math.sign(Number(value))||0;render();}
        else if(cmd==="find")textBox("Search owned companions",filter.query,q=>{filter.query=q;filter.page=0;render();},true);
        else if((cmd==="swap"||cmd==="choose")&&[0,1,2].includes(i)){
          const j=cmd==="swap"?Number(value):t.ids.indexOf(value);
          if(j>=0&&j<3){[t.ids[i],t.ids[j]]=[t.ids[j],t.ids[i]];}
          else if(cmd==="choose"&&owned().includes(value)){delete t.gear[t.ids[i]];t.ids[i]=value;}
          else return true;
          saveDraft(id,t);show(path("draft",id),"replace");
        }
        return true;
      }
      if(!r)return true;
      if(cmd==="share"||cmd==="copy")void deliver(r,cmd);
      else if(cmd==="link")selectable(r);
      else if(cmd==="battle")show(path("game",id),"replace");
      else if(cmd==="panel")show(path("panel",id,value));
      else if(cmd==="wire"&&wire)show(path("wire",id));
      else if(cmd==="film"||cmd==="film-step")show(path("film",id,value??-1),cmd==="film"?"push":"replace");
      else if(cmd==="manage"&&r.seat!==null&&!r.archived)show(path("manage",id,value));
      else if(cmd==="close"&&view==="manage"&&part===value&&r.seat!==null){
        if(displayed?.id!==id||displayed.hash!==r.hash){show(path("game",id),"replace");notify("This match has changed. Review its latest position.");return true;}
        const closed=result(value==="withdraw"?rules.withdraw(id):rules.archive(id));
        if(closed){inbox.set(id,closed);rememberUrl("#bellpost");show("desk","replace");}
        else render();
      }
      else if(cmd==="resign-confirm")show(path("resign",id));
      else if(cmd==="move"||cmd==="resign"){
        if(displayed?.id!==id){render();return true;}
        const updated=result(cmd==="move"?rules.play(id,value,displayed.hash):rules.resign(id,displayed.hash));
        if(updated){olderLetter=null;inbox.set(id,updated);if(!updated.incomplete)rememberUrl(rules.export(id));wire?.send(id);show(path("game",id),"replace");}
        else render();
      }
      return true;
    }
    function key(e,current){
      const action=hotkeys.get(e.key.toLowerCase());
      if(!action)return false;
      if(!e.repeat)act(action.id,action.value,current);
      return true;
    }
    return {model,act,key,loadFragment};
  }
  window.WilderBellpost={create};
})();
