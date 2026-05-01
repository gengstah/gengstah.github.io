---
title: "AMSI Bypass"
permalink: /wiki/techniques/amsi-bypass/
layout: single
author_profile: true
tags:
  - technique
  - amsi
  - evasion
  - windows
  - outflank
---

*Anti-Malware Scan Interface — the Windows API that VBA, PowerShell, JScript, .NET, WMI, and Office post-2019 hand suspicious payloads to before executing them. Bypassing AMSI is the price of running scripted offensive code on a modern Windows host. Outflank's writeups are part of the canonical reference set.*

**Status:** drafting
**Related:** [EDR Unhooking](/wiki/techniques/edr-unhooking/), [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/), [EDR Silencing](/wiki/concepts/edr-silencing/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What AMSI does

`amsi.dll` exposes a small API:

- `AmsiInitialize` — set up a context.
- `AmsiOpenSession`.
- `AmsiScanBuffer(amsiContext, buffer, length, contentName, session, &result)`.
- `AmsiScanString` (UTF-16 wrapper).

A consumer (Office, PowerShell, JScript / VBScript, .NET, WMI, OLE Automation) calls `AmsiScanBuffer` on payload candidates before passing them to the actual interpreter. The result is `AMSI_RESULT_DETECTED` (block) or `AMSI_RESULT_CLEAN` (allow). Defender (and any other registered AMSI provider) is the backend.

## The classic in-process bypass

Patch `AmsiScanBuffer` in your own process so it always returns `S_OK` with `result = 0` (clean):

```c
// approximate sketch
HMODULE h = GetModuleHandleW(L"amsi.dll");
BYTE *p = (BYTE *)GetProcAddress(h, "AmsiScanBuffer");
DWORD old;
VirtualProtect(p, 6, PAGE_EXECUTE_READWRITE, &old);
// xor eax, eax ; ret  (return S_OK with empty result)
memcpy(p, "\x31\xC0\xC3", 3);
VirtualProtect(p, 6, old, &old);
```

This single patch is enough to silence AMSI for the rest of the process's lifetime — until something re-loads `amsi.dll` or a kernel-mode-resident integrity check notices.

Defender added [Antimalware Notification](https://learn.microsoft.com/en-us/microsoft-365/security/intune-protect/antimalware-protection-amsi-pyramid-of-pain) telemetry for `AmsiScanBuffer` patching. Modern variants overwrite or call-redirect at slightly different offsets / register sequences to avoid the obvious signature.

## VBA-specific AMSI

Outflank's *Bypassing AMSI for VBA* (Pieter Ceelen, 2019-04-17) was the first canonical writeup of the VBA path:

- Office's VBA runtime calls `AmsiScanBuffer` at parse-and-run time on macro content.
- A macro that runs *first* and patches `AmsiScanBuffer` before the malicious code is scanned defeats the check for itself.

The chicken-and-egg: the patching macro itself goes through AMSI. So the patcher has to be:

- Small enough or string-obfuscated enough to not trip AMSI signatures.
- Run before the rest of the document's payload.

Outflank's post showed VBA that uses `CallByName` indirection on `kernel32` exports plus simple XOR encoding to land an `AmsiScanBuffer` patch without the patch code itself being a signature hit.

## Unmanaged .NET patching (post-AMSI-for-.NET)

Outflank's *Unmanaged .NET Patching* (Kyle Avery, 2024-02-01):

- Modern .NET ETW/AMSI integration emits events from inside `clr.dll` / `coreclr.dll` for assembly loads, JIT compilations, and run-time scans.
- The classic in-process AMSI patch covers `AmsiScanBuffer` but **not** the .NET-specific paths.
- Patching at the unmanaged .NET layer (e.g. `clr!CCorJitHost::SaveDebuggingData`-equivalent for AMSI / ETW telemetry) silences those events, restoring the "in-memory C# / .NET assembly" tradecraft that the post-2020 .NET-AMSI integration disrupted.

This is in-process, no kernel hook needed — but increasingly EDR products instrument .NET events through ETW providers exported to the kernel side, where in-process patching doesn't reach.

## ETW-related companion patches

AMSI is one of two main telemetry channels operators silence in-process. The other is **ETW-TI** (Event Tracing for Windows — Threat Intelligence). Patching `EtwEventWrite` in `ntdll.dll` to NOP / RET silences ETW events from the calling process. Combined with the AMSI patch, the process becomes substantially quieter.

```c
// Patch EtwEventWrite to ret 0
BYTE *etw = (BYTE *)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "EtwEventWrite");
DWORD old;
VirtualProtect(etw, 1, PAGE_EXECUTE_READWRITE, &old);
*etw = 0xC3; // ret
VirtualProtect(etw, 1, old, &old);
```

Modern EDRs counter by:

- Periodically re-comparing in-process `amsi.dll` / `ntdll.dll` against on-disk.
- Scanning for AMSI-patch byte-patterns and flagging.
- Moving high-value telemetry from `EtwEventWrite` to kernel-mode providers (which in-process patches can't reach).

## What patches don't bypass

- **Kernel ETW-TI sources** with no userland hook to patch.
- **EDR userland hooks on the path *to* AMSI** (some EDR products inline-hook the AMSI provider, not just `AmsiScanBuffer`).
- **Behavioural detection** of post-AMSI activity (LSASS access, named-pipe spawn, suspicious child process).
- **Patch-detection telemetry** that surfaces "process X modified amsi.dll memory pages".

## Operational notes

- Always restore page protection after patching. Failing to do so leaves a +RWX region — which itself is high-signal.
- Avoid the most-fingerprinted byte sequences. The `xor eax, eax; ret` pattern at the start of `AmsiScanBuffer` is the most-detected variant.
- Combine with [EDR Unhooking](/wiki/techniques/edr-unhooking/) so userland hooks aren't intercepting the patcher itself.

## See also

- [EDR Unhooking](/wiki/techniques/edr-unhooking/) — pair technique.
- [EDR Silencing](/wiki/concepts/edr-silencing/) — broader umbrella.
- [Office macro tradecraft](/wiki/concepts/office-macro-tradecraft/) — VBA AMSI specifically.

## References

- Outflank — Pieter Ceelen — *Bypassing AMSI for VBA* (2019-04-17) — <https://www.outflank.nl/blog/2019/04/17/bypassing-amsi-for-vba/>
- Outflank — Kyle Avery — *Unmanaged .NET Patching* (2024-02-01) — <https://www.outflank.nl/blog/2024/02/01/unmanaged-dotnet-patching/>
- Microsoft — *Antimalware Scan Interface* — <https://learn.microsoft.com/en-us/windows/win32/amsi/antimalware-scan-interface-portal>
