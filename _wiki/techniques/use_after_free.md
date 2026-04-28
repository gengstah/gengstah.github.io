---
title: Use-After-Free (UAF)
permalink: /wiki/techniques/use_after_free/
layout: single
author_profile: true
tags:
- windows-exploit-research
- kernel-mode
- technique
redirect_from:
- /wiki/techniques/use_after_free/
---

> **Last updated:** 2026-04-10  
> **Related:** [Heap Grooming](/wiki/techniques/heap_grooming/), [Pool Internals](/wiki/kernel/pool_internals/), [Heap Internals](/wiki/usermode/heap_internals/), [Type Confusion](/wiki/techniques/type_confusion/), [Cve 2024 26230](/wiki/cves/CVE-2024-26230/), [Cve 2025 29824](/wiki/cves/CVE-2025-29824/)  
> **Tags:** `uaf`, `user-mode`, `kernel-mode`, `rpc`

## Summary

Use-After-Free is the dominant bug class in modern Windows exploitation — responsible for the majority of browser, win32k, and kernel exploits over the past decade. A UAF occurs when an object is freed but a pointer to it (a "dangling pointer") is retained and subsequently used. The exploit converts this into controlled object re-allocation, enabling type confusion, arbitrary read/write, or vtable hijacking.

---

## Vulnerability Pattern

```
1. Alloc:  ptr = malloc(sizeof(ObjA))   ← ptr now valid
2. Free:   free(ptr)                    ← ptr now dangling
   [-- time passes, attacker triggers re-allocation --]
3. Alloc:  q = malloc(sizeof(ObjB))     ← allocator returns same slot (if groomed)
4. Use:    ptr->method()                ← ptr still points to freed slot
           ↑ if q occupies same slot, ptr->vtable = q->vtable = attacker data
```

---

## Lifecycle Analysis (How to Find UAFs)

Every UAF has a **free-use gap**: a window between the free and the use. Exploit development requires:
1. **Identify the free path**: what API call triggers the free?
2. **Identify the use path**: where is the dangling pointer used?
3. **Identify the gap**: can an attacker trigger heap operations between free and use?
4. **Size the object**: what size is the freed slot? → determines grooming strategy

Tools for lifecycle analysis:
- **HeapTrace / ETW**: trace alloc/free events
- **Dr. Memory / Application Verifier**: detect use-after-free automatically
- **Frida**: hook malloc/free dynamically to trace allocations
- **WinDbg `!heap -p -a <addr>`**: identify owner of freed heap address

---

## Exploitation Strategy

### Phase 1: Groom the Heap
After the free, fill the freed slot with a controlled object of matching size.

**Attacker-controlled objects** (user-mode):
- `ArrayBuffer` (JavaScript) — exact size, fully controlled content
- `String` objects — variable size
- Typed arrays — typed, predictable layout

**Attacker-controlled objects** (kernel UAF, from user-mode):
- Named pipe write buffers
- Registry key value data (`NtSetValueKey`)
- `PIPE_ATTRIBUTE` structures
- Event, semaphore objects (limited control)

### Phase 2: Trigger the Use
Call the API that uses the dangling pointer. If grooming succeeded, the freed slot contains attacker data.

### Phase 3: Exploit the Access
Common outcomes:
1. **Virtual function dispatch** (`call [vtable+N]`): vtable pointer in attacker data → control RIP
2. **Field read**: read attacker-controlled value, used as pointer or index
3. **Field write**: write to field in attacker-controlled object → modify other object's state

---

## Type Confusion via UAF

When the re-allocated object has a different type than the original:
```
slot freed (ObjA, size 0x100)
    ↓
slot re-allocated as ObjB (size 0x100)
    ↓
ptr (typed as ObjA*) → points to ObjB data
    ↓
ptr->method() → dispatches via ObjB's data interpreted as ObjA's vtable
```

This is classic **type confusion** — see [Type Confusion](/wiki/techniques/type_confusion/).

---

## win32k UAF Pattern (Kernel)

Win32k is historically the richest UAF source in the Windows kernel. General pattern:

```c
// Callback UAF pattern (very common in win32k):
1. win32k operation begins, holds reference to tagWND
2. win32k calls user-mode callback (e.g., WH_CBT hook, WM_NCCREATE)
3. During callback, user-mode code calls DestroyWindow() → frees tagWND
4. win32k returns from callback, dereferences now-freed tagWND pointer
```

**Why callbacks**: Win32k frequently calls back to user mode (hooks, window messages, DDE, clipboard). These callbacks create re-entrancy windows where attacker-controlled code can modify kernel state during critical sections.

### Notorious win32k UAF CVEs
- CVE-2021-1732 (tagWND UAF via SetWindowLongPtr callback)
- CVE-2020-1054 (tagWND UAF, DrawMenuBarTemp)
- CVE-2019-0859 (CreateDialogIndirectParam callback UAF)
- CVE-2018-8120 (NtUserSetImeInfoEx, no free needed — NULL deref)
- CVE-2016-7255 (tagWND win32kfull, used by Fancy Bear)

---

## CLFS UAF Pattern (Kernel — Current Primary Surface)

CLFS (`clfs.sys`) has a reference count overflow path yielding UAF:

```
m_rgcBlockReferences[block]  // PUSHORT — max 65535, NO overflow protection
    ↓
Overflow USHORT (repeated AcquireMetadataBlock without Release)
    ↓
Count wraps to 0 → driver believes no references → premature free
    ↓
Caller holds dangling pointer to freed pool allocation → UAF
```

**Trigger path**: user calls CLFS APIs (`WriteRestartArea`, `ScanLogContainers`) with carefully timed re-entrant calls that each increment the reference count without releasing it — triggering the 16-bit overflow.

