---
title: Evasion Techniques
permalink: /wiki/concepts/evasion-techniques/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/evasion-techniques/
---

**Category:** Defense Evasion / Cross-cutting
**MITRE ATT&CK:** Defense Evasion — TA0005
**Related:** [Command And Control](/wiki/concepts/command-and-control/), [Phishing](/wiki/concepts/phishing/), [Post Exploitation](/wiki/concepts/post-exploitation/), [Red Teaming](/wiki/concepts/red-teaming/)

## Overview
Evasion techniques allow attackers to bypass security controls — antivirus (AV), endpoint detection and response (EDR), network IDS/IPS, SIEM, and sandboxes — to execute payloads, maintain access, and operate without triggering alerts. Modern EDRs use behavioral analysis, kernel callbacks, and telemetry correlation, requiring sophisticated evasion.

## How It Works

### AV/EDR Detection Layers
1. **Static signature:** Hash, byte pattern, YARA rule match at file level.
2. **Emulation/sandboxing:** Execute in lightweight sandbox before running.
3. **Behavioral:** Monitor API calls, process behavior, memory patterns at runtime.
4. **ETW (Event Tracing for Windows):** Kernel telemetry sent to EDR.
5. **Kernel callbacks:** EDR drivers register for process creation, image load, registry events.

### Static Evasion
- **Custom payload generation:** Avoid known shellcode patterns; generate custom implants.
- **Obfuscation:** Rename strings, encrypt payload in transit, encode with XOR/AES.
- **Packing:** Compress/encrypt payload; decompress at runtime.
- **Polymorphism:** Change code structure while preserving functionality.
- **Compile from source:** Avoid pre-compiled known-bad binaries.

### AMSI (Antimalware Scan Interface) Bypass (Windows)
AMSI hooks PowerShell, VBScript, JScript, .NET to scan in-memory content before execution.
```powershell
# Patch amsi.dll AmsiScanBuffer in-memory (requires unmanaged code)
# Common one-liner (detection-prone; use obfuscated versions)
[Ref].Assembly.GetType('System.Management.Automation.AmsiUtils').GetField('amsiInitFailed','NonPublic,Static').SetValue($null,$true)
```
Better: use custom .NET reflective loaders that patch AMSI before loading PS.

### ETW Bypass
Patch `EtwEventWrite` to return early → stop telemetry to EDR.
Risky: EDR integrity checks on its own hooks; kernel ETW patching is more complex.

### Process Injection
Inject shellcode into legitimate signed processes to hide from process-based detections.
Common techniques:
- **Classic injection:** VirtualAllocEx → WriteProcessMemory → CreateRemoteThread
- **Process Hollowing:** Create suspended process → replace its image with payload
- **Thread Hijacking:** Suspend thread → overwrite context RIP → resume
- **APC injection:** Queue APC to alertable thread
- **Module stomping:** Overwrite a loaded legitimate DLL's memory with payload
- **Dirty Vanity:** Clone process → inject into clone (no cross-process writes)

### DLL Sideloading / Hijacking
- Drop malicious DLL with same name as one expected by a legitimate signed process.
- Signed binary loads malicious DLL → payload executes in trusted process context.
- Find candidates: procmon DLL not found events on legitimate apps.

### LOLBins (Living off the Land)
Use legitimate Windows binaries to execute payload — harder to detect as "attacker tool."
- `mshta.exe`, `certutil.exe`, `regsvr32.exe`, `wscript.exe`, `bitsadmin.exe`, `rundll32.exe`
- Reference: lolbas-project.github.io

### Sleep Obfuscation
Encrypt beacon in memory while sleeping → evade memory scanning.
- Techniques: Ekko, Foliage, Cronos — encrypt heap/stack, set timer, sleep, decrypt on wake.
- Defeats EDR memory scanners that scan process memory periodically.

### Payload Delivery Obfuscation
- HTML smuggling: payload decoded in browser, never traverses network as file.
- Password-protected ZIP: SEG cannot detonate.
- ISO/VHD containers: bypass Mark of the Web on pre-Win11.
- Staged payloads: small first stage checks environment before pulling full payload.

### Sandbox Evasion
Sandboxes are limited-time, automated environments. Evade by:
- Sleeping longer than sandbox timeout (usually 1–3 min).
- Checking for sandbox artifacts: low uptime, no mouse movement, small screen, no recent browser history.
- User interaction requirement: popup that needs a click.
- Domain-joined check: malware only runs if domain-joined.

## Detection & Evasion — Arms Race Notes
- EDRs constantly update; techniques that worked 6 months ago may be snagged.
- Kernel-level EDRs (PPL, ETW-TI) are very hard to fully evade.
- Focus on behavioral blending over pure evasion: behave like legitimate software.
- Custom implants with unique C2 profiles are harder to detect than off-the-shelf tools.

## Tools
- `Donut` — convert .NET/PE/shellcode to position-independent shellcode
- `Shhhloader` / `BofNet` — shellcode loaders with evasion
- `Scarecrow` — PE loader with EDR bypass techniques
- `Inceptor` — template-based shellcode loader (AMSI, ETW bypass built in)
- `ConfuserEx` / `Obfuscar` — .NET obfuscation
- `LOLBAS` — lolbas-project.github.io — abuse legitimate Windows binaries
- `ThreatCheck` / `DefenderCheck` — identify which bytes trigger AV/Defender

## References
- MITRE ATT&CK TA0005 Defense Evasion
- MDSec blog — advanced injection and evasion research
- "Malware Development" — 0xPat blog series
- Vx-underground — malware source collection (research reference)
