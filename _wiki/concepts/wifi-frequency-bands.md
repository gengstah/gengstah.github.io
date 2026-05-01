---
title: "Wi-Fi Frequency Bands, Channels, and Bandwidth"
permalink: /wiki/concepts/wifi-frequency-bands/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - phy
  - spectrum
---

*The 2.4 / 5 / 6 / 60 GHz bands Wi-Fi uses, how channels are numbered, what bandwidths are legal, and the spectrum constraints (DFS, AFC, transmit power) attackers run into.*

**Status:** drafting
**Related:** [802.11 standards](/wiki/concepts/802-11-standards/), [Beacon frames](/wiki/concepts/beacon-frames/), [Monitor mode and packet injection](/wiki/concepts/monitor-mode-injection/)

---

## The bands

| Band | Range | Channels | Bandwidths | Notes |
|---|---|---|---|---|
| 2.4 GHz | 2.400–2.4835 GHz | 1–13 (14 in JP) | 20 / 40 MHz | Heavy congestion; only 3 non-overlapping 20 MHz channels (1, 6, 11). |
| 5 GHz | 5.150–5.895 GHz (region-dependent) | 36–177 | 20 / 40 / 80 / 160 MHz | DFS required on 52–144. |
| 6 GHz | 5.925–7.125 GHz | 1–233 (in 20 MHz steps) | 20 / 40 / 80 / 160 / 320 MHz | Wi-Fi 6E / 7 only. WPA3 mandatory. AFC for standard-power. |
| 60 GHz | 57–71 GHz | 1–8 | 2.16 GHz channels | 802.11ad/ay (WiGig); short range, line-of-sight. |

## 2.4 GHz quirks

- 22 MHz wide channels overlap. Only **1, 6, 11** are non-overlapping. 40 MHz on 2.4 GHz is widely deployed but typically backs off to 20 MHz under congestion (HT 40-intolerance).
- Channel 14 is JP-only and DSSS-only.
- Bluetooth, Zigbee, microwave ovens, and consumer baby monitors share the band — interference is the rule, not the exception.

## 5 GHz: UNII bands and DFS

5 GHz is divided into UNII sub-bands with different rules:

| Sub-band | Channels (US) | Power | DFS? |
|---|---|---|---|
| UNII-1 | 36–48 | up to 30 dBm | no |
| UNII-2A | 52–64 | up to 24 dBm | **yes** |
| UNII-2C / UNII-2 Extended | 100–144 | up to 24 dBm | **yes** |
| UNII-3 | 149–165 | up to 30 dBm | no |

**DFS (Dynamic Frequency Selection)** is mandatory on UNII-2 / UNII-2 Extended because those channels overlap with weather radar. The AP must:

1. Listen for radar before transmitting on a DFS channel (CAC — Channel Availability Check, 60 s minimum, 10 min on TDWR).
2. Continuously monitor for radar while operating.
3. Vacate the channel within 10 s if a radar signal is detected.

**Offensive implication.** A spoofed radar pulse will kick a target AP off a DFS channel — a niche but documented denial-of-service / channel-steering trick.

## 6 GHz: clean spectrum, with rules

802.11ax-6E and 802.11be opened the **5.925–7.125 GHz** band. Three power classes:

| Class | Power | Indoor only? | AFC required? |
|---|---|---|---|
| LPI (Low-Power Indoor) | ≤ 30 dBm EIRP | yes | no |
| VLP (Very Low Power) | ≤ 14 dBm EIRP | no | no |
| Standard Power | ≤ 36 dBm EIRP | no | **yes** (Automated Frequency Coordination) |

**AFC (Automated Frequency Coordination)** is the Wi-Fi-equivalent of DFS for 6 GHz: an AP queries an FCC-approved AFC service for a list of usable channels in its location, and the service excludes channels in use by incumbent fixed-service licensees. Without AFC, the AP is restricted to LPI / VLP modes.

**Offensive implication.** 6 GHz is uncongested *and* WPA3-mandatory (Wi-Fi Alliance certification). PSK-era passive attacks ([machine-on-the-side](/wiki/attacks/machine-on-the-side/)) don't apply unless the SSID also has a 2.4 / 5 GHz BSS — and most SSIDs do. The downgrade is the attack surface.

## Channel bonding and bandwidth

A single 802.11 channel is 20 MHz. Higher generations bond adjacent channels:

- **40 MHz** (HT, 802.11n+) — primary + secondary 20 MHz.
- **80 MHz** (VHT, 802.11ac+) — four 20 MHz.
- **160 MHz** (VHT/HE) — eight 20 MHz, contiguous or 80+80 MHz.
- **320 MHz** (EHT, Wi-Fi 7) — sixteen 20 MHz; primarily on 6 GHz.

Each beacon advertises the operating bandwidth in HT / VHT / HE / EHT Operation IEs. The beacon's *primary* channel is what stations tune to; the *secondary* / extension channels are derived.

## Spectrum-related attack surface

| Surface | Attack |
|---|---|
| Channel switch announcement (CSA) | Forced rogue-AP induction; CSA spoof to herd clients to attacker channel ([rogue AP](/wiki/attacks/rogue-ap/)). |
| DFS radar detection | Spoofed radar → AP vacates channel (channel steering / DoS). |
| Country IE | Country-code spoofing in beacons can change a client's regulatory domain → unlock disallowed channels / power for the attack. |
| 6 GHz AFC | Spoofed location reports to an AFC service (research surface; no public weaponised attack as of 2026). |
| Out-of-band interference | Bluetooth coexistence quirks — the L2CAP/Wi-Fi coexistence in some chipsets can leak which Wi-Fi channel is active. |

## See also

- [802.11 standards](/wiki/concepts/802-11-standards/) — which generations use which bands.
- [Beacon frames](/wiki/concepts/beacon-frames/) — where channel and bandwidth are announced.
- [Monitor mode and packet injection](/wiki/concepts/monitor-mode-injection/) — how the channel parameter is set on the radio.

## References

- IEEE 802.11-2020 §15-19 (PHY clauses).
- FCC Part 15.407 — 6 GHz rules.
- ETSI EN 301 893 — 5 GHz DFS rules (EU).
