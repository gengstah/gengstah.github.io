---
title: Gateway Bouncing
permalink: /wiki/airsnitch/attacks/gateway-bouncing/
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

# Gateway Bouncing

> Layer: **IP routing** · Section: **NDSS'26 §V-A** · CLI: `--c2c-ip`

## What it is

[Client isolation](/wiki/airsnitch/concepts/client-isolation/) is usually enforced as a Layer-2 ACL: the AP refuses to forward a Wi-Fi frame whose Ethernet destination is another client's MAC. Gateway Bouncing simply doesn't put the victim's MAC in the Ethernet header. Instead, the attacker sends a frame whose:

- **Ethernet (L2) destination** is the *gateway*'s MAC;
- **IP (L3) destination** is the *victim*'s IP.

The AP looks at L2 and sees a frame for the gateway. Forwards it. The gateway looks at L3 and sees a packet for an attached client. Routes it back into the same Wi-Fi network — addressed at L2 to the *victim*'s MAC, with source MAC = gateway. The victim accepts it.

```
Attacker  ──Eth(dst=GW, src=Atkr) / IP(src=Atkr, dst=Victim)──► AP
                                                                │ "this is for the gateway"
                                                                ▼
                                                             Gateway
                                                                │ "route to the Wi-Fi subnet"
                                                                ▼
Victim ◄──Eth(src=GW, dst=Victim) / IP(src=Atkr, dst=Victim)── AP
```

(NDSS'26 Figure 2; README §4.2.)

## Why it works

Many implementations enforce client isolation with a rule like *"drop frames from the wireless side whose destination MAC is another wireless-side client"*. That rule was written by people thinking only about ARP poisoning. It does nothing for an IP packet whose L2 destination is the gateway's MAC, because the AP isn't being asked to deliver it to a wireless client; it's being asked to deliver it to the gateway, which is what the AP normally does.

The gateway then routes the packet back. Routing tables don't know about Wi-Fi client isolation. As far as the gateway is concerned, the destination IP is on a directly connected interface and it does what routers do.

## What's required

- The attacker is associated to *any* SSID on the same network as the victim. Typically the attacker is on the *guest* SSID and the victim on the main, but the attack also works in single-SSID setups.
- The attacker knows or guesses:
  - the gateway's MAC (trivially observable — it's the source MAC of any DHCP-Offer or IP traffic the attacker themselves receives);
  - the victim's IP (DHCP scan, mDNS, ARP scan as far as it's allowed, or just observation of broadcast traffic).

## What's not required

- The victim's MAC — the attacker never addresses the victim at L2.
- Cryptographic material beyond the attacker's own credentials.
- Hidden-terminal-friendly geometry — the gateway does the radio work.

## What you get

- **Client-to-client packet injection at the IP layer.** Any UDP, TCP, ICMP, IPv6 datagram you can construct.
- Combined with [downlink port stealing](/wiki/airsnitch/attacks/port-stealing/#downlink), you can return *intercepted* downlink traffic back to the victim by setting the source IP to the original server, completing a downlink MitM (NDSS'26 §VI-A).

## What you don't get from this attack alone

- Reading the victim's traffic. This is one-way injection.
- Reaching the victim if there is also IP-level isolation (per-client VLANs, firewall rules between guest and main).

## CLI

```
./airsnitch.py wlan2 --c2c-ip wlan3 --no-ssid-check [--other-bss | --same-bss]
```

After both NICs associate, AirSnitch sends a crafted UDP packet from `wlan3` (attacker) to `wlan2` (victim) using the gateway-bouncing technique. Vulnerable output (red):

```
>>> Client to client traffic at IP layer is allowed (PSK{pw_atkr} to SAE{pw_victim})
```

(README §4.2.)

## Coverage

NDSS'26 Table II shows gateway bouncing succeeds against most of the tested home routers. ASUS RT-AX57, DD-WRT, OpenWrt, and Tenda RX2 Pro block at least some directions; everything else is wide open. All four enterprise devices (Cisco Catalyst 9130, LANCOM LX-6500, both Ubiquiti AmpliFi units) allowed gateway bouncing in at least one direction.

## What stops it

- **IP-layer isolation** in addition to L2. The gateway must refuse to route packets from the wireless subnet back to the wireless subnet; equivalently, put each isolation domain in its own subnet.
- **VLANs with firewall rules** between guest and main networks (NDSS'26 §VIII-C).
- **IP spoofing prevention** (BCP 38 / source-address validation) doesn't stop the *initial* injection but stops the attacker from spoofing an external server's IP when returning intercepted traffic.

See [VLANs and firewall](/wiki/airsnitch/defenses/vlans/), [IP spoofing prevention](/wiki/airsnitch/defenses/spoofing-prevention/#ip-spoofing).

## Test it on your network

```
sudo ./airsnitch.py wlan2 --c2c-ip wlan3 --no-ssid-check --same-bss
sudo ./airsnitch.py wlan2 --c2c-ip wlan3 --no-ssid-check --other-bss
```

Run both. Some routers block one and not the other.

## See also

- [Port stealing](/wiki/airsnitch/attacks/port-stealing/) — partner attack for downlink MitM.
- [Client isolation](/wiki/airsnitch/concepts/client-isolation/) — what it's supposed to enforce.
- [VLANs and firewall](/wiki/airsnitch/defenses/vlans/) — the actual fix.
