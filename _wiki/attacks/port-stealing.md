---
title: Port Stealing (Downlink and Uplink)
permalink: /wiki/attacks/port-stealing/
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
redirect_from:
- /wiki/airsnitch/attacks/port-stealing/
---

# Port Stealing

> Layer: **Internal switching** · Section: **NDSS'26 §V-B** · CLI: `--c2c-port-steal`, `--c2c-port-steal-uplink`

## What it is

Treat each [BSSID as a virtual switch port](/wiki/concepts/virtual-ports/). The AP's internal Linux bridge maintains a forwarding database (FDB) that maps `MAC → port` based on observed traffic. **Port stealing poisons that mapping**: the attacker sends frames with a spoofed source MAC, and the bridge updates its FDB to redirect future traffic for that MAC to the attacker.

Two flavours, depending on whose MAC the attacker steals:

| Flavour | Spoofed source MAC | What gets redirected | CLI |
| --- | --- | --- | --- |
| [Downlink](#downlink) | the **victim**'s MAC | the AP→victim direction | `--c2c-port-steal` |
| [Uplink](#uplink) | the **gateway**'s MAC | the victim→AP→gateway direction | `--c2c-port-steal-uplink` |

The two combine into a full bidirectional MitM. See [Auxiliary techniques](/wiki/attacks/auxiliary-techniques/) for the helper primitives that keep both directions stable simultaneously.

The original port stealing attack was published by Ornaghi & Valleri (BlackHat Europe 2003) for **physical** Ethernet switches. AirSnitch's contribution (NDSS'26 §V-B) is showing that virtual ports inside a Wi-Fi AP — and even further upstream, the distribution switch wiring multiple APs together — work the same way.

## The Wi-Fi-specific complication

A naïve port-stealing attempt fails: the attacker associates with their own MAC, then injects a frame with the victim's MAC as source and encrypts it under the attacker's PTK. The AP:

1. Looks up the PTK by `(receiver = AP, transmitter = victim's MAC, BSSID = attacker's BSSID)`.
2. Finds no match — the victim's MAC has no PTK on the attacker's BSSID.
3. Drops the frame.

The fix is to **complete a separate 4-way handshake using the victim's MAC** on a *different* BSSID than the victim. `hostapd` keeps a per-BSSID `<MAC, PTK>` mapping. The attacker's handshake installs a fresh `<victim MAC, attacker PTK>` entry in the attacker-BSSID's table. The victim's real entry on the victim-BSSID is untouched. Now:

1. Attacker sends a frame on attacker-BSSID encrypted with their own PTK, source MAC = victim's MAC.
2. AP looks up PTK by `(victim's MAC, attacker BSSID)`, finds the attacker's, decrypts successfully.
3. Plaintext enters the bridge with source MAC = victim's. Bridge FDB updates: `victim MAC → attacker port`.
4. Future AP-side traffic for the victim now egresses on the attacker's BSSID, encrypted with the attacker's PTK (because that's what the attacker-BSSID's `<victim MAC, PTK>` entry says).

(NDSS'26 §V-B; "Overcoming Wi-Fi encryption to achieve port stealing".)

## Why this is a Wi-Fi authentication problem

The IEEE 802.11i text says nothing about cross-BSSID identity. After a successful 4-way handshake the AP opens the controlled port; *which* PTK gets used for subsequent encryption to a given MAC is determined by whoever did a handshake most recently. This is the "weak synchronization of a client's identity across the network stack" the paper's intro identifies as a root cause (NDSS'26 §I).

## Downlink port stealing {#downlink}

**Goal:** intercept traffic the AP is sending **to** the victim.

**Flow:**

```
1. Attacker connects to a *different* BSSID than the victim, with attacker's own credentials,
   but with addr1/addr2 = victim's MAC during association → AP sets up
   <victim MAC, attacker PTK> on the attacker's BSSID.

2. Attacker periodically sends data frames with source = victim's MAC, ToDS=1, addr3 = bridge MAC,
   to keep the FDB pointing victim MAC → attacker's port.

3. AP receives a packet for the victim's IP from upstream. It encrypts under the PTK keyed
   by (victim MAC, attacker BSSID) → the attacker's PTK. Sends out the attacker's BSSID.

4. Attacker decrypts. Optionally returns the packet to the victim using
   [gateway bouncing](/wiki/attacks/gateway-bouncing/) or [GTK abuse](/wiki/attacks/abusing-gtk/).
```

CLI:

```
./airsnitch.py wlan2 --c2c-port-steal wlan3 --no-ssid-check --other-bss --server 8.8.8.8
```

Vulnerable output:

```
>>> Downlink port stealing is successful.
```

(README §4.3.)

`--same-bss` doesn't make sense here: the victim and attacker would have the same MAC on the same BSSID and would constantly disconnect each other.

This is the case where, on an open guest BSSID, **the victim's WPA2-Enterprise traffic ends up broadcast in plaintext** because the egress BSSID has no encryption (NDSS'26 §V-B; demonstrated against two universities in §VII-F).

