---
title: "Microsoft Azure Bounty Program — Scope Notes & Source-Audit Methodology"
permalink: /wiki/resources/azure-bounty-program/
layout: single
author_profile: true
tags:
- resource
- vulnerability-research
- bug-bounty
---

> **Last updated:** 2026-07-02  
> **Related:** [Vulnerability Research (domain)](/wiki/domains/vulnerability-research/), [Integer Overflows](/wiki/techniques/integer_overflows/), [Use After Free](/wiki/techniques/use_after_free/), [Researchers](/wiki/resources/researchers/)  
> **Tags:** `resource`, `bug-bounty`

## Summary

Field notes from VictorV's run at the Microsoft Azure bug-bounty program, focused on the **Azure RTOS** stack (NetX / NetX Duo, ThreadX). The value here is twofold: (1) how program scope shifts under you, and (2) a reusable source-code memory-safety audit methodology that repeatedly paid off across C networking libraries.

---

## Program Scope — Read the Fine Print

- The program covers products listed on the Azure Products page, but binary components (e.g. Azure Site Recovery, Azure Defender for IoT) sit in a **gray area** — confirm in writing before investing. The author emailed `bounty@microsoft.com` and got confirmation that **Azure RTOS NetX and NetX Duo were in-scope** before submitting.
- **Scope contracts over time.** Microsoft added open-source components to the **out-of-scope** list on **2023-12-20** and re-emphasised it on **2024-08-05**, substantially reducing what gets paid. Re-check scope each engagement; a target that paid last quarter may be excluded now.

---

## Findings (Azure RTOS)

| Finding | Component | Bug class |
|---|---|---|
| ICMP off-by-one | NetX checksum on fragmented IP with odd length | 1-byte OOB write past packet buffer → corruption → RCE |
| 12× SNMP bugs | Azure RTOS SNMP addon | improper length validation in variable parsing → buffer overflow / RCE |
| FTP double-free | FTP `QUIT` command | pointer not nulled after packet release → double-free (multi-threaded race) |
| 7× UDP UAF | `nxd_udp_socket_send()` ownership confusion | callee may release the packet; callers double-free in error paths |
| AMQP integer overflow | binary decode (uamqp) | 32-bit length overflow → zero-length alloc → heap corruption |

The AMQP bug was **"one fish, three catches"**: the same incomplete patch existed across `azure-uamqp-c`, `Azure-sdk-for-cpp`, and `azure-uamqp-python`.

---

## Reusable Methodology

The recurring, systematic patterns that surfaced these bugs:

1. **Release-point auditing** — grep the tree for `(delete|destroy|free|release)` (excluding tests) and inspect every release site.
2. **Pointer-nullification verification** — confirm each released pointer is zeroed; a non-nulled pointer is a double-free/UAF candidate (the FTP/UDP bugs).
3. **Multi-release detection** — hunt duplicate release paths in error-handling branches.
4. **Length-math divergence** — look for size increments that don't match the matching decrements (the SNMP and AMQP bugs); these become [integer overflows](/wiki/techniques/integer_overflows/) and OOB.
5. **Cross-project patch-sync** — when a bug is fixed in one project, check every project that vendored/derived the same code; patches often don't propagate (the AMQP triple).

**Strategic lessons:** exhaust high-value targets rather than skimming many; build systematic techniques instead of ad-hoc reading; and test the marginal/gray-area targets — a borderline submission costs nothing to try.

---

## References

- VictorV (@V-V), "掌控微软Azure赏金计划 (Mastering the Microsoft Azure Bounty Program)", v-v.space, 2025-02-18 — <https://v-v.space/2025/02/18/Azure-bounty-program-research/>
- Microsoft Azure Bounty Program — <https://www.microsoft.com/en-us/msrc/bounty-microsoft-azure>
