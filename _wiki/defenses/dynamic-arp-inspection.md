---
title: Dynamic ARP Inspection and Bridge-Side ARP Defences
permalink: /wiki/defenses/dynamic-arp-inspection/
layout: single
author_profile: true
tags:
- networking
- defense
sources:
- arp-over-gtk-blog
- ndss2026-paper
updated: 2026-05-02
---

> Targets: classic [ARP spoofing](/wiki/attacks/arp-spoofing/) on wired LANs and Wi-Fi-as-bridged-Ethernet. **Does not** stop [ARP over GTK](/wiki/attacks/arp-over-gtk/).

The whole family of router-side and switch-side ARP defences works the same way at heart: catch the malicious ARP as it crosses the bridge. This page collects the family, gives the canonical configuration for each, and explains the architectural blind spot they share on Wi-Fi.

## The family

| Product / feature | Where it lives | What it inspects |
| --- | --- | --- |
| **Cisco Dynamic ARP Inspection (DAI)** | Catalyst access switch | Every ARP frame on each access port; drops anything not in the DHCP-snooping binding table. |
| **DHCP-snooping ARP filter on AP / router** | OpenWrt netfilter on `br-lan`, vendor equivalents | Same idea, on the AP itself instead of an upstream switch. |
| **`ebtables` / `arptables` on `br-lan`** | Linux bridge | Lowest-level form. `ebtables -t filter -A FORWARD` matches frames forwarded across the bridge. |
| **IP-MAC binding (TP-Link, MikroTik, others)** | AP / router config | Static `(IP, MAC)` allow-list; ARP frames violating the list dropped at the bridge. |
| **MikroTik `arp=reply-only`** | Router interface flag | Router only answers ARPs corresponding to its own ARP table. |
| **UniFi "ARP cache poisoning protection"** | Vendor knob | Vendor-named instance of the bridge-side filter family. |

## Cisco DAI — canonical configuration

```
ip dhcp snooping
ip dhcp snooping vlan 10,20,30

interface GigabitEthernet1/0/1
 description uplink to distribution
 ip dhcp snooping trust
 ip arp inspection trust

interface range GigabitEthernet1/0/2 - 48
 description access
 ip dhcp snooping limit rate 10

ip arp inspection vlan 10,20,30
ip arp inspection validate src-mac dst-mac ip
```

Untrusted ports inspect every ARP and drop frames whose `(IP, MAC, VLAN, port)` tuple is not in the snooping binding table. Trusted ports (uplinks, server-side) skip inspection.

## OpenWrt / netfilter on `br-lan`

```sh
# rough sketch — vendor scripts vary
ebtables -t nat -A PREROUTING -p arp --arp-op Reply -j arpwatch_check
ebtables -t filter -A FORWARD -p arp -j arpwatch_check
```

Plus a daemon (`arpwatch`, `dhcpsnoop`, vendor equivalent) that maintains the `(IP, MAC, port)` table from DHCP traffic.

## What they all have in common

Every entry in the table above operates on **frames crossing the bridge**. That is the design, and that is the only place these hooks live. Frames the bridge does not see are frames these hooks cannot inspect.

That phrasing matters because the [ARP over GTK](/wiki/attacks/arp-over-gtk/) primitive is precisely the case where the bridge does not see the frame:

- The malicious frame is a Wi-Fi data frame addressed as a from-DS broadcast (addr2 = AP BSSID), CCMP-encrypted under the [GTK](/wiki/concepts/wifi-key-hierarchy/), injected on a monitor virtual interface.
- The receiver's NIC accepts it as a legitimate group-encrypted broadcast from the AP, decrypts at MLME, and hands the inner LLC/ARP up the stack.
- At no point is the frame on the bridge. The AP wasn't even involved in transmitting it.

Run `tcpdump -i br-lan arp` while [arpgtk](/wiki/tools/arpgtk/) is running its `--verify` probe on a different host on the same SSID and you will see legitimate ARP traffic on the bridge but not the injected frame. It only ever exists on the wireless side, station-to-station.

This is the structural observation the [router-side ARP defences blog](/wiki/sources/blog/2026-05-02-arp-over-gtk/) makes: every defence in the table above is *architecturally a no-op* against this attack class. The defences are not wrong; they are simply in the wrong location. They still catch ARP attacks from wired hosts and from misconfigured wireless clients (anything that goes through the bridge in the conventional way). They cannot claim to mitigate the over-the-air variant.

## What still works alongside DAI

DAI / DHCP-snooping ARP filtering remains valuable for:

- **Wired ARP poisoning.** The classic attack from a host plugged into the same access switch is exactly what DAI was designed to stop, and it does, reliably.
- **Misconfigured wireless clients.** A station that emits gratuitous ARP claiming an IP it doesn't own (legitimately or otherwise) does so via the bridge; DAI / `ebtables` will drop it.
- **Bridge-side amplification.** If a wireless attacker tries the classical *to-DS* unicast ARP poisoning that AirSnitch's bridge-side test also exercises, DAI catches that too.

Treat the family as a layer of the defence stack, not the whole stack.

## Recommended configuration

If you have managed switches **and** Wi-Fi:

1. **Enable DAI / equivalent on every wired access port.** Trust only the uplink and known-good server ports.
2. **Pair DHCP snooping with DAI.** DAI relies on the snooping binding table; without snooping, DAI either runs in static-ACL mode (brittle) or doesn't run at all.
3. **Enable per-client ARP filtering on the AP** (vendor knob; on UniFi this is the "ARP cache poisoning protection" toggle). Closes the bridge-side wireless variant.
4. **For the over-the-air variant, look elsewhere.** The relevant levers are [Group key randomization](/wiki/defenses/group-key-randomization/), per-BSSID VLANs, AP Proxy ARP, and [endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/). DAI is not the answer.

## See also

- [ARP spoofing](/wiki/attacks/arp-spoofing/), [ARP over GTK](/wiki/attacks/arp-over-gtk/) — what this defence does and doesn't catch.
- [Endpoint ARP hardening](/wiki/defenses/endpoint-arp-hardening/) — the per-host complement.
- [Spoofing prevention](/wiki/defenses/spoofing-prevention/) — MAC and IP spoofing defences; partner architecture.
- [VLANs](/wiki/defenses/vlans/) — broadcast-domain segmentation.
- [Group key randomization](/wiki/defenses/group-key-randomization/) — the actual fix for ARP-on-Wi-Fi.

## References

- Cisco Catalyst Switch Configuration Guide — *Dynamic ARP Inspection*.
- OpenWrt wiki — `ebtables` and bridge filtering.
- *Router-side ARP defenses don't catch what they don't see.* `gengstah.github.io`, 2026-05-02.
- Zhou et al. *AirSnitch.* NDSS 2026.
