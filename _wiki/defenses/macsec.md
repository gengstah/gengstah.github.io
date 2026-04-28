---
title: MACsec (IEEE 802.1AE)
permalink: /wiki/defenses/macsec/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- defense
sources:
- ndss2026-paper
updated: 2026-04-28
redirect_from:
- /wiki/defenses/macsec/
---

# MACsec

> Single most powerful single defence against AirSnitch.

**MACsec** (IEEE 802.1AE) is layer-2 encryption with per-link-pair keys, originally designed for wired Ethernet. The AirSnitch authors verify that **MACsec can be combined with WPA2/3** by installing MACsec keys on top of the Wi-Fi association: the Wi-Fi link still runs WPA2/3, and on top of that, MACsec encrypts the L2 payload between the client and the gateway / another endpoint with a key the AP has no access to. (NDSS'26 §VIII-C.)

## Why it works

Every AirSnitch attack relies on the AP being able to **see** the cleartext of the traffic it forwards:

- [Gateway Bouncing](/wiki/attacks/gateway-bouncing/) needs the L3 destination to be readable by the gateway.
- [Port Stealing](/wiki/attacks/port-stealing/) needs the AP's bridge to forward the cleartext to the wrong port.
- [GTK abuse](/wiki/attacks/abusing-gtk/) needs the OS to accept a unicast IP datagram inside a broadcast frame.
- [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) needs the AP to re-encrypt cleartext under a different GTK.

If the L2 payload is wrapped in a MACsec SA between client and gateway, the cleartext is opaque to the AP. None of the attacks reach the application data:

- The AP can still mishandle frame routing — but the misrouted bytes are MACsec-encrypted gibberish.
- The AP can still re-encrypt frames for a broadcast - but the re-encrypted payload is still gibberish.
- An attacker who steals a port still gets the gibberish.

The attacker is reduced to **denial of service** — they can drop frames or scramble timing — but not interception or injection of meaningful traffic.

(NDSS'26 §VIII-C: "By combining encryption, integrity verification, and device authentication, MACsec can thwart our attacks.")

## What MACsec doesn't fix

- **[Rogue AP](/wiki/attacks/rogue-ap/)** — if the victim is induced to associate to a rogue AP, the rogue AP can refuse to negotiate MACsec. The victim then sees no MACsec peer; behaviour depends on the policy:
  - "MACsec required" → connection fails; user notices.
  - "MACsec preferred, fallback allowed" → silent downgrade, attack proceeds.
  - "MACsec optional" → not enforced.
  This is why the matrix shows `◐` for MACsec vs Rogue AP.
- **[Machine-on-the-side](/wiki/attacks/machine-on-the-side/)** for traffic that doesn't go through MACsec (e.g. broadcast ARP, DHCP). Those keep flowing in the clear at the Wi-Fi layer.

The right mental model: MACsec turns the AP and the Wi-Fi network into a dumb pipe between two endpoints that already trust each other. That's the strongest defence available, but it requires the endpoints to support MACsec and to enforce it.

## Practical deployment

- **Linux** has MACsec since kernel 4.6, configured with `ip link add link eth0 macsec0 type macsec ...`. Used in some enterprise setups.
- **macOS / iOS / Windows / Android** — limited or no native MACsec on Wi-Fi clients. As of 2026, this is the bottleneck.
- **Switches** — many enterprise switches support MACsec on uplinks. Less common on user-facing ports.
- **APs** — almost no consumer AP supports MACsec on the wired uplink, let alone on the Wi-Fi side.

The realistic deployment is enterprise-internal: client laptops on Linux, MACsec to a gateway, with the Wi-Fi acting as transport. Random user devices (phones, IoT, BYOD) won't participate.

## Operational considerations

- Key management is its own problem. MACsec uses MKA (MACsec Key Agreement, IEEE 802.1X-2010) for dynamic keying, often backed by a RADIUS-like infrastructure. For a small enterprise, that may add more attack surface (see [RADIUS](/wiki/concepts/radius/)) than it removes.
- MACsec adds 16-32 bytes of overhead per frame. Generally noticeable only at line-rate.
- Misconfigured MACsec can fail open (unencrypted) or fail closed (no connectivity). Test the failure mode.

## Where MACsec sits in the matrix

[Defences index](/wiki/defenses/) shows MACsec stops every primary AirSnitch attack except Rogue AP (where it gives only partial protection, depending on policy). It's the highest-leverage single defence — but the deployment cost is real, and most networks should also enable [VLANs](/wiki/defenses/vlans/) and [group key randomization](/wiki/defenses/group-key-randomization/) as table-stakes, regardless.

## See also

- [Defences index](/wiki/defenses/)
- [WPA versions](/wiki/concepts/wpa-versions/) — MACsec layers on top of any WPA mode.
- [Centralised decryption](/wiki/defenses/centralized-decryption/) — alternative for enterprises where MACsec at the client is impractical.
