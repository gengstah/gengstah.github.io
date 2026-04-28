---
title: DirectX / WDDM Kernel Attack Surface
permalink: /wiki/kernel/directx/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- kernel
redirect_from:
- /wiki/windows-exploit-research/kernel/directx/
---

> **Last updated:** 2026-04-12  
> **Related:** [Architecture](/wiki/kernel/architecture/), [Type Confusion](/wiki/techniques/type_confusion/), [Race Conditions](/wiki/techniques/race_conditions/), [Mitigations](/wiki/kernel/mitigations/)  
> **Tags:** `kernel-mode`, `type-confusion`, `race-condition`, `win32k`, `driver`

## Summary

The Windows Display Driver Model (WDDM) superseded the legacy XDDM and created a rich kernel attack surface spanning `dxgkrnl.sys`, `dxgmms1.sys`, `dxgmms2.sys`, and associated miniport/render drivers. User processes call into the DirectX subsystem via entry points that transit through `win32k.sys` and directly into DirectX kernel drivers via GDIPlus entry points. The complexity of shared kernel objects, cross-adapter allocations, and asynchronous rendering pipelines has produced numerous LPE vulnerabilities. As of 2024, this remains an active research area.

---

## Architecture Overview

```
User Application
       │
       │  D3DKMT* API calls (d3d10warp.dll → GDIPlus → win32k.sys)
       │  Direct calls via GDIPlus entry points to:
       ▼
  dxgkrnl.sys   (DirectX Graphics Kernel Subsystem — main driver)
       │  Manages DXG objects (DXG_DEVICE, DXG_ALLOCATION, DXG_CONTEXT, ...)
       │  Routes rendering/GPU commands to GPU miniport drivers
       ├─► dxgmms1.sys  (GPU Memory Manager — scheduler, pre-WDDM 2.x)
       ├─► dxgmms2.sys  (GPU Memory Manager 2 — scheduler, WDDM 2.x+)
       ├─► BasicRender.sys  (Software renderer — always present as fallback)
       ├─► BasicDisplay.sys (Display adapter for Basic Rendering)
       └─► Display Miniport Driver (hardware-specific: Intel/AMD/NV .sys)
```

### Key DXG Objects

| Object | Description |
|--------|-------------|
| `DXG_DEVICE` | Per-process GPU device; root of all allocations |
| `DXG_ALLOCATION` | GPU memory allocation; can be cross-adapter |
| `DXG_CONTEXT` | GPU rendering context; owns command submissions |
| `DXG_ADAPTER` | Physical adapter representation |
| `DXG_RESOURCE` | Collection of allocations sharing properties |

---

## Attack Surface Entry Points

### D3DKMTEscape
Takes a completely user-controlled blob of arbitrary size. Strong temptation to leave data in user memory → TOCTOU opportunities. Every display miniport driver defines its own blob format — huge vendor-specific attack surface.

### D3DKMTRender
Heart of GPU command submission. User-address command and patch buffers interpreted by kernel drivers and passed to miniport. Asynchronous — spawns worker threads → race conditions. Relevant vulns: CVE-2018-8406, CVE-2018-8401.

### D3DKMTCreateAllocation
GPU memory allocation with complex flag interactions (`CrossAdapter`, `Shared`, resource handles). Flag combinations that alter object interpretation create type confusion opportunities. Relevant vuln: CVE-2018-8405.

### D3DKMTMarkDeviceAsError / D3DKMTSubmitCommand
Used together; sharing mutable device state across concurrent threads without proper locking → races. Relevant vuln: CVE-2018-8401.

---

## Documented Vulnerabilities (2018 ZDI Research)

Research by ChenNan and RanchoIce (Tencent ZhanluLab), purchased by ZDI in spring 2018. Presented at 44CON September 2018. All patched August 2018 via MSRC.

### CVE-2018-8405 — D3DKMTCreateAllocation Type Confusion

**Component:** `DXGDEVICE::CreateAllocation` in `dxgkrnl.sys`  
**Exposure:** `D3DKMTCreateAllocation`  
**Bug class:** Type confusion via `CrossAdapter` flag misuse  

**Mechanism:**
1. Create allocation with `CrossAdapter = 0` → `DXG_ALLOCATION` object type A
2. Pass resulting handle into second `CreateAllocation` with `CrossAdapter = 1`
3. Kernel treats type A allocation as type B → type confusion → walk off end of allocation

**Impact:** LPE to SYSTEM. Observable via special pool on `dxgkrnl.sys`.

### CVE-2018-8406 — D3DKMTRender Type Confusion

