---
title: Client Isolation
permalink: /wiki/airsnitch/concepts/client-isolation/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
---

**Client isolation** (also *AP isolation*, *station isolation*, *peer-to-peer blocking*) is a Wi-Fi network feature whose stated goal is to prevent associated clients from communicating with each other. It exists to mitigate insider attacks — a malicious guest on a coffee shop network shouldn't be able to ARP-poison another guest, a compromised IoT device shouldn't be able to reach a laptop on the same SSID.

## The problem: it isn't a standard

Client isolation **is not specified anywhere in IEEE 802.11** (NDSS'26 §I). Every vendor invented its own version, with its own boundaries, name, and configuration UI:

- TP-Link calls it "AP isolation" and recommends it "to protect the device against attacks from other devices in the same network" (Omada docs).
- Cisco Meraki calls it "wireless client isolation".
- ASUS calls it the "AP Isolated" feature.
- Linux/`hostapd` exposes it as `ap_isolate=1`.
- Cisco enterprise gear calls the related setting "P2P Blocking Action".
- LANCOM phrases it "Communication between end devices on this SSID".

Because there is no standard, there is no shared definition of what the feature must achieve. The NDSS'26 paper enumerates the behaviours implementations *typically* combine (NDSS'26 §III-A):

1. **Wi-Fi encryption** (WEP/TKIP/CCMP/GCMP) prevents over-the-air decryption by other clients.
2. **Intra-BSSID isolation** drops frames where the source and destination MACs both belong to clients on the same BSSID.
3. **Inter-BSSID isolation** drops frames between clients on different BSSIDs of the same network.
4. **Guest networks** put untrusted clients on a separate SSID with restricted forwarding.

## What it should guarantee (but rarely does)

Per the paper's "security expectations" (NDSS'26 §III-A), client isolation should hold across:

- clients on the same BSSID (intra-BSSID);
- clients on different BSSIDs of the same (E)SSID;
- clients on different APs sharing a distribution system;
- clients in different (E)SSIDs sharing a distribution system;
- between Wi-Fi clients and the *wired* devices on the distribution system (no spoofing the gateway, DNS, DHCP, RADIUS server).

It almost never holds across all five.

## How AirSnitch breaks it

Each [attack](/wiki/airsnitch/overview/#the-eight-attacks) targets a specific gap in the typical implementation:

| Attack | Gap exploited |
| --- | --- |
| [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) | Group keys are *shared*, so an insider becomes an authorised broadcaster |
| [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) | Isolation enforced at L2 doesn't carry over to L3 routing |
| [Port Stealing](/wiki/airsnitch/attacks/port-stealing/) | Each BSSID is a virtual switch port; classic L2 port-stealing applies |
| [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) | The AP will re-encrypt a `ToDS=1, addr3=ff:ff:..` frame under the victim's GTK |
| [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/) | Shared WPA2 password lets any insider derive any peer's PTK |
| [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/) | Shared WPA3-SAE passphrase lets an insider clone the AP |
| [Passpoint Flaws](/wiki/airsnitch/attacks/passpoint-flaws/) | DGAF Disable doesn't randomize GTK in every handshake |

## Variants and adjacent features

- **Intra-BSSID isolation.** The strict subset where only same-BSSID-same-AP traffic is blocked. Tightest enforcement; weakest guarantee.
- **Per-VLAN isolation.** Put guest BSSIDs in their own VLAN so the gateway routes them through a firewall that drops client-to-client traffic. See [VLANs and firewall](/wiki/airsnitch/defenses/vlans/).
- **Per-user VLAN / PPSK.** Each user gets a dedicated VLAN, optionally backed by a per-user passphrase. The AirSnitch authors recommend this as the strongest practical fix (NDSS'26 §VIII-C).
- **MAC ACL / MAC allow-list.** Hard-coded list of MACs allowed to talk to each other (e.g. printers, file servers). Can be combined with isolation so users still reach internal services.

## Inheritance and naming pitfalls

- "AP isolation" sometimes means *intra-BSSID only* (TP-Link home routers) and sometimes means the union of intra- and inter-BSSID isolation. Read each vendor's docs.
- "Guest network" usually implies *some* form of client isolation but the exact set varies. Test before trusting it — the authors found 5/7 home routers permit guest→main injection (NDSS'26 §VII-D, Table II).
- Some vendors silently relax isolation for protocols they consider essential (mDNS, ARP, multicast DNS-SD). Each relaxed protocol is potential attack surface.

## See also

- [Wi-Fi key hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/) — the keys that allegedly enforce isolation.
- [Virtual ports](/wiki/airsnitch/concepts/virtual-ports/) — the abstraction port stealing exploits.
- [Distribution system](/wiki/airsnitch/concepts/distribution-system/) *(planned)* — how cross-AP traffic flows.
- [Defences](/wiki/airsnitch/defenses/index/) — what actually works.
