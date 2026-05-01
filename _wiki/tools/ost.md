---
title: "OST — Outflank Security Tooling"
permalink: /wiki/tools/ost/
layout: single
author_profile: true
tags:
  - tool
  - ost
  - red-team
  - cobalt-strike
  - outflank
---

*Outflank's commercial red-team toolkit. A curated bundle of evasion primitives, BOFs, Cobalt Strike Aggressor scripts, EDR-tradecraft components, payloads, and infrastructure tooling — sold as a subscription and updated regularly. Originally launched 2021; expanded 2022–2026 alongside Outflank's acquisition by Fortra and the addition of Outflank C2.*

**Status:** drafting
**Related:** [Outflank C2](/wiki/tools/outflank-c2/), [RedELK](/wiki/tools/redelk/), [Evil Clippy](/wiki/tools/evil-clippy/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What's in it

OST is a curated set of tooling rather than a single product. Major components as of 2026:

| Component | What |
|---|---|
| **BOFs** | A library of Beacon Object Files for Cobalt Strike (and increasingly Mythic / Outflank C2) — process injection, lateral movement, AD recon, file ops, privilege checks, EDR-tradecraft helpers. Linted via Outflank's BOF-linter. |
| **Aggressor scripts** | Cobalt Strike workflow automations — operator UI improvements, scripted attack chains. |
| **Payload generators** | Stager / Beacon shellcode generators with stomping / encoding pipelines. Supports VBA / XLM / SYLK / VSTO / LNK / HTML-smuggling outputs. |
| **EDR tradecraft module** | Direct syscalls, AMSI/ETW silencing, unhooking, secure-enclave hosting, early-cascade injection — Outflank's accumulated Windows EDR-evasion tradecraft, ready-to-use. |
| **PowerShell tradecraft** | Constrained-Language-Mode bypasses, AMSI bypass for PowerShell, runspace tradecraft. |
| **Office tradecraft** | Successor to *Evil Clippy*. Modern Office maldoc generation (XLM, SYLK, VSTO, fields, macro-equivalent paths). |
| **Outflank C2** | Cross-platform first-party C2. See [Outflank C2](/wiki/tools/outflank-c2/). |
| **RedELK** | Log aggregation / blue-team-detection. See [RedELK](/wiki/tools/redelk/). Open-source, but pre-integrated. |
| **Presets** | Engagement-shaped configurations — vertical-specific evasion profiles, sandbox profiles, specific-EDR-targeting presets. |

## Release cadence

Quarterly-ish. Each release ships:

- New BOFs / tradecraft for techniques disclosed since the last release.
- Updates to existing components for new Office / Windows versions.
- Detection-aware adjustments — e.g. when Defender ships a new AMSI provider or ETW source, OST releases the bypass.

Outflank publishes release-blog posts (e.g. 2024-04-29 *OST Release Blog: EDR Tradecraft, Presets, PowerShell Tradecraft*; 2024-12-17 *2024 Wrapped*).

## Why it matters

OST is the commercial peer of:

- **Cobalt Strike** itself — and now bundled within Fortra's portfolio after the 2022 acquisition.
- **Brute Ratel C4**.
- **Mythic / Apollo / Athena** (open-source, community-maintained).
- **Sliver** (open-source).

The OST proposition is "pre-integrated tradecraft": rather than each red team rolling their own syscall pipeline, AMSI patcher, BOF library, and macro generator, OST ships it as a kit, vetted by Outflank.

For VR / detection engineers, the blog posts that accompany OST releases are the public window into what current commercial offensive tradecraft looks like.

## Licensing

Commercial subscription, vetted-customer-only. Not publicly redistributable.

## See also

- [Outflank C2](/wiki/tools/outflank-c2/), [RedELK](/wiki/tools/redelk/), [Evil Clippy](/wiki/tools/evil-clippy/) — bundled / sibling components.
- [Cobalt Strike](/wiki/tools/cobalt-strike/) — adjacent commercial C2.
- [Outflank blog catalogue](/wiki/resources/outflank/) — release notes ride here.

## References

- Outflank — Marc Smeets — *Our reasoning for Outflank Security Tooling* (2021-04-02) — <https://www.outflank.nl/blog/2021/04/02/our-reasoning-for-outflank-security-tooling/>
- Outflank — Pieter Ceelen — *Cobalt Strike and Outflank Security Tooling: Friends in Evasive Places* (2023-07-19).
- Outflank — *OST Release Blog: EDR Tradecraft, Presets, PowerShell Tradecraft, and More* (2024-04-29).
- Outflank — *2024 Wrapped: Outflank's Top Tracks* (2024-12-17).
