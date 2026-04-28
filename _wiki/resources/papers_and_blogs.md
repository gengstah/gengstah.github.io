---
title: Essential Papers, Blog Series & Talks
permalink: /wiki/resources/papers_and_blogs/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- resource
redirect_from:
- /wiki/windows-exploit-research/resources/papers_and_blogs/
---

> **Last updated:** 2026-04-12  
> **Related:** [Researchers](/wiki/resources/researchers-wer/)  
> **Tags:** `kernel-mode`, `user-mode`

## Summary

Curated reading list for becoming a top Windows security researcher. Organized by topic. Items marked ★ are highest priority — read these first.

---

## Kernel Pool / Memory Exploitation

- ★ Tarjei Mandt — "Kernel Pool Exploitation on Windows 7" (Black Hat 2011)
  - Definitive reference for legacy pool exploitation
- ★ Valentina Palmiotti — "Exploiting Windows Kernel Using Segment Heap" (OffensiveCon 2021)
  - Modern pool exploitation strategy post-20H1
- Mark Vincent Yason — "Segment Heap Internals" (Black Hat 2016)
  - Deep internals of the Segment Heap allocator
- SafeBreach Labs — "Pool Party: Abusing Windows Thread Pools" (Black Hat 2023)
  - Novel grooming primitives via thread pool objects

## Windows Kernel Architecture / Internals

- ★ Windows Internals 7th Edition (Russinovich, Solomon, Ionescu) — Part 1 & 2
  - The book. Read all of it.
- Alex Ionescu — "Reversing Windows 8 Kernel Security" (Black Hat 2012)
- Alex Ionescu — "Windows 10 Internals" (various Winsider sessions)
- ntdiff.github.io — Online Windows binary differ across all builds

## win32k Exploitation

- ★ j00ru (Mateusz Jurczyk) — Various win32k CVE write-ups on Project Zero blog
- ★ Connor McGarr — "Exploit Development: Windows Kernel Exploitation" blog series
  - connormcgarr.github.io — comprehensive kernel exploit dev write-ups
- Gynvael Coldwind & j00ru — "Bochspwn Reloaded: Detecting Kernel Memory Disclosure"
  - Systematic kernel info-leak detection methodology

## Exploit Mitigations

- ★ Matt Miller & David Weston — "Mitigations Unplugged" (BlueHat 2014)
- Alex Ionescu — "I Got 99 Problems But a Kernel Pointer Ain't One" (BlueHat 2013)
  - Comprehensive kernel pointer leak survey
- Yuki Chen — "The Exploit Laboratory" (OffensiveCon series)
  - CFG bypass techniques
- "Windows Exploit Guard and Device Guard" — Microsoft white paper

## Hypervisor / VBS Security

- Alex Ionescu — "Battle of the SKM and IUM" (Black Hat 2015)
  - VBS internals, secure kernel
- Peleg Hadar & Tomer Shalev — "Exploiting Hyper-V" (Black Hat 2019)
- Joe Bialek & Nicolas Joly — "A Hypervisor for the Masses" (BlueHat 2019)

## TCP/IP Stack / Network Protocol Exploitation

- ★ Axel "0vercl0k" Souchet — "Reverse-engineering tcpip.sys: mechanics of a packet of the death (CVE-2021-24086)", doar-e.github.io, April 2021
  - Definitive reference for tcpip.sys internals: Packet_t, Reassembly_t, Demuxer dispatch table, NET_BUFFER/MDL mechanics, IPv6 fragmentation implementation. Required reading before any tcpip.sys research.
- ★ Marcus Hutchins — "CVE-2024-38063 - Remotely Exploiting The Kernel Via IPv6", malwaretech.com, August 2024
  - Step-by-step root cause analysis of the 2024 wormable zero-click IPv6 bug: patch diff, IppSendErrorList analysis, packet coalescing mechanics, integer underflow, Ipv6pReassemblyTimeout overflow chain
- Francisco Falcon — "Analysis of a Windows IPv6 Fragmentation Vulnerability: CVE-2021-24086", blog.quarkslab.com, 2021
  - Independent analysis; covers the nested-fragments-within-fragments trick to exceed MTU extension header limit; full PoC included
