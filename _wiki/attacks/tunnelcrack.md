---
title: "TunnelCrack — Leaking VPN Traffic via Routing Tables"
permalink: /wiki/attacks/tunnelcrack/
layout: single
author_profile: true
tags:
  - wifi
  - attack
  - vpn
  - routing-table
  - vanhoef
  - design-flaw
---

*Two design flaws (LocalNet, ServerIP) that trick a victim's VPN client into leaking traffic outside the tunnel — exploited from a malicious Wi-Fi network.*

**Status:** drafting
**Venue:** USENIX Security 2023
**Authors:** Nian Xue, Yashaswi Malla, Zihang Xia, Christina Pöpper (NYU Abu Dhabi), Mathy Vanhoef (KU Leuven)
**Related:** [Wi-Fi Key Hierarchy](/wiki/concepts/wifi-key-hierarchy/), [Client Isolation](/wiki/concepts/client-isolation/)

---

## What it is

A VPN's job is to ensure that all traffic leaves the device through the tunnel. That guarantee is enforced by the OS routing table — typically with a "catch-all" default route through the VPN, plus narrow exceptions for the VPN server's own IP and the local network. TunnelCrack abuses those exceptions.

The attack runs from a malicious Wi-Fi network the victim joins (coffee shop, hotel, conference). The attacker controls DHCP / DNS / gateway. Two attacks:

---

## LocalNet — push a route through the local-network exception

VPN clients commonly install a routing exception so that traffic to the local subnet (e.g., `192.168.1.0/24`) is *not* tunnelled — to keep printers, file shares, and the LAN gateway reachable. The malicious AP advertises a *very wide* local subnet (e.g., `0.0.0.0/1` and `128.0.0.0/1`) via DHCP. The VPN client installs that as the local-network exception → almost all of the IPv4 space falls outside the tunnel → traffic to public services leaks in cleartext.

---

## ServerIP — DNS-spoof the VPN server's address

The VPN client puts a host route to the *real* VPN server's IP outside the tunnel (otherwise the encapsulation would be circular). The attacker DNS-spoofs the VPN server's hostname to a third-party IP — say, the IP of a popular public website. The client now routes traffic to that *public* IP outside the tunnel. The attacker can selectively leak any service whose IP they can pin to that hostname's resolution.

---

## Vulnerability scope

The paper tests a wide range of VPN products on multiple OSes:

- **iOS / macOS** — almost universally vulnerable; the OS treats certain routing decisions opaquely.
- **Windows / Linux** — majority vulnerable.
- **Android** — most resistant; ~25 % of apps tested were vulnerable.
- **OpenVPN, IKEv2/IPsec, WireGuard implementations** — all affected at least in some form.

CVE cluster: CVE-2023-36671 (LocalNet), CVE-2023-36672 / CVE-2023-35838 / CVE-2023-36673 (variants).

---

## What stops it

- **Disable the local-network exception** when on untrusted Wi-Fi (some VPN clients ship a "Block Local LAN" toggle — turn it on).
- **Use the VPN server's IP** rather than its hostname, where the client allows.
- **DNS-resolve the server's IP only over the VPN** (chicken-and-egg solvable with a fixed bootstrap DNS).
- **Patches** — VPN vendors updated their routing logic to refuse ultra-wide local-network advertisements and to validate server-IP resolution against signed records.

---

## Why it matters

TunnelCrack is the inverse of the usual Wi-Fi attack: instead of breaking the link-layer crypto, it manipulates layer-3 routing inside the victim. The attacker doesn't need to break encryption — they convince the victim's stack to *not encrypt* in the first place. The attack reinforces a recurring theme in the Vanhoef research line: trust boundaries in deployed systems are placed in the wrong layer (or in no layer at all).

---

## References

- Nian Xue, Yashaswi Malla, Zihang Xia, Christina Pöpper, Mathy Vanhoef — *Bypassing Tunnels: Leaking VPN Client Traffic by Abusing Routing Tables* — USENIX Security 2023 — <https://papers.mathyvanhoef.com/usenix2023-tunnelcrack.pdf>
- Project page — <https://tunnelcrack.mathyvanhoef.com/>
- PoC repo — <https://github.com/vanhoefm/vpnleaks>
