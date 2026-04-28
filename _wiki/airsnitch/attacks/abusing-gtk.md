---
title: Abusing GTK
permalink: /wiki/airsnitch/attacks/abusing-gtk/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- attack
sources:
- ndss2026-paper
- airsnitch-readme
updated: 2026-04-28
---

> Layer: **Wi-Fi encryption** · Section: **NDSS'26 §IV-B** · CLI: `--check-gtk-shared`

## What it is

The [GTK](/wiki/airsnitch/concepts/wifi-key-hierarchy/#gtk--group-temporal-key) is shared with every client on a BSSID. Anyone holding the GTK can produce a broadcast/multicast frame that the AP and every other client will accept as legitimately group-encrypted traffic. AirSnitch turns that into a **client-to-client unicast injection** by wrapping a unicast IP datagram inside a GTK-encrypted broadcast Wi-Fi frame.

The injected frame, in Scapy notation:

```
Dot11(addr1=ff:ff:ff:ff:ff:ff,         # broadcast receiver
      addr2=<AP MAC>,                  # spoof AP as transmitter
      addr3=ff:ff:ff:ff:ff:ff)
  / IP(src=<attacker>, dst=<victim>)
  / <payload>
```

…then encrypted with the GTK the AP gave to *every* client on this BSSID.

The victim's stack receives a broadcast Wi-Fi frame, decrypts it with the GTK (because that's what broadcasts use), unwraps the IP packet, and — *because most OSes accept unicast IP inside an L2 broadcast* — delivers it to the destination IP address. The victim accepts it. [Client isolation](/wiki/airsnitch/concepts/client-isolation/) at the AP never enters the picture: the frame went over the air, not through the AP's bridge.

## Why it works

Three reinforcing facts:

1. **GTK is shared by default.** With one valid 4-way handshake on the BSSID, the attacker possesses the same key the AP uses to broadcast.
2. **Most OSes accept unicast IP in L2 broadcast frames.** From NDSS'26 Table IV: macOS, iOS, Android 14, Windows 11 (firewall off) all accept; Ubuntu 22.04 accepts unless `drop_unicast_in_l2_multicast=1` is set; Windows 11 with firewall on rejects only the IPv4 case but still accepts IPv6 ping and unicast ARP.
3. **The AP can't filter what goes over the air.** Frames constructed and broadcast by the attacker do not traverse the AP's [bridge](/wiki/airsnitch/concepts/virtual-ports/), so any AP-side ACL on client-to-client traffic is bypassed.

## Persistence after revocation

Most APs **do not rotate the GTK when a client leaves**. They rotate it on a timer (an hour, a day, sometimes never). So a guest whose access has been revoked retains injection capability until the next rotation. (NDSS'26 §IV-B-1.)

## What's required

- One legitimate association to the *victim's BSSID* to capture the GTK from the AP's 4-way handshake (or from a later group-key handshake — both deliver it).
- A radio that can transmit on the victim's channel.
- Knowledge of the AP's MAC (`addr2`), trivially observable.
- Knowledge of the victim's IP address.

## What's not required

- Knowing the victim's PTK or PMK.
- Being on the same physical AP, *as long as* the attacker can hear the victim's BSSID well enough to transmit on it.
- Defeating Wi-Fi encryption — the attack uses encryption as designed.

## CLI

```
./airsnitch.py wlan2 --check-gtk-shared wlan3 --no-ssid-check [--other-bss | --same-bss]
```

Saves both NICs' GTKs after association. If the two GTKs are the *same*, the network is vulnerable: the attacker (`wlan3`) can encrypt frames under the GTK the victim (`wlan2`) trusts. (README §4.1.)

A second AirSnitch test exists for the close cousin [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) (`--c2c-broadcast`), which reaches the same outcome via the AP rather than directly over the air, and does **not** require knowing the GTK at all.

## What the test actually outputs

```
>>> The victim's GTK is (XXX).
>>> The attacker's GTK is (YYY).
```

If `XXX == YYY`: vulnerable.

For the OS-acceptance side of the picture, AirSnitch's `--c2c-gtk-inject` test sends an actual GTK-wrapped ICMP echo and checks for a reply. README §7 notes this requires the test machine to have `drop_unicast_in_l2_multicast=0` because the simulated victim and attacker are both Linux.

## Combined with other attacks

- + [Port stealing](/wiki/airsnitch/attacks/port-stealing/): the attacker first steals the victim's port to intercept downlink, then uses GTK abuse to *return* the intercepted traffic to the victim, completing a downlink MitM (NDSS'26 §VI-A).
- + [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/): when the AP correctly randomizes GTK in the 4-way handshake, an attacker forces the AP to deliver the *real* shared GTK during FT, FILS, group-key handshake, or via a forged WNM-Sleep Response. Then GTK abuse becomes possible again.

## What stops it

- **Per-client randomized GTK in every handshake** ([Passpoint DGAF Disable extended to FT/FILS/group-key/WNM](/wiki/airsnitch/defenses/group-key-randomization/)).
- **OS-level filtering** of unicast IP inside L2 broadcasts: Linux `drop_unicast_in_l2_multicast=1`, but only for IPv4 — IPv6 and ARP still pass. (NDSS'26 §VII-C and Table IV.)
- **VLANs with `gtk-per-vlan`** at minimum, full per-client VLANs ideally.
- **MACsec** between Wi-Fi clients and the gateway (NDSS'26 §VIII-C).

## Test it on your network

```
sudo ./airsnitch.py wlan2 --check-gtk-shared wlan3 --no-ssid-check --same-bss
sudo ./airsnitch.py wlan2 --check-gtk-shared wlan3 --no-ssid-check --other-bss
sudo ./airsnitch.py wlan2 --c2c-gtk-inject wlan3 --no-ssid-check --same-bss
```

The first two tell you whether the GTK is shared. The third confirms the OS accepts a forged unicast-in-broadcast injection.

## See also

- [Wi-Fi key hierarchy](/wiki/airsnitch/concepts/wifi-key-hierarchy/)
- [Passpoint flaws](/wiki/airsnitch/attacks/passpoint-flaws/), [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/)
- [Group key randomization](/wiki/airsnitch/defenses/group-key-randomization/)
- [airsnitch.py CLI](/wiki/airsnitch/tools/airsnitch-cli/)
