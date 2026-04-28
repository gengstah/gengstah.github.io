---
title: "Cobalt Strike"
permalink: /wiki/tools/cobalt-strike/
layout: single
author_profile: true
tags:
  - red-team
  - tool
sidebar:
  nav: "wiki"
---

*The dominant commercial adversary-emulation / C2 platform.*

**Status:** seed
**Related:** [Red Teaming](/wiki/domains/red-teaming/), [OPSEC](/wiki/concepts/opsec/), [Lateral Movement](/wiki/techniques/lateral-movement/), [Persistence](/wiki/techniques/persistence/)

---

## What it is

Cobalt Strike (Fortra, originally Strategic Cyber LLC, written by Raphael Mudge) is a paid red-team platform that combines:

- **Team Server** — multi-operator collaboration server.
- **Beacon** — the implant. HTTP, HTTPS, DNS, SMB pipe, TCP listeners.
- **Aggressor Script** — Sleep-based scripting language for automation, custom commands, UI hooks.
- **Malleable C2** — profile language for shaping beacon traffic to look like specific applications.
- **BOFs (Beacon Object Files)** — load and execute COFF object files inline in the beacon process. Replaces fork-and-run for many post-ex tasks; vastly quieter.

It's expensive (~$3,500/user/year) and licensed seat-by-seat. Cracked copies are common in criminal use, which is why "Cobalt Strike" routinely appears in ransomware reports.

---

## Why it set the standard

- Mudge's design choices (sleep-with-jitter, malleable C2, stageless beacons, BOFs) became the template every newer C2 copies.
- Aggressor Script makes operator workflow customization trivial.
- The community Cobalt-Strike-flavored tradecraft (Outflank, MDSec, SpecterOps, TrustedSec) is enormous.

---

## Modern usage shape

A typical 2026 red-team engagement using CS:

1. **Profile authoring.** Pick a Malleable C2 profile that matches the target's environment (e.g. mimic Office 365 telemetry traffic if the target uses M365). Build it; sanity-check with `c2lint`.
2. **Infrastructure stand-up.** Team Server behind redirector(s). Domain front / CDN if available. TLS fronting via Let's Encrypt or commercial cert.
3. **Loader.** CS shellcode embedded in a custom loader: encrypted, syscall-based, sleep-mask enabled, anti-debug. Stock CS shellcode is heavily detected; nobody runs it raw anymore.
4. **Initial beacon.** Sleep 60s, jitter 30%. Long initial dwell.
5. **Post-ex via BOFs.** TrustedSec's [SituationalAwarenessBOF](https://github.com/trustedsec/CS-Situational-Awareness-BOF), Outflank's BOFs, custom written for sensitive tasks. `mimikatz` via BOF (e.g. `nanodump`) instead of executing the binary.
6. **Lateral movement.** SMB pipe beacons; spawn-as via `make_token` / `pth`; named-pipe pivots through jump boxes.

---

## Detection

CS beacons are also the most-detected C2 artifact in existence. Defenders look for:

- **Stock named pipes.** `\\.\pipe\msagent_*`, `postex_*`. Random them.
- **Default JA3/JA4** of the bundled JVM HTTP client.
- **Spawnto memory contents** — the `notepad.exe` or `rundll32.exe` host process with no real arguments and unbacked RWX memory.
- **Sleep without obfuscation** — `.text` of beacon visible to memory scanners.
- **Default Malleable C2 profiles** — every public profile is fingerprinted.
- **Sleep mask absence in older versions** (pre-4.7).

Modern operators run with sleep masks (built-in or via [Ekko](https://github.com/Cracked5pider/Ekko) / SilentMoonwalk patterns), random named pipes, custom Malleable C2, custom loaders, and indirect syscalls. *And still get caught regularly.*

---

## Alternatives

If CS isn't an option (cost, license, OPSEC, cracked-copy attribution risk), the active 2026 alternatives:

- **Sliver** (BishopFox) — open-source, Go, mTLS / WireGuard / DNS / HTTPS.
- **Mythic** — modular framework; many community agents (Apollo for .NET, Athena, Poseidon for macOS, Apfell, Medusa).
- **Brute Ratel C4** — commercial, designed against modern EDR; smaller footprint.
- **Havoc** — open-source, modern UI, sleep obfuscation built in.
- **Empire** (BC-Security fork) — long history, PowerShell-heavy, less hot than it was.

---

## References

- Raphael Mudge — *Advanced Threat Tactics* video series (still the best CS reference)
- Cobalt Strike documentation — <https://hstechdocs.helpsystems.com/manuals/cobaltstrike/current/userguide/>
- TrustedSec Aggressor / BOF repos — <https://github.com/trustedsec>
- Outflank blog — sleep-mask, EDR-evasion research targeted at CS users
- Will Schroeder ("harmj0y") — extensive CS-flavored tradecraft on the SpecterOps blog
