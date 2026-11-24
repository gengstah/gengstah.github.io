// Neri's lessons read the traveling party and field battles directly.
(() => {
  "use strict";
  const pupils={
    opalclasp:{region:0,tracks:"Clover Clearing",practice:"mossbell",call:"A good grip buys our courier time to get clear."},
    cragroll:{region:1,tracks:"Cindergrass",practice:"coalmoth",call:"I send the shell out first. The injured rider crosses behind it."}
  };
  function create({game,row,image,go,locate,travel,fight,render,notify}){
    const member=id=>game.state.party.find(p=>p.id===id);
    const name=id=>game.kin(id,{owned:true}).name;
    const pupil=id=>typeof id==="string"&&(Object.hasOwn(pupils,id)||Object.hasOwn(game.species,id)&&!!member(id)&&!!game.guardTraining(id));
    const route=id=>go("guard-school",id,"replace");
    function practice(id){
      const home=pupils[id],level=member(id).level,current=game.state.region;
      const visited=game.state.visited.filter(i=>game.access(i).open);
      function rank(region){
        if(home?.region===region&&level<=game.wildLevel(region)+5)return -1;
        return Math.abs(game.wildLevel(region)-level);
      }
      visited.sort((a,b)=>rank(a)-rank(b)||Math.abs(a-current)-Math.abs(b-current));
      let short=null;
      for(const region of visited){
        const preferred=home?.region===region?home.practice:null;
        const pool=game.pools[region].slice().sort((a,b)=>Number(b===preferred)-Number(a===preferred)||game.species[b].baseHp-game.species[a].baseHp);
        for(const foe of pool){
          const fit=game.guardPractice(id,foe,region);
          if(!fit||fit.maxHp<=fit.guardDamage)continue;
          if(fit.maxHp>fit.guardDamage*3)return {region,foe};
          if(!short)short={region,foe,wait:true};
        }
      }
      return short;
    }
    function steps(id){
      const s=game.state,p=member(id),lesson=game.guardTraining(id);
      const action=(key,label,detail)=>({key,label,detail});
      if(s.battle)return [action("resume","Return to your battle","The forecast shows the rival’s next reply.")];
      if(!p&&!s.bag.kinweave){
        const recipe=game.items.kinweave.recipe;
        if(Object.entries(recipe).every(([material,n])=>s.bag[material]>=n))
          return [action("craft","Pack a Kinweave","Craft one with 2 reeds and 1 sun sap.")];
        if(s.forageReady)return [action("gather","Gather weave materials","Gather reeds and sun sap, then make a Kinweave.")];
        return [action("supplies","Find fresh supplies","Finish a field leg or win a wild encounter to reveal another patch.")];
      }
      if(p&&!s.team.includes(id))return [action("enlist","Call "+name(id)+" from reserve",s.team.length===6?"Choose who stays in reserve.":"Add your companion to the traveling party.")];
      if(p&&!p.hp)return [action(s.landmark==="camp"?"rest":"camp",s.landmark==="camp"?"Rest your party":"Walk to camp",name(id)+" needs to recover before leading.")];
      if(p&&s.lead!==id)return [action("lead","Make "+name(id)+" the lead","Take the field with your own level "+p.level+" companion.")];
      const place=p?practice(id):pupils[id];
      if(!place)return [action("stronger","Find a stronger opponent","One "+lesson.guard+" would finish every wild kin on your visited trails. Explore a higher-level region or face a stronger Warden and guard its charged reply.")];
      const where=game.regions[place.region].name;
      const tracks=window.WilderWorld?.regions[place.region]?.sites.find(k=>(k.kind||k.id)==="wild")?.label||
        Object.values(pupils).find(k=>k.region===place.region)?.tracks||"the local tracks";
      if(s.region!==place.region){
        const gate=game.access(place.region);
        return gate.open?[action("travel","Travel to "+where,"Follow the trail to "+tracks+".")]:
          [action("crest","Follow the Leaf Crest trail",gate.reason)];
      }
      const rest=action(s.landmark==="camp"?"rest":"camp",s.landmark==="camp"?"Rest your party":"Walk to camp to rest","Restore the traveling party to full health before going out.");
      const strike=game.species[id].skills.find(m=>m.kind==="attack").name;
      const rules=lesson.learned?(lesson.id==="shell"?"Use Roll Brace, then switch to a teammate. Read the protected HP forecast before choosing.":
        "Meet a charged reply with Pincer Block, then strike the exposed rival with "+strike+"."):
        place.wait?"This rival can’t withstand three guards. Switch out on turn one and back on turn two. Use "+lesson.guard+" for the charged third reply.":
        p?lesson.guard+" halves incoming damage. Guard on turns one and two, then guard the charged third reply. The opponent and your trainee must both survive.":
        "Choose Hold back until the wild kin is at half health, then cast a Kinweave.";
      const opponent=p?game.species[place.foe].name:name(id);
      const path=s.landmark==="wild"?
        action(p?"practice":"catch",lesson.learned?"Try "+lesson.name+" against "+opponent:p?"Practice against "+opponent:"Track "+opponent,rules):
        action("walk",lesson.learned?"Try "+lesson.name+" at "+tracks:p?"Walk to "+tracks+" for practice":"Walk to "+name(id)+"’s tracks",tracks+" · "+rules);
      if(p&&p.hp<p.maxHp*.65)return [rest,path];
      return [path];
    }
    function card(id){
      const lesson=game.guardTraining(id),p=member(id);
      const badge=lesson.learned?"TRAINED":p?"YOUR KIN · LV "+p.level:"WILD · LV "+game.wildLevel(pupils[id].region);
      let text=lesson.learned?lesson.summary:p?
        "Neri asks "+name(id)+" to take a charged hit using "+lesson.guard+" and stay on its feet. The lesson counts in any campaign battle.":
        "“"+pupils[id].call+"” "+lesson.summary;
      if(p&&!lesson.learned&&lesson.id==="pincer")text+=" If "+name(id)+" needs a breath before the charge, "+
        game.species[id].skills.find(s=>s.kind==="heal").name+" buys one.";
      if(lesson.learned&&lesson.id==="pincer"&&game.state.crests.length>=2)text+=" Lune opens her two-kin formation at Moonwell Shrine with Reserve Relay.";
      const rows=steps(id).map((a,i)=>row("guard-lesson-step",a.label,id+"|"+a.key,a.detail,{image:image(id),badge:i===0?badge:"",tone:i===0&&!lesson.learned?"primary":undefined}));
      if(lesson.learned)rows.unshift(row("open-kin","View trained "+name(id),id,"See "+lesson.name+" in your companion’s field entry.",{image:image(id),badge:"TRAINED"}));
      return {title:name(id)+" · "+lesson.name,text,rows};
    }
    function model(value){
      const replacing=typeof value==="string"&&value.startsWith("enlist:")?value.slice(7):null;
      if(pupil(replacing)&&member(replacing)&&!game.state.team.includes(replacing)&&game.state.team.length===6){
        return {title:"Make room for "+name(replacing),kicker:"NERI PIKE  /  TRAVELING PARTY",sections:[{title:"Who stays in reserve?",rows:game.team().map(p=>
          row("guard-lesson-replace",name(p.id),replacing+"|"+p.id,"Level "+p.level+" · "+p.hp+"/"+p.maxHp+" HP",{image:image(p.id)}))}]};
      }
      const first=pupil(value)?value:game.state.region===1?"cragroll":"opalclasp";
      const trained=game.state.trainedGuards;
      const roles=new Set(trained.map(id=>game.guardTraining(id).id));
      const greeting=roles.size===2?"“One to hold the front, one to cover the crossing. I’d send a hurt rider home with your crew.”":
        trained.length?"“Word came down the trail about "+name(trained[0])+". That’s a guard I’d ride with.”":
        "“I need guards who can bring a hurt courier home. Bring your own companion and we’ll read a real charge together.”";
      return {title:"Neri Pike’s guard school",kicker:"COURIER FIELD MEDIC",subtitle:greeting,
        art:{src:"art/story/neri-pike.png",landscape:true,focusY:0,caption:"Neri Pike · Brookside Mill & Ember Rest"},
        sections:[card(first),card(game.guardTraining(first).id==="pincer"?"cragroll":"opalclasp")]};
    }
    function finish(outcome){if(outcome.message)notify(outcome.message);render();}
    function act(action,value){
      if(action!=="guard-lesson-step"&&action!=="guard-lesson-replace")return false;
      const [id,key]=String(value).split("|");
      if(!pupil(id))return true;
      if(action==="guard-lesson-replace"){
        if(!game.state.battle&&member(id)&&!game.state.team.includes(id)&&game.state.team.length===6&&game.state.team.includes(key)){
          const result=game.enlist(id,key);if(result.ok)route(id);finish(result);
        }
        return true;
      }
      if(!steps(id).some(a=>a.key===key)){render();return true;}
      switch(key){
        case "walk":locate("wild",{name:"guard-school",value:id});break;
        case "camp":locate("camp",{name:"guard-school",value:id});break;
        case "travel":travel(member(id)?practice(id).region:pupils[id].region);route(id);break;
        case "catch":fight("wild",id);break;
        case "practice":fight("wild",practice(id).foe);break;
        case "rest":finish(game.heal());break;
        case "craft":finish(game.craft("kinweave"));break;
        case "gather":finish(game.gather());break;
        case "supplies":go(game.expedition().done?"tracks":"expedition");break;
        case "stronger":go("atlas");break;
        case "enlist":
          if(game.state.team.length===6)route("enlist:"+id);else finish(game.enlist(id));
          break;
        case "lead":finish(game.setLead(id));break;
        case "resume":go("battle",null,"root");break;
        case "crest":
          if(game.state.region!==0)travel(0);
          if(!game.expedition(0).done)go("expedition");
          else if(!window.WilderStory.chapterDone(game.state,0))go("scene","chapter-1");
          else locate("warden","warden");
          break;
      }
      return true;
    }
    return {model,act};
  }
  window.WilderGuardLessons={create};
})();
