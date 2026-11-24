// A camp rehearsal owns its combat instance and one decision checkpoint.
// Leaving the page discards both. No trail or browser save is involved.
(() => {
  "use strict";
  const error=message=>({ok:false,kind:"error",message});
  const arity={useSkill:[1,1],swap:[1,1],replaceFainted:[1,1],useDuet:[1,1],useFamilyTechnique:[1,1],
    useEmberTechnique:[0,1],useItem:[1,2],flee:[0,0]};
  const medicines=new Set(["balm","tonic","sparkseed"]);

  function create({game}) {
    let run=null,undo=null,reopen=null;

    function targets(region=game.state.region) {
      if(!Number.isInteger(region)||!game.regions[region]||
          region!==game.state.region&&!game.state.visited.includes(region))return [];
      const r=game.regions[region];
      const cards=region===game.state.region?game.pools[region].map(foe=>({kind:"wild",foe,region,name:game.species[foe].name,level:r.wildLevel,roster:[foe]})):[];
      if(r.warden&&(game.state.met.includes(region)||game.state.crests.includes(region))){
        const roster=game.wardenRoster(region);
        cards.push({kind:"warden",foe:roster[0],region,name:"Warden "+r.warden,level:r.wardenLevel,roster});
      }
      return cards;
    }

    function prepare(options) {
      if(!options||typeof options!=="object"||game.state.battle)return null;
      const region=options.region===undefined?game.state.region:options.region;
      const target=targets(region).find(t=>t.kind===options.kind&&(t.kind==="warden"?
        options.foe==null||t.roster.includes(options.foe):t.foe===options.foe));
      if(!target)return null;
      const ids=options.team===undefined?game.state.team:options.team;
      if(!Array.isArray(ids))return null;
      const lead=options.lead===undefined?(ids.includes(game.state.lead)?game.state.lead:ids[0]):options.lead;
      const build=game.rehearsalTeam(ids,lead,target.roster,target.region);
      if(!build)return null;
      const setup={kind:target.kind,region,foe:target.foe,lead,team:ids.slice()};
      return ()=>{
        const branch=build(),result=branch.startBattle(target.kind,target.foe);
        if(!result.ok)return null;
        return {game:branch,target,setup,phase:"battle",result,history:[]};
      };
    }

    function preview(options) {return prepare(options)?.()?.game||null;}

    // A hypothetical charged hit from full health, without claiming earlier
    // exchanges took place. A different Warden member may be at the front here.
    function reference(options,foeId) {
      const scene=prepare(options)?.();
      if(!scene)return null;
      const scope=scene.game,b=scope.state.battle,order=scene.target.roster;
      const at=order.indexOf(foeId===undefined?scene.target.foe:foeId);
      if(at<0)return null;
      b.enemy=scope.loaner(order[at],scene.target.level);
      b.remaining=order.slice(at+1).concat(order.slice(0,at));
      for(b.turn=1;b.turn<=24;b.turn++){
        const intent=scope.foeIntent();
        if(intent.charged&&!intent.support&&intent.power>0)return scope;
      }
      return null;
    }

    function start(options) {
      const build=prepare(options),next=build?.();
      if(!next)return error("Choose a local track or a Warden you have met, and a lead from your owned team. Finish any trail battle first.");
      run=next;reopen=build;undo=null;
      return run.result;
    }
    function read() {
      return run?{...run,canRewind:!!undo,rewindLabel:undo?.label||null}:null;
    }
    function label(scope,method,first,second) {
      const kin=id=>scope.kin(id,{owned:true})?.name;
      const front=scope.kin(scope.state.battle.activeId,{owned:true});
      switch(method){
        case "useSkill":return front.skills.find(s=>s.id===first)?.name||scope.ordinaryForecast(first)?.skill.name;
        case "useItem":return scope.items[first]?.name+" for "+kin(second||front.id);
        case "swap":return "Switch to "+kin(first);
        case "replaceFainted":return "Send in "+kin(first);
        case "useDuet":return scope.duetPair(front.id,first)?.name;
        case "useFamilyTechnique":return (scope.familyTechnique()?.name||"Pass")+" to "+kin(first);
        case "useEmberTechnique":return scope.emberTechnique()?.name;
        case "flee":return "Call your team back";
      }
    }
    function act(method,...args) {
      if(!run||run.phase!=="battle")return error("Start a rehearsal before choosing a move.");
      if(typeof method!=="string"||!Object.hasOwn(arity,method))return error("Choose a rehearsal move.");
      const [min,max]=arity[method];
      if(args.length<min||args.length>max||args.some(a=>typeof a!=="string"))return error("Choose a rehearsal move and its listed target.");
      if(method==="useItem"&&!medicines.has(args[0]))return error("Only trail medicines are used in a rehearsal.");
      const branch=run.game,b=branch.state.battle;
      if(!b)return error("This rehearsal has already ended.");
      const checkpoint=branch.checkpoint(),previous=run,title=label(branch,method,...args);
      const entry={turn:b.turn,activeId:b.activeId,foe:b.enemy.id,method,args:args.slice()};
      const outcome=branch[method](...args);
      if(!outcome.ok)return outcome;
      undo={checkpoint,previous,label:title||"Previous move"};
      run={...run,phase:branch.state.battle?"battle":"done",result:outcome,
        history:[...run.history,{...entry,label:undo.label,kind:outcome.kind,message:outcome.message}].slice(-64)};
      return outcome;
    }
    function rewind(){
      if(!undo)return error("Play a move before returning to an earlier decision.");
      const previous=undo;
      previous.checkpoint();run=previous.previous;undo=null;
      return {ok:true,kind:"rewind",message:"Returned to the decision before "+previous.label+"."};
    }
    function retry(){
      if(!reopen)return error("Choose a team and opponent first.");
      run=reopen();undo=null;
      return run.result;
    }
    function leave(){run=null;undo=null;reopen=null;return {ok:true,kind:"left",message:"Rehearsal closed."};}
    return {targets,preview,reference,start,read,act,rewind,retry,leave};
  }
  window.WilderRehearsal=Object.freeze({create});
})();
