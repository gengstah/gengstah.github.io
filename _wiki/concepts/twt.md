---
title: "TWT — Target Wake Time"
permalink: /wiki/concepts/twt/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - 80211ax
  - twt
  - power-save
---

*Wi-Fi 6's coordinated power-save scheduling. STAs and APs negotiate explicit wake schedules instead of waking on every TBTT — battery-life win for IoT, scheduling surface for both performance and (a small amount of) attack.*

**Status:** drafting
**Related:** [Power-save / TIM / DTIM](/wiki/concepts/power-save-tim-dtim/), [802.11 standards](/wiki/concepts/802-11-standards/), [Action frames](/wiki/concepts/action-frames/)

---

## What TWT is

Defined in 802.11ah (Wi-Fi HaLow, sub-1 GHz) and brought into 802.11ax for mainstream Wi-Fi. Two flavours:

- **Individual TWT** — one STA negotiates a personal wake schedule with the AP.
- **Broadcast TWT** — the AP announces a schedule that all participating STAs follow.

A TWT agreement specifies:

- **Service Period start time** — TSF microseconds.
- **Service Period duration** — how long the STA is awake.
- **Wake Interval** — gap between Service Periods.
- **Trigger-enabled** — does the AP send a Trigger Frame at SP start?
- **Announced** — does the STA send a frame announcing wake?
- **Flow ID** — multiple TWT agreements per STA possible.

The STA can sleep deeply between SPs — drawing < 1 mW for hours at a time — and the AP doesn't waste airtime trying to reach it.

## Why this matters offensively (small surface)

TWT itself is a Robust Action frame exchange (Wi-Fi 6 added it to the protected set), so MFP-protected once installed. But:

- **Negotiation timing leaks**. The TWT Setup includes the STA's MAC and explicit schedule. An off-band observer can see who's awake when.
- **Trigger Frame DoS**. An attacker forging Trigger Frames during a TWT SP can drown the SP, forcing the STA to extend wake or miss the AP's actual trigger. Demonstrated in academic work but not weaponised.
- **TWT leakage on chipset bugs**. Some early 11ax chipsets exposed TWT state via side channels (CSI, beamforming feedback). A remote attacker can sometimes infer the TWT schedule and time other attacks (e.g. KRACK-style replays) for moments the STA is *not* in deep sleep.

## TWT as a fingerprint

Per-vendor TWT scheduling defaults differ. Apple TWT is conservative; Google TWT for Pixel devices uses a different cadence; Amazon Echo's HaLow TWT is yet another. An attacker fingerprinting a STA by its TWT-negotiation pattern can identify device model + firmware revision without ever getting an L3 reply.

Privacy-research community has flagged this; mitigations are minimal as of 2026.

## Setup frame

TWT Setup is an Action frame (category 6, Action 4):

```
Action: TWT Setup
TWT Element:
  Setup Command (Request / Suggest / Demand / Accept / Alternate / ...)
  TWT Flow ID
  Wake Interval (mantissa + exponent)
  Wake Duration
  Implicit / Announced / Trigger flags
  Channel Constraint
```

`tshark -Y wlan_radio.he && wlan.fc.subtype == 0x0d` filters TWT setup frames (with extra category filter).

## Tooling

- `iw dev wlan0 set twt …` (Linux mac80211 with HE support).
- `hostapd.conf` — `he_twt_required=1` to require TWT-capable clients.
- `wireshark` decodes TWT IE in beacons (`HE Operation` element) and Setup frames.

## See also

- [Power-save / TIM / DTIM](/wiki/concepts/power-save-tim-dtim/) — the legacy power-save model TWT supplements.
- [802.11 standards](/wiki/concepts/802-11-standards/) — Wi-Fi 6 / Wi-Fi HaLow.
- [Action frames](/wiki/concepts/action-frames/) — TWT Setup is Action category 6.

## References

- IEEE 802.11ah-2016, 802.11ax-2021 — TWT clauses.
- *Target Wake Time in 802.11ax* — Khorov et al. analysis.
