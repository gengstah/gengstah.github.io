---
title: "Windows RPC — Internals and Reverse Engineering for Vulnerability Research"
permalink: /wiki/concepts/windows-rpc/
layout: single
author_profile: true
tags:
- windows-exploit-research
- user-mode
- concept
- rpc
---

> **Last updated:** 2026-07-02  
> **Related:** [Windows Exploit Research Overview](/wiki/concepts/windows-exploit-research-overview/), [Windows Service Triggers](/wiki/concepts/windows-service-triggers/), [C++ Exception Reversing](/wiki/concepts/cpp-exception-reversing/), [CVE-2025-21297 (RD Gateway)](/wiki/cves/CVE-2025-21297/)  
> **Tags:** `user-mode`, `rpc`, `reverse-engineering`

## Summary

Microsoft RPC (MS-RPC / DCE-RPC) is the plumbing behind a huge fraction of Windows' local and remote attack surface — LSASS, the print spooler, the Task Scheduler, RD Licensing, and countless other services expose functionality as RPC interfaces. For a vulnerability researcher the job is to **enumerate** the interfaces a target exposes, **recover** their method signatures and marshalling (which MIDL/NDR erases from the binary), and then reason about which methods are reachable pre-auth and what they do with attacker-controlled input. This page distils the registration → invocation → marshalling → reversing pipeline.

---

## Server-side Registration

A server binds a transport with `RpcServerUseProtseqEp`, choosing one of three protocol sequences:

| Protseq | Transport | Reach |
|---|---|---|
| `ncalrpc` | ALPC | local IPC only |
| `ncacn_np` | named pipes | local + network (over SMB) |
| `ncacn_ip_tcp` | TCP/IP sockets | network |

It then registers each interface with `RpcServerRegisterIf2` / `RpcServerRegisterIf3`, optionally passing security flags such as `RPC_IF_ALLOW_SECURE_ONLY` and a `SecurityCallback`. Registration populates:

- **`RPC_SERVER_INTERFACE`** — the interface UUID and its dispatch table.
- **`MIDL_SERVER_INFO`** — pointers to the server routine table and the format strings.
- **`SERVER_ROUTINE` table** — maps procedure number → implementation function.

> **OPSEC/authz gotcha:** a `SecurityCallback` that unconditionally returns `RPC_S_OK` provides *no* protection — a common finding when auditing "authenticated" RPC servers.

---

## Client-side Invocation

```
RpcStringBindingCompose()  → RpcBindingFromStringBinding()  → RPC_BINDING_HANDLE
  → NdrClientCall3(&proxy_info, proc_num, ...serialized args...)
```

`NdrClientCall3` is the modern (NDR64) stubless entry; parameters are marshalled per the format strings.

---

## MIDL / NDR Marshalling

MIDL compilation turns the IDL into **format strings** that describe how each parameter is (de)serialised. The pieces to recognise while reversing:

- **`MIDL_PROC_FORMAT_STRING`** — per-proc parameter attributes and offsets.
- **`NDR64_PARAM_FORMAT`** — one per parameter, with flags: `MustSize`, `MustFree`, `IsIn`, `IsOut`, `IsSimpleRef`.
- **`NDR64_FORMAT_CHAR`** type tags — e.g. `FC64_UINT8`, `FC64_STRUCT`, `FC64_CONF_ARRAY`, `FC64_UP` (unique pointer), `FC64_END` (terminator).
- **Correlation descriptors** (`NDR64_EXPR_VAR`) — variable-length array size derived from another field; e.g. `size_is(f_8)` means the array length comes from the field at offset `0x8`. Recovering these correlations is what tells you the real size semantics an attacker controls.

---

## Reverse-Engineering an RPC Interface

**1. Static — from the server binary.** Find `MIDL_SYNTAX_INFO` (often at `+0x50`), which points at the `SERVER_ROUTINE` table (e.g. `<Iface>_ServerRoutineTable`) mapping proc index → function address, and at the NDR64 proc table (`<Iface>_Ndr64ProcTable`) whose `NDR64_FORMAT_CHAR` bytes encode each parameter's type. Where automated IDL recovery fails, parse the format strings by hand.

**2. Runtime — debugging.** Break in `NdrClientCall3`, walk the `MIDL_STUBLESS_PROXY_INFO` and binding handle to recover the endpoint string (e.g. `"lsasspirpc"`) and proc number of live calls.

**3. Tooling — RpcView.** Enumerates active RPC servers/interfaces and can decompile IDL from the binary format strings; fall back to manual format-string parsing when its decompiler chokes.

---

## Why This Matters for VR

Recovering the interface tells you the **function signatures, buffer/size correlations, and authentication requirements** — exactly the inputs needed to spot memory-safety bugs (mismatched `size_is`, missing bounds checks) and to judge reachability (pre-auth vs. authenticated, local vs. remote). Privileged RPC servers are a rich privilege-escalation and RCE surface.

---

## Worked Example — RD Licensing `HashChallengeData` OOB Read

The Windows **Remote Desktop Licensing** service (`lserver.dll`) exposes an unauthenticated RPC interface (119 procedures, registered with `flags = 0`, e.g. on TCP/49683). Recovering the IDL exposed a buffer over-read in `HashChallengeData`, reached via:

```
Proc1_TLSRpcConnect            // establish session
Proc44_TLSRpcChallengeServer   // → TLSRpcChallengeServer → HashChallengeData → CryptHashData
```

`HashChallengeData` takes a requested length (`a3`) and an actual buffer size (`a5`) from a client-supplied structure and, pre-patch, hashed `a3` bytes without checking `a3 <= a5`:

```c
struct uknown1 { int f1, f2, f3 /*claimed len*/, f4; unsigned char* buff; int f18 /*actual size*/, f1c; unsigned char* buff2; };
```

Setting `f3 = 256` while `f18 = 16` makes `CryptHashData` read far past the 16-byte allocation — crashing in `bcryptPrimitives!SymCryptMd5AppendBlocks+0x90` on an invalid address, i.e. an information-disclosure / DoS over-read (CWE-125). The patch adds a feature-gated bounds check (`a5 - 1 > 0x3F || a5 < v10 …`) ensuring the claimed length fits the buffer. This is the canonical VR loop: **enumerate interface → recover size correlations → find the missing `len <= bufsize` check.**

---

## References

- VictorV (@V-V), "Windows RPC 介绍", v-v.space, 2023-09-06 — <https://v-v.space/2023/09/06/rpc_readme/>
- VictorV (@V-V), "Windows Remote Desktop Licensing Service 漏洞解析", v-v.space, 2024-07-29 — <https://v-v.space/2024/07/29/rdp_license_server_bugs/>
- RpcView — <https://www.rpcview.org/>
