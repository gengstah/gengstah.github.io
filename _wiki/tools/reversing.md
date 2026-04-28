---
title: Reverse Engineering Tools
permalink: /wiki/tools/reversing/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- tool
redirect_from:
- /wiki/windows-exploit-research/tools/reversing/
---

> **Last updated:** 2026-04-19  
> **Related:** [Debugging](/wiki/tools/debugging/), [Fuzzing](/wiki/tools/fuzzing/)  
> **Tags:** `user-mode`, `kernel-mode`

## Summary

Reverse engineering is the foundation of Windows exploit research — you cannot find or exploit bugs you don't understand. This page covers the primary RE tools and their most valuable workflows for Windows kernel and user-mode exploit research.

---

## IDA Pro

The gold standard disassembler/decompiler. Most kernel exploit research uses IDA + Hex-Rays decompiler.

### Essential IDA Plugins for Windows Research

| Plugin | Purpose |
|--------|---------|
| **Hex-Rays Decompiler** | Pseudocode generation — non-negotiable |
| **BinDiff** | Structural binary diffing — critical for patch analysis |
| **FLIRT** | Function signature matching (recover library functions) |
| **Lumina** | Function renaming database via cloud (Hex-Rays) |
| **findcrypt** | Find crypto constants |

### Kernel Driver Analysis Workflow
```
1. File → Load → PE (select ntoskrnl.exe or driver.sys)
2. Import type info from WDK headers:
   File → Load File → Parse C Header → ntddk.h
3. Find DriverEntry → locate IRP dispatch table setup
4. Decode IOCTL codes: DeviceType(16) | Access(2) | Function(12) | Method(2)
5. Analyze each IOCTL handler for:
   - Buffer size checks before use
   - Pointer arithmetic on user input
   - Casting user-supplied values to kernel types
```

### Patch Diffing with BinDiff

```
1. Analyze both old and new binary in IDA → save .idb files
2. BinDiff → Diff → select both idbs
3. Sort by "Confidence" ascending to find most-changed functions
4. Side-by-side diff → identify removed bounds check, added validation
```

**Complement with Diaphora** (open source, more sensitive to small changes):
```
1. File → Script file → diaphora.py (in IDA)
2. Save .sqlite for each binary
3. Diff both .sqlite files → review matched/unmatched functions
```

### Patch Research Workflow (Finding Vulnerable Binary)

When Microsoft's advisory doesn't name the patched binary:

```
1. Identify affected component from advisory (e.g., "SMB Client/Server")
2. Map component to binaries:
   SMB client: mrxsmb.sys, mrxsmb10.sys, mrxsmb20.sys, mup.sys
   SMB server: srvnet.sys, srv.sys, srv2.sys, smbdirect.sys, srvcli.dll
   Cloud Files: cldflt.sys
   Common Log FS: clfs.sys
3. Download patched update from Microsoft Update Catalog:
   https://www.catalog.update.microsoft.com/Search.aspx?q=KBxxxxxxx
   (link appears at bottom of MSRC advisory page)
4. Extract .msu → .cab → binary:
   expand -F:* patch.msu c:\extract\
   expand -F:* Windows11.cab c:\binaries\
5. Download previous version for diffing:
   Winbindex: https://winbindex.m417z.com/?file=cldflt.sys
   → select specific Windows build → download directly
6. BinDiff / Diaphora both versions → find changed functions
```

