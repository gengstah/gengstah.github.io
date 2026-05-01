---
title: "Wiki Log"
permalink: /wiki/log/
layout: single
author_profile: true
---

*Reverse-chronological record of what I've added or changed — newest at the top. See [schema](/wiki/schema/) for the entry format.*

`grep "^## \[" log.md | head -10` for a quick timeline of the latest entries.

---

## [2026-05-01] LINT | Broken-link fixes + Wi-Fi-concepts card anchor on the landing

- **Source:** lint pass over `_wiki/` (broken `(/wiki/...)` links, orphans, stale labels, duplicate H1, self-loop redirects, tag inconsistencies, inbound-link counts on the new Wi-Fi pages); landing-page review.
- **Pages created:** none.
- **Pages modified (6):** `index.md` (Wi-Fi-concepts card now wraps the heading in `<a href="/wiki/concepts/">`, examples expanded from 8 to 28 to surface the new canon); `attacks/port-stealing.md` (planned MacStealer-comparison link redirected to `attacks/framing-frames`); `concepts/bssid-ssid-ess.md`, `concepts/client-isolation.md` (planned `distribution-system` placeholders re-pointed at `concepts/80211-frame-types/` ToDS/FromDS coverage); `concepts/wpa-versions.md` (planned PEAP-misconfig placeholder re-pointed at `concepts/eap-tls/` and `concepts/peap-ttls/`); `sources/windows-exploit-research/index.md` (removed dangling "Drop new sources here / readme" row).
- **Key additions:**
  - All five lint-flagged broken `/wiki/...` links now resolve.
  - Wi-Fi-concepts landing card no longer dead-ends on its heading; surfaces 28 canonical entry points across PHY, MAC, security, roaming, provisioning, and tooling.
  - Lint pass also confirmed: zero orphan pages, no stale `seed`/`sketch` over 100 lines, no duplicate-H1 pages, no self-loop `redirect_from`, no tag inconsistencies. Inbound coverage on the 31 new Wi-Fi pages: minimum 2, with TWT and a few peripheral pages at the lower end (acceptable; they're terminal-leaf concepts).

---

## [2026-05-01] INGEST | Outflank blog corpus — catalogue + 13 derivative pages

- **Source:** Outflank blog (<https://www.outflank.nl/blog/>) — 53 posts spanning 2017-09-14 → 2026-04-02. Full enumeration via the RSS feed (the HTML index is gated by Cloudflare). Authors: Marc Smeets, Pieter Ceelen, Stan Hegt, Cornelis de Plaa, Mark Bergman, Cedric Van Bockhaven, Dima van de Wouw, Kyle Avery, Mariusz Banach, Daniel Duggan ("RastaMouse"), Ksawery Czapczyński, Jarno.
- **Pages created (13):**
  - **Catalogue:** `resources/outflank.md` — complete index of all 53 posts grouped by year, with per-post topic summaries and threading into wiki pages.
  - **Concepts (7):** `concepts/html-smuggling.md`, `concepts/mark-of-the-web.md`, `concepts/office-macro-tradecraft.md` (umbrella for VBA / XLM / SYLK / Word fields), `concepts/vsto-phishing.md`, `concepts/grimresource-msc.md`, `concepts/external-c2.md`, `concepts/secure-enclaves-offensive.md`.
  - **Techniques (4):** `techniques/amsi-bypass.md` (covers VBA AMSI bypass + Unmanaged .NET patching), `techniques/edr-unhooking.md` (covers direct syscalls + sRDI + the 2023 unhooking writeup), `techniques/early-cascade-injection.md`, `techniques/seccomp-notify-injection.md`.
  - **Tools (3):** `tools/redelk.md` (3-part RedELK series), `tools/evil-clippy.md` (VBA stomping), `tools/outflank-c2.md` (2024 Outflank C2 launch), and `tools/ost.md` (the OST commercial bundle umbrella).
- **Pages modified:** `resources/researchers.md` (new "Red-team tradecraft / Cobalt Strike / EDR evasion" section seeded with 11 Outflank operators); `resources/index.md` (5 → 6); `concepts/index.md` (91 → 98); `techniques/index.md` (11 → 15); `tools/index.md` (23 → 27).
- **Key additions:**
  - The catalogue captures all 53 posts so future ingests can extend rather than recurate.
  - Tradecraft canon now has dedicated pages for the topics Outflank canonised — HTML smuggling, Mark-of-the-Web, VSTO phishing, AMSI bypass, EDR unhooking, External C2, Office macro tradecraft as an umbrella across VBA/XLM/SYLK/fields.
  - Recent additions captured: Early Cascade Injection (2024), Secure Enclaves Pt I/II (2025), Seccomp-notifier Linux injection (2025), Unmanaged .NET patching (2024), GrimResource (2024).
  - Cross-references threaded — every existing offensive-security page that touches macros, AMSI, EDR evasion, Cobalt Strike, or red-team logging now links into the new pages.

---

## [2026-05-01] INGEST | Wi-Fi technologies canon — 31 new concept pages

- **Source:** IEEE 802.11-2020 + amendments (a, b, g, n, ac, ax, be, e, i, k, r, s, u, v, w, ah, az, ba); RFC 3610 (CCM), 5216 (EAP-TLS), 5281 (TTLS), 5931 (EAP-PWD), 7664 (Dragonfly), 8110 (OWE), 8908 / 8910 (Captive-Portal API), 9190 (EAP-TLS 1.3), 9380 (Hash-to-Curve); Wi-Fi Alliance certifications (WPA3, Hotspot 2.0 / Passpoint, Wi-Fi Easy Connect / DPP, Enhanced Open, EasyMesh, Wi-Fi 6/6E/7); academic / Vanhoef-corpus papers I had already worked through (KRACK, Dragonblood, FragAttacks, Framing Frames, ASIA-CCS-2016 MAC-randomisation, Heinrich AirDrop USENIX'21).
- **Pages created (31):**
  - **PHY / spectrum** — `concepts/802-11-standards.md` (Wi-Fi 1 → 7 generation map + 11i/e/r/k/v/w/s/u/ad/ay/az/ba/bh/bi companions); `concepts/wifi-frequency-bands.md` (2.4 / 5 / 6 / 60 GHz, channels, DFS, AFC); `concepts/ofdm-ofdma.md` (OFDM, OFDMA, MU-MIMO, beamforming, CSI side-channels).
  - **MAC / framing** — `concepts/80211-frame-types.md` (Mgmt / Control / Data / Extension subtype map + ToDS/FromDS); `concepts/beacon-frames.md` (TBTT, IEs, hidden SSID, BIGTK); `concepts/probe-requests-pnl.md` (active vs passive, KARMA / MANA / Known Beacons, MAC-randomisation limits); `concepts/authentication-association.md` (state machine, Open/SAE/FT auth algorithms, RSN-IE downgrade); `concepts/action-frames.md` (Robust vs Public; CSA, BTM, WNM-Sleep, FT, RM, GAS, ADDBA, vendor-specific); `concepts/amsdu-ampdu.md` (FragAttacks substrate); `concepts/power-save-tim-dtim.md` (PM bit, TIM/DTIM, Listen Interval, BSS Max Idle).
  - **Security / cipher** — `concepts/rsn-information-element.md` (cipher / AKM tables, RSN Capabilities incl. MFPC / MFPR / OCV, PMKID-attack note); `concepts/ccmp-gcmp.md` (AES-CCM / AES-GCM, nonce-reuse fatality, BIP variants); `concepts/wep.md` (FMS / KoreK / PTW; why WEP still appears in 2026); `concepts/wps.md` (PIN brute-force structural flaw, Pixie Dust handoff to attack page).
  - **Enterprise auth** — `concepts/8021x.md` (supplicant / authenticator / auth-server, EAPOL, MSK delivery, MAB / hub-on-the-wire); `concepts/eap-framework.md` (Type table, NAK-down-select, MSK / EMSK, channel binding, identity privacy); `concepts/eap-tls.md` (mutual-cert, AD CS / ESC1 chain, no-CA-pinning misconfig); `concepts/peap-ttls.md` (PEAP-MSCHAPv2 = NTLM-hash-over-Wi-Fi; eaphammer / hostapd-wpe; CVE-2023-52160/52161 cross-link); `concepts/eap-pwd.md` (Dragonfly side-channels via Dragonblood).
  - **WPA3 + Open + roaming** — `concepts/sae-dragonfly.md` (Commit/Confirm, hunting-and-pecking → Hash-to-Curve, SAE-PK, anti-clogging, group downgrade, transition mode); `concepts/owe.md` (RFC 8110 + Transition Mode); `concepts/fast-bss-transition.md` (PMK-R0 / R1 hierarchy, OTA vs OTDS, MDIE rewriting, FT-SAE); `concepts/radio-resource-mgmt.md` (11k Neighbor / Beacon / Channel-Load reports + 11v BTM, WNM-Sleep, BSS Max Idle); `concepts/wifi-mesh.md` (802.11s vs vendor mesh; HWMP injection class).
  - **Modern features** — `concepts/twt.md` (Wi-Fi 6 power-save scheduling, fingerprinting); `concepts/bss-coloring.md` (HE-SIG-A 6-bit color, OBSS_PD, color-collision DoS).
  - **Discovery / provisioning** — `concepts/dpp-easy-connect.md` (Wi-Fi Easy Connect, QR / NFC / PKEX bootstrap, Configurator-issued Connectors); `concepts/wnm-anqp.md` (GAS pre-association queries, ANQP element table, Hotspot-2.0 NAI realm matching); `concepts/wifi-direct-tdls.md` (P2P + TDLS + Wi-Fi Aware/NAN, AirDrop USENIX'21 brute-force).
  - **Infra / tooling** — `concepts/monitor-mode-injection.md` (radiotap, chipset matrix, Wi-Fi 6/6E/7 caveats, end-to-end handshake-capture / scapy injection examples); `concepts/captive-portals.md` (probe-detection endpoints, MAC-spoof / DNS-tunnel bypasses, OWE + portal combo).
- **Pages modified:** `concepts/index.md` (60 → 91 entries; alphabetised; Wi-Fi-technology pages threaded into the existing concept list).
- **Key additions:**
  - The wiki now has a top-to-bottom Wi-Fi technology canon, not just attack-page background — every concept the existing attack pages were assuming a reader already knew (PMK derivation, RSN-IE bits, Robust-vs-Public action frames, A-MSDU AAD, hunting-and-pecking, ANQP) has its own home.
  - Cross-references threaded: every existing Wi-Fi attack page links into the canon (e.g. [FragAttacks](/wiki/attacks/fragattacks/) ↔ [A-MSDU and A-MPDU](/wiki/concepts/amsdu-ampdu/); [KRACK](/wiki/attacks/krack/) ↔ [CCMP / GCMP](/wiki/concepts/ccmp-gcmp/) and the nonce-reuse explanation; [PEAP / IWD bypass](/wiki/attacks/peap-bypass/) ↔ [PEAP / EAP-TTLS](/wiki/concepts/peap-ttls/); [Pixie Dust](/wiki/attacks/pixie-dust-wps/) ↔ [WPS](/wiki/concepts/wps/)).
  - Where a bug crosses the AD/Wi-Fi boundary (AD CS ESC chains feeding EAP-TLS impersonation), the EAP-TLS page links to [Active Directory Attacks](/wiki/concepts/active-directory-attacks/).
  - Forward-looking surface noted but not over-claimed: AFC (6 GHz), Multi-Link Operation (Wi-Fi 7), Restricted TWT, BSS-color collision DoS, NAN brute-force — flagged as research-active rather than weaponised.

---

## [2026-04-30] INGEST | Copy Fail (CVE-2026-31431) — Linux kernel LPE

- **Source:** Theori / Xint *Copy Fail: 732 Bytes to Root on Every Major Linux Distribution* (<https://xint.io/blog/copy-fail-linux-distributions>); canonical writeup at <https://copy.fail/>; supporting coverage from Bugcrowd, The Register, heise online; PoCs at `wiire-a/copy-fail-c` mirror and `rootsecdev/cve_2026_31431`.
- **Pages created (1):** `cves/CVE-2026-31431.md` — Copy Fail. Logic flaw between the 2017 `algif_aead` in-place scatterlist optimisation and the `authencesn` template's post-output 4-byte scratch write. Splicing a readable setuid binary into an `AF_ALG` AEAD operation lets an unprivileged user write 4 attacker-chosen bytes at an attacker-chosen offset into the page-cache page that backs the binary's `.text`. `execve()` of the (now-corrupted-in-cache) setuid binary returns root. Mainline fix is commit `a664bf3d603d`; backported to `6.18.22`, `6.19.12`, `7.0`.
- **Pages modified:** `cves/index.md` (38 → 39); `resources/researchers.md` — new "Linux kernel exploitation" section seeded with Brian Pak and Taeyang Lee (Theori / Xint Code).
- **Key additions:**
  - First Linux kernel CVE in the wiki — opens the door to broader Linux LPE coverage alongside the Windows kernel corpus.
  - Captures the structural lesson: a deterministic 4-byte page-cache write is sufficient for root when it can land in a setuid binary's cached `.text` page. No race, no info leak, no kernel offsets — the same 732-byte Python PoC works across every major distro shipping kernels from 2017 onward.
  - Highlights the cross-team interaction failure: the in-place optimisation was reviewed against GCM/CCM/authenc (none of which write past the output boundary); `authencesn` is rare enough that no fuzzer in the field caught the scratch write.
  - Notes the Xint Code AI scanner's role — Lee's analyst-level prompt about `AF_ALG + splice` exposure narrowed the search space; the scanner surfaced the bug in roughly an hour.

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