- Armis Research Team — "From URGENT/11 to Frag/44: Analysis of Critical Vulnerabilities in the Windows TCP/IP Stack", armis.com, April 2021
  - CVE-2021-24094: IPv6 recursive reassembly UAF and firewall bypass via type confusion; demonstrates encapsulating TCP SYN inside ICMPv6 Echo that bypasses perimeter security
- pi3 — "CVE-2020-16898 – Exploiting 'Bad Neighbor' vulnerability", blog.pi3.com.pl, October 2020
  - First public PoC and analysis of the ICMPv6 RDNSS option overflow ("Bad Neighbor")
- chompie1337 (IBM X-Force) — "Dissecting and Exploiting TCP/IP RCE Vulnerability 'EvilESP'", IBM Security Intelligence, 2023
  - CVE-2022-34718: IPv6 fragment inside IPsec ESP → OOB write into NetIoProtocolHeader2; Ghidra+BinExport+BinDiff patch analysis workflow; IPsec SA exploitation context; DoS PoC → RCE path analysis
- Numen Cyber Labs — "TCP/IP Vulnerability CVE-2022-34718 PoC Restoration and Analysis", numencyber.com, 2022
  - Independent PoC restoration; confirms OOB write primitive; NDIS driver approach for raw packet crafting; two patched functions identified
- Kerutt et al. — "Critical Analysis of CVE-2024-38063: The Microsoft IPv6-Vulnerability", HAW Hamburg / Bavarian LSI, 2025
  - Academic analysis with quantitative exploit reliability measurements; NIC coalescing thresholds; patch rollback mechanism analysis

## Race Conditions / TOCTOU

- ★ James Forshaw — "Windows Logical EoP via the Windows Subsystem" (DEF CON 2015)
- James Forshaw — "Digging into a Windows Kernel Privilege Escalation Vulnerability" (Project Zero blog)
- James Forshaw — "symboliclink-testing-tools" (GitHub) — the reference toolkit

## Browser / Scripting Engine Exploitation

- ★ saelo (Samuel Groß) — "Attacking JavaScript Engines" (phrack-style paper, 2016)
- saelo — "Fuzzilli" — JavaScript engine fuzzer (GitHub)
- Lokihardt — Various V8/JScript CVEs on Project Zero

## ROP / Control Flow

- Hovav Shacham — "The Geometry of Innocent Flesh on the Bone: Return-into-libc without Function Calls" (2007)
  - Original ROP paper
- ★ Corelan Team — "Exploit Writing Tutorial" series — corelan.be
  - Best practical exploit development series, starts basic, goes deep
- "ROP is Still Dangerous: Breaking Modern Defenses" — Harvard SEAS

## Fuzzing

- ★ Axel Souchet — "wtf: Snapshot Fuzzer" — github.com/0vercl0k/wtf
  - README + examples are the tutorial
- Schumilo et al. — "kAFL: Hardware-Assisted Feedback Fuzzing for OS Kernels" (USENIX 2017)
- Ivan Fratric — "WinAFL" and browser fuzzing posts (Project Zero)

## Kernel Streaming / Device Driver Attack Surface

- ★ Angelboy (DEVCORE) — "Streaming vulnerabilities from Windows Kernel - Proxying to Kernel - Part I", devco.re, 2024-08-23
  - Proxying to Kernel bug class; CVE-2024-35250 (Pwn2Own 2024); CVE-2024-30084 double fetch; kCFG bypass via RtlSetAllBits
- ★ Angelboy (DEVCORE) — "Streaming vulnerabilities from Windows Kernel - Proxying to Kernel - Part II", devco.re, 2024-10-05 (HEXACON 2024)
  - CVE-2024-30090; arbitrary increment → SeDebugPrivilege LUID modification (novel EoP)
- Angelboy (DEVCORE) — "Frame by Frame, Kernel Streaming Keeps Giving Vulnerabilities", devco.re, 2025-05-17 (OffensiveCon 2025)
  - MDL mismatch; forgotten MDL lock; frame buffer misalignment; LookasideList corruption; CVE-2024-38238, -38245
