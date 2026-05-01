---
title: "EDR Unhooking"
permalink: /wiki/techniques/edr-unhooking/
layout: single
author_profile: true
tags:
  - technique
  - edr
  - unhooking
  - syscalls
  - evasion
  - outflank
---

*Restoring `ntdll.dll` (and friends) to its on-disk byte sequence inside your own process so EDR userland inline hooks don't intercept your syscalls. Twenty-year-old tradecraft, refined by Outflank's 2023 post into a robust modern recipe.*

**Status:** drafting
**Related:** [AMSI bypass](/wiki/techniques/amsi-bypass/), [EDR Silencing](/wiki/concepts/edr-silencing/), [BOFs](/wiki/concepts/beacon-object-files/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## Why hooking exists, why unhooking works

EDR products instrument userland by inline-hooking high-value `ntdll.dll` exports — `NtAllocateVirtualMemory`, `NtProtectVirtualMemory`, `NtCreateThreadEx`, `NtOpenProcess`, `NtReadVirtualMemory`, `NtWriteVirtualMemory`, etc. The first instruction at the export's entry is overwritten with a `jmp` to the EDR's hook handler, which logs / inspects / blocks before optionally jumping back to the genuine syscall stub.

Because the hook is **in your process's user-mode memory**, your process can rewrite it. Read the on-disk `ntdll.dll`, copy the original bytes back over the hooked entries, and the EDR's userland visibility goes away — for your process, until something re-applies the hook.

## The naive recipe (and why it has problems)

```c
// 1. Map ntdll.dll from disk.
HANDLE hFile = CreateFileW(L"C:\\Windows\\System32\\ntdll.dll", GENERIC_READ, FILE_SHARE_READ, ..., OPEN_EXISTING, ...);
HANDLE hMap = CreateFileMappingW(hFile, ..., PAGE_READONLY | SEC_IMAGE, ...);
LPVOID disk = MapViewOfFile(hMap, FILE_MAP_READ, ...);

// 2. Locate ntdll.dll in memory.
HMODULE inMem = GetModuleHandleW(L"ntdll.dll");

// 3. Find the .text section and copy over.
// ... walk PE headers; PAGE_EXECUTE_READWRITE; memcpy; restore protection.
```

Issues:

- Mapping `ntdll.dll` at runtime calls hooked APIs (`CreateFileW`, `CreateFileMappingW` ride the same EDR hooks).
- Your `memcpy` writes to executable code pages. EDR may have a kernel-mode notify-routine for executable-page modification.
- Some EDRs inline-hook *more* than `ntdll.dll`: `kernelbase.dll`, `wininet.dll`, `crypt32.dll`. Restoring just `ntdll.dll` leaves residual visibility.

## Outflank's robust recipe (2023)

Dima van de Wouw — *Solving The "Unhooking" Problem* (2023-10-05). Synthesises a bunch of operator lessons:

1. **Don't use APIs to fetch the on-disk copy.** Instead either:
   - Manually parse the **PEB** to find the loaded `ntdll.dll` base, then read its `.text` from a *clean copy* you embed in the implant, *or*
   - Use direct syscalls (already in your binary, never resolved through ntdll exports) to read disk.
2. **Restore in chunks.** Walk the PE sections; only the `.text` section needs the byte-by-byte restore. Skip writable sections (data, IAT) — restoring them clobbers per-process state.
3. **Restore page protections explicitly.** `NtProtectVirtualMemory` to RWX, copy, back to RX. Don't leave RWX behind — it's a separate detection.
4. **Re-hook the hook detector.** Some EDRs re-apply hooks every N ms. Either:
   - Re-unhook periodically.
   - Detour the EDR's re-hooker (advanced; product-specific).
5. **Be selective.** A whole-`ntdll` restore is a strong signal. Restore only the specific exports you're about to call.

## Direct syscalls — the alternative

Instead of restoring `ntdll.dll`, **never go through it** for the calls EDR cares about. Build a syscall stub in-process for each `Nt*` you need:

```nasm
NtAllocateVirtualMemory:
    mov r10, rcx
    mov eax, <syscall_number_for_NtAllocateVirtualMemory>
    syscall
    ret
```

The syscall number depends on the Windows build. Tools like `SysWhispers2` / `SysWhispers3` automate the lookup; `Hells Gate` / `Halo's Gate` discover the syscall number at runtime by walking the loaded `ntdll.dll` and pattern-matching un-hooked stubs.

Outflank's *Direct Syscalls in Beacon Object Files* (Cornelis de Plaa, 2020-12-26) made this practical inside Cobalt Strike BOFs — the BOF executes in Beacon's process and can't drag a giant syscall library along with it. The post walks per-OS syscall-number tables and a compact stub generator.

The earlier *Combining Direct System Calls and sRDI to bypass AV/EDR* (2019-06-19) is the canonical writeup of pairing direct syscalls with shellcode reflective DLL injection (sRDI).

## Unhooking vs direct syscalls — pick one or both

| | Unhooking | Direct syscalls |
|---|---|---|
| Visibility to userland hooks | None after restore | None — hooks aren't on the path |
| Visibility to kernel callbacks | Same as before — kernel sees everything | Same — kernel sees everything |
| Detection signature | Process modified `ntdll.dll`'s `.text` | Process executing syscalls from non-`ntdll` memory pages |
| Ease of integration | Drop-in for existing code | Per-call rewrite needed |
| Robustness across Windows versions | Generic | Syscall numbers change per build |

Modern operator recipe: do **both**, sparingly. Unhook for general API quietness; use direct syscalls for the highest-signal ones (`NtCreateThreadEx`, `NtMapViewOfSection`, `NtUnmapViewOfSection`, `NtOpenProcess`).

## What unhooking can't help with

- Kernel-mode detection (PspCreateThreadNotifyRoutine, PspCreateProcessNotifyRoutineEx, ObCallbacks, ETW-TI).
- AMSI / .NET telemetry (separate path; see [AMSI bypass](/wiki/techniques/amsi-bypass/)).
- Network egress patterns.
- File-on-disk YARA hits.

## Detection

- Page-protection changes on `ntdll.dll`'s `.text`. EDR can query its own user-mode mapping vs the in-process mapping.
- Periodic re-hook with verification — if your bytes are gone, alert.
- Behavioural: a process performing legitimate work then suddenly doing memory-protect-and-write on `ntdll.dll`.
- Kernel callbacks notice the post-unhook syscall sequence regardless.

## See also

- [AMSI bypass](/wiki/techniques/amsi-bypass/) — paired technique.
- [BOFs](/wiki/concepts/beacon-object-files/) — direct syscalls inside BOFs.
- [EDR Silencing](/wiki/concepts/edr-silencing/).

## References

- Outflank — Cornelis de Plaa — *Combining Direct System Calls and sRDI to bypass AV/EDR* (2019-06-19) — <https://www.outflank.nl/blog/2019/06/19/red-team-tactics-combining-direct-system-calls-and-srdi-to-bypass-av-edr/>
- Outflank — *Direct Syscalls in Beacon Object Files* (2020-12-26) — <https://www.outflank.nl/blog/2020/12/26/direct-syscalls-in-beacon-object-files/>
- Outflank — Dima van de Wouw — *Solving The "Unhooking" Problem* (2023-10-05) — <https://www.outflank.nl/blog/2023/10/05/solving-the-unhooking-problem/>
- *Hells Gate* / *Halos Gate* — original disclosures by am0nsec / smelly__vx.
