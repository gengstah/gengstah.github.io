(() => {
  "use strict";

  const SAVE_KEY = "wilderkin.trail.v3";
  const CHECKPOINT_KEY = "wilderkin.trail.checkpoint.v1";
  const DAMAGED_KEY = "wilderkin.trail.unreadable.v1";
  const LEGACY_KEYS = ["wilderkin.trail.v2","wilderkin.trail.v1"];
  const MAX_LEVEL = 180;
  const wildLevelGap = 8;
  const campaign = window.WilderCampaign;
  const story = window.WilderStory;
  const items = campaign.items;
  const starters = ["sprigkit", "cindlet", "dewfin"];
  const dex = window.WilderKinDex;
  const activities = window.WilderActivities;
  const crossingQuests = new Map(activities.quests.filter(q=>q.crossing).map(q=>[q.crossing.to,q]));

  function strike(id, name, type, power, description, guard = false) {
    return { id, name, type, power, kind: guard ? "guard" : "attack", description };
  }

  function mend(id, name, description) {
    return { id, name, type: "Neutral", kind: "heal", description };
  }

  const originalSpecies = {
    sprigkit: {
      id: "sprigkit", name: "Sprigkit", type: "Grove", baseHp: 32,
      description: "Its leaf-tipped ears turn toward birdsong. A Sprigkit that trusts you will leave a fern at your feet.",
      skills: [
        strike("leaf-flurry", "Leaf Flurry", "Grove", 9, "Send a swirl of sharp leaves. Strong against Tide."),
        strike("brush-dash", "Brush Dash", "Neutral", 6, "Strike from cover and halve the next hit.", true),
        mend("sun-nap", "Sun Nap", "Bask in a patch of sunlight to recover one third of your health.")
      ]
    },
    cindlet: {
      id: "cindlet", name: "Cindlet", type: "Ember", baseHp: 28,
      description: "This curious little fire drake sneezes sparks into cold campfires. The flame on its tail burns brightest at play.",
      skills: [
        strike("ember-pop", "Ember Pop", "Ember", 10, "Spit a bright burst of sparks. Strong against Grove."),
        strike("cinder-roll", "Cinder Roll", "Neutral", 6, "Tumble through the foe and halve the next hit.", true),
        mend("rekindle", "Rekindle", "Stoke your inner flame to recover one third of your health.")
      ]
    },
    dewfin: {
      id: "dewfin", name: "Dewfin", type: "Tide", baseHp: 30,
      description: "It paddles upstream on moonlit nights. Its feathery fins can feel a raindrop hit the water from a whole pond away.",
      skills: [
        strike("bubble-jet", "Bubble Jet", "Tide", 9, "Loose a jet of cool water. Strong against Ember."),
        strike("slick-slide", "Slick Slide", "Neutral", 7, "Slip past the foe and halve the next hit.", true),
        mend("dew-bath", "Dew Bath", "Draw in the morning dew to recover one third of your health.")
      ]
    },
    mossbell: {
      id: "mossbell", name: "Mossbell", type: "Grove", baseHp: 35,
      description: "A tiny garden grows on its shell. The flowers ring softly when this patient trailkeeper feels rain coming.",
      skills: [
        strike("briar-bloom", "Briar Bloom", "Grove", 9, "Spring a tangle of thorny vines. Strong against Tide."),
        strike("shell-bump", "Shell Bump", "Neutral", 7, "Tuck into your shell to strike and halve the next hit.", true),
        mend("root-rest", "Root Rest", "Draw strength from the soil to recover one third of your health.")
      ]
    },
    coalmoth: {
      id: "coalmoth", name: "Coalmoth", type: "Ember", baseHp: 29,
      description: "Its ember-speckled wings look like drifting coals after sunset. Miners once followed these moths to find paths through the smoke.",
      skills: [
        strike("flare-wing", "Flare Wing", "Ember", 10, "Fan a wave of hot sparks. Strong against Grove."),
        strike("ash-veil", "Ash Veil", "Neutral", 6, "Buffet the foe with ash and halve the next hit.", true),
        mend("coal-glow", "Coal Glow", "Rest in a warm glow to recover one third of your health.")
      ]
    },
    glimmeray: {
      id: "glimmeray", name: "Glimmeray", type: "Tide", baseHp: 31,
      description: "On still evenings it lifts from the water and glides through the reeds. Each spot on its back shines like a star reflected in the lake.",
      skills: [
        strike("lunar-surge", "Lunar Surge", "Tide", 10, "Draw a rising wave from the moonpool. Strong against Ember."),
        strike("mirror-glide", "Mirror Glide", "Neutral", 7, "Skim past in a flash of light and halve the next hit.", true),
        mend("stillwater", "Stillwater", "Settle into a quiet current to recover one third of your health.")
      ]
    }
  };

  const species = dex.expand(originalSpecies);
  const regularCount=Object.values(species).filter(k=>!k.bonus).length;
  const regions = window.WilderAtlas.regions;
  const wardens = regions.map((r, i) => r.warden ? i : -1).filter(i => i >= 0);
  const pools = dex.encounterPools;
  const homes = {...dex.homes},nativePools=dex.nativePools;
  if(species.stillwake)homes.stillwake=[regions.length-1];
  const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
  const enrolled = (id, party) => party.some(p => p.id === id);

  const hpAt = (id, level) => species[id].baseHp + (level - 5) * 3;
  const xpNeeded = level => 16 + level * 3;
  const makeMember = (id, level) => ({ id, level, hp: hpAt(id, level), maxHp: hpAt(id, level), xp: 0 });
  const result = (kind, message) => ({ ok: kind !== "error", kind, message });
  const error = message => result("error", message);
  const validSpecies = id => typeof id === "string" && Object.hasOwn(species, id);
  const validRegion = index => Number.isInteger(index) && index >= 0 && index < regions.length;
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const unique = values => Array.from(new Set(values));
  const relayStamps = ["bell|gustlance","bell|galeskip","ferry|gustlance","ferry|galeskip"];
  const field=window.WilderFieldwork?.create({species,pools,regions});
  const walking=window.WilderWalkingPartner?.create({species,regions});
  const growth=window.WilderGrowth;
  const coaches=window.WilderWardens;
  const guardSchool=window.WilderGuardSchool;
  const fittings=window.WilderTrailFittings;
  const firstBattleRules=window.WilderFirstBattle;
  const calls=window.WilderWildCalls;
  const wildCard=id=>validSpecies(id) ? calls?.forKin(id,species[id]) : null;

  function wardenRoster(index) {
    const r=regions[index];
    if(!r?.warden)return [];
    const pool=nativePools[index],n=r.ordinal;
    const size=n===0?1:n<3?2:n<9?3:n<18?4:n<24?5:6;
    return [...Array.from({length:size-1},(_,k)=>pool[1+k%(pool.length-1)]),pool[0]];
  }

  // The trail and each camp rehearsal share species and rules. Every mutable
  // combat binding, including queued equipment effects, belongs to its instance.
  function createInstance(privateState) {
  const rehearsal=!!privateState;
  const pendingFittingEvents=[];
  let exchange=null;

  // Resolve and save a turn once. The detached snapshots let each animation show
  // its own HP values even after a knockout changes the lineup or restores camp HP.
  function withImpacts(action) {
    return (...args)=>{
      const b=state.battle;
      if(!b)return action(...args);
      const previous=exchange;
      exchange={hp:new Map([...team(),b.enemy].map(p=>[p,p.hp])),front:{ally:member(b.activeId),foe:b.enemy},impacts:{}};
      try{
        const result=action(...args);
        if(result.ok&&exchange.impacts.ally)result.impacts=exchange.impacts;
        return result;
      }finally{exchange=previous;}
    };
  }
  function recordImpact(side,message) {
    if(!exchange)return;
    function health(p) {
      const {id,hp,maxHp,level}=p,change=hp-(exchange.hp.get(p)??hp);
      return {id,hp,maxHp,level,change};
    }
    function snapshot(p,target) {
      const previous=exchange.front[target],changedFront=p!==previous;
      exchange.front[target]=p;
      const result={...health(p),changedFront};
      if(changedFront && previous.hp!==exchange.hp.get(previous))result.departing=health(previous);
      return result;
    }
    const b=state.battle;
    exchange.impacts[side]={ally:snapshot(member(b.activeId),"ally"),foe:snapshot(b.enemy,"foe"),message};
    if(side==="ally")exchange.hp=new Map([...team(),b.enemy].map(p=>[p,p.hp]));
  }

  function newGame() {
    return {
      version: 3, region: 0, positions: {}, party: starters.map(id => makeMember(id, 5)),
      lead: starters[0], crests: [], met: [], seen: starters.slice(), battle: null, firstOuting:window.WilderOpening?"new":"closed",
      team: starters.slice(), visited: [0], quests: {}, clears: {}, rests: 0,lastCamp:{region:0,site:0},firstBattle:null,
      sound: true, wins: 0, bag:{reed:5,sap:5,ore:2,kinweave:4,balm:3,tonic:1,sparkseed:1,broth:0},reports:[],
      surveys:{},localWins:{},licenses:[],passes:[],crafted:{},landmark:null,forageReady:true,wardenLessons:[],relayClears:[],trainedGuards:[],bellMarks:{},
      trailFittings:fittings?.empty()||{claimed:[],gear:{}},fittingNotes:{},thirdBeat:{},
      stillwake:window.WilderStillwake?.restore(null)||{},
      story:story.restore(null),refit:0,animationSpeed:1,music:1,growth:growth?.restore(null)||{},
      fieldwork:field?.restore(null)||{},caravan:window.WilderCaravans?.restore(null,[])||{},
      circuit:window.WilderTrials?.restore(null)??null,pins:[],destination:null,
      sparring:window.WilderSparring?.restore(null,{species})??null,
      walking:walking?.restore(null,[])||{},hollows:window.WilderHollows?.restore(null)||{}
    };
  }

  function validFighter(fighter) {
    return fighter && validSpecies(fighter.id) && integer(fighter.level, 1, MAX_LEVEL)
      && fighter.maxHp === hpAt(fighter.id, fighter.level) && integer(fighter.hp, 0, fighter.maxHp);
  }

  const bellEligible=(s,i)=>i===wardens[0]||s.crests.includes(i);
  function publishedBell(s,i) {
    if (!wardens.includes(i)) return null;
    const party=s.team.map(id=>s.party.find(p=>p.id===id));
    return window.WilderSecondBell?.card({region:i,regions,wardens,pools:nativePools,species,dex,party,crests:s.crests})||null;
  }

  function readBellMark(s,i,mark) {
    if (!bellEligible(s,i) || !mark || !Array.isArray(mark.team) || !integer(mark.team.length,1,6) ||
        !integer(mark.standing,1,mark.team.length) || unique(mark.team).length!==mark.team.length ||
        !mark.team.every(id=>enrolled(id,s.party))) return null;
    const floor=regions[i].wardenLevel;
    const ceiling=Math.max(floor,...s.party.filter(p=>mark.team.includes(p.id)).map(p=>p.level));
    return integer(mark.level,floor,ceiling) ? {level:mark.level,standing:mark.standing,team:mark.team.slice()} : null;
  }

  // The printed team stays fixed during a bout. Its surviving members can be in any order after Warden relays.
  function readBellFight(s,b) {
    const rec=b.secondBell;
    if (!rec || b.kind!=="warden" || rec.region!==s.region || !bellEligible(s,s.region) ||
        s.landmark!=="warden" || !Array.isArray(rec.roster) || !Array.isArray(rec.defeated) ||
        !Array.isArray(b.remaining) || !rec.entryHp || typeof rec.entryHp!=="object" ||
        Object.keys(rec.entryHp).length!==s.team.length || !s.team.every(id=>
          integer(rec.entryHp[id],0,s.party.find(p=>p.id===id).maxHp))) return null;
    const card=publishedBell(s,s.region);
    if (!card || rec.level!==card.level || b.enemy?.level!==card.level || rec.roster.length!==card.roster.length ||
        !card.roster.every((id,n)=>id===rec.roster[n])) return null;
    const lineup=[...rec.defeated,b.enemy.id,...b.remaining];
    if (lineup.length!==card.roster.length || unique(lineup).length!==lineup.length ||
        !lineup.every(id=>card.roster.includes(id))) return null;
    if (!Array.isArray(b.reserveHp) || (b.reserveHp.length!==0 &&
        (b.reserveHp.length!==b.remaining.length || !b.reserveHp.every((hp,i)=>integer(hp,1,hpAt(b.remaining[i],card.level)))))) return null;
    return {region:s.region,level:card.level,roster:card.roster.slice(),entryHp:{...rec.entryHp},defeated:rec.defeated.slice()};
  }

  function restoreBellHp(s,entryHp) {
    for (const p of s.party) {
      if (s.team.includes(p.id) && integer(entryHp?.[p.id],0,p.maxHp)) p.hp=entryHp[p.id];
    }
  }

  function readWildCall(s,b) {
    const raw=b.wildCall,quarry=b.enemy.id,card=wildCard(quarry);
    if (b.kind!=="wild" || !card || raw?.quarry!==quarry || enrolled(quarry,s.party)) return null;
    const clean={quarry},answer=raw.answered;
    if (!answer || b.turn<2 || b.pendingFallen) return clean;
    const {actor,skill,partner}=answer;
    const conscious=id=>s.team.includes(id) && s.party.some(p=>p.id===id && p.hp>0);
    if (!conscious(actor)) return clean;
    if (card.pass) {
      if (skill===card.pass && window.WilderFamilyTechniques?.forKin(actor)?.id===skill &&
          conscious(partner) && partner!==actor && b.activeId===partner && b.familyUsed===true &&
          integer(b.beats,0,2) && !b.enemy.beaconMarked) {
        clean.answered={actor,skill,partner};
      }
    } else if (actor===b.activeId && partner===undefined && calls.answeringMoves(species[actor],card).some(s=>s.id===skill)) {
      clean.answered={actor,skill};
    }
    return clean;
  }

  let lastStoredTrail=null,lastValidTrail=null,recovery=null,canSave=true,checkpointPending=false;
  function loadGame() {
    try {
      lastStoredTrail=window.localStorage.getItem(SAVE_KEY);
      const loaded=decodeTrail(lastStoredTrail);
      if(loaded){lastValidTrail=lastStoredTrail;return loaded;}
      // Missing storage is a new trail, including an intentional deletion. Only
      // consult the recovery checkpoint when an existing primary is unreadable.
      const damaged=lastStoredTrail!=null;
      if(damaged)recovery="fresh";
      for(const key of damaged?[CHECKPOINT_KEY,...LEGACY_KEYS]:LEGACY_KEYS){
        const raw=window.localStorage.getItem(key),decoded=decodeTrail(raw);
        if(decoded){
          lastValidTrail=raw;
          if(damaged)recovery="recovered";
          return decoded;
        }
      }
    }catch{canSave=false;}
    return newGame();
  }

  function readSave(saved) {
    const fresh = newGame();
    if (!saved || ![1,2,3].includes(saved.version) || !Array.isArray(saved.party)
      || !starters.every(id => saved.party.some(p => p?.id === id))
      || !saved.party.every(p => validFighter(p) && integer(p.xp, 0, xpNeeded(p.level) - 1))
      || unique(saved.party.map(p => p.id)).length !== saved.party.length) return null;
    fresh.party = saved.party;
    fresh.thirdBeat=window.WilderThirdBeat?.restore(saved.thirdBeat,{species,regions,party:fresh.party})||{};
    if (Array.isArray(saved.trainedGuards)) {
      fresh.trainedGuards=[...new Set(saved.trainedGuards)].filter(id=>enrolled(id,fresh.party)&&guardSchool?.forKin(id));
    }
    fresh.firstOuting=window.WilderOpening?.restore(saved.firstOuting)??"closed";
    fresh.stillwake=window.WilderStillwake?.restore(saved.stillwake,fresh.party)||{};
    fresh.growth=growth?.restore(saved.growth)||{};
    fresh.animationSpeed=[1,2,3].includes(saved.animationSpeed)?saved.animationSpeed:1;
    fresh.music=[0,1,2].includes(saved.music)?saved.music:saved.sound===false?0:1;
    fresh.fieldwork=field?.restore(saved.fieldwork)||{};
    fresh.caravan=window.WilderCaravans?.restore(saved.caravan,fresh.party)||{};
    fresh.circuit=window.WilderTrials?.restore(saved.circuit)??null;
    fresh.sparring=window.WilderSparring?.restore(saved.sparring,{species})??null;
    fresh.pins=unique((Array.isArray(saved.pins)?saved.pins:[]).filter(validRegion));
    fresh.destination=fresh.pins.includes(saved.destination)?saved.destination:null;
    fresh.walking=walking?.restore(saved.walking,fresh.party)||{};
    fresh.hollows=window.WilderHollows?.restore(saved.hollows)||{};
    fresh.reports=unique((Array.isArray(saved.reports)?saved.reports:[]).filter(i=>validRegion(i)&&i>=3));
    fresh.team = unique((Array.isArray(saved.team) ? saved.team : fresh.party.map(p => p.id))
      .filter(id => enrolled(id, fresh.party))).slice(0, 6);
    if (!fresh.team.length) fresh.team = starters.slice();
    for (const i of wardens) {
      if (!Array.isArray(saved.crests) || !saved.crests.includes(i)) break;
      fresh.crests.push(i);
    }
    fresh.trailFittings=fittings?.restore(saved.trailFittings,fresh)||fresh.trailFittings;
    fresh.fittingNotes=window.WilderFittingNotes?.restore(saved.fittingNotes)||{};
    fresh.met = unique([...(Array.isArray(saved.met) ? saved.met.filter(i => wardens.includes(i)) : []), ...fresh.crests]);
    fresh.wardenLessons=fresh.crests.filter(i=>Array.isArray(saved.wardenLessons)&&saved.wardenLessons.includes(i));
    for (const i of wardens) {
      const mark=readBellMark(fresh,i,saved.bellMarks?.[i]);
      if (mark) fresh.bellMarks[i]=mark;
    }
    if (Array.isArray(saved.relayClears)) fresh.relayClears=unique(saved.relayClears.filter(stamp=>relayStamps.includes(stamp)));
    fresh.seen = unique([...(Array.isArray(saved.seen) ? saved.seen.filter(validSpecies) : []), ...fresh.party.map(p => p.id)]);
    if (validRegion(saved.region)) fresh.region = saved.region;
    const visited = Array.isArray(saved.visited) ? saved.visited : Object.keys(saved.positions || {}).map(Number);
    fresh.visited = unique([0, ...visited.filter(validRegion), ...fresh.crests, fresh.region]);
    fresh.rests = count(saved.rests);
    const camp=saved.lastCamp;
    if (saved.version===3 && camp && fresh.visited.includes(camp.region) && Number.isSafeInteger(camp.site) && camp.site>=0) {
      fresh.lastCamp={region:camp.region,site:camp.site};
    }
    for (const q of activities.quests) {
      if (["active", "claimed"].includes(saved.quests?.[q.id])) fresh.quests[q.id] = saved.quests[q.id];
    }
    for (const g of activities.games) {
      if (count(saved.clears?.[g.id])) fresh.clears[g.id] = saved.clears[g.id];
    }
    for (let i = 0; i < regions.length; i++) {
      const point = saved.positions?.[i];
      if (point && integer(point.x, 0, 999) && integer(point.y, 0, 999)) fresh.positions[i] = { x: point.x, y: point.y };
    }
    fresh.lead = fresh.team.includes(saved.lead) ? saved.lead : fresh.team[0];
    if (typeof saved.sound === "boolean") fresh.sound = saved.sound;
    if (Number.isSafeInteger(saved.wins) && saved.wins >= 0) fresh.wins = saved.wins;
    const resumed = saved.version===3;
    fresh.story = story.restore(saved.story);
    if (resumed) {
      for (const id of Object.keys(items)) {
        fresh.bag[id] = count(saved.bag?.[id]);
        if (count(saved.crafted?.[id])) fresh.crafted[id]=saved.crafted[id];
      }
      fresh.licenses = unique((Array.isArray(saved.licenses)?saved.licenses:[]).filter(id=>Object.hasOwn(dex.abilities,id)));
      fresh.passes = unique((Array.isArray(saved.passes)?saved.passes:[]).filter(id=>activities.games.some(g=>g.id===id)));
      fresh.landmark = ["camp","warden","wild","travel","activities"].includes(saved.landmark) ? saved.landmark : null;
      fresh.forageReady = saved.forageReady !== false;
      fresh.refit = integer(saved.refit,0,MAX_LEVEL) ? saved.refit : 0;
    } else {
      fresh.passes = Object.keys(fresh.clears);
      if (fresh.region>=3 && Math.max(...fresh.party.map(p=>p.level))+10<regions[fresh.region].wildLevel) {
        fresh.refit = regions[fresh.region].wildLevel;
      }
    }
    for (let i=0;i<regions.length;i++) {
      const completed = resumed ? count(saved.surveys?.[i]) : regions[i].requiredCrests < fresh.crests.length ? campaign.length(i) : 0;
      if (completed) fresh.surveys[i]=Math.min(completed,campaign.length(i));
      if (resumed && count(saved.localWins?.[i])) fresh.localWins[i]=saved.localWins[i];
    }
    const battle = saved.battle;
    const exhibition=battle && (battle.mode==="second-bell" || Object.hasOwn(battle,"secondBell"));
    const bell=exhibition ? readBellFight(fresh,battle) : null;
    const opponentPool=bell?bell.roster:(battle?.kind==="wild"?pools:nativePools)[fresh.region];
    if (battle && ["wild","warden","expedition"].includes(battle.kind) && validFighter(battle.enemy) && battle.enemy.hp > 0
      && (!exhibition||bell) && opponentPool.includes(battle.enemy.id) && fresh.team.includes(battle.activeId) && fresh.party.some(p => p.id === battle.activeId && p.hp > 0)
      && Number.isSafeInteger(battle.turn) && battle.turn >= 1 && Array.isArray(battle.log)) {
      fresh.battle = {
        kind: battle.kind, activeId: battle.activeId, enemy: battle.enemy, turn: battle.turn,
        remaining: battle.kind !== "wild" && Array.isArray(battle.remaining) ? battle.remaining.filter(id => opponentPool.includes(id)).slice(0, 6) : [],
        commissioned: battle.kind === "expedition" && count(battle.commissioned) === count(fresh.surveys[fresh.region]) ? count(battle.commissioned) : null,
        bonus: battle.bonus === "supplies" ? "supplies" : null,
        weather: Object.hasOwn(dex.types,battle.weather) ? battle.weather : null,
        condition:Object.hasOwn(campaign.conditions,battle.condition)?battle.condition:null,
        lastAttack:typeof battle.lastAttack==="string"?battle.lastAttack:null,
        beats:integer(battle.beats,0,3)?battle.beats:1,
        lastPart:["strike","guard","care","switch"].includes(battle.lastPart)?battle.lastPart:null,
        opening:battle.opening===true,
        familyUsed:battle.familyUsed===true,
        shellGuard:battle.shellGuard===battle.activeId && fresh.trainedGuards.includes(battle.activeId) &&
          guardSchool?.forKin(battle.activeId)?.id==="shell" ? battle.activeId : null,
        cover:integer(battle.cover,0,2)?battle.cover:0,reserveHp:[],
        log: battle.log.filter(entry => typeof entry === "string").slice(-8)
      };
      const rest=fresh.battle.remaining;
      if (Array.isArray(battle.emberUsers)) {
        fresh.battle.emberUsers=[...new Set(battle.emberUsers)].filter(id=>fresh.team.includes(id)&&species[id].emberArt);
        if (battle.emberBrace===battle.activeId && fresh.battle.emberUsers.includes(battle.activeId) &&
            species[battle.activeId].emberArt.id==="banked-warmth") fresh.battle.emberBrace=battle.activeId;
      }
      if (!species[battle.enemy.id].emberArt || battle.enemy.emberArtSpent!==true) delete fresh.battle.enemy.emberArtSpent;
      if (!fresh.battle.enemy.emberArtSpent || species[battle.enemy.id].emberArt?.id!=="banked-warmth" ||
          battle.enemy.emberBrace!==true)delete fresh.battle.enemy.emberBrace;
      if (Array.isArray(battle.reserveEmber) && rest.length===battle.reserveEmber.length) {
        fresh.battle.reserveEmber=rest.map((id,i)=>Boolean(species[id].emberArt && battle.reserveEmber[i]===true));
      }
      if(!exhibition&&resumed&&battle.trailFittings){
        const kit=fittings?.restoreFight(fresh,battle.trailFittings);
        if(kit)fresh.battle.trailFittings=kit;
      }
      if (bell) Object.assign(fresh.battle,{mode:"second-bell",secondBell:bell});
      if (resumed && battle.wildCall) {
        const call=readWildCall(fresh,battle);
        if (call) fresh.battle.wildCall=call;
      }
      const fallen=fresh.party.find(p=>p.id===battle.pendingFallen);
      if (fallen?.hp===0 && fresh.team.includes(fallen.id) && battle.turn>1 &&
          fresh.team.filter(id=>fresh.party.find(p=>p.id===id).hp>0).length>1) {
        fresh.battle.pendingFallen=fallen.id;
      }
      if (battle.enemy.pincerOpening!==true || !fresh.trainedGuards.some(id=>guardSchool.forKin(id)?.id==="pincer")) delete fresh.battle.enemy.pincerOpening;
      if (!fresh.battle.familyUsed || battle.enemy.beaconMarked!==true) delete fresh.battle.enemy.beaconMarked;
      if(fresh.battle.familyUsed && !fresh.battle.enemy.beaconMarked && rest.length===battle.remaining?.length &&
        integer(battle.beaconReserve,0,rest.length-1)) fresh.battle.beaconReserve=battle.beaconReserve;
      if(battle.kind==="warden"&&coaches)fresh.battle.coach=coaches.restore(battle.coach,regions[fresh.region]);
      if(Array.isArray(battle.reserveHp)&&battle.reserveHp.length===rest.length){
        fresh.battle.reserveHp=rest.map((id,i)=>integer(battle.reserveHp[i],1,hpAt(id,battle.enemy.level))?battle.reserveHp[i]:hpAt(id,battle.enemy.level));
      }
      if(resumed&&!exhibition)restoreTrio(fresh,battle,opponentPool);
    }
    if (exhibition && !fresh.battle) restoreBellHp(fresh,battle.secondBell?.entryHp);
    // A resting team can return to the lodge with exactly the zero HP it brought to an exhibition.
    else if ((battle || fresh.landmark!=="warden") && !fresh.team.some(id=>fresh.party.find(p=>p.id===id)?.hp>0)) {
      fresh.party.forEach(p=>{p.hp=p.maxHp;});
    }
    if(resumed&&firstBattleRules&&validSpecies(firstBattleRules.foe)){
      const level=regions[0].wildLevel;
      fresh.firstBattle=firstBattleRules.restore(saved.firstBattle,fresh,battle,hpAt(firstBattleRules.foe,level),level);
    }
    return fresh;
  }

  let state = privateState || loadGame();
  let usingLoaners=false;
  // Two online tabs can play the same career. Their footsteps belong to the
  // individual tabs; campaign rewards and battles still use the shared save.
  const roomFootsteps="wilderkin.realm.footsteps.v1";
  const soloReturn="wilderkin.trail.return-v1";
  let onlineWalker=null,suspendedWalk=null,walkRevision,walkStamp="";
  const landmarkKinds=["camp","warden","wild","travel","activities"];
  function footstepRevision(){
    // Only compute the compact session bookmark when the durable career changes.
    // Campaign transactions themselves always compare the complete stored bytes.
    if(walkRevision===lastStoredTrail)return walkStamp;
    const raw=lastStoredTrail||"";let a=2166136261,b=5381;
    for(let i=0;i<raw.length;i++){const n=raw.charCodeAt(i);a=Math.imul(a^n,16777619);b=Math.imul(b,33)^n;}
    walkRevision=lastStoredTrail;walkStamp=raw.length+"-"+(a>>>0)+"-"+(b>>>0);
    return walkStamp;
  }
  function rememberFootsteps(dirty){
    if(!onlineWalker)return;
    const r=state.region,p=state.positions[r]||window.WilderWorld?.regions[r]?.spawn;
    if(!p)return;
    onlineWalker.dirty=dirty;
    if(!dirty)onlineWalker.tiles={};
    else onlineWalker.tiles[r]={x:p.x,y:p.y};
    onlineWalker.pose={id:onlineWalker.id,base:footstepRevision(),dirty,tiles:onlineWalker.tiles,
      region:r,x:p.x,y:p.y,landmark:state.landmark,last:state.walking?.last||null};
    try{window.sessionStorage?.setItem(roomFootsteps,JSON.stringify(onlineWalker.pose));}catch{}
  }
  function resumeFootsteps(p,id){
    const world=window.WilderWorld;
    if(!p||typeof id!=="string"||!/^[a-f0-9]{24}$/.test(id)||p.id!==id||p.base!==footstepRevision()||state.battle||
      !state.visited.includes(p.region)||!world?.walkable(p.region,p.x,p.y))return false;
    if(p.tiles&&typeof p.tiles==="object"&&!Array.isArray(p.tiles)){
      for(const r of state.visited){
        const tile=p.tiles[r];
        if(tile&&world.walkable(r,tile.x,tile.y)){
          state.positions[r]={x:tile.x,y:tile.y};
          if(onlineWalker)onlineWalker.tiles[r]={...state.positions[r]};
        }
      }
    }
    state.region=p.region;state.positions[p.region]={x:p.x,y:p.y};
    state.landmark=landmarkKinds.includes(p.landmark)&&nearSite(p.landmark)?p.landmark:null;
    const last=p.last;
    if(state.walking)state.walking.last=last?.region===p.region&&
      Math.abs(last.x-p.x)+Math.abs(last.y-p.y)===1&&world.walkable(p.region,last.x,last.y)?{region:p.region,x:last.x,y:last.y}:null;
    return true;
  }
  function realmWalking(mode,id){
    if(rehearsal||usingLoaners)return false;
    if(mode==="solo"){
      if(onlineWalker||!trailSaveIsCurrent())return false;
      try{
        const raw=window.localStorage.getItem(soloReturn);
        const saved=raw&&raw.length<8000?JSON.parse(raw):null;
        return resumeFootsteps(saved,saved?.id);
      }catch{return false;}
    }
    if(mode==="join"){
      if(typeof id!=="string"||!/^[a-f0-9]{24}$/.test(id))return false;
      if(onlineWalker?.id===id)return true;
      let saved=suspendedWalk;
      try{const raw=window.sessionStorage?.getItem(roomFootsteps);if(raw&&raw.length<8000)saved=JSON.parse(raw);}catch{}
      onlineWalker={id,pose:null,tiles:{},dirty:false};suspendedWalk=null;
      const restored=resumeFootsteps(saved,id);
      rememberFootsteps(restored&&saved.dirty===true);return true;
    }
    if(!onlineWalker||!["leave","suspend"].includes(mode))return false;
    const {dirty,pose}=onlineWalker;
    onlineWalker=null;
    if(mode==="suspend"){suspendedWalk=pose;return true;}
    suspendedWalk=null;try{window.sessionStorage?.removeItem(roomFootsteps);}catch{}
    // Even a write arriving between the checks can only race with a position
    // bookmark. Returning from a realm never writes the career document.
    if(!currentForEdit())return false;
    if(!dirty||state.battle)return true;
    try{window.localStorage.setItem(soloReturn,JSON.stringify(pose));}catch{}
    return currentForEdit();
  }

  const changedTrail=()=>({...error("Your trail changed in another tab. Its latest position is open."),code:"changed"});
  function decodeTrail(raw){
    try{return raw?readSave(JSON.parse(raw)):null;}catch{return null;}
  }
  function replaceTrail(next){
    for(const key of Object.keys(state))if(!Object.hasOwn(next,key))delete state[key];
    Object.assign(state,next);
  }
  function writeCheckpoint(){
    if(!lastValidTrail||recovery||lastStoredTrail!==lastValidTrail)return;
    try{
      const storage=window.localStorage;
      if(storage.getItem(SAVE_KEY)===lastValidTrail&&storage.getItem(CHECKPOINT_KEY)!==lastValidTrail)
        storage.setItem(CHECKPOINT_KEY,lastValidTrail);
    }catch{/* The primary campaign has already been saved. */}
  }
  function scheduleCheckpoint(){
    // Keep walking and battle transactions to one synchronous storage write.
    if(checkpointPending||!window.setTimeout||recovery)return;
    checkpointPending=true;
    window.setTimeout(()=>{checkpointPending=false;writeCheckpoint();},1000);
  }
  if(!rehearsal){
    window.addEventListener?.("pagehide",writeCheckpoint);
    if(lastStoredTrail&&lastStoredTrail===lastValidTrail)scheduleCheckpoint();
  }
  function adoptTrail(latest){
    // A deletion starts a fresh trail. A damaged foreign write never destroys the last known valid career.
    const supplied=decodeTrail(latest);
    if(supplied||latest==null)lastValidTrail=latest;
    const fallback=!supplied&&latest!=null?decodeTrail(lastValidTrail):null;
    recovery=latest!=null&&!supplied?(fallback?"recovered":"fresh"):null;
    const next=supplied||fallback||newGame();
    replaceTrail(next);lastStoredTrail=latest;pendingFittingEvents.length=0;
    if(supplied){canSave=true;scheduleCheckpoint();}
    if(onlineWalker)rememberFootsteps(false);
    const EventType=window.Event||(typeof Event==="function"?Event:null);
    if(EventType)window.dispatchEvent?.(new EventType("wilder-trail-updated"));
    return false;
  }
  function currentForEdit(){
    if(rehearsal||usingLoaners)return true;
    try{
      const latest=window.localStorage.getItem(SAVE_KEY);
      return latest===lastStoredTrail||adoptTrail(latest);
    }catch{return true;}
  }
  function noteSaveAvailability(available){
    if(canSave===available)return;
    canSave=available;
    const EventType=window.Event||(typeof Event==="function"?Event:null);
    if(EventType)window.dispatchEvent?.(new EventType("wilder-save-status"));
  }
  function save() {
    if(rehearsal||usingLoaners)return true;
    try {
      // localStorage has no atomic compare-and-swap. Compare before writing and check the published bytes afterwards.
      const latest=window.localStorage.getItem(SAVE_KEY);
      if(latest!==lastStoredTrail)return adoptTrail(latest);
      if(recovery)return true;
      const raw=JSON.stringify(state);
      window.localStorage.setItem(SAVE_KEY,raw);
      const published=window.localStorage.getItem(SAVE_KEY);
      if(published!==raw&&published!==latest)return adoptTrail(published);
      lastStoredTrail=published;
      noteSaveAvailability(published===raw);
      if(canSave){lastValidTrail=raw;scheduleCheckpoint();}
    } catch {
      noteSaveAvailability(false);
    }
    if(onlineWalker)rememberFootsteps(false);
    return true;
  }

  function commit(kind, message, firstBattleReceipt=null) {
    const fittingEvents=pendingFittingEvents.splice(0);
    if(fittingEvents.length){
      const lines=fittingEvents.map(e=>e.text);
      message+=" "+lines.join(" ");
      if(state.battle)state.battle.log=[...state.battle.log,...lines].slice(-8);
    }
    if(kind==="turn"&&state.battle?.firstBattle&&!rehearsal&&!usingLoaners)firstBattleRules?.turn(state,message);
    if(!save())return changedTrail();
    const reply=result(kind,message);
    if(fittingEvents.length)reply.fittingEvents=fittingEvents;
    if(firstBattleReceipt)reply.firstBattle={...firstBattleReceipt,partyHp:{...firstBattleReceipt.partyHp}};
    return reply;
  }

  function trailSaveIsCurrent(){
    if(rehearsal)return true;
    try{return window.localStorage.getItem(SAVE_KEY)===lastStoredTrail;}
    catch{return true;}
  }
  function damagedSave(){
    if(recovery)return lastStoredTrail;
    try{return window.localStorage.getItem(DAMAGED_KEY);}catch{return null;}
  }
  function persistReplacement(next){
    if(onlineWalker||usingLoaners)return error("Leave the online room or loaner battle before restoring a campaign.");
    try{
      const storage=window.localStorage,latest=storage.getItem(SAVE_KEY);
      if(latest!==lastStoredTrail){adoptTrail(latest);return changedTrail();}
      if(recovery&&latest!==null){
        storage.setItem(DAMAGED_KEY,latest);
        if(storage.getItem(DAMAGED_KEY)!==latest)return error("Could not preserve the unreadable original. Download it in Trail settings.");
      }
      const current=storage.getItem(SAVE_KEY);
      if(current!==latest){adoptTrail(current);return changedTrail();}
      const raw=JSON.stringify(next);
      storage.setItem(SAVE_KEY,raw);
      const stored=storage.getItem(SAVE_KEY);
      if(stored!==raw){
        if(stored!==current){adoptTrail(stored);return changedTrail();}
        throw new Error("Storage did not retain the replacement");
      }
      if(next!==state)replaceTrail(next);
      lastStoredTrail=lastValidTrail=raw;recovery=null;canSave=true;
      pendingFittingEvents.length=0;writeCheckpoint();
      return result("restored","Campaign saved in "+regions[state.region].name+".");
    }catch{
      return error("The browser could not confirm this save. Enable storage or free space, then try again.");
    }
  }
  function previewBackup(raw){
    const next=decodeTrail(raw);
    if(!next)return error("That file does not contain a supported Wilderkin campaign.");
    const reviewed=JSON.stringify(state),revision=lastStoredTrail;
    const summary=regions[next.region].name+" · "+next.party.length+" companions · "+next.crests.length+
      " crests"+(next.battle?" · battle in progress":"");
    return {ok:true,summary,restore(){
      if(lastStoredTrail!==revision||JSON.stringify(state)!==reviewed)return error("Your campaign changed. Choose the backup again to review it.");
      return persistReplacement(next);
    }};
  }

  function questCrossing(index) {
    const q=crossingQuests.get(index);
    if(!q)return null;
    const {to,cause}=q.crossing;
    const open=state.visited.includes(to)||state.quests[q.id]==="claimed";
    const reason=open?"The trail to "+regions[to].name+" is open.":
      cause+" Complete “"+q.name+"” for "+q.requester.split(",")[0]+" in "+regions[q.region].name+".";
    return {to,questId:q.id,questName:q.name,postingRegion:q.region,cause,open,reason};
  }

  function access(index) {
    if (!validRegion(index)) return {open:false, reason:"Unknown trail."};
    const r = regions[index];
    if (state.visited.includes(index)) return {open:true,reason:"Previously visited"};
    const crossing=questCrossing(index);
    if(crossing&&!crossing.open)return crossing;
    if (r.ability && state.licenses.includes(r.ability)) {
      const carrier = state.party.find(p => species[p.id].ability === r.ability);
      if (carrier) return {open:true,carrier:carrier.id,reason:ownedKin(carrier.id).name+" can use "+r.ability+" to find 1 Bellstone."};
    }
    return {open:true,reason:"Open trail"};
  }

  function objective() {
    if (state.refit) return {title:"Refit the veteran party",description:"Rest at a camp to train the returning party for the new region levels.",target:state.region};
    const next = wardens.find(i => !state.crests.includes(i));
    if (next === undefined) {
      const missing=wardens.find(i=>!story.chapterDone(state,regions[i].ordinal));
      if (missing!==undefined) {
        const r=regions[missing],trail=window.WilderAtlas.routes[r.ordinal].start;
        return {title:"Recover the missing dispatch",description:"Read chapter "+(r.ordinal+1)+" in the story journal. Its trailhead is "+regions[trail].name+".",target:trail};
      }
      if (!story.ending(state)) return {title:"Write the last dispatch",description:"Read the final testimony in the story journal. Your answer determines the ending."};
      return state.party.filter(p=>!species[p.id].bonus).length < regularCount
        ? {title:"Befriend every Wilderkin",description:"Find missing companions in the field guide and follow their tracks.",collection:true}
        : {title:"The trail is yours",description:"Every crest and Wilderkin is yours. The field stations remain open."};
    }
    const firstUncharted=regions.findIndex((r,i)=>r.requiredCrests===state.crests.length && !surveyedPassage(i));
    if (firstUncharted>=0) {
      const job=expedition(firstUncharted);
      return {title:job.title,description:regions[firstUncharted].name+" · Field leg "+(job.completed+1)+" of "+job.total+". "+job.description,target:firstUncharted};
    }
    if (!story.chapterDone(state,state.crests.length)) return {title:"Hear the next dispatch",description:"Read chapter "+(state.crests.length+1)+" of the campaign before facing the Warden.",target:next};
    const r = regions[next];
    if (state.region !== next) {
      return {title:"Travel to " + r.name, description:"Warden " + r.warden + " awaits at " + r.lodge + ".", target:next};
    }
    if (!state.met.includes(next)) return {title:"Meet Warden " + r.warden, description:"Find Warden " + r.warden + " at " + r.lodge + ".", target:next};
    return {title:"Earn the " + r.crest, description:"Challenge Warden " + r.warden + " at " + r.lodge + ".", target:next};
  }

  function setPosition(x, y) {
    if (state.battle || !integer(x, 0, 999) || !integer(y, 0, 999)) return false;
    const old = state.positions[state.region];
    if (old && old.x === x && old.y === y) return true;
    state.landmark = null;
    walking?.step(state,old,{x,y});
    state.positions[state.region] = { x, y };
    if(onlineWalker&&!usingLoaners){rememberFootsteps(true);return true;}
    return save();
  }

  function travel(index,arrival) {
    if (state.battle) return error("Finish this encounter before traveling.");
    const gate = access(index);
    if (!gate.open) return error(gate.reason);
    const known=state.visited.includes(index);
    if(!known)state.visited.push(index);
    const world=window.WilderWorld,spawn=world?.regions[index]?.spawn;
    if(arrival&&world?.walkable(index,arrival.x,arrival.y))state.positions[index]={x:arrival.x,y:arrival.y};
    else if(!state.positions[index]&&spawn)state.positions[index]={x:spawn.x,y:spawn.y};
    state.region=index;state.landmark=null;
    let message="You arrived in "+regions[index].name+".";
    if(gate.carrier){
      state.bag.ore++;
      message+=" "+ownedKin(gate.carrier).name+" used "+regions[index].ability+" and found 1 Bellstone.";
    }
    if(onlineWalker&&!usingLoaners&&known){rememberFootsteps(true);return result("travel",message);}
    return commit("travel",message);
  }

  const member = id => state.party.find(p => p.id === id);
  const team = () => state.team.map(member);
  function kin(id,{owned=false}={}) {
    if(!validSpecies(id))return null;
    const base=species[id];
    return owned&&!usingLoaners&&growth&&state.growth[id]?.selected&&member(id)?growth.decorate(base,state):base;
  }
  const ownedKin=id=>kin(id,{owned:true});
  function growthInfo(id) {
    if(!growth||usingLoaners||!Object.hasOwn(state.growth,id)||!member(id))return null;
    const form=growth.info(state,id);
    return form?{...form,baseName:species[id].name}:null;
  }
  function chooseGrowth(id,discipline) {
    const f=growthInfo(id);
    if(!f||!f.atCamp)return error("Visit a trail camp with your starter to train.");
    if(!f.earned)return error(f.requirements.find(task=>!task.done).label);
    if(discipline!==null&&!f.disciplines.some(d=>d.id===discipline))return error("Choose a listed discipline.");
    state.growth[id].selected=discipline;
    return commit("growth",discipline?f.formName+" trained as a "+f.disciplines.find(d=>d.id===discipline).name+".":f.baseName+" returned to its earlier form.");
  }
  function growthAppearance(id,classic) {
    const f=growthInfo(id);
    if(!f?.selected||!f.atCamp||typeof classic!=="boolean")return error("Choose a trained starter at camp.");
    state.growth[id].classic=classic;
    return commit("appearance",f.formName+" now wears its "+(classic?"familiar":"grown")+" appearance.");
  }
  function enlist(id, replace) {
    if (state.battle) return error("Finish the battle before changing your team.");
    if (!member(id) || state.team.includes(id)) return error("Choose a companion from your reserve.");
    if (state.team.length < 6) state.team.push(id);
    else {
      const slot = state.team.indexOf(replace);
      if (slot < 0) return error("Choose a traveling companion to send to the reserve.");
      state.team[slot] = id;
      if (state.lead === replace) state.lead = id;
    }
    return commit("team", ownedKin(id).name + " joined your traveling party.");
  }
  function trailFittings(){return fittings?.describe(state,usingLoaners)||{gear:{},items:[],groups:[],atCamp:false,inBattle:!!state.battle};}
  function claimFittings(id){
    if(usingLoaners)return error("Finish this encounter before claiming fittings.");
    if(!currentForEdit())return changedTrail();
    const group=trailFittings().groups.find(g=>g.id===id);
    if(!group?.available)return error(group?.reason||"Choose a fitting kit offered at camp.");
    state.trailFittings.claimed.push(id);
    return commit("fittings","Claimed the "+group.name+" at camp.");
  }
  function equipFitting(id,item,fromId){
    if(usingLoaners||state.battle)return error("Finish this encounter before changing fittings.");
    if(!fittings)return error("The fitting case is unavailable.");
    if(!currentForEdit())return changedTrail();
    const held=Object.keys(state.trailFittings.gear).find(k=>state.trailFittings.gear[k]===item);
    if(held&&held!==id&&fromId!==held)return error("Confirm the transfer from "+ownedKin(held).name+".");
    if(fromId!==undefined&&fromId!==null&&fromId!==held)return error("The previous holder has changed.");
    const update=fittings.apply(state,{[id]:item});
    if(!update.ok)return error(update.message);
    return commit("fittings",ownedKin(id).name+(item?" equipped "+fittings.byId(item).name+".":" returned its fitting to the kit."));
  }
  function fittingReady(id,piece){
    const kit=state.battle?.trailFittings;
    return !usingLoaners&&!!kit&&kit.gear[id]===piece&&!kit.spent.includes(piece);
  }
  function fitEvent(id,holder,effect,preview,extra={}){
    const subject=ownedKin(holder).name+"’s "+fittings.byId(id).name+" ";
    return {id,holder,...extra,text:subject+effect,preview:subject+preview};
  }
  function activateFitting(event){
    if(!event||!fittingReady(event.holder,event.id))return;
    const b=state.battle;
    b.trailFittings.spent.push(event.id);pendingFittingEvents.push(event);
    if(!rehearsal)window.WilderFittingNotes?.record(state,{item:event.id,holder:event.holder,text:event.text,foe:b.enemy.id,region:state.region,turn:b.turn,kind:b.kind});
  }
  function setLead(id) {
    if (state.battle) return error("Use a battle switch to change your active companion.");
    const p = member(id);
    if (!state.team.includes(id) || !p || p.hp === 0) return error("Choose a companion with some health remaining.");
    state.lead = id;
    return commit("lead", ownedKin(id).name + " is leading your party.");
  }

  function campsIn(region) {
    return window.WilderWorld?.regions[region]?.sites.filter(site=>(site.kind||site.id)==="camp")||[];
  }

  function wakeAtCamp(enemy) {
    const origin=state.region;
    let {region,site}=state.lastCamp;
    let camp=campsIn(region)[site];
    if (!camp && window.WilderWorld) {
      region=0;site=0;camp=campsIn(region)[site];
      state.lastCamp={region,site};
    }
    delete state.positions[origin];
    state.region=region;
    state.landmark="camp";
    if (camp) state.positions[region]={x:camp.x,y:camp.y};
    if (state.walking) state.walking.last=null;
    return {foe:enemy.id,level:enemy.level,region:origin,campRegion:region,campName:camp?.label||"the trail camp"};
  }

  function heal() {
    if (state.battle) return error("Return to camp after this encounter.");
    state.party.forEach(p => { p.hp = p.maxHp; });
    let message="Your party rested. Every companion is back to full health.";
    if (state.refit) {
      for (const p of team()) {
        if(p.level<state.refit) Object.assign(p,makeMember(p.id,state.refit));
      }
      message += " Your veteran party completed its campaign retraining.";
      state.refit=0;
    }
    if (state.landmark==="camp") {
      const camps=campsIn(state.region),point=state.positions[state.region]||window.WilderWorld?.regions[state.region]?.spawn;
      const nearest=point?camps.findIndex(site=>Math.abs(site.x-point.x)+Math.abs(site.y-point.y)<=1):-1;
      if (nearest>=0) {
        state.lastCamp={region:state.region,site:nearest};
        message+=" You’ll wake at "+camps[nearest].label+" if a wild encounter knocks out your party.";
      }
    }
    state.rests++;
    return commit("healed", message);
  }

  function meetWarden() {
    if (state.battle) return error("Finish this encounter first.");
    const region = regions[state.region];
    if (!region.warden) return error("This region has no Warden trial.");
    if (!state.met.includes(state.region)) state.met.push(state.region);
    const message = state.crests.includes(state.region) ? "Good to see you again, Trailkeeper. How about a rematch?" : region.dialogue;
    return commit("dialogue", message);
  }

  function trialAccess(index=state.region) {
    const r=regions[index];
    if (!r?.warden) return {open:false,reason:"There is no Warden trial here."};
    if (state.crests.includes(index)) return {open:true,reason:"Friendly rematch"};
    if (state.crests.length!==r.ordinal) return {open:false,reason:"Earn the preceding trail crests."};
    const unfinished=regions.findIndex((area,i)=>area.ordinal===r.ordinal && !surveyedPassage(i));
    if (unfinished>=0) return {open:false,target:unfinished,reason:surveyInstruction(unfinished)};
    if (!story.chapterDone(state,r.ordinal)) return {open:false,reason:"Hear chapter "+(r.ordinal+1)+" in your story journal."};
    return {open:true,reason:"The trial is ready."};
  }

  function secondBell(index=state.region) {
    const card=publishedBell(state,index);
    if (!card) return null;
    const region=regions[index],eligible=bellEligible(state,index);
    const atLodge=state.region===index && state.landmark==="warden";
    const reason=!eligible?"Earn the "+region.crest+" to enter this exhibition." :
      !atLodge?"Visit "+region.lodge+" for this exhibition." :
      state.battle||usingLoaners?"Finish the current encounter first." : "";
    return {...card,eligible,atLodge,available:!reason,reason,mark:state.bellMarks[index]||null};
  }

  function beginEncounter(kind,ids,level,label,options={}) {
    const lead=member(state.lead);
    const ready=lead?.hp>0 ? lead : team().find(p=>p.hp>0);
    if (!ready) return error("Rest at camp before entering an encounter.");
    const enemy=makeMember(ids[0],level);
    const message=label+" "+species[enemy.id].name+" takes the field.";
    if (!options.secondBell && !state.seen.includes(enemy.id)) state.seen.push(enemy.id);
    state.battle={kind,activeId:ready.id,enemy,remaining:ids.slice(1),turn:1,
      commissioned:null,bonus:null,weather:null,condition:null,lastAttack:null,beats:1,lastPart:null,opening:false,familyUsed:false,shellGuard:null,cover:0,reserveHp:[],...options,log:[message]};
    if(fittings&&!usingLoaners&&!options.secondBell&&["wild","expedition","warden"].includes(kind)){
      const kit=fittings.fight(state);
      if(kit){
        const b=state.battle;b.trailFittings=kit;
        if(fittingReady(b.activeId,"opening-pennant")&&b.beats<3){
          b.beats++;activateFitting(fitEvent("opening-pennant",b.activeId,"raised the opening meter to "+b.beats+"/3 beats.","will add an opening beat ("+b.beats+"/3).",{beats:1}));
        }
      }
    }
    return commit("battle",message);
  }

  function beginWild(id,firstBattle=null) {
    const options=!usingLoaners && !member(id) && wildCard(id) ? {wildCall:{quarry:id}} : {};
    if(firstBattle)options.firstBattle=firstBattle;
    return beginEncounter("wild",[id],regions[state.region].wildLevel,"A trail stirs!",options);
  }

  const firstBattle=!rehearsal&&firstBattleRules?.create({
    state:()=>state,blocked:()=>usingLoaners,nearTracks:()=>nearSite("wild"),
    name:id=>ownedKin(id).name,commit,begin:beginWild
  });
  const firstBattleFinish=(kind,message)=>!rehearsal&&!usingLoaners&&state.battle?.firstBattle?
    firstBattleRules?.finish(state,kind,message):null;

  function startBattle(kind,track) {
    if (state.battle) return error("You are already in an encounter.");
    const r=regions[state.region], pool=(kind==="wild"?pools:nativePools)[state.region];
    if(kind==="first-battle"&&firstBattle){
      if(track!==undefined&&track!==firstBattleRules.foe)return error("Follow Opalclasp’s tracks for this outing.");
      return firstBattle.begin();
    }
    if (kind==="second-bell") {
      const card=secondBell();
      if (!card?.available) return error(card?.reason||"There is no Second Bell exhibition here.");
      const activeId=track===undefined ? (state.team.includes(state.lead)?state.lead:state.team[0]) : track;
      if (!state.team.includes(activeId)) return error("Choose an exhibition lead from your traveling team.");
      const travelTeam=team(),entryHp=Object.fromEntries(travelTeam.map(p=>[p.id,p.hp]));
      for (const p of travelTeam) p.hp=p.maxHp;
      const bout={region:state.region,level:card.level,roster:card.roster.slice(),entryHp,defeated:[]};
      return beginEncounter("warden",bout.roster,bout.level,"Warden "+r.warden+" rings the second bell.",{
        activeId,mode:"second-bell",secondBell:bout,coach:coaches?.restore(null,r)??null
      });
    }
    if (kind==="wild") {
      if (track!==undefined && !pool.includes(track)) return error("That species has no tracks here.");
      const id=track || pool[Math.floor(Math.random()*pool.length)];
      return beginWild(id);
    }
    if (kind!=="warden") return error("Unknown encounter.");
    if(!rehearsal){
      const gate=trialAccess();
      if (!gate.open) return error(gate.reason);
      if (!state.met.includes(state.region)) return meetWarden();
    }
    const roster=wardenRoster(state.region);
    if(!roster.length)return error("This region has no Warden trial.");
    const options=coaches?{coach:coaches.restore(null,r)}:{};
    return beginEncounter(kind,roster,r.wardenLevel,"Warden "+r.warden+" gives the signal.",options);
  }

  function damage(power, level, type, defender, neutral=false) {
    const modifier = neutral?1:dex.effectiveness(type, species[defender.id].types);
    return Math.max(1, Math.round((power + (level - 5) * 0.47) * modifier * (state.battle?.weather === type ? 1.2 : 1)));
  }

  function giveXp(p, amount) {
    if (p.level === MAX_LEVEL) return false;
    const start = p.level;
    p.xp += amount;
    while (p.level < MAX_LEVEL && p.xp >= xpNeeded(p.level)) {
      p.xp -= xpNeeded(p.level);
      p.level++;
      p.maxHp = hpAt(p.id, p.level);
      if (p.hp > 0) p.hp += 3;
    }
    if (p.level === MAX_LEVEL) p.xp = 0;
    return p.level !== start;
  }

  function finishBell(kind,message) {
    const bout=state.battle.secondBell;
    const standing=team().filter(p=>p.hp>0).length,level=bout.level;
    const prior=state.bellMarks[bout.region];
    const updatedBest=kind==="victory" && (!prior || level>prior.level || level===prior.level && standing>prior.standing);
    if (updatedBest) state.bellMarks[bout.region]={level,standing,team:state.team.slice()};
    restoreBellHp(state,bout.entryHp);
    state.battle=null;
    if (kind==="victory") message+=" You won the level "+level+" exhibition with "+standing+" of "+state.team.length+" standing.";
    message+=" Your team returned to its entry health.";
    return {...commit(kind,message),secondBell:true,standing,level,updatedBest,best:state.bellMarks[bout.region]||null};
  }

  function winBattle(message) {
    recordImpact("ally",message);
    delete state.battle.pendingFallen;
    delete state.battle.trioWindow;
    settleTrio(state.battle);
    const response=applyCoaching(true);
    if(response?.message)message+=" "+response.message;
    const {kind,activeId,enemy,remaining,commissioned,bonus}=state.battle;
    if (state.battle.secondBell) state.battle.secondBell.defeated.push(enemy.id);
    if (remaining.length) {
      nextFoe(state.battle);
      const id=state.battle.enemy.id;
      if (state.battle.condition==="shelter") {
        const p=member(activeId),hp=Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp*.12));
        p.hp+=hp;
        if(hp)message+=" The grove restored "+hp+" HP.";
      }
      const reply = kind==="warden" ? "Warden "+regions[state.region].warden+" calls on "+species[id].name+"!" : "The next "+species[id].name+" moves into formation.";
      state.battle.turn++;
      state.battle.log = [...state.battle.log, message, reply].slice(-8);
      return commit("turn", reply);
    }
    if (state.battle.secondBell) return finishBell("victory",message);
    if(rehearsal){
      state.battle=null;
      return commit("victory",message+" Your team won the rehearsal.");
    }
    if(kind==="circuit") {
      state.battle=null;
      return result("victory",message+" The bout is yours.");
    }
    if(kind==="warden"&&state.battle.trioPlayed)window.WilderThirdBeat?.win(state,state.battle.trioPlayed);
    const fieldHp=Object.fromEntries(team().map(p=>[p.id,p.hp]));
    const receipt=firstBattleFinish("victory",message);
    const xp = kind==="warden" ? Math.ceil(xpNeeded(enemy.level)*.85) : Math.ceil(xpNeeded(enemy.level)*(kind==="expedition" ? .18 : .12));
    const levels=[];
    let activeGain=0;
    for (const p of team()) {
      const gap=enemy.level-p.level;
      const catchup=gap>2 ? 1.7 : gap< -3 ? .2 : 1;
      const gain=Math.max(1, Math.round(xp*catchup*(p.id===activeId?1:.72)));
      if(p.id===activeId && p.level<MAX_LEVEL) activeGain=gain;
      if (giveXp(p,gain)) levels.push(ownedKin(p.id).name+" reached Lv. "+p.level+"!");
    }
    const lesson=kind==="warden"?wardenLesson():null;
    state.battle=null;
    state.wins++;
    state.localWins[state.region]=count(state.localWins[state.region])+1;
    state.forageReady=true;
    if (kind==="expedition" && commissioned===count(state.surveys[state.region])) {
      message+=finishLeg();
      if (bonus==="supplies") message+=" Recovered "+harvest(true)+".";
    }
    const region = regions[state.region];
    if (kind === "warden" && !state.crests.includes(state.region)) {
      state.crests.push(state.region);
      walking?.remember(state,"crest",state.region);
      message += " You earned the " + region.crest + "! " + region.farewell;
    }
    if(lesson&&!lesson.mastered&&lesson.progress>=lesson.total) {
      state.wardenLessons.push(state.region);
      state.bag.tonic++;state.bag.kinweave+=2;
      message+=" "+region.warden+" signs your "+lesson.title+" lesson seal. Received one Brighthorn tonic and two Kinweaves.";
    }
    message += " " + ownedKin(activeId).name + " gained " + activeGain + " XP.";
    if (levels.length) message += " " + levels.join(" ");
    return {...commit("victory",message,receipt),fieldHp};
  }

  function foeIntent(enemyId=state.battle?.enemy.id,rotating=false) {
    const b = state.battle;
    if (!b) return null;
    const r = regions[state.region];
    const attacks = species[enemyId].skills.filter(skill => skill.kind === "attack");
    if (b.wildCall?.answered) {
      return {skill:{name:"Wait nearby",type:"Neutral",power:0},power:0,support:true,charged:false,guarding:false};
    }
    if (b.wildCall && b.turn===1) {
      const warning={...attacks[0],power:5};
      return {skill:warning,power:warning.power,charged:false,guarding:false,warning:true};
    }
    const laterTrial = b.kind === "warden" && r.requiredCrests >= 3;
    // Veteran Wardens train different rhythms. Their opponents can read the next move before committing.
    const rhythm = laterTrial ? [3, 2, 4][r.requiredCrests % 3] : 3;
    const charged = b.turn % rhythm === 0;
    const signature = attacks[Math.floor(b.turn / rhythm - 1) % attacks.length] || attacks[0];
    const skill = charged ? signature : {name:r.basicMove, type:"Neutral", power:5};
    const guarding = b.kind!=="wild" && !charged && (b.turn+r.ordinal)%4===0;
    const base={skill,charged,guarding,power:skill.power+(charged ? rhythm + (laterTrial ? 2 : 0) : 0)};
    const intent=b.kind==="warden"&&coaches?coaches.intent(r,b,base,signature):base;
    const art=species[enemyId].emberArt;
    const spent=rotating?b.reserveEmber?.[0]:b.enemy.emberArtSpent;
    if(!art || spent || usingLoaners || intent.charged || intent.call || b.turn%3!==2) return intent;
    if(art.id==="backdraft") return {...intent,skill:art,power:art.power,emberArt:art.id};
    // A forced rotation is previewed with exactly the reserve order it will create.
    const ids=rotating?[...b.remaining.slice(1),b.enemy.id]:b.remaining;
    const hp=rotating?[...b.remaining.slice(1).map((id,i)=>b.reserveHp?.[i+1]??hpAt(id,b.enemy.level)),b.enemy.hp]:b.reserveHp;
    const patient=ids.findIndex((id,i)=>hp?.[i]>0 && hp[i]<hpAt(id,b.enemy.level));
    if(patient<0)return intent;
    const max=hpAt(ids[patient],b.enemy.level),heal=Math.min(max-hp[patient],Math.floor(max/4));
    return {...intent,skill:art,power:0,support:true,emberArt:art.id,patient,patientId:ids[patient],heal};
  }

  function returnHit(defender,guardFactor,intent=foeIntent(),covered=state.battle.cover>0) {
    if(intent.support || guardFactor===0)return 0;
    if(state.battle.emberBrace===defender.id)guardFactor=Math.min(guardFactor,.5);
    const hit=damage(intent.power,state.battle.enemy.level,intent.skill.type,defender);
    return Math.max(1,Math.floor(hit*guardFactor*(covered ? .4 : 1)));
  }

  function replyPlan(p,guard,intent=foeIntent(),covered=state.battle.cover>0,hp=p.hp){
    const raw=returnHit(p,guard,intent,covered);
    if(hp>1&&raw>=hp&&fittingReady(p.id,"last-stitch")){
      return {returnDamage:hp-1,fittingEvents:[fitEvent("last-stitch",p.id,"held at 1 HP through a "+raw+" HP hit.","will keep "+ownedKin(p.id).name+" at 1 HP through the incoming "+raw+" HP hit.",{hpAfter:1,damage:hp-1})]};
    }
    return {returnDamage:Math.min(raw,hp),fittingEvents:[]};
  }
  function guardTraining(id) {
    const lesson=usingLoaners ? null : guardSchool?.forKin(id);
    return lesson ? {...lesson,learned:state.trainedGuards.includes(id)} : null;
  }

  function guardPractice(id,foeId,region) {
    if(state.battle || usingLoaners || !validRegion(region) || !pools[region].includes(foeId))return null;
    const trainee=member(id),lesson=guardTraining(id);
    if(!trainee || !lesson)return null;
    const guard=ownedKin(id).skills.find(s=>s.kind==="guard");
    if(!guard)return null;
    return {maxHp:hpAt(foeId,regions[region].wildLevel),guardDamage:damage(guard.power,trainee.level,guard.type,{id:foeId})};
  }

  function changeFront(battle,id) {
    battle.shellGuard=null;
    delete battle.emberBrace;
    battle.activeId=id;
  }

  function counterattack(firstMessage, guardFactor=1, lesson=null, pair=null) {
    const battle = state.battle;
    recordImpact("ally",firstMessage);
    delete battle.pendingFallen;
    delete battle.trioWindow;
    const { enemy } = battle;
    const enemySpecies = species[enemy.id];
    const active = member(battle.activeId);
    const intent=foeIntent(),skill=intent.skill;
    const interrupted=guardFactor===0;
    const incoming=replyPlan(active,guardFactor,intent),dealt=incoming.returnDamage;
    incoming.fittingEvents.forEach(activateFitting);
    if(dealt>0 && battle.emberBrace===active.id)delete battle.emberBrace;
    if(!interrupted&&!intent.support&&battle.cover>0)battle.cover--;
    active.hp -= dealt;
    let reply = intent.support?"":interrupted?enemySpecies.name+" lost its charged response.":enemySpecies.name + " used " + skill.name + " for " + dealt + " damage.";
    if(intent.emberArt && !interrupted){
      enemy.emberArtSpent=true;
      if(intent.emberArt==="banked-warmth"){
        battle.reserveHp[intent.patient]+=intent.heal;
        enemy.emberBrace=true;
        reply=enemySpecies.name+" used "+skill.name+", restored "+intent.heal+" HP to "+species[intent.patientId].name+" and braced for the next hit.";
      }else{
        const healed=quarterHeal(enemy);
        enemy.hp+=healed;
        reply+=" "+enemySpecies.name+" recovered "+healed+" HP.";
      }
    }
    const survivedCharge=active.hp>0 && intent.charged && dealt>0;
    const learnedGuard=lesson && survivedCharge && !lesson.learned ? lesson.name : null;
    if (lesson && survivedCharge) {
      if (learnedGuard) {
        state.trainedGuards.push(active.id);
        reply+=" "+ownedKin(active.id).name+" learned "+lesson.name+"!";
        if (lesson.id==="shell") {
          battle.shellGuard=active.id;
          reply+=" Roll Brace will cover the next ordinary switch.";
        }
      }
      if (lesson.id==="pincer") {
        enemy.pincerOpening=true;
        reply+=" Pincer Block exposed "+enemySpecies.name+" for the next strike.";
      }
    }
    const response=applyCoaching(false,lesson?.learned && lesson.id==="pincer");
    settleTrio(battle,intent,dealt);
    if(battle.emberBrace && battle.emberBrace!==battle.activeId)delete battle.emberBrace;
    if(response?.message)reply+=(reply?" ":"")+response.message;
    if(!interrupted)recordImpact("foe",reply);
    if (active.hp === 0) {
      const ready=team().filter(p=>p.hp>0);
      if (!ready.length) {
        if (battle.secondBell) return finishBell("defeat","The Warden won the exhibition.");
        if(rehearsal){
          state.battle=null;
          return commit("defeat",firstMessage+" "+reply+" Your last companion fainted. The rehearsal is over.");
        }
        const fieldHp=Object.fromEntries(team().map(p=>[p.id,p.hp]));
        const receipt=firstBattleFinish("defeat",firstMessage+" "+reply);
        state.battle = null;
        state.party.forEach(p => { p.hp = p.maxHp; });
        if (battle.kind==="wild" && !usingLoaners) {
          const rescue=wakeAtCamp(enemy);
          const message="The Lv. "+enemy.level+" "+enemySpecies.name+" in "+regions[rescue.region].name+" knocked out your whole party. "+
            "You woke at "+rescue.campName+" in "+regions[rescue.campRegion].name+". Your companions recovered to full health.";
          return {...commit("defeat",message,receipt),fieldHp,rescue};
        }
        delete state.positions[state.region];
        state.landmark=null;
        return {...commit("defeat","Your party ran out of strength. You returned to the trailhead, where your companions recovered to full health.",receipt),fieldHp};
      }
      const next=ready[0];
      changeFront(battle,next.id);
      reply+=" "+ownedKin(active.id).name+" needs a rest. ";
      if (!usingLoaners && ready.length>1) {
        battle.pendingFallen=active.id;
        reply+=ownedKin(next.id).name+" is ready to step in.";
      } else reply+=ownedKin(next.id).name+" stepped in.";
    }
    battle.turn++;
    if(pair&&active.hp>0&&battle.activeId===active.id&&battle.enemy===enemy&&
        trioBattle(battle)&&!battle.trioUsed&&team().some(p=>p.hp>0&&p.id!==pair.source&&p.id!==pair.partner)){
      battle.trioWindow={...pair,foe:enemy.id,turn:battle.turn};
    }
    battle.log = [...battle.log, firstMessage, reply].slice(-8);
    const outcome=commit("turn", firstMessage + " " + reply);
    if (learnedGuard) outcome.learnedGuard=learnedGuard;
    return intent.support?{...outcome,skipCounterFx:true,foeShifted:!!response?.shifted,replySkill:skill,
      ...(intent.emberArt==="banked-warmth"?{foeHeal:true}:{})}:outcome;
  }

  function wardenLesson(i=state.region) {
    return coaches?.lesson(state,regions[i],i)||null;
  }
  function wardenForecast() {
    const forecast=coaches?.forecast(state,regions[state.region],state.region)||null;
    if (forecast?.kind==="relay" && state.battle.remaining.length) {
      const lesson=guardTraining(state.battle.activeId);
      if (lesson?.id==="pincer" && lesson.learned) forecast.counter+=" Pincer Block can also hold their front in place.";
    }
    return forecast;
  }
  function nextFoe(b) {
    const incoming=makeMember(b.remaining.shift(),b.enemy.level);
    if(b.reserveHp?.length)incoming.hp=b.reserveHp.shift();
    if(b.reserveEmber?.shift())incoming.emberArtSpent=true;
    if(b.beaconReserve===0){incoming.beaconMarked=true;delete b.beaconReserve;}
    else if(b.beaconReserve>0)b.beaconReserve--;
    b.enemy=incoming;b.opening=false;
    if(!b.secondBell && !state.seen.includes(incoming.id))state.seen.push(incoming.id);
  }
  function rotateFoe() {
    const b=state.battle,outgoing=b.enemy;
    if(!b.reserveHp?.length)b.reserveHp=b.remaining.map(id=>hpAt(id,outgoing.level));
    if(outgoing.emberArtSpent && !b.reserveEmber)b.reserveEmber=b.remaining.map(()=>false);
    nextFoe(b);
    // Queue position distinguishes two members of the same species.
    if(outgoing.beaconMarked)b.beaconReserve=b.remaining.length;
    b.remaining.push(outgoing.id);b.reserveHp.push(outgoing.hp);
    if(b.reserveEmber)b.reserveEmber.push(outgoing.emberArtSpent===true);
  }
  function applyCoaching(knockedOut,pincer=false) {
    if(!state.battle?.coach)return null;
    return coaches.respond({state,region:regions[state.region],dex,species,member,team,rotate:rotateFoe,knockedOut,pincer});
  }
  function earnBeat(part,award=true) {
    const b=state.battle;
    if(b.coach)b.coach.action=part;
    if (award&&part!==b.lastPart) b.beats=Math.min(3,b.beats+1);
    b.lastPart=part;
  }

  function throughEmberCover(amount,pierces=false) {
    return amount>0 && state.battle.enemy.emberBrace && !pierces ? Math.max(1,Math.floor(amount/2)) : amount;
  }

  function hurtFoe(amount) {
    const foe=state.battle.enemy;
    foe.hp-=amount;
    if(amount>0)delete foe.emberBrace;
  }

  function duetPair(id,partnerId) {
    if (id===partnerId || !validSpecies(id) || !validSpecies(partnerId)) return null;
    return window.WilderDuets.score(species[id].type,species[partnerId].type);
  }

  function duetOption(lead,partner,intent) {
    const battle=state.battle,foe=battle.enemy;
    const score=duetPair(lead.id,partner.id);
    const {name,role,cost}=score;
    const projectedStrike=fighter=>{
      const kin=species[fighter.id],skill=kin.skills.find(s=>s.kind==="attack"&&s.type===kin.type);
      return damage(skill.power,fighter.level,skill.type,foe);
    };
    const brace=intent.guarding && role!=="rush" ? .55 : 1;
    const combined=projectedStrike(lead)+projectedStrike(partner);
    const strike=throughEmberCover(Math.max(1,Math.round(combined*.82*score.strength*brace)),role==="rush");
    const damageDone=Math.min(foe.hp-(role==="lure"?1:0),strike);
    const restore=p=>role==="mend" ? Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp/4)) : 0;
    const healLead=restore(lead),healPartner=restore(partner),switchLead=role==="relay";
    const defender=switchLead?partner:lead,defenderName=ownedKin(defender.id).name;
    const falls=damageDone===foe.hp,opens=role==="mark"&&!falls;
    const {returnDamage,fittingEvents}=falls?{returnDamage:0,fittingEvents:[]}:replyPlan(defender,score.counter,intent,battle.cover>0,defender.hp+restore(defender));
    const reason=wildWaitingReason() || (!partner.hp ? ownedKin(partner.id).name+" needs to recover." :
      battle.beats<cost ? "Needs "+(cost-battle.beats)+" more "+(cost-battle.beats===1?"beat.":"beats.") : "");
    const details=[damageDone+" damage"];
    if (role==="lure") details.push("leaves at least 1 HP");
    if (role==="mend") details.push("restore "+healLead+" / "+healPartner+" HP to leader / partner");
    if (switchLead) details.push(defenderName+" takes the lead");
    if (opens) details.push("expose foe for next attack");
    const knockedOut=!falls && returnDamage>=defender.hp+restore(defender);
    details.push(falls?"foe falls before its reply":defenderName+" takes "+returnDamage+" in reply"+(knockedOut?" and faints":""));
    return {partnerId:partner.id,name,type:species[partner.id].type,role:score.label,cost,available:!reason,
      reason,preview:details.join(" · "),damage:damageDone,returnDamage,fittingEvents,healLead,healPartner,switchLead,opens,counter:score.counter};
  }

  function duets() {
    const battle=state.battle;
    if (!battle) return {beats:0,max:3,opening:false,hint:"Meet a wild Wilderkin to try a duet.",options:[]};
    const lead=member(battle.activeId),intent=foeIntent();
    const beacon=battle.enemy.beaconMarked===true;
    const pincer=battle.enemy.pincerOpening===true;
    const hint=(beacon?"Beacon mark: next ordinary strike bypasses guard and gains 50% damage. ":
      pincer?"Pincer Hold: next ordinary strike bypasses guard and gains 50% damage. ":
      battle.opening?"Foe exposed: next attack skill bypasses guard and gains 50% damage. ":"")+
      (battle.lastPart?"Last part: "+battle.lastPart+". Change parts to earn a beat.":"Your first skill or switch earns a beat.")+
      " Parts: strike, guard, care, switch.";
    return {beats:battle.beats,max:3,opening:battle.opening||beacon||pincer,hint,
      options:team().filter(p=>p.id!==lead.id).map(p=>duetOption(lead,p,intent))};
  }

  function useDuet(partnerId) {
    const b=state.battle;
    if (!b) return error("There is no active encounter.");
    const option=duets().options.find(o=>o.partnerId===partnerId);
    if (!option) return error("Choose a duet with another traveling companion.");
    if (!option.available) return error(option.reason);
    const lead=member(b.activeId),partner=member(partnerId);
    if(b.coach)b.coach.action=option.switchLead?"switch":"duet";
    if(!usingLoaners&&!b.secondBell&&state.growth.cindlet&&[lead.id,partnerId].includes("cindlet"))state.growth.cindlet.demonstrated=true;
    b.beats-=option.cost;b.lastPart=null;b.lastAttack=null;
    hurtFoe(option.damage);
    lead.hp+=option.healLead;partner.hp+=option.healPartner;
    if (option.opens) b.opening=true;
    if (option.switchLead) changeFront(b,partnerId);
    let message=ownedKin(lead.id).name+" and "+ownedKin(partnerId).name+" used "+option.name+" for "+option.damage+" damage.";
    if (option.healLead||option.healPartner) message+=" Restored "+option.healLead+" / "+option.healPartner+" HP.";
    if (option.opens) message+=" The foe is exposed!";
    if (option.switchLead) message+=" "+ownedKin(partnerId).name+" takes the lead.";
    return b.enemy.hp===0?winBattle(message):counterattack(message,option.counter,null,{source:lead.id,partner:partnerId});
  }

  function trioBattle(b) {
    return b&&!usingLoaners&&!b.secondBell&&["wild","expedition","warden"].includes(b.kind);
  }
  function restoreTrio(s,raw,foes) {
    const b=s.battle,played=raw.trioPlayed,w=raw.trioWindow;
    const owned=id=>typeof id==="string"&&s.team.includes(id);
    const fighter=id=>s.party.find(p=>p.id===id);
    if(raw.trioUsed===true&&b.turn>=3){
      b.trioUsed=true;
      if(!played)return;
      const {source,partner,third,skill,role,foe,region,kind,turn,charged,damageTaken,hpAfter}=played;
      const validFoe=kind==="wild"?foe===b.enemy.id:kind==="warden"?wardenRoster(s.region).includes(foe):foes.includes(foe);
      if(![source,partner,third].every(owned)||new Set([source,partner,third]).size!==3||kind!==b.kind||region!==s.region||
        !validFoe||!integer(turn,2,b.turn-1)||typeof charged!=="boolean")return;
      const max=fighter(third).maxHp;
      if(!species[third].skills.some(k=>k.id===skill&&k.kind===role)||!integer(damageTaken,0,max)||!integer(hpAfter,0,max)||
          damageTaken+hpAfter>max||(charged&&(!damageTaken||!hpAfter)))return;
      b.trioPlayed={source,partner,third,skill,role,foe,region,kind,turn,charged,damageTaken,hpAfter};
      return;
    }
    if(!w||raw.trioUsed||b.turn<2||w.turn!==b.turn||w.foe!==b.enemy.id||b.pendingFallen||b.wildCall?.answered||
        b.lastAttack!==null||b.lastPart!==null||w.source===w.partner||![w.source,w.partner].every(id=>owned(id)&&fighter(id).hp>0))return;
    const score=window.WilderDuets&&duetPair(w.source,w.partner);
    if(!score||b.activeId!==(score.role==="relay"?w.partner:w.source)||b.beats>3-score.cost||
        !s.team.some(id=>id!==w.source&&id!==w.partner&&fighter(id).hp>0))return;
    b.trioWindow={source:w.source,partner:w.partner,foe:w.foe,turn:b.turn};
  }

  function opportunity() {
    const b=state.battle,w=b?.trioWindow;
    if(!w||!trioBattle(b)||b.trioUsed||w.turn!==b.turn||w.foe!==b.enemy.id||b.pendingFallen||b.wildCall?.answered)return null;
    return w;
  }
  function useTrio(id,skillId) {
    const b=state.battle,w=opportunity();
    if(!w)return error("A surviving duet can hand its next turn to a third companion.");
    if(!state.team.includes(id)||id===w.source||id===w.partner||!member(id)?.hp)return error("Choose a conscious teammate outside the duet.");
    const active=member(id),k=ownedKin(id),skill=k.skills.find(s=>!s.trained&&s.id===skillId);
    if(!skill)return error("Choose the incoming companion’s own strike, guard or healing skill.");
    const plan=forecastOrdinaryFor(active,skillId);
    if(!plan.available)return error(plan.reason);
    changeFront(b,id);
    b.trioUsed=true;
    b.trioPlayed={source:w.source,partner:w.partner,third:id,skill:skillId,role:skill.kind,foe:b.enemy.id,region:state.region,kind:b.kind,
      turn:b.turn,charged:false,damageTaken:0,hpAfter:active.hp};
    delete b.trioWindow;
    return ordinaryTurn(active,plan,k.name+" took the trio handoff. ");
  }
  function settleTrio(b,intent=null,damageTaken=0) {
    const move=b.trioPlayed;
    if(!move||move.turn!==b.turn)return;
    move.damageTaken=damageTaken;move.hpAfter=member(move.third).hp;
    move.charged=!!intent?.charged&&damageTaken>0&&move.hpAfter>0;
    if(!rehearsal&&trioBattle(b))window.WilderThirdBeat?.record(state,{...move});
  }
  function trio() {
    const w=opportunity();
    if(!w)return null;
    const b=state.battle,opponents=[b.enemy.id,...b.remaining];
    const mirror=createInstance(JSON.parse(teamSnapshot(state.team,state.lead,opponents,state.region,b)));
    const reset=mirror.checkpoint(),options=[];
    for(const p of team()){
      if(!p.hp||p.id===w.source||p.id===w.partner)continue;
      const kin=ownedKin(p.id);
      for(const s of kin.skills.filter(s=>!s.trained)){
        const plan=forecastOrdinaryFor(p,s.id),foe=mirror.state.battle.enemy;
        let hpAfter=p.hp,activeAfter=b.activeId,foeAfter=foe.id,beatsAfter=b.beats,fittingEvents=[],outcome=null;
        if(plan.available){
          const actual=mirror.useTrio(p.id,s.id),next=mirror.state.battle;
          hpAfter=mirror.team().find(k=>k.id===p.id).hp;
          activeAfter=next?.activeId||null;foeAfter=next?.enemy.id||null;beatsAfter=next?.beats??b.beats;
          fittingEvents=actual.fittingEvents||[];outcome=actual.kind;
        }
        const detail=[s.kind==="heal"?"Recover "+plan.healing+" HP":"Deal "+plan.damage+" damage",
          plan.finishes?"foe falls before its reply":"take "+plan.returnDamage+" in reply",
          kin.name+" ends at "+hpAfter+"/"+p.maxHp+" HP"];
        const foeHeal=foe.hp-(b.enemy.hp-plan.damage);
        if(foeHeal>0)detail.push(species[foe.id].name+" recovers "+foeHeal+" HP");
        if(activeAfter&&activeAfter!==p.id)detail.push(ownedKin(activeAfter).name+" takes the lead");
        if(foeAfter&&foeAfter!==foe.id)detail.push(species[foeAfter].name+" takes the opposing lead");
        options.push({id:p.id,kinName:kin.name,skill:s.id,name:s.name,role:s.kind,type:s.type,available:plan.available,reason:plan.reason,
          detail:plan.reason||detail.join(" · "),damage:plan.damage,healing:plan.healing,returnDamage:plan.returnDamage,hpAfter,maxHp:p.maxHp,
          foeHpAfter:foe.hp,finishes:plan.finishes,beatsAfter,fittingEvents,activeAfter,foeAfter,outcome});
        reset();
      }
    }
    return {source:w.source,partner:w.partner,duet:duetPair(w.source,w.partner).name,turn:b.turn,cost:0,options};
  }

  function skillPreview(id) {
    const b=state.battle;
    if(!b)return null;
    const lead=member(b.activeId),skill=ownedKin(lead.id).skills.find(s=>s.id===id&&s.trained);
    if(!skill)return null;
    let intent=foeIntent(),receiver=lead,reason="",hit=0,guard=1,healing=0,tax=0,gain=0,target=null,shift=null;
    const details=[];
    switch(id){
      case "wattle-ward":
        if(b.cover>0)reason="The team's cover is still active.";
        details.push("Cover the next two hits, including this reply.");break;
      case "briar-seam":
        hit=damage(5,lead.level,skill.type,b.enemy)*(intent.guarding?2:1);
        if(intent.guarding)gain=1;
        details.push(intent.guarding?"Break guard and refund one beat.":"Expose the foe for your next attack.");break;
      case "backdraft-cut":
        if(!intent.charged)reason="Wait for a charged enemy move.";
        hit=damage(8,lead.level,skill.type,b.enemy);guard=0;
        details.push("Interrupt "+intent.skill.name+".");break;
      case "cinder-handoff":{
        tax=Math.ceil(lead.maxHp/6);gain=Math.min(2,3-b.beats);
        const roster=team(),index=roster.indexOf(lead),next=[...roster.slice(index+1),...roster.slice(0,index)].find(p=>p.hp>0);
        if(!next)reason="Another conscious teammate must be available.";
        else if(lead.hp<=tax)reason="Kilnwing must keep at least 1 HP after paying "+tax+".";
        else if(!gain)reason="The beat meter is already full.";
        if(next){receiver=next;target=next.id;}
        guard=.5;details.push("Pay "+tax+" HP. Hand "+gain+" beat"+(gain===1?"":"s")+" and the lead to "+ownedKin(receiver.id).name+".");break;
      }
      case "harbor-pool":{
        const patient=team().filter(p=>p.hp>0&&p.hp<p.maxHp).sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(!patient)reason="Your conscious teammates are already at full health.";
        else{
          target=patient.id;healing=Math.min(patient.maxHp-patient.hp,Math.ceil(patient.maxHp/3));
          details.push("Restore "+healing+" HP to "+ownedKin(patient.id).name+".");
        }
        guard=.5;break;
      }
      case "turn-the-lock":
        guard=.5;
        if(b.remaining.length){shift=b.remaining[0];intent=foeIntent(shift,true);details.push("Send "+species[b.enemy.id].name+" to the back at "+b.enemy.hp+" HP. "+species[shift].name+" comes forward.");}
        else details.push("Expose the lone foe for your next attack.");
        break;
    }
    if(skill.kind==="attack"){
      if(b.opening){hit=Math.round(hit*1.5);details.push("Strike the opening.");}
      if(b.condition==="echo"&&b.lastAttack===id){hit=Math.max(1,Math.round(hit*.75));details.push("Echo dulls the repeat.");}
    }
    hit=Math.min(throughEmberCover(hit,b.opening && skill.kind==="attack"),b.enemy.hp);
    if(hit)details.push(hit+" damage.");
    const effect=details.join(" "),replyHp=receiver.hp+(receiver.id===target?healing:0);
    const {returnDamage,fittingEvents}=hit===b.enemy.hp||!guard?{returnDamage:0,fittingEvents:[]}:replyPlan(receiver,guard,intent,b.cover>0||id==="wattle-ward",replyHp);
    details.push(returnDamage?ownedKin(receiver.id).name+" takes "+returnDamage+" in reply"+(returnDamage===replyHp?" and faints.":"."):"No return hit.");
    if(b.beats<skill.cost)reason="Needs "+skill.cost+" beats; you have "+b.beats+".";
    reason=wildWaitingReason()||reason;
    return {available:!reason,reason,effect,detail:details.join(" "),kind:skill.kind,cost:skill.cost,damage:hit,returnDamage,fittingEvents:reason?[]:fittingEvents,
      guard,healing,tax,gain,target,shift,replySkill:intent.skill};
  }

  function trainedTurn(skill,lead) {
    const b=state.battle,plan=skillPreview(skill.id);
    if(!plan.available)return error(plan.reason);
    if(b.coach)b.coach.action=({"wattle-ward":"guard","briar-seam":"guard","backdraft-cut":"guard","cinder-handoff":"switch","harbor-pool":"care","turn-the-lock":"switch"})[skill.id]||"strike";
    b.beats=b.beats-skill.cost+plan.gain;b.lastPart=null;b.lastAttack=skill.kind==="attack"?skill.id:null;
    if(skill.kind==="attack")b.opening=false;
    hurtFoe(plan.damage);
    const note=ownedKin(lead.id).name+" used "+skill.name+". ";
    if(skill.id==="wattle-ward")b.cover=2;
    if(skill.id==="briar-seam"||skill.id==="turn-the-lock"&&!plan.shift)b.opening=true;
    if(plan.healing)member(plan.target).hp+=plan.healing;
    if(skill.id==="cinder-handoff"){lead.hp-=plan.tax;changeFront(b,plan.target);}
    if(plan.shift)rotateFoe();
    const message=note+plan.effect;
    const outcome=b.enemy.hp===0?winBattle(message):counterattack(message,plan.guard);
    return {...outcome,foeShifted:Boolean(plan.shift)||!!outcome.foeShifted,skipCounterFx:!plan.guard||!!outcome.skipCounterFx,replySkill:plan.replySkill};
  }

  const trailFeint={id:"trail-feint",name:"Hold back",kind:"feint"};

  function strikeProjection(active,skill,foe,item,brace=1,repeated=false,exposed=false){
    const resistant=dex.effectiveness(skill.type,species[foe.id].types)<1;
    const lens=skill.kind==="attack"&&item==="prism-lens"&&resistant;
    const base=damage(skill.power,active.level,skill.type,foe,lens);
    const hitAt=opening=>{
      const raw=Math.max(1,Math.round(base*brace*(repeated?.75:1)*opening));
      return Math.min(foe.hp,foe.emberBrace&&!exposed?Math.max(1,Math.floor(raw/2)):raw);
    };
    const normal=hitAt(exposed?1.5:1);
    const hooked=exposed&&item==="seam-hook"?hitAt(2):normal;
    const events=[];
    if(lens)events.push(fitEvent(item,active.id,"made "+skill.name+" neutral against "+species[foe.id].name+" for "+normal+" damage.","will neutralize resistance to "+skill.name+" for "+normal+" damage.",{damage:normal}));
    if(hooked>normal)events.push(fitEvent(item,active.id,"raised the exposed strike from "+normal+" to "+hooked+" damage.","will raise the exposed strike from "+normal+" to "+hooked+" damage.",{damage:hooked,extra:hooked-normal}));
    return {hit:hooked,events};
  }
  function trailFittingPreview(id,item,foeId){
    if(state.battle||usingLoaners||!fittings||!member(id)||!pools[state.region].includes(foeId)||!["prism-lens","seam-hook"].includes(item))return null;
    const level=regions[state.region].wildLevel,foe=makeMember(foeId,level),active=member(id),exposed=item==="seam-hook";
    const choices=ownedKin(id).skills.filter(k=>k.kind==="attack"&&!k.trained).map(skill=>{
      const before=strikeProjection(active,skill,foe,null,1,false,exposed).hit;
      const {hit:after,events}=strikeProjection(active,skill,foe,item,1,false,exposed);
      return events.length?{skill:skill.name,skillId:skill.id,foe:foeId,level,before,after,delta:after-before,
        condition:exposed?"Exposed wild foe at full HP, without guard or weather.":"Resisted strike against a full-HP wild foe, without guard or weather."}:null;
    }).filter(Boolean);
    return choices.sort((a,b)=>b.delta-a.delta||b.after-a.after)[0]||null;
  }
  function ordinaryForecast(id) {
    const b=state.battle;
    return b?forecastOrdinaryFor(member(b.activeId),id):null;
  }
  function forecastOrdinaryFor(active,id,art=null) {
    const b=state.battle,user=ownedKin(active.id),enemy=b.enemy;
    const skill=art || (id===trailFeint.id && b.kind==="wild"?trailFeint:user.skills.find(s=>s.id===id));
    if(!skill || skill.trained)return null;
    const intent=foeIntent(),guard=skill.kind==="guard";
    const guardFactor=guard ? (b.condition==="ledge" ? .33 : .5) : 1;
    const exposed=skill.kind==="attack" && Boolean(b.opening||enemy.beaconMarked||enemy.pincerOpening);
    const braced=intent.guarding && !exposed,repeated=b.condition==="echo" && b.lastAttack===id;
    let hit=0,healing=art ? quarterHeal(active) : 0,reason="";
    const fittingEvents=[];
    if(skill.kind==="feint"){
      const strength=enemy.level>active.level+wildLevelGap?Math.min(active.maxHp,enemy.maxHp):enemy.maxHp;
      hit=Math.min(enemy.hp-1,throughEmberCover(Math.ceil(strength/4)));
      if(!hit)reason="This Wilderkin is ready to befriend.";
    }else if(skill.kind==="heal"){
      healing=Math.min(active.maxHp-active.hp,Math.ceil(active.maxHp/3));
      if(!healing)reason=user.name+" is already at full health.";
    }else{
      const braceEffect=braced ? (guard ? (b.condition==="ledge" ? 1.65 : 1.4) : .55) : 1;
      const item=b.trailFittings?.gear[active.id],ready=item&&fittingReady(active.id,item)?item:null;
      const strike=strikeProjection(active,skill,enemy,ready,braceEffect,repeated,exposed);
      hit=strike.hit;fittingEvents.push(...strike.events);
      if(guard&&ready==="mender-wrap"){
        const patient=team().filter(p=>p.id!==active.id&&p.hp>0&&p.hp<p.maxHp)
          .sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
        if(patient){
          const heal=Math.min(patient.maxHp-patient.hp,Math.ceil(patient.maxHp/5));
          fittingEvents.push(fitEvent(ready,active.id,"restored "+heal+" HP to "+ownedKin(patient.id).name+".","will restore "+heal+" HP to "+ownedKin(patient.id).name+".",{target:patient.id,heal}));
        }
      }
    }
    reason=wildWaitingReason()||reason;
    const finishes=hit===enemy.hp;
    const reply=(reason||finishes)?{returnDamage:0,fittingEvents:[]}:replyPlan(active,guardFactor,intent,b.cover>0,active.hp+healing);
    return {available:!reason,reason,skill,damage:hit,healing,returnDamage:reply.returnDamage,finishes,guardFactor,exposed,braced,repeated,
      fittingEvents:reason?[]:fittingEvents.concat(reply.fittingEvents)};
  }

  function quarterHeal(p) {
    return Math.min(p.maxHp-p.hp,Math.floor(p.maxHp/4));
  }

  function emberTechnique() {
    const b=state.battle,art=b && !usingLoaners && species[b.activeId].emberArt;
    if(!art)return null;
    const active=member(b.activeId),used=!!b.emberUsers?.includes(active.id);
    const blocked=b.pendingFallen?"Choose a replacement first.":wildWaitingReason() || (used?ownedKin(active.id).name+" has used "+art.name+" this battle.":"");
    if(art.id==="backdraft"){
      const plan=forecastOrdinaryFor(active,art.id,{...art,kind:"attack"});
      return {...art,...plan,targets:[],used,available:!blocked,reason:blocked};
    }
    const targets=team().filter(p=>p.id!==active.id).map(p=>{
      const heal=p.hp>0?quarterHeal(p):0;
      return {id:p.id,name:ownedKin(p.id).name,hp:p.hp,maxHp:p.maxHp,heal,hpAfter:p.hp+heal,
        available:heal>0,reason:p.hp===0?"Needs a rest.":heal===0?"Already at full health.":""};
    });
    const reason=blocked || (targets.some(p=>p.available)?"":"A conscious reserve must be missing HP.");
    return {...art,targets,used,available:!reason,reason,...replyPlan(active,.5)};
  }

  function useEmberTechnique(targetId) {
    const plan=emberTechnique();
    if(!plan || !plan.available)return error(plan?.reason||"Your active companion has no Ember art here.");
    const b=state.battle,active=member(b.activeId),name=ownedKin(active.id).name;
    const warmth=plan.id==="banked-warmth";
    const target=warmth && plan.targets.find(p=>p.id===targetId && p.available);
    if(warmth && !target)return error("Choose a conscious injured reserve.");
    if(!warmth && targetId!=null)return error("Backdraft heals its own user.");
    (b.emberUsers??=[]).push(active.id);
    if(b.coach)b.coach.action=warmth?"care":"strike";
    if(warmth){
      member(target.id).hp+=target.heal;
      b.emberBrace=active.id;
      return counterattack(name+" used "+plan.name+", restored "+target.heal+" HP to "+target.name+" and braced for the next hit.");
    }
    active.hp+=plan.healing;
    const message=strikeMessage(name,plan)+" "+name+" recovered "+plan.healing+" HP.";
    return b.enemy.hp===0?winBattle(message):counterattack(message);
  }

  function strikeMessage(name,plan) {
    const b=state.battle,enemy=b.enemy,{skill,damage:hit,exposed,repeated,braced}=plan;
    if(exposed){
      b.opening=false;
      delete enemy.beaconMarked;
      delete enemy.pincerOpening;
    }
    b.lastAttack=skill.id;
    hurtFoe(hit);
    for(const event of plan.fittingEvents){
      if(event.id==="last-stitch")continue;
      if(event.id==="mender-wrap")member(event.target).hp+=event.heal;
      activateFitting(event);
    }
    const multiplier=plan.fittingEvents.some(e=>e.id==="prism-lens")?1:dex.effectiveness(skill.type,species[enemy.id].types);
    const pairing=multiplier>1?" Elemental advantage!":multiplier<1?" The target resisted.":"";
    return name+" used "+skill.name+" for "+hit+" damage."+pairing+(exposed?" Struck the opening!":"")+
      (repeated?" Echo dulled the repeat.":"")+(braced?skill.kind==="guard"?" Broke its guard!":" It braced for the strike.":"");
  }

  function useSkill(id) {
    const battle = state.battle;
    if (!battle) return error("There is no active encounter.");
    const active = member(battle.activeId);
    const user = ownedKin(active.id);
    const plan=ordinaryForecast(id);
    if(!plan){
      const special=user.skills.find(s=>s.id===id && s.trained);
      return special?trainedTurn(special,active):error("Choose a skill your active companion knows.");
    }
    if(!plan.available)return error(plan.reason);
    return ordinaryTurn(active,plan);
  }

  function ordinaryTurn(active,plan,entry="") {
    const battle=state.battle,enemy=battle.enemy,user=ownedKin(active.id),id=plan.skill.id;
    const {skill,damage:hit,healing}=plan;
    if (skill.kind==="feint") {
      earnBeat("strike");
      hurtFoe(hit);
      return counterattack(user.name + " held back, dealing " + hit + " damage.");
    }
    if (skill.kind === "heal") {
      earnBeat("care",!entry);
      active.hp += healing;
      if(!usingLoaners&&!battle.secondBell&&state.growth.dewfin&&active.id==="dewfin"&&id==="dew-bath")state.growth.dewfin.demonstrated=true;
      return counterattack(entry+user.name + " used " + skill.name + " and recovered " + healing + " HP.");
    }
    earnBeat(skill.kind==="guard"?"guard":"strike",!entry);
    let message=entry+strikeMessage(user.name,plan);
    const lesson=skill.kind==="guard" ? guardTraining(active.id) : null;
    if (lesson?.learned && lesson.id==="shell" && !battle.shellGuard) {
      battle.shellGuard=active.id;
      message+=" Roll Brace will cover the next ordinary switch.";
    }
    if (enemy.hp === 0) return winBattle(message);
    if(!usingLoaners&&!battle.secondBell&&state.growth.sprigkit&&active.id==="sprigkit"&&id==="brush-dash"&&foeIntent().charged)state.growth.sprigkit.demonstrated=true;
    return counterattack(message,plan.guardFactor,lesson);
  }

  function switchForecast(id) {
    const battle=state.battle;
    if (!battle) return null;
    const p=member(id);
    const reason=wildWaitingReason() || (battle.activeId===id ? "This companion is already in the field." :
      !state.team.includes(id)||!p?.hp ? "Choose a companion with some health remaining." : "");
    const covered=!reason && !usingLoaners && battle.shellGuard===battle.activeId;
    const normalFactor=battle.condition==="gale" ? .25 : .5;
    const factor=covered ? .25 : normalFactor;
    const intent=foeIntent();
    const reply=reason?{returnDamage:0,fittingEvents:[]}:replyPlan(p,factor,intent);
    const damage=reply.returnDamage,normalDamage=reason?0:replyPlan(p,normalFactor,intent).returnDamage;
    let beatsAfter=Math.min(3,battle.beats+(battle.lastPart==="switch"?0:1));
    const fittingEvents=reply.fittingEvents.slice();
    if(!reason&&beatsAfter<3&&fittingReady(id,"relay-bell")){
      beatsAfter++;fittingEvents.unshift(fitEvent("relay-bell",id,"raised the switch meter to "+beatsAfter+"/3 beats.","will add a beat on this switch ("+beatsAfter+"/3).",{beats:1}));
    }
    return {available:!reason,reason,protected:covered,damage,normalDamage,hpAfter:(p?.hp||0)-damage,maxHp:p?.maxHp||0,factor,beatsAfter,fittingEvents};
  }

  function swap(id) {
    const battle = state.battle;
    if (!battle) return setLead(id);
    const plan=switchForecast(id);
    if (!plan.available) return error(plan.reason);
    earnBeat("switch");
    const bell=plan.fittingEvents.find(e=>e.id==="relay-bell");
    if(bell){battle.beats++;activateFitting(bell);}
    changeFront(battle,id);
    battle.lastAttack=null;
    const message="You called in "+ownedKin(id).name+"."+(plan.protected?" Roll Brace covered the switch.":"");
    return counterattack(message,plan.factor);
  }

  function replacements() {
    const b=state.battle;
    if (usingLoaners || !b?.pendingFallen || b.wildCall?.answered) return null;
    const ready=team().filter(p=>p.hp>0);
    if (ready.length<2) return null;
    const intent=foeIntent(),foeTypes=species[b.enemy.id].types;
    const options=ready.map(p=>{
      const k=ownedKin(p.id);
      const attacks=k.skills.filter(s=>!s.trained && (s.kind==="attack" || s.kind==="guard"));
      const plans=attacks.map(s=>forecastOrdinaryFor(p,s.id));
      const best=plans.reduce((a,c)=>c.damage>a.damage || (c.damage===a.damage && c.returnDamage<a.returnDamage)?c:a);
      const reply=replyPlan(p,1,intent);
      return {id:p.id,name:k.name,hp:p.hp,maxHp:p.maxHp,types:k.types,level:p.level,
        attackName:best.skill.name,attackType:best.skill.type,attackMultiplier:best.fittingEvents.some(e=>e.id==="prism-lens")?1:dex.effectiveness(best.skill.type,foeTypes),
        attackDamage:best.damage,attackFinishes:best.finishes,attackReplyDamage:best.returnDamage,
        replyName:intent.skill.name,replyDamage:reply.returnDamage,fittingEvents:best.fittingEvents,replyFittingEvents:reply.fittingEvents};
    });
    return {fallen:b.pendingFallen,defaultId:b.activeId,options};
  }

  function replaceFainted(id) {
    const choice=replacements();
    if (!choice) return error("There is no replacement to choose.");
    const option=choice.options.find(p=>p.id===id);
    if (!option) return error("Choose a conscious traveling companion.");
    const b=state.battle;
    changeFront(b,id);
    delete b.pendingFallen;
    const message=option.name+" took the field for "+ownedKin(choice.fallen).name+".";
    b.log=[...b.log,message].slice(-8);
    return commit("replacement",message);
  }

  function familyPassReason(battle,hasReserve) {
    if (battle?.familyUsed) return "Your party has used its family technique this battle.";
    if (battle && battle.beats<1) return "Earn one beat before calling a family technique.";
    return hasReserve ? "" : "A conscious teammate must be available to take the lead.";
  }

  function passLead(battle,partner) {
    battle.beats--;
    battle.familyUsed=true;
    battle.lastPart=null;
    battle.lastAttack=null;
    if (battle.coach) battle.coach.action="switch";
    changeFront(battle,partner);
  }

  function familyTechnique() {
    const battle=state.battle;
    if (!battle) return null;
    const technique=window.WilderFamilyTechniques?.forKin(battle.activeId);
    if (!technique) return null;
    const intent=foeIntent();
    const targets=team().filter(p=>p.id!==battle.activeId && p.hp>0).map(p=>{
      const heal=technique.id==="slipstream" ? Math.min(p.maxHp-p.hp,Math.floor(p.maxHp/4)) : 0;
      const {returnDamage,fittingEvents}=replyPlan(p,1,intent,battle.cover>0,p.hp+heal);
      return {id:p.id,name:ownedKin(p.id).name,heal,returnDamage,hpAfter:p.hp+heal-returnDamage,maxHp:p.maxHp,fittingEvents};
    });
    const used=battle.familyUsed===true;
    const reason=wildWaitingReason() || familyPassReason(battle,targets.length>0);
    return {...technique,cost:1,used,available:!reason,reason,targets};
  }

  function useFamilyTechnique(targetId) {
    const technique=familyTechnique();
    if (!technique) return error("Your active kin has no family technique here.");
    if (!technique.available) return error(technique.reason);
    const target=technique.targets.find(p=>p.id===targetId);
    if (!target) return error("Choose a conscious traveling companion to take the lead.");
    const battle=state.battle;
    let message=ownedKin(battle.activeId).name+" used "+technique.name+". ";
    passLead(battle,target.id);
    if (technique.id==="beacon") {
      battle.enemy.beaconMarked=true;
      message+=species[battle.enemy.id].name+" is exposed to the next ordinary strike. ";
    } else if (target.heal) {
      member(target.id).hp+=target.heal;
      message+=target.name+" recovered "+target.heal+" HP. ";
    }
    return counterattack(message+target.name+" took the lead.");
  }

  function wildWaitingReason() {
    return state.battle?.wildCall?.answered ? "Offer a Kinweave or let the waiting Wilderkin go." : "";
  }

  function bondOffer(id,wildLevel,peaceful) {
    const best=Math.max(...team().map(p=>p.level));
    const young=peaceful && wildLevel>best+wildLevelGap;
    const level=young?best+3:wildLevel,name=species[id].name;
    const preview=young?"A young "+name+" (Lv. "+level+") can join. The Lv. "+wildLevel+" adult stays here.":
      name+" can join at Lv. "+level+".";
    return {level,young,preview};
  }

  function openingForecast(quarry,lead,level) {
    if (!lead) return {strike:null,warning:null};
    const foe=makeMember(quarry,level);
    const item=state.battle?state.battle.trailFittings?.gear[lead.id]:state.trailFittings?.gear[lead.id];
    const ready=state.battle&&!fittingReady(lead.id,item)?null:item;
    const warningSkill=species[quarry].skills.find(s=>s.kind==="attack");
    const choices=species[lead.id].skills.filter(s=>s.kind==="attack").map(s=>{
      const {hit}=strikeProjection(lead,s,foe,ready);
      return {name:s.name,type:s.type,damage:hit,finishes:hit===foe.hp};
    });
    let warning=Math.min(lead.hp,damage(5,level,warningSkill.type,lead));
    if(lead.hp>1&&warning===lead.hp&&ready==="last-stitch")warning--;
    return {strike:choices.reduce((a,b)=>a.damage>=b.damage?a:b),warning:{name:warningSkill.name,type:warningSkill.type,damage:warning,finishes:warning===lead.hp}};
  }

  function wildCall(id=state.battle?.enemy.id) {
    const b=state.battle,card=wildCard(id);
    if (!card || usingLoaners || member(id) || (b && (b.kind!=="wild" || b.wildCall?.quarry!==id))) return null;
    const ready=team().filter(p=>p.hp>0),answered=b?.wildCall?.answered,options=[];
    if (!answered) for (const p of ready) {
      if (card.pass) {
        const pass=window.WilderFamilyTechniques?.forKin(p.id);
        if (pass?.id!==card.pass) continue;
        const reserves=ready.filter(target=>target.id!==p.id);
        const reason=familyPassReason(b,reserves.length>0);
        for (const target of reserves) options.push({actor:p.id,skill:pass.id,name:pass.name,partner:target.id,available:!reason,reason});
      } else {
        for (const skill of calls.answeringMoves(species[p.id],card)) {
          options.push({actor:p.id,skill:skill.id,name:skill.name,available:true,reason:""});
        }
      }
    }
    const leader=ready.find(p=>p.id===(b?.activeId || state.lead)) || ready[0];
    const where=homes[id].includes(state.region)?state.region:homes[id][0];
    const level=b?b.enemy.level:regions[where].wildLevel;
    const offer=bondOffer(id,level,!b || b.enemy.hp*2>b.enemy.maxHp);
    return {...card,...openingForecast(id,leader,level),offer,waiting:!!answered,options,...(answered?{answered:{...answered}}:{})};
  }

  function answerWildCall(skill,partner) {
    const b=state.battle,call=b && wildCall();
    if (!call) return error("There is no wild call to answer here.");
    if (call.waiting) return error(wildWaitingReason());
    const actor=b.activeId,option=call.options.find(o=>o.actor===actor && o.skill===skill && o.partner===partner);
    if (!option) return error("Choose an answering move your active companion knows and its required target.");
    if (!option.available) return error(option.reason);
    const answer={actor,skill};
    if (call.pass) {
      passLead(b,partner);
      answer.partner=partner;
    }
    delete b.pendingFallen;
    b.wildCall.answered=answer;
    delete b.trioWindow;
    b.turn++;
    const action=ownedKin(actor).name+" used "+option.name+" on "+call.target+".";
    recordImpact("ally",action);
    b.log=[...b.log,action,call.response].slice(-8);
    return {...commit("turn",action+" "+call.response),skipCounterFx:true};
  }

  function captureStatus() {
    const b=state.battle;
    let reason="";
    if (!b) reason="Look for a wild Wilderkin first.";
    else if (rehearsal) reason="Meet this Wilderkin on its trail to invite it to join you.";
    else if (usingLoaners || b.kind!=="wild") reason="Kinweaves work on individual Wilderkin you have tracked in the wild.";
    else if (member(b.enemy.id)) reason=species[b.enemy.id].name+" is already in your party.";
    else if (!b.wildCall?.answered && b.enemy.hp*2>b.enemy.maxHp) {
      reason="Bring "+species[b.enemy.id].name+" to half health or lower"+(b.wildCall?", or answer its call.":" to befriend it.");
    } else if (!state.bag.kinweave) reason="Your Kinweaves are gone. Craft another with two reeds and one sun sap.";
    if(reason)return {available:false,reason};
    return {available:true,reason:"",offer:bondOffer(b.enemy.id,b.enemy.level,b.enemy.hp*2>b.enemy.maxHp)};
  }

  function recruit() {
    const gate=captureStatus();
    if (!gate.available) return error(gate.reason);
    const {enemy}=state.battle;
    const receipt=firstBattleFinish("recruited","The Kinweave opened. "+species[enemy.id].name+" joined your party.");
    state.battle = null;
    return befriend(enemy.id,gate.offer,receipt);
  }

  function befriend(id,offer,receipt=null) {
    state.bag.kinweave--;
    state.forageReady=true;
    state.party.push(makeMember(id,offer.level));
    if(!state.seen.includes(id)) state.seen.push(id);
    const joinsTeam=state.team.length<6;
    if(joinsTeam) state.team.push(id);
    const newcomer=(offer.young?"A young ":"")+species[id].name+" (Lv. "+offer.level+")";
    return commit("recruited","The Kinweave opens. "+newcomer+(joinsTeam?" joined your traveling party!":" joined your reserve!"),receipt);
  }

  function observe(id,action) {
    const res=field.observe(state,id,action);
    if(res.kind==="field-note") walking?.remember(state,"note",id);
    if((res.kind==="field-note"||res.kind==="field-habitat") && count(state.surveys[state.region])<campaign.length(state.region)) {
      const recorded=pools[state.region].filter(kin=>field.recordedAt(state,kin,state.region)).length;
      if(recorded<=2) res.message+=" The station accepts your wildlife report."+finishLeg(res.kind==="field-note");
    }
    if(res.ok&&!save())return changedTrail();
    return res;
  }
  function fieldInvitation(id) {
    const ready=field.canInvite(state,id);
    return ready.ok?{...ready,offer:bondOffer(id,regions[state.region].wildLevel,true)}:ready;
  }
  function inviteField(id) {
    const ready=fieldInvitation(id);
    return ready.ok?befriend(id,ready.offer):ready;
  }
  function cycleAnimationSpeed() {
    state.animationSpeed=state.animationSpeed%3+1;
    return commit("setting","Battle animations at "+state.animationSpeed+"× speed.");
  }
  function cycleMusic() {
    state.music=(state.music+1)%3;
    return commit("setting",["Music off.","Quiet music.","Full music."][state.music]);
  }

  function flee() {
    if (!state.battle) return error("There is no active encounter.");
    if (state.battle.secondBell) return finishBell("escaped","You withdrew from the exhibition.");
    if(rehearsal){state.battle=null;return commit("escaped","You called your team back and ended the rehearsal.");}
    const message=state.battle.wildCall?.answered ? species[state.battle.enemy.id].name+" returned freely to the wild." :
      "You called your party back and returned to the trail.";
    const receipt=firstBattleFinish("escaped",message);
    state.battle = null;
    return commit("escaped",message,receipt);
  }

  function training(amount) {
    const p = member(state.lead);
    if (p.level===MAX_LEVEL) return ownedKin(p.id).name+" is fully trained.";
    const leveled = giveXp(p, amount);
    return ownedKin(p.id).name + " gained " + amount + " XP" + (leveled ? " and reached level " + p.level : "") + ".";
  }
  function awardGame(id) {
    const activity = activities.games.find(g => g.id === id);
    if (!activity || state.battle || activity.region!==state.region || !state.passes.includes(id)) return error("Play from its home region after earning permanent admission.");
    const clears = count(state.clears[id]);
    state.clears[id] = clears + 1;
    return commit("clear", training(clears ? 8 : 32) + " Clears: " + state.clears[id] + ".");
  }
  function questAction(id) {
    const q = activities.quests.find(item => item.id === id);
    if (!q || state.battle || !state.visited.includes(q.region)) return error("Visit the posting's region first.");
    if (state.quests[id] === "claimed") return error("You have collected this reward.");
    if (!state.quests[id]) {
      state.quests[id] = "active";
      return commit("accepted", "Request accepted. Follow your progress in the journal.");
    }
    const progress = activities.progress(q, state);
    if (progress.current < progress.total) return error(progress.label);
    state.quests[id] = "claimed";
    return commit("claimed", q.requester + " thanks you. " + training(75) +
      (q.crossing?" The trail to "+regions[q.crossing.to].name+" is open.":""));
  }

  function nearSite(kind) {
    // The renderer supplies the exact landmark coordinates. Checking the same tile or its neighbor
    // also accepts the keyboard interaction before the player steps onto a landmark sprite.
    const map=window.WilderWorld?.regions[state.region];
    if(!map)return true;
    const point=state.positions[state.region] || map.spawn;
    return map.sites.some(site=>(site.kind||site.id)===kind && Math.abs(point.x-site.x)+Math.abs(point.y-site.y)<=1);
  }
  function visitSite(kind) {
    if (state.battle || !["camp","warden","wild","travel","activities"].includes(kind)||!nearSite(kind)) return false;
    state.landmark=kind;
    if(onlineWalker&&!usingLoaners){rememberFootsteps(true);return true;}
    return save();
  }

  function harvest(bonus=false) {
    const rotation=(state.region+count(state.surveys[state.region])+count(state.localWins[state.region]))%3;
    const yieldBag={reed:2,sap:2,ore:1};
    yieldBag[["reed","sap","ore"][rotation]]+=bonus ? 3 : 1;
    for(const [id,qty] of Object.entries(yieldBag)) state.bag[id]+=qty;
    return Object.entries(yieldBag).map(([id,qty])=>qty+" "+items[id].name).join(", ");
  }

  function gather() {
    if (state.battle) return error("Finish this encounter before gathering.");
    if (!state.forageReady) return error("The next field leg, wild victory or successful invitation reveals another patch.");
    const supplies=harvest();
    state.forageReady=false;
    return commit("gathered","Gathered "+supplies+".");
  }

  function craft(id) {
    if (state.battle) return error("Pack your supplies between encounters.");
    const recipe=Object.hasOwn(items,id) && items[id].recipe;
    if (!recipe) return error("Choose a recipe in your pack.");
    if (Object.entries(recipe).some(([material,qty])=>state.bag[material]<qty)) return error("Gather the missing materials first.");
    for(const [material,qty] of Object.entries(recipe)) state.bag[material]-=qty;
    state.bag[id]++;
    state.crafted[id]=count(state.crafted[id])+1;
    return commit("crafted","Made one "+items[id].name+".");
  }

  function itemForecast(id,targetId){
    if(!["balm","tonic","sparkseed"].includes(id))return null;
    const b=state.battle,active=b?member(b.activeId):null,item=items[id];
    const target=member(targetId||active?.id||state.lead);
    let reason="";
    if(b?.secondBell)reason="Satchel items are unavailable in a Second Bell exhibition.";
    else if(wildWaitingReason())reason=wildWaitingReason();
    else if(!state.bag[id])reason="Craft a "+item.name+" first.";
    else if(!target||(b&&!state.team.includes(target.id)))reason="Choose a traveling companion.";
    else if(item.use==="revive"&&target.hp>0)reason="Choose a companion that has fainted.";
    else if(item.use==="heal"&&(!target.hp||target.hp===target.maxHp))reason="Choose a conscious injured companion.";
    const targetHp=target?.hp??0;
    const gain=reason?0:Math.min(target.maxHp-targetHp,Math.ceil(target.maxHp*(id==="tonic"?1:.5)));
    const targetHpAfterHeal=targetHp+gain;
    const activeHpAfterHeal=active?active.hp+(active===target?gain:0):null;
    const intent=active&&!reason?foeIntent():null;
    const reply=intent?replyPlan(active,1,intent,b.cover>0,activeHpAfterHeal):{returnDamage:0,fittingEvents:[]};
    const afterHit=active?activeHpAfterHeal-reply.returnDamage:null;
    const activeRecovery=intent?.call==="aid"?Math.min(active.maxHp-afterHit,Math.ceil(active.maxHp*.1)):0;
    const activeHpAfter=active?afterHit+activeRecovery:null;
    return {available:!reason,reason,itemId:id,targetId:target?.id??null,targetName:target?ownedKin(target.id).name:null,
      targetHp,targetMaxHp:target?.maxHp??0,gain,targetHpAfterHeal,targetHpAfter:target&&target===active?activeHpAfter:targetHpAfterHeal,
      activeId:active?.id??null,activeName:active?ownedKin(active.id).name:null,activeHp:active?.hp??null,activeMaxHp:active?.maxHp??null,
      activeHpAfterHeal,activeHpAfter,activeRecovery,replyName:intent?.skill.name??null,...reply};
  }

  function useItem(id,targetId) {
    if (state.battle?.secondBell) return error("Satchel items are unavailable in a Second Bell exhibition.");
    if (id!=="kinweave" && wildWaitingReason()) return error(wildWaitingReason());
    if(id==="broth"){
      if(state.battle)return error("Share a meal between encounters.");
      if(!state.bag.broth)return error("Prepare Trailpot broth in your satchel.");
      const guests=team().filter(p=>p.hp>0&&p.hp<p.maxHp);
      if(!guests.length)return error("Your traveling party has no injuries a meal can heal.");
      let restored=0;
      for(const p of guests){const gain=Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp/3));p.hp+=gain;restored+=gain;}
      state.bag.broth--;
      return commit("item","Shared Trailpot broth. "+guests.length+" companions recovered "+restored+" HP together.");
    }
    if (!Object.hasOwn(items,id)) return error("Unknown item.");
    if (id==="kinweave") return recruit();
    const plan=itemForecast(id,targetId);
    if(!plan)return error("Use this material in a recipe.");
    if(!plan.available)return error(plan.reason);
    member(plan.targetId).hp=plan.targetHpAfterHeal;
    state.bag[id]--;
    const message=items[id].name+" restored "+plan.gain+" HP to "+plan.targetName+".";
    if (state.battle) {earnBeat("care");return counterattack(message);}
    return commit("item",message);
  }

  function expedition(index=state.region) {
    if (!validRegion(index)) return null;
    const total=campaign.length(index), completed=count(state.surveys[index]);
    const done=completed>=total;
    const work=campaign.leg(index,Math.min(total-1,completed),{
      region:regions[index],pool:nativePools[index],species,dex,bag:state.bag,owned:member,team:team()
    });
    return {...work,title:done?"Field commission complete":work.title,
      description:done?"The passage is charted for travelers.":work.description,
      step:completed+1,completed,total,done,atSite:index===state.region && state.landmark===work.targetSite,
      choices:done?[]:work.choices};
  }
  function surveyedPassage(i) {
    return count(state.surveys[i])>=campaign.length(i)||state.reports.includes(i);
  }
  function surveyInstruction(i) {
    return "Chart "+regions[i].name+(i>=3?" through its commission or a naturalist’s report.":" by finishing its field commission.");
  }
  function passageReport(i=state.region) {
    if(!validRegion(i)||i<3)return null;
    const pool=pools[i],studies=pool.filter(id=>field?.recordedAt(state,id,i)).length;
    const observed=Math.min(3,pool.length),legs=Math.ceil(campaign.length(i)/3);
    const requirements=[
      {label:"File "+observed+" local wildlife observations ("+studies+"/"+observed+")",done:studies>=observed},
      {label:"Befriend an inhabitant of "+regions[i].name,done:pool.some(id=>member(id))},
      {label:"Chart "+legs+" regional field legs",done:count(state.surveys[i])>=legs}
    ];
    return {region:i,filed:state.reports.includes(i),requirements,atDesk:i===state.region&&state.landmark==="travel"&&!state.battle};
  }
  function filePassage() {
    const i=state.region,r=passageReport();
    if(!r||!r.atDesk)return error("Bring your report to the local trailpost.");
    if(r.filed)return error("The station has already accepted this report.");
    const missing=r.requirements.find(req=>!req.done);
    if(missing)return error(missing.label+".");
    state.reports.push(i);
    for(const p of team())if(p.level<regions[i].wildLevel)giveXp(p,xpNeeded(p.level));
    return commit("report","Report filed. The station recognizes your survey for the Warden trial. The remaining commission is open.");
  }

  function finishLeg(awardSupplies=true) {
    const i=state.region;
    state.surveys[i]=Math.min(campaign.length(i),count(state.surveys[i])+1);
    state.forageReady=true;
    if(awardSupplies){state.bag.reed++;state.bag.sap++;}
    return state.surveys[i]===campaign.length(i)
      ? " Field commission complete in "+regions[i].name+"! The route is charted."
      : " Leg "+state.surveys[i]+" of "+campaign.length(i)+" charted.";
  }

  function expeditionAction(id) {
    if (state.battle) return error("Finish this encounter first.");
    const job=expedition(), i=state.region;
    if (job.done) return error("This region is already charted.");
    if (!job.atSite) return error("Visit the "+job.targetSite+" landmark for this leg.");
    const choice=job.choices.find(c=>c.id===id);
    if (!choice || !choice.available) return error(choice?.description || "Choose a field approach.");
    if (!team().some(p=>p.hp>0)) return error("Rest at camp before setting out.");
    if (choice.cost) for (const [item,n] of Object.entries(choice.cost)) state.bag[item]-=n;
    if (!choice.foes) {
      const message=job.kind==="read"?"The formation recognizes the signal and opens a path.":"The crew puts your field supplies to work.";
      return commit("charted",message+finishLeg());
    }
    const pool=nativePools[i], initial=pool.indexOf(job.focus);
    const foes=Array.from({length:choice.foes},(_,n)=>pool[(initial+n)%pool.length]);
    const weather=job.kind==="tactic" ? species[job.focus].types[0] : null;
    return beginEncounter("expedition",foes,regions[i].wildLevel,job.title+" — "+choice.label+".",{
      commissioned:job.completed,bonus:choice.bonus || null,weather,condition:job.condition
    });
  }

  function license(ability) {
    if (!Object.hasOwn(dex.abilities,ability)) return null;
    const local=window.WilderAtlas.routes.find(r=>r.ability===ability).start;
    const requirements=[
      {label:"Hear the instructor’s "+ability+" lesson in the story journal",done:story.hasLesson(state,ability)},
      {label:"Befriend a "+ability+" carrier",done:state.party.some(p=>species[p.id].ability===ability)},
      {label:"Chart two field legs in "+regions[local].name,done:count(state.surveys[local])>=2},
      {label:"Win two encounters in "+regions[local].name,done:count(state.localWins[local])>=2}
    ];
    return {name:ability,region:local,requirements,earned:state.licenses.includes(ability)};
  }

  function claimLicense(ability) {
    const l=license(ability);
    if (!l || state.battle) return error("Visit the training ground between encounters.");
    if (l.earned) return error("This field license is already yours.");
    if (l.region!==state.region) return error("Visit "+regions[l.region].name+" to receive this license.");
    const missing=l.requirements.find(r=>!r.done);
    if (missing) return error(missing.label+".");
    state.licenses.push(ability);
    return commit("licensed",ability+" license earned! Your companions can find Bellstone on first visits to "+ability+" crossings.");
  }

  function gamePass(id) {
    const fair=activities.games.find(g=>g.id===id);
    if (!fair) return null;
    const i=fair.region, number=activities.games.indexOf(fair);
    const requests=[
      {label:"Chart "+(i<3?1:2)+" local field "+(i<3?"leg":"legs"),done:count(state.surveys[i])>=(i<3?1:2)},
      number%3===0 ? {label:"Make a Fern balm for the station",done:count(state.crafted.balm)>0} :
      number%3===1 ? {label:"Win two local encounters",done:count(state.localWins[i])>=2} :
      {label:"Befriend a local Wilderkin",done:pools[i].some(id=>enrolled(id,state.party))}
    ];
    const earned=state.passes.includes(id);
    const reason=earned?"Permanent admission at "+regions[i].name:requests.find(r=>!r.done)?.label || "Collect your pass at "+regions[i].name;
    return {region:i,earned,requirements:requests,reason};
  }

  function unlockGame(id) {
    const pass=gamePass(id);
    if (!pass || state.battle) return error("Visit the host field station between encounters.");
    if (pass.earned) return error("You already hold permanent admission.");
    if (state.region!==pass.region) return error("This game belongs to "+regions[pass.region].name+".");
    if (state.landmark!=="activities") return error("Visit the local field station to collect your pass.");
    if (pass.requirements.some(r=>!r.done)) return error(pass.reason+".");
    state.passes.push(id);
    return commit("pass","Permanent admission earned at "+regions[pass.region].name+"!");
  }

  function storyStep(id,choiceId,mode) {
    if (state.battle) return error("Finish this encounter before speaking.");
    const outcome=story.advance(state,id,choiceId,mode);
    if(outcome.ok&&!save())return changedTrail();
    return outcome;
  }

  function setSound(enabled) {
    state.sound = Boolean(enabled);
    return commit("sound", state.sound ? "Sound on." : "Sound off.");
  }

  function reset() {
    const fresh=persistReplacement(newGame());
    return fresh.ok?result("reset","A fresh adventure begins in Mossbrook Vale."):fresh;
  }

  // Loaner bouts run the exact campaign combat rules against an isolated roster.
  // Only the course controller persists the result, after the temporary context ends.
  function withLoaners(snapshot,callback) {
    if(usingLoaners) throw new Error("A loaner bout is already resolving.");
    const original=state;
    const temporary={...newGame(),region:snapshot.region,party:snapshot.party,team:snapshot.team,lead:snapshot.lead,battle:snapshot.battle};
    usingLoaners=true;
    state=temporary;
    try {
      const start=(ids,level,label,conditions={})=>beginEncounter("circuit",ids,level,label,conditions);
      const answer=callback(start);
      if(answer && typeof answer.then==="function") throw new Error("A loaner turn must finish synchronously.");
      snapshot.party=temporary.party;
      snapshot.battle=temporary.battle;
      return answer;
    } finally {
      state=original;
      usingLoaners=false;
    }
  }
  function saveCircuit(record) {
    if(usingLoaners) throw new Error("Finish the loaner turn before recording its result.");
    state.circuit=record;return save();
  }
  function saveSparring(record) {
    if(usingLoaners) throw new Error("Finish the loaner turn before saving a sparring match.");
    state.sparring=record;return save();
  }
  function recordRelay(course,id) {
    if (usingLoaners) return error("Finish the school bout before recording its stamp.");
    const stamp=typeof course==="string" && typeof id==="string" ? course+"|"+id : null;
    if (!relayStamps.includes(stamp)) return error("Choose a Reedbank course and its registered loaner.");
    if (state.relayClears.includes(stamp)) return result("relay","This drill stamp is already in your journal.");
    state.relayClears.push(stamp);
    return commit("relay","Reedbank recorded your drill stamp.");
  }
  function pinRegion(i,action) {
    if(!validRegion(i))return error("Select a region in the atlas.");
    if(action==="remove"){
      state.pins=state.pins.filter(index=>index!==i);
      if(state.destination===i)state.destination=null;
      return commit("pin","Removed the pin from "+regions[i].name+".");
    }
    if(action==="untrack"){state.destination=null;return commit("pin","Your main objective is on the map again.");}
    if(!state.pins.includes(i))state.pins.push(i);
    if(action==="track")state.destination=i;
    return commit("pin",regions[i].name+(action==="track"?" is your tracked destination.":" pinned in the atlas."));
  }
  function setWalker(value) {
    const reply=walking.select(state,value);if(reply.ok&&!save())return changedTrail();
    return reply;
  }
  // Capture only fields the ordinary encounter uses. A rehearsal can be
  // restarted after the trail changes, without rereading the career or its save.
  function rehearsalTeam(ids,lead,opponents,region) {
    if(!Array.isArray(ids)||!integer(ids.length,1,6)||unique(ids).length!==ids.length||
        !ids.every(id=>member(id))||!ids.includes(lead)||!Array.isArray(opponents)||!validRegion(region))return null;
    const snapshot=teamSnapshot(ids,lead,opponents,region);
    return ()=>createInstance(JSON.parse(snapshot));
  }
  function teamSnapshot(ids,lead,opponents,region,battle=null) {
    const relevant=new Set([...ids,...opponents]);
    const party=state.party.filter(p=>relevant.has(p.id)).map(p=>({...p,hp:!battle&&ids.includes(p.id)?p.maxHp:p.hp}));
    return JSON.stringify({
      version:state.version,region,party,team:ids,lead,battle,landmark:null,
      seen:state.seen.filter(id=>relevant.has(id)),growth:state.growth,trainedGuards:state.trainedGuards.filter(id=>relevant.has(id)),
      bag:state.bag,crests:state.crests,visited:state.visited,met:state.met,wardenLessons:state.wardenLessons,
      wins:state.wins,localWins:{},trailFittings:{claimed:state.trailFittings.claimed,
        gear:Object.fromEntries(Object.entries(state.trailFittings.gear).filter(([id])=>ids.includes(id)))},fittingNotes:{},
      sound:state.sound,music:state.music,animationSpeed:state.animationSpeed
    });
  }

  const turnActions={useSkill:withImpacts(useSkill),swap:withImpacts(swap),useItem:withImpacts(useItem),useDuet:withImpacts(useDuet),
    useTrio:withImpacts(useTrio),useFamilyTechnique:withImpacts(useFamilyTechnique),useEmberTechnique:withImpacts(useEmberTechnique)};
  if(rehearsal)return {
    get state(){return state;},
    species,regions,pools,items,kin,team,loaner:makeMember,duetPair,growthInfo,guardTraining,
    startBattle,foeIntent,wardenForecast,wardenLesson,skillPreview,ordinaryForecast,duets,switchForecast,
    replacements,familyTechnique,emberTechnique,itemForecast,trailFittings,trio,
    ...turnActions,replaceFainted,flee,
    incomingForecast(id=state.battle?.activeId){
      const p=member(id),intent=foeIntent();
      if(!intent||!p?.hp||!state.team.includes(id))return null;
      const hit=replyPlan(p,1,intent);
      return {name:intent.skill.name,type:intent.skill.type,power:intent.power,charged:intent.charged,
        damage:hit.returnDamage,hpAfter:p.hp-hit.returnDamage,maxHp:p.maxHp,fittingEvents:hit.fittingEvents};
    },
    checkpoint(){
      const saved=JSON.stringify(state);
      return ()=>{replaceTrail(JSON.parse(saved));pendingFittingEvents.length=0;};
    }
  };
  return {
    rehearsalTeam,wardenRoster,trio,...turnActions,firstBattle,
    trailSaveIsCurrent,trailFittings,claimFittings,equipFitting,trailFittingPreview,
    firstOuting:window.WilderOpening?.create({state:()=>state,commit,setLead,sightings:()=>field?.sightings(state.region)||[]}),
    wardenLesson,wardenForecast,guardTraining,guardPractice,switchForecast,ordinaryForecast,emberTechnique,replacements,replaceFainted,
    passageReport,filePassage,secondBell,wildCall,answerWildCall:withImpacts(answerWildCall),captureStatus,
    pinRegion,setWalker,walkerPose:(time,reduced)=>walking?.pose(state,time,reduced),walkerInfo:()=>walking.info(state),walkerSense:()=>walking.sense(state,field.sightings(state.region),expedition(),objective()),
    stillwake:window.WilderStillwake?.create({state:()=>state,commit,regions,species,makeMember,story,duetPair}),
    hollows:window.WilderHollows?.create({state:()=>state,commit,regions,species,items}),
    withLoaners,saveCircuit,saveSparring,recordRelay,loaner:(id,level)=>validSpecies(id)&&integer(level,1,MAX_LEVEL)?makeMember(id,level):null,
    caravan:window.WilderCaravans?.create({state:()=>state,commit,hpAt,regions,species,items,fittings,isCurrent:currentForEdit,blocked:()=>usingLoaners}),
    sightings:(i=state.region)=>field?.sightings(i)||[],study:id=>field.study(state,id),
    notebook:()=>field.notebook(state),canInvite:fieldInvitation,observe,inviteField,cycleAnimationSpeed,cycleMusic,
    get state() { return state; },
    get canSave() { return canSave&&!recovery; },
    get saveRecovery() { return recovery; },damagedSave,previewBackup,
    exportCampaign:()=>JSON.stringify(state),
    resumeSaving:()=>recovery?persistReplacement(state):error("This campaign is already using normal autosave."),
    items,conditions:campaign.conditions,visitSite,gather,craft,itemForecast,expedition,expeditionAction,license,claimLicense,
    gamePass,unlockGame,storyStep,trialAccess,wildLevel:i=>regions[i]?.wildLevel,
    species,kin,growthInfo,chooseGrowth,growthAppearance,skillPreview,regions, wardens, homes, pools, access, questCrossing, team, enlist, foeIntent, maxLevel:MAX_LEVEL,
    awardGame, questAction, xpNeeded, objective, setPosition, realmWalking, travel, setLead,
    heal, meetWarden, startBattle, duetPair, duets, familyTechnique, recruit, flee, setSound, reset
  };
  }
  window.WilderGame=createInstance();
})();
