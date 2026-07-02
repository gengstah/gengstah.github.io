---
title: "RDP Virtual Channels — Pre-Auth Attack Surface"
permalink: /wiki/concepts/rdp-virtual-channels/
layout: single
author_profile: true
tags:
- windows-exploit-research
- user-mode
- concept
- rdp
---

> **Last updated:** 2026-07-02  
> **Related:** [Windows RPC](/wiki/concepts/windows-rpc/), [Windows Exploit Research Overview](/wiki/concepts/windows-exploit-research-overview/), [CVE-2025-21297 (RD Gateway)](/wiki/cves/CVE-2025-21297/)  
> **Tags:** `user-mode`, `rdp`

## Summary

Windows Remote Desktop Services multiplexes functionality over **virtual channels**. Several of these channels are reachable **before authentication completes**, which makes them a prime remote attack surface — the same reason RDP has produced BlueKeep-class bugs. This page maps the channel-processing call chain and the pre-auth channel set, and uses an RDP-server memory-leak bug as a worked example.

---

## NLA and the Negotiation Order

**Network Level Authentication (NLA)** changes *when* protocol negotiation happens:

- **NLA off** — protocol negotiation occurs *before* credentials are exchanged, so channel-processing code is reachable by an unauthenticated attacker.
- **NLA on** — an encrypted channel is established with credentials first, then negotiation proceeds inside it, shrinking (but not always eliminating) the pre-auth surface.

Practically, a remote memory-corruption/leak bug in channel handling is exploitable when NLA is off, or when weak credentials let an attacker reach the authenticated path.

## Virtual-Channel Data Path

```
WDW_OnDataReceived
  → WDICART_IcaChannelInputEx
    → CRDPWDUMXStack::WDCallback_IcaChannelInput
      → CRDPWDUMXStack::OnVirtualChannelData   // dispatch to per-channel plugin
```

Channels observed reachable before full authentication include `rdpinpt`, `rdpgrfx`, `rdpcmd`, **`rdplic`**, `rdpdr`, `echo`, and several telemetry channels — each a candidate parser to audit.

---

## Worked Example — `rdplic` License PDU Memory Leak

In `CUMRDPLicPlugin::HandleClientLicensePdu` (the handler for `rdplic` license PDUs), after signalling an event the function **never triggers the event handler that would consume the allocated buffer**. Re-sending an identical command overwrites the pointer stored at the `memory_60h` slot, orphaning the previous allocation — a permanent memory leak until the service restarts. A four-thread PoC keeps connections alive against the server's disconnect-on-idle timeout and floods the PDU, driving remote memory exhaustion.

Microsoft's MSRC declined to fix it (a reliability leak, not memory corruption), and it was disclosed publicly. It is a clean illustration of the pre-auth channel surface: the bug sits behind `rdplic`, reachable with NLA off.

---

## Relevance to Offense

- **Reachability first** — enumerate which channels dispatch before auth; those parsers are the remote surface.
- **Bug classes** — RDP channel parsers have historically yielded OOB, UAF, and (as here) resource-exhaustion leaks. Contrast the RD *Gateway* singleton UAF in [CVE-2025-21297](/wiki/cves/CVE-2025-21297/), a different RDS component reached over the gateway tunnel.

---

## References

- VictorV (@V-V), "Windows 远程桌面服务端(RDP server) 内存泄露分享", v-v.space, 2023-02-22 — <https://v-v.space/2023/02/22/rdp_mem_leak_bug/>
