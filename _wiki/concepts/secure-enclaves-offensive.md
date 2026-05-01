---
title: "Secure Enclaves for Offensive Operations (VBS / VTL1)"
permalink: /wiki/concepts/secure-enclaves-offensive/
layout: single
author_profile: true
tags:
  - windows
  - vbs
  - secure-enclave
  - vtl1
  - evasion
  - outflank
---

*Repurposing Windows Virtualisation-Based Security (VBS) enclaves — VTL1 isolated user-mode regions — as hiding places for offensive payloads. Originally a defensive primitive (Credential Guard lives there); operators discovered it can run their code too.*

**Status:** drafting
**Related:** [Credential Guard Bypass](/wiki/concepts/credential-guard-bypass/), [EDR unhooking](/wiki/techniques/edr-unhooking/), [Outflank blog catalogue](/wiki/resources/outflank/)

---

## What a VBS enclave is

Windows Virtualisation-Based Security uses Hyper-V to split user-mode into two trust levels:

- **VTL0 (Normal World)** — what every "normal" Windows process runs in, including the kernel.
- **VTL1 (Secure World)** — a smaller, hypervisor-isolated user-mode hosted by `securekernel.exe`. NT cannot read VTL1 memory.

A **secure enclave** is a VTL1-resident user-mode region attached to a host process. The host process calls `CreateEnclave` / `LoadEnclaveData` / `InitializeEnclave` / `CallEnclave`. Code inside the enclave runs at a privilege the kernel can't introspect.

This is the same machinery that backs:

- Credential Guard (LSA Isolated, `lsaiso.exe`).
- Hypervisor-Protected Code Integrity (HVCI).
- Trusted Execution components (e.g. Windows Hello biometric pipeline, third-party Trusted Apps).

Secure enclaves are signed: the loader checks an Enclave Authentication Code (similar to a code signature) before instantiating. Only Microsoft-approved publishers (and developer-signed test certs in dev mode) are accepted.

## The offensive observation

Outflank's two-part series (Cedric Van Bockhaven, 2025-02-03 and 2025-06-16):

> *"What the kernel can't see, EDR can't see either."*

EDR products instrument the kernel and userland. They cannot read VTL1 memory; they don't have hooks into enclave entry points. If you can land code inside an enclave, the bulk of EDR telemetry is blind to it.

Three approaches:

### 1. Author your own signed enclave

Acquire (via legitimate developer-program registration) the right to sign enclaves. The signed enclave hosts whatever you put in it. Cost: high — Microsoft polices the enclave signing program, and using such a cert for offensive ops is a one-shot trade-off.

### 2. Hijack a vulnerable Microsoft-signed enclave

Microsoft's own enclave binaries (or third-party trusted-app enclaves) can have memory-corruption bugs. A loaded-but-vulnerable enclave gives the attacker code execution inside VTL1 the same way a userland exploit gives ring-3 execution. Outflank's Part II walks through the binary inspection methodology and the kinds of primitives that work in this constrained environment.

### 3. Use the host-side surface

Even without code-in-VTL1, the host process can use enclave APIs to obscure intermediate state. `LoadEnclaveData` writes to enclave memory the kernel cannot inspect; storing keys / decrypted payload / capability tokens there during a sensitive moment hides them from "EDR scans the host process's user-mode memory" telemetry.

## What hides well, what doesn't

Hides well:

- Memory inspection by EDR (kernel can't read VTL1 → EDR can't either).
- Userland API hooks placed by EDR in `ntdll.dll` *that the enclave doesn't go through* (enclave entry/exit goes via `CallEnclave`, not Win32 → ntdll → syscall).
- Volatile state — keys, decrypted blobs, capability tokens.

Does not hide:

- **Side effects.** Network egress, file writes, registry changes happen in VTL0 (the host process, after `CallEnclave` returns) and are visible.
- **Behavioural detection.** A signed-enclave-using process suddenly making EDR-shaped child processes still looks weird.
- **TPM / attestation paths.** Some enterprise endpoints attest enclave loads to a backend; non-corporate signers light up.

## Constraints inside an enclave

VTL1 is restricted user mode. From inside, you can:

- Access host-process memory the host has explicitly mapped in.
- Call back to host-side functions via `CallEnclave` continuation.
- Use a **subset** of the Win32 API: cryptography, memory management, basic synchronisation.

You cannot:

- Open files / handles directly. Filesystem access has to be host-mediated.
- Make arbitrary network calls. Same.
- Access kernel objects directly.

So the enclave is best at: holding state, doing decryption / signing, generating per-frame keys, executing C# stagers in-memory before handing host the next command. Less useful as a full beacon body.

## Detection

- Enumerate signed enclave loads: ETW provider `Microsoft-Windows-Hyper-V-VfpExt`, kernel events around `IoCreateEnclave`. A non-Microsoft enclave loaded by an unusual process is a flag.
- Behavioural: a process loading an enclave that subsequently performs untypical actions (network egress, child process creation).
- Software-Based attestation: enterprises with Defender for Endpoint can correlate enclave events to known-good baselines.

## Operational notes

This is current-research-grade tradecraft as of 2026, not commodity. The two Outflank posts are the dominant public reference; expect more variant work to appear over 2026.

## See also

- [Credential Guard Bypass](/wiki/concepts/credential-guard-bypass/) — the highest-profile defensive use of VBS.
- [EDR Unhooking](/wiki/techniques/edr-unhooking/), [EDR Silencing](/wiki/concepts/edr-silencing/) — adjacent evasion.

## References

- Outflank — Cedric Van Bockhaven — *Secure Enclaves for Offensive Operations (Part I)* (2025-02-03) — <https://www.outflank.nl/blog/2025/02/03/secure-enclaves-for-offensive-operations-part-i/>
- Outflank — *Secure Enclaves for Offensive Operations (Part II)* (2025-06-16) — <https://www.outflank.nl/blog/2025/06/16/secure-enclaves-for-offensive-operations-part-ii/>
- Microsoft — *Enclaves overview* — <https://learn.microsoft.com/en-us/windows/win32/trusted-execution/enclaves>
