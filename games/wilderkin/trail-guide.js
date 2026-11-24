"use strict";
// The guide, atlas and journal share the adventure's dialog and saved game.
window.WilderMenus = {
  create({el, icon, sprite, tags, number, esc, button, health, crestArt, bodyDialog,
    refresh, feedback, playTone, openBattle, questCard}) {
    const game = window.WilderGame;
    const dex = window.WilderKinDex;
    const fair = window.WilderActivities;
    const world = window.WilderWorld;
    const state = () => game.state;
    const current = () => game.regions[state().region];
    const owned = id => state().party.find(p => p.id === id);
    const species = Object.values(game.species);
    const indexes = new Map(species.map((kin,i) => [kin.id, i + 1]));
    const guide = {search:"", roster:"All kin", affinity:"All affinities", page:0};
    const atlas = {route:0, search:"", page:0};
    const routes = [{start:0,end:2}, ...window.WilderAtlas.routes.filter(r => r.start >= 3)];
    const routeOf = index => routes.findIndex(r => r.start <= index && r.end >= index);
    let journalTab = "Requests";
    let journalFilter = "All";
    const select = (id,label,choices,value) => `<label class="select-field"><span>${label}</span><select id="${id}">${choices.map(([v,text]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(text)}</option>`).join("")}</select></label>`;
    const search = (id,label,value) => `<label class="select-field search-field"><span>${label}</span><input type="search" id="${id}" value="${esc(value)}" autocomplete="off"></label>`;
    const badgeLabel = (i) => state().crests.includes(i) ? "Crest earned" : game.access(i).open ? "Trial available" : "Locked";
    const actionRow = (action, value, title, subtitle, image = "") =>
      `<button class="location-button" data-action="${action}" data-value="${value}">${image}<span><strong>${esc(title)}</strong><small>${esc(subtitle)}</small></span>${icon("chevron")}</button>`;
    const pageButtons = (page, pages, action) => pages <= 1 ? "" : `<div class="page-turn"><button class="paper-button" data-action="${action}" data-value="-1" ${page ? "" : "disabled"}>Previous</button><span>Page ${page+1} of ${pages}</span><button class="paper-button" data-action="${action}" data-value="1" ${page+1 < pages ? "" : "disabled"}>Next</button></div>`;
    function on(id,event,fn) { el(id).addEventListener(event, e => fn(e.target.value)); }

    function renderGuide() {
      const s = state();
      const filters = ["All kin", "Discovered", "Befriended", "Traveling party", "Reserve", "Local tracks", "Field abilities"];
      const types = ["All affinities", ...Object.keys(dex.types)];
      el("field-guide").innerHTML = `<div class="page-heading"><div><p class="eyebrow">${icon("guide")} ${s.seen.length} DISCOVERED · ${s.party.length} BEFRIENDED</p><h1 id="guide-title">Field guide</h1><p class="subtitle">Search ${species.length} Wilderkin by name, number, affinity, or field ability.</p></div>${button("affinities","Affinity chart")}</div>
        <div class="catalog-controls">${search("guide-search","Find a Wilderkin",guide.search)}${select("guide-roster","Collection",filters.map(f=>[f,f]),guide.roster)}${select("guide-type","Affinity",types.map(t=>[t,t]),guide.affinity)}</div><div id="guide-results"></div>`;
      const change = (key,value) => { guide[key]=value; guide.page=0; renderGuideResults(); };
      on("guide-search","input",v => change("search",v));
      on("guide-roster","change",v => change("roster",v));
      on("guide-type","change",v => change("affinity",v));
      renderGuideResults();
    }

    function renderGuideResults() {
      const s = state();
      const local = game.pools[s.region];
      const query = guide.search.trim().toLowerCase();
      const collected = new Set(s.party.map(p => p.id));
      const shown = species.filter(kin => {
        if (guide.affinity !== "All affinities" && !kin.types.includes(guide.affinity)) return false;
        const present = collected.has(kin.id);
        const roster = {"Discovered":s.seen.includes(kin.id), "Befriended":present, "Traveling party":s.team.includes(kin.id),
          "Reserve":present && !s.team.includes(kin.id), "Local tracks":local.includes(kin.id), "Field abilities":Boolean(kin.ability)};
        const listing = [kin.name, ...kin.types, kin.ability || "", String(indexes.get(kin.id)).padStart(3,"0")].join(" ").toLowerCase();
        return roster[guide.roster] !== false && listing.includes(query);
      });
      const pages = Math.ceil(shown.length / 12);
      guide.page = Math.max(0, Math.min(guide.page, pages - 1));
      const cards = shown.slice(guide.page*12,guide.page*12+12).map(kin => {
        const discovered = s.seen.includes(kin.id);
        return `<button class="guide-card ${discovered ? "" : "unknown"}" data-action="kin" data-value="${kin.id}">
          <span class="illustration" data-type="${kin.type}"><span class="guide-entry-number">NO. ${String(indexes.get(kin.id)).padStart(3,"0")}</span>${sprite(kin.id)}</span>
          <span class="guide-card-info"><strong>${kin.name}</strong>${tags(kin)}</span><span class="card-note">${collected.has(kin.id) ? "Befriended" : discovered ? "Sighted" : "Unseen"}${kin.ability ? " · "+kin.ability : ""}</span></button>`;
      });
      el("guide-results").innerHTML = `<p class="listing-count">${shown.length} matching Wilderkin</p><div class="guide-grid">${cards.join("")}</div>${pageButtons(guide.page,pages,"guide-page")}`;
    }

    function openKin(id) {
      const kin = game.species[id];
      if (!kin) return;
      const p = owned(id);
      const home = game.homes[id].find(i => state().visited.includes(i)) ?? game.homes[id][0];
      const detail = p ? `<p class="level">Lv. ${p.level} · ${p.level === game.maxLevel ? "Maximum level" : p.xp+" / "+game.xpNeeded(p.level)+" XP"}</p>${health(p)}` : "<p>Follow its tracks in a wild clearing to meet it.</p>";
      const team = state().team.includes(id);
      let action = "";
      if (!state().battle && p) {
        if (!team) action = button("enlist","Call from reserve",true,id);
        else if (state().lead !== id && p.hp > 0) action = button("lead","Make party leader",true,id);
        else if (state().lead === id) action = '<span class="detail-label">PARTY LEADER</span>';
      }
      const field = kin.ability ? `<h3>${kin.ability}</h3><p>${esc(dex.abilities[kin.ability].description)}</p>` : "";
      const track = home === state().region ? button("locate","Visit wild clearing",false,"wild") : button("inspect-region",game.regions[home].name,false,String(home));
      bodyDialog(kin.name,`<div class="detail-top"><div class="illustration ${state().seen.includes(id) ? "" : "unknown"}" data-type="${kin.type}">${sprite(id)}</div><div>${tags(kin)}${detail}</div></div><p>${esc(kin.description)}</p>${field}<h3>Skills</h3><dl class="skill-list">${kin.skills.map(skill => `<div><dt>${esc(skill.name)} · ${skill.type}</dt><dd>${esc(skill.description)}</dd></div>`).join("")}</dl><div class="dialog-actions">${action}${track}</div>`);
    }

    function enlist(id) {
      if (state().team.length < 6) return assign(id,"");
      bodyDialog("Change traveling party",`<p>Choose who will return to the reserve when ${game.species[id].name} joins.</p><div class="switch-list">${game.team().map(p => actionRow("assign",id+"|"+p.id,game.species[p.id].name,"Lv. "+p.level+" · "+p.hp+"/"+p.maxHp+" HP",sprite(p.id))).join("")}</div>`);
    }
    function assign(id,replace) {
      const outcome = game.enlist(id,replace);
      if (!outcome.ok) return feedback(outcome.message);
      refresh(); openKin(id); feedback(outcome.message);
    }

    function affinities() {
      bodyDialog("Affinity chart",`<p>Each strike checks both of its target’s affinities. A strength increases damage; the reverse matchup reduces it. Opposite effects cancel.</p><dl class="skill-list">${Object.entries(dex.types).map(([name,t]) => `<div><dt>${name} · strong against ${t.strengths.join(" and ")}</dt><dd>${esc(t.description)}</dd></div>`).join("")}</dl>`,true);
    }

    function openTracks(site) {
      const local = game.pools[state().region];
      bodyDialog(site.label,`<p>Pick a set of tracks to follow.</p><div class="switch-list">${local.map(id => {
        const kin = game.species[id];
        const detail = [kin.types.join(" / "), kin.ability, owned(id) ? "Befriended" : "Wild"].filter(Boolean).join(" · ");
        return actionRow("track",id,kin.name,detail,sprite(id));
      }).join("")}</div>`);
    }

    function openWorld(index = state().region) {
      atlas.route = Math.max(0,routeOf(index));
      atlas.search = ""; atlas.page = 0;
      const choices = routes.map((r,i) => [i, i === 0 ? "The First Trail" : game.regions[r.start].district+" · "+game.regions[r.end].name]);
      bodyDialog("World map",`<p class="detail-label">${state().visited.length} / ${game.regions.length} REGIONS VISITED</p><div class="catalog-controls atlas-controls">${select("atlas-route","Warden route",choices,atlas.route)}${search("atlas-search","Find any region","")}</div><div id="atlas-results"></div><div class="dialog-actions">${button("locations","Local landmarks "+icon("sign"))}</div>`,true);
      on("atlas-route","change",v => { atlas.route=Number(v); atlas.search=""; atlas.page=0; el("atlas-search").value=""; renderAtlas(); });
      on("atlas-search","input",v => { atlas.search=v.trim().toLowerCase(); atlas.page=0; renderAtlas(); });
      renderAtlas();
    }

    function renderAtlas() {
      const route = routes[atlas.route];
      const filtered = [];
      game.regions.forEach((r,i) => {
        const matches = atlas.search ? [r.name,r.district,r.warden || "",r.ability || ""].join(" ").toLowerCase().includes(atlas.search) : i >= route.start && i <= route.end;
        if (matches) filtered.push(i);
      });
      const pages = Math.ceil(filtered.length/6);
      atlas.page = Math.max(0, Math.min(atlas.page,pages-1));
      const options = filtered.slice(atlas.page*6,atlas.page*6+6).map(i => {
        const r = game.regions[i], gate = game.access(i);
        const here = i === state().region;
        return `<button class="region-option" data-action="inspect-region" data-value="${i}"><canvas data-preview="${i}" width="384" height="208" aria-hidden="true"></canvas><span><strong>${r.name}</strong><small>${here ? "You are here" : esc(gate.reason)}${r.warden ? " · Warden "+r.warden : ""}</small></span>${icon(gate.open ? here ? "pin" : "arrow" : "lock")}</button>`;
      });
      el("atlas-results").innerHTML = `<div class="region-list">${options.join("") || "<p>No regions match this search.</p>"}</div>${pageButtons(atlas.page,pages,"atlas-page")}`;
      el("atlas-results").querySelectorAll("[data-preview]").forEach(c => {
        const i = Number(c.dataset.preview);
        world.draw(c,i,{...world.regions[i].spawn,questActive:false},0);
      });
    }

    function inspectRegion(i) {
      const r = game.regions[i], gate = game.access(i);
      if (!r) return;
      const passage = r.ability && !state().visited.includes(i) ? `<div class="passage">${gate.carrier ? sprite(gate.carrier) : icon("lock")}<span><strong>${r.ability} crossing</strong><small>${esc(window.WilderAtlas.abilities[r.ability])}</small></span></div>` : "";
      const crossing = gate.carrier ? "Use "+r.ability : i === state().region ? "Return to region" : "Travel here";
      const action = gate.open ? button("travel",crossing,true,String(i)) : gate.hintRegion != null ? button("inspect-region","Find a carrier",true,String(gate.hintRegion)) : "";
      bodyDialog(r.name,`<canvas id="region-preview" width="384" height="208" aria-label="${r.name} landscape"></canvas><p class="detail-label">${r.district} · REGION ${number(i+1)}</p><p>${esc(r.description)}</p>${passage}<p>${esc(gate.reason)}</p><div class="dialog-actions">${action}${button("map-at","Back to map",false,String(i))}</div>`);
      world.draw(el("region-preview"),i,{...world.regions[i].spawn,questActive:false},0);
    }

    function openCrest(i) {
      const r = game.regions[i];
      if (!r?.warden) return;
      const gate = game.access(i);
      const action = i === state().region ? button("locate","Visit "+r.lodge,true,"warden") : button("inspect-region","View region",true,String(i));
      bodyDialog(r.crest,`<div class="crest-detail"><img src="${crestArt(i)}" alt=""><div><span class="detail-label">${badgeLabel(i)}</span><p>Warden ${r.warden} awards this crest at ${r.lodge} in ${r.name}.</p></div></div>${gate.open ? "" : "<p>"+esc(gate.reason)+"</p>"}<div class="dialog-actions">${action}</div>`);
    }

    function openQuest() {
      const q = game.objective();
      const action = q.target === undefined ? button("world","Explore the atlas",true) : q.target === state().region ? (current().warden && game.wardens[state().crests.length] === q.target ? button("locate","Walk to "+current().lodge,true,"warden") : button("locate","Visit wild clearing",true,"wild")) : button("inspect-region",game.regions[q.target].name,true,String(q.target));
      bodyDialog(q.title,`<div class="crest-detail"><img src="ui/quest.png" alt=""><p>${esc(q.description)}</p></div><div class="dialog-actions">${action}</div>`);
    }

    function questState(q) {
      const status = state().quests[q.id];
      if (status === "claimed") return "Completed";
      if (status === "active") {
        const p = fair.progress(q,state());
        return p.current >= p.total ? "Ready to claim" : "Active";
      }
      return state().visited.includes(q.region) ? "Available" : "Undiscovered";
    }

    function openRequest(id) {
      const q = fair.quests.find(q => q.id === id);
      if (!q) return;
      const status = questState(q);
      const progress = fair.progress(q,state());
      const available = state().visited.includes(q.region);
      const action = status === "Available" ? button("request-action","Accept request",true,id) : status === "Ready to claim" ? button("request-action","Claim 75 XP",true,id) : "";
      bodyDialog(q.name,`<p class="detail-label">${esc(q.requester)} · ${game.regions[q.region].name}</p><p>${esc(q.description)}</p><h3>${status}</h3><p>${esc(progress.label)} · ${progress.current} / ${progress.total}</p><p>Reward: 75 XP for your lead companion.</p><div class="dialog-actions">${action}${available ? button("station","Field station") : button("inspect-region","View posting region",false,String(q.region))}</div>`);
    }

    function gameInfo(id) {
      const g = fair.games.find(g => g.id === id);
      if (!g) return;
      const visited = state().visited.includes(g.region);
      bodyDialog(g.name,`<p class="detail-label">${game.regions[g.region].name} · ${state().clears[id] || 0} CLEARS</p><p>${esc(g.description)}</p><p>Earn 32 XP on your first clear and 8 XP on replays.</p><div class="dialog-actions">${visited ? button("play-game","Play",true,id) : button("inspect-region","Find this game",true,String(g.region))}</div>`);
    }
    function playGame(id) {
      if (state().battle) return openBattle();
      const g = fair.games.find(g => g.id === id);
      if (!g || !state().visited.includes(g.region)) return;
      fair.openGame(id,{
        show:(title,html) => bodyDialog(title,html,true), leave:openStation,
        finish(gameId) {
          if (gameId !== id) return;
          const reward = game.awardGame(id);
          refresh(); playTone("reward");
          bodyDialog(g.name+" cleared!",`<p>${esc(reward.message)}</p><div class="dialog-actions">${button("play-game","Play again",true,id)}${button("station","Field station")}</div>`);
        }
      });
    }

    function openStation() {
      const i = state().region;
      const localQuests = fair.quests.filter(q => q.region === i);
      const localGames = fair.games.filter(g => g.region === i);
      const requests = localQuests.map(q => actionRow("request",q.id,q.name,q.requester+" · "+questState(q)));
      const games = localGames.map(g => actionRow("game-info",g.id,g.name,(state().clears[g.id] || 0)+" clears"));
      bodyDialog("Field station",`<p class="detail-label">${current().name}</p><h3>Local requests</h3><div class="location-list">${requests.join("") || "<p>No new postings here.</p>"}</div><h3>Field games</h3><div class="location-list">${games.join("") || "<p>Open the games register to replay games from regions you’ve visited.</p>"}</div><div class="dialog-actions">${button("register","All requests",false,"Requests")}${button("register","Games register",false,"Games")}</div>`);
    }

    function renderJournal() {
      const options = journalTab === "Requests" ? ["All","Available","Active","Completed"] : ["All","Available","Completed"];
      const tabs = ["Requests","Games","Crests"].map(t => `<button class="journal-tab" aria-pressed="${journalTab === t}" data-action="journal-tab" data-value="${t}">${t}</button>`).join("");
      const selectFilter = select("journal-filter","Show",options.map(i=>[i,i]),journalFilter);
      el("journal").innerHTML = `<div class="page-heading"><div><p class="eyebrow">${icon("journal")} THE WARDEN TRAIL</p><h1 id="journal-title">Trail journal</h1><p class="subtitle">${state().crests.length} / ${game.wardens.length} crests · ${Object.values(state().quests).filter(s=>s==="claimed").length} / ${fair.quests.length} requests completed · ${Object.keys(state().clears).length} / ${fair.games.length} games cleared</p></div></div><div class="catalog-controls"><div class="journal-tabs">${tabs}</div>${selectFilter}</div><div class="journal-grid"><div id="journal-list" class="journal-list"></div>${questCard()}</div>`;
      on("journal-filter","change",v=>{ journalFilter=v; journalEntries(); });
      journalEntries();
    }

    function journalEntries() {
      const entries = [];
      if (journalTab === "Requests") {
        for (const q of fair.quests) {
          const status = questState(q);
          entries.push({group:status === "Ready to claim" ? "Active" : status, html:actionRow("request",q.id,q.name,status+" · "+q.requester+" · "+game.regions[q.region].name)});
        }
      } else if (journalTab === "Games") {
        for (const g of fair.games) {
          const wins = state().clears[g.id] || 0;
          const status = wins ? "Completed" : state().visited.includes(g.region) ? "Available" : "Undiscovered";
          entries.push({group:status,html:actionRow("game-info",g.id,g.name,game.regions[g.region].name+" · "+(wins ? wins+" clears" : status))});
        }
      } else {
        for (const i of game.wardens) {
          const r = game.regions[i], badge = badgeLabel(i);
          entries.push({group:state().crests.includes(i) ? "Completed" : game.access(i).open ? "Available" : "Undiscovered",
            html:`<button class="journal-entry" data-action="crest" data-value="${i}"><img src="${crestArt(i)}" alt=""><span><span class="detail-label">${badge}</span><strong>${r.crest}</strong><small>Warden ${r.warden} · ${r.name}</small></span>${icon("chevron")}</button>`});
        }
      }
      const visible = entries.filter(e=>journalFilter==="All" || journalFilter===e.group);
      el("journal-list").innerHTML = visible.map(e=>e.html).join("") || "<p>No entries match this filter.</p>";
    }

    function register(tab) {
      if (el("game-dialog").open) el("game-dialog").close();
      journalTab = tab; journalFilter = "All";
      if (location.hash !== "#journal") location.hash = "journal";
      else renderJournal();
    }
    return {
      renderGuide, renderJournal, openKin, openCrest, openQuest, openWorld, openStation, openTracks,
      actions:{
        affinities, enlist, assign:value => assign(...value.split("|")), "inspect-region":v => inspectRegion(Number(v)),
        "map-at":v => openWorld(Number(v)), request:openRequest, "game-info":gameInfo, "play-game":playGame, register,
        "guide-page":v => { guide.page+=Number(v); renderGuideResults(); el("guide-results").scrollIntoView({block:"start"}); },
        "atlas-page":v => { atlas.page+=Number(v); renderAtlas(); },
        "journal-tab":tab => { journalTab=tab; journalFilter="All"; renderJournal(); },
        "request-action":id => {
          const outcome = game.questAction(id);
          if (!outcome.ok) return feedback(outcome.message);
          refresh(); openRequest(id); feedback(outcome.message); playTone(outcome.kind === "claimed" ? "reward" : "click");
        }
      }
    };
  }
};
