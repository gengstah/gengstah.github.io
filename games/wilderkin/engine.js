(() => {
  "use strict";

  const SAVE_KEY = "wilderkin.trail.v1";
  const MAX_LEVEL = 30;
  const starters = ["sprigkit", "cindlet", "dewfin"];
  const strongAgainst = { Grove: "Tide", Ember: "Grove", Tide: "Ember" };

  function strike(id, name, type, power, description, guard = false) {
    return { id, name, type, power, kind: guard ? "guard" : "attack", description };
  }

  function mend(id, name, description) {
    return { id, name, type: "Neutral", kind: "heal", description };
  }

  const species = {
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

  const regions = [
    {
      name: "Mossbrook Vale", lodge: "Mossbrook Lodge", warden: "Fern", crest: "Leaf Crest",
      wild: "mossbell", wildLevel: 4, wardenLevel: 6, basicMove: "Pebble Toss",
      dialogue: "See those flowers on Mossbell’s shell? They only open when it feels at home. Let’s see how well you and your companions know each other.",
      farewell: "You listened to your companions. Carry this Leaf Crest over the bridge to Cinderfall Ridge."
    },
    {
      name: "Cinderfall Ridge", lodge: "Emberwatch Hall", warden: "Flint", crest: "Ember Crest",
      wild: "coalmoth", wildLevel: 6, wardenLevel: 8, basicMove: "Wing Tap",
      dialogue: "I first met Coalmoth beside a lantern that had long since gone cold. We’ve kept the ridge lights burning ever since. Care for a friendly trial?",
      farewell: "A steady hand keeps the fire bright. This Ember Crest opens the trail to Moonwell Reach."
    },
    {
      name: "Moonwell Reach", lodge: "Moonwell Shrine", warden: "Lune", crest: "Moon Crest",
      wild: "glimmeray", wildLevel: 8, wardenLevel: 10, basicMove: "Fin Slap",
      dialogue: "When the water is still, Glimmeray can hear footsteps on the far shore. Yours have come a long way. Shall we take the final trial?",
      farewell: "Three Wardens, three crests, one well-traveled team. The Moon Crest is yours, Trailkeeper."
    }
  ];

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
      version: 1, region: 0, positions: {}, party: starters.map(id => makeMember(id, 5)),
      lead: starters[0], crests: [], met: [], seen: starters.slice(), battle: null,
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
      const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY));
      if (!saved || saved.version !== 1 || !Array.isArray(saved.party)
        || !starters.every(id => saved.party.some(p => p?.id === id))
        || !saved.party.every(p => validFighter(p) && integer(p.xp, 0, xpNeeded(p.level) - 1))
        || unique(saved.party.map(p => p.id)).length !== saved.party.length) return fresh;
      fresh.party = saved.party;
      fresh.crests = Array.isArray(saved.crests) ? regions.map((_, i) => i).filter(i =>
        Array.from({ length: i + 1 }, (_, n) => n).every(n => saved.crests.includes(n))) : [];
      fresh.met = unique([...fresh.crests, ...(Array.isArray(saved.met) ? saved.met.filter(validRegion) : [])]);
      fresh.seen = unique([...fresh.party.map(p => p.id), ...(Array.isArray(saved.seen) ? saved.seen.filter(validSpecies) : [])]);
      if (validRegion(saved.region) && saved.region <= fresh.crests.length) fresh.region = saved.region;
      for (let i = 0; i < regions.length; i++) {
        const point = saved.positions?.[i];
        if (point && integer(point.x, 0, 999) && integer(point.y, 0, 999)) fresh.positions[i] = { x: point.x, y: point.y };
      }
      if (fresh.party.some(p => p.id === saved.lead)) fresh.lead = saved.lead;
      if (typeof saved.sound === "boolean") fresh.sound = saved.sound;
      if (Number.isSafeInteger(saved.wins) && saved.wins >= 0) fresh.wins = saved.wins;
      const battle = saved.battle;
      if (battle && ["wild", "warden"].includes(battle.kind) && validFighter(battle.enemy) && battle.enemy.hp > 0
        && battle.enemy.id === regions[fresh.region].wild && fresh.party.some(p => p.id === battle.activeId && p.hp > 0)
        && Number.isSafeInteger(battle.turn) && battle.turn >= 1 && Array.isArray(battle.log)) {
        fresh.battle = {
          kind: battle.kind, activeId: battle.activeId, enemy: battle.enemy, turn: battle.turn,
          log: battle.log.filter(entry => typeof entry === "string").slice(-8)
        };
      }
      if (!fresh.party.some(p => p.hp > 0)) fresh.party.forEach(p => { p.hp = p.maxHp; });
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

  function objective() {
    const next = regions.findIndex((_, i) => !state.crests.includes(i));
    if (next === -1) {
      return state.party.length < Object.keys(species).length
        ? { title: "Befriend every Wilderkin", description: "Explore the wilds and complete your field guide." }
        : { title: "The trail is yours", description: "All three crests and every Wilderkin are yours. Revisit the Wardens for friendly rematches." };
    }
    const region = regions[next];
    if (state.region !== next) return { title: "Travel to " + region.name, description: "Open the region map and follow the trail to " + region.lodge + "." };
    if (!state.met.includes(next)) return { title: "Meet Warden " + region.warden, description: "Find Warden " + region.warden + " at " + region.lodge + "." };
    return { title: "Earn the " + region.crest, description: "Challenge Warden " + region.warden + " at " + region.lodge + "." };
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
    if (!validRegion(index)) return error("That trail is unknown.");
    if (index > state.crests.length) return error("Earn the " + regions[index - 1].crest + " to open this trail.");
    state.region = index;
    return commit("travel", "You arrived in " + regions[index].name + ".");
  }

  const member = id => state.party.find(p => p.id === id);
  function setLead(id) {
    if (state.battle) return error("Use a battle switch to change your active companion.");
    const p = member(id);
    if (!p || p.hp === 0) return error("Choose a companion with some health remaining.");
    state.lead = id;
    return commit("lead", species[id].name + " is leading your party.");
  }

  function heal() {
    if (state.battle) return error("Return to camp after this encounter.");
    state.party.forEach(p => { p.hp = p.maxHp; });
    return commit("healed", "Your party rested. Every companion is back to full health.");
  }

  function meetWarden() {
    if (state.battle) return error("Finish this encounter first.");
    const region = regions[state.region];
    if (!state.met.includes(state.region)) state.met.push(state.region);
    const message = state.crests.includes(state.region) ? "Good to see you again, Trailkeeper. How about a rematch?" : region.dialogue;
    return commit("dialogue", message);
  }

  function startBattle(kind) {
    if (state.battle) return error("You are already in an encounter.");
    if (kind !== "wild" && kind !== "warden") return error("Unknown encounter.");
    if (kind === "warden" && !state.met.includes(state.region)) return meetWarden();
    const active = member(state.lead);
    const ready = active?.hp > 0 ? active : state.party.find(p => p.hp > 0);
    if (!ready) return error("Rest at camp before entering an encounter.");
    const region = regions[state.region];
    const enemy = makeMember(region.wild, kind === "wild" ? region.wildLevel : region.wardenLevel);
    const name = species[enemy.id].name;
    if (!state.seen.includes(enemy.id)) state.seen.push(enemy.id);
    const message = kind === "wild" ? "A wild " + name + " appeared!" : "Warden " + region.warden + " calls on " + name + "!";
    state.battle = { kind, activeId: ready.id, enemy, turn: 1, log: [message] };
    return commit("battle", message);
  }

  function damage(power, level, type, defender) {
    let modifier = 1;
    const defendingType = species[defender.id].type;
    if (strongAgainst[type] === defendingType) modifier = 1.5;
    else if (strongAgainst[defendingType] === type) modifier = 0.7;
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
    const { kind, activeId, enemy } = state.battle;
    const xp = (kind === "warden" ? 28 : 14) + enemy.level * 2;
    const levels = [];
    state.party.forEach(p => {
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

  function counterattack(firstMessage, guarded) {
    const battle = state.battle;
    const { enemy } = battle;
    const enemySpecies = species[enemy.id];
    const active = member(battle.activeId);
    const charged = battle.turn % 3 === 0;
    const skill = charged ? enemySpecies.skills[0] : { name: regions[state.region].basicMove, type: "Neutral", power: 5 };
    const hit = damage(skill.power + (charged ? 1 : 0), enemy.level, skill.type, active);
    const dealt = Math.min(active.hp, guarded ? Math.max(1, Math.floor(hit / 2)) : hit);
    active.hp -= dealt;
    let reply = enemySpecies.name + " used " + skill.name + " for " + dealt + " damage.";
    if (active.hp === 0) {
      const next = state.party.find(p => p.hp > 0);
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
    const message = user.name + " used " + skill.name + " for " + hit + " damage.";
    if (enemy.hp === 0) return winBattle(message);
    return counterattack(message, skill.kind === "guard");
  }

  function swap(id) {
    const battle = state.battle;
    if (!battle) return setLead(id);
    if (battle.activeId === id) return error("This companion is already in the field.");
    if (!member(id)?.hp) return error("Choose a companion with some health remaining.");
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
    state.battle = null;
    return commit("recruited", name + " accepted your invitation and joined the party!");
  }

  function flee() {
    if (!state.battle) return error("There is no active encounter.");
    state.battle = null;
    return commit("escaped", "You called your party back and returned to the trail.");
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
    species, regions, strongAgainst, xpNeeded, objective, setPosition, travel, setLead,
    heal, meetWarden, startBattle, useSkill, swap, recruit, flee, setSound, reset
  };
})();
