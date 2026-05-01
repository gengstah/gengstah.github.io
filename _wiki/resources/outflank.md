---
title: "Outflank — Blog Catalogue"
permalink: /wiki/resources/outflank/
layout: single
author_profile: true
tags:
  - resources
  - outflank
  - cobalt-strike
  - red-teaming
---

*Outflank is a Dutch offensive-security firm (since 2017, acquired by Fortra in 2022) that publishes consistently high-signal research on Cobalt Strike tradecraft, Office maldoc tradecraft, EDR evasion, BOFs, kernel-mode tradecraft, and the C2 / RedELK ecosystem they ship as Outflank Security Tooling (OST). This page is the running index of every Outflank blog post — newest first, with the topic of each.*

**Status:** drafting
**Related:** [Researchers](/wiki/resources/researchers/), [Reading List](/wiki/resources/reading-list/), [OST](/wiki/tools/ost/), [Outflank C2](/wiki/tools/outflank-c2/), [RedELK](/wiki/tools/redelk/)

---

## Why this page

Most of the things Outflank writes about are *not* one-shot disclosures — they're durable tradecraft (HTML smuggling, External C2, AMSI for VBA, Excel 4 macros, Mark-of-the-Web bypasses, EDR unhooking) that have shaped red-team practice for years. The blog index goes back to 2017; entries thread into many of the tooling and technique pages elsewhere in this wiki.

Authors:

- **Marc Smeets** — Outflank co-founder; RedELK; OST direction; year-end retros.
- **Pieter Ceelen** — Office maldoc tradecraft; AMSI VBA; macro detection.
- **Stan Hegt** — Office maldoc tradecraft (XLM, SYLK, Visual Studio); Cobalt Strike.
- **Cornelis de Plaa** — direct syscalls, sRDI, AD recon via ADSI, advanced process monitoring.
- **Mark Bergman** — Cobalt Strike External C2; DoH C2.
- **Cedric Van Bockhaven** — secure enclaves (VBS), BOF linting, Superfetch internals, named-pipe enumeration, GrimResource (MSC).
- **Dima van de Wouw** — Async BOFs, EDR unhooking, Early Cascade Injection, VSTO-signed phishing.
- **Kyle Avery** — EDR internals (macOS / Linux), unmanaged .NET patching, LLM-assisted offensive R&D, macOS JIT, seccomp-notifier injection.
- **Mariusz Banach** — Red Macros Factory (joined 2026).
- **Daniel Duggan ("RastaMouse")** — Zero-Point Security training (joined 2026 via Fortra).
- **Ksawery Czapczyński** — kernel-mode tradecraft (PatchGuard Peekaboo).
- **Jarno** — honeypots vs red teams.

Counts as of 2026-05-01: **53 posts**, 14 Sep 2017 → 02 Apr 2026.

---

## 2026

