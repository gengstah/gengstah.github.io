---
title: "Early Cascade Injection"
permalink: /wiki/techniques/early-cascade-injection/
layout: single
author_profile: true
tags:
  - technique
  - process-injection
  - windows
  - early-cascade
  - outflank
---

*A process-injection technique that hijacks Windows process creation **before** the victim's main image is fully initialised. The attacker spawns a target process suspended, then uses the early-loader phase to inject — winning the race against EDR's per-process notify-routine because the routine fires later in the lifecycle than where the injection lands.*

**Status:** drafting
**Related:** [EDR Unhooking](/wiki/techniques/edr-unhooking/), [AMSI bypass](/wiki/techniques/amsi-bypass/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What "early cascade" means

Standard Windows process creation:

```
NtCreateUserProcess
   │
   ▼
NTDLL!LdrpInitializeProcess  (in remote process, in the early-init thread)
   │
   ├── Snap KnownDlls (kernel32, kernelbase, etc.)
   ├── Run TLS callbacks of static-loaded DLLs
   ├── Call DllMain(DLL_PROCESS_ATTACH) for static DLLs in dependency order
   ├── Map the user-supplied APC queue
   ├── Run import-resolution
   ▼
KERNEL32!BaseThreadInitThunk
   ▼
<image entry point — wWinMainCRTStartup, etc.>
```

EDR products typically register `PspCreateProcessNotifyRoutineEx` (kernel callback), `PsSetCreateThreadNotifyRoutineEx`, and instrument process spawn. These callbacks fire at well-defined kernel events — process creation, image load — most of which happen *before* the user-mode entry point but *after* certain early-init phases.

**Early Cascade Injection** times its work to the gap: places a payload in the target's address space and arranges for the payload to run during a *very* early loader phase, before the kernel callback fires at a stage when EDR's userland pre-injected hooks are scanning.

## The technique (Outflank, 2024-10-15)

Dima van de Wouw's writeup walks the canonical primitive. Sketch:

1. **Spawn target suspended.** `CreateProcessW(..., CREATE_SUSPENDED, ...)` against a benign signed binary.
2. **Map a payload section** into the suspended process via `NtCreateSection` + `NtMapViewOfSection`. The section is the shellcode / DLL the operator wants to execute.
3. **Hijack a pointer in the early-loader path.** The technique identifies a writable function pointer or callback table that the loader dereferences before the EDR's image-load callback fires. Common candidates:
   - TLS callback table of a statically loaded DLL.
   - Specific PEB / loader-data fields the early-init thread touches.
   - APC queue entries scheduled for the initial thread.
4. **Resume the process.** The suspended thread resumes, hits the loader phase, dereferences the hijacked pointer, jumps into the operator's payload — *before* any kernel image-load callback registers the unusual section as a load event.
5. After the payload runs (typically setting up further state in the host process), control returns to the loader and the process continues normally. From the OS's perspective the process is still the benign signed binary; the operator's code just ran during initialisation.

## Why "cascade"

The technique chains through multiple early-loader phases. Each phase's function pointer is a potential injection point; the operator picks one and lets the cascade carry execution to the payload.

## What's evaded

- **EDR userland inline hooks.** The injection lands in code paths the operator's payload runs *before* the EDR's hooks have a chance to engage on the target process — because the target process at that moment hasn't fully resolved imports, so there's no `ntdll.dll` hook to fire.
- **Kernel image-load notify routines.** Because the section mapped is shellcode, not an image, the standard image-load callback path is skipped. Some EDRs catch arbitrary section maps via Object Manager callbacks, but coverage varies.
- **YARA on disk.** The benign binary is unchanged on disk; only memory state is hostile.

## What's not evaded

- **Memory-scanning EDRs** that periodically inspect process memory regions for suspicious sections / RWX pages.
- **Behavioural detection** post-injection — the injected payload still has to do something, and that something is visible.
- **Defender's "Tampering" surface** — Defender ATP added detections for some early-cascade-equivalent patterns post-disclosure.

## Detection

- Suspended-spawn followed by `NtCreateSection` / `NtMapViewOfSection` from the parent into the child, then resume — the timing pattern alone is rare.
- Initial thread executing memory regions that aren't in the loaded image's `.text`.
- ETW-TI events for unusual section mapping into a process before it has resolved its IAT.
- Outflank's own internal Sigma / detection rules (referenced in the post) hit the canonical primitive.

## Variants

- **Module Stomping** — overwrite an existing legitimate module's `.text` with shellcode. Pre-Early-Cascade tradecraft.
- **Phantom DLL Hollowing** — map a DLL section that doesn't exist on disk. Covered in earlier research.
- **Process Doppelgänging / Herpaderping** — older techniques exploiting transactional NTFS / image-section mismatches. Killed by patches; conceptually adjacent.
- Early Cascade is the 2024-era refinement that survives current-gen EDR.

## See also

- [EDR Unhooking](/wiki/techniques/edr-unhooking/) — usually paired.
- [Linux process injection](/wiki/concepts/linux-process-injection/) — equivalent on Linux is much simpler.
- [AMSI bypass](/wiki/techniques/amsi-bypass/) — what the post-injection .NET payload often does next.

## References

- Outflank — Dima van de Wouw — *Introducing Early Cascade Injection: From Windows Process Creation to Stealthy Injection* (2024-10-15) — <https://www.outflank.nl/blog/2024/10/15/introducing-early-cascade-injection-from-windows-process-creation-to-stealthy-injection/>
