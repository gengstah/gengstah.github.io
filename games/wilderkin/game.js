(() => {
  "use strict";

  const game = window.WilderGame;
  const world = window.WilderWorld;
  const el = id => document.getElementById(id);
  const canvas = el("world-canvas");
  const dialog = el("game-dialog");
  const directions = { up: [0,-1], down: [0,1], left: [-1,0], right: [1,0] };
  const keys = { w:"up", s:"down", a:"left", d:"right", ArrowUp:"up", ArrowDown:"down", ArrowLeft:"left", ArrowRight:"right" };
  const dex = window.WilderKinDex;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const sprite = (id, extra = "") => `<img class="sprite ${extra}" data-species="${id}" src="${dex.spriteUrl(id)}" alt="">`;
  const tag = type => `<span class="type-tag" data-type="${type}"><i></i>${type}</span>`;
  const tags = kin => `<span class="affinities">${kin.types.map(tag).join("")}</span>`;
  const number = value => String(value).padStart(2,"0");
  const esc = text => String(text).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);
  const state = () => game.state;
  const region = () => game.regions[state().region];
  const area = () => world.regions[state().region];
  const member = id => state().party.find(p => p.id === id);
  const siteKind = site => site.kind || site.id;
  const hasCrest = i => state().crests.includes(i);
  const crestArt = i => world.crestArt(i, hasCrest(i));
  const button = (action, label, primary = false, value = "") =>
    `<button class="${primary ? "solid-button" : "paper-button"}" data-action="${action}" data-value="${value}">${label}</button>`;
  let currentView = "adventure";
  let player = {x:0,y:0,facing:"down"};
  let path = [];
  let destination = null;
  let tween = null;
  let toastTimeout;
  let audio;
  let lastFrame = 0;
  let lastStep = 0;
  let expanded = false;
  const menus = window.WilderMenus.create({
    el, icon, sprite, tags, number, esc, button, health, crestArt, bodyDialog,
    refresh, feedback, playTone, openBattle, questCard
  });
  const {openWorld, openKin, openQuest, openCrest, renderGuide, renderJournal} = menus;

  function playTone(kind = "click") {
    if (!state().sound) return;
    try {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      audio ||= new Audio();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      const tones = { click:[523], start:[392,523,659], hit:[247,196], rest:[392,494,587], reward:[523,659,784,1047] };
      (tones[kind] || tones.click).forEach((pitch, index) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        const t = audio.currentTime + index * .077;
        osc.type = "triangle";
        osc.frequency.value = pitch;
        gain.gain.setValueAtTime(0,t);
        gain.gain.linearRampToValueAtTime(.085,t+.008);
        gain.gain.exponentialRampToValueAtTime(.001,t+.12);
        osc.connect(gain).connect(audio.destination);
        osc.start(t);
        osc.stop(t+.13);
      });
    } catch { /* Sound is optional on browsers without usable audio output. */ }
  }

  function notify(text) {
    const toast = el("toast");
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  function health(p) {
    const percent = Math.round(p.hp / p.maxHp * 100);
    return `<span class="hp-line"><span class="hp-track"><i class="${percent < 31 ? "low" : ""}" style="width:${percent}%"></i></span><span class="hp-value">${p.hp}/${p.maxHp} HP</span></span>`;
  }

  function partyRow(p) {
    const kin = game.species[p.id];
    return `<button class="kin-row" data-action="kin" data-value="${p.id}" data-type="${kin.type}" aria-label="View ${kin.name}, level ${p.level}, ${p.hp} of ${p.maxHp} health">
      <span class="thumb">${sprite(p.id)}</span><span class="kin-info"><span class="kin-line"><strong>${kin.name}</strong><span class="level">Lv. ${p.level}</span></span>
      ${tags(kin)}${health(p)}</span></button>`;
  }

  function questCard() {
    const quest = game.objective();
    return `<button class="quest-card" data-action="quest"><img class="quest-art" src="ui/quest.png" alt=""><span class="quest-text"><span class="eyebrow">CURRENT QUEST</span><strong>${quest.title}</strong><span>${quest.description}</span></span>${icon("chevron")}</button>`;
  }

  function refresh() {
    const s = state();
    el("region-number").textContent = "REGION " + number(s.region + 1) + " / " + game.regions.length;
    el("region-title").textContent = region().name;
    el("region-description").textContent = region().description;
    el("quest-name").textContent = game.objective().title;
    el("quest-description").textContent = game.objective().description;
    el("party-count").textContent = s.team.length + " / 6";
    el("party-list").innerHTML = game.team().map(partyRow).join("");
    el("crest-count").textContent = s.crests.length + " / " + game.wardens.length;
    const first = Math.min(Math.floor(s.crests.length / 3) * 3, game.wardens.length - 3);
    el("crest-list").innerHTML = game.wardens.slice(first, first + 3).map(i => { const r = game.regions[i]; return `<button class="crest-button" data-action="crest" data-value="${i}" aria-label="${r.crest}, ${hasCrest(i) ? "earned" : "unearned"}"><img src="${crestArt(i)}" alt=""><span>${r.crest}</span></button>`; }).join("");
    const sound = el("sound-button");
    sound.setAttribute("aria-label", s.sound ? "Turn sound off" : "Turn sound on");
    sound.setAttribute("aria-pressed", String(s.sound));
    sound.title = sound.getAttribute("aria-label");
    sound.innerHTML = icon(s.sound ? "sound" : "mute");
    el("save-status").textContent = game.canSave ? "Progress saved on this device" : "Browser storage unavailable · progress lasts for this session";
    canvas.setAttribute("aria-label", region().name + " map. Move with arrows or WASD. Press E near a landmark to interact.");
    if (currentView === "field-guide") renderGuide();
    if (currentView === "journal") renderJournal();
    updatePrompt();
  }

  function showView() {
    const requested = location.hash.substring(1);
    currentView = ["field-guide","journal"].includes(requested) ? requested : "adventure";
    ["adventure","field-guide","journal"].forEach(v => { el(v).hidden = v !== currentView; });
    document.querySelectorAll("[data-view]").forEach(link => {
      if (link.dataset.view === currentView) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    });
    stopWalking();
    if (dialog.open) dialog.close();
    if (expanded) toggleExpanded();
    refresh();
    draw(performance.now());
  }

  function openDialog(title, content, wide = false) {
    stopWalking();
    const focusAction = dialog.contains(document.activeElement) ? document.activeElement.dataset : null;
    dialog.classList.toggle("wide",wide);
    el("dialog-content").innerHTML = `<div class="dialog-header"><h2 id="dialog-title">${esc(title)}</h2><button class="close-button" aria-label="Close" data-action="close">${icon("close")}</button></div>${content}<div class="dialog-feedback" id="dialog-feedback" role="status"></div>`;
    if (!dialog.open) dialog.showModal();
    else {
      const match = focusAction && Array.from(dialog.querySelectorAll("[data-action]")).find(b => b.dataset.action === focusAction.action && b.dataset.value === focusAction.value && !b.disabled);
      (match || dialog.querySelector(".close-button")).focus({preventScroll:true});
    }
  }

  function bodyDialog(title, content, wide = false) {
    openDialog(title,`<div class="dialog-body">${content}</div>`,wide);
  }

  function openLocations() {
    const purpose = {activities:"Meet local patrons and play field games",camp:"Rest and recover your party’s health",warden:"Meet Warden "+region().warden,wild:"Seek a wild Wilderkin",travel:"Travel between regions"};
    bodyDialog("Local landmarks",`<div class="location-list">${area().sites.map((s,i) => `<button class="location-button" data-action="locate" data-value="${i}"><span><strong>${s.label}</strong><small>${purpose[siteKind(s)] || "Visit this landmark"}</small></span>${icon("arrow")}</button>`).join("")}</div>`);
  }

  function openHelp() {
    bodyDialog("How to play",`<dl class="help-list">
      <div><dt>Explore the map</dt><dd>Use the arrow keys or WASD to walk. You can also click or tap a spot to walk there.</dd></div>
      <div><dt>Visit a landmark</dt><dd>Click a building, signpost, or wild clearing. On the keyboard, approach it and press <kbd>E</kbd>. The world map lists local landmarks.</dd></div>
      <div><dt>Battle with your party</dt><dd>Choose one skill each turn. An attack checks both of the defender’s affinities. See the affinity chart in the field guide. Rest at a cottage to heal.</dd></div>
      <div><dt>Befriend wild kin</dt><dd>Select tracks in a wild clearing. Use Hold back to weaken a Wilderkin without knocking it out, then Befriend at half health. Your first six travel together. Call reserves from the field guide.</dd></div>
      <div><dt>Follow the Warden Trail</dt><dd>Earn crests to open routes. Some crossings need a befriended Wilderkin with a field ability. The world map names a nearby carrier. Play field games and take local requests at field stations.</dd></div>
      </dl><div class="dialog-actions">${button("close","Back to game",true)}<button class="text-button" data-action="reset-confirm">Start a new adventure</button></div>`);
  }

  function openWarden() {
    const greeting = game.meetWarden();
    refresh();
    bodyDialog("Warden "+region().warden,`<div class="npc"><img class="sprite" src="${world.wardenArt(state().region)}" alt=""><blockquote>“${esc(greeting.message)}”</blockquote></div><div class="dialog-actions">${button("battle-start","Accept the trial",true,"warden")}${button("close","Maybe later")}</div>`);
    playTone("start");
  }

  function visit(site) {
    if (state().battle) return openBattle();
    switch (siteKind(site)) {
      case "warden": return openWarden();
      case "wild": return menus.openTracks(site);
      case "activities": return menus.openStation();
      case "travel": return openWorld();
      case "camp": return bodyDialog(site.label,`<p>A fire crackles inside. Rest here to restore every companion to full health.</p><div class="dialog-actions">${button("rest","Rest your party",true)}${button("close","Keep exploring")}</div>`);
    }
  }

  function startBattle(kind, track) {
    const outcome = game.startBattle(kind, track);
    if (outcome.kind === "dialogue") return openWarden();
    if (!outcome.ok) return feedback(outcome.message);
    playTone("start");
    refresh();
    openBattle();
  }

  function openBattle(switching = false) {
    const battle = state().battle;
    if (!battle) return;
    const active = member(battle.activeId);
    const foe = battle.enemy;
    const kin = game.species[active.id];
    const isWild = battle.kind === "wild";
    const title = isWild ? "Wild encounter" : "Warden "+region().warden+"’s trial";
    const stat = p => `<div><span class="kin-line"><strong>${game.species[p.id].name}</strong><small class="level">Lv. ${p.level}</small></span>${tags(game.species[p.id])}${health(p)}</div>`;
    const scene = `<div class="battle-stat-grid">${stat(active)}${stat(foe)}</div><div class="battle-scene" style="background-image:url('ui/battle-${region().theme}.png')">${sprite(active.id,"ally")}${sprite(foe.id,"enemy")}</div>`;
    const matchup = type => {
      const modifier = dex.effectiveness(type,game.species[foe.id].types);
      return modifier > 1 ? type+" · Strong" : modifier < 1 ? type+" · Resisted" : type+" attack";
    };
    const actionSet = kin.skills.map(skill => `<button class="skill-button" data-action="skill" data-value="${skill.id}" title="${skill.description}" ${skill.kind === "heal" && active.hp === active.maxHp ? "disabled" : ""}><strong>${skill.name}</strong><small>${skill.kind === "heal" ? "Recover HP" : skill.kind === "guard" ? "Strike + guard" : matchup(skill.type)}</small></button>`).join("");
    const canRecruit = isWild && !member(foe.id) && foe.hp <= foe.maxHp / 2;
    const tools = `<div class="battle-tools"><button data-action="battle-switch">Switch kin</button>${isWild && !member(foe.id) ? '<button data-action="skill" data-value="trail-feint" title="Deal gentle damage, leaving at least 1 HP">Hold back</button>' : ""}${isWild && !member(foe.id) ? `<button data-action="befriend" title="Befriend at half health or lower" ${canRecruit ? "" : "disabled"}>Befriend${canRecruit ? "" : " (½ HP)"}</button>` : ""}<button data-action="leave-battle">Retreat</button></div>`;
    const switchList = `<div class="switch-list">${game.team().map(p => `<button class="switch-option" data-action="swap" data-value="${p.id}" ${p.id === active.id || !p.hp ? "disabled" : ""}>${sprite(p.id)}<span><strong>${game.species[p.id].name}</strong><small>${p.hp}/${p.maxHp} HP · ${game.species[p.id].type}</small></span>${icon("arrow")}</button>`).join("")}<button class="text-button" data-action="battle">Back to skills</button></div>`;
    const intent = game.foeIntent();
    const warning = intent.charged ? `<p class="charged">${game.species[foe.id].name} is preparing ${intent.skill.name} (${intent.skill.type}).</p>` : "";
    openDialog(title,`${scene}<div class="battle-copy">${!isWild && region().requiredCrests >= 3 ? `<p class="detail-label">Warden party · ${battle.remaining.length+1} remaining</p>` : ""}<div class="battle-log" aria-live="polite">${battle.log.slice(battle.turn > 1 ? -2 : -1).map(line => `<p>${esc(line)}</p>`).join("")}${warning}</div>${switching ? switchList : `<div class="battle-actions" style="--moves:${Math.min(4,kin.skills.length)}">${actionSet}</div>${tools}`}</div>`,true);
  }

  function battleAction(fn, animation) {
    const enemy = state().battle?.enemy.id;
    const previousCrests = state().crests.length;
    const outcome = fn();
    if (!outcome.ok) return feedback(outcome.message);
    refresh();
    if (state().battle) {
      playTone("hit");
      openBattle();
      if (animation && !reduceMotion.matches) dialog.querySelector(".battle-scene").classList.add(animation);
      return;
    }
    restorePosition();
    const newCrest = state().crests.length > previousCrests;
    const won = outcome.kind === "victory";
    const recruited = outcome.kind === "recruited";
    let title = { victory:"Battle won!", recruited:"A new companion!", escaped:"Back on the trail", defeat:"Back at the trailhead" }[outcome.kind];
    if (newCrest) title = state().crests.length === game.wardens.length ? "Trailkeeper of the Wilds!" : region().crest+" earned!";
    playTone(won || recruited ? "reward" : "rest");
    const image = newCrest ? `<img class="reward-art" src="${crestArt(state().region)}" alt="">` : recruited ? sprite(enemy,"reward-art") : "";
    const next = newCrest && state().crests.length < game.wardens.length ? button("world","Open world map") : "";
    bodyDialog(title,`${image}<p>${esc(outcome.message)}</p><div class="dialog-actions">${button("close","Keep exploring",true)}${next}</div>`);
  }

  function feedback(message) {
    if (dialog.open) {
      const target = el("dialog-feedback");
      target.textContent = message;
      target.style.padding = "0 20px 14px";
    } else notify(message);
  }

  function restorePosition() {
    stopWalking();
    const saved = state().positions[state().region];
    const point = saved && world.walkable(state().region,saved.x,saved.y) ? saved : area().spawn;
    player = { ...point, facing:"down" };
    tween = null;
    game.setPosition(player.x,player.y);
    updatePrompt();
    draw(performance.now());
  }

  function nearestSite() {
    return area().sites.map(site => ({site,distance:Math.abs(player.x-site.x)+Math.abs(player.y-site.y)}))
      .filter(s => s.distance <= 1).sort((a,b) => a.distance-b.distance)[0]?.site;
  }

  function updatePrompt() {
    const site = nearestSite();
    const prompt = el("near-action");
    prompt.hidden = !state().battle && (!site || path.length > 0);
    const label = state().battle ? "Resume battle" : site?.label || "";
    prompt.textContent = label ? label+" →" : "";
  }

  function stopWalking() {
    path = [];
    destination = null;
  }

  function move(dir,time) {
    const [dx,dy] = directions[dir];
    player.facing = dir;
    const x = player.x + dx, y = player.y + dy;
    if (!world.walkable(state().region,x,y)) return false;
    tween = {x:player.x, y:player.y, time};
    player.x = x;
    player.y = y;
    game.setPosition(x,y);
    updatePrompt();
    return true;
  }

  function draw(time) {
    if (currentView !== "adventure") return;
    const interpolated = { ...player, questActive:Boolean(region().warden) && !hasCrest(state().region) };
    if (tween && !reduceMotion.matches) {
      const amount = Math.max(0,Math.min(1,(time-tween.time)/100));
      interpolated.x = tween.x + (player.x-tween.x)*amount;
      interpolated.y = tween.y + (player.y-tween.y)*amount;
    }
    world.draw(canvas,state().region,interpolated,reduceMotion.matches ? 0 : time);
  }

  function tick(time) {
    if (currentView === "adventure" && !dialog.open && !document.hidden) {
      if ((path.length || destination) && time-lastStep >= 120) {
        lastStep = time;
        if (path.length) move(path.shift(),time);
        else {
          const site = destination;
          stopWalking();
          updatePrompt();
          if (site) visit(site);
        }
      }
      const moving = tween && time-tween.time < 130;
      if (time-lastFrame > (moving ? 18 : 125)) {
        draw(time);
        lastFrame = time;
      }
    }
    requestAnimationFrame(tick);
  }

  // On these small maps a breadth-first search gives the shortest route around trees and water.
  function routeTo(x,y) {
    const queue = [{x:player.x,y:player.y,path:[]}];
    const visited = new Set([player.x+","+player.y]);
    for (let i=0; i<queue.length; i++) {
      const tile = queue[i];
      if (tile.x === x && tile.y === y) return tile.path;
      for (const [dir,[dx,dy]] of Object.entries(directions)) {
        const nx=tile.x+dx, ny=tile.y+dy;
        const key=nx+","+ny;
        if (visited.has(key) || !world.walkable(state().region,nx,ny)) continue;
        visited.add(key);
        queue.push({x:nx,y:ny,path:[...tile.path,dir]});
      }
    }
    return null;
  }

  function walkTo(target,site = null) {
    if (state().battle) return openBattle();
    stopWalking();
    const route = routeTo(target.x,target.y);
    if (!route) return notify("Trees and water block that spot. Try an open patch of ground.");
    path = route;
    destination = site;
    lastStep = 0;
    updatePrompt();
    if (!route.length && site) {
      stopWalking();
      visit(site);
    }
  }

  function interact() {
    if (state().battle) return openBattle();
    const nearby = nearestSite();
    if (nearby) visit(nearby);
    else openLocations();
  }

  function switchToAdventure() {
    if (currentView !== "adventure") {
      history.pushState(null,"","#adventure");
      showView();
      window.scrollTo(0,0);
    }
  }

  function locate(value) {
    const site = /^\d+$/.test(value) ? area().sites[Number(value)] : area().sites.find(s => s.id === value);
    if (!site) return;
    if (dialog.open) dialog.close();
    switchToAdventure();
    walkTo(site,site);
  }

  function travel(i) {
    if (state().battle) return openBattle();
    const outcome = game.travel(i);
    if (!outcome.ok) return feedback(outcome.message);
    if (dialog.open) dialog.close();
    switchToAdventure();
    restorePosition();
    refresh();
    playTone("start");
    notify(outcome.message);
  }

  function toggleExpanded() {
    expanded = !expanded;
    const frame = el("game-frame");
    frame.classList.toggle("expanded",expanded);
    document.body.classList.toggle("map-expanded",expanded);
    document.querySelectorAll(".topbar,#adventure .page-heading,.sidebar,.map-column>.quest-card,.save-footer").forEach(element => {
      element.inert = expanded;
    });
    const control = frame.querySelector(".expand-button");
    control.setAttribute("aria-label",expanded ? "Shrink map" : "Expand map");
    control.title = control.getAttribute("aria-label");
    control.setAttribute("aria-expanded",String(expanded));
    if (expanded) canvas.focus({preventScroll:true});
    else control.focus({preventScroll:true});
  }

  const actions = {
    ...menus.actions,
    track:id => startBattle("wild", id),
    station:() => state().battle ? openBattle() : menus.openStation(),
    sound() {
      game.setSound(!state().sound);
      refresh();
      if (state().sound) playTone();
    },
    close:() => dialog.close(),
    help:openHelp, world:() => openWorld(), locations:openLocations, quest:openQuest, kin:openKin,
    crest:value => openCrest(Number(value)), expand:toggleExpanded, interact, locate, travel:value => travel(Number(value)),
    lead(id) {
      const outcome = game.setLead(id);
      if (!outcome.ok) return feedback(outcome.message);
      refresh();
      dialog.close();
      playTone();
      notify(outcome.message);
    },
    rest() {
      const outcome = game.heal();
      if (!outcome.ok) return feedback(outcome.message);
      refresh();
      playTone("rest");
      bodyDialog("Party rested",`<p>${esc(outcome.message)}</p><div class="dialog-actions">${button("close","Back to the trail",true)}</div>`);
    },
    "battle-start":startBattle, battle:() => openBattle(), "battle-switch":() => openBattle(true),
    skill(id) {
      const skill = game.species[state().battle.activeId].skills.find(s => s.id === id);
      battleAction(() => game.useSkill(id), skill?.kind === "heal" ? "recovering" : "striking");
    },
    swap:id => battleAction(() => game.swap(id)),
    befriend:() => battleAction(() => game.recruit()), "leave-battle":() => battleAction(() => game.flee()),
    "reset-confirm"() {
      bodyDialog("Start a new adventure?",`<p>This replaces the party, crests, and progress saved in this browser.</p><div class="dialog-actions">${button("close","Keep my adventure",true)}${button("reset","Start again")}</div>`);
    },
    reset() {
      game.reset();
      dialog.close();
      switchToAdventure();
      restorePosition();
      refresh();
      notify("Your new adventure begins in Mossbrook Vale.");
    }
  };

  document.addEventListener("click",event => {
    const control = event.target.closest("[data-action]");
    if (control && !control.disabled) actions[control.dataset.action]?.(control.dataset.value);
  });
  canvas.addEventListener("click",event => {
    const tile = world.hitTile(canvas,event.clientX,event.clientY);
    const site = world.siteAt(state().region,tile.x,tile.y);
    walkTo(site || tile,site);
    canvas.focus({preventScroll:true});
  });
  canvas.addEventListener("pointermove",event => {
    const tile = world.hitTile(canvas,event.clientX,event.clientY);
    const site = world.siteAt(state().region,tile.x,tile.y);
    canvas.style.cursor = site ? "pointer" : "crosshair";
    canvas.title = site?.label || "";
  });
  document.addEventListener("keydown",event => {
    if (dialog.open || currentView !== "adventure" || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (expanded && key === "Escape") return toggleExpanded();
    if (key === "e" || (key === "Enter" && document.activeElement === canvas)) {
      event.preventDefault();
      if (!event.repeat) interact();
      return;
    }
    const dir = keys[key];
    if (!dir || state().battle) return;
    event.preventDefault();
    const time = performance.now();
    if (event.repeat && time-lastStep < 105) return;
    lastStep = time;
    stopWalking();
    move(dir,time);
    draw(time);
  });
  dialog.addEventListener("click",event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  window.addEventListener("hashchange",showView);
  el("pointer-hint").textContent = matchMedia("(pointer: coarse)").matches ? "Tap to explore" : "Click to move";
  restorePosition();
  showView();
  if (state().battle) openBattle();
  requestAnimationFrame(tick);
})();
