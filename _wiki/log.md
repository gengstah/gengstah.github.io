---
title: "Wiki Log"
permalink: /wiki/log/
layout: single
author_profile: true
---

*Append-only chronological record of every operation against this wiki. See [schema](/wiki/schema/) for the entry format.*

`grep "^## \[" log.md | tail -10` for a quick timeline.

---

## [2026-04-28] INIT | Wiki bootstrapped

- **Source:** [Karpathy — `llm-wiki.md`](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) (the pattern); user's request to scope it to offensive security
- **Pages created:**
  - Core: `index.md`, `log.md`, `schema.md`, `overview.md`
  - Domains: `domains/penetration-testing.md`, `domains/red-teaming.md`, `domains/vulnerability-research.md`, `domains/exploit-development.md`
  - Concepts: `concepts/cyber-kill-chain.md`, `concepts/mitre-attack.md`, `concepts/opsec.md`
  - Techniques: `techniques/recon.md`, `techniques/initial-access.md`, `techniques/privilege-escalation.md`, `techniques/lateral-movement.md`, `techniques/persistence.md`
  - Tools: `tools/nmap.md`, `tools/burpsuite.md`, `tools/ghidra.md`, `tools/cobalt-strike.md`
  - Resources: `resources/reading-list.md`, `resources/researchers.md`
- **Pages modified:** none (initial commit)
- **Key additions:**
  - Established `_wiki/` Jekyll collection wired into `_config.yml`; URLs are `/wiki/<dir>/<slug>/`.
  - Top nav entry "Wiki" → `/wiki/` added to `_data/navigation.yml`.
  - Sidebar nav `wiki:` added so every wiki page can opt in via `sidebar.nav: "wiki"`.
  - Repo-root `CLAUDE.md` documents the schema for future Claude Code sessions; mirrored as `_wiki/schema.md` for human reading.
  - All seed pages are `Status: seed` — content is skeletal scaffolding, not authoritative. The wiki grows as the user ingests sources.

---

## [2026-04-28] LINT | Move sidebar nav off-canvas

- **Source:** user feedback ("scrollbar shows" on left sidebar)
- **Pages created:** none
- **Pages modified:** `_config.yml` (drop `sidebar.nav: "wiki"` from defaults), `_data/navigation.yml` (drop `wiki:` block), all 22 seed pages (strip per-page `sidebar.nav: "wiki"`)
- **Key additions:**
  - Wiki pages no longer render the left sidebar nav. Author profile sidebar still shows (theme default).
  - Navigation is now via top-nav "Wiki" link → catalog (`/wiki/`) → drill in via per-page **Related:** lines.
  - Keeps the page surface clean and removes the scrollbar the user disliked.

---

## [2026-04-28] INGEST | AirSnitch — Wi-Fi client isolation bypass (NDSS 2026)

- **Source:** `raw_sources/ndss2026-airsnitch-paper.md` (NDSS 2026; Zhou, Pu, Liu, Qian, Tan, Krishnamurthy, Vanhoef) + a pre-built local wiki at `~/Documents/airsnitch-wiki/` (33 derived pages + index)
- **Pages created:**
  - `_wiki/airsnitch/index.md`, `_wiki/airsnitch/overview.md`
  - `_wiki/airsnitch/attacks/` × 8 — abusing-gtk, gateway-bouncing, port-stealing, broadcast-reflection, machine-on-the-side, rogue-ap, passpoint-flaws, auxiliary-techniques
  - `_wiki/airsnitch/concepts/` × 9 — client-isolation, wifi-key-hierarchy, handshakes, bssid-ssid-ess, virtual-ports, passpoint, wpa-versions, radius, mfp
  - `_wiki/airsnitch/defenses/` × 8 — index, group-key-randomization, vlans, spoofing-prevention, filter-unicast-in-broadcast, macsec, centralized-decryption, documentation
  - `_wiki/airsnitch/devices/tested-devices.md`
  - `_wiki/airsnitch/tools/` × 4 — airsnitch-cli, repo-layout, configurations, setup-scripts
  - `_wiki/airsnitch/sources/` × 2 — ndss2026-paper, airsnitch-readme
- **Pages modified:** `_wiki/index.md` (added "Topic deep-dives" section + tag-index entries), `_wiki/resources/researchers.md` (added Mathy Vanhoef and the AirSnitch author cluster under a new Wi-Fi / wireless section)
- **Key additions:**
  - 34 ported pages preserve the source wiki's substructure (attacks / concepts / defenses / devices / tools / sources). Original Obsidian-style relative `*.md` links converted to absolute Jekyll permalinks under `/wiki/airsnitch/`.
  - Frontmatter normalized to Jekyll: `title`, `permalink`, `layout: single`, `author_profile: true`, `tags: [airsnitch, wifi, <type>]`. Source-side `sources:` and `updated:` metadata preserved.
  - Wi-Fi protocol VR is now a represented domain in the wiki (previously: zero coverage). Future ingest of related work (MacStealer, Krack, Dragonblood, Frag attacks) can plug into the same `_wiki/airsnitch/` namespace or get its own deep-dive.
  - The raw NDSS paper itself is *not* checked into the repo (likely under conference/author copyright); it lives at the source path above and the wiki cites it via `_wiki/airsnitch/sources/ndss2026-paper.md`.
