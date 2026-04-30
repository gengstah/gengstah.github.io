---
title: "Researchers"
permalink: /wiki/resources/researchers/
layout: single
author_profile: true
tags:
  - resources
---

*People doing notable work in offensive security, by area. Maintained as the wiki ingests their writing.*

**Status:** seed
**Related:** [Reading List](/wiki/resources/reading-list/), [Vulnerability Research](/wiki/domains/vulnerability-research/)

{% include toc %}

---

## Windows kernel exploitation

| Researcher | Affiliation | Areas |
|------------|-------------|-------|
| Alex Ionescu | (CrowdStrike, formerly) | Windows internals, CLFS reverse engineering, kernel architecture. *Windows Internals* co-author. |
| Connor McGarr | n/a | Kernel exploitation tutorials; CET / shadow stack research. <https://connormcgarr.github.io/> |
| Saar Amar | (Microsoft) | Windows mitigations, browser exploitation, JS engines. <https://saaramar.github.io/> |
| Yarden Shafir | n/a | Windows internals, EDR evasion, kernel architecture. |
| Boris Larin | Kaspersky GReAT | In-the-wild Windows LPEs (CLFS series, etc.). |
| Cherie-Anne Lee | StarLabs | cldflt.sys, CimFS, kernel pool exploitation. |
| Grant Willcox | (Trend ZDI / Immersive Labs) | Windows kernel CVE write-ups. |
| Filip Dragović | n/a | Windows logic bugs, redirection-based escalation. |
| carrot_c4k3 | n/a | Pwn2Own 2024 — Windows LPE chain via [CVE-2024-30088](/wiki/cves/CVE-2024-30088/) (NT-kernel TOCTOU + IORING). |
| Frontier Squad (Theori) | Theori | afd.sys exploitation; [CVE-2023-28218](/wiki/cves/CVE-2023-28218/) Hexacon 2023. |
| Akamai security research | Akamai | PatchDiff-AI; root-cause analysis pipelines; [CVE-2025-60719](/wiki/cves/CVE-2025-60719/) afd.sys UAF write-up. |
| Alessandro Iandoli (MrAle98) | n/a | Hyper-V exploitation; [CVE-2025-21333](/wiki/cves/CVE-2025-21333/) PoC introducing single-entry IORING corruption. |
| Luis Casvella | Quarkslab | BYOVD research; [CVE-2025-8061](/wiki/cves/CVE-2025-8061/) Lenovo `LnvMSRIO.sys`. |

---

## Linux kernel exploitation

| Researcher | Affiliation | Areas |
|------------|-------------|-------|
| Brian Pak | Theori / Xint Code | Linux kernel VR; AI-assisted vulnerability discovery (Xint Code scanner). [CVE-2026-31431](/wiki/cves/CVE-2026-31431/) "Copy Fail" co-discoverer. |
| Taeyang Lee | Theori / Xint Code | Linux kernel crypto subsystem; identified `AF_ALG + splice` as a page-cache exposure vector that surfaced [CVE-2026-31431](/wiki/cves/CVE-2026-31431/). |

---

## Browser / JS engine exploitation

| Researcher | Areas |
|------------|-------|
| Samuel Groß | V8 (Chrome) — typer bugs, JIT confusion. Project Zero. |
| Sergei Glazunov | Chrome / V8 type confusion. Project Zero. |
| Amy Burnett | Browser exploitation tutorials, V8 internals. |
| Manfred Paul | JavaScript engine research; Pwn2Own competitor. |
| Jeremy Fetiveau | Safari / WebKit. |
| 360 Vulcan, Qihoo Vulcan, DBAPP Security alumni | Browser pwn at Pwn2Own / Tianfu Cup. |

---

## Active Directory / red team / identity

| Researcher | Affiliation | Areas |
|------------|-------------|-------|
| Will Schroeder ("harmj0y") | SpecterOps | ADCS, Kerberos, lateral movement; *Certified Pre-Owned*. |
| Lee Christensen | SpecterOps | ADCS; *Certified Pre-Owned* co-author. |
| Benjamin Delpy | n/a | mimikatz; Kerberos abuse. |
| Dirk-jan Mollema | Outsider Security | Entra ID / hybrid identity; ROADtools. |
| Adam Chester ("xpn") | TrustedSec | Token / Kerberos / EDR-evasion writeups. |
| Andy Robbins | SpecterOps | BloodHound co-creator; AzureHound. |
| Daniel Heinsen | SpecterOps | BloodHound; ADCS attacks. |

---

