---
title: "OPSEC"
permalink: /wiki/concepts/opsec/
layout: single
author_profile: true
tags:
  - opsec
  - red-team
sidebar:
  nav: "wiki"
---

*Operational security — keeping the operator's signature below the defender's noise floor.*

**Status:** seed
**Related:** [Red Teaming](/wiki/domains/red-teaming/), [Initial Access](/wiki/techniques/initial-access/), [Lateral Movement](/wiki/techniques/lateral-movement/), [Persistence](/wiki/techniques/persistence/), [Cobalt Strike](/wiki/tools/cobalt-strike/)

{% include toc %}

---

## The premise

Every action you take leaves traces — a process, a parent-child relationship, a network connection, a file artifact, a registry change, a log entry, a memory pattern an EDR can scan for. Each of those is a potential detection. OPSEC is the discipline of *minimizing, blending, or laundering* those traces so the defender doesn't see you (or sees you and dismisses you as noise).

It is not a checklist; it's a way of thinking. Before any action: *what does this look like to a defender?*

---

## The signature surfaces

A modern Windows endpoint generates telemetry across roughly:

| Surface | Examples |
|---------|----------|
| Process | Image path, command line, parent process, integrity level, signing, PPID spoofing |
| Module | DLLs loaded, unsigned modules, RWX memory regions, reflective loads |
| File | Created files, modified files, alternate data streams, Office macro children |
| Registry | Auto-run keys, COM hijacks, service installs |
| Network | Beacon timing, JA3/JA4 fingerprint, SNI, domain age, ASN |
| Identity | Logon types (interactive vs network vs batch), Kerberos ticket anomalies, impossible travel |
| Memory | YARA hits on in-process memory, sleep mask absence, .text region modifications |
| Behavioral | LSASS open with PROCESS_VM_READ, child of `winword.exe`, abnormal token use |

Every operator decision touches one or more of these. EDRs correlate across them.

---

## Operator-side practices

A non-exhaustive set of habits:

- **Beacon hygiene.** Long sleep, large jitter, traffic that fits the host's normal egress (HTTPS to a fronted CDN, not raw TCP to a digitalocean IP).
- **Sleep obfuscation.** Encrypt and hide the implant's `.text` while sleeping; restore on wake. Most modern C2s ship a variant.
- **Process tree plausibility.** A `cmd.exe` child of `winword.exe` is suspicious. PPID-spoof or run inline.
- **Module loading.** Avoid loading `mimikatz.dll` by name. Reflective loads, in-memory execution, BOFs (Beacon Object Files) for short tasks.
- **LSASS interaction.** The single most-watched object on a Windows host. Don't `OpenProcess(LSASS, PROCESS_VM_READ)` — use SilentTrinity-style MSV1.0 hooks, or pull credentials from elsewhere (DPAPI, Kerberos tickets, browser storage).
- **Lateral movement.** Prefer `WMI`, `WinRM`, `SCM` over `psexec`-style techniques. Validate the choice against the org's actual logging.
- **Credential use.** Pass-the-hash and overpass-the-hash leave Kerberos artifacts; Silver/Golden tickets leave their own. Pick the artifact you'd rather generate.
- **Persistence.** Auto-runs are easy and detected; COM hijacks, scheduled tasks under unusual triggers, and WMI subscriptions are quieter.

---

## Infrastructure

The infrastructure side is half of OPSEC.

- **Domain reputation** — aged domains, categorized by URL filters into a benign category. Burned domains are burned forever.
- **Redirectors** — never let beacon traffic touch your real C2. Stand up disposable redirectors (Apache rewrite rules, NGINX, AWS API Gateway, Cloudflare Workers).
- **Domain fronting** — historically popular; CDN providers have largely shut it down. Know the current state on your provider before betting on it.
- **TLS fingerprinting** — JA3/JA4. Make sure your C2 client looks like a normal browser, not Cobalt Strike's default profile.
- **Provenance** — payloads compiled with reproducible toolchains, signed where possible, named to fit in.

---

## Common opsec failures

Real operations fail on these constantly:

- Beaconing on the same domain for two weeks; Sysmon DNS logging catches the long tail.
- `whoami /all` on a Tier-0 system. The blue team's first alert.
- Mimikatz strings in memory. Defender finds it before the operator finishes typing the next command.
- Reused infrastructure across operations. One IOC in a public report → all your ops attributed.
- Loud lateral movement (`psexec`, `wmiexec.py` defaults) when stealthier options were available.
- Sleeping with the implant's `.text` plain. Memory scanners pick it up.
- Forgetting that EDR cloud-side analytics correlate across endpoints; what looks safe locally lights up at the SOC.

---

## Decision framework

Before any action:

1. *What telemetry will this generate?*
2. *Who will see it, when, and against what baseline?*
3. *Is there a quieter way to achieve the same capability?*
4. *If this is detected, what does it cost me?* (Burned implant, burned domain, burned operation, attribution.)

If the answer to #4 is "the operation", reconsider.

---

## References

- *Operator Handbook* — Joshua Picolet
- The TrustedSec, SpecterOps, and MDSec blogs — current OPSEC tradecraft
- Will Schroeder ("harmj0y") — extensive AD OPSEC content on the SpecterOps blog
- Outflank — sleep-mask and EDR-evasion research
