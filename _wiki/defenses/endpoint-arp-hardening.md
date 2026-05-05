---
title: Endpoint ARP Hardening
permalink: /wiki/defenses/endpoint-arp-hardening/
layout: single
author_profile: true
tags:
- networking
- defense
- endpoint
sources:
- arp-over-gtk-blog
updated: 2026-05-02
---

> Targets: [ARP spoofing](/wiki/attacks/arp-spoofing/) and [ARP over GTK](/wiki/attacks/arp-over-gtk/) — at the per-host layer, after every network-side defence has either fired or failed.

Per-host ARP hardening is the last layer. It does not stop a malicious ARP from arriving; it controls whether the kernel updates its cache when one does. Per-host hygiene is real but only effective if every host on the network is hardened, which in practice means a managed-endpoint fleet.

## Linux

The relevant sysctls live under `net.ipv4.conf.<iface>.` (and the `all` / `default` parents):

| Sysctl | What it does |
| --- | --- |
| `arp_accept` | When `0` (default), unsolicited ARP replies that don't match an existing cache entry are ignored. When `1`, gratuitous ARPs *create* new entries. Set `0` everywhere that doesn't legitimately need gratuitous-ARP creation. |
| `arp_ignore` | Controls whether the kernel answers ARP requests at all. `1` = answer only when the target IP is configured on the receiving interface. `8` = never answer. Useful on multi-homed hosts to prevent ARP responses from leaking across interfaces. |
| `arp_announce` | Picks the source IP for outbound ARP requests. `2` = always use a primary IP from the outgoing interface. Hardens against the host advertising IPs from other interfaces. |
| `arp_notify` | When `1`, send a gratuitous ARP on link-up. Useful for high-availability, but predictable surface for an observer. |
| `drop_gratuitous_arp` | When `1`, drop gratuitous ARPs entirely. Aggressive; breaks failover. |

Recommended baseline for a hardened workstation:

```
net.ipv4.conf.all.arp_accept = 0
net.ipv4.conf.all.arp_ignore = 1
net.ipv4.conf.all.arp_announce = 2
net.ipv4.conf.default.arp_accept = 0
net.ipv4.conf.default.arp_ignore = 1
net.ipv4.conf.default.arp_announce = 2
```

Persist in `/etc/sysctl.d/99-arp-hardening.conf`.

`arp_accept=0` is the default, but combined with a *populated* cache entry for the spoofed IP, it causes the kernel to ignore unsolicited replies that don't match. The practical effect: against a target that has talked to the gateway recently (so the cache entry exists), ARP poisoning aimed at that gateway IP fails until the cache entry expires.

The blog post on ARP-over-GTK calls this out specifically as the per-host lever an admin actually has.

### Static ARP entries

The strongest per-host defence:

```sh
ip neigh add 192.168.1.1 lladdr aa:bb:cc:dd:ee:ff dev wlan0 nud permanent
```

`nud permanent` means the entry never expires and never gets overwritten by inbound ARP. Useful for the gateway and for any internal server whose MAC is known and stable. Brittle — every MAC change requires a config update — and it scales poorly past a handful of entries, but it is conclusive against ARP poisoning of those specific IPs.

## Windows

Windows behaves analogously. The relevant levers:

- **Persistent ARP entries:** `netsh interface ipv4 add neighbors "Wi-Fi" 192.168.1.1 aa-bb-cc-dd-ee-ff store=persistent`. Survives reboot, takes precedence over inbound ARP.
- **`Strict ICMP Source Routing` and `EnableICMPRedirect=0`** in the TCP/IP parameters registry hive — partial; closer to ICMP redirect hardening than ARP.
- **Windows Firewall / advanced** can drop inbound ARP via WFP filters at `FWPM_LAYER_INBOUND_MAC_FRAME_ETHERNET`, but vendor EDR is the more common enforcement point.
- **Group Policy** to disable LLMNR / NetBIOS-NS reduces the cleanup-after-poisoning surface (different attack family but commonly chained).

## macOS / iOS / Android

Limited per-host control. macOS has `ifconfig <iface> inet ... static-arp` for individual entries; iOS and Android expose nothing useful at the user-administrable layer. The realistic mitigation on those platforms is *upstream* — get the AP onto per-client GTK, deploy MACsec, or accept the residual risk.

## What this defence does and doesn't fix

**Does:**

- Prevent ARP-poisoning *overwrite* against IPs the host has an existing cache entry for.
- Prevent ARP-poisoning *creation* against IPs the host has never talked to (default `arp_accept=0` already does this).
- Make static-pinned IPs (gateway, internal DNS) immune.

**Does not:**

- Stop the ARP frame from arriving.
- Help hosts that haven't yet populated the cache for the target IP.
- Help against [ARP over GTK](/wiki/attacks/arp-over-gtk/) on a host that doesn't have the gateway's entry yet — the first ARP reply seen creates the entry, including the malicious one.
- Help against IPv6 NDP variants of the same idea (ARP is IPv4 only; NDP needs its own hardening — `accept_ra=0`, RA-Guard upstream, IPv6-specific Neighbor-Discovery sysctls).

## Combined deployment

Per-host hardening is necessary but not sufficient. It is the floor, not the ceiling. Deploy alongside:

- **[Group key randomization](/wiki/defenses/group-key-randomization/)** — the AP-side counterpart that closes the [ARP-over-GTK](/wiki/attacks/arp-over-gtk/) class at the source.
- **[Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/)** — the bridge-side counterpart that closes the wired and bridge-side wireless variants.
- **[VLANs](/wiki/defenses/vlans/)** — broadcast-domain segmentation that limits how far an ARP can travel in the first place.
- **[MACsec](/wiki/defenses/macsec/)** — for paths where impact mitigation matters more than poisoning prevention.

## See also

- [ARP](/wiki/concepts/arp/), [ARP spoofing](/wiki/attacks/arp-spoofing/), [ARP over GTK](/wiki/attacks/arp-over-gtk/)
- [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/) — the bridge-side complement.
- [Filter unicast IP in L2 broadcast](/wiki/defenses/filter-unicast-in-broadcast/) — the OS-side IP-layer counterpart.

## References

- Linux kernel `Documentation/networking/ip-sysctl.rst` — `arp_*` sysctls.
- Microsoft Docs — `netsh interface ipv4 add neighbors`.
- *Router-side ARP defenses don't catch what they don't see.* `gengstah.github.io`, 2026-05-02.
