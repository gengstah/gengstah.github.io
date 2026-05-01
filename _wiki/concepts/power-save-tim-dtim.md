---
title: "Power Save, TIM, and DTIM"
permalink: /wiki/concepts/power-save-tim-dtim/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - mac
  - power-save
---

*How sleeping clients are notified of buffered traffic — and why the power-save bit in a forged frame is enough to redirect a victim's traffic into an attacker's buffer.*

**Status:** drafting
**Related:** [Beacon frames](/wiki/concepts/beacon-frames/), [802.11 frame types](/wiki/concepts/80211-frame-types/), [Framing Frames](/wiki/attacks/framing-frames/), [MFP deauthentication](/wiki/attacks/mfp-deauthentication/)

---

## Why power save exists

Battery-powered Wi-Fi devices spend most of their time idle. Keeping the radio in receive draws ~100–300 mW; idling it (deep sleep) draws < 1 mW. The 802.11 power-save protocol lets the AP buffer downstream frames for a sleeping STA and signal "wake up, you have mail" via beacons.

## The power-save bit

Every 802.11 frame's Frame Control field includes a `Power Management` bit:

- `PM = 0` — STA is awake and willing to receive.
- `PM = 1` — STA has gone to sleep; the AP MUST buffer subsequent unicast frames for it.

The AP tracks the per-STA PM state. Every STA carries it in *every* frame, so the AP sees state changes inline.

## TIM — Traffic Indication Map

Every beacon includes a **TIM IE** (tag 5). It encodes:

- **DTIM Count** — beacons until the next DTIM (e.g. count=3 means the *next* DTIM is 3 beacons away).
- **DTIM Period** — how often DTIMs occur (every Nth beacon).
- **Bitmap Control** + **Partial Virtual Bitmap** — which AIDs (associated stations) have buffered unicast traffic.

A power-saving STA wakes for every beacon (or every Nth, configurable as Listen Interval), checks its bit in the TIM bitmap, and if set sends a PS-Poll to retrieve the buffered frame.

## DTIM — Delivery Traffic Indication Message

A DTIM is a beacon whose TIM IE has the bitmap-control's most-significant bit set. It announces: **after this beacon, broadcast and multicast frames buffered for the BSS will be sent**. Every STA in power save MUST wake for every DTIM, even if no unicast is pending for it.

DTIM Period defines the rate. Common values:

| DTIM Period | Effect |
|---|---|
| 1 | Every beacon is a DTIM. Most responsive; most power use. |
| 3 | Default on many APs. Balance. |
| 10+ | Battery-friendly; multicast latency goes up. |

Voice / video applications (multicast streams) need low DTIM Period. IoT / low-power devices benefit from higher.

## Pre-association frame buffering

Before WPA install, a STA isn't in power save with the AP. After Association Response, the STA can immediately set PM=1 to start saving power. APs implementing this correctly buffer all subsequent frames — *including* the EAPOL-Key frames of the 4-way handshake.

## Offensive uses of the power-save bit

The power-save bit is **unauthenticated** in MFP-protected networks (it's in the MAC header, outside the encrypted body) — and in plaintext networks it's trivially spoofable.

### Vanhoef *Framing Frames* (USENIX 2023)

An attacker forges a Null Data frame from the *victim's* MAC with PM=1. The AP starts buffering frames for the victim. The attacker forges a PS-Poll (or QoS-Data with PM=0) from the same MAC, requesting buffered frames; the AP sends them — to *whoever* is currently mapped to the victim's MAC in the AP's bridge FDB. By manipulating the FDB (port stealing) the attacker receives the buffered traffic.

This is one of the rare attacks that survives MFP, because the power-save signalling happens via Null Data frames whose PM bit is in the unprotected MAC header.

### MFP deauthentication (Schepers + Vanhoef, WiSec'22)

A related observation: even with MFP enabled, the **transition out of power save** sometimes triggers an unauthenticated state-machine transition that can be replayed to disconnect a victim. See [MFP deauthentication](/wiki/attacks/mfp-deauthentication/).

### GTK abuse via DTIM

[Abusing GTK](/wiki/attacks/abusing-gtk/) tied to power save: an insider knowing the GTK can broadcast frames timed against the AP's DTIM cycle so victims wake and accept them.

## Listen Interval and BSS Max Idle

Two related parameters:

- **Listen Interval** — how often the STA wakes to check the TIM (in beacon intervals). Negotiated in Association Request. Higher = sleepier; the AP must buffer for the duration.
- **BSS Max Idle Period** — how long the AP keeps the STA in its association table without traffic. Sent in Association Response. After this, the AP disassociates the STA. Default 60–300 s.

A STA can use [WNM-Sleep](/wiki/concepts/action-frames/) (Action frame in WNM category) to sleep across Max Idle without being kicked.

## Tooling

- `airodump-ng` shows DTIM Period and Beacon Interval per BSS.
- `tshark -Y wlan.fc.pwrmgt == 1` filters frames with PM=1.
- `wpa_cli ps_mode` toggles client-side power save (Linux mac80211).

## See also

- [Beacon frames](/wiki/concepts/beacon-frames/) — TIM IE format.
- [802.11 frame types](/wiki/concepts/80211-frame-types/) — Null function (data subtype 4) and PS-Poll (control subtype 10).
- [Framing Frames](/wiki/attacks/framing-frames/), [MFP deauthentication](/wiki/attacks/mfp-deauthentication/), [Abusing GTK](/wiki/attacks/abusing-gtk/).

## References

- IEEE 802.11-2020 §11.2 (Power Management).
- Schepers, Ranganathan, Vanhoef — *Framing Frames* — USENIX Security 2023.
