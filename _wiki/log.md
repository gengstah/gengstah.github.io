---
title: "Wiki Log"
permalink: /wiki/log/
layout: single
author_profile: true
---

*Reverse-chronological record of what I've added or changed — newest at the top. See [schema](/wiki/schema/) for the entry format.*

`grep "^## \[" log.md | head -10` for a quick timeline of the latest entries.

---

## [2026-04-29] LINT | Landing's Wi-Fi section now reflects the full canon

- **Source:** caught while reviewing the landing — the Wi-Fi protocol-research blurb still said "AirSnitch corpus" only.
- **Pages created:** none
- **Pages modified:** `index.md`
- **Key additions:**
  - Lead rewritten to span Pixie Dust (2014) → AirSnitch (2026). Sample links cover the full canon.
  - Attacks card count corrected to 17 with sample links across the canon plus the AirSnitch eight.
  - Defences and Devices cards explicitly noted as scoped to the AirSnitch corpus.
  - New "Wi-Fi concepts" card surfaces the background pages (key hierarchy, handshakes, WPA versions, MFP, client isolation, BSSID/SSID/ESS, Passpoint, RADIUS).

---

## [2026-04-29] INGEST | The Wi-Fi research canon

- **Source:** academic papers and project pages I worked through — KRACK CCS 2017, Dragonblood S&P 2020, FragAttacks USENIX 2021, Framing Frames USENIX 2023, TunnelCrack USENIX 2023, SSID Confusion WiSec 2024, Schepers/Vanhoef MFP-deauthentication WiSec 2022, Bongard's Pixie Dust slides (Hack.lu 2014), the Vanhoef PEAP / IWD authentication-bypass disclosures (Feb 2024).
- **Pages created (9):**
  - `attacks/krack.md` — Vanhoef + Piessens, *Key Reinstallation Attacks: Forcing Nonce Reuse in WPA2* (CCS 2017). Ten-CVE cluster including the Linux/Android all-zero-key variant.
  - `attacks/dragonblood.md` — Vanhoef + Ronen, *Dragonblood: A Security Analysis of WPA3's SAE Handshake* (S&P 2020). Cache + timing side channels on hunting-and-pecking; downgrade attacks; EAP-pwd auth bypass.
  - `attacks/fragattacks.md` — Vanhoef, *Fragment and Forge: Breaking Wi-Fi Through Frame Aggregation and Fragmentation* (USENIX Security 2021). Three design flaws (A-MSDU flag unauthenticated, mixed-key fragmentation, fragment cache not flushed) plus nine implementation bugs.
  - `attacks/framing-frames.md` — Schepers + Ranganathan + Vanhoef, *Framing Frames: Bypassing Wi-Fi Encryption by Manipulating Transmit Queues* (USENIX Security 2023); MacStealer; CVE-2022-47522.
  - `attacks/tunnelcrack.md` — Xue + Malla + Xia + Pöpper + Vanhoef, *Bypassing Tunnels: Leaking VPN Client Traffic by Abusing Routing Tables* (USENIX Security 2023). LocalNet + ServerIP attacks.
  - `attacks/ssid-confusion.md` — Gollier + Vanhoef, *SSID Confusion* (WiSec 2024 best paper). CVE-2023-52424 — SSID not authenticated by the 4-way handshake.
  - `attacks/peap-bypass.md` — Vanhoef, CVE-2023-52160 (wpa_supplicant PEAP TLV-Success bypass) + CVE-2023-52161 (IWD handshake state-machine bypass), Feb 2024.
  - `attacks/mfp-deauthentication.md` — Schepers + Vanhoef + Ranganathan, *On the Robustness of Wi-Fi Deauthentication Countermeasures* (WiSec 2022) and *Cut It* (FPS 2022).
  - `attacks/pixie-dust-wps.md` — Bongard, *Offline brute-force attack on WiFi Protected Setup* (Hack.lu 2014). Weak-PRNG → offline PIN recovery.
- **Pages modified:** `attacks/index.md` regenerated (8 → 17); `resources/researchers.md` expanded with Piessens, Ronen, Schepers, Ranganathan, Gollier, Pöpper et al., and Bongard; Vanhoef's row now links every page.
- **Key additions:**
  - The Wi-Fi corpus now spans Pixie Dust (2014) → KRACK (2017) → Dragonblood (2020) → FragAttacks (2021) → Framing Frames + TunnelCrack + MFP-deauth (2022–2023) → SSID Confusion + PEAP/IWD bypass (2024) → AirSnitch (2026).
  - Each page emphasises the structural reason the attack is possible — usually a security-relevant decision the standard placed in an unauthenticated framing field (A-MSDU bit, power-save bit, SSID, fragment cache, hash-to-curve constant-timeness). The recurring theme is reinforced across pages.
  - Cross-references threaded through [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Handshakes](/wiki/concepts/handshakes/), [WPA Versions](/wiki/concepts/wpa-versions/), [MFP](/wiki/concepts/mfp/), [Client Isolation](/wiki/concepts/client-isolation/).

---

