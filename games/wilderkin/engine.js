(() => {
  "use strict";

  const SAVE_KEY = "wilderkin.trail.v3";
  const LEGACY_KEYS = ["wilderkin.trail.v2","wilderkin.trail.v1"];
  const MAX_LEVEL = 180;
  const campaign = window.WilderCampaign;
  const story = window.WilderStory;
  const items = campaign.items;
  const starters = ["sprigkit", "cindlet", "dewfin"];
  const dex = window.WilderKinDex;
  const activities = window.WilderActivities;

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
  const regions = window.WilderAtlas.regions;
  const wardens = regions.map((r, i) => r.warden ? i : -1).filter(i => i >= 0);
  const pools = dex.encounterPools;
  const homes = Object.fromEntries(Object.keys(species).map(id => [id, []]));
  pools.forEach((pool, i) => pool.forEach(id => homes[id].push(i)));
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
  const field=window.WilderFieldwork?.create({species,pools,regions});
  const walking=window.WilderWalkingPartner?.create({species,regions});

  function newGame() {
    return {
      version: 3, region: 0, positions: {}, party: starters.map(id => makeMember(id, 5)),
      lead: starters[0], crests: [], met: [], seen: starters.slice(), battle: null,
      team: starters.slice(), visited: [0], quests: {}, clears: {}, rests: 0,
      sound: true, wins: 0, bag:{reed:5,sap:5,ore:2,kinweave:4,balm:3,tonic:1,sparkseed:1},
      surveys:{},localWins:{},licenses:[],passes:[],crafted:{},landmark:null,forageReady:true,
      story:story.restore(null),refit:0,animationSpeed:1,music:1,
      fieldwork:field?.restore(null)||{},caravan:window.WilderCaravans?.restore(null,[])||{},
      circuit:window.WilderTrials?.restore(null)??null,pins:[],destination:null,
      walking:walking?.restore(null,[])||{},hollows:window.WilderHollows?.restore(null)||{}
    };
  }

  function validFighter(fighter) {
    return fighter && validSpecies(fighter.id) && integer(fighter.level, 1, MAX_LEVEL)
      && fighter.maxHp === hpAt(fighter.id, fighter.level) && integer(fighter.hp, 0, fighter.maxHp);
  }

  function loadGame() {
    for (const key of [SAVE_KEY,...LEGACY_KEYS]) {
      try {
        const raw=window.localStorage.getItem(key);
        if (raw) {
          const decoded=readSave(JSON.parse(raw));
          if (decoded) return decoded;
        }
      } catch {
        // A damaged newer record can coexist with an intact older save.
      }
    }
    return newGame();
  }

  function readSave(saved) {
    const fresh = newGame();
    if (!saved || ![1,2,3].includes(saved.version) || !Array.isArray(saved.party)
      || !starters.every(id => saved.party.some(p => p?.id === id))
      || !saved.party.every(p => validFighter(p) && integer(p.xp, 0, xpNeeded(p.level) - 1))
      || unique(saved.party.map(p => p.id)).length !== saved.party.length) return null;
    fresh.party = saved.party;
    fresh.animationSpeed=[1,2,3].includes(saved.animationSpeed)?saved.animationSpeed:1;
    fresh.music=[0,1,2].includes(saved.music)?saved.music:saved.sound===false?0:1;
    fresh.fieldwork=field?.restore(saved.fieldwork)||{};
    fresh.caravan=window.WilderCaravans?.restore(saved.caravan,fresh.party)||{};
    fresh.circuit=window.WilderTrials?.restore(saved.circuit)??null;
    fresh.pins=unique((Array.isArray(saved.pins)?saved.pins:[]).filter(validRegion));
    fresh.destination=fresh.pins.includes(saved.destination)?saved.destination:null;
    fresh.walking=walking?.restore(saved.walking,fresh.party)||{};
    fresh.hollows=window.WilderHollows?.restore(saved.hollows)||{};
    fresh.team = unique((Array.isArray(saved.team) ? saved.team : fresh.party.map(p => p.id))
      .filter(id => enrolled(id, fresh.party))).slice(0, 6);
    if (!fresh.team.length) fresh.team = starters.slice();
    for (const i of wardens) {
      if (!Array.isArray(saved.crests) || !saved.crests.includes(i)) break;
      fresh.crests.push(i);
    }
    fresh.met = unique([...(Array.isArray(saved.met) ? saved.met.filter(i => wardens.includes(i)) : []), ...fresh.crests]);
    fresh.seen = unique([...(Array.isArray(saved.seen) ? saved.seen.filter(validSpecies) : []), ...fresh.party.map(p => p.id)]);
    const ownsAbility = ability => !ability || fresh.party.some(p => species[p.id].ability === ability);
    const reachable = i => validRegion(i) && regions[i].requiredCrests <= fresh.crests.length && ownsAbility(regions[i].ability);
    if (reachable(saved.region)) fresh.region = saved.region;
    const visited = Array.isArray(saved.visited) ? saved.visited : Object.keys(saved.positions || {}).map(Number);
    fresh.visited = unique([0, ...visited.filter(reachable), ...fresh.crests, fresh.region]);
    fresh.rests = count(saved.rests);
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
    if (battle && ["wild","warden","expedition"].includes(battle.kind) && validFighter(battle.enemy) && battle.enemy.hp > 0
      && pools[fresh.region].includes(battle.enemy.id) && fresh.team.includes(battle.activeId) && fresh.party.some(p => p.id === battle.activeId && p.hp > 0)
      && Number.isSafeInteger(battle.turn) && battle.turn >= 1 && Array.isArray(battle.log)) {
      fresh.battle = {
        kind: battle.kind, activeId: battle.activeId, enemy: battle.enemy, turn: battle.turn,
        remaining: battle.kind !== "wild" && Array.isArray(battle.remaining) ? battle.remaining.filter(id => pools[fresh.region].includes(id)).slice(0, 6) : [],
        commissioned: battle.kind === "expedition" && count(battle.commissioned) === count(fresh.surveys[fresh.region]) ? count(battle.commissioned) : null,
        bonus: battle.bonus === "supplies" ? "supplies" : null,
        weather: Object.hasOwn(dex.types,battle.weather) ? battle.weather : null,
        condition:Object.hasOwn(campaign.conditions,battle.condition)?battle.condition:null,
        lastAttack:typeof battle.lastAttack==="string"?battle.lastAttack:null,
        beats:integer(battle.beats,0,3)?battle.beats:1,
        lastPart:["strike","guard","care","switch"].includes(battle.lastPart)?battle.lastPart:null,
        opening:battle.opening===true,
        log: battle.log.filter(entry => typeof entry === "string").slice(-8)
      };
    }
    if (!fresh.team.some(id => fresh.party.find(p => p.id === id)?.hp > 0)) fresh.party.forEach(p => { p.hp = p.maxHp; });
    return fresh;
  }

  let state = loadGame();
  let canSave = true;
  let usingLoaners=false;

  function save() {
    if(usingLoaners) return;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      canSave = true;
    } catch {
      canSave = false;
    }
  }

  function commit(kind, message) {
    save();
    return result(kind, message);
  }

  function access(index) {
    if (!validRegion(index)) return {open:false, reason:"Unknown trail."};
    const r = regions[index];
    if (r.requiredCrests > state.crests.length) {
      const previous = regions[wardens[r.requiredCrests - 1]];
      return {open:false, reason:"Earn the " + previous.crest + " at " + previous.lodge + "."};
    }
    if (!state.visited.includes(index) && index>0 && count(state.surveys[index-1]) < campaign.length(index-1)) {
      return {open:false,hintRegion:index-1,reason:"Chart "+regions[index-1].name+" by finishing its field commission."};
    }
    if (r.ability && !state.visited.includes(index)) {
      if (!state.licenses.includes(r.ability)) {
        const school=license(r.ability);
        return {open:false,hintRegion:school.region,reason:"Earn the "+r.ability+" license at "+regions[school.region].name+"."};
      }
      const carrier = state.party.find(p => species[p.id].ability === r.ability);
      if (carrier) return {open:true, carrier:carrier.id, reason:species[carrier.id].name + " can use " + r.ability + "."};
      const nearby = [r.routeStart, ...state.visited, ...regions.map((_, i) => i)].find(i =>
        regions[i] && regions[i].requiredCrests <= state.crests.length && !regions[i].ability &&
        pools[i].some(id => species[id].ability === r.ability));
      const friend = nearby == null ? null : pools[nearby].find(id => species[id].ability === r.ability);
      const hint = friend ? " Track " + species[friend].name + " in " + regions[nearby].name + "." : "";
      return {open:false, hintRegion:nearby, reason:"Requires " + r.ability + "." + hint};
    }
    return {open:true, reason:state.visited.includes(index) ? "Previously visited" : "Open trail"};
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
      return state.party.length < Object.keys(species).length
        ? {title:"Befriend every Wilderkin",description:"Track missing companions through the field guide."}
        : {title:"The trail is yours",description:"Every crest and Wilderkin is yours. The field stations remain open."};
    }
    const firstUncharted=regions.findIndex((r,i)=>r.requiredCrests===state.crests.length && count(state.surveys[i])<campaign.length(i));
    if (firstUncharted>=0) {
      const a=access(firstUncharted);
      if (!a.open) return {title:"Open the trail to "+regions[firstUncharted].name,description:a.reason,target:a.hintRegion};
      const job=expedition(firstUncharted);
      return {title:job.title,description:regions[firstUncharted].name+" · Field leg "+(job.completed+1)+" of "+job.total+". "+job.description,target:firstUncharted};
    }
    if (!story.chapterDone(state,state.crests.length)) return {title:"Hear the next dispatch",description:"Read chapter "+(state.crests.length+1)+" of the campaign before facing the Warden.",target:next};
    const r = regions[next];
    if (state.region !== next) {
      const gate = access(next);
      if (!gate.open) return {title:"Find a " + r.ability + " companion", description:gate.reason, target:gate.hintRegion};
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
    save();
    return true;
  }

  function travel(index) {
    if (state.battle) return error("Finish this encounter before traveling.");
    const gate = access(index);
    if (!gate.open) return error(gate.reason);
    if (!state.visited.includes(index)) state.visited.push(index);
    state.region = index;
    state.landmark = null;
    return commit("travel", (gate.carrier ? species[gate.carrier].name + " used " + regions[index].ability + "! " : "") + "You arrived in " + regions[index].name + ".");
  }

  const member = id => state.party.find(p => p.id === id);
  const team = () => state.team.map(member);
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
    return commit("team", species[id].name + " joined your traveling party.");
  }
  function setLead(id) {
    if (state.battle) return error("Use a battle switch to change your active companion.");
    const p = member(id);
    if (!state.team.includes(id) || !p || p.hp === 0) return error("Choose a companion with some health remaining.");
    state.lead = id;
    return commit("lead", species[id].name + " is leading your party.");
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
    const unfinished=regions.findIndex((area,i)=>area.ordinal===r.ordinal && count(state.surveys[i])<campaign.length(i));
    if (unfinished>=0) return {open:false,target:unfinished,reason:"Chart the field commission in "+regions[unfinished].name+"."};
    if (!story.chapterDone(state,r.ordinal)) return {open:false,reason:"Hear chapter "+(r.ordinal+1)+" in your story journal."};
    return {open:true,reason:"The trial is ready."};
  }

  function beginEncounter(kind,ids,level,label,options={}) {
    const lead=member(state.lead);
    const ready=lead?.hp>0 ? lead : team().find(p=>p.hp>0);
    if (!ready) return error("Rest at camp before entering an encounter.");
    const enemy=makeMember(ids[0],level);
    const message=label+" "+species[enemy.id].name+" takes the field.";
    if (!state.seen.includes(enemy.id)) state.seen.push(enemy.id);
    state.battle={kind,activeId:ready.id,enemy,remaining:ids.slice(1),turn:1,
      commissioned:null,bonus:null,weather:null,condition:null,lastAttack:null,beats:1,lastPart:null,opening:false,...options,log:[message]};
    return commit("battle",message);
  }

  function startBattle(kind,track) {
    if (state.battle) return error("You are already in an encounter.");
    const r=regions[state.region], pool=pools[state.region];
    if (kind==="wild") {
      if (track!==undefined && !pool.includes(track)) return error("That species has no tracks here.");
      const id=track || pool[Math.floor(Math.random()*pool.length)];
      return beginEncounter(kind,[id],r.wildLevel,"A trail stirs!");
    }
    if (kind!=="warden") return error("Unknown encounter.");
    const gate=trialAccess();
    if (!gate.open) return error(gate.reason);
    if (!state.met.includes(state.region)) return meetWarden();
    const size = r.ordinal===0?1:r.ordinal<3?2:r.ordinal<9?3:r.ordinal<18?4:r.ordinal<24?5:6;
    const roster=Array.from({length:size-1},(_,k)=>pool[1+k%(pool.length-1)]);
    roster.push(pool[0]);
    return beginEncounter(kind,roster,r.wardenLevel,"Warden "+r.warden+" gives the signal.");
  }

  function damage(power, level, type, defender) {
    const modifier = dex.effectiveness(type, species[defender.id].types);
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

  function winBattle(message) {
    const {kind,activeId,enemy,remaining,commissioned,bonus}=state.battle;
    if (remaining.length) {
      const id = remaining.shift();
      state.battle.enemy = makeMember(id,enemy.level);
      state.battle.opening=false;
      if (!state.seen.includes(id)) state.seen.push(id);
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
    if(kind==="circuit") {
      state.battle=null;
      return result("victory",message+" The bout is yours.");
    }
    const xp = kind==="warden" ? Math.ceil(xpNeeded(enemy.level)*.85) : Math.ceil(xpNeeded(enemy.level)*(kind==="expedition" ? .18 : .12));
    const levels=[];
    let activeGain=0;
    for (const p of team()) {
      const gap=enemy.level-p.level;
      const catchup=gap>2 ? 1.7 : gap< -3 ? .2 : 1;
      const gain=Math.max(1, Math.round(xp*catchup*(p.id===activeId?1:.72)));
      if(p.id===activeId && p.level<MAX_LEVEL) activeGain=gain;
      if (giveXp(p,gain)) levels.push(species[p.id].name+" reached Lv. "+p.level+"!");
    }
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
    message += " " + species[activeId].name + " gained " + activeGain + " XP.";
    if (levels.length) message += " " + levels.join(" ");
    return commit("victory", message);
  }

  function foeIntent() {
    const b = state.battle;
    if (!b) return null;
    const r = regions[state.region];
    const attacks = species[b.enemy.id].skills.filter(skill => skill.kind === "attack");
    const laterTrial = b.kind === "warden" && r.requiredCrests >= 3;
    // Veteran Wardens train different rhythms. Their opponents can read the next move before committing.
    const rhythm = laterTrial ? [3, 2, 4][r.requiredCrests % 3] : 3;
    const charged = b.turn % rhythm === 0;
    const signature = attacks[Math.floor(b.turn / rhythm - 1) % attacks.length] || attacks[0];
    const skill = charged ? signature : {name:r.basicMove, type:"Neutral", power:5};
    const guarding = b.kind!=="wild" && !charged && (b.turn+r.ordinal)%4===0;
    return {skill,charged,guarding,power:skill.power+(charged ? rhythm + (laterTrial ? 2 : 0) : 0)};
  }

  function returnHit(defender,guardFactor,intent=foeIntent()) {
    const hit=damage(intent.power,state.battle.enemy.level,intent.skill.type,defender);
    return Math.max(1,Math.floor(hit*guardFactor));
  }

  function counterattack(firstMessage, guardFactor=1) {
    const battle = state.battle;
    const { enemy } = battle;
    const enemySpecies = species[enemy.id];
    const active = member(battle.activeId);
    const intent=foeIntent(),skill=intent.skill;
    const dealt=Math.min(active.hp,returnHit(active,guardFactor,intent));
    active.hp -= dealt;
    let reply = enemySpecies.name + " used " + skill.name + " for " + dealt + " damage.";
    if (active.hp === 0) {
      const next = team().find(p => p.hp > 0);
      if (!next) {
        state.battle = null;
        delete state.positions[state.region];
        state.landmark=null;
        state.party.forEach(p => { p.hp = p.maxHp; });
        return commit("defeat", "Your party ran out of strength. You returned to the trailhead, where your companions recovered to full health.");
      }
      battle.activeId = next.id;
      reply += " " + species[active.id].name + " needs a rest. " + species[next.id].name + " stepped in.";
    }
    battle.turn++;
    battle.log = [...battle.log, firstMessage, reply].slice(-8);
    return commit("turn", firstMessage + " " + reply);
  }

  function earnBeat(part) {
    const b=state.battle;
    if (part!==b.lastPart) b.beats=Math.min(3,b.beats+1);
    b.lastPart=part;
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
    const damageDone=Math.min(foe.hp-(role==="lure"?1:0),Math.max(1,Math.round(combined*.82*score.strength*brace)));
    const restore=p=>role==="mend" ? Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp/4)) : 0;
    const healLead=restore(lead),healPartner=restore(partner),switchLead=role==="relay";
    const defender=switchLead?partner:lead,defenderName=species[defender.id].name;
    const falls=damageDone===foe.hp,opens=role==="mark"&&!falls;
    const returnDamage=falls?0:Math.min(defender.hp+restore(defender),returnHit(defender,score.counter,intent));
    const reason=!partner.hp ? species[partner.id].name+" needs to recover." :
      battle.beats<cost ? "Needs "+(cost-battle.beats)+" more "+(cost-battle.beats===1?"beat.":"beats.") : "";
    const details=[damageDone+" damage"];
    if (role==="lure") details.push("leaves at least 1 HP");
    if (role==="mend") details.push("restore "+healLead+" / "+healPartner+" HP to leader / partner");
    if (switchLead) details.push(defenderName+" takes the lead");
    if (opens) details.push("expose foe for next attack");
    const knockedOut=!falls && returnDamage>=defender.hp+restore(defender);
    details.push(falls?"foe falls before its reply":defenderName+" takes "+returnDamage+" in reply"+(knockedOut?" and faints":""));
    return {partnerId:partner.id,name,type:species[partner.id].type,role:score.label,cost,available:!reason,
      reason,preview:details.join(" · "),damage:damageDone,returnDamage,healLead,healPartner,switchLead,opens,counter:score.counter};
  }

  function duets() {
    const battle=state.battle;
    if (!battle) return {beats:0,max:3,opening:false,hint:"Meet a wild Wilderkin to try a duet.",options:[]};
    const lead=member(battle.activeId),intent=foeIntent();
    const hint=(battle.opening?"Foe exposed: next attack skill bypasses guard and gains 50% damage. ":"")+
      (battle.lastPart?"Last part: "+battle.lastPart+". Change parts to earn a beat.":"Your first skill or switch earns a beat.")+
      " Parts: strike, guard, care, switch.";
    return {beats:battle.beats,max:3,opening:battle.opening,hint,
      options:team().filter(p=>p.id!==lead.id).map(p=>duetOption(lead,p,intent))};
  }

  function useDuet(partnerId) {
    const b=state.battle;
    if (!b) return error("There is no active encounter.");
    const option=duets().options.find(o=>o.partnerId===partnerId);
    if (!option) return error("Choose a duet with another traveling companion.");
    if (!option.available) return error(option.reason);
    const lead=member(b.activeId),partner=member(partnerId);
    b.beats-=option.cost;b.lastPart=null;b.lastAttack=null;
    b.enemy.hp-=option.damage;
    lead.hp+=option.healLead;partner.hp+=option.healPartner;
    if (option.opens) b.opening=true;
    if (option.switchLead) b.activeId=partnerId;
    let message=species[lead.id].name+" and "+species[partnerId].name+" used "+option.name+" for "+option.damage+" damage.";
    if (option.healLead||option.healPartner) message+=" Restored "+option.healLead+" / "+option.healPartner+" HP.";
    if (option.opens) message+=" The foe is exposed!";
    if (option.switchLead) message+=" "+species[partnerId].name+" takes the lead.";
    return b.enemy.hp===0?winBattle(message):counterattack(message,option.counter);
  }

  function useSkill(id) {
    const battle = state.battle;
    if (!battle) return error("There is no active encounter.");
    const active = member(battle.activeId);
    const user = species[active.id];
    if (id === "trail-feint" && battle.kind === "wild") {
      const foe = battle.enemy;
      const hit = Math.min(foe.hp - 1, Math.ceil(foe.maxHp / 4));
      if (!hit) return error("This Wilderkin is ready to befriend.");
      earnBeat("strike");
      foe.hp -= hit;
      return counterattack(user.name + " held back, dealing " + hit + " damage.");
    }
    const skill = user.skills.find(s => s.id === id);
    if (!skill) return error("Choose a skill your active companion knows.");
    if (skill.kind === "heal") {
      if (active.hp === active.maxHp) return error(user.name + " is already at full health.");
      earnBeat("care");
      const regained = Math.min(active.maxHp - active.hp, Math.ceil(active.maxHp / 3));
      active.hp += regained;
      return counterattack(user.name + " used " + skill.name + " and recovered " + regained + " HP.");
    }
    const enemy = battle.enemy;
    earnBeat(skill.kind==="guard"?"guard":"strike");
    const exposed=battle.opening && skill.kind==="attack";
    if (exposed) battle.opening=false;
    const braced=foeIntent().guarding && !exposed;
    const base=damage(skill.power,active.level,skill.type,enemy);
    const repeated=battle.condition==="echo" && battle.lastAttack===id;
    const braceEffect=braced ? (skill.kind==="guard" ? (battle.condition==="ledge" ? 1.65 : 1.4) : .55) : 1;
    const hit=Math.min(enemy.hp,Math.max(1,Math.round(base*braceEffect*(repeated ? .75 : 1)*(exposed?1.5:1))));
    battle.lastAttack=id;
    enemy.hp -= hit;
    const multiplier = dex.effectiveness(skill.type, species[enemy.id].types);
    const pairing = multiplier > 1 ? " Elemental advantage!" : multiplier < 1 ? " The target resisted." : "";
    const message = user.name + " used " + skill.name + " for " + hit + " damage." + pairing + (exposed?" Struck the opening!":"") + (repeated ? " Echo dulled the repeat." : "") + (braced ? skill.kind==="guard" ? " Broke its guard!" : " It braced for the strike." : "");
    if (enemy.hp === 0) return winBattle(message);
    return counterattack(message,skill.kind==="guard" ? (battle.condition==="ledge" ? .33 : .5) : 1);
  }

  function swap(id) {
    const battle = state.battle;
    if (!battle) return setLead(id);
    if (battle.activeId === id) return error("This companion is already in the field.");
    if (!state.team.includes(id) || !member(id)?.hp) return error("Choose a companion with some health remaining.");
    earnBeat("switch");
    battle.activeId = id;
    battle.lastAttack=null;
    return counterattack("You called in "+species[id].name+".",battle.condition==="gale" ? .25 : .5);
  }

  function recruit() {
    const battle = state.battle;
    if (!battle) return error("Look for a wild Wilderkin first.");
    if (battle.kind !== "wild") return error("Kinweaves work on individual Wilderkin you have tracked in the wild.");
    const { enemy } = battle;
    const name = species[enemy.id].name;
    if (member(enemy.id)) return error(name + " is already in your party.");
    if (enemy.hp * 2 > enemy.maxHp) return error("Bring " + name + " to half health or lower to befriend it.");
    if (!state.bag.kinweave) return error("Your Kinweaves are gone. Craft another with two reeds and one sun sap.");
    state.battle = null;
    return befriend(enemy.id,enemy.level);
  }

  function befriend(id,level) {
    state.bag.kinweave--;
    state.forageReady=true;
    state.party.push(makeMember(id,level));
    if(!state.seen.includes(id)) state.seen.push(id);
    const joinsTeam=state.team.length<6;
    if(joinsTeam) state.team.push(id);
    return commit("recruited","The Kinweave opens. "+species[id].name+(joinsTeam?" joined your traveling party!":" joined your reserve!"));
  }

  function observe(id,action) {
    const res=field.observe(state,id,action);
    if(res.kind==="field-note") walking?.remember(state,"note",id);
    if(res.kind==="field-note" && count(state.surveys[state.region])<campaign.length(state.region)) {
      const recorded=pools[state.region].filter(kin=>state.fieldwork[kin]?.complete).length;
      if(recorded<=2) res.message+=" The station accepts your wildlife report."+finishLeg();
    }
    if(res.ok) save();
    return res;
  }
  function inviteField(id) {
    const ready=field.canInvite(state,id);
    return ready.ok?befriend(id,regions[state.region].wildLevel):ready;
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
    state.battle = null;
    return commit("escaped", "You called your party back and returned to the trail.");
  }

  function training(amount) {
    const p = member(state.lead);
    if (p.level===MAX_LEVEL) return species[p.id].name+" is fully trained.";
    const leveled = giveXp(p, amount);
    return species[p.id].name + " gained " + amount + " XP" + (leveled ? " and reached level " + p.level : "") + ".";
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
    return commit("claimed", q.requester + " thanks you. " + training(75));
  }

  function visitSite(kind) {
    if (state.battle || !["camp","warden","wild","travel","activities"].includes(kind)) return false;
    // The renderer supplies the exact landmark coordinates. Checking the same tile or its neighbor
    // also accepts the keyboard interaction before the player steps onto a landmark sprite.
    const map=window.WilderWorld?.regions[state.region];
    if (map) {
      const point=state.positions[state.region] || map.spawn;
      if (!map.sites.some(site=>(site.kind||site.id)===kind && Math.abs(point.x-site.x)+Math.abs(point.y-site.y)<=1)) return false;
    }
    state.landmark=kind;
    save();
    return true;
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

  function useItem(id,targetId) {
    if (!Object.hasOwn(items,id)) return error("Unknown item.");
    if (id==="kinweave") return recruit();
    const item=items[id], p=member(targetId || state.battle?.activeId || state.lead);
    if (item.use==="material") return error("Use this material in a recipe.");
    if (!state.bag[id]) return error("Craft a "+item.name+" first.");
    if (!p || (state.battle && !state.team.includes(p.id))) return error("Choose a traveling companion.");
    if (item.use==="revive" && p.hp>0) return error("Choose a companion that has fainted.");
    if (item.use==="heal" && (p.hp===0 || p.hp===p.maxHp)) return error("Choose a conscious injured companion.");
    const regained=Math.min(p.maxHp-p.hp,Math.ceil(p.maxHp*(id==="tonic" ? 1 : .5)));
    p.hp+=regained;
    state.bag[id]--;
    const message=items[id].name+" restored "+regained+" HP to "+species[p.id].name+".";
    if (state.battle) {earnBeat("care");return counterattack(message);}
    return commit("item",message);
  }

  function expedition(index=state.region) {
    if (!validRegion(index)) return null;
    const total=campaign.length(index), completed=count(state.surveys[index]);
    const done=completed>=total;
    const work=campaign.leg(index,Math.min(total-1,completed),{
      region:regions[index],pool:pools[index],species,dex,bag:state.bag,owned:member,team:team()
    });
    return {...work,title:done?"Field commission complete":work.title,
      description:done?"The passage is charted for travelers.":work.description,
      step:completed+1,completed,total,done,atSite:index===state.region && state.landmark===work.targetSite,
      choices:done?[]:work.choices};
  }

  function finishLeg() {
    const i=state.region;
    state.surveys[i]=Math.min(campaign.length(i),count(state.surveys[i])+1);
    state.forageReady=true;
    // Every charted waypoint includes modest raw supplies. A long detour also awards a full salvage cache.
    state.bag.reed++; state.bag.sap++;
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
    const pool=pools[i], initial=pool.indexOf(job.focus);
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
    return commit("licensed",ability+" license earned! Your registered companions can now open these crossings.");
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

  function storyStep(id,choiceId) {
    if (state.battle) return error("Finish this encounter before speaking.");
    const outcome=story.advance(state,id,choiceId);
    if (outcome.ok) save();
    return outcome;
  }

  function setSound(enabled) {
    state.sound = Boolean(enabled);
    return commit("sound", state.sound ? "Sound on." : "Sound off.");
  }

  function reset() {
    state = newGame();
    return commit("reset", "A fresh adventure begins in Mossbrook Vale.");
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
    state.circuit=record;save();
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
    const reply=walking.select(state,value);if(reply.ok) save();
    return reply;
  }
  window.WilderGame = {
    pinRegion,setWalker,walkerPose:(time,reduced)=>walking?.pose(state,time,reduced),walkerInfo:()=>walking.info(state),walkerSense:()=>walking.sense(state,field.sightings(state.region),expedition(),objective()),
    hollows:window.WilderHollows?.create({state:()=>state,commit,regions,species,items}),
    withLoaners,saveCircuit,loaner:(id,level)=>validSpecies(id)&&integer(level,1,MAX_LEVEL)?makeMember(id,level):null,
    caravan:window.WilderCaravans?.create({state:()=>state,commit,hpAt,regions,species,items}),
    sightings:(i=state.region)=>field?.sightings(i)||[],study:id=>field.study(state,id),
    notebook:()=>field.notebook(state),canInvite:id=>field.canInvite(state,id),observe,inviteField,cycleAnimationSpeed,cycleMusic,
    get state() { return state; },
    get canSave() { return canSave; },
    items,conditions:campaign.conditions,visitSite,gather,craft,useItem,expedition,expeditionAction,license,claimLicense,
    gamePass,unlockGame,storyStep,trialAccess,wildLevel:i=>regions[i]?.wildLevel,
    species, regions, wardens, homes, pools, access, team, enlist, foeIntent, maxLevel:MAX_LEVEL,
    awardGame, questAction, xpNeeded, objective, setPosition, travel, setLead,
    heal, meetWarden, startBattle, useSkill, duetPair, duets, useDuet, swap, recruit, flee, setSound, reset
  };
})();
