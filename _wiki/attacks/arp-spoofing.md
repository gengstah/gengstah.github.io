---
title: ARP Spoofing
permalink: /wiki/attacks/arp-spoofing/
layout: single
author_profile: true
tags:
- networking
- mitm
- attack
sources:
- arp-over-gtk-blog
updated: 2026-05-02
---

ARP spoofing — also called ARP poisoning, ARP cache poisoning, or "the original LAN MITM" — is the classic primitive for putting an attacker on path between two hosts on the same broadcast domain. The attacker forges [ARP](/wiki/concepts/arp/) frames whose `(psrc, hwsrc)` pairing claims an IP the attacker doesn't own, the victim's stack accepts the claim and updates its cache, and from then on traffic to that IP routes to the attacker.

## The primitive

The minimal poisoning frame is an unsolicited ARP reply:

```
op    = 2 (reply)
psrc  = <IP being claimed>          # usually the gateway
hwsrc = <attacker MAC>              # or any MAC the attacker controls
pdst  = <victim IP>
hwdst = <victim MAC>                # so the frame can be unicast
```

Sent at any cadence (once per second is conventional in `arpspoof`), this overwrites the victim's `arp_table[gateway_ip] = attacker_mac` faster than the gateway's legitimate refresh.

A symmetric pair of poisoners — claim the gateway to the victim *and* the victim to the gateway — gives the attacker bidirectional visibility. The attacker forwards traffic between the two using a kernel `MASQUERADE` (Linux `iptables -t nat -A POSTROUTING -j MASQUERADE`) or `ip_forward=1` plus appropriate filter rules; sessions stay alive and the victim doesn't notice the redirect.

## What it enables

Once on path:

- Cleartext credential capture on protocols that don't pin TLS — FTP, Telnet, SMTP/IMAP/POP3 without STARTTLS, SMB1, HTTP basic auth, internal HTTP services.
- TLS downgrade attempts (`sslstrip` against pre-HSTS sites, captive-portal-style intermediation, mixed-content abuse).
- DNS hijacking on cleartext DNS (still common on home networks).
- Cookie theft for sessions that lack `Secure` + `HttpOnly` + `SameSite`.
- Selective drop / delay for availability attacks against single flows.

The redirect is the enabling step. Modern protocols (HSTS, DoH/DoT, WPA3-Enterprise on the link itself, MACsec) blunt many post-redirect payloads, but ARP spoofing still puts the attacker on path, which remains valuable for whatever cleartext or weakly-bound traffic is left.

## Discovery (target enumeration)

Before poisoning a victim the attacker needs the victim's MAC. Two approaches:

1. **Active.** Send an ARP request to the victim's IP (a normal `who-has`). The reply binds the IP to the MAC. On Wi-Fi, this works in both directions: the attacker can also send a [GTK-encrypted from-DS broadcast ARP request](/wiki/attacks/arp-over-gtk/) and listen for the bridged unicast reply.
2. **Passive.** Sniff the broadcast domain for any frame the victim transmits and read `addr2`/`hwsrc`.

A third option some toolsets use is to broadcast a poisoner addressed to `pdst=<victim>, hwdst=ff:ff:ff:ff:ff:ff` and rely on every station updating its cache. This is louder and usually unnecessary.

## Where the attack runs

ARP spoofing is broadcast-domain-scoped. The attacker has to be either on the same physical L2 segment as the victim, or on a path that lets them inject frames into that segment. Historically that meant *plugged into the same switch*. Modern variants:

- **Wired LAN.** The classic case. Mitigated on managed switches by [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/) (Cisco DAI), DHCP-snooping ARP filtering, or port security.
- **Wi-Fi (over the bridge).** A wireless client sends an ARP via the AP's bridge as it would on Ethernet. The same bridge-side defences apply, *if implemented on the AP*. Cisco IOS-XE, OpenWrt with `ebtables`, MikroTik `arp=reply-only`, UniFi "ARP cache poisoning protection" all hook this path.
- **Wi-Fi (over the air, GTK-encrypted broadcast).** [ARP over GTK](/wiki/attacks/arp-over-gtk/) — the variant where the attacker forges a from-DS broadcast frame addressed as if from the AP, encrypts it under the shared GTK, and emits it on a monitor interface. The frame never crosses the bridge. Every router-side ARP defence misses it.

## Tooling

The traditional triad:

- **`arpspoof` (dsniff)** — the canonical CLI, `arpspoof -i <iface> -t <victim> <gateway>`.
- **`ettercap`** — interactive TUI/GUI, with built-in poisoning, plugins, and content filters.
- **`bettercap`** — a modern Go rewrite of ettercap with a cleaner architecture and Wi-Fi-aware modules.
- **Custom Scapy** — `scapy` makes one-off poisoners trivial (~10 lines).

For the Wi-Fi variant: [arpgtk](/wiki/tools/arpgtk/) is the diagnostic that combines [GTK extraction](/wiki/attacks/abusing-gtk/) with an ARP-over-GTK probe. Its purpose is to *audit*, not to poison; the README is explicit about that.

## Defences

In rough order of where they sit in the network:

1. **Router / switch** — [DAI / DHCP-snooping ARP filter / IP-MAC binding](/wiki/defenses/dynamic-arp-inspection/). Strongest against wired and bridge-side ARP poisoners. Ineffective against the over-the-air [ARP over GTK](/wiki/attacks/arp-over-gtk/) variant.
2. **AP** — Proxy ARP (Hotspot 2.0 / Passpoint DGAF Disable, vendor equivalents) suppresses the broadcast surface. Per-client GTK randomisation kills the keying that ARP-over-GTK relies on. See [Group key randomization](/wiki/defenses/group-key-randomization/).
3. **Endpoint** — [ARP hardening](/wiki/defenses/endpoint-arp-hardening/): `arp_accept=0`, persistent entries for the gateway, OS-level firewall rules. Per-host hygiene; effective only if every host is hardened.
4. **L2 cryptography** — [MACsec](/wiki/defenses/macsec/). Strongest. Doesn't *prevent* poisoning — it makes the poisoned path uninteresting because traffic to the gateway is encrypted end-to-end at L2.

## See also

- [ARP](/wiki/concepts/arp/) — the protocol primer.
- [ARP over GTK](/wiki/attacks/arp-over-gtk/) — the Wi-Fi variant that bypasses bridge-side defences.
- [Abusing GTK](/wiki/attacks/abusing-gtk/) — the parent envelope (any unicast IP datagram inside a GTK-encrypted broadcast).
- [Dynamic ARP Inspection](/wiki/defenses/dynamic-arp-inspection/), [Endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/), [MACsec](/wiki/defenses/macsec/) — defences.

## References

- Song, D. — `arpspoof` source, dsniff suite (~1999).
- bettercap project documentation, ARP spoof module.
- RFC 826, RFC 5227.
