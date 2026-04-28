---
title: MAC and IP Spoofing Prevention
permalink: /wiki/airsnitch/defenses/spoofing-prevention/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- defense
sources:
- ndss2026-paper
updated: 2026-04-28
---

# Spoofing Prevention

Two related defences that close two specific gaps. Each is cheap and vendor-deployable. Neither alone is sufficient.

## MAC spoofing prevention {#mac-spoofing}

> Targets: [Port Stealing](/wiki/airsnitch/attacks/port-stealing/), some uplink attacks that spoof internal-device MACs.

### What it should look like

The AP refuses to admit a client whose MAC address would interfere with the network's existing identity bindings:

1. **Reject any client trying to use the MAC of an internal wired device.** Gateway, DNS server, DHCP server, RADIUS server, internal printers. The AP knows these MACs from its own ARP table or static config; refuse association if a client requests one of them. Closes [uplink port stealing](/wiki/airsnitch/attacks/port-stealing/#uplink) and the [RADIUS theft case study](/wiki/airsnitch/concepts/radius/). (NDSS'26 §VIII-C.)
2. **Reject duplicate MAC across BSSIDs.** {#duplicate-mac} If a MAC is already actively associated to BSSID A on the AP, refuse a new association attempt to BSSID B with the same MAC. Closes cross-BSSID [downlink port stealing](/wiki/airsnitch/attacks/port-stealing/#downlink). Tenda RX2 Pro implements this and is the only tested home AP that successfully blocks downlink port stealing across BSSIDs in its default configuration (NDSS'26 §VII-D).
3. **Optionally maintain an allow-list for shared infrastructure.** Printers, file servers, AirPlay/Chromecast targets — devices that genuinely need to be reachable from many clients. Allow them past client isolation regardless of other rules; the assumption is they don't randomize their MAC. (NDSS'26 §VIII-C.)

### Why it doesn't fix everything

- Doesn't stop [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/) — that runs over the air without involving the AP's MAC bindings.
- Doesn't stop [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) — the attacker uses their own MAC.
- Doesn't stop [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) — same.
- Same-BSSID port stealing still requires additional fixes. [MacStealer's recommendations](https://github.com/vanhoefm/macstealer#id-mitigations) cover this case; ideal fix may need the IEEE 802.11 ["Reassociating STA recognition" extension](https://mentor.ieee.org/802.11/dcn/23/11-23-0537-07-000m-reassociating-sta-recognition.docx). (README §1.2.)

### Implementation hooks

- `hostapd` doesn't natively enforce these rules. They sit in the surrounding daemon / management plane.
- Tenda's check appears to be in vendor firmware; reverse-engineering details in NDSS'26 §VII-D.

## IP spoofing prevention {#ip-spoofing}

> Targets: making it harder to **return** intercepted traffic in a MitM chain. Doesn't prevent the initial interception.

### What it should look like

The router enforces ingress source-address validation (BCP 38 / SAVI) on the wireless side:

- A frame arriving from the guest VLAN with a source IP outside the guest subnet is dropped.
- A frame arriving from any wireless interface with a source IP that belongs to an external server is dropped.

### What this stops

Once the attacker has [stolen the victim's downlink port](/wiki/airsnitch/attacks/port-stealing/#downlink) and decrypted intercepted traffic, the natural next step is to **reinject the traffic** to the victim with the original server's IP as source — making the MitM transparent. [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) does this by forging an IP packet with `src=<external server>, dst=<victim>`. If the router drops packets from the wireless side that have an external source IP, the reinjection path breaks. The victim experiences a hard disconnect on whatever flow was being intercepted, which is detectable.

The interception itself proceeds; the attacker still gets to read the victim's downlink. But the **transparent MitM** turns into a *destructive interception*, much louder and easier to notice.

### Why it doesn't fix everything

- Doesn't stop reinjection via [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/) or [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/), because those don't go through the gateway. The frame travels over the air directly to the victim. (NDSS'26 §VI-A's note that GTK abuse "enables IP spoofing that APs cannot stop".)
- Doesn't help the uplink direction — the attacker forwards the victim's intercepted uplink upstream with the *attacker*'s real IP, no spoofing involved.

### Implementation

- Linux: standard reverse-path filtering (`rp_filter=1`) catches the easy cases; SAVI / RA-Guard / DHCPv6 Snooping for IPv6.
- On consumer routers, "prohibit IP spoofing" is sometimes a checkbox (Aruba calls it that, NDSS'26 §VIII-C citation 49). Enable when available.

## Combined deployment

Both defences are cheap. Both should be on by default. Neither is in any of the tested home routers' default configurations. Vendors who care can add them in firmware updates.

## See also

- [Port Stealing](/wiki/airsnitch/attacks/port-stealing/), [Gateway Bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) — what these defences mitigate.
- [VLANs and firewall](/wiki/airsnitch/defenses/vlans/) — partner defence; SAVI is most useful when paired with VLAN-level routing rules.
- [Documentation](/wiki/airsnitch/defenses/documentation/) — vendors should document whether these are on.
