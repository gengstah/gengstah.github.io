---
title: "Wiki Log"
permalink: /wiki/log/
layout: single
author_profile: true
sidebar:
  nav: "wiki"
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
