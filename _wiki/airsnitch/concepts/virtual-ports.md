---
title: Virtual Ports and the AP's Internal Switch
permalink: /wiki/airsnitch/concepts/virtual-ports/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- concept
sources:
- ndss2026-paper
updated: 2026-04-28
---

# Virtual Ports and the AP's Internal Switch

A central insight of AirSnitch: **every BSSID on a Wi-Fi AP is a virtual port on an internal Ethernet switch.** Once you adopt that model, classic switch attacks — port stealing, MAC flooding — apply to Wi-Fi, with Wi-Fi-specific twists (NDSS'26 §V-B).

## The model

Inside a modern AP, the daemon (`hostapd`, `nas`, vendor-specific) wires up:

- one **virtual interface** per BSSID, each with its own MAC address;
- a Linux **bridge** (e.g. `br0`) that ties them together along with the physical wired uplink;
- a per-BSSID `<MAC, PTK>` mapping for unicast encryption;
- a per-BSSID GTK / IGTK for group traffic.

When a Wi-Fi frame arrives on a virtual interface:

1. The frame is decrypted using the PTK looked up by **(BSSID, source MAC)**.
2. The cleartext is converted to an Ethernet frame.
3. The Ethernet frame enters the bridge.
4. The bridge consults its **forwarding database (FDB)** — a table of `<MAC → port>` entries learned from observed source MACs — to choose an output port.

This is exactly what a hardware switch does. The Wi-Fi specifics are: (a) "a port" is a BSSID, (b) the FDB is updated by Wi-Fi traffic too, (c) there is encryption sandwiched in front of the switch on each port.

## Port-stealing in this model

Port stealing exploits the FDB-update step. Send any Wi-Fi frame whose **source MAC** is the victim's, from a virtual port other than the victim's. The bridge sees a new source MAC → new port mapping and updates the FDB. Future traffic destined to the victim's MAC now egresses on the attacker's port (NDSS'26 §V-B).

The Wi-Fi twist that makes this nontrivial:

- The attacker cannot just inject a forged frame with the victim's source MAC — the AP would try to decrypt with the victim's PTK on the *attacker's* BSSID, and there is no such PTK there, so the frame is dropped.
- The attacker has to **complete a fresh 4-way handshake using the victim's MAC** on the attacker's BSSID. This installs an attacker-controlled PTK keyed under the victim's MAC in the attacker's BSSID's `<MAC, PTK>` table.
- Now the attacker can encrypt frames *as if* they were the victim, the AP decrypts them, the cleartext enters the bridge with source = victim's MAC, and the FDB gets poisoned.

The decoupling is: the FDB binds MAC→port across all BSSIDs of the bridge, but the `<MAC, PTK>` table is per-BSSID. The attacker overwrites only the attacker-BSSID's PTK binding for the victim's MAC; the victim's real binding on its own BSSID is untouched. Yet the bridge happily redirects traffic.

## Open SSID worst case

If the attacker's BSSID is *open* (no encryption), step 1 above doesn't decrypt, step 2 emits cleartext into the bridge, and step 4 sends the victim's traffic out the open BSSID — *encrypted only by the air, in a network that does not encrypt the air*. So WPA2-Enterprise traffic ends up broadcast in plaintext over the guest network (NDSS'26 §V-B end; demonstrated in two real university networks, §VII-F).

## Cross-AP escalation

The same idea applies to the *distribution switch* upstream of multiple APs (NDSS'26 §VI-B, §VII-G). When the attacker spoofs the gateway's MAC and sends a frame, the distribution switch's FDB rebinds the gateway MAC to the attacker's AP. Now traffic to the gateway flows to the attacker. This is independent of which physical AP the attacker is connected to.

## What blocks it

- **Bridges per BSSID.** DD-WRT and OpenWrt put the guest BSSID on a separate Linux bridge from the main BSSID. The FDB of one bridge can't be poisoned by traffic on another (NDSS'26 §VII-D).
- **Reject MAC reuse across BSSIDs.** Tenda RX2 Pro disconnects a MAC if it is already associated to another BSSID. The attacker can never get to the second handshake (NDSS'26 §VII-D).
- **VLAN per BSSID, with the bridge crossed by routing only.** Port-stealing the MAC of an interface in a different VLAN gets you the wrong forwarding domain. See [VLANs and firewall](/wiki/airsnitch/defenses/vlans/).
- **Centralised decryption** (some Cisco controllers). Wi-Fi traffic decrypted at the controller; the AP-local bridge plays a smaller role (NDSS'26 §VIII-C).

## See also

- [BSSID, SSID, ESS](/wiki/airsnitch/concepts/bssid-ssid-ess/)
- [Port stealing](/wiki/airsnitch/attacks/port-stealing/)
- [Broadcast Reflection](/wiki/airsnitch/attacks/broadcast-reflection/) — a cousin attack that also exploits the bridge.
- [VLANs and firewall](/wiki/airsnitch/defenses/vlans/)
