---
title: ARP — Address Resolution Protocol
permalink: /wiki/concepts/arp/
layout: single
author_profile: true
tags:
- wifi
- networking
- concept
sources:
- ndss2026-paper
- arp-over-gtk-blog
updated: 2026-05-02
---

ARP (RFC 826) maps IPv4 addresses to link-layer (MAC) addresses on the same broadcast domain. Every IPv4 host on an Ethernet or Wi-Fi LAN runs an ARP cache; every outbound IP packet whose next hop sits on the local segment first triggers a cache lookup, then an ARP request if the cache misses, and only then leaves the host.

The protocol is unauthenticated. There is no signature, no nonce, no sequence number, and no reply-binding to the request that produced it. A host that receives an ARP frame trusts the sender for the contents, subject only to whatever local hardening the OS applies (most commonly, none).

## Frame layout

ARP rides directly on Ethernet/Wi-Fi as EtherType `0x0806`. The payload is fixed-size and identical for request and reply:

```
ARP {
  htype  = 1 (Ethernet)
  ptype  = 0x0800 (IPv4)
  hlen   = 6
  plen   = 4
  op     = 1 (request) | 2 (reply)
  hwsrc  = sender MAC
  psrc   = sender IPv4
  hwdst  = target MAC (zero on request, sender of request on reply)
  pdst   = target IPv4
}
```

Wire format:

- An **ARP request** is sent as an Ethernet broadcast (`ff:ff:ff:ff:ff:ff`). The whole segment hears it. Only the host owning `pdst` answers.
- An **ARP reply** is normally a unicast back to `hwdst`, but most stacks accept replies and updates equally well from broadcast frames.
- A **gratuitous ARP** is an unsolicited reply (or a self-targeted request) a host emits to announce a new `(IP, MAC)` binding — used for IP move, failover, and (historically) duplicate-address detection.

## ARP cache behaviour

The cache is a per-interface map of `IP → (MAC, state, expiry)`. States vary by stack but generally include:

- `INCOMPLETE` — request sent, waiting for reply.
- `REACHABLE` — confirmed within the ARP cache timeout (Linux: ~30 s base, refreshed on use).
- `STALE` — past the freshness window but still usable; next use triggers a unicast probe.
- `PROBE` / `FAILED` — actively re-checking or given up.

The default Linux behaviour for unsolicited ARP frames is governed by `arp_accept` (per-interface sysctl):

- `arp_accept=0` (default) — unsolicited replies are ignored if no entry exists; existing entries are updated (the looser branch). The exact branch depends on `arp_ignore` and `arp_announce` too.
- `arp_accept=1` — gratuitous ARPs *create* new cache entries.

Combined with a *populated* cache for the spoofed IP, `arp_accept=0` causes the kernel to ignore unsolicited replies that don't match the existing entry. That is the per-host hardening lever an admin actually has against ARP poisoning. Windows behaves analogously (the `Strict ICMP Source Routing` / `EnableICMPRedirect` cluster, plus persistent ARP entries via `netsh interface ipv4 add neighbors`).

## ARP on Wi-Fi

ARP on a Wi-Fi network behaves like ARP on Ethernet because the AP's bridge fans broadcast frames out across all member ports — including the wireless side. Two architectural differences matter for offence:

1. **The broadcast domain spans the air.** A wireless client's ARP request is a real Ethernet broadcast that the AP repeats over the air to every other associated client (encrypted under the [GTK](/wiki/concepts/wifi-key-hierarchy/)). Every station hears every ARP. This is what makes [Proxy ARP](#proxy-arp) attractive on the AP — it suppresses that broadcast and answers from a cache.

2. **The AP's bridge sits between wireless and wired segments.** Bridge-side defences ([DAI](/wiki/defenses/dynamic-arp-inspection/), DHCP-snooping ARP filtering, IP-MAC binding, `ebtables`/`arptables`, MikroTik `arp=reply-only`, UniFi "ARP cache poisoning protection") all live on this bridge. They inspect ARPs that *cross* the bridge. They do not see — and cannot inspect — Wi-Fi frames that travel station-to-station over the air.

The second point is what [ARP over GTK](/wiki/attacks/arp-over-gtk/) exploits.

## Proxy ARP

Some APs run "Proxy ARP" (sometimes called "ARP offload"). The AP intercepts ARP requests on the wireless side and answers from its DHCP-snooping cache rather than broadcasting them. Three benefits:

- **Less Wi-Fi airtime spent on broadcast ARP.** Important on dense networks.
- **Doesn't wake sleeping clients.** ARP broadcasts otherwise burn battery on every associated station.
- **Closes one ARP-poisoning attack surface.** Forged from-DS broadcast ARP from a hostile station can be suppressed at the AP if the AP enforces "I am the only legitimate sender of from-DS broadcasts."

Hotspot 2.0 / Passpoint specifies Proxy ARP behaviour as part of the "DGAF Disable" optimisation; some enterprise APs ship it independently. It is rare on consumer routers in the default configuration.

## Why ARP is exploited

ARP poisoning is the foundational LAN MITM primitive. Once a victim's `arp_table[gateway_ip] = attacker_mac`, the victim sends every off-LAN packet to the attacker, who can then forward upstream (kernel `MASQUERADE` keeps the session alive) or drop it. This is the substrate underneath:

- Cleartext credential capture (FTP, Telnet, HTTP basic auth, SMB1).
- TLS downgrade attempts (`sslstrip` and successors against pre-HSTS sites).
- DNS hijacking on cleartext DNS.
- Captive-portal-style HTTP injection.
- Session theft against cookies that aren't `Secure` + `HttpOnly` + `SameSite`.

Modern defences against most of these (HSTS, DoH/DoT, TLS pinning, HTTP/3, MACsec) have raised the bar considerably, but ARP poisoning still puts the attacker on path, which is half the work for any LAN attack.

## See also

- [ARP spoofing](/wiki/attacks/arp-spoofing/) — the classic LAN poisoning attack.
- [ARP over GTK](/wiki/attacks/arp-over-gtk/) — the Wi-Fi variant that bypasses bridge-side defences.
- [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/) — the canonical bridge-side defence (and why it isn't in the path on Wi-Fi).
- [Endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/) — `arp_accept=0`, static entries.
- [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/) — where the GTK fits.
- [Client isolation](/wiki/concepts/client-isolation/) — the AP-side knob most admins reach for first; orthogonal to ARP.

## References

- RFC 826 — *An Ethernet Address Resolution Protocol*.
- RFC 5227 — *IPv4 Address Conflict Detection*.
- Linux kernel `Documentation/networking/ip-sysctl.rst` — `arp_accept`, `arp_ignore`, `arp_announce`, `arp_notify`.
- Hotspot 2.0 Release 2 / Passpoint — Proxy ARP / DGAF Disable.
