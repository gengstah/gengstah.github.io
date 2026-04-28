---
title: macOS JIT Memory and Shellcode Execution
permalink: /wiki/concepts/macos-jit-shellcode/
layout: single
author_profile: true
tags:
- offsec-notes
- concept
redirect_from:
- /wiki/offsec-notes/concepts/macos-jit-shellcode/
---

**Category:** Execution / Defense Evasion (macOS)
**MITRE ATT&CK:** T1059 — Command and Scripting Interpreter; T1620 — Reflective Code Loading
**Related:** [Evasion Techniques](/wiki/concepts/evasion-techniques/), [Post Exploitation](/wiki/concepts/post-exploitation/)

## Overview
macOS Hardened Runtime prevents execution of unsigned code. Applications disable specific protections via entitlements. The `allow-jit` entitlement permits `MAP_JIT` memory allocation — RWX memory that bypasses code signature requirements. A wide range of common applications (Firefox, VSCode, Obsidian, Microsoft Office, Spotify) have this entitlement, making them viable shellcode execution hosts.

## Hardened Runtime Entitlements

| Entitlement | Effect | Shellcode Viable |
|-------------|--------|------------------|
| `allow-jit` | Allows `mmap(MAP_JIT)` for RWX memory | Yes |
| `allow-unsigned-executable-memory` | Allows unsigned executable pages | Yes |
| `disable-executable-page-protection` | Disables all page protections | Yes (easiest) |
| `disable-library-validation` | Allows loading unsigned dylibs | No (loading only) |
| `allow-dyld-environment-variables` | Allows `LD_PRELOAD`-style vars | No (loading only) |

For shellcode execution, `allow-jit` and `allow-unsigned-executable-memory` are effectively equivalent.

## JIT Memory Behavior

`MAP_JIT` memory has per-thread write/execute state — a single thread cannot simultaneously write and execute the same region:

```
// Thread A writes while Thread B executes (valid):
Phase 0: main=WRITE(0) child=EXEC(1)
  main  off=0x100 write=OK exec=FAULT
  child off=0x200 write=FAULT exec=OK
```

Apple claims only one `MAP_JIT` region per app, but this was **not true** in testing on macOS Tahoe 26.2 — multiple regions work fine.

## Shellcode Execution Methods

### Method 1: pthread_jit_write_protect_np (standard)
```c
// 1. Allocate RWX memory
void *mem = mmap(NULL, size, PROT_READ|PROT_WRITE|PROT_EXEC, 
                 MAP_PRIVATE|MAP_ANONYMOUS|MAP_JIT, -1, 0);

// 2. Switch thread to write mode
pthread_jit_write_protect_np(0);

// 3. Copy shellcode
memcpy(mem, shellcode, shellcode_len);

// 4. Switch thread to execute mode
pthread_jit_write_protect_np(1);

// 5. Execute
((void(*)())mem)();
```

**Limitation:** Blocked by `jit-write-allowlist` entitlement (rare — no known apps use it).

### Method 2: RW→RX transition (works despite jit-write-allowlist)
```c
// 1. Allocate RW memory with MAP_JIT
void *mem = mmap(NULL, size, PROT_READ|PROT_WRITE,
                 MAP_PRIVATE|MAP_ANONYMOUS|MAP_JIT, -1, 0);

// 2. Copy shellcode while writable
memcpy(mem, shellcode, shellcode_len);

// 3. Change to RX
mprotect(mem, size, PROT_READ|PROT_EXEC);

// 4. Execute
((void(*)())mem)();
```

This method works in all scenarios including `jit-write-allowlist`.

## Target Applications with allow-jit

Common apps where shellcode can execute via dylib sideloading or VBA macros:
- Firefox, Obsidian, VLC, Spotify
- Microsoft Excel, PowerPoint, Word
- VSCode and forks (Cursor, Antigravity, etc.)
- PyCharm, GoTo, OpenAI Codex

### Reflective Loader Integration
Outflank updated their macOS reflective loader and Outflank C2 to support both `allow-jit` and `allow-unsigned-executable-memory`:
- github.com/outflanknl/macho-loader

Sliver also has a macOS reflective loader (beignet) with `allow-jit` support via PR:
- github.com/sliverarmory/beignet

### VBA Macro Shellcode Execution
With `allow-jit` entitlement on Microsoft Office:
```vba
' VBA macro in Excel/Word - executes shellcode in Office process
' using Method 2 (RW→RX mprotect) via ctypes-style calls
Declare Function mmap Lib "libSystem.B.dylib" ...
Declare Function mprotect Lib "libSystem.B.dylib" ...
```

## Delivery Methods
1. **Dylib sideloading** — plant malicious `.dylib` in app bundle alongside legitimate dylibs
2. **VBA macros** — Office documents with macros (requires `allow-jit` app to be target)
3. **JXA/AppleScript** — JS for Automation; no signature needed for scripts
4. **Python** — Unsigned scripts; useful with PyCharm or embedded Python

## Detection
- `mmap` calls with `MAP_JIT` flag from non-standard processes
- `mprotect` transitioning memory from RW to RX in a non-JIT process
- Dylib loading from unexpected paths (outside app bundle)
- `pthread_jit_write_protect_np` calls from processes that don't normally JIT compile

## References
- Outflank — "macOS JIT Memory" (2026-02-19)
- github.com/outflanknl/macos-jit (PoC programs)
- github.com/outflanknl/macho-loader
