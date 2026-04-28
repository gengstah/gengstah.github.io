---
title: Credential Guard Bypass
permalink: /wiki/concepts/credential-guard-bypass/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/credential-guard-bypass/
---

**Category:** Credential Access / Defense Evasion
**MITRE ATT&CK:** T1003.001 — OS Credential Dumping: LSASS Memory; T1562 — Impair Defenses
**Related:** [Active Directory Attacks](/wiki/concepts/active-directory-attacks/), [Privilege Escalation Windows](/wiki/concepts/privilege-escalation-windows/), [Mimikatz](/wiki/tools/mimikatz/)

## Overview
Windows Credential Guard moves credential material (including NTLM hashes) from LSASS into an isolated process (`LsaIso.exe`) running at Ring3-VTL1 via Virtualization-Based Security (VBS). Direct LSASS memory reads no longer yield usable credentials. Four documented bypass techniques defeat Credential Guard to recover NTLMv1/plaintext credentials.

## Architecture
- **VBS** creates a hardware-enforced isolation boundary between the normal OS (VTL0) and the secure world (VTL1)
- `LsaIso.exe` runs in Ring3-VTL1 — standard OS processes cannot read its memory
- `wdigest.dll` holds global flags that control whether plaintext creds are cached in LSASS memory
- Two key globals in `wdigest.dll`:
  - `g_IsCredGuardEnabled` — disables wdigest caching when set to 1
  - `g_fParameter_UseLogonCredential` — must be set to 1 to cache plaintext

## Bypass Techniques

### Technique 1: Memory Patching (BypassCredGuard)
Patch wdigest.dll globals in memory to re-enable plaintext credential caching.

**Tool:** BypassCredGuard (github.com/ricardojba/Invoke-WCMDump or dedicated PoC)

```powershell
# Run BypassCredGuard — patches wdigest.dll in LSASS process
# Sets: g_IsCredGuardEnabled = 0, g_fParameter_UseLogonCredential = 1
.\BypassCredGuard.exe

# Wait for a user to log in (interactive session or network auth)
# Then dump LSASS normally
sekurlsa::logonpasswords  # Mimikatz
```

**Requirements:** SYSTEM + SeDebugPrivilege + WriteProcessMemory into LSASS  
**Detection:** Event ID 4703 (token privilege adjustment for SeDebugPrivilege)

### Technique 2: Pass the Challenge (PassTheChallenge)
Abuses the Remote Credential Guard protocol: extracts the NTLM challenge/response negotiation from inside LsaIso to recover NTLMv1 material without fully dumping memory.

**Tool:** PassTheChallenge (uses `NtlmIumCalculateNtResponse` export from LsaIso)

**Attack flow:**
1. Dump LSASS (not for creds — for state)
2. Inject SSP into LSASS
3. Trigger authentication to capture NtlmIum response

**Requirements:** LSASS dump + SSP injection — very noisy, triggers many EDR alerts  
**Note:** Most operational value is for understanding the protocol; rarely used in practice due to noise

### Technique 3: Downgrade Attack (WindowsDowndate)
Exploit CVE-2022-34709 using the WindowsDowndate tool to downgrade Credential Guard protections from Ring3-VTL1 to a patchable state.

```
WindowsDowndate.exe --component CredentialGuard
```

**Status:** Patched on newer Windows 11 builds. Check Windows version before attempting.  
**Requirements:** Administrator  
**Detection:** Unexpected Windows component downgrade; Event ID 4741 if machine account modified

### Technique 4: SSP Negotiation Dump (DumpGuard) — Preferred
Bypasses Credential Guard without touching LSASS memory directly. Uses the machine account to initiate Kerberos TGT/TGS, then calls `LsaCallAuthenticationPackage` targeting the TSSSP (Terminal Services SSP) package to extract NTLMv1 hashes.

**Tool:** DumpGuard (also has BOF implementation for use in Cobalt Strike)

```
# Standard execution
DumpGuard.exe

# BOF execution (Cobalt Strike)
inline-execute DumpGuard.o
```

**Attack flow:**
1. Use machine account credentials (SYSTEM context provides this)
2. Request Kerberos TGT → TGS using TSSSP package
3. `LsaCallAuthenticationPackage` coerces NTLM negotiation
4. Extract NTLMv1 hash from authentication exchange

**Why preferred:**
- No LSASS process memory access
- NTLMv1 hash recovered is crackable offline or used for relay
- BOF implementation keeps it in-process / memory-only
- Works on Windows Server environments

**Requirements:** SYSTEM context (machine account)  
**Detection:** Event IDs 4768 (TGT request), 4769 (TGS request) — baseline against normal; Event ID 4703 for SeDebugPrivilege NOT triggered

## Detection Summary

| Technique | Key Event IDs | Noise Level |
|-----------|--------------|-------------|
| Memory Patching | 4703 (SeDebugPrivilege), LSASS access events | High |
| Pass the Challenge | LSASS dump events, SSP load event | Very High |
| Downgrade | Component modification events, 4741 | Medium |
| SSP Negotiation (DumpGuard) | 4768, 4769 (baseline required) | Low |

## OPSEC Notes
- Techniques 1 and 2 are high-noise; use only if no other option
- DumpGuard (Technique 4) is the stealthiest operational choice
- Credential Guard on Windows 11 22H2+ patches the downgrade vector
- NTLMv1 hashes from DumpGuard can be cracked with `hashcat -m 5500` or used in relay attacks

## References
- ipurple.team — "Credential Guard" (2026-03-17)
- BypassCredGuard — github.com/ricardojba/Invoke-WCMDump
- PassTheChallenge — github.com/ly4k/PassTheChallenge
- WindowsDowndate — github.com/SafeBreach-Labs/WindowsDowndate (CVE-2022-34709)
- DumpGuard — internal/BOF implementation
