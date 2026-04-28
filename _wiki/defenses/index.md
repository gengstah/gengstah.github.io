---
title: Defences — Index
permalink: /wiki/defenses/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- defense
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
redirect_from:
- /wiki/airsnitch/defenses/index/
---

# Defences

No single mitigation stops every AirSnitch attack. The paper is explicit about this (NDSS'26 §VIII, README §6): you need a **combination**. This page is a defence-vs-attack matrix and an index into the per-defence pages.

## Matrix

✓ = stops the attack. ◐ = partial / configuration-dependent. ✗ = does not stop.

| Defence | [Abusing GTK](/wiki/attacks/abusing-gtk/) | [Gateway Bouncing](/wiki/attacks/gateway-bouncing/) | [Port Stealing](/wiki/attacks/port-stealing/) | [Broadcast Reflection](/wiki/attacks/broadcast-reflection/) | [Machine-on-the-side](/wiki/attacks/machine-on-the-side/) | [Rogue AP](/wiki/attacks/rogue-ap/) | [Passpoint flaws](/wiki/attacks/passpoint-flaws/) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [Group key randomization](/wiki/defenses/group-key-randomization/) (every handshake + IGTK) | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| [VLANs / firewall](/wiki/defenses/vlans/) | ◐ (cross-VLAN only) | ✓ | ✓ | ✓ | ✗ | ✗ | ◐ |
| [MAC spoofing prevention](/wiki/defenses/spoofing-prevention/#mac-spoofing) | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| [IP spoofing prevention](/wiki/defenses/spoofing-prevention/#ip-spoofing) | ✗ | ◐ (return path) | ✗ | ✗ | ✗ | ✗ | ✗ |
| [Filter unicast IP in L2 broadcast](/wiki/defenses/filter-unicast-in-broadcast/) | ◐ (IPv4 only) | ✗ | ✗ | ◐ (IPv4 only) | ✗ | ✗ | ◐ |
| [MACsec](/wiki/defenses/macsec/) | ✓ | ✓ | ✓ | ✓ | ✓ | ◐ | ✓ |
| [Centralised decryption](/wiki/defenses/centralized-decryption/) | ◐ | ✓ | ◐ | ✓ | ✗ | ✗ | ◐ |
| [Move off shared passphrase](/wiki/concepts/wpa-versions/) (PPSK / Enterprise / WPA3-PK) | ✗ | ✗ | ✗ | ✗ | ✓ | ◐ | ✗ |
| [Reject duplicate MAC across BSSIDs](/wiki/defenses/spoofing-prevention/#duplicate-mac) | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| [Documentation / warnings](/wiki/defenses/documentation/) | indirect | indirect | indirect | indirect | indirect | indirect | indirect |

## Recommended baseline

(Synthesised from NDSS'26 §VIII-C and README §6.)

If you operate a Wi-Fi network and you actually care about isolation between clients:

1. **Don't run WPA2-PSK with shared passphrase if you care about isolation between users.** Shared-password isolation is "fundamentally flawed" (NDSS'26 §IV-A header). Move to WPA3-SAE at minimum, ideally Enterprise or PPSK.
2. **Put guest networks in their own VLAN with firewall rules** that prevent guest→main and (if your threat model demands it) guest→guest IP forwarding. ([VLANs](/wiki/defenses/vlans/).)
3. **Enable per-client randomized GTK** if your AP supports it — and test that the randomization extends to the [group-key handshake, FT, FILS, and WNM-Sleep](/wiki/defenses/group-key-randomization/), not just the 4-way.
4. **Enable IGTK randomization** if your AP follows Passpoint v3.4 or has a vendor option.
5. **Enable MAC spoofing prevention** — at minimum, refuse a Wi-Fi association with a MAC already used by an internal wired device (gateway, DNS, RADIUS server). Bonus: refuse duplicate MAC across BSSIDs.
6. **Set the OS sysctl `drop_unicast_in_l2_multicast=1` on Linux clients.** Doesn't stop the attack class, but at least IPv4 group-ping injection is blocked.
7. **Document what your client-isolation setting actually does.** In a real deployment guide, with concrete answers to: "are guests allowed to talk to each other?", "are they allowed to talk to the main network?", "are wired devices isolated?". See [documentation](/wiki/defenses/documentation/).

## When budget allows

- **MACsec end-to-end** between Wi-Fi clients and the gateway. The only single defence that stops every AirSnitch primary attack. See [MACsec](/wiki/defenses/macsec/).
- **Centralised Wi-Fi decryption** at a controller, taking the decryption boundary off the AP-local bridge. Cisco enterprise gear can do this; the AirSnitch authors found it makes attacks harder (NDSS'26 §VIII-C).

## Per-defence pages

- [Group key randomization](/wiki/defenses/group-key-randomization/)
- [VLANs and firewall](/wiki/defenses/vlans/)
- [MAC and IP spoofing prevention](/wiki/defenses/spoofing-prevention/)
- [Filter unicast IP in L2 broadcast](/wiki/defenses/filter-unicast-in-broadcast/)
- [MACsec](/wiki/defenses/macsec/)
- [Centralised Wi-Fi decryption](/wiki/defenses/centralized-decryption/)
- [Documentation and warnings](/wiki/defenses/documentation/)

## See also

- [Overview](/wiki/concepts/airsnitch-overview/)
- [Tested devices](/wiki/devices/tested-devices/) — which products the AirSnitch team tested and which defences each ships with.
