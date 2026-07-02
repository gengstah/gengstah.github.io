---
title: "Reverse-Engineering MSVC C++ Exception Handling (x64/x86)"
permalink: /wiki/concepts/cpp-exception-reversing/
layout: single
author_profile: true
tags:
- windows-exploit-research
- user-mode
- concept
- reverse-engineering
---

> **Last updated:** 2026-07-02  
> **Related:** [Windows RPC](/wiki/concepts/windows-rpc/), [Windows Exploit Research Overview](/wiki/concepts/windows-exploit-research-overview/), [Reversing (tools)](/wiki/tools/reversing/), [Use After Free](/wiki/techniques/use_after_free/)  
> **Tags:** `user-mode`, `reverse-engineering`

## Summary

MSVC's C++ exception handling compiles down to metadata tables plus a runtime that drives stack unwinding and catch dispatch on top of the OS's Structured Exception Handling. Being able to read those tables in IDA/Ghidra matters for VR: they reveal destructor (cleanup) code, catch-handler regions, and the object lifetimes involved — which is exactly where use-after-free and leak bugs hide when exceptions unwind unexpected paths.

---

## Runtime Entry

A `throw` is emitted as `_CxxThrowException`. On the frame side the personality routine `__CxxFrameHandler4` (preceded by `__GSHandlerCheck_EH4` when stack cookies are present) is invoked by the OS SEH machinery to unwind and dispatch. The `.pdata`/`.xdata` sections anchor the metadata for each function.

---

## Metadata Structures

**`FuncInfo`** — root metadata for a function:
- magic number identifying the compiler version (`0x19930522`),
- max state number (highest state + 1),
- RVAs to the unwind map, the try-block map, and the IP-to-state map,
- exception-specification flags.

**`UnwindMapEntry`** — one per state transition: a target state plus a pointer to the destructor/cleanup thunk to run as the state decrements.

**`TryBlockMapEntry`** — one per `try`: the protected IP range (`tryLow`..`tryHigh`) and an array of catch handlers.

**`HandlerType`** — one catch clause: the RTTI type descriptor used for match, the stack offset of the caught object, and the handler code address to resume at.

---

## Unwind Flow on Throw

1. Consult the **IP-to-state** map to find the current scope state for the faulting instruction.
2. Walk **`UnwindMapEntry`** as the state decrements, running destructors — **destructors run before the catch body executes**.
3. Test **`TryBlockMapEntry`** handlers for RTTI type compatibility.
4. Jump to the matching handler, or propagate the exception to the caller.

---

## x64 vs. x86

- **x86** tracks scope state explicitly on the stack.
- **x64** uses an **implicit** model: RVA-indexed `IPtoStateMap` entries associate instruction addresses with scope depth, reflecting the different calling convention and frame layout. There is no linked chain of `EXCEPTION_REGISTRATION` records on the stack.

---

## Reversing Workflow (IDA)

- Select a function → right-click → **"Show C++ Wind States"** to visualise the EH control flow.
- Cross-reference the `.pdata` section to locate the `FuncInfo`/unwind metadata.
- Follow the unwind-map function pointers to identify the destructors triggered during unwinding — these are the cleanup routines to reason about for lifetime bugs.

---

## Security-relevant Observation

Objects with automatic storage (stack locals, `unique_ptr`, `shared_ptr`) get their destructors run during unwinding; **raw `new`-allocated pointers without an RAII owner are not freed automatically**, so an exception thrown between allocation and manual `delete` leaks — or, if a partially-constructed object is referenced during cleanup, sets up a use-after-free. Mapping the unwind map onto the object graph is how you find those exception-path bugs.

---

## References

- VictorV (@V-V), "C++ 异常处理的逆向", v-v.space, 2024-04-02 — <https://v-v.space/2024/04/02/CPlusPlus_Exception/>
- Igor Skochinsky / Hex-Rays notes on MSVC EH4 metadata
