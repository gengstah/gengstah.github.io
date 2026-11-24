(() => {
  "use strict";

  const SAVE_KEY = "wilderkin.trail.v2";
  const LEGACY_KEY = "wilderkin.trail.v1";
  const MAX_LEVEL = 100;
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

  function newGame() {
    return {
      version: 2, region: 0, positions: {}, party: starters.map(id => makeMember(id, 5)),
      lead: starters[0], crests: [], met: [], seen: starters.slice(), battle: null,
      team: starters.slice(), visited: [0], quests: {}, clears: {}, rests: 0,
      sound: true, wins: 0
    };
  }

  function validFighter(fighter) {
    return fighter && validSpecies(fighter.id) && integer(fighter.level, 1, MAX_LEVEL)
      && fighter.maxHp === hpAt(fighter.id, fighter.level) && integer(fighter.hp, 0, fighter.maxHp);
  }

  function loadGame() {
    const fresh = newGame();
    try {
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? window.localStorage.getItem(LEGACY_KEY));
      if (!saved || ![1, 2].includes(saved.version) || !Array.isArray(saved.party)
        || !starters.every(id => saved.party.some(p => p?.id === id))
        || !saved.party.every(p => validFighter(p) && integer(p.xp, 0, xpNeeded(p.level) - 1))
        || unique(saved.party.map(p => p.id)).length !== saved.party.length) return fresh;
      fresh.party = saved.party;
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
      const battle = saved.battle;
      if (battle && ["wild", "warden"].includes(battle.kind) && validFighter(battle.enemy) && battle.enemy.hp > 0
        && pools[fresh.region].includes(battle.enemy.id) && fresh.team.includes(battle.activeId) && fresh.party.some(p => p.id === battle.activeId && p.hp > 0)
        && Number.isSafeInteger(battle.turn) && battle.turn >= 1 && Array.isArray(battle.log)) {
        fresh.battle = {
          kind: battle.kind, activeId: battle.activeId, enemy: battle.enemy, turn: battle.turn,
          remaining: battle.kind === "warden" && Array.isArray(battle.remaining) ? battle.remaining.filter(id => pools[fresh.region].includes(id)).slice(0, 2) : [],
          log: battle.log.filter(entry => typeof entry === "string").slice(-8)
        };
      }
      if (!fresh.team.some(id => fresh.party.find(p => p.id === id)?.hp > 0)) fresh.party.forEach(p => { p.hp = p.maxHp; });
      return fresh;
    } catch {
      return fresh;
    }
  }

  let state = loadGame();
  let canSave = true;

  function save() {
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
    if (r.ability && !state.visited.includes(index)) {
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
    const next = wardens.find(i => !state.crests.includes(i));
    if (next === undefined) {
      return state.party.length < Object.keys(species).length
        ? { title:"Befriend every Wilderkin", description:"Track missing companions through the field guide." }
        : { title:"The trail is yours", description:"Every crest and Wilderkin is yours. Visit the field stations for local requests and games." };
    }
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
    state.rests++;
    return commit("healed", "Your party rested. Every companion is back to full health.");
  }

  function meetWarden() {
    if (state.battle) return error("Finish this encounter first.");
    const region = regions[state.region];
    if (!region.warden) return error("This region has no Warden trial.");
    if (!state.met.includes(state.region)) state.met.push(state.region);
    const message = state.crests.includes(state.region) ? "Good to see you again, Trailkeeper. How about a rematch?" : region.dialogue;
    return commit("dialogue", message);
  }

  function startBattle(kind, track) {
    if (state.battle) return error("You are already in an encounter.");
    if (kind !== "wild" && kind !== "warden") return error("Unknown encounter.");
    if (kind === "warden" && !regions[state.region].warden) return error("This region has no Warden trial.");
    if (kind === "warden" && !state.met.includes(state.region)) return meetWarden();
    const active = member(state.lead);
    const ready = active?.hp > 0 ? active : team().find(p => p.hp > 0);
    if (!ready) return error("Rest at camp before entering an encounter.");
    const region = regions[state.region];
    const pool = pools[state.region];
    if (track !== undefined && !pool.includes(track)) return error("That species has no tracks here.");
    const multi = kind === "warden" && region.requiredCrests >= 3;
    const signature = pool[0];
    const wild = track || pool[Math.floor(Math.random() * pool.length)];
    const enemy = makeMember(kind === "wild" ? wild : multi ? pool[1] : signature,
      kind === "wild" ? region.wildLevel : region.wardenLevel);
    const remaining = multi ? (region.requiredCrests >= 17 ? [pool[2], signature] : [signature]) : [];
    const name = species[enemy.id].name;
    if (!state.seen.includes(enemy.id)) state.seen.push(enemy.id);
    const message = kind === "wild" ? "A wild " + name + " appeared!" : "Warden " + region.warden + " calls on " + name + "!";
    state.battle = { kind, activeId: ready.id, enemy, remaining, turn: 1, log: [message] };
    return commit("battle", message);
  }

  function damage(power, level, type, defender) {
    const modifier = dex.effectiveness(type, species[defender.id].types);
    return Math.max(1, Math.round((power + (level - 5) * 0.8) * modifier));
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
    const { kind, activeId, enemy, remaining } = state.battle;
    if (remaining.length) {
      const id = remaining.shift();
      state.battle.enemy = makeMember(id, regions[state.region].wardenLevel);
      if (!state.seen.includes(id)) state.seen.push(id);
      const reply = "Warden " + regions[state.region].warden + " calls on " + species[id].name + "!";
      state.battle.turn++;
      state.battle.log = [...state.battle.log, message, reply].slice(-8);
      return commit("turn", reply);
    }
    const xp = (kind === "warden" ? 28 : 14) + enemy.level * 2;
    const levels = [];
    team().forEach(p => {
      if (giveXp(p, p.id === activeId ? xp : Math.ceil(xp / 2))) levels.push(species[p.id].name + " reached Lv. " + p.level + "!");
    });
    state.battle = null;
    state.wins++;
    const region = regions[state.region];
    if (kind === "warden" && !state.crests.includes(state.region)) {
      state.crests.push(state.region);
      message += " You earned the " + region.crest + "! " + region.farewell;
    }
    message += " " + species[activeId].name + " gained " + xp + " XP.";
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
    return {skill, charged, power: skill.power + (charged ? rhythm - 2 : 0)};
  }

  function counterattack(firstMessage, guarded) {
    const battle = state.battle;
    const { enemy } = battle;
    const enemySpecies = species[enemy.id];
    const active = member(battle.activeId);
    const {skill, power} = foeIntent();
    const hit = damage(power, enemy.level, skill.type, active);
    const dealt = Math.min(active.hp, guarded ? Math.max(1, Math.floor(hit / 2)) : hit);
    active.hp -= dealt;
    let reply = enemySpecies.name + " used " + skill.name + " for " + dealt + " damage.";
    if (active.hp === 0) {
      const next = team().find(p => p.hp > 0);
      if (!next) {
        state.battle = null;
        delete state.positions[state.region];
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

  function useSkill(id) {
    const battle = state.battle;
    if (!battle) return error("There is no active encounter.");
    const active = member(battle.activeId);
    const user = species[active.id];
    if (id === "trail-feint" && battle.kind === "wild") {
      const foe = battle.enemy;
      const hit = Math.min(foe.hp - 1, Math.ceil(foe.maxHp / 4));
      if (!hit) return error("This Wilderkin is ready to befriend.");
      foe.hp -= hit;
      return counterattack(user.name + " held back, dealing " + hit + " damage.", false);
    }
    const skill = user.skills.find(s => s.id === id);
    if (!skill) return error("Choose a skill your active companion knows.");
    if (skill.kind === "heal") {
      if (active.hp === active.maxHp) return error(user.name + " is already at full health.");
      const regained = Math.min(active.maxHp - active.hp, Math.ceil(active.maxHp / 3));
      active.hp += regained;
      return counterattack(user.name + " used " + skill.name + " and recovered " + regained + " HP.", false);
    }
    const enemy = battle.enemy;
    const hit = Math.min(enemy.hp, damage(skill.power, active.level, skill.type, enemy));
    enemy.hp -= hit;
    const multiplier = dex.effectiveness(skill.type, species[enemy.id].types);
    const pairing = multiplier > 1 ? " Elemental advantage!" : multiplier < 1 ? " The target resisted." : "";
    const message = user.name + " used " + skill.name + " for " + hit + " damage." + pairing;
    if (enemy.hp === 0) return winBattle(message);
    return counterattack(message, skill.kind === "guard");
  }

  function swap(id) {
    const battle = state.battle;
    if (!battle) return setLead(id);
    if (battle.activeId === id) return error("This companion is already in the field.");
    if (!state.team.includes(id) || !member(id)?.hp) return error("Choose a companion with some health remaining.");
    battle.activeId = id;
    return counterattack("You called in " + species[id].name + ".", true);
  }

  function recruit() {
    const battle = state.battle;
    if (!battle) return error("Look for a wild Wilderkin first.");
    if (battle.kind !== "wild") return error("A Warden’s companion already has a home.");
    const { enemy } = battle;
    const name = species[enemy.id].name;
    if (member(enemy.id)) return error(name + " is already in your party.");
    if (enemy.hp * 2 > enemy.maxHp) return error("Bring " + name + " to half health or lower to befriend it.");
    state.party.push(makeMember(enemy.id, enemy.level));
    const joinsTeam = state.team.length < 6;
    if (joinsTeam) state.team.push(enemy.id);
    state.battle = null;
    return commit("recruited", name + (joinsTeam ? " joined your traveling party!" : " joined your reserve! Visit the field guide to call it into your party."));
  }

  function flee() {
    if (!state.battle) return error("There is no active encounter.");
    state.battle = null;
    return commit("escaped", "You called your party back and returned to the trail.");
  }

  function training(amount) {
    const p = member(state.lead);
    const leveled = giveXp(p, amount);
    return species[p.id].name + " gained " + amount + " XP" + (leveled ? " and reached level " + p.level : "") + ".";
  }
  function awardGame(id) {
    const activity = activities.games.find(g => g.id === id);
    if (!activity || state.battle || !state.visited.includes(activity.region)) return error("Visit this field station first.");
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

  function setSound(enabled) {
    state.sound = Boolean(enabled);
    return commit("sound", state.sound ? "Sound on." : "Sound off.");
  }

  function reset() {
    state = newGame();
    return commit("reset", "A fresh adventure begins in Mossbrook Vale.");
  }

  window.WilderGame = {
    get state() { return state; },
    get canSave() { return canSave; },
    species, regions, wardens, homes, pools, access, team, enlist, foeIntent, maxLevel:MAX_LEVEL,
    awardGame, questAction, xpNeeded, objective, setPosition, travel, setLead,
    heal, meetWarden, startBattle, useSkill, swap, recruit, flee, setSound, reset
  };
})();
