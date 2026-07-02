---
title: Offline Credential Extraction from RAM
permalink: /wiki/concepts/offline-credential-extraction/
layout: single
author_profile: true
tags:
- credential-access
- forensics
- evasion
- concept
sources:
- hackers-arise-deadmatter
updated: 2026-05-04
---

A two-stage credential-access pattern that splits the noisy step (touching memory) from the analytical step (parsing it for credentials), pushing the second stage off the target. The shape is the same one DFIR has used for two decades; offence borrows it because it sidesteps the live-LSASS-access detections that EDR is calibrated for.

> **Category:** Credential Access / Defense Evasion
> **MITRE ATT&CK:** T1003.001 (LSASS Memory) — but acquired via T1056-ish off-target processing rather than live access.
> **Related:** [LSASS dumping](/wiki/concepts/lsass-dumping/), [Credential Guard bypass](/wiki/concepts/credential-guard-bypass/), [Mimikatz](/wiki/tools/mimikatz/), [DeadMatter](/wiki/tools/deadmatter/)

## The pattern

```
┌───────────────────────────┐         ┌────────────────────────────┐
│ Stage 1: ACQUISITION      │         │ Stage 2: EXTRACTION        │
│ on target, with admin     │         │ on attacker box, offline   │
├───────────────────────────┤         ├────────────────────────────┤
│ FTK Imager / WinPMEM /    │  dump   │ DeadMatter / Mimikatz /    │
│ DumpIt / belkasoft RAM    │ ──────► │ Volatility / pypykatz      │
│ Capturer                  │         │                            │
│  → memory_dump.raw        │         │ → NTLM hashes              │
│                           │         │ → DPAPI master keys        │
└───────────────────────────┘         │ → Kerberos tickets         │
                                      │ → logon-session artifacts  │
                                      └────────────────────────────┘
```

The key inversion: the *acquisition* tool is a legitimate forensic utility that DFIR teams routinely run; the *extraction* tool is offensive, but it never runs on the target. EDR sees a forensic acquisition (which may be allow-listed) instead of an offensive credential dumper.

## Why this evades EDR

EDR detection of LSASS dumping is calibrated for the live path:

- `OpenProcess(PROCESS_VM_READ, lsass.exe)` from a non-DFIR process.
- `MiniDumpWriteDump()` with `lsass.exe` as the source.
- Sysmon Event 10 (`ProcessAccess`) into LSASS with high access rights.
- Image-load patterns that tell on Mimikatz / pypykatz / lsassy.
- Comsvcs `MiniDump` ordinal invocation via `rundll32`.

A full-system RAM acquisition presents a different signal. The acquisition tool reads the *physical-memory device* (`\\.\PhysicalMemory` or via a kernel driver), not LSASS specifically. The resulting dump contains LSASS but also every other process, kernel structures, free pages, and so on. EDR products that hook `ZwOpenProcess` on LSASS won't see anything specific to LSASS; the read pattern is a contiguous physical-memory sweep.

The extraction step then happens entirely off-host. There is no PowerShell, no DLL injection, no AMSI surface, no minidump, no LSASS handle — just a binary parsing a file on the operator's machine.

## What it cannot bypass

- **Credential Guard.** Credentials in `LsaIso.exe` live in VTL1; the standard physical-memory image doesn't contain them. Acquisition still works, but the dump won't have NTLM hashes for currently-logged-on accounts. Verify state before relying on this approach:

  ```
  PS > Get-CimInstance -ClassName Win32_DeviceGuard -Namespace root\Microsoft\Windows\DeviceGuard
  ```

  See [Credential Guard bypass](/wiki/concepts/credential-guard-bypass/) for the techniques that re-expose credentials when CG is on.

- **EDR with allow-listed forensic tools.** Mature programs maintain an allow-list of approved DFIR utilities. Running FTK Imager from an unapproved binary path or unapproved user account still alerts.

- **DLP / egress controls.** A 32 GB raw dump (or 8–12 GB compressed) is a noticeable egress event. Network-DLP, conditional access, and large-file alerts can catch the exfiltration even when the acquisition itself is quiet.

- **Acquisition driver loading.** Some acquisition tools install a kernel driver (`pmem.sys`, vendor `.sys` files). Driver-load events (Sysmon 6, kernel WHEA) are visible to EDR.

## Acquisition options