**Component:** `dxgmms2.sys`  
**Exposure:** `D3DKMTRender`  
**Bug class:** Type confusion between two different adapters  

**Mechanism:** Render operation confused between source and target adapter objects → treats object of type X as type Y during GPU context validation.

**Impact:** LPE to SYSTEM. Observable via special pool on `dxgkrnl.sys` + `dxgmms2.sys`.

### CVE-2018-8400 — D3DKMTRender Untrusted Pointer Dereference

**Component:** `DGXCONTEXT::ResizeUserModeBuffers` in `dxgkrnl.sys`  
**Exposure:** `D3DKMTRender`  
**Bug class:** Untrusted pointer dereference (user-controlled flag → dereference)  

**Mechanism:** User-supplied flag in render submission causes kernel to treat a user-controllable value as a kernel pointer and dereferences it. No validation of flag → controllable kernel memory dereference.

**Impact:** LPE to SYSTEM.

### CVE-2018-8401 — BasicRender Race Condition

**Component:** `BasicRender.sys`  
**Exposure:** `D3DKMTMarkDeviceAsError` + `D3DKMTSubmitCommand`  
**Bug class:** Race condition (concurrent state modification)  

**Mechanism:** Each `D3DKMTSubmitCommand` call spawns a thread via `VidSchiWorkerThread`. `D3DKMTMarkDeviceAsError` concurrently modifies device state accessed by those threads without proper locking → memory corruption in shared state.

Two variants documented (ZDI-18-949 and ZDI-18-951) with same root cause but different PoC entry points; both given single CVE by Microsoft.

**Impact:** LPE to SYSTEM.

---

## Hunting Strategy

### Static Analysis Targets

1. **`D3DKMTEscape` handlers in miniport drivers**: Each vendor driver has a different blob format; look for unchecked length fields, union type confusion, TOCTOU with user-mode buffers.

2. **Cross-adapter flag handling**: Any code path that changes behavior based on `CrossAdapter`, `Shared`, or similar allocation flags — verify object types are consistently validated.

3. **Concurrent state access**: Look for mutable global/device state (reference counts, linked lists, status flags) accessed from multiple code paths without appropriate locks (SpinLock, FastMutex, PushLock).

4. **Pointer trust**: Any code that takes a flag from user-mode and uses it to select a pointer to dereference (common in rendering code that trusts "is this a kernel buffer?" flags).

### Dynamic Analysis / Fuzzing Setup

```
1. Attach kernel debugger to target VM
2. Enable special pool on target drivers:
   gflags /i your_app.exe +hpa
   OR
   verifier /flags 0x2 /driver dxgkrnl.sys dxgmms2.sys basicrender.sys

3. Call DirectX API sequences with:
   - Mixed/invalid flag combinations
   - Multiple threads racing state modifications
   - D3DKMTEscape with arbitrary blob contents
   - Cross-adapter allocations with mismatched handles
```

### Key Fuzzing Targets

| Target | Method | Why |
|--------|--------|-----|
| `D3DKMTEscape` | Fuzzing blob contents + length | Miniport-specific format; no standard |
| `D3DKMTCreateAllocation` | Flag enumeration | Complex flag interactions → type confusion |
| `D3DKMTRender` | Concurrent calls + `MarkDeviceAsError` | Race condition surface |
| Display miniport IOCTL | Standard IOCTL fuzzing | Driver-specific surface |

---

## Exploit Relevance

- WDDM attack surface is present on every Windows system with any graphics capability
- `D3DKMT*` API calls accessible from Medium IL without administrative rights
- CVE-2018-8405 demonstrated classic type confusion via flag misuse — pattern repeats in modern drivers
- `D3DKMTEscape` is perhaps the richest single entry point: user-controlled arbitrary blob, size, multiple vendor interpretations → high bug density
- BasicRender race pattern (concurrent submit + error marking) is a general pattern applicable to many driver state machines
- Intel, AMD, NVIDIA miniport drivers each have vendor-specific `D3DKMTEscape` surfaces that dwarf the core DirectX attack surface

---

## References

- Fritz Sands (ZDI), "DirectX to the Kernel", zerodayinitiative.com, 2018-12-04
- ChenNan & RanchoIce (Tencent ZhanluLab), "Gaining Remote System: Subverting The DirectX Kernel", 44CON 2018
- Ilja van Sprundel (IOActive), "Windows Kernel Graphics Driver Attack Surface", Black Hat USA 2014
- ZDI Advisories: ZDI-18-946/947/950/951 — github.com/thezdi/PoC/tree/master/DirectX
- Microsoft MSRC: CVE-2018-8400, -8401, -8405, -8406