## Uplink port stealing {#uplink}

**Goal:** intercept traffic the victim sends **to** the gateway.

**Flow:**

```
1. Attacker connects with the *gateway*'s MAC on a different BSSID.

2. Attacker sends data frames with source = gateway MAC, ToDS=1.
   The bridge / distribution switch updates: gateway MAC → attacker's port.

3. Victim sends an uplink frame addressed to the gateway's MAC. The bridge forwards it
   to the attacker instead of out the wired uplink. Attacker decrypts under its own PTK.

4. To keep the network usable, attacker periodically performs
   [Server-triggered Port Restoration](/wiki/attacks/auxiliary-techniques/#server-triggered)
   to briefly let the real gateway's MAC be re-learned, then forwards buffered traffic upstream.
```

CLI:

```
./airsnitch.py wlan2 --c2c-port-steal-uplink wlan3 --no-ssid-check [--other-bss | --same-bss] [--server 1.2.3.4]
```

Vulnerable output:

```
>>> Uplink port stealing is successful.
```

(README §4.4.)

Both `--same-bss` and `--other-bss` make sense: the paper found vendors that block one and not the other (Table III).

## Cross-AP escalation

Port stealing is not limited to BSSIDs on a single AP. The same MAC-learning poisoning works on the **distribution switch** that connects multiple APs (NDSS'26 §VI-B). Demonstrated on a TP-Link EAP613 testbed in §VII-G, and against two real university networks in §VII-F. Once you internalise that "an AP is a switch port too", this is just port stealing one level up.

## Coverage

From NDSS'26 Table III — downlink port stealing succeeds against:

- Netgear Nighthawk X6 R8000 (all directions)
- D-Link DIR-3040 (all directions)
- TP-Link Archer AXE75 (most directions)
- ASUS RT-AX57 (M→M only)
- Both Ubiquiti AmpliFi units (some directions)
- Cisco Catalyst 9130 (all directions)
- LANCOM LX-6500 (all directions)

DD-WRT, OpenWrt, and Tenda RX2 Pro **block** downlink port stealing in their default guest-network configurations, by either using separate Linux bridges per BSSID (DD-WRT/OpenWrt) or refusing duplicate-MAC association (Tenda).

## What stops it

- **Separate L2 broadcast domains per BSSID** — separate Linux bridges, separate VLANs (NDSS'26 §VII-D, §VIII-C). See [VLANs and firewall](/wiki/defenses/vlans/).
- **Reject duplicate MAC across BSSIDs** — disconnect a client whose MAC is already associated to another BSSID. Tenda RX2 Pro does this; could be standardised.
- **MACsec between Wi-Fi clients and the gateway** end-to-end, defeating the egress side of the steal even when the FDB is poisoned.
- **Centralised Wi-Fi decryption** moves traffic off the AP-local bridge.
- See [MAC spoofing prevention](/wiki/defenses/spoofing-prevention/).

## Test it on your network

```
sudo ./airsnitch.py wlan2 --c2c-port-steal wlan3 --no-ssid-check --other-bss --server 8.8.8.8
sudo ./airsnitch.py wlan2 --c2c-port-steal-uplink wlan3 --no-ssid-check --same-bss
sudo ./airsnitch.py wlan2 --c2c-port-steal-uplink wlan3 --no-ssid-check --other-bss
```

## See also

- [Virtual ports](/wiki/concepts/virtual-ports/)
- [Auxiliary techniques](/wiki/attacks/auxiliary-techniques/) — server/client-triggered port restoration, Inter-NIC relaying.
- [Broadcast Reflection](/wiki/attacks/broadcast-reflection/), [Gateway Bouncing](/wiki/attacks/gateway-bouncing/) — return-path partners.
- [MacStealer comparison](/wiki/attacks/framing-frames/) — the Schepers / Vanhoef / Ranganathan USENIX'23 work where the MacStealer port-stealing primitive originated.