## [2026-04-28] INGEST | Nine new Windows kernel CVE write-ups

- **Source:** public CVE write-ups I worked through — exploits.forsale (Pwn2Own 2024), Theori (Hexacon 2023), ZeroPath, Akamai PatchDiff-AI, Quarkslab, MrAle98 PoC, Crowdfense, Help Net Security, SOC Prime.
- **Pages created (9):**
  - `cves/CVE-2024-30088.md` — NT-kernel TOCTOU in `AuthzBasepCopyoutInternalSecurityAttributes` (`NtQueryInformationToken(TokenAccessInformation)`); APT34/OilRig ITW; Pwn2Own 2024 (carrot_c4k3) chain via IORING `RegBuffers` corruption.
  - `cves/CVE-2023-28218.md` — afd.sys `AfdCopyCMSGBuffer` integer-overflow → paged-pool heap overflow; Frontier Squad / Theori at Hexacon 2023; `_IO_COMPLETION_CONTEXT` spray + `IopReplaceCompletionPort` arbitrary decrement → `KTHREAD.PreviousMode` flip.
  - `cves/CVE-2025-21333.md` — Hyper-V `vkrnlintvsp.sys` heap overflow; ITW (CISA KEV); MrAle98 PoC introducing the *single-entry* WNF + IORING `_IOP_MC_BUFFER_ENTRY` corruption pattern.
  - `cves/CVE-2025-30385.md` — CLFS UAF (May 2025).
  - `cves/CVE-2025-32701.md` — CLFS log-stream UAF; ITW zero-day; May 2025.
  - `cves/CVE-2025-60709.md` — CLFS container-parse OOB read → arbitrary kernel write; Nov 2025.
  - `cves/CVE-2025-60719.md` — afd.sys multi-routine UAF (endpoint-unbind race); `AfdPreventUnbind` / `AfdReallowUnbind` is the patch's synchronisation barrier.
  - `cves/CVE-2025-62215.md` — NT-kernel race / double-free; ITW zero-day; Nov 2025 (out-of-band update for non-ESU Win10).
  - `cves/CVE-2025-8061.md` — Lenovo `LnvMSRIO.sys` BYOVD; arbitrary MSR R/W + arbitrary physical-memory R/W via IOCTLs on a no-DACL device; LSTAR-overwrite-and-syscall trick to land ring-0.
- **Pages modified:** `cves/index.md` regenerated (29 → 38 entries); five new researcher entries (carrot_c4k3, Frontier Squad/Theori, Akamai security research, Alessandro Iandoli/MrAle98, Luis Casvella/Quarkslab) on `resources/researchers.md`.
- **Key additions:**
  - The 2025 CLFS LPE cluster is now complete on the wiki (29824 / 30385 / 32701 / 60709) plus the November zero-day (62215).
  - First afd.sys / WinSock entries — the dominant 2023–2025 LPE surface beside CLFS.
  - First Hyper-V VSP entry; first BYOVD entry.
  - Cross-references threaded through [CLFS](/wiki/kernel/clfs/), [IORING](/wiki/kernel/ioring/), [WNF Internals](/wiki/kernel/wnf_internals/), and the [UAF](/wiki/techniques/use_after_free/) / [Race Conditions](/wiki/techniques/race_conditions/) / [Integer Overflows](/wiki/techniques/integer_overflows/) technique pages.

---

## [2026-04-28] LINT | `/wiki/` redesigned as a card-based landing

- **Source:** ergonomic — the long table-of-contents on the index made the overview hard to find.
- **Pages created:** none
- **Pages modified:** `index.md`
- **Key additions:**
  - Replaced the markdown table-of-contents with a card-based landing — hero block, prominent "Start with the overview →" CTA, tile grids for the four pillars, the topic deep-dives, foundations, techniques, tools, resources.
  - Inline HTML/CSS only; no theme edits. CSS-grid `auto-fit minmax(260px, 1fr)` so cards reflow at any width.

---

## [2026-04-28] INGEST | Windows Exploit Research

- **Source:** my own Windows-kernel research notebook — patch-Tuesday write-ups, kernel-internals reverse engineering, exploit-primitive notes. Originally in Obsidian, ported into the wiki.
- **Pages created:** 64 — 28 CVE deep-dives (CVE-2020-1350 SIGRed → CVE-2026-20820 CLFS ScanContainers), 14 kernel-internals pages (architecture, pool internals, primitives, mitigations, CLFS, CLFS auth, VTL secure calls, CimFS, cldflt, minifilter, WNF internals, IORING, kernel streaming, DirectX, TCP/IP stack), 4 user-mode pages (heap internals, stack exploitation, mitigations, browser exploitation), 6 technique pages (ROP, type confusion, UAF, race conditions, integer overflows, heap grooming), 4 tool pages (debugging, reversing, fuzzing, dynamic analysis), 3 resource pages (researchers, papers and blogs, CVE template).
- **Pages modified:** `index.md` (added the Windows-exploit-research deep-dive card; later folded in).
- **Key additions:**
  - 28 CVE pages with root-cause analysis, exploit primitives, and references — TCP/IP IPv6, CLFS, cldflt, IORING, dxgkrnl, kernel streaming, NTFS, npfs, dns.exe, keyiso, appid.sys.
  - Windows kernel-internals deep-dive: VTL secure calls, CLFS HMAC/Merkle authentication, IORING ALPC bootstrap, WNF state names, kernel CET shadow stacks, minifilter altitude system.

