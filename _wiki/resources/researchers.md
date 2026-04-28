---
title: "Researchers"
permalink: /wiki/resources/researchers/
layout: single
author_profile: true
tags:
  - resources
sidebar:
  nav: "wiki"
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

## Ingest discipline

When you ingest a source by one of these researchers, add a row to this page if missing, and add the source to their entry. Over time this becomes the wiki's *who-knows-what* index.
