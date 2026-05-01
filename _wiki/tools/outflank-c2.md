---
title: "Outflank C2"
permalink: /wiki/tools/outflank-c2/
layout: single
author_profile: true
tags:
  - tool
  - c2
  - outflank-c2
  - red-team
  - outflank
---

*Outflank's commercial C2 framework, released August 2024. Cross-platform (Windows, macOS, Linux) implants, designed-for-evasion architecture, ships as part of OST.*

**Status:** drafting
**Related:** [External C2](/wiki/concepts/external-c2/), [Command and Control](/wiki/concepts/command-and-control/), [OST](/wiki/tools/ost/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## Background

Outflank's tooling story walked through three phases:

1. **2017–2020** — open-source / blog-driven. Cobalt Strike External C2 transports, RedELK, Evil Clippy. Outflank as an authority on Cobalt Strike tradecraft.
2. **2021** — *Outflank Security Tooling* (OST) commercial bundle. Curated red-team toolkit; not a C2 yet.
3. **2024** — Outflank C2. A first-party C2, not a Cobalt Strike-Beacon-tunnel.

The launch post (Marc Smeets, 2024-08-07) frames the rationale: Cobalt Strike Beacon is excellent on Windows but limited cross-platform; Mythic is excellent cross-platform but operationally heavier; Outflank C2 fills the gap with a single framework that handles all three platforms with first-class evasion.

## Implants

Three platforms, all from one implant codebase with platform-specific shims:

| Platform | Notes |
|---|---|
| Windows | The deepest evasion story — leverages Outflank's accumulated tradecraft (direct syscalls, AMSI / ETW patching, COM-object-based persistence, BOF support à la Cobalt Strike). |
| macOS | macOS-native implant. Uses Mach-O specific tradecraft — task ports, DYLD techniques, and (per Kyle Avery's macOS-JIT work) JIT-region payload staging. |
| Linux | ELF implant. Operationally less hostile than Windows but Outflank pairs it with seccomp-notify-aware tradecraft. |

A single operator console runs all three implant types side-by-side. The protocol is platform-agnostic; only the implant's local primitives differ.

## Architecture

Standard modern-C2 layout:

- **Team server** holds operator state, task queues, file uploads.
- **Implants** poll over HTTP/HTTPS / DNS / custom transports.
- **Redirectors** (Apache / Nginx / HAProxy) front the team server.
- **Operator console** — a desktop client, single source of truth for the engagement.
- **Logging integrated with [RedELK](/wiki/tools/redelk/)** out of the box.

The transport layer is pluggable — implants can speak HTTPS to a redirector, or be configured to use [External C2](/wiki/concepts/external-c2/)-style alternative carriers.

## What's notable for VR / detection engineers

Worth studying for anyone building EDR / threat-hunting capability:

- **Native unhooking and direct syscalls** baked into Windows implant.
- **Cross-platform AMSI-equivalent silencing** — Outflank C2 silences the Windows AMSI / ETW path *and* the macOS / Linux equivalents (XPC telemetry on macOS, audit subsystem on Linux).
- **Memory hygiene** — implants keep payloads in JIT or enclave memory (where possible) to dodge memory scanners.
- **Operator-side OPSEC** — RedELK integration means defender-probe detection is built-in.

## Licensing

Commercial. Available through Fortra / Outflank's OST channel; not redistributed publicly.

## See also

- [External C2](/wiki/concepts/external-c2/) — the older Outflank-influenced C2 transport spec.
- [OST](/wiki/tools/ost/) — the bundle.
- [RedELK](/wiki/tools/redelk/) — the logging layer.
- [Command and Control](/wiki/concepts/command-and-control/) — the umbrella.

## References

- Outflank — Marc Smeets — *Introducing Outflank C2 with Implant Support for Windows, macOS, and Linux* (2024-08-07) — <https://www.outflank.nl/blog/2024/08/07/introducing-outflank-c2-with-implant-support-for-windows-macos-and-linux/>
- Outflank — *2024 Wrapped* (2024-12-17) — year-end coverage.
