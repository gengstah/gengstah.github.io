---
title: "Radio Resource Management (802.11k) and BSS Transition Management (802.11v)"
permalink: /wiki/concepts/radio-resource-mgmt/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - 80211k
  - 80211v
  - roaming
---

*The two amendments that turn the AP into a coordinator: it tells STAs about neighbour BSSes, asks them to measure RF, and politely requests they roam. Together with [802.11r](/wiki/concepts/fast-bss-transition/), the "K-V-R triad" of fast-roaming Wi-Fi.*

**Status:** drafting
**Related:** [Action frames](/wiki/concepts/action-frames/), [Fast BSS Transition](/wiki/concepts/fast-bss-transition/), [WNM and ANQP](/wiki/concepts/wnm-anqp/)

---

## 802.11k — Radio Resource Management

A STA decides which BSS to associate with using mostly-local RSSI. 11k lets the AP supply richer information.

### Neighbor Report

The STA sends an Action frame `RM Neighbor Report Request`; the AP replies with a list of nearby BSSes in the same ESS:

| Field per neighbour | Meaning |
|---|---|
| BSSID | The neighbour AP MAC. |
| Operating Class + Channel | Where to find it. |
| BSSID Information | RM-capable, security match, mobility domain match, FT support. |
| (PHY type, etc.) | Capabilities |

The STA can then directly probe the neighbour's channel and pre-authenticate / FT-roam without scanning every channel. Massive scan-time savings.

### Beacon Reporting

The AP sends `RM Beacon Request` asking the STA to measure beacons on a channel for a duration. The STA returns `Beacon Report` listing observed BSSIDs, RSSIs, channel utilisation. APs use this to crowdsource RF environment.

**Privacy / surveillance angle.** The AP can ask any associated STA to measure any channel, returning a fingerprint of the STA's surroundings. In dense environments, repeated queries reveal motion, presence, and (with multi-AP triangulation) location. Policy-wise this is rarely surfaced to users.

### Other measurement requests

- **Channel Load Request / Response** — channel busy fraction.
- **Noise Histogram** — RSSI distribution.
- **Frame Report** — per-MAC frame counts.
- **STA Statistics** — TX retry counters.
- **Location Configuration** — request location info from the STA (rarely deployed).

## 802.11v — Wireless Network Management

A grab-bag of management features. The two that matter:

### BSS Transition Management (BTM)

The AP sends a `BSS Transition Management Request` (Action frame) suggesting the STA roam to a different BSS. Reasons:

- Load balancing.
- Better candidate (RSSI / band).
- AP shutting down.

The request includes a candidate list and a disassociation imminent flag. Compliant clients (modern iOS, Android, Windows, macOS) honour it and roam quickly without scanning. Non-compliant clients ignore it.

**Forced-roaming attack.** An attacker forging a BTM Request with the disassociation-imminent flag and a candidate list pointing at the attacker's AP can convince a STA to roam to attacker-controlled infrastructure. BTM is a Robust Action frame so MFP protects it once PTK is installed — but pre-association BTM (sent during the brief window before MFP is active) and BTM from a *legitimate*-looking AP that's actually a clone are open surfaces.

### WNM-Sleep

A long-sleep mode where the AP buffers frames for the STA. Notably, on wake, the AP delivers a fresh GTK so the STA hasn't missed a key rotation.

[AirSnitch](/wiki/concepts/airsnitch-overview/)'s GTK-injection attack chain abuses WNM-Sleep Response — forging one (using a [Passpoint](/wiki/concepts/passpoint/) flaw allowing IGTK reuse) installs an attacker-chosen GTK on the victim. See [Passpoint flaws](/wiki/attacks/passpoint-flaws/).

### BSS Max Idle

Negotiated in Association Response. After this many seconds without traffic, the AP disassociates the STA. WNM-Sleep extends the limit.

### Other 11v features

- **Directed Multicast Service (DMS)** — STA requests specific multicast streams as unicast.
- **TIM Broadcast** — broadcast TIM updates between beacons.
- **Triggered STA Statistics** — AP requests stats on demand.

## The K-V-R triad

Together, 802.11k+v+r enable enterprise-grade roaming:

| Step | Amendment | What happens |
|---|---|---|
| 1 | 802.11k | STA learns neighbour BSSes. |
| 2 | 802.11v | AP nudges STA to roam (BTM Request). |
| 3 | 802.11r | STA roams in <50 ms via FT. |

A network that supports all three can move a VoIP-active client between APs without dropping a syllable.

## Detection / observation

- Beacon's `RM Enabled Capabilities` IE (tag 70) and `Extended Capabilities` IE indicate 802.11k support.
- Beacon's `BSS Transition` and `WNM-Sleep` bits in Extended Capabilities IE indicate 802.11v support.
- BTM Request decode in Wireshark — Action category 10, action 7.

## See also

- [Action frames](/wiki/concepts/action-frames/) — RM and WNM categories.
- [Fast BSS Transition](/wiki/concepts/fast-bss-transition/) — the R of K-V-R.
- [Power-save / TIM / DTIM](/wiki/concepts/power-save-tim-dtim/) — companion to WNM-Sleep.

## References

- IEEE 802.11-2020 §11.10 (Radio Measurement) and §11.11 (WNM).
- Cisco — *802.11k, 802.11v, and 802.11r* — operator-side coverage.