- ★ chompie1337 (IBM X-Force) — "Critically Close to Zero-Day: Exploiting Microsoft Kernel Streaming Service", IBM Security Intelligence, October 2023 — CVE-2023-36802
  - mskssrv.sys FsContext2 type confusion; FsContextReg/FSStreamReg size mismatch (0x78 vs 0x1D8); ObfDereferenceObject arbitrary decrement → PreviousMode flip; named pipe NonPagedPoolNx spray; secondary thread crash avoidance; ITW CLFS-based exploit path documented
- chompie1337 (IBM X-Force) — "The Little Bug That Could" — CVE-2024-30089
- Synacktiv — "Windows Kernel Security: A Deep Dive into Two Exploits Demonstrated at Pwn2Own" (HITB 2023 HKT) — CVE-2023-29360
- Fritz Sands (ZDI) — "DirectX to the Kernel", zerodayinitiative.com, 2018-12
  - WDDM attack surface; dxgkrnl.sys/dxgmms2.sys type confusion; D3DKMTEscape/Render/CreateAllocation bugs; CVE-2018-8405/8406/8400/8401
- ChenNan & RanchoIce (Tencent ZhanluLab) — "Gaining Remote System: Subverting The DirectX Kernel", 44CON 2018
- Ilja van Sprundel (IOActive) — "Windows Kernel Graphics Driver Attack Surface", Black Hat USA 2014
  - Comprehensive WDDM attack surface overview; still highly relevant for hunting new DirectX bugs

## IO Manager / Filter Driver Bug Classes

- ★ James Forshaw (Project Zero) — "Windows Kernel Logic Bug Class: Access Mode Mismatch in IO Manager", projectzero.google, 2019-03
  - PreviousMode mechanics; INPC/IFAC/OFAC flags; Initiator+Receiver model; SMBv2, NPFS, WS2IFSL examples; CVE-2018-0749
- ★ James Forshaw (Project Zero) — "Hunting for Bugs in Windows Mini-Filter Drivers", projectzero.google, 2021-01
  - Mini-filter architecture; RequestorMode bugs; altitude sickness; concurrency/reentrancy; IO operation mismatch; CVE-2020-17139 (WOF)

## I/O Ring Exploitation

- ★ Yarden Shafir (Windows Internals) — "One I/O Ring to Rule Them All: A Full Read/Write Exploit Primitive on Windows 11", windows-internals.com, 2022-07-05 (TyphoonCon 2022)
  - Original publication of IoRing RegBuffers exploit primitive; arbitrary write/increment → full AAR/AAW; Win11 22H2+; Linux io_uring comparison

## CVE Analysis Series (Essential Reading)

- Boris Larin (Kaspersky GReAT) — CVE-2021-31956 (NTFS pool overflow) analysis
- CrowdStrike — CVE-2021-1732 (win32k UAF) analysis
- SentinelOne — Kernel UAF exploitation series
- Project Zero issue tracker — every issue has a detailed root cause analysis

---

## Recommended Reading Order (Beginner to Expert)

### Stage 1 — Foundations
1. Windows Internals Pt. 1 Ch. 1-5 (processes, threads, memory)
2. Corelan exploit writing tutorials 1-9
3. "Exploit Writing for Beginners" (phrack) 

### Stage 2 — Kernel Fundamentals
4. Windows Internals Pt. 2 (I/O, security, registry)
5. Tarjei Mandt's pool exploitation paper
6. Alex Ionescu BlueHat 2013 (kernel pointer leaks)
7. Connor McGarr's kernel exploitation blog series

### Stage 3 — Modern Techniques
8. Valentina Palmiotti's Segment Heap talk
9. James Forshaw's TOCTOU papers
10. saelo's attacking JS engines paper

### Stage 4 — Cutting Edge
11. Project Zero issues (current year)
12. OffensiveCon talks (current year)
13. Actively reproduce and extend recent CVE exploits

---

## References
- All papers findable via: papers.put.as, Black Hat archives, USENIX papers
- Conference archives: defcon.org/media, i.blackhat.com, offensivecon.org
