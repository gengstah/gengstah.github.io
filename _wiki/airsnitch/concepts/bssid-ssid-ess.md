---
title: BSSID, SSID, and ESS
permalink: /wiki/airsnitch/concepts/bssid-ssid-ess/
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

The four-letter alphabet soup that AirSnitch arguments like `--same-bss` and `--other-bss` map onto.

## SSID — Service Set Identifier

The human-readable network name. `eduroam`, `xfinitywifi`, `MyHomeNet`. A string up to 32 octets. Multiple APs can advertise the same SSID; multiple SSIDs can be served by the same physical AP.

## BSSID — Basic Service Set Identifier

A specific 802.11 cell's identifier. In practice it is the MAC address of one of an AP's NICs. **One BSSID = one virtual switch port** in AirSnitch's model (NDSS'26 §V-B). Each BSSID has its own:

- [GTK / IGTK](/wiki/airsnitch/concepts/wifi-key-hierarchy/)
- per-BSSID `<MAC, PTK>` mapping (in `hostapd`)
- frequency / channel
- security configuration (it is legal for a single AP to broadcast a WPA2 BSSID and a WPA3 BSSID side-by-side)

A "single-BSSID network" is a home setup where one NIC advertises one network. A multi-BSSID network is anything more complex — multi-band, virtual SSIDs, multi-AP, enterprise.

## ESS — Extended Service Set

A logical network composed of multiple BSSes that share an SSID and authentication scheme. The ESS is what the user sees as "one network you stay connected to as you walk around the building". Roaming between BSSes within an ESS is supposed to be seamless — that is what [FT handshake](/wiki/airsnitch/concepts/handshakes/#fast-bss-transition-ft-handshake-ieee-80211r) is for.

ESSID is the SSID of an ESS. Used interchangeably in much of the literature.

## Why each layer matters to AirSnitch

| Concept | Role in attacks |
| --- | --- |
| **SSID** | Lets the attacker pick which network to authenticate to. Connecting to an *open* SSID (e.g. captive-portal guest) while attacking a WPA2-Enterprise SSID can leak victim traffic in plaintext (NDSS'26 §V-B end). |
| **BSSID** | The unit of [virtual port](/wiki/airsnitch/concepts/virtual-ports/). Cross-BSSID port stealing is what makes downlink interception possible (NDSS'26 §V-B). |
| **ESS** | Roaming with FT carries the *real* shared GTK in the FT handshake, defeating Passpoint's GTK randomization (NDSS'26 §IV-B-2). |

## Same-AP, different physical AP, different SSID

Three physical configurations matter for AirSnitch:

- **Same BSSID** (`--same-bss`). Attacker and victim on the same virtual port. Useful for [intra-BSSID](/wiki/airsnitch/concepts/client-isolation/) tests, [GTK abuse](/wiki/airsnitch/attacks/abusing-gtk/), [gateway bouncing](/wiki/airsnitch/attacks/gateway-bouncing/) baseline.
- **Different BSSID, same physical AP** (`--other-bss`). Required for [downlink port stealing](/wiki/airsnitch/attacks/port-stealing/#downlink) (the attacker needs a separate port to be the destination of stolen traffic). Common case: attacker on guest BSSID, victim on main BSSID; or 2.4 GHz vs 5 GHz of the same SSID.
- **Different physical AP, same distribution system** (cross-AP). Demonstrated in §VI-B and §VII-G. Port stealing escalates to the level of the distribution switch, breaking the assumption that physical separation provides isolation.

## Common multi-BSSID setups in the wild

- **Home router with guest network.** Two BSSIDs per band (main + guest) × two bands = 4 BSSIDs.
- **Enterprise with eduroam.** Open captive-portal SSID + staff SSID + eduroam, each on multiple bands across many physical APs. The two universities tested in §VII-F follow this layout.
- **Enterprise with PPSK.** One SSID with per-user passphrases; each user gets a distinct PMK. Closer to what client isolation should look like.

## The physical map

```
       Physical AP
       ┌──────────────────────────────────────────┐
       │  ┌──── 2.4 GHz NIC ─────┐  ┌── 5 GHz ──┐ │
       │  │                      │  │           │ │
       │  │ BSSID-Guest-2.4 ◄────┼──┼─► VAP     │ │
       │  │ BSSID-Main-2.4  ◄────┼──┼─► VAP     │ │
       │  └──────────────────────┘  └───────────┘ │
       │                  │  │                    │
       │              ┌───┴──┴───┐                │
       │              │ internal │                │
       │              │  bridge  │  ◄── port stealing acts here
       │              └─────┬────┘                │
       └────────────────────┼─────────────────────┘
                            │
                       Distribution switch / wired uplink
```

Each BSSID is a virtualised port on the internal bridge. The bridge is what the AP daemon (`hostapd`, `nas`, vendor-specific) configures. AirSnitch's port-stealing attack manipulates the MAC-port mapping on this bridge.

## See also

- [Virtual ports](/wiki/airsnitch/concepts/virtual-ports/)
- [Distribution system](/wiki/airsnitch/concepts/distribution-system/) *(planned, currently summarised here)*
- [Port stealing](/wiki/airsnitch/attacks/port-stealing/)
