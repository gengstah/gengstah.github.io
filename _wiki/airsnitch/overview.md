---
title: "AirSnitch \u2014 Overview"
permalink: /wiki/airsnitch/overview/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- overview
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
---

# AirSnitch — Overview

**AirSnitch** is a tool and a family of attacks for bypassing **Wi-Fi client isolation**, published at NDSS 2026 by Zhou, Pu, Liu, Qian, Tan, Krishnamurthy, and Vanhoef. It tests whether the "client isolation" feature that home and enterprise routers advertise actually prevents one Wi-Fi client from attacking another. The paper's headline finding: *every router and network the authors tested was vulnerable to at least one attack* (NDSS'26 §I).

## Why this matters

[Client isolation](/wiki/airsnitch/concepts/client-isolation/) is the last line of defence against insider attackers on a Wi-Fi network — a malicious guest, a compromised IoT device, an employee with bad intentions. Vendors added it ad hoc (Cisco Meraki, TP-Link, ASUS, DD-WRT all use slightly different definitions) and the IEEE 802.11 standard never specified what guarantees it should provide. AirSnitch shows that the resulting implementations are inconsistent, incomplete, and *fundamentally broken* in single-BSSID home networks regardless of WPA version.

## The attack surface

AirSnitch attacks three boundaries where isolation is supposed to be enforced (NDSS'26 §III-C):

1. **Wi-Fi encryption layer** — broadcast group keys are shared; the attacker becomes a peer of the AP for group-addressed traffic.
2. **IP routing layer** — isolation enforced at MAC/Ethernet does not extend to L3; the gateway happily routes traffic between "isolated" clients.
3. **Internal switching layer** — every BSSID is a virtual switch port; classic Ethernet port-stealing works against virtual ports too.

## The eight attacks

| Attack | Layer | What it does | Page |
| --- | --- | --- | --- |
| [Abusing GTK](/wiki/airsnitch/attacks/abusing-gtk/) | Wi-Fi encryption | Inject unicast IP packets wrapped in GTK-encrypted broadcast frames | §IV-B |
| [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) | IP routing | Bounce a packet via the gateway to reach a "MAC-isolated" client | §V-A |
| [Downlink Port Stealing](/wiki/airsnitch/attacks/port-stealing/#downlink) | Switching | Spoof victim's MAC on a different BSSID to steal incoming traffic | §V-B |
| [Uplink Port Stealing](/wiki/airsnitch/attacks/port-stealing/#uplink) | Switching | Spoof gateway's MAC to steal victim's outgoing traffic | §V-B |
| [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) | Switching | Send `ToDS=1, addr3=ff:ff:..` to make the AP re-encrypt under the victim's GTK | §V-C |
| [Machine-on-the-side](/wiki/airsnitch/attacks/machine-on-the-side/) | Wi-Fi encryption | Classic WPA2-PSK passphrase-knower derives the victim's PTK | §IV-A |
| [Rogue AP](/wiki/airsnitch/attacks/rogue-ap/) | Wi-Fi encryption | Clone a WPA3-SAE network and induce victims to roam | §IV-A |
| [Passpoint Flaws](/wiki/airsnitch/attacks/passpoint-flaws/) | Wi-Fi encryption | Get the real GTK via the group-key, FT, FILS, or WNM-Sleep handshakes | §IV-B-2 |

Plus three [auxiliary techniques](/wiki/airsnitch/attacks/auxiliary-techniques/) — *server-triggered port restoration*, *client-triggered port restoration*, *Inter-NIC relaying* — that turn one-shot interception into stable bidirectional MitM (§VI-A, §VII-G).

## End-to-end MitM

Stacked together, the techniques deliver something the community largely thought was no longer practical with client isolation enabled: a **bidirectional MitM** for arbitrary Wi-Fi traffic, working even when the victim is on a separate BSSID, separate SSID, or separate AP. On a Netgear R8000 the full attack completes in ~2 seconds and the victim watching YouTube doesn't notice (NDSS'26 §VII-D). On two real university networks the authors leak WPA2-Enterprise traffic *in plaintext* through the open guest SSID by exploiting the shared distribution switch (NDSS'26 §VII-F). On an enterprise testbed they steal the AP's RADIUS credential by intercepting the first RADIUS message and brute-forcing its Message Authenticator (NDSS'26 §VII-G).

## What AirSnitch is *not*

- **Not a key recovery attack.** It does not recover passphrases or break Wi-Fi encryption primitives. It abuses key *management* and identity *binding*, not crypto. (README §1.)
- **Not stopped by switching to WPA3 or enabling MFP.** Most attacks are independent of the encryption protocol — see [WPA versions](/wiki/airsnitch/concepts/wpa-versions/).
- **Not the same as MacStealer.** MacStealer (USENIX'23, "framing frames") only covered single-BSSID downlink port stealing; AirSnitch's other seven attacks are novel (README §1.2).

## What it is good for

- **Auditing your own network.** Run the [`airsnitch.py`](/wiki/airsnitch/tools/airsnitch-cli/) test suite to find which attacks your AP allows.
- **Comparing vendor implementations.** See [tested devices](/wiki/airsnitch/devices/tested-devices/) for which routers fail which tests.
- **Designing defences.** See [defenses](/wiki/airsnitch/defenses/index/) — group key randomization, VLANs, MAC/IP spoofing prevention, MACsec.

## Where to read next

- [Client isolation](/wiki/airsnitch/concepts/client-isolation/) — the concept the attacks bypass.
- [Wi-Fi key hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/) — what GTK/IGTK/PTK/PMK/GMK are and why they matter.
- [BSSID, SSID, ESS](/wiki/airsnitch/concepts/bssid-ssid-ess/) — terminology used throughout.
- [Defences index](/wiki/airsnitch/defenses/index/) — what each mitigation actually stops.
- [Sources](/wiki/airsnitch/sources/ndss2026-paper/) — provenance.
