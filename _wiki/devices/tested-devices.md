---
title: Tested Devices and Findings
permalink: /wiki/devices/tested-devices/
layout: single
author_profile: true
tags:
- airsnitch
- wifi
- device
sources:
- ndss2026-paper
updated: 2026-04-28
redirect_from:
- /wiki/airsnitch/devices/tested-devices/
---

What the AirSnitch authors tested, what they found. Source: NDSS'26 §VII, Tables I–III. Not exhaustive — vendor inclusion does not imply other models or firmware revisions are equivalent. **Re-test on your own hardware** before drawing conclusions about your network.

## Devices and firmware

(NDSS'26 Table I.)

| Device | Firmware | AP daemon |
| --- | --- | --- |
| Netgear Nighthawk X6 R8000 | V1.0.4.84_10.1.84 | nas |
| Tenda RX2 Pro | V16.03.30.14_multi | hostapd |
| D-Link DIR-3040 | 1.13 | apsond |
| TP-Link Archer AXE75 | 1.1.8 Build 20230718 | hostapd |
| ASUS RT-AX57 | 3.0.0.4.386_52332 | hostapd |
| DD-WRT v3.0-r44715 | v3.0-r44715 | nas |
| OpenWrt 24.10 | 24.10.0 r28427 | hostapd |
| Ubiquiti AmpliFi Alien Router | v4.0.8, g0c028c5c | hostapd (+ hap-wifirouter for management) |
| Ubiquiti AmpliFi Router HD | v4.0.3, g0bc740d76d | hostapd |
| LANCOM LX-6500 | 6.00.0085 | lancom_daemon |
| Cisco Catalyst 9130 | IOS XE 17.2.1.11 | unknown |
| TP-Link EAP613 | (testbed for VLAN-based defence) | hostapd |

The **AP daemon** column is interesting because there's a temptation to assume `hostapd` itself is the security-relevant component. The paper makes the opposite point: "the use of `hostapd` is neither a sufficient nor a necessary condition for an AP to be vulnerable to port stealing" (NDSS'26 §VII-B). The bug surface is in the surrounding code — bridge configuration, AP daemon glue, vendor-specific isolation logic.

## Headline results per attack

(Synthesised from NDSS'26 Tables II and III. See raw paper for direction-specific cells.)

### [Abusing GTK](/wiki/attacks/abusing-gtk/) — same-network injection

Vulnerable: **all 11 devices** tested, in M↔M and G↔G directions. Universal. The shared-GTK design is not vendor-specific.

### [Gateway Bouncing](/wiki/attacks/gateway-bouncing/)

Most directions vulnerable on most devices. Notable mitigations:

- **ASUS RT-AX57** blocks some directions in default config.
- **DD-WRT, OpenWrt, Tenda RX2 Pro** have partial blocks in their default guest-network configurations.
- **TP-Link Archer AXE75** allows G↔M and G↔G, blocks direct L2 between M↔M.

### [Downlink Port Stealing](/wiki/attacks/port-stealing/#downlink)

Vulnerable: Netgear R8000, D-Link DIR-3040, TP-Link Archer AXE75, ASUS (M→M only), both Ubiquiti AmpliFi units (some directions), Cisco Catalyst 9130, LANCOM LX-6500.

**Block downlink port stealing in default guest config:**

- **DD-WRT** — uses separate Linux bridges per BSSID.
- **OpenWrt 24.10** — same.
- **Tenda RX2 Pro** — refuses duplicate MAC across BSSIDs.

(NDSS'26 §VII-D and Table III.)

### [Uplink Port Stealing](/wiki/attacks/port-stealing/#uplink)

Coverage is uneven — many devices vulnerable in some directions but not all. LANCOM LX-6500 vulnerable in all directions. DD-WRT only in M→M. OpenWrt blocks all directions. The paper describes the matrix as "weak and chaotic inter-BSSID isolation mechanisms across diverse models and vendors".

### [Broadcast Reflection](/wiki/attacks/broadcast-reflection/)

Vulnerable: every tested device in M↔G and M↔M directions. Including Cisco Catalyst 9130 in its enterprise mode.

### [Machine-on-the-side](/wiki/attacks/machine-on-the-side/) (single-BSSID WPA2-PSK)

Vulnerable: all 7 home APs. Universal. (NDSS'26 §VII-D "Single-BSSID Attacks".)

### [Rogue AP](/wiki/attacks/rogue-ap/) (single-BSSID WPA2/3)

Vulnerable: all 7 home APs. Including the dissociation-and-induce flow.

## Devices that block at least one attack

- **Tenda RX2 Pro** — blocks downlink port stealing via duplicate-MAC detection. Doesn't block AbuseGTK or Gateway Bouncing in the directions AirSnitch cares about.
- **DD-WRT v3.0-r44715** — blocks port stealing via separate bridges in default guest config. Still vulnerable to GTK-layer attacks.
- **OpenWrt 24.10** — blocks port stealing via separate bridges. Still vulnerable to GTK-layer attacks.
- **TP-Link EAP613 (with VLAN configuration)** — used as the testbed for [VLANs and firewall](/wiki/defenses/vlans/). With per-BSSID VLANs enabled, every AirSnitch primary attack is blocked. Without VLANs, vulnerable like everything else.

The only devices in the paper that demonstrate *complete* AirSnitch resistance are the ones with **explicit VLAN configuration**, and even then only for cross-VLAN attacks — within a VLAN, the [shared-passphrase attacks](/wiki/attacks/machine-on-the-side/) are still feasible.

## Enterprise-grade specifics

(NDSS'26 §VII-E.)

- **Both Ubiquiti AmpliFi** units: vulnerable to gateway bouncing, abusing GTK, broadcast reflection, port stealing.
- **Cisco Catalyst 9130** with "P2P Blocking Action = drop": vulnerable to abusing GTK, downlink port stealing, broadcast reflection.
- **LANCOM LX-6500** with "Communication between end devices on this SSID = disallow": vulnerable to abusing GTK, downlink port stealing, uplink port stealing.

For both Cisco and LANCOM, **during** the downlink port stealing attack the victim's uplink stops being forwarded — an artefact of how these devices handle two clients with the same MAC across BSSIDs. Visible to the victim as a brief stall.

## Real-world university networks

Two large university networks in different countries (anonymised in the paper). Setup: open captive-portal SSID + staff WPA2-Enterprise SSID + eduroam WPA2-Enterprise SSID. Each AP serves all three across multiple bands.

Result: full **downlink port stealing** of WPA2-Enterprise traffic into the open SSID, *leaking the WPA2-Enterprise traffic in plaintext over the air*. Reproduced on the authors' own victim devices, with no impact on other users (NDSS'26 §VII-F).

## Vendor disclosure status (as of paper publication)

(NDSS'26 §VIII-D.)

- **Wi-Fi Alliance** — fixed missing IGTK randomization in **Passpoint v3.4**.
- **LANCOM** — confirmed; added option to randomize group keys.
- **Ubiquiti** — evaluating mitigations.
- **D-Link** — proactively provided two routers for validation.
- Other vendors still evaluating.

If you're using any of the listed devices, **check vendor security advisories for post-NDSS'26 patches** before deploying for sensitive use cases.

## See also

- [Defences index](/wiki/defenses/) — what to enable on each device.
- [airsnitch.py CLI](/wiki/tools/airsnitch-cli/) — how to retest after firmware updates.
- [NDSS'26 paper](/wiki/sources/airsnitch/ndss2026-paper/) — full source.
