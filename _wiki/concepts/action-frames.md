---
title: "Action Frames"
permalink: /wiki/concepts/action-frames/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - action-frames
---

*The 802.11 management-frame escape hatch. Action frames are how every post-association feature — block-ack, FT, RM, WNM-Sleep, BSS Transition, channel switch, public action — is delivered. Robust subset is MFP-protected; the rest isn't.*

**Status:** drafting
**Related:** [802.11 frame types](/wiki/concepts/80211-frame-types/), [MFP](/wiki/concepts/mfp/), [Fast BSS Transition](/wiki/concepts/fast-bss-transition/), [Radio Resource Management](/wiki/concepts/radio-resource-mgmt/), [WNM and ANQP](/wiki/concepts/wnm-anqp/)

---

## What an Action frame is

A management frame (subtype 13) containing:

| Byte | Field |
|---|---|
| 0 | Category |
| 1 | Action |
| 2..N | Action-specific body |

Categories define what kind of action this is. The IEEE registers them centrally — there are dozens. The ones that matter offensively:

| Category | Name | Robust? | Highlights |
|---|---|---|---|
| 0 | Spectrum Management | yes | Channel Switch Announcement (CSA), TPC Request/Report. |
| 1 | QoS | yes | ADDTS / DELTS / Schedule. |
| 3 | Block Ack | yes | ADDBA / DELBA — set up A-MPDU sessions. |
| 4 | Public | **no** | GAS Initial Request/Response — ANQP. |
| 5 | Radio Measurement | yes | 802.11k Neighbor Report, Beacon Request. |
| 6 | Fast BSS Transition | yes | 802.11r FT Action. |
| 7 | HT | yes | SM Power Save, MIMO control. |
| 8 | SA Query | yes | MFP liveness check. |
| 9 | Protected Dual of Public Action | yes | Encrypted GAS. |
| 10 | WNM | yes | BSS Transition Mgmt, WNM-Sleep, BSS Max Idle. |
| 11 | Unprotected WNM | **no** | Subset that pre-MFP could ride. |
| 14 | VHT | yes | |
| 15 | Unprotected DMG | no | 60 GHz. |
| 18 | Robust AV Streaming | yes | |
| 19 | Unprotected DMG | no | |
| 20 | VHT / HE / EHT extensions | yes | NDP-A, beamforming. |
| 126 | Vendor-specific Protected | yes | |
| 127 | Vendor-specific | **no** | Microsoft, Apple, Broadcom, Cisco extensions. |

## Robust vs unprotected

[802.11w / MFP](/wiki/concepts/mfp/) distinguishes **Robust Action frames** (the ones in the table marked "yes" — protected by PTK) from **public / unprotected Action frames** (broadcast / pre-association reachable).

The boundary matters because every interesting feature lives in Action frames, but the *Public Action* category is what's reachable before keys are installed and across BSS boundaries. Notable Public Action sub-types:

- **GAS** (Generic Advertisement Service) — used by ANQP and Hotspot 2.0 for pre-association queries.
- **Vendor-specific Public Action** — many vendors (Apple AirDrop, Wi-Fi Direct, Wi-Fi Aware, DPP-bootstrap) use this surface.

## Highlighted action surfaces

### Channel Switch Announcement (CSA)

Spectrum Management Action 4 ("Channel Switch Announcement"). Tells stations the AP is moving channels in N beacons. **Robust** — but the same information also rides in beacon CSA IE, which is *not* protected. Both forms are used in [rogue AP induction](/wiki/attacks/rogue-ap/).

### BSS Transition Management

WNM Action 7 / 8 ("BSS Transition Management Request / Response"). The AP can request that a STA roam to a different BSS. Used legitimately for load-balancing and 11k+11v steering; abused for forced-roaming attacks where an attacker convinces a STA to roam to an attacker-controlled BSS. Robust under MFP.

### WNM-Sleep

WNM Action 16 / 17 ("WNM Sleep Mode Request / Response"). A STA can enter long sleep with the AP buffering frames; on wake, the AP delivers buffered traffic *and* the GTK (so the STA hasn't missed a key rotation). [AirSnitch](/wiki/concepts/airsnitch-overview/) abuses WNM-Sleep Response (forged from a [Passpoint](/wiki/concepts/passpoint/) flaw) to install attacker-chosen GTK on a victim.

### Fast BSS Transition Action

FT Action category. Carries the FT 4-message exchange when used "over-the-DS" (between BSSes via the wired backbone) — the alternative to over-the-air FT Authentication. See [Fast BSS Transition](/wiki/concepts/fast-bss-transition/).

### Radio Measurement (802.11k)

RM category 5: Beacon Report Request/Response, Channel Load Request/Response, Noise Histogram, Frame Report. APs use these to crowdsource RF measurement from clients. Underused offensively but a side-channel for client location and capability tracking.

### Block Ack (ADDBA / DELBA)

The handshake that sets up A-MPDU aggregation. ADDBA establishes a Block Ack session with a starting sequence number. Some [FragAttacks](/wiki/attacks/fragattacks/) variants abuse the BA window to confuse defragmentation.

### SA Query

The MFP liveness check. After roaming, the AP can send an SA Query Request; the STA must respond with SA Query Response. If no response, the AP unprotectedly disassociates. Misused by some implementations to over-aggressively kick STAs.

### GAS / ANQP

Public Action 10 / 11 (GAS Initial Request / Response). Encapsulates ANQP queries — venue name, network type, IP-address-availability, NAI realm list. See [WNM and ANQP](/wiki/concepts/wnm-anqp/). Reachable **without association**, because GAS is a pre-association protocol. This is part of why AirSnitch can use Passpoint flaws against unconnected clients.

## Vendor-specific Action frames

Category 127. Each frame includes an OUI (3 bytes) plus vendor-defined sub-type. The richest examples:

- **Wi-Fi Direct (P2P)** — peer discovery, group owner negotiation.
- **Wi-Fi Aware (NAN)** — neighbour-aware networking, Apple AirDrop, Google Nearby Share.
- **DPP** — Device Provisioning Protocol bootstrap.
- **Apple Continuity** — handoff between iPhone/Mac.
- **Cisco / HP / Aruba** management extensions.

These run in cleartext as Public Action frames, observable by anyone in range. Tooling and research interest is rising — see [Wi-Fi Direct and TDLS](/wiki/concepts/wifi-direct-tdls/).

## Tooling

- `tshark -Y wlan.fc.type_subtype == 0x0d` filters Action frames; expand `wlan_mgt.fixed.category_code` to drill down.
- `scapy` `Dot11Action()` is incomplete — Action body is usually carried in a custom payload.
- `mdk4` injects spoofed BSS Transition Management requests for stress testing.

## See also

- [802.11 frame types](/wiki/concepts/80211-frame-types/) — Action is subtype 13 / 14.
- [MFP](/wiki/concepts/mfp/) — what's robust and what isn't.
- [Fast BSS Transition](/wiki/concepts/fast-bss-transition/), [Radio Resource Management](/wiki/concepts/radio-resource-mgmt/), [WNM and ANQP](/wiki/concepts/wnm-anqp/) — major subsystems whose surface is action frames.

## References

- IEEE 802.11-2020 §9.6 (Action frame format) and category-specific clauses.
- Wi-Fi Alliance — *Hotspot 2.0 Specification* — GAS / ANQP usage.
