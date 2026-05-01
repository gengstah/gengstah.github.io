---
title: "OFDM, OFDMA, MU-MIMO, Beamforming"
permalink: /wiki/concepts/ofdm-ofdma/
layout: single
author_profile: true
tags:
  - wifi
  - concept
  - phy
  - modulation
---

*The PHY-layer techniques that turn shared spectrum into many simultaneous parallel links — and the side-channels they introduce.*

**Status:** drafting
**Related:** [802.11 standards](/wiki/concepts/802-11-standards/), [Frequency bands](/wiki/concepts/wifi-frequency-bands/), [BSS coloring](/wiki/concepts/bss-coloring/)

---

## OFDM — Orthogonal Frequency-Division Multiplexing

A 20 MHz channel is split into 64 sub-carriers (52 useful in 802.11a/g/n, 56 in HT, 234 in HE 20 MHz). Each sub-carrier carries an independent symbol; orthogonality means they don't interfere despite tight spacing. OFDM is the substrate for everything from 802.11a (1999) onward.

Sub-carrier modulation (BPSK → QPSK → 16-QAM → 64-QAM → 256-QAM → 1024-QAM → 4096-QAM with Wi-Fi 7) determines bits per symbol; the rate adaptation algorithm picks one based on link quality.

## OFDMA — Orthogonal Frequency-Division Multiple Access

Wi-Fi 6's headline change. Instead of one station occupying the whole 20/40/80/160 MHz channel for the duration of a frame, the AP divides the channel into Resource Units (RUs) and assigns RUs to multiple stations *simultaneously*.

| RU size | Sub-carriers | Use |
|---|---|---|
| 26-tone | 26 | Smallest unit; for tiny IoT frames |
| 52 / 106 | 52 / 106 | Mid-size |
| 242 | 242 | One full 20 MHz channel |
| 484 / 996 / 2×996 | … | 40 / 80 / 160 MHz |

A single transmission can include multiple stations on different RUs. The AP sends a Trigger Frame to schedule the uplink RUs.

**Offensive implication.** OFDMA's Trigger Frame is unauthenticated by default — variants of trigger-frame abuse (DoS, RU starvation) have been studied. As of 2026 there is no widely weaponised attack, but the surface is real.

## MU-MIMO — Multi-User MIMO

MIMO (Multiple Input, Multiple Output) uses multiple antennas to send multiple spatial streams to one client (SU-MIMO) or to several clients in parallel (MU-MIMO). Wi-Fi 5 introduced downlink MU-MIMO; Wi-Fi 6 added uplink.

An AP with 8×8 MU-MIMO can serve up to eight 1-stream clients on the same channel at once, multiplying air-time utilisation. The technique relies on **channel sounding** — the AP measures the channel response from each client and computes a precoding matrix to null one client's signal at the others' antennas.

**Offensive implication.** Channel-sounding feedback (NDP-A / VHT/HE Compressed Beamforming Report) is per-client, sent in the clear, and reveals fine-grained physical-layer information. Researchers have used it for through-wall sensing and presence detection.

## Beamforming

Single-user beamforming concentrates a transmission's energy toward a specific receiver by adjusting per-antenna phases — turning an omnidirectional antenna array into an effectively directional one. Two flavours:

- **Implicit BF** — AP infers the channel from the uplink (rare in modern Wi-Fi).
- **Explicit BF** — client measures and feeds back the channel (universal in Wi-Fi 5+).

**Offensive implication.**
- Beamformed transmissions reduce off-axis leakage. A receiver outside the beam direction may see the frame at -20 dB, hampering passive sniffing of unicast.
- The beamforming feedback frames themselves are unauthenticated and can be spoofed to misdirect transmissions.

## OFDMA + MU-MIMO together

Wi-Fi 6/7 stacks both: an OFDMA RU can be transmitted as MU-MIMO across multiple stations on that RU. Achieves the largest theoretical density gains in dense deployments (stadia, corporate offices).

## Sensing side-channels

Channel state information (CSI) — the per-sub-carrier amplitude/phase the receiver computes for OFDM demodulation — is observable in monitor mode on chipsets that expose it (Atheros 9580, Intel 5300, Nexmon-patched Broadcom). CSI variations across time encode physical motion, breathing, gesture, and (controversially) keystroke timing. This is the foundation for "Wi-Fi sensing" research and a privacy concern around 802.11bf.

## See also

- [802.11 standards](/wiki/concepts/802-11-standards/) — which amendments introduced each technique.
- [BSS coloring](/wiki/concepts/bss-coloring/) — Wi-Fi 6's spatial-reuse companion.
- [Beacon frames](/wiki/concepts/beacon-frames/) — where HE / EHT Operation IEs advertise OFDMA capability.

## References

- IEEE 802.11ax (2021), 802.11be (2024) — clauses on HE / EHT PHY.
- *A Tutorial on IEEE 802.11ax High-Efficiency WLANs* — Khorov et al., IEEE Comm. Surveys & Tutorials 2019.