**Winbindex** (https://winbindex.m417z.com) is the authoritative source for historical Windows binary versions by build number. Use it to get exactly the pre-patch binary for any driver or DLL.

---

## Ghidra

Free alternative to IDA with comparable decompiler quality.

### Ghidra for Windows Kernels
```
File → Import → ntoskrnl.exe
Analysis → Auto-Analyze
File → Download PDB → Microsoft Symbol Server
// PDB import restores function names — critical for kernel analysis
```

### Ghidra + BinExport + BinDiff (Patch Analysis Without IDA)

When IDA is unavailable, Ghidra can serve as the BinDiff frontend via the BinExport extension. This workflow was used by IBM X-Force for CVE-2022-34718 (EvilESP) patch analysis:

```
1. Download pre/post-patch binary from Winbindex
   (use sequential builds to minimize diff noise unrelated to the patch)

2. Load each binary in Ghidra:
   File → Import → [driver.sys]
   Analysis → Auto-Analyze
   File → Download PDB → Microsoft Symbol Server
   ↑ When PDB symbols are available, ALL functions are named —
     BinDiff will match by name rather than structural heuristics

3. Export BinExport:
   Install BinExport plugin for Ghidra (GitHub: google/binexport)
   Script Manager → BinExportGhidra.java → run on each binary
   → produces [driver.BinExport] file for each

4. Open BinDiff UI:
   File → Diff Binaries → select both .BinExport files
   → Sort by "Similarity" ascending → find changed functions
   → Functions listed as "changed" have structural diffs

5. Side-by-side pseudocode diff → identify minimal change:
   - Added bounds check → what was unbounded before?
   - Added discard gate → what bypass did it close?

Key insight: When PDB symbols are available, BinDiff's name-matching
is trivial — focus on matching-but-changed, not unmatched functions.
```

**When PDB symbols are absent** (stripped binaries), rely on:
- BinDiff structural matching (hash-based + CFG comparison)
- Diaphora for smaller/local changes BinDiff misses

### Ghidra Scripts for Exploit Research
```python
# Find all calls to ExAllocatePoolWithTag with non-NX pool type
from ghidra.app.script import GhidraScript
pool_func = getFunction("ExAllocatePoolWithTag")
refs = getReferencesTo(pool_func.entryPoint)
for ref in refs:
    # Check pool type argument (first arg = RCX on x64)
    inst = getInstructionBefore(ref.fromAddress)
```

---

## Binary Ninja

Strong mid-tier option with excellent Python API and plugin ecosystem.

```python
# BN: find all indirect calls (potential vtable dispatches)
for func in bv.functions:
    for bb in func.basic_blocks:
        for insn in bb:
            if insn.operation == MediumLevelILOperation.MLIL_CALL:
                if not isinstance(insn.dest, MediumLevelILConstPtr):
                    print(f"Indirect call at {hex(insn.address)}")
```

---

## PE Analysis Tools

### dumpbin (Visual Studio)
```cmd
dumpbin /exports ntdll.dll          # export table
dumpbin /imports target.exe         # import table
dumpbin /headers target.exe         # all PE headers
```

### pefile (Python)
```python
import pefile
pe = pefile.PE("ntdll.dll")
for exp in pe.DIRECTORY_ENTRY_EXPORT.symbols:
    print(hex(pe.OPTIONAL_HEADER.ImageBase + exp.address), exp.name)
```

---

## Patch Analysis (Patch Tuesday Workflow)

### Tools
- **ntdiff.github.io**: online diff of Windows builds across versions
- **BinDiff / diaphora**: structural binary diff
- **WinDiff**: scriptable build comparison

### Workflow
```
1. Download pre-patch and post-patch DLLs
2. BinDiff → focus on functions with score < 0.5
3. Check "Primary Unmatched" → new functions added (may contain fix context)
4. Decompile changed functions → identify minimal change:
   - Added bounds check → what was unbounded?
   - Added lock → where was the race?
   - Changed cast → what type confusion existed?
5. Write PoC triggering the pre-patch code path
```

---

## Windows-Specific RE Techniques

### Recovering IOCTL Codes
```c
#define CTL_CODE(DeviceType, Function, Method, Access) \
    (((DeviceType) << 16) | ((Access) << 14) | ((Function) << 2) | (Method))
// METHOD_BUFFERED=0, METHOD_IN_DIRECT=1, METHOD_OUT_DIRECT=2, METHOD_NEITHER=3
// FILE_ANY_ACCESS=0, FILE_READ_ACCESS=1, FILE_WRITE_ACCESS=2
```

### Kernel Pool Tags in Disassembly
```
In IDA: search for mov/push with 4-byte values near ExAllocatePoolWithTag calls
Example: 0x6C6F6F50 → 'looP' (little-endian) → tag 'Pool'
Use: !poolused in WinDbg to correlate tags with components
```

---

## Exploit Relevance

BinDiff + IDA is the fastest path from "Patch Tuesday dropped" to "I have a PoC." 1-day exploits require moving within 24-72 hours of a patch to beat other researchers. Master the patch analysis workflow above.

---

## References
- "The IDA Pro Book" — Chris Eagle
- "ntdiff.github.io" — Windows build differ
- "Practical Reverse Engineering" — Bruce Dang et al. (Windows focus)
- "BinDiff Manual" — Zynamics / Google
- google/binexport — BinExport plugin for IDA and Ghidra (GitHub)
- chompie1337, "Dissecting and Exploiting TCP/IP RCE Vulnerability 'EvilESP'" — example of Ghidra+BinExport+BinDiff patch analysis workflow
