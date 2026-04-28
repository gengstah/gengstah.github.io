---
title: Management Frame Protection (MFP / 802.11w)
permalink: /wiki/concepts/mfp/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
updated: 2026-04-28
redirect_from:
- /wiki/concepts/mfp/
---

**MFP** (IEEE 802.11w) is what you turn on when you don't want random attackers to deauth your clients off the network. It cryptographically protects a subset of management frames so they can't be forged after a client is associated.

In AirSnitch's analysis, MFP raises the bar for a couple of attacks but doesn't defeat them.

## What MFP protects

- **Unicast management frames** (deauthentication, disassociation, action frames) are protected by the [PTK](/wiki/concepts/wifi-key-hierarchy/) — same key as data frames.
- **Broadcast/multicast management frames** are *authenticated* (not encrypted) by the [IGTK](/wiki/concepts/wifi-key-hierarchy/). MFP introduces the IGTK exactly for this purpose.

What MFP does **not** protect:

- The frames sent *before* the 4-way handshake completes (probe responses, beacons, association request/response, the EAPOL frames themselves). These are all unprotected at any WPA level. A rogue AP advertising the same SSID still gets to be a candidate during scanning.
- Beacon contents (until WPA3 BIGTK is enabled).
- Channel-switch announcement frames in some configurations — exploitable to herd clients to a rogue AP's channel even with MFP on (NDSS'26 §IV-A, citing Vanhoef & Pöpper 2020).

## How AirSnitch interacts with MFP

| Attack | Effect of MFP |
| --- | --- |
| [Machine-on-the-side](/wiki/attacks/machine-on-the-side/) | MFP blocks unauthenticated deauth, so the attacker can't trivially disconnect the victim to capture a fresh handshake. Workaround: wait for a natural disconnect, or use channel-switch beacon trick. |
| [Rogue AP](/wiki/attacks/rogue-ap/) | MFP doesn't prevent the rogue AP itself; it only protects an existing association on the *real* AP. Once the victim roams, MFP is irrelevant. |
| [Passpoint flaws](/wiki/attacks/passpoint-flaws/) | The forged broadcast WNM-Sleep Response is authenticated under the *shared* IGTK that MFP uses. MFP is the very mechanism that makes the attack work. |
| [Abusing GTK](/wiki/attacks/abusing-gtk/) | Independent of MFP — GTK protects data frames, not management. |
| [Gateway Bouncing](/wiki/attacks/gateway-bouncing/), [Port Stealing](/wiki/attacks/port-stealing/), [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) | Independent of MFP — happen above L2 cryptography. |

## Status by mode

- **WPA2-Personal**: MFP optional. Off by default in many home routers.
- **WPA3-Personal (SAE)**: MFP **mandatory**.
- **WPA2-Enterprise**: MFP optional, increasingly required.
- **WPA3-Enterprise**: MFP mandatory.

## Summary

MFP fixes a separate, real problem (unauthenticated deauth → trivial DoS / forced reassociation). It is not a defence against most AirSnitch attacks, and in the Passpoint-flaws case, the IGTK introduced by MFP is what the attacker abuses. Still worth keeping enabled — every layer of authenticated management state shrinks the attack surface, and the alternative is no protection at all.

## See also

- [Wi-Fi key hierarchy](/wiki/concepts/wifi-key-hierarchy/)
- [Handshakes](/wiki/concepts/handshakes/)
- [Machine-on-the-side](/wiki/attacks/machine-on-the-side/)
- [Passpoint flaws](/wiki/attacks/passpoint-flaws/)