| Tool | Signed driver | Notes |
| --- | --- | --- |
| **FTK Imager** | Yes (AccessData) | UI-driven "Capture Memory" feature. Common in DFIR. The hackers-arise post uses this. |
| **WinPMEM** (Velocidex) | Yes | Open-source, scriptable, supported on modern Windows. |
| **Magnet RAM Capture** | Yes (Magnet Forensics) | DFIR-standard alternative to FTK Imager. |
| **DumpIt** (Comae) | Yes | Single-binary, legacy but still works. |
| **Belkasoft RAM Capturer** | Yes | Alternative DFIR tool. |
| **`livekd -ml -o`** | (uses kdcom) | Live kernel debugging path; less commonly allow-listed. |

The "signed by a forensics vendor" property is the relevant one. Custom drivers and unsigned acquisition tools defeat the purpose.

## Extraction options

| Tool | Strength | Notes |
| --- | --- | --- |
| **[DeadMatter](/wiki/tools/deadmatter/)** | Carving for credential patterns alongside structured parsing | C#. Works on raw images and minidumps. Recovers when structures are corrupted/truncated. |
| **Mimikatz `sekurlsa::minidump` + `sekurlsa::logonpasswords`** | Reference structured parser | Requires a clean minidump; less forgiving. |
| **pypykatz** | Cross-platform Python port of Mimikatz | Easy to script; same structured-parsing limits. |
| **Volatility 3 (`windows.lsadump`, `windows.hashdump`, `windows.cachedump`)** | Forensic-grade, plugin-rich | Slower; designed for analysis, not speed. |
| **Rekall** | Volatility predecessor, similar capability | Less actively maintained. |

DeadMatter is differentiated by the carving path — when a minidump is partial or a raw image's LSASS slice is hard to locate, it still finds credential blobs by signature.

## Compression and exfil

A baseline server with 16–32 GB of RAM produces a dump of equivalent size; specialised hosts (Exchange, SQL, virtualisation) can exceed 64–128 GB. Compression typically achieves ~3–4× on raw memory (32 GB → 8–12 GB) because much of the address space is zeroed or repetitive.

Exfil paths the dump size makes feasible:

- Out-of-band media (USB, optical) — bypasses network DLP entirely.
- Cloud storage (rclone to attacker-controlled bucket) — fast, often allowed for line-of-business reasons.
- Chunked HTTPS upload to attacker C2 — slow, more visible.
- SMB to a compromised internal share, retrieve later — defers the egress event.

Network-DLP profiles aware of large outbound transfers will see this. Plan accordingly.

## Operator workflow

1. **Verify Credential Guard is off** with the `Get-CimInstance` query above. If it's on, switch to a CG-bypass approach instead.
2. **Pre-stage the acquisition tool.** Drop a signed forensics binary in a path that won't trip path-based AV rules. Don't rename it — the signature is the point.
3. **Acquire memory.** FTK Imager → Capture Memory, or `winpmem -o memory.raw`.
4. **Compress.** `7z a -mx=5 mem.7z memory.raw` (or zstd for speed).
5. **Exfiltrate.** Pick a path appropriate to the egress controls.
6. **Extract on the attacker box.** [DeadMatter](/wiki/tools/deadmatter/) `-f memory_dump.raw` for full processing, or `-m carve` for raw-only when structured parsing fails.

## Defence

- **Enable Credential Guard** on every host that supports it. Renders this entire pattern much less productive.
- **Allow-list DFIR tools by hash and signature.** Block everything else; alert on out-of-list executions.
- **Sysmon Event 6 + Event 7** monitoring for forensic-driver loads outside the allow-list (`pmem.sys`, `winpmem*.sys`, vendor drivers).
- **DLP for large outbound transfers.** A multi-gigabyte upload from a workstation should be a notable event regardless of destination.
- **Watch for `\\.\PhysicalMemory` access.** ETW provider `Microsoft-Windows-Kernel-File` and equivalents log device opens. The legitimate-vs-malicious signal is the *who* — if it's not your DFIR allow-list, it shouldn't be happening.

## See also

- [DeadMatter](/wiki/tools/deadmatter/) — extraction tool with structured + carving modes.
- [LSASS dumping](/wiki/concepts/lsass-dumping/) — the live-path alternative this pattern avoids.
- [Credential Guard bypass](/wiki/concepts/credential-guard-bypass/) — the gating control.
- [Mimikatz](/wiki/tools/mimikatz/) — the canonical structured parser.
- [Evasion techniques](/wiki/concepts/evasion-techniques/) — the broader category.

## References

- Co11ateral. *Digital Forensics: Evading AV/EDR During Credential Extraction with DeadMatter.* hackers-arise.com.
- AccessData FTK Imager — documentation and download.
- Volatility Foundation — *Volatility 3 documentation*.
- Velocidex — *WinPMEM*.
