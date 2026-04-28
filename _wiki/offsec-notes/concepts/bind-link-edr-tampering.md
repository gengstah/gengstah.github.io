---
title: Bind Link EDR Tampering
permalink: /wiki/offsec-notes/concepts/bind-link-edr-tampering/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

# Bind Link EDR Tampering

**Category:** Defense Evasion / Persistence
**MITRE ATT&CK:** T1562.001 — Impair Defenses: Disable or Modify Tools; T1574.001 — DLL Side-Loading
**Related:** [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/), [Dll Hijacking](/wiki/offsec-notes/concepts/dll-hijacking/), [Edr Silencing](/wiki/offsec-notes/concepts/edr-silencing/)

## Overview
The Windows Bind Link API (Windows 11+) creates transparent filesystem redirections, mapping a virtual path to any backing path. Administrators can abuse `bindflt.sys` to redirect an EDR's installation folder to an attacker-controlled directory, enabling DLL hijacking inside the EDR's process or arbitrary code execution under the EDR's context.

## Mechanism

`bindflt.sys` is a kernel filter driver that enables transparent path redirections at the filesystem level — the redirected application is unaware its files are being served from a different location. The API is exposed via `bindfltapi.dll` in System32.

Key APIs:
| Function | Purpose |
|----------|---------|
| `BfSetupFilter` | Create a bind link (virtual path → backing path) |
| `BfRemoveMapping` | Remove an existing bind link |

Both are loaded via `LoadLibraryW("bindfltapi.dll")` and resolved with `GetProcAddress`.

## Tool: EDR-Redir

PoC: github.com/TwoSevenOneT/EDR-Redir

### Redirect a Microsoft application folder (preserving specific EDR path as exception):
```
EDR-Redir.exe "C:\ProgramData\Microsoft" C:\temp\attacker_folder "C:\ProgramData\Microsoft\Windows Defender"
```

### Redirect EDR folder directly:
```
EDR-Redir.exe "C:\ProgramData\Microsoft\Windows Defender" C:\temp\attacker_folder
```

After redirection, `C:\temp\attacker_folder` mirrors the EDR folder contents. The attacker can:
1. Drop a malicious DLL that matches a legitimate EDR module name → DLL hijacking
2. Plant an arbitrary executable in the fake folder → code runs under EDR process context

**Requirement:** Local Administrator

## Attack Flow
1. Identify EDR installation path and DLLs loaded by main EDR process (use Sysmon or Process Monitor)
2. Execute `EDR-Redir.exe <edr_path> <writable_attacker_path>`
3. Drop malicious DLL into attacker-controlled folder matching a legitimate EDR DLL name
4. Trigger EDR process restart (reboot, service restart, or wait for auto-restart)
5. EDR loads attacker DLL → code executes in EDR process context

## Detection

### Primary Indicator: bindfltapi.dll Load
Any process loading `bindfltapi.dll` outside of known Microsoft tooling is a high-confidence IOC.

**Sysmon Event ID 7 (Image Load):**
```xml
<EventFiltering>
  <ImageLoad onmatch="include">
    <ImageLoaded condition="end with">\bindfltapi.dll</ImageLoaded>
  </ImageLoad>
</EventFiltering>
```

### SIGMA Rule
```yaml
title: Suspicious Loading of BindFlt API DLL
id: 9b8e7d42-3e0f-4a1d-9f8f-1d2e3f4a5b6c
status: experimental
description: Detects loading of bindfltapi.dll outside legitimate Microsoft processes
author: Panos Gkatziroulis
tags:
  - attack.defense-evasion
  - attack.t1562.001
logsource:
  category: image_load
  product: windows
detection:
  selection:
    ImageLoaded|endswith: '\bindfltapi.dll'
  filter_legit:
    Signed: true
    Signature: 'Microsoft Windows'
  condition: selection and not filter_legit
level: high
```

### Secondary Indicators
- `CreateDirectoryW` creating directories that mirror EDR installation paths
- EDR process loading DLLs from unexpected parent directories (Process Monitor)
- Unusual parent folder for EDR process in file access logs

### EDR Support (as of disclosure, 2025-12)
| EDR | BindFlt Monitoring |
|-----|--------------------|
| CrowdStrike | Partial |
| SentinelOne | Partial |
| Carbon Black | Not confirmed |
| Defender for Endpoint | Partial |

## OPSEC Notes
- EDR-Redir PoC is unsigned — most EDRs will alert on execution before the redirect is established
- Advanced operators should reimplement the `BfSetupFilter` call in a trusted/signed binary or BOF
- Technique is Windows 11 only (`bindflt.sys` introduced in Windows 11)
- Path redirection persists until `BfRemoveMapping` is called or system reboots

## References
- ipurple.team — "Bind Link – EDR Tampering" (2025-12-01)
- EDR-Redir PoC — github.com/TwoSevenOneT/EDR-Redir
- Microsoft Bind Links docs — learn.microsoft.com/en-us/windows/win32/api/bindlink/
