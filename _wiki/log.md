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

---

## [2026-04-28] INGEST | Offensive Security Notes (concepts/entities/playbooks)

- **Source:** local Obsidian-style wiki at `/mnt/hgfs/notes/offensive-security/`
- **Pages created:** 64 under `_wiki/offsec-notes/` — `index.md`, `log.md`, `schema.md`, plus `concepts/` × 45 (active-directory-attacks, kerberoasting, lateral-movement, dll-hijacking, edr-silencing, lsass-dumping, jwt-attacks, sql-injection, xss, phishing, social-engineering, mobile-security, kubernetes-pentesting, cloud-penetration-testing, ai-agents-offensive, …), `entities/` × 11 (bloodhound, burp-suite, cobalt-strike, impacket, metasploit, mimikatz, nmap, nuclei, responder, wmic, airsnitch), `playbooks/` × 4 (active-directory-pentest, external-pentest, internal-network-pentest, web-app-pentest)
- **Pages modified:** `_wiki/index.md` (added card + redesign — see LINT entry below)
- **Key additions:**
  - First broad coverage of cloud, kubernetes, mobile, AI-agents, JWT/web in the wiki — these were absent.
  - First playbook-style content (engagement runbooks vs. concept reference pages).
  - The source `sources/` directory (~50 Maldev Academy clipped articles) and empty `engagements/` are *not* published — `sources/` is raw third-party material that lives in the source repo only.
  - Obsidian `[[wikilink]]` and `[[path/page|alias]]` syntax converted to absolute Jekyll URLs by a slug-index resolver; one collision flagged (`[[mitigations]]` ambiguous between kernel and user-mode in the windows-exploit ingest below) — left to be disambiguated by source paths.

---

## [2026-04-28] INGEST | Windows Exploit Research wiki (re-ingest of earlier corpus)

- **Source:** local Obsidian-style wiki at `/mnt/hgfs/notes/windows-exploit-research/wiki/` (the same body of work the user previously committed and removed in commits `82a42bc`/`a42a7c6` — now re-published under the new wiki structure)
- **Pages created:** 64 under `_wiki/windows-exploit-research/` — `index`, `log`, `overview`, plus `cves/` × 28 (CVE-2020-1350 SIGRed → CVE-2026-20820 CLFS ScanContainers), `kernel/` × 14 (architecture, pool_internals, primitives, mitigations, clfs, clfs_authentication, vtl_secure_calls, cimfs, cldflt, minifilter, wnf_internals, ioring, kernel_streaming, directx, tcpip_stack), `usermode/` × 4 (heap_internals, stack_exploitation, mitigations, browser_exploitation), `techniques/` × 6 (rop, type_confusion, use_after_free, race_conditions, integer_overflows, heap_grooming), `tools/` × 4 (debugging, reversing, fuzzing, dynamic_analysis), `resources/` × 3 (researchers, papers_and_blogs, cve_template)
- **Pages modified:** `_wiki/index.md` (added card + tag-index entries for `windows`, `kernel-mode`, `cve`)
- **Key additions:**
  - 28 CVE pages with root-cause analysis, exploitation flow, exploit primitives, and references — material on tcpip.sys IPv6, CLFS, cldflt, ioring, dxgkrnl, kernel streaming, NTFS, npfs, dns.exe, keyiso, appid.sys, etc.
  - Kernel-internals coverage: VTL secure calls, CLFS HMAC authentication, IORING ALPC bootstrap, WNF state names, kernel CET shadow stacks, minifilter altitude system.
  - Slug-index resolver flagged one ambiguity — `[[mitigations]]` could be either `kernel/mitigations` or `usermode/mitigations`. Most uses were path-qualified; the few unqualified ones need a manual sweep.

---

## [2026-04-28] LINT | Redesigned `/wiki/` index as card-based landing

- **Source:** user feedback ("devise a way for users to easily see overview without using the left or right nav bar")
- **Pages created:** none
- **Pages modified:** `_wiki/index.md`
- **Key additions:**
  - Replaced the long markdown table-of-contents with a card-based landing page: hero block + prominent "Start with the overview →" CTA + topic-tile grids for the four pillars, the three deep-dives, foundations, techniques, tools, and resources.
  - All inline HTML/CSS — no theme SCSS edits, kramdown-friendly. Cards use a CSS grid with `auto-fit minmax(250px, 1fr)` so they reflow at any width.
  - The overview is now reachable in one click from `/wiki/` without any sidebar interaction; the four pillars and three topic deep-dives are visible at a glance.

---

## [2026-04-28] INGEST | Catalogue all un-ingested raw references (146 source-provenance pages)

- **Source:** raw materials referenced by the three topic wikis but not yet present on the published site:
  - AirSnitch raw: `/home/kali/Documents/airsnitch-wiki/raw/` — 1 file (NDSS 2026 paper full text)
  - Windows Exploit Research raw: `/mnt/hgfs/notes/windows-exploit-research/raw_sources/` — 60 files (Patch-Tuesday writeups, CVE blog posts, kernel-internals articles, "exploit reversing" series)
  - Offensive Security Notes raw: `/mnt/hgfs/notes/offensive-security/sources/` — 47 root-level Maldev-Academy-style course material + 36 already-distilled blog posts under `sources/ingested/`
- **Pages created:** 146 source-provenance pages
  - `_wiki/airsnitch/sources/` — `index.md` + 1 new (`ndss2026-airsnitch-paper`); pre-existing `ndss2026-paper` and `airsnitch-readme` re-listed in the index
  - `_wiki/windows-exploit-research/sources/` — `index.md` + 60 entries (23 auto-marked `integrated` because their filename matches a published CVE page; 37 `catalogued`)
  - `_wiki/offsec-notes/sources/` — `index.md` + 83 entries (36 `integrated` from the source wiki's `sources/ingested/` subdir; 47 `catalogued` Maldev-Academy course material)
- **Pages modified:** `_wiki/index.md` (topic deep-dive cards now show source counts as live links to each topic's sources index)
- **Key additions:**
  - Each provenance page is metadata-only: title, raw filename, status (`integrated` | `catalogued`), excerpt (first ~400 chars), and links to the wiki pages it informed (where determinable). The full raw text is *not* republished (schema rule + third-party copyright on the Maldev Academy material).
  - Status inference: `integrated` when filename matches a published CVE page or sits under a source `sources/ingested/` directory; `catalogued` otherwise. The catalogue lets future ingest passes pick the next un-distilled source by browsing the per-topic sources index.
  - The script (`/tmp/catalogue_sources.py`) is re-runnable; new raw drops + a re-run will refresh the catalogue.