## Web / application security

| Researcher | Areas |
|------------|-------|
| James Kettle | Web protocol attacks (HTTP request smuggling, web cache deception). PortSwigger. |
| Orange Tsai | SSRF, web protocol abuse, Exchange ProxyShell. |
| Sam Curry | Bug bounty hunter; auth/auth and identity bugs. |
| Frans Rosén | Detectify; logic and identity bugs. |
| Brett Buerhaus | Web app + auth/auth deep dives. |

---

## Vulnerability research / fuzzing

| Researcher | Areas |
|------------|-------|
| Tavis Ormandy | Project Zero. Cross-domain VR. |
| Natalie Silvanovich | Project Zero. Messaging apps, video conferencing, attack surface reduction. |
| Mateusz Jurczyk ("j00ru") | Windows kernel, font fuzzing, exploit dev. |
| Ned Williamson | Project Zero. Browser sandbox escapes. |
| Ben Hawkes | Formerly Project Zero lead; founded Isosceles. |
| Andy Nguyen ("theflow0") | Game console, IoT, Linux kernel exploitation. |
| Chompie | Bug hunter; Pwn2Own; SIGRed. |
| Sagi Tzadik | Microsoft; SIGRed (CVE-2020-1350). |

---

## Hardware / firmware / embedded

| Researcher | Areas |
|------------|-------|
| Christopher Domas | x86 microarchitecture, processor backdoors, novel ISA tricks. |
| Joe Grand | Hardware reverse engineering. |
| Trammell Hudson | Firmware (UEFI), bootkit research. |
| Travis Goodspeed | Embedded / RF / smart-card. |

---

## Cryptography

| Researcher | Areas |
|------------|-------|
| Daniel J. Bernstein (djb) | Cryptographic primitives, post-quantum. |
| Tanja Lange | Post-quantum cryptography. |
| Filippo Valsorda | Practical applied crypto; Go crypto/x509. |
| Matthew Green | Crypto policy + applied crypto research. |
| Joan Daemen | AES / Keccak / SHA-3 co-designer. |

---

## Wi-Fi / wireless protocols

| Researcher | Affiliation | Areas |
|------------|-------------|-------|
| Mathy Vanhoef | NYU Abu Dhabi / KU Leuven | [KRACK](/wiki/attacks/krack/), [Dragonblood](/wiki/attacks/dragonblood/), [FragAttacks](/wiki/attacks/fragattacks/), [Framing Frames](/wiki/attacks/framing-frames/), [TunnelCrack](/wiki/attacks/tunnelcrack/), [SSID Confusion](/wiki/attacks/ssid-confusion/), [PEAP/IWD bypass](/wiki/attacks/peap-bypass/), [AirSnitch](/wiki/concepts/airsnitch-overview/) — sustained body of Wi-Fi protocol VR. |
| Frank Piessens | KU Leuven | KRACK co-author (CCS 2017); systems security generally. |
| Eyal Ronen | Tel Aviv University | [Dragonblood](/wiki/attacks/dragonblood/) co-author; cryptographic protocol attacks. |
| Domien Schepers | Northeastern | [Framing Frames / MacStealer](/wiki/attacks/framing-frames/) (USENIX'23); [MFP deauthentication](/wiki/attacks/mfp-deauthentication/) (WiSec'22). |
| Aanjhan Ranganathan | Northeastern | Wireless security; co-author on Framing Frames + MFP deauth work. |
| Héloïse Gollier | KU Leuven | [SSID Confusion](/wiki/attacks/ssid-confusion/) (WiSec'24 best paper). |
| Christina Pöpper, Nian Xue, Yashaswi Malla, Zihang Xia | NYU Abu Dhabi | [TunnelCrack](/wiki/attacks/tunnelcrack/) (USENIX'23) — VPN routing-table attacks. |
| Dominique Bongard | 0xcite (CH) | [Pixie Dust](/wiki/attacks/pixie-dust-wps/) — offline WPS PIN recovery (Hack.lu 2014). |
| Mengyuan Zhou, Ang Pu, Yuxuan Liu, Feng Qian, Yuanjie Tan | UC Riverside / KU Leuven | [AirSnitch](/wiki/concepts/airsnitch-overview/) (NDSS'26) co-authors. |
| Srikanth V. Krishnamurthy | UC Riverside | Wireless / network security; AirSnitch co-author. |

---

## Ingest discipline

When you ingest a source by one of these researchers, add a row to this page if missing, and add the source to their entry. Over time this becomes the wiki's *who-knows-what* index.