| Date | Author | Title | Topic |
|---|---|---|---|
| 2026-04-02 | Daniel Duggan | [New Mouse in the House: Zero-Point Security Training Joins the Fortra Family](https://www.outflank.nl/blog/2026/04/02/new-mouse-in-the-house-zero-point-security-training-joins-the-fortra-family/) | RastaMouse / Zero-Point Security (CRTO) joins Fortra/Outflank for offensive-security training. |
| 2026-03-26 | Stan | [Introducing Cobalt Strike Research Labs](https://www.outflank.nl/blog/2026/03/26/introducing-cobalt-strike-research-labs/) | Cobalt Strike Research Labs initiative within Fortra/Outflank. |
| 2026-02-19 | Kyle Avery | [macOS JIT Memory](https://www.outflank.nl/blog/2026/02/19/macos-jit-memory/) | Abusing macOS JIT memory regions for offensive code execution. See [macOS JIT shellcode](/wiki/concepts/macos-jit-shellcode/). |
| 2026-01-21 | Mariusz Banach | [Red Macros Factory Is Joining OST (And So Am I!)](https://www.outflank.nl/blog/2026/01/21/red-macros-factory-is-joining-ost-and-so-am-i/) | Mariusz Banach + his Red Macros Factory tooling join OST. |
| 2026-01-07 | Ksawery Czapczyński | [PatchGuard Peekaboo: Hiding Processes on Systems with PatchGuard in 2026](https://www.outflank.nl/blog/2026/01/07/patchguard-peekaboo-hiding-processes-on-systems-with-patchguard-in-2026/) | Hiding processes on PatchGuard-protected Windows kernels. |

## 2025

| Date | Author | Title | Topic |
|---|---|---|---|
| 2025-12-09 | Kyle Avery | [Linux Process Injection via Seccomp Notifier](https://www.outflank.nl/blog/2025/12/09/seccomp-notify-injection/) | Linux injection via the seccomp notifier mechanism. See [Seccomp-notifier injection](/wiki/techniques/seccomp-notify-injection/). |
| 2025-08-07 | Kyle Avery | [Training Specialist Models: Automating Malware Development](https://www.outflank.nl/blog/2025/08/07/training-specialist-models/) | Training specialist LLMs for malware-dev automation. |
| 2025-07-29 | Kyle Avery | [Accelerating Offensive R&D with Large Language Models](https://www.outflank.nl/blog/2025/07/29/accelerating-offensive-research-with-llm/) | LLMs for offensive R&D. |
| 2025-07-16 | Dima van de Wouw | [Async BOFs – "Wake Me Up, Before You Go Go"](https://www.outflank.nl/blog/2025/07/16/async-bofs-wake-me-up-before-you-go-go/) | Asynchronous Beacon Object Files for long-running tasks. See [BOFs](/wiki/concepts/beacon-object-files/). |
| 2025-06-30 | Cedric Van Bockhaven | [BOF Linting for Accelerated Development](https://www.outflank.nl/blog/2025/06/30/bof-linting-for-accelerated-development/) | BOF linter for development. |
| 2025-06-16 | Cedric Van Bockhaven | [Secure Enclaves for Offensive Operations (Part II)](https://www.outflank.nl/blog/2025/06/16/secure-enclaves-for-offensive-operations-part-ii/) | VBS / secure enclaves for offensive payloads. See [Secure enclaves for offensive ops](/wiki/concepts/secure-enclaves-offensive/). |
| 2025-02-03 | Cedric Van Bockhaven | [Secure Enclaves for Offensive Operations (Part I)](https://www.outflank.nl/blog/2025/02/03/secure-enclaves-for-offensive-operations-part-i/) | Introducing secure enclaves as offensive primitive. |

## 2024

| Date | Author | Title | Topic |
|---|---|---|---|
| 2024-12-17 | Marc Smeets | [2024 Wrapped: Outflank's Top Tracks](https://www.outflank.nl/blog/2024/12/17/2024-wrapped-outflanks-top-tracks/) | 2024 year-in-review of research and OST releases. |
| 2024-10-15 | Dima van de Wouw | [Introducing Early Cascade Injection](https://www.outflank.nl/blog/2024/10/15/introducing-early-cascade-injection-from-windows-process-creation-to-stealthy-injection/) | Stealthy injection via Windows process creation. See [Early Cascade Injection](/wiki/techniques/early-cascade-injection/). |
| 2024-08-13 | Cedric Van Bockhaven | [Will the real #GrimResource please stand up? – Abusing the MSC file format](https://www.outflank.nl/blog/2024/08/13/will-the-real-grimresource-please-stand-up-abusing-the-msc-file-format/) | MSC (Microsoft Saved Console) file abuse. See [GrimResource (MSC)](/wiki/concepts/grimresource-msc/). |
| 2024-08-07 | Marc Smeets | [Introducing Outflank C2](https://www.outflank.nl/blog/2024/08/07/introducing-outflank-c2-with-implant-support-for-windows-macos-and-linux/) | Outflank C2 with cross-platform implants. See [Outflank C2](/wiki/tools/outflank-c2/). |
| 2024-06-03 | Kyle Avery | [EDR Internals for macOS and Linux](https://www.outflank.nl/blog/2024/06/03/edr-internals-macos-linux/) | How EDR products instrument macOS / Linux. |
| 2024-04-29 | Marc Smeets | [OST Release Blog: EDR Tradecraft, Presets, PowerShell Tradecraft, and More](https://www.outflank.nl/blog/2024/04/29/ost-release-blog-edr-tradecraft-presets-powershell-tradecraft-and-more/) | OST release notes. See [OST](/wiki/tools/ost/). |
| 2024-02-01 | Kyle Avery | [Unmanaged .NET Patching](https://www.outflank.nl/blog/2024/02/01/unmanaged-dotnet-patching/) | Patching the .NET runtime to bypass AMSI/ETW. See [AMSI bypass](/wiki/techniques/amsi-bypass/). |

## 2023

| Date | Author | Title | Topic |
|---|---|---|---|
| 2023-12-19 | Marc Smeets | [Free Training: Microsoft Office Offensive Tradecraft for Red Teamers](https://www.outflank.nl/blog/2023/12/19/free-training-microsoft-office-offensive-tradecraft-for-red-teamers/) | Free Office offensive tradecraft training. |
| 2023-12-14 | Cedric Van Bockhaven | [Mapping Virtual to Physical Addresses Using Superfetch](https://www.outflank.nl/blog/2023/12/14/mapping-virtual-to-physical-adresses-using-superfetch/) | VA → PA mapping via the Superfetch API. |
| 2023-11-06 | Marc Smeets | [Reflecting on a Year with Fortra and Next Steps for Outflank](https://www.outflank.nl/blog/2023/11/06/reflecting-on-a-year-with-fortra-and-next-steps-for-outflank/) | Year-after-Fortra retrospective. |
| 2023-10-19 | Cedric Van Bockhaven | [Listing remote named pipes](https://www.outflank.nl/blog/2023/10/19/listing-remote-named-pipes/) | Remote named-pipe enumeration. |
| 2023-10-05 | Dima van de Wouw | [Solving The "Unhooking" Problem](https://www.outflank.nl/blog/2023/10/05/solving-the-unhooking-problem/) | Robust EDR userland unhooking. See [EDR unhooking](/wiki/techniques/edr-unhooking/). |
| 2023-07-19 | Pieter Ceelen | [Cobalt Strike and Outflank Security Tooling: Friends in Evasive Places](https://www.outflank.nl/blog/2023/07/19/cobalt-strike-and-outflank-security-tooling-friends-in-evasive-places/) | OST + Cobalt Strike integration. |
| 2023-04-25 | Pieter Ceelen | [So you think you can block Macros?](https://www.outflank.nl/blog/2023/04/25/so-you-think-you-can-block-macros/) | Bypassing Office macro blocking (MotW). See [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) and [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/). |
| 2023-03-28 | Stan | [Attacking Visual Studio for Initial Access](https://www.outflank.nl/blog/2023/03/28/attacking-visual-studio-for-initial-access/) | Visual Studio project files for initial-access RCE. |

## 2022

| Date | Author | Title | Topic |
|---|---|---|---|
| 2022-01-07 | Dima van de Wouw | [A phishing document signed by Microsoft – part 2](https://www.outflank.nl/blog/2022/01/07/a-phishing-document-signed-by-microsoft-part-2/) | VSTO-signed maldoc, part 2. See [VSTO-signed phishing](/wiki/concepts/vsto-phishing/). |

## 2021

| Date | Author | Title | Topic |
|---|---|---|---|
| 2021-12-09 | Dima van de Wouw | [A phishing document signed by Microsoft – part 1](https://www.outflank.nl/blog/2021/12/09/a-phishing-document-signed-by-microsoft/) | Weaponising Microsoft-signed VSTO add-ins for phishing. |
| 2021-04-02 | Marc Smeets | [Our reasoning for Outflank Security Tooling](https://www.outflank.nl/blog/2021/04/02/our-reasoning-for-outflank-security-tooling/) | Why OST exists. |
| 2021-03-03 | Jarno | [Catching red teams with honeypots part 1: local recon](https://www.outflank.nl/blog/2021/03/03/catching-red-teams-with-honeypots-part-1-local-recon/) | Honeypots for detecting red-team local recon. |

## 2020

| Date | Author | Title | Topic |
|---|---|---|---|
| 2020-12-26 | Cornelis | [Direct Syscalls in Beacon Object Files](https://www.outflank.nl/blog/2020/12/26/direct-syscalls-in-beacon-object-files/) | Direct syscalls inside Cobalt Strike BOFs. |
| 2020-04-07 | Marc Smeets | [RedELK Part 3 – Achieving operational oversight](https://www.outflank.nl/blog/2020/04/07/redelk-part-3-achieving-operational-oversight/) | RedELK ops oversight + IOC detection. See [RedELK](/wiki/tools/redelk/). |
| 2020-03-30 | Stan | [Mark-of-the-Web from a Red Team's Perspective](https://www.outflank.nl/blog/2020/03/30/mark-of-the-web-from-a-red-teams-perspective/) | Red-team perspective on MotW. |
| 2020-03-11 | Cornelis | [Red Team Tactics: Advanced process monitoring](https://www.outflank.nl/blog/2020/03/11/red-team-tactics-advanced-process-monitoring-techniques-in-offensive-operations/) | PPL / Protected Processes for offensive ops. |
| 2020-02-28 | Marc Smeets | [RedELK Part 2 – getting you up and running](https://www.outflank.nl/blog/2020/02/28/redelk-part-2-getting-you-up-and-running/) | RedELK install + config. |

## 2019

| Date | Author | Title | Topic |
|---|---|---|---|
| 2019-10-30 | Stan | [Abusing the SYLK file format](https://www.outflank.nl/blog/2019/10/30/abusing-the-sylk-file-format/) | SYLK weaponisation for Excel RCE. See [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/). |
| 2019-10-20 | Cornelis | [Red Team Tactics: AD Recon using ADSI and Reflective DLLs](https://www.outflank.nl/blog/2019/10/20/red-team-tactics-active-directory-recon-using-adsi-and-reflective-dlls/) | AD recon via ADSI APIs + reflective DLL. |
| 2019-06-19 | Cornelis | [Red Team Tactics: Combining Direct System Calls and sRDI to bypass AV/EDR](https://www.outflank.nl/blog/2019/06/19/red-team-tactics-combining-direct-system-calls-and-srdi-to-bypass-av-edr/) | Direct syscalls + sRDI. |
| 2019-05-05 | Stan | [Evil Clippy: MS Office maldoc assistant](https://www.outflank.nl/blog/2019/05/05/evil-clippy-ms-office-maldoc-assistant/) | Evil Clippy maldoc tool. See [Evil Clippy](/wiki/tools/evil-clippy/). |
| 2019-04-17 | Pieter Ceelen | [Bypassing AMSI for VBA](https://www.outflank.nl/blog/2019/04/17/bypassing-amsi-for-vba/) | AMSI for VBA bypass. See [AMSI bypass](/wiki/techniques/amsi-bypass/). |
| 2019-04-02 | Pieter Ceelen | [MS Word field abuse](https://www.outflank.nl/blog/2019/04/02/ms-word-field-abuse/) | INCLUDEPICTURE etc. for phishing / RCE. |
| 2019-02-14 | Marc Smeets | [Introducing RedELK – Part 1: why we need it](https://www.outflank.nl/blog/2019/02/14/introducing-redelk-part-1-why-we-need-it/) | RedELK motivation. |

## 2018

| Date | Author | Title | Topic |
|---|---|---|---|
| 2018-10-28 | Stan | [Recordings of our DerbyCon and BruCON presentations](https://www.outflank.nl/blog/2018/10/28/recordings-of-our-derbycon-and-brucon-presentations/) | Talk recordings. |
| 2018-10-25 | Mark Bergman | [Building resilient C2 infrastructures using DoH](https://www.outflank.nl/blog/2018/10/25/building-resilient-c2-infrastructues-using-dns-over-https/) | DoH C2 resilience. |
| 2018-10-12 | Pieter Ceelen | [Sylk + XLM = Code execution on Office 2011 for Mac](https://www.outflank.nl/blog/2018/10/12/sylk-xlm-code-execution-on-office-2011-for-mac/) | SYLK + XLM RCE on Mac Office. |
| 2018-10-06 | Stan | [Old school: evil Excel 4.0 macros (XLM)](https://www.outflank.nl/blog/2018/10/06/old-school-evil-excel-4-0-macros-xlm/) | Reviving XLM macros as stealthy maldoc. |
| 2018-08-14 | Stan | [HTML smuggling explained](https://www.outflank.nl/blog/2018/08/14/html-smuggling-explained/) | Foundational HTML-smuggling explainer. See [HTML smuggling](/wiki/concepts/html-smuggling/). |
| 2018-03-30 | Marc Smeets | [Automated AD and Windows test lab deployments with Invoke-ADLabDeployer](https://www.outflank.nl/blog/2018/03/30/automated-ad-and-windows-test-lab-deployments-with-invoke-adlabdeployer/) | Invoke-ADLabDeployer test-lab automation. |
| 2018-01-23 | Marc Smeets | [Public password dumps in ELK](https://www.outflank.nl/blog/2018/01/23/public-password-dumps-in-elk/) | Indexing breach dumps in ELK. |
| 2018-01-16 | Pieter Ceelen | [Hunting for evil: detect macros being executed](https://www.outflank.nl/blog/2018/01/16/hunting-for-evil-detect-macros-being-executed/) | Detection of macro execution (defender side). |

## 2017

| Date | Author | Title | Topic |
|---|---|---|---|
| 2017-09-17 | Mark Bergman | [Cobalt Strike over external C2](https://www.outflank.nl/blog/2017/09/17/blogpost-cobalt-strike-over-external-c2-beacon-home-in-the-most-obscure-ways/) | External C2 for Cobalt Strike (Outlook tunnelling). See [External C2](/wiki/concepts/external-c2/). |
| 2017-09-14 | Mark Bergman | [Harakiri – exploitation of a mail handler](https://www.outflank.nl/blog/2017/09/14/harakiri-exploitation-of-a-mail-handler/) | Mail-handler service exploitation (Harakiri). |

---

## How this thread into the wiki

| Wiki page | Outflank posts that fed it |
|---|---|
| [HTML smuggling](/wiki/concepts/html-smuggling/) | 2018-08-14 *HTML smuggling explained*. |
| [Mark-of-the-Web](/wiki/concepts/mark-of-the-web/) | 2020-03-30, 2023-04-25. |
| [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) | 2018-10-06 (XLM), 2018-10-12 (SYLK + XLM Mac), 2019-04-02 (Word fields), 2019-04-17 (AMSI VBA), 2019-05-05 (Evil Clippy), 2019-10-30 (SYLK), 2023-04-25 (block-macros bypass). |
| [VSTO-signed phishing](/wiki/concepts/vsto-phishing/) | 2021-12-09, 2022-01-07. |
| [GrimResource (MSC)](/wiki/concepts/grimresource-msc/) | 2024-08-13. |
| [External C2](/wiki/concepts/external-c2/) | 2017-09-17. |
| [Secure enclaves for offensive ops](/wiki/concepts/secure-enclaves-offensive/) | 2025-02-03 (Pt I), 2025-06-16 (Pt II). |
| [AMSI bypass](/wiki/techniques/amsi-bypass/) | 2019-04-17 (AMSI VBA), 2024-02-01 (Unmanaged .NET patching). |
| [EDR unhooking](/wiki/techniques/edr-unhooking/) | 2019-06-19 (direct syscalls + sRDI), 2020-12-26 (direct syscalls in BOFs), 2023-10-05 (unhooking solved). |
| [Early Cascade Injection](/wiki/techniques/early-cascade-injection/) | 2024-10-15. |
| [Seccomp-notifier injection](/wiki/techniques/seccomp-notify-injection/) | 2025-12-09. |
| [BOFs](/wiki/concepts/beacon-object-files/) | 2020-12-26, 2025-06-30 (linting), 2025-07-16 (Async BOFs). |
| [RedELK](/wiki/tools/redelk/) | 2019-02-14 (Pt 1), 2020-02-28 (Pt 2), 2020-04-07 (Pt 3). |
| [Evil Clippy](/wiki/tools/evil-clippy/) | 2019-05-05. |
| [Outflank C2](/wiki/tools/outflank-c2/) | 2024-08-07. |
| [OST (Outflank Security Tooling)](/wiki/tools/ost/) | 2021-04-02, 2023-07-19, 2024-04-29, 2024-12-17. |

## See also

- [Researchers](/wiki/resources/researchers/) — including new Outflank entries.
- [OST](/wiki/tools/ost/), [RedELK](/wiki/tools/redelk/), [Outflank C2](/wiki/tools/outflank-c2/), [Evil Clippy](/wiki/tools/evil-clippy/).
