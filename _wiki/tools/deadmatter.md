---
title: DeadMatter — Offline Credential Extraction from Memory Dumps
permalink: /wiki/tools/deadmatter/
layout: single
author_profile: true
tags:
- credential-access
- forensics
- evasion
- tool
sources:
- hackers-arise-deadmatter
updated: 2026-05-04
---

DeadMatter is a C# tool that extracts credentials — NTLM hashes, DPAPI keys, and active-logon-session artifacts — from full RAM captures and minidump files. Its design point is **offline analysis on the attacker's box**, not live LSASS access on the target. This shifts the noisy step (touching LSASS) onto a legitimate forensic acquisition tool that the EDR is statistically less likely to flag, then defers parsing to a host the EDR cannot see.

> **Category:** Credential Access / Defense Evasion
> **Pairs with:** [FTK Imager](/wiki/concepts/offline-credential-extraction/) (or any DFIR memory-acquisition tool)
> **Related:** [LSASS dumping](/wiki/concepts/lsass-dumping/), [Offline credential extraction from RAM](/wiki/concepts/offline-credential-extraction/), [Credential Guard bypass](/wiki/concepts/credential-guard-bypass/), [Mimikatz](/wiki/tools/mimikatz/)

## What it does

- Parses both **structured** memory artefacts (LSASS minidump structures the way Mimikatz would) and **unstructured raw RAM** via signature-based **carving** of credential patterns.
- Recovers credentials even when the memory dump is incomplete or doesn't follow a predictable format.
- Operates per Windows version when given the right flag, so a single binary handles minidumps from multiple OS builds.

The carving path is what matters operationally: structured parsing fails on truncated dumps, but pattern-based carving still finds credential blobs in raw bytes.

## Build

The repo ships no precompiled binary. Build from source with .NET:

```
PS > dotnet build -c release
```

Output lands at `bin\Release\Deadmatter.exe`. The hackers-arise mirror hosts a precompiled copy if you want to skip the build.

## Usage

### Default — full memory dump, both modes

```
PS > Deadmatter.exe -f memory_dump.raw
```

Runs structured parsing followed by carving over the full raw image. The output is verbose; scroll for credential artefacts associated with active or recently active logon sessions.

### Carving only

```
PS > Deadmatter.exe -f memory_dump.raw -m carve
```

Skips structured parsing entirely. Useful for dumps that aren't well-formed minidumps or where the LSASS process boundary inside the raw image isn't reliably locatable.

### Minidump with explicit Windows-version parser

```
PS > Deadmatter.exe -f lsass.dmp -m mimikatz -w WIN_10_1507 -v
```

`-m mimikatz` selects the Mimikatz-style structured parsing path; `-w WIN_10_1507` pins the LSASS layout used by that build; `-v` enables verbose output.

### Credentials + DPAPI keys + IV brute-force

```
PS > Deadmatter.exe -f memory_dump.raw -b -d
```

`-d` enables DPAPI key extraction; `-b` adds a brute-force search for initialisation vectors within the dump. The flags are independent — combining them maximises coverage.

## Output

- **NTLM hashes** for active and recent logon sessions.
- **DPAPI keys** (master keys / pre-keys) when present in the dump.
- **Logon-session metadata** linking accounts, SIDs, and logon types.

## Operational positioning

DeadMatter is the second half of a two-stage flow:

1. **Acquisition (on target):** capture full RAM with a legitimate forensic tool such as FTK Imager. EDR/AV are statistically less likely to flag DFIR tools than custom credential dumpers. Compress (32 GB → ~8–12 GB typical) and exfil.
2. **Extraction (off target):** run DeadMatter against the dump on the attacker's box. No EDR in the path.

See [offline credential extraction](/wiki/concepts/offline-credential-extraction/) for the full pattern, threat model, and gating conditions.

## Limitations

- **Credential Guard.** When VBS/Credential Guard is enabled, credential structures live in `LsaIso.exe` (Ring3-VTL1) and are not present in the standard memory image. DeadMatter cannot recover what isn't in the dump. Verify state before acquisition:

  ```
  PS > Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard
  ```

  See [Credential Guard bypass](/wiki/concepts/credential-guard-bypass/) for what to do when it's on.

- **Dump size.** A 32 GB RAM dump is realistic on servers; Exchange and database hosts can exceed that. Compression helps, but transfer time is a real OPSEC variable.

- **Acquisition tool detection.** "Less detected" is not "undetected." Mature EDR platforms catch FTK Imager and similar tools when they're not on the approved DFIR allow-list. Check the environment before acquiring.

## Defence

The hackers-arise post recommends:

- **Enable Credential Guard.** The single highest-impact control against this entire category.
- **Whitelist forensic tooling.** Don't blanket-block — DFIR teams need it. Maintain an allow-list of approved tools, allow only those, alert on the rest.

## See also

- [Offline credential extraction from RAM](/wiki/concepts/offline-credential-extraction/) — the technique pattern.
- [LSASS dumping](/wiki/concepts/lsass-dumping/) — the broader credential-access category.
- [Credential Guard bypass](/wiki/concepts/credential-guard-bypass/) — the gating control.
- [Mimikatz](/wiki/tools/mimikatz/) — the structured-parsing reference DeadMatter's `-m mimikatz` mode emulates.
- [Source — hackers-arise DeadMatter post](/wiki/sources/external-blogs/hackers-arise-deadmatter/) — provenance.

## References

- Co11ateral. *Digital Forensics: Evading AV/EDR During Credential Extraction with DeadMatter.* hackers-arise.com.
- DeadMatter GitHub repository.