**Why this is powerful**: CLFS allocations land in NonPaged or Paged pool with predictable sizes, making pool grooming straightforward. See [Clfs](/wiki/kernel/clfs/) for full exploitation detail.

---

## User-Mode RPC Service UAF Pattern

RPC services running as privileged accounts (e.g., `NT Authority\Network Service`, `SYSTEM`) present a unique UAF surface. The key insight: the attacker communicates via RPC, so the attacker can influence the order of allocations and trigger the UAF by calling specific RPC methods in sequence.

### CVE-2024-26230 — tapisrv.dll Pattern

```
Target: Telephony Service (tapisrv.dll), runs as NT Authority\Network Service
Interface: tapsrv — ClientAttach / ClientRequest / ClientDetach

UAF Chain:
1. ClientRequest(GetUIDllName) → allocates GOLD object (magic 0x474F4C44)
2. ClientRequest(FreeDialogInstance) → HeapFree(GOLD) — dangling ptr in context handle
3. Write registry key HandoffPriorities\RequestMakeCall (user has Full Control)
   → controls next heap allocation: same size as GOLD, attacker-controlled content
4. ClientRequest(TRequestMakeCall) → allocates from registry value
   → slot reclaimed by fake object with attacker's fake vtable
5. ClientRequest(TUISPIDLLCallBack) → accesses freed slot at vtable+0x20
   → executes attacker-chosen function pointer
```

**Key feature**: The registry key `HKCU\Software\Microsoft\Windows\CurrentVersion\Telephony\HandoffPriorities\RequestMakeCall` has Full Control for the current user by default — giving the attacker complete control over heap allocation size and content. This replaces the need for a separate spray object.

**CFG constraint**: `tapisrv.dll` is CFG-protected, so only legitimate CFG targets (imported Win32 functions) can be called via the corrupted vtable. This limits but does not prevent exploitation — the attacker invokes:
- `malloc` → leaks 32-bit heap address via RPC return value
- `VirtualAlloc` → creates RWX region
- `memcpy_s` (3 chars at a time) → copies DLL path into RWX region
- `LoadLibraryW` → loads attacker DLL → code execution as Network Service

**Privilege escalation tail**: `Network Service` holds `SeImpersonate` → PrintSpoofer / SweetPotato → SYSTEM.

See [Cve 2024 26230](/wiki/cves/CVE-2024-26230/) for complete exploit walkthrough.

### General RPC Service UAF Lessons

1. **Lifecycle control via RPC**: the attacker calls ClientAttach/ClientRequest in any order, controlling exactly when the free and use occur — a much cleaner UAF setup than kernel re-entrancy.
2. **Memory primitive discovery**: look for API calls in the RPC handler that allocate from attacker-controlled registry keys, WM_* messages, or other user-writable storage.
3. **CFG in RPC services**: user-mode services are often CFG-protected. Build your exploitation chain purely from imported functions — no ROP needed if you can chain Win32 imports.
4. **SeImpersonate escalation**: any service running as Network Service or Local Service holds SeImpersonate, enabling potato-style privilege escalation after DLL injection.

---

## Browser UAF Patterns

### JavaScript Engine UAF
In JIT-compiled JS engines (Chakra, V8):
```
1. Create JS object obj1 with specific shape
2. Trigger GC or deoptimization that frees obj1's backing store
3. Before GC completes collection, access obj1 via stale reference
4. Spray ArrayBuffers to reclaim freed slot
5. Type confuse obj1 as ArrayBuffer → arbitrary memory access
```

**Type confusion through backing store**: 
- Confuse `JSArray` backing store pointer → treat as buffer pointer → AAR/AAW within JS

---

## Heap Grooming for UAF (Detailed)

### Size Matching
The replacement object MUST be the same size as the freed object (±LFH bucket tolerance).

### Timing the Spray
```
1. Pre-spray: fill target LFH bucket to create dense, controlled region
2. Create vulnerable object (this allocates from the groomed region)
3. Create "filler" objects adjacent to vulnerable object
4. Trigger free of vulnerable object
5. Free filler objects to expose the slot
6. Allocate replacement objects to fill freed slot
7. Trigger use
```

### Verification
Use Application Verifier (SpecialHeap) or heap tracing to verify grooming succeeded before relying on it in exploit.

---

## Mitigation Interaction

| Mitigation | UAF Impact | Notes |
|-----------|-----------|-------|
| MemGC (Win10 TH1+) | Partial | Deferred freeing of certain DOM objects; helps browser UAFs |
| Segment Heap guard pages | Detection only | Random chance of detection, not deterministic |
| Heap cookie | None | Doesn't protect data, only headers |
| CFG | Partial | Prevents vtable hijack if vtable points outside CFG bitmap |
| CET | Partial | If vtable dispatch is indirect call — checked by IBT |

**MemGC** (Memory Garbage Collector, Win10): defers freeing of certain COM/DOM objects until no more pointers exist → breaks some browser UAF exploitation patterns. Enabled in MSHTML/Edge/IE.

---

## Exploit Relevance

UAF remains the #1 exploit bug class for win32k kernel exploits and browser renderer exploits. The combination of win32k callback re-entrancy and pool grooming is a repeating pattern found in dozens of CVEs. Building strong intuition for lifecycle analysis is the most valuable UAF exploitation skill.

---

## References
- "Exploiting Internet Explorer UAF vulnerabilities" — Corelan Team
- "win32k UAF Exploitation" — j00ru, Gynvael Coldwind
- "MemGC: Use-After-Free Exploitation in IE" — Microsoft SDL Team
- CVE-2021-1732 analysis — Kaspersky Securelist
- "Heap Grooming for UAF" — Project Zero blog