---

## [2026-04-28] INGEST | Offensive Security Notes — concepts, tools, playbooks

- **Source:** my own offensive-security notebook accumulated over ~2 years — concept summaries, tool cheat sheets, engagement playbooks. Content originally in Obsidian, ported into the wiki.
- **Pages created:** 64 — 45 concept pages (active-directory-attacks, kerberoasting, lateral-movement, dll-hijacking, edr-silencing, lsass-dumping, JWT/SQL/XSS, phishing, social engineering, mobile, Kubernetes, cloud, AI-agents, …), 11 tool entries (BloodHound, Burp, Cobalt Strike, Impacket, Metasploit, Mimikatz, nmap, nuclei, responder, wmic, AirSnitch), 4 engagement playbooks (AD, external, internal, web app).
- **Pages modified:** `index.md` (added the offsec-notes deep-dive card; later folded into the top-level structure).
- **Key additions:**
  - First broad coverage of cloud, Kubernetes, mobile, AI-agents, and JWT/web in the wiki.
  - First playbook-style content — engagement runbooks rather than concept references.
  - Obsidian `[[wikilink]]` syntax converted to absolute Jekyll URLs while porting; one ambiguous slug (`mitigations`) flagged for a follow-up disambiguation pass.

---

## [2026-04-28] INGEST | AirSnitch — Wi-Fi client isolation bypass (NDSS 2026)

- **Source:** *AirSnitch: Demystifying and Breaking Client Isolation in Wi-Fi Networks* — Zhou, Pu, Liu, Qian, Tan, Krishnamurthy, Vanhoef (NDSS 2026); the upstream AirSnitch tooling and README.
- **Pages created:** an `airsnitch/` subtree of 33 pages — overview, eight attack pages, nine concept pages (key hierarchy, handshakes, BSSID/SSID/ESS, virtual ports, Passpoint, WPA versions, RADIUS, MFP, client isolation), eight defence pages, a tested-devices table, four tool pages, two source-provenance pages.
- **Pages modified:** `index.md` and `resources/researchers.md` (added Vanhoef and the AirSnitch author cluster).
- **Key additions:**
  - First Wi-Fi protocol VR coverage in the wiki. The eight attacks (abusing GTK, gateway bouncing, port stealing, broadcast reflection, machine-on-the-side, rogue AP, Passpoint flaws, auxiliary techniques) all live here.
  - Defences page: per-attack matrix and the four practical fixes (group-key randomisation, VLANs, MAC/IP spoofing prevention, MACsec).
  - Tested-devices digest of NDSS Tables I–III: which routers fail which tests.
  - Established the "topic deep-dive under its own subtree" pattern, later flattened into the top-level taxonomy.

---

## [2026-04-28] LINT | Drop the left sidebar nav

- **Source:** ergonomic — the per-page sidebar nav was scrollbar-heavy and not pulling its weight.
- **Pages created:** none
- **Pages modified:** `_config.yml` (drop `sidebar.nav: "wiki"` from defaults), `_data/navigation.yml` (remove the `wiki:` block), every wiki page (strip the per-page `sidebar.nav` line)
- **Key additions:**
  - Wiki pages no longer render a left sidebar nav. The author-profile sidebar still shows.
  - Navigation is now: top-nav "Wiki" → catalog (`/wiki/`) → drill in via per-page **Related:** lines and category indexes.

---

## [2026-04-28] INIT | Wiki bootstrapped

- **Source:** initial bootstrap — scoped to offensive security
- **Pages created:**
  - Core: `index.md`, `log.md`, `schema.md`, `overview.md`
  - Domains: `domains/penetration-testing.md`, `domains/red-teaming.md`, `domains/vulnerability-research.md`, `domains/exploit-development.md`
  - Concepts: `concepts/cyber-kill-chain.md`, `concepts/mitre-attack.md`, `concepts/opsec.md`
  - Techniques: `techniques/recon.md`, `techniques/initial-access.md`, `techniques/privilege-escalation.md`, `techniques/lateral-movement.md`, `techniques/persistence.md`
  - Tools: `tools/nmap.md`, `tools/burpsuite.md`, `tools/ghidra.md`, `tools/cobalt-strike.md`
  - Resources: `resources/reading-list.md`, `resources/researchers.md`
- **Pages modified:** none (initial commit)
- **Key additions:**
  - Set up `_wiki/` as a Jekyll collection in `_config.yml`; URLs are `/wiki/<dir>/<slug>/`.
  - Top-nav entry "Wiki" → `/wiki/` in `_data/navigation.yml`.
  - All seed pages start at `Status: seed` — scaffolding I'll grow into as I add material.
