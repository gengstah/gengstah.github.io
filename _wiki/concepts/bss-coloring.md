---
title: "BSS Coloring (Wi-Fi 6)"
permalink: /wiki/concepts/bss-coloring/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - 80211ax
  - bss-color
  - spatial-reuse
---

*A Wi-Fi 6 PHY trick to let neighbouring BSSes transmit simultaneously instead of taking turns. Tiny 6-bit "color" in the PHY header lets a receiver decide "this isn't my BSS, I'll back off less aggressively". Good for density; mild fingerprinting / DoS surface.*

**Status:** drafting
**Related:** [802.11 standards](/wiki/concepts/802-11-standards/), [OFDM / OFDMA](/wiki/concepts/ofdm-ofdma/), [Beacon frames](/wiki/concepts/beacon-frames/)

---

## What it solves

Pre-Wi-Fi-6, CSMA/CA assumes any frame on your channel is a reason to back off. In dense deployments (apartment blocks, stadia, conference halls) that means even faint signals from a neighbouring AP cause your STAs to defer transmission. Air-time is wasted on wait.

Wi-Fi 6 adds a 6-bit **BSS Color** carried in the HE-SIG-A field of the PHY preamble. Each BSS picks a color (0–63). When a STA receives a frame, it can compare the frame's BSS Color to its own:

- **Same BSS** — defer normally, this is intra-BSS contention.
- **Different BSS, OBSS** — apply the **OBSS_PD** (Overlapping BSS Packet Detect) threshold: only defer if the signal is above a configurable RSSI level. Below the threshold, just transmit anyway.

Net effect: more parallel transmission, more aggregate throughput in dense areas.

## Spatial Reuse parameters

Beacon (HE Operation IE) carries:

- **BSS Color** — current value.
- **Partial BSS Color** — for spatial-reuse signalling.
- **OBSS_PD min/max** — RSSI thresholds.
- **Color Switch Announcement** — "I'm changing color in N beacons."

Color Switch is needed because a color must be unique among neighbours. If two APs end up on the same color, they perform a **collision-detection** exchange (HE Trigger Frame with collision indication) and one switches.

## Attack surface

Modest, mostly research-curiosity:

### Color collision DoS

An attacker beacons a forged AP with the *target* BSS's color. Legitimate stations on the target BSS interpret nearby attacker frames as same-BSS and defer accordingly, slightly reducing throughput. Or the target AP detects collision and switches color repeatedly, eating airtime on the change.

### Spatial-reuse manipulation

An attacker transmitting just below the target AP's OBSS_PD threshold can poke at the threshold to tune false-positive collision behaviour. Niche; depends on chipset implementation.

### Coexistence fingerprinting

The OBSS_PD threshold value, color-switch frequency, and STR/NSTR (Wi-Fi 7) decisions are vendor-specific. They constitute a fingerprint of the AP.

## Detection / observation

- Beacon's HE Operation IE includes the current BSS Color.
- `tshark -V` decodes HE Capabilities and HE Operation cleanly.
- Wireshark expands `wlan.he.phy.bss_color`.

## Wi-Fi 7 extensions

Wi-Fi 7 (802.11be) extends BSS Coloring with **Multi-Link Operation** considerations: a multi-link device (MLD) can have different BSS Colors on different links. Spatial reuse decisions are made per-link.

EHT also adds **Restricted TWT (rTWT)** that integrates with spatial reuse — rTWT-scheduled time only honours intra-BSS transmissions, suspending OBSS spatial reuse during low-latency traffic windows.

## See also

- [802.11 standards](/wiki/concepts/802-11-standards/) — Wi-Fi 6 / 7 context.
- [OFDM / OFDMA](/wiki/concepts/ofdm-ofdma/) — same era of density features.
- [Beacon frames](/wiki/concepts/beacon-frames/) — HE Operation IE.

## References

- IEEE 802.11ax-2021, 802.11be-2024 — BSS Color clauses.
- Wi-Fi Alliance — *Wi-Fi 6 Spatial Reuse Technical Brief*.
