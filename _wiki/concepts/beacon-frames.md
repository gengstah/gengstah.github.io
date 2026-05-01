---
title: "Beacon Frames"
permalink: /wiki/concepts/beacon-frames/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - beacon
---

*The most-transmitted frame on any Wi-Fi network — and the single richest source of unauthenticated information about a BSS.*

**Status:** drafting
**Related:** [802.11 frame types](/wiki/concepts/80211-frame-types/), [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/), [BSSID / SSID / ESS](/wiki/concepts/bssid-ssid-ess/), [RSN information element](/wiki/concepts/rsn-information-element/), [Power-save / TIM / DTIM](/wiki/concepts/power-save-tim-dtim/)

---

## What a beacon contains

An AP broadcasts a beacon every **TBTT** (Target Beacon Transmission Time) — by default 102.4 ms, i.e. ~10 / second. Every station within range sees every beacon it can demodulate.

Fixed fields:

| Field | Bytes | Purpose |
|---|---|---|
| Timestamp | 8 | TSF (Timing Synchronization Function), microseconds. |
| Beacon Interval | 2 | TBTTs in TUs (1 TU = 1024 µs). |
| Capability Information | 2 | ESS/IBSS, Privacy bit, Short Preamble, etc. |

Information Elements (IEs) follow — variable, advertised by tag number:

| Tag | Name | What it carries |
|---|---|---|
| 0 | SSID | Network name (zero-length = "hidden"). |
| 1 | Supported Rates | Legacy rate set. |
| 3 | DS Parameter Set | Primary channel. |
| 5 | TIM | Traffic Indication Map (which sleeping clients have buffered traffic). |
| 7 | Country | Regulatory domain + power constraints. |
| 32 | Power Constraint | TPC base. |
| 35 | TPC Report | TPC current. |
| 36 | Channel Switch Announcement | Forthcoming channel change. |
| 42 | ERP Information | 802.11g protection. |
| 45 | HT Capabilities | 802.11n. |
| 48 | [RSN](/wiki/concepts/rsn-information-element/) | Cipher suites, AKM, MFP capability. |
| 50 | Extended Supported Rates | |
| 54 | Mobility Domain | 802.11r FT. |
| 61 | HT Operation | |
| 70 | RM Enabled Capabilities | 802.11k. |
| 191 | VHT Capabilities | 802.11ac. |
| 192 | VHT Operation | |
| 195 | Transmit Power Envelope | |
| 255 | Element ID Extension | HE / EHT capabilities (Wi-Fi 6/7). |
| 221 | Vendor Specific | WPA1 IE, WPS IE, Microsoft / Apple / Cisco extensions. |

Authentication / encryption settings come from the RSN IE; the underlying generations come from HT/VHT/HE/EHT IEs; the AP's neighbours come from Reduced Neighbor Report (Wi-Fi 6E+).

## What beacons leak

Everything an attacker needs to plan an attack:

- **SSID** (or that the SSID is hidden).
- **BSSID** (the AP MAC).
- **Cipher / AKM** — WPA2-PSK vs WPA3-SAE vs WPA-Enterprise vs Open is in the RSN IE.
- **MFP capability and required-flag** — likewise in the RSN IE.
- **Operating channel and bandwidth.**
- **Manufacturer fingerprint** — vendor-specific IEs frequently include WPS Manufacturer/Model strings, even when WPS is "disabled".
- **WPS state** — locked / unlocked, version, configured.
- **Mobility Domain ID** — same MD ID across BSSes means 802.11r FT roaming is possible.
- **BSS Load** — current station count, channel utilisation (when 802.11k is enabled).

## Hidden SSIDs

A "hidden" beacon has SSID length = 0. The first probe request from any client carries the real SSID, and the AP's probe response includes it. Hiding offers zero security and breaks Passive Scanning behaviour on some clients.

## TIM and DTIM

Beacon's TIM IE encodes which sleeping (power-save) stations have data waiting. Every Nth beacon is a **DTIM** (Delivery Traffic Indication Message), which signals upcoming buffered broadcast/multicast traffic. DTIM count is in the TIM IE.

The protocol invariant: a power-saving STA must wake for every DTIM and check the bitmap. This is the substrate the [GTK abuse](/wiki/attacks/abusing-gtk/) attack rides on — an attacker times broadcast injection to follow a forged DTIM.

## Channel Switch Announcement (CSA)

A beacon (or Action frame) can carry a CSA IE that tells stations to switch to a new channel after N more beacons. **CSA is unauthenticated even with MFP** — that's the well-known weakness used by [rogue AP](/wiki/attacks/rogue-ap/) (herd a target STA to the attacker's channel) and channel-steering DoS.

## Beacon protection (BIGTK / 802.11w-2020)

Wi-Fi 6 introduced Beacon Integrity using the BIGTK. When enabled, the beacon includes a MIC IE; stations verify it with the BIGTK distributed during the 4-way handshake. Adoption is sparse as of 2026; even where AP support exists, clients don't always validate.

## Tooling notes

- `airodump-ng` lists every beacon it sees — channel, BSSID, ESSID, AKM, cipher.
- `kismet` parses every IE and persists them.
- `tshark -Y wlan.fc.type_subtype==0x08 -V` decodes a single beacon in full.
- `bettercap`'s `ble.recon` / `wifi.recon` does the same with structured output.
- `hcxdumptool` strips beacons into a corpus suitable for `hashcat` PMKID/WPA-handshake cracking.

## See also

- [BSSID / SSID / ESS](/wiki/concepts/bssid-ssid-ess/) — the identifiers a beacon advertises.
- [RSN IE](/wiki/concepts/rsn-information-element/) — security parameters in detail.
- [Probe Request and PNL](/wiki/concepts/probe-requests-pnl/) — the client side of "what AP do I see?".
- [Power-save / TIM / DTIM](/wiki/concepts/power-save-tim-dtim/).

## References

- IEEE 802.11-2020 §9.3.3.3, §9.4.
- Wi-Fi Alliance — *WPA3 Specification v3.4* — beacon-protection requirements.
