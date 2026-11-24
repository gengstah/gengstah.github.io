const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function openLodge() {
  const context = vm.createContext({window: {}});
  for (const name of ["atlas", "bestiary", "activities", "story", "campaign", "duets", "wardens", "second-bell", "engine"]) {
    const filename = path.join(__dirname, "../games/wilderkin", name + ".js");
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, {filename});
  }
  const {WilderGame: game, WilderSecondBell: bell, WilderKinDex: dex} = context.window;
  const card = (region, party) => bell.card({...game, dex, region, party});
  return {game, bell, dex, card};
}

test("all 30 return matches preserve the home opener and ace around a guest from a nearby Warden", () => {
  const {game, card} = openLodge();
  const travelers = ["sprigkit", "cindlet", "dewfin", "opalclasp", "mossbell", "gustlance"];
  assert.equal(game.wardens.length, 30);
  for (const region of game.wardens) {
    const neighbors = Array.from(game.wardens).filter(i => i !== region)
      .sort((a, b) => Math.abs(a - region) - Math.abs(b - region) || a - b).slice(0, 2);
    for (const size of [3, 4, 5, 6]) {
      const party = travelers.slice(0, size).map((id, i) => ({id, level: i === size - 1 ? 80 : 5, hp: 1}));
      const posted = card(region, party);
      assert.equal(posted.level, Math.max(game.regions[region].wardenLevel, 80));
      assert.equal(posted.roster.length, size);
      assert.equal(new Set(posted.roster).size, size);
      assert.equal(posted.roster[0], game.pools[region][1]);
      assert.equal(posted.roster.at(-1), game.pools[region][0]);
      assert.equal(posted.roster[1], posted.guest);
      assert.ok(!game.pools[region].includes(posted.guest));
      assert.ok(neighbors.some(i => game.pools[i].includes(posted.guest)));
      const reordered = party.slice().reverse().map(k => ({...k, hp: 0}));
      assert.deepEqual(posted, card(region, reordered));
    }
  }
  const ordinaryRegion = game.regions.findIndex(r => !r.warden);
  assert.equal(card(ordinaryRegion, game.team()), null);
  assert.equal(card(0, []), null);
});

test("scouting reflects team affinities and gives the player a truthful explanation", () => {
  const {game, dex, card} = openLodge();
  const scouts = new Set();
  for (const type of Object.keys(dex.types)) {
    const party = Object.values(game.species).filter(s => s.type === type).slice(0, 3).map(s => ({id:s.id, level:5}));
    assert.equal(party.length, 3);
    const posted = card(0, party), guestType = game.species[posted.guest].type;
    const crew = party.map(p => game.species[p.id]);
    for (const k of crew) {
      if (dex.effectiveness(guestType, k.types) > 1) assert.ok(posted.guestReason.includes(k.name));
    }
    const candidates = [...game.pools[1], ...game.pools[2]].filter(id => !game.pools[0].includes(id));
    const exposed = attack => crew.filter(k => dex.effectiveness(attack, k.types) > 1).length;
    assert.equal(exposed(guestType), Math.max(...candidates.map(id => exposed(game.species[id].type))));
    scouts.add(posted.guest);
  }
  assert.ok(scouts.size >= 3);
  const fresh = card(0, game.team());
  assert.equal(game.species[fresh.guest].name, "Coalmoth");
  assert.equal(fresh.guestReason, "Ember threatens Sprigkit.");
});

test("players can see the posted formation and choose an exhibition lead independently of their trail lead", () => {
  const {game, bell} = openLodge();
  const calls = [];
  const desk = bell.create({game,
    row: (id, label, value, detail, extra) => ({id, label, value, detail, ...extra}),
    image: (id, owned = false) => (owned ? "home/" : "rival/") + id,
    locate: (...args) => calls.push(["walk", ...args]),
    fight: (...args) => calls.push(["fight", ...args]),
    go() {}, travel() {}, render() {}
  });
  const rows = () => desk.model(0).sections.flatMap(s => s.rows || []);
  const formation = () => rows().filter(r => ["OPENER", "GUEST", "ACE"].includes(r.badge));
  assert.deepEqual(Array.from(formation(), r => r.badge), ["OPENER", "GUEST", "ACE"]);
  const before = Array.from(formation(), r => r.label);
  assert.ok(formation().every(r => r.image.startsWith("rival/")));
  assert.ok(rows().some(r => r.id === "bell-walk"));
  assert.ok(rows().some(r => r.id === "nav" && r.value === "party"));
  assert.equal(desk.act("bell-ring", 0), true);
  assert.equal(calls.length, 0);
  desk.act("bell-lead", "cindlet");
  assert.ok(rows().some(r => r.value === "cindlet" && r.badge === "OPENS" && r.image === "home/cindlet"));
  assert.deepEqual(Array.from(formation(), r => r.label), before);
  desk.act("bell-walk", 0);
  assert.equal(calls[0][1], "warden");
  assert.equal(calls[0][2].name, "second-bell");
  assert.ok(game.visitSite("warden"));
  desk.act("bell-ring", 0);
  assert.deepEqual(calls[1], ["fight", "second-bell", "cindlet"]);
  assert.equal(game.state.lead, "sprigkit");
});
