---
title: "802.11 Standards Family (Wi-Fi 1 → Wi-Fi 7)"
permalink: /wiki/concepts/802-11-standards/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - phy
  - 80211
---

*The 802.11 amendments that define what each generation of Wi-Fi hardware actually does on the air, and which ones matter for offence.*

**Status:** drafting
**Related:** [Frequency bands and channels](/wiki/concepts/wifi-frequency-bands/), [OFDM / OFDMA / MU-MIMO](/wiki/concepts/ofdm-ofdma/), [Frame types](/wiki/concepts/80211-frame-types/)

---

## Generation map

| Wi-Fi name | Amendment | Year | Bands | Max link rate | Modulation / key features |
|---|---|---|---|---|---|
| (legacy) | 802.11 | 1997 | 2.4 GHz | 2 Mbps | DSSS / FHSS |
| Wi-Fi 1 | 802.11b | 1999 | 2.4 GHz | 11 Mbps | DSSS, CCK |
| Wi-Fi 2 | 802.11a | 1999 | 5 GHz | 54 Mbps | OFDM (52 sub-carriers) |
| Wi-Fi 3 | 802.11g | 2003 | 2.4 GHz | 54 Mbps | OFDM on 2.4 GHz |
| Wi-Fi 4 | 802.11n | 2009 | 2.4 / 5 GHz | 600 Mbps | MIMO (4×4), 40 MHz, A-MPDU/A-MSDU |
| Wi-Fi 5 | 802.11ac | 2013 | 5 GHz | ~6.9 Gbps | 80/160 MHz, 256-QAM, MU-MIMO (DL) |
| Wi-Fi 6 | 802.11ax | 2019 | 2.4 / 5 GHz | ~9.6 Gbps | OFDMA, 1024-QAM, MU-MIMO (UL+DL), TWT, BSS coloring |
| Wi-Fi 6E | 802.11ax (6 GHz) | 2020 | + 6 GHz | ~9.6 Gbps | Same PHY as 6, new clean 6 GHz spectrum, **WPA3 mandatory** |
| Wi-Fi 7 | 802.11be | 2024 | 2.4 / 5 / 6 GHz | ~46 Gbps | 320 MHz, 4096-QAM, MLO (Multi-Link Operation), preamble puncturing |

## Companion amendments worth knowing

| Amendment | What it adds |
|---|---|
| 802.11i (2004) | RSN — WPA2/CCMP. Defines the 4-way handshake. |
| 802.11e (2005) | QoS / WMM — access categories, EDCA. |
| 802.11r (2008) | [Fast BSS Transition](/wiki/concepts/fast-bss-transition/) — sub-50 ms roaming. |
| 802.11k (2008) | [Radio Resource Management](/wiki/concepts/radio-resource-mgmt/) — neighbour reports. |
| 802.11v (2011) | BSS Transition Management, WNM-Sleep, BSS Max Idle. |
| 802.11w (2009) | [MFP](/wiki/concepts/mfp/) — protected management frames. |
| 802.11s (2011) | [Mesh networking](/wiki/concepts/wifi-mesh/). |
| 802.11u (2011) | [WNM / ANQP](/wiki/concepts/wnm-anqp/) — pre-association queries (Hotspot 2.0 base). |
| 802.11ad / ay | 60 GHz (WiGig) — short-range, line-of-sight. |
| 802.11az | Fine timing measurement (positioning). |
| 802.11ba | Wake-up radio. |
| 802.11bh / bi | MAC-randomisation / privacy amendments (in progress). |

## Why this matters offensively

- **Capability discovery from beacons.** Beacons advertise the supported amendments via fixed fields and Information Elements (HT Capabilities, VHT Capabilities, HE Capabilities, EHT Capabilities, RSN, Mobility Domain). A scan tells you the standards in play before you decide on attack class.
- **Wi-Fi 6E / Wi-Fi 7 force WPA3.** The Wi-Fi Alliance certification rules require WPA3-only operation on 6 GHz. PSK-era attacks ([machine-on-the-side](/wiki/attacks/machine-on-the-side/)) don't apply on 6 GHz networks unless the 2.4/5 GHz BSSes of the same SSID downgrade.
- **Multi-Link Operation (Wi-Fi 7) changes the threat model.** A single client uses two or three radios on different bands as one logical link. PTK is per-MLD (multi-link device), not per-link, with implications for replay / nonce reuse research that haven't been fully studied yet.
- **Aggregation amendments are exploit surface.** A-MSDU and A-MPDU (introduced in 802.11n) are the substrate for [FragAttacks](/wiki/attacks/fragattacks/) — an unauthenticated A-MSDU bit lets a frame be reinterpreted as a sub-frame container.

## See also

- [Frequency bands and channels](/wiki/concepts/wifi-frequency-bands/) — what physical spectrum each generation uses.
- [OFDM / OFDMA / MU-MIMO](/wiki/concepts/ofdm-ofdma/) — the modulation schemes the table references.
- [WPA versions](/wiki/concepts/wpa-versions/) — security profiles that ride on top of these PHYs.

## References

- IEEE 802.11-2020 + amendments — <https://standards.ieee.org/ieee/802.11/7028/>
- Wi-Fi Alliance — *Generational Wi-Fi Names* — <https://www.wi-fi.org/discover-wi-fi/wi-fi-certified-7>
